/**
 * WebSocket Service - Real-time communication module
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { Server } from 'http';
import { CapsuleType } from '../core/interfaces/IModule.js';
import { IWebSocketService, WebSocketMessage, StreamStatistics, LogEntry } from '../core/interfaces/IWebSocketService.js';
import { ModuleLifecycle } from '../core/lifecycle/ModuleLifecycle.js';
import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';

export class WebSocketService extends EventEmitter implements IWebSocketService {
  readonly name = 'websocket_service';
  readonly version = '1.0.0';
  readonly capsuleType = CapsuleType.OBSERVER;
  readonly dependencies: string[] = [];
  readonly exports = ['IWebSocketService'];

  private readonly lifecycle: ModuleLifecycle;
  private readonly httpServer: Server;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private clientCounter = 0;
  private messageQueue: WebSocketMessage[] = []; // Message queue for batching (optimization)
  private isProcessingQueue = false; // Queue processing flag
  private queueTimer: NodeJS.Timeout | null = null; // Queue processing timer

  constructor(_registry: ModuleRegistry, httpServer: Server) {
    super();
    // Registry is kept for potential future use, but HTTP server is injected directly
    this.httpServer = httpServer;
    this.lifecycle = new ModuleLifecycle(this.name);
  }

  async initialize(): Promise<void> {
    if (!this.lifecycle.canInitialize()) {
      return;
    }

    this.lifecycle.markInitializing();
    // WebSocket server will be initialized in activate()
    this.lifecycle.markInitialized();
  }

  async activate(): Promise<void> {
    if (!this.lifecycle.canActivate()) {
      return;
    }

    this.lifecycle.markActivating();

    // Use HTTP server from constructor (dependency injection)
    try {
      if (!this.httpServer) {
        console.warn('[WebSocket] HTTP server not provided, WebSocket service will not start');
        this.lifecycle.markError();
        return;
      }

      this.wss = new WebSocketServer({ 
        server: this.httpServer, 
        path: '/ws',
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3, // Compression level (0-9, 3 = balanced)
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024,
          },
          clientNoContextTakeover: true,
          serverNoContextTakeover: true,
          serverMaxWindowBits: 10,
          concurrencyLimit: 10,
          threshold: 1024, // Only compress messages > 1KB
        },
      });

      this.wss.on('connection', (ws: WebSocket, req) => {
        const clientId = `client_${++this.clientCounter}_${Date.now()}`;
        this.clients.set(clientId, ws);

        console.log(`[WebSocket] Client connected: ${clientId} (${req.socket.remoteAddress})`);

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: 'connected',
            data: { clientId, timestamp: Date.now() },
          } as WebSocketMessage)
        );

        // Handle client messages
        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            this.handleClientMessage(clientId, message);
          } catch (error) {
            console.error(`[WebSocket] Error parsing message from ${clientId}:`, error);
          }
        });

        // Handle client disconnect
        ws.on('close', () => {
          console.log(`[WebSocket] Client disconnected: ${clientId}`);
          this.clients.delete(clientId);
          this.emit('client_disconnected', clientId);
        });

        // Handle client errors
        ws.on('error', (error) => {
          console.error(`[WebSocket] Error from client ${clientId}:`, error);
          this.clients.delete(clientId);
        });

        this.emit('client_connected', clientId);
      });

      this.wss.on('error', (error) => {
        console.error('[WebSocket] Server error:', error);
        this.emit('error', error);
      });

      console.log('[WebSocket] Service activated');
      this.lifecycle.markActive();
    } catch (error) {
      console.error('[WebSocket] Failed to activate:', error);
      this.lifecycle.markError();
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return;
    }

    this.lifecycle.markDeactivating();

    // Clear queue timer (memory leak prevention)
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }

    // Process remaining queue before closing
    if (this.messageQueue.length > 0) {
      this.isProcessingQueue = true;
      const remainingMessages = this.messageQueue.splice(0);
      for (const message of remainingMessages) {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
        });
        for (const [clientId, ws] of this.clients.entries()) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(messageStr);
            }
          } catch (error) {
            console.error(`[WebSocket] Error sending to client ${clientId}:`, error);
          }
        }
      }
      this.isProcessingQueue = false;
    }

    // Close all client connections
    for (const [clientId, ws] of this.clients.entries()) {
      try {
        ws.close(1000, 'Server shutting down');
      } catch (error) {
        console.error(`[WebSocket] Error closing client ${clientId}:`, error);
      }
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('[WebSocket] Server closed');
      });
      this.wss = null;
    }

    this.lifecycle.markDeactivated();
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      return;
    }

    this.lifecycle.markDestroying();
    await this.deactivate();
    this.lifecycle.markDestroyed();
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      name: this.name,
      version: this.version,
      status: this.lifecycle.getInfo().status,
      clients: this.clients.size,
      lifecycle: this.lifecycle.getInfo(),
    };
  }

  validateDependencies(_registry: ModuleRegistry): boolean {
    return true;
  }

  broadcast(message: WebSocketMessage): void {
    if (!this.wss) {
      return;
    }

    // Add message to queue (optimization - batching)
    this.messageQueue.push(message);
    this.processQueue();
  }

  /**
   * Process message queue in batches (optimization - reduces network traffic)
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    // Clear existing timer
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
    }

    // Process queue with small delay for batching
    this.queueTimer = setTimeout(() => {
      this.isProcessingQueue = true;

      // Process batch (max 10 messages at a time)
      const batch = this.messageQueue.splice(0, 10);
      
      for (const message of batch) {
        const messageStr = JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
        });

        let sentCount = 0;
        for (const [clientId, ws] of this.clients.entries()) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(messageStr);
              sentCount++;
            }
          } catch (error) {
            console.error(`[WebSocket] Error sending to client ${clientId}:`, error);
            this.clients.delete(clientId);
          }
        }

        if (sentCount > 0) {
          this.emit('message_broadcast', message, sentCount);
        }
      }

      this.isProcessingQueue = false;
      this.queueTimer = null;

      // Process next batch if available
      if (this.messageQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }, 50); // 50ms batch delay
  }

  sendToClient(clientId: string, message: WebSocketMessage): void {
    const ws = this.clients.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      ws.send(
        JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
        })
      );
    } catch (error) {
      console.error(`[WebSocket] Error sending to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  broadcastStatistics(statistics: StreamStatistics[]): void {
    this.broadcast({
      type: 'statistics',
      data: statistics,
    });
  }

  broadcastLog(log: LogEntry): void {
    this.broadcast({
      type: 'log',
      data: log,
    });
  }

  broadcastStatus(status: any): void {
    this.broadcast({
      type: 'status',
      data: status,
    });
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    console.log(`[WebSocket] Message from ${clientId}:`, message.type);

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', data: {} });
        break;
      case 'subscribe':
        // Handle subscription requests (e.g., subscribe to specific platform stats)
        this.sendToClient(clientId, {
          type: 'subscribed',
          data: { topics: message.data?.topics || [] },
        });
        break;
      default:
        console.log(`[WebSocket] Unknown message type: ${message.type}`);
    }
  }
}


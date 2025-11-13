/**
 * WebSocket Service Interface - Real-time communication
 */

import { IModule, CapsuleType } from './IModule.js';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export interface StreamStatistics {
  platformId: string;
  platformName: string;
  bitrate?: number; // kbps
  fps?: number;
  resolution?: string;
  codec?: string;
  status: 'streaming' | 'idle' | 'error';
  uptime?: number; // seconds
  errors?: number;
  lastError?: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  source?: string;
  platformId?: string;
}

export interface IWebSocketService extends IModule {
  readonly capsuleType: CapsuleType.OBSERVER;

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage): void;

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void;

  /**
   * Get connected clients count
   */
  getClientCount(): number;

  /**
   * Broadcast stream statistics
   */
  broadcastStatistics(statistics: StreamStatistics[]): void;

  /**
   * Broadcast log entry
   */
  broadcastLog(log: LogEntry): void;

  /**
   * Broadcast stream status update
   */
  broadcastStatus(status: any): void;
}


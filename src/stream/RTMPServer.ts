/**
 * RTMP server - OBS Studio RTMP stream alıcı.
 */

import NodeMediaServer from 'node-media-server';
import { EventEmitter } from 'events';
import { IModule, CapsuleType } from '../core/interfaces/IModule.js';
import { IStreamProvider, StreamInfo, StreamStatus } from '../core/interfaces/IStreamProvider.js';
import { ModuleLifecycle } from '../core/lifecycle/ModuleLifecycle.js';
import { RTMPServerConfig } from '../config/Config.js';

export class RTMPServer extends EventEmitter implements IModule, IStreamProvider {
  private config: RTMPServerConfig; // Changed from readonly to allow updates
  private readonly lifecycle: ModuleLifecycle;
  private nms: NodeMediaServer | null = null;
  private streamInfo: StreamInfo | null = null;
  private status: StreamStatus = StreamStatus.IDLE;
  private connected: boolean = false;
  private subscriptionCallbacks: Map<string, (status: StreamStatus) => void> = new Map();
  private actualStreamPath: string | null = null; // Store actual stream path from OBS

  constructor(config: RTMPServerConfig) {
    super();
    this.config = config;
    this.lifecycle = new ModuleLifecycle('rtmp_server');
  }
  
  // Method to update config (for runtime config changes)
  updateConfig(newConfig: RTMPServerConfig): void {
    this.config = newConfig;
  }

  // IModule interface implementation

  get name(): string {
    return 'rtmp_server';
  }

  get version(): string {
    return '1.0.0';
  }

  get capsuleType(): CapsuleType {
    return CapsuleType.ORIGIN;
  }

  get dependencies(): string[] {
    return [];
  }

  get exports(): string[] {
    return ['IStreamProvider'];
  }

  async initialize(): Promise<void> {
    this.lifecycle.markInitializing();
    this.lifecycle.markInitialized();
  }

  async activate(): Promise<void> {
    if (!this.lifecycle.canActivate()) {
      throw new Error(`Cannot activate RTMP server in state: ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markActivating();

    try {
      await this.startServer();
      this.lifecycle.markActive();
    } catch (error) {
      this.lifecycle.markError();
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return;
    }

    this.lifecycle.markDeactivating();
    await this.stopServer();
    await this.disconnect();
    this.lifecycle.markDeactivated();
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      return;
    }

    this.lifecycle.markDestroying();
    await this.stopServer();
    await this.disconnect();
    this.lifecycle.markDestroyed();
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      lifecycle: this.lifecycle.getInfo(),
      connected: this.connected,
      config: {
        host: this.config.host,
        port: this.config.port,
        appName: this.config.appName,
        streamKey: this.config.streamKey,
      },
      streamInfo: this.streamInfo,
      actualStreamPath: this.actualStreamPath, // Include actual stream path for auto-detection
    };
  }

  validateDependencies(_registry: any): boolean {
    return true;
  }

  // IStreamProvider interface implementation

  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }

    if (!this.nms) {
      throw new Error(
        'RTMP server is not running. Please start the server first.\n' +
          'The server should start automatically when the application starts.'
      );
    }

    this.status = StreamStatus.CONNECTED;
    this.connected = true;

    // Use localhost for RTMP URL (not 0.0.0.0) because OBS needs to connect to localhost
    const rtmpHost = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
    const rtmpUrl = `rtmp://${rtmpHost}:${this.config.port}/${this.config.appName}/${this.config.streamKey}`;
    // Initialize streamInfo if not already set
    if (!this.streamInfo) {
      this.streamInfo = {
        streamKey: this.config.streamKey,
        rtmpUrl,
        status: this.status,
      };
    } else {
      // Update existing streamInfo
      this.streamInfo = {
        ...this.streamInfo,
        rtmpUrl,
        status: this.status,
      };
    }

    return true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.status = StreamStatus.DISCONNECTED;
    // Keep streamInfo but update status
    if (this.streamInfo) {
      this.streamInfo = {
        ...this.streamInfo,
        status: StreamStatus.DISCONNECTED,
      };
    }
  }

  async getStreamInfo(): Promise<StreamInfo | null> {
    // Return stream info if available, regardless of connected status
    // The status field will indicate if stream is actually streaming
    return this.streamInfo;
  }

  async *getStreamData(): AsyncGenerator<Buffer, void, unknown> {
    // Stream data is handled by node-media-server internally
    // This method is kept for interface compliance
    yield Buffer.alloc(0);
  }

  async subscribe(callback: (status: StreamStatus) => void): Promise<string> {
    const subscriptionId = `${Date.now()}-${Math.random()}`;
    this.subscriptionCallbacks.set(subscriptionId, callback);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptionCallbacks.delete(subscriptionId);
  }

  // RTMP server methods

  private async startServer(): Promise<void> {
    if (this.nms) {
      return;
    }

    // RTMP server optimization (optimization - reduce CPU/RAM usage)
    const nmsConfig = {
      rtmp: {
        port: this.config.port,
        chunk_size: 60000, // 60KB chunk size (optimized for network usage)
        gop_cache: true, // Enable GOP cache for better performance
        ping: 30, // Ping interval in seconds (optimized for connection stability)
        ping_timeout: 60, // Ping timeout in seconds (optimized for connection stability)
        // Additional optimizations for RTMP server
        fms_version: '3,5,7,9', // Flash Media Server version compatibility
        // Buffer settings (optimization - reduce memory usage)
        // Note: node-media-server doesn't expose buffer_size directly, but uses internal optimizations
      },
      http: {
        port: 8001,
        allow_origin: '*',
        mediaroot: './media',
        // HTTP optimizations
        // Note: node-media-server handles HTTP server internally
      },
      relay: {
        ffmpeg: 'ffmpeg',
        tasks: [],
        // Relay optimizations
        // Note: We handle relay manually in StreamManager for better control
      },
    };

    this.nms = new NodeMediaServer(nmsConfig);

    // Event listeners
    this.nms.on('preConnect', (id: any, args: any) => {
      console.log(`[RTMP Server] Pre-connect: ${id}`, args);
    });

    this.nms.on('postConnect', (id: any, args: any) => {
      console.log(`[RTMP Server] Post-connect: ${id}`, args);
    });

    this.nms.on('prePublish', (id: any, StreamPath: string, args: any) => {
      console.log(`[RTMP Server] Pre-publish: ${id}`, StreamPath, args);
      
      // Extract stream key from path (last segment after /)
      const pathParts = StreamPath.split('/').filter(part => part.length > 0);
      const streamKey = pathParts[pathParts.length - 1];
      
      // Validate stream key (allow any stream key if config doesn't specify, or match if specified)
      // This allows OBS to use different app names while still validating stream key
      if (this.config.streamKey && streamKey !== this.config.streamKey) {
        const session = this.nms!.getSession(id);
        session.reject();
        console.warn(`[RTMP Server] Invalid stream key: ${streamKey} (expected: ${this.config.streamKey})`);
        return;
      }
      
      // Log actual stream path for debugging
      console.log(`[RTMP Server] Accepting stream with path: ${StreamPath}, stream key: ${streamKey}`);
      
      // Stream is about to start
      this.status = StreamStatus.CONNECTING;
      this.emit('statusChange', StreamStatus.CONNECTING);
    });

    this.nms.on('postPublish', (id: any, StreamPath: string, args: any) => {
      console.log(`[RTMP Server] Post-publish: ${id}`, StreamPath, args);
      this.status = StreamStatus.STREAMING;
      this.connected = true;
      
      // Store actual stream path from OBS (may differ from config)
      this.actualStreamPath = StreamPath;
      console.log(`[RTMP Server] Actual stream path: ${StreamPath}`);
      
      // Use localhost for RTMP URL (not 0.0.0.0) because OBS needs to connect to localhost
      const rtmpHost = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
      // Use actual stream path for RTMP URL
      const rtmpUrl = `rtmp://${rtmpHost}:${this.config.port}${StreamPath}`;
      this.streamInfo = {
        streamKey: this.config.streamKey,
        rtmpUrl,
        status: StreamStatus.STREAMING,
      };

      for (const callback of this.subscriptionCallbacks.values()) {
        try {
          callback(StreamStatus.STREAMING);
        } catch (error) {
          console.error('Error calling stream status callback:', error);
        }
      }

      this.emit('streaming', { id, StreamPath, args });
      this.emit('statusChange', StreamStatus.STREAMING);
    });

    this.nms.on('donePublish', (id: any, StreamPath: string, args: any) => {
      console.log(`[RTMP Server] Done-publish: ${id}`, StreamPath, args);
      this.status = StreamStatus.IDLE;
      // Clear actual stream path when stream stops
      this.actualStreamPath = null;
      if (this.streamInfo) {
        this.streamInfo.status = StreamStatus.IDLE;
      }
      this.emit('donePublish', { id, StreamPath, args });
      this.emit('statusChange', StreamStatus.IDLE);
    });

    this.nms.run();

    // Use localhost for display (not 0.0.0.0) because OBS needs to connect to localhost
    const displayHost = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
    console.log(`[RTMP Server] Started on ${this.config.host}:${this.config.port}`);
    console.log(
      `[RTMP Server] RTMP URL: rtmp://${displayHost}:${this.config.port}/${this.config.appName}/${this.config.streamKey}`
    );
  }

  private async stopServer(): Promise<void> {
    if (!this.nms) {
      return;
    }

    try {
      this.nms.stop();
      this.nms = null;
      console.log('[RTMP Server] Stopped');
    } catch (error) {
      console.error('Error stopping RTMP server:', error);
    }
  }

  // Get stream path for relay
  // Returns actual stream path from OBS if available, otherwise uses config
  getStreamPath(): string {
    // Use actual stream path if available (from OBS connection)
    if (this.actualStreamPath) {
      return this.actualStreamPath;
    }
    // Fallback to config-based path
    return `/${this.config.appName}/${this.config.streamKey}`;
  }
}


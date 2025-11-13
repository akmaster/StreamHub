/**
 * Type definitions for node-media-server
 */

declare module 'node-media-server' {
  interface NodeMediaServerConfig {
    rtmp?: {
      port?: number;
      chunk_size?: number;
      gop_cache?: boolean;
      ping?: number;
      ping_timeout?: number;
    };
    http?: {
      port?: number;
      allow_origin?: string;
      mediaroot?: string;
    };
    relay?: {
      ffmpeg?: string;
      tasks?: any[];
    };
  }

  interface Session {
    reject(): void;
  }

  class NodeMediaServer {
    constructor(config: NodeMediaServerConfig);
    run(): void;
    stop(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    getSession(id: any): Session;
  }

  export default NodeMediaServer;
}


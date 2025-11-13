/**
 * Stream provider interface'i - Stream sağlayıcı modüller için.
 */

export enum StreamStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  STREAMING = 'streaming',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export interface StreamInfo {
  streamKey: string;
  rtmpUrl: string;
  status: StreamStatus;
  bitrate?: number;
  resolution?: string;
  fps?: number;
  metadata?: Record<string, any>;
}

export interface IStreamProvider {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getStreamInfo(): Promise<StreamInfo | null>;
  getStreamData(): AsyncGenerator<Buffer, void, unknown>;
  subscribe(callback: (status: StreamStatus) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
}


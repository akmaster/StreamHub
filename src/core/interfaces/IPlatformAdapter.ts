/**
 * Platform adapter interface'i - Platform adaptörleri için.
 */

export enum PlatformStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  STREAMING = 'streaming',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export interface PlatformConfig {
  id?: string; // Unique identifier for platform
  name: string;
  displayName?: string;
  rtmpUrl: string;
  streamKey: string;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

export interface IPlatformAdapter {
  readonly platformName: string;
  configure(config: PlatformConfig): Promise<{ success: boolean; error?: string }>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  startStream(): Promise<boolean>;
  stopStream(): Promise<void>;
  getPlatformStatus(): Promise<PlatformStatus>;
  getStatistics(): Promise<Record<string, any>>;
}


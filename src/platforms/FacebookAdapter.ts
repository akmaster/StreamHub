/**
 * Facebook platform adapter - Facebook RTMP stream yönetimi.
 */

import { BasePlatformAdapter } from './BasePlatformAdapter.js';
import { PlatformConfig } from '../core/interfaces/IPlatformAdapter.js';

export class FacebookAdapter extends BasePlatformAdapter {
  constructor() {
    super('facebook');
  }

  protected validateConfig(config: PlatformConfig): { success: boolean; error?: string } {
    if (!config.rtmpUrl) {
      return { success: false, error: 'RTMP URL is required' };
    }

    if (!config.rtmpUrl.startsWith('rtmp://') && !config.rtmpUrl.startsWith('rtmps://')) {
      return { success: false, error: 'Facebook RTMP URL must start with rtmp:// or rtmps://' };
    }

    if (!config.streamKey) {
      return { success: false, error: 'Stream key is required' };
    }

    return { success: true };
  }

  protected async activatePlatform(): Promise<void> {
    console.log(`[Facebook] Platform activated`);
  }

  protected async deactivatePlatform(): Promise<void> {
    console.log(`[Facebook] Platform deactivated`);
  }

  protected async destroyPlatform(): Promise<void> {
    console.log(`[Facebook] Platform destroyed`);
  }

  protected async connectPlatform(): Promise<void> {
    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    const rtmpUrl = this.config.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/';
    console.log(`[Facebook] Connecting to ${rtmpUrl}`);
  }

  protected async disconnectPlatform(): Promise<void> {
    console.log(`[Facebook] Disconnected`);
  }

  protected async startStreamPlatform(): Promise<void> {
    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    console.log(`[Facebook] Starting stream to ${this.config.rtmpUrl}`);
  }

  protected async stopStreamPlatform(): Promise<void> {
    console.log(`[Facebook] Stopping stream`);
  }
}


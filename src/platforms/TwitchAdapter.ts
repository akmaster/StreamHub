/**
 * Twitch platform adapter - Twitch RTMP stream yönetimi.
 */

import { BasePlatformAdapter } from './BasePlatformAdapter.js';
import { PlatformConfig } from '../core/interfaces/IPlatformAdapter.js';

export class TwitchAdapter extends BasePlatformAdapter {
  constructor() {
    super('twitch');
  }

  protected validateConfig(config: PlatformConfig): { success: boolean; error?: string } {
    if (!config.rtmpUrl) {
      return { success: false, error: 'RTMP URL is required' };
    }

    if (!config.rtmpUrl.startsWith('rtmp://')) {
      return { success: false, error: 'Twitch RTMP URL must start with rtmp://' };
    }

    if (!config.streamKey) {
      return { success: false, error: 'Stream key is required' };
    }

    return { success: true };
  }

  protected async activatePlatform(): Promise<void> {
    console.log(`[Twitch] Platform activated`);
  }

  protected async deactivatePlatform(): Promise<void> {
    console.log(`[Twitch] Platform deactivated`);
  }

  protected async destroyPlatform(): Promise<void> {
    console.log(`[Twitch] Platform destroyed`);
  }

  protected async connectPlatform(): Promise<void> {
    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    const rtmpUrl = this.config.rtmpUrl || 'rtmp://live.twitch.tv/app/';
    console.log(`[Twitch] Connecting to ${rtmpUrl}`);
  }

  protected async disconnectPlatform(): Promise<void> {
    console.log(`[Twitch] Disconnected`);
  }

  protected async startStreamPlatform(): Promise<void> {
    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    console.log(`[Twitch] Starting stream to ${this.config.rtmpUrl}`);
  }

  protected async stopStreamPlatform(): Promise<void> {
    console.log(`[Twitch] Stopping stream`);
  }
}


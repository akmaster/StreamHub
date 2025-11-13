/**
 * Base platform adapter - Platform adaptörleri için temel sınıf.
 */

import { IModule, CapsuleType } from '../core/interfaces/IModule.js';
import {
  IPlatformAdapter,
  PlatformConfig,
  PlatformStatus,
} from '../core/interfaces/IPlatformAdapter.js';
import { ModuleLifecycle } from '../core/lifecycle/ModuleLifecycle.js';
import { EventEmitter } from 'events';

export abstract class BasePlatformAdapter
  extends EventEmitter
  implements IModule, IPlatformAdapter
{
  protected config: PlatformConfig | null = null;
  protected readonly lifecycle: ModuleLifecycle;
  protected status: PlatformStatus = PlatformStatus.IDLE;
  protected connected: boolean = false;
  protected streaming: boolean = false;

  constructor(public readonly platformName: string) {
    super();
    this.lifecycle = new ModuleLifecycle(`platform_${platformName}`);
  }

  // IModule interface implementation

  get name(): string {
    return `platform_${this.platformName}`;
  }

  get version(): string {
    return '1.0.0';
  }

  get capsuleType(): CapsuleType {
    return CapsuleType.BRIDGE;
  }

  get dependencies(): string[] {
    return [];
  }

  get exports(): string[] {
    return ['IPlatformAdapter'];
  }

  async initialize(): Promise<void> {
    this.lifecycle.markInitializing();
    this.lifecycle.markInitialized();
  }

  async activate(): Promise<void> {
    if (!this.lifecycle.canActivate()) {
      throw new Error(
        `Cannot activate platform ${this.platformName} in state: ${this.lifecycle.currentState}`
      );
    }

    this.lifecycle.markActivating();
    await this.activatePlatform();
    this.lifecycle.markActive();
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return;
    }

    this.lifecycle.markDeactivating();
    await this.stopStream();
    await this.disconnect();
    await this.deactivatePlatform();
    this.lifecycle.markDeactivated();
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      return;
    }

    this.lifecycle.markDestroying();
    await this.stopStream();
    await this.disconnect();
    await this.destroyPlatform();
    this.lifecycle.markDestroyed();
  }

  // IModule interface - getStatus
  // IModule interface - getStatus
  async getModuleStatus(): Promise<Record<string, any>> {
    return {
      name: this.name,
      version: this.version,
      platformName: this.platformName,
      status: this.status,
      connected: this.connected,
      streaming: this.streaming,
      lifecycle: this.lifecycle.getInfo(),
      config: this.config
        ? {
            name: this.config.name,
            displayName: this.config.displayName,
            rtmpUrl: this.config.rtmpUrl,
            enabled: this.config.enabled,
          }
        : null,
    };
  }

  validateDependencies(_registry: any): boolean {
    return true;
  }

  // IModule interface - getStatus
  async getStatus(): Promise<Record<string, any>> {
    return this.getModuleStatus();
  }

  // IPlatformAdapter interface - getPlatformStatus
  async getPlatformStatus(): Promise<PlatformStatus> {
    return this.status;
  }

  // IPlatformAdapter interface implementation

  async configure(config: PlatformConfig): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateConfig(config);
    if (!validation.success) {
      return validation;
    }

    this.config = config;
    return { success: true };
  }

  async connect(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    if (!this.config.enabled) {
      throw new Error(`Platform ${this.platformName} is disabled`);
    }

    if (!this.config.rtmpUrl || !this.config.streamKey) {
      throw new Error(`Platform ${this.platformName} RTMP URL or stream key is not set`);
    }

    try {
      await this.connectPlatform();
      this.connected = true;
      this.status = PlatformStatus.CONNECTED;
      return true;
    } catch (error) {
      this.status = PlatformStatus.ERROR;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.disconnectPlatform();
      this.connected = false;
      this.status = PlatformStatus.DISCONNECTED;
    } catch (error) {
      console.error(`Error disconnecting platform ${this.platformName}:`, error);
    }
  }

  async startStream(): Promise<boolean> {
    if (!this.connected) {
      throw new Error(`Platform ${this.platformName} is not connected`);
    }

    if (!this.config) {
      throw new Error('Platform configuration is not set');
    }

    try {
      await this.startStreamPlatform();
      this.streaming = true;
      this.status = PlatformStatus.STREAMING;
      return true;
    } catch (error) {
      this.status = PlatformStatus.ERROR;
      throw error;
    }
  }

  async stopStream(): Promise<void> {
    if (!this.streaming) {
      return;
    }

    try {
      await this.stopStreamPlatform();
      this.streaming = false;
      this.status = PlatformStatus.CONNECTED;
    } catch (error) {
      console.error(`Error stopping stream for platform ${this.platformName}:`, error);
    }
  }

  async getStatistics(): Promise<Record<string, any>> {
    return {
      platform: this.platformName,
      status: this.status,
      connected: this.connected,
      streaming: this.streaming,
      config: this.config
        ? {
            name: this.config.name,
            displayName: this.config.displayName,
            enabled: this.config.enabled,
          }
        : null,
    };
  }

  // Abstract methods - platform-specific implementation

  protected abstract validateConfig(config: PlatformConfig): { success: boolean; error?: string };
  protected abstract activatePlatform(): Promise<void>;
  protected abstract deactivatePlatform(): Promise<void>;
  protected abstract destroyPlatform(): Promise<void>;
  protected abstract connectPlatform(): Promise<void>;
  protected abstract disconnectPlatform(): Promise<void>;
  protected abstract startStreamPlatform(): Promise<void>;
  protected abstract stopStreamPlatform(): Promise<void>;
}

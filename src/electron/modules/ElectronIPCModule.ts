/**
 * Electron IPC Module - Thought Capsule
 * 
 * Bu modül, Electron IPC (Inter-Process Communication) işlemlerini yönetir.
 * 
 * @module ElectronIPCModule
 * @description Electron IPC yönetimi modülü - tam bağımsız
 * @dependencies IElectronApp (interface)
 * @exports IElectronIPC
 * @lifecycle initialize → activate → (runtime) → deactivate → destroy
 * @capsuleType bridge (Köprü - main ve renderer process arasında iletişim)
 */

import { ipcMain } from 'electron';
import { IModule, CapsuleType } from '../../core/interfaces/IModule.js';
import { ModuleLifecycle } from '../../core/lifecycle/ModuleLifecycle.js';
import { IElectronApp } from '../interfaces/IElectronApp.js';
import { safeLog, safeError } from '../../utils/ElectronLogger.js';

export interface IElectronIPC {
  registerHandler(channel: string, handler: (...args: any[]) => Promise<any>): void;
  unregisterHandler(channel: string): void;
  getHandlers(): string[];
}

export class ElectronIPCModule implements IModule, IElectronIPC {
  readonly name: string = 'electron_ipc';
  readonly version: string = '1.0.0';
  readonly capsuleType: CapsuleType = CapsuleType.BRIDGE;
  readonly dependencies: string[] = ['IElectronApp'];
  readonly exports: string[] = ['IElectronIPC'];

  private lifecycle: ModuleLifecycle;
  private appModule: IElectronApp | null = null;
  private handlers: Map<string, (...args: any[]) => Promise<any>> = new Map();

  constructor(appModule?: IElectronApp) {
    this.lifecycle = new ModuleLifecycle(this.name);
    this.appModule = appModule || null;
  }

  // IModule implementation
  async initialize(): Promise<void> {
    if (!this.lifecycle.canInitialize()) {
      throw new Error(`Cannot initialize ${this.name} in state ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markInitializing();
    safeLog(`[${this.name}] Initializing IPC module...`);

    try {
      // IPC handlers will be registered in activate()
      this.lifecycle.markInitialized();
      safeLog(`[${this.name}] ✅ IPC module initialized`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to initialize:`, error);
      throw error;
    }
  }

  async activate(): Promise<void> {
    if (!this.lifecycle.canActivate()) {
      throw new Error(`Cannot activate ${this.name} in state ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markActivating();
    safeLog(`[${this.name}] Activating IPC module...`);

    try {
      // Register default IPC handlers
      this.registerDefaultHandlers();

      this.lifecycle.markActive();
      safeLog(`[${this.name}] ✅ IPC module activated`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to activate:`, error);
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return;
    }

    this.lifecycle.markDeactivating();
    safeLog(`[${this.name}] Deactivating IPC module...`);

    try {
      // Remove all handlers
      for (const channel of this.handlers.keys()) {
        this.unregisterHandler(channel);
      }

      this.lifecycle.markDeactivated();
      safeLog(`[${this.name}] ✅ IPC module deactivated`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to deactivate:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      if (this.lifecycle.currentState === 'active') {
        await this.deactivate();
      }
    }

    this.lifecycle.markDestroying();
    safeLog(`[${this.name}] Destroying IPC module...`);

    try {
      // Clear all handlers
      this.handlers.clear();
      this.appModule = null;

      this.lifecycle.markDestroyed();
      safeLog(`[${this.name}] ✅ IPC module destroyed`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to destroy:`, error);
      throw error;
    }
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      ...this.lifecycle.getInfo(),
      handlersCount: this.handlers.size,
      handlers: Array.from(this.handlers.keys()),
    };
  }

  validateDependencies(registry: any): boolean {
    // IPC module requires IElectronApp
    if (!this.appModule) {
      try {
        this.appModule = registry.resolve('IElectronApp');
      } catch {
        return false;
      }
    }
    return this.appModule !== null;
  }

  // IElectronIPC implementation
  registerHandler(channel: string, handler: (...args: any[]) => Promise<any>): void {
    if (this.handlers.has(channel)) {
      safeLog(`[${this.name}] Replacing existing handler for channel: ${channel}`);
      ipcMain.removeHandler(channel);
    }

    this.handlers.set(channel, handler);
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return await handler(...args);
      } catch (error) {
        safeError(`[${this.name}] Error in IPC handler ${channel}:`, error);
        throw error;
      }
    });

    safeLog(`[${this.name}] Registered IPC handler: ${channel}`);
  }

  unregisterHandler(channel: string): void {
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
      safeLog(`[${this.name}] Unregistered IPC handler: ${channel}`);
    }
  }

  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  // Private methods
  private registerDefaultHandlers(): void {
    if (!this.appModule) {
      safeError(`[${this.name}] Cannot register default handlers: app module not available`);
      return;
    }

    // Get server URL
    this.registerHandler('get-server-url', async () => {
      const serverInfo = this.appModule!.getServerInfo();
      return serverInfo?.url || null;
    });

    // Get server status
    this.registerHandler('get-server-status', async () => {
      const serverInfo = this.appModule!.getServerInfo();
      return {
        running: serverInfo !== null,
        url: serverInfo?.url || null,
        port: serverInfo?.port || null,
      };
    });

    // Intro complete notification
    this.registerHandler('intro-complete', async () => {
      safeLog(`[${this.name}] Intro completed, switching to main window...`);
      // This will be handled by the window manager
      return { success: true };
    });
  }

  setAppModule(appModule: IElectronApp): void {
    this.appModule = appModule;
  }
}


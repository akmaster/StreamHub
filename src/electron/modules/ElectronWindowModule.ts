/**
 * Electron Window Module - Thought Capsule
 * 
 * Bu modül, Electron pencerelerini yönetir. Tam bağımsız bir düşünce kapsülüdür.
 * 
 * @module ElectronWindowModule
 * @description Electron penceresi yönetimi modülü - tam bağımsız
 * @dependencies IElectronWindow (interface)
 * @exports IElectronWindow
 * @lifecycle initialize → activate → (runtime) → deactivate → destroy
 * @capsuleType origin (Başlangıç noktası - kullanıcı girişleri)
 */

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { IModule, CapsuleType } from '../../core/interfaces/IModule.js';
import { ModuleLifecycle, LifecycleState } from '../../core/lifecycle/ModuleLifecycle.js';
import { IElectronWindow, WindowStatus } from '../interfaces/IElectronWindow.js';
import { safeLog, safeError } from '../../utils/ElectronLogger.js';

export class ElectronWindowModule implements IModule, IElectronWindow {
  readonly name: string = 'electron_window';
  readonly version: string = '1.0.0';
  readonly capsuleType: CapsuleType = CapsuleType.ORIGIN;
  readonly dependencies: string[] = [];
  readonly exports: string[] = ['IElectronWindow'];

  private readonly id: string;
  private window: BrowserWindow | null = null;
  private lifecycle: ModuleLifecycle;
  private options: BrowserWindowConstructorOptions;
  private initialURL?: string;

  constructor(
    id: string,
    options: BrowserWindowConstructorOptions,
    initialURL?: string
  ) {
    this.id = id;
    this.options = options;
    this.initialURL = initialURL;
    this.lifecycle = new ModuleLifecycle(this.name);
  }

  // IModule implementation
  async initialize(): Promise<void> {
    if (!this.lifecycle.canInitialize()) {
      throw new Error(`Cannot initialize ${this.name} in state ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markInitializing();
    safeLog(`[${this.name}] Initializing window module: ${this.id}`);

    try {
      // Window oluşturulmaz, sadece hazırlık yapılır
      // Window create() metodunda oluşturulur (lazy initialization)
      this.lifecycle.markInitialized();
      safeLog(`[${this.name}] ✅ Window module initialized: ${this.id}`);
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
    safeLog(`[${this.name}] Activating window module: ${this.id}`);

    try {
      // Window'u oluştur ve göster
      await this.create();
      if (this.initialURL) {
        await this.loadURL(this.initialURL);
      }
      await this.show();

      this.lifecycle.markActive();
      safeLog(`[${this.name}] ✅ Window module activated: ${this.id}`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to activate:`, error);
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return; // Zaten deaktif
    }

    this.lifecycle.markDeactivating();
    safeLog(`[${this.name}] Deactivating window module: ${this.id}`);

    try {
      await this.hide();
      this.lifecycle.markDeactivated();
      safeLog(`[${this.name}] ✅ Window module deactivated: ${this.id}`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to deactivate:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      // Eğer aktifse önce deaktif et
      if (this.lifecycle.currentState === LifecycleState.ACTIVE) {
        await this.deactivate();
      }
    }

    this.lifecycle.markDestroying();
    safeLog(`[${this.name}] Destroying window module: ${this.id}`);

    try {
      await this.close();
      this.window = null;
      this.lifecycle.markDestroyed();
      safeLog(`[${this.name}] ✅ Window module destroyed: ${this.id}`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to destroy:`, error);
      throw error;
    }
  }

  async getStatus(): Promise<Record<string, any>> {
    const windowStatus = await this.getWindowStatus();
    return {
      ...this.lifecycle.getInfo(),
      window: windowStatus,
    };
  }

  validateDependencies(_registry: any): boolean {
    // Bu modül bağımlılık gerektirmez
    return true;
  }

  // IElectronWindow implementation
  get windowId(): string {
    return this.id;
  }

  get windowInstance(): BrowserWindow | null {
    return this.window;
  }

  async create(): Promise<void> {
    if (this.window) {
      safeLog(`[${this.name}] Window already exists: ${this.id}`);
      return;
    }

    safeLog(`[${this.name}] Creating window: ${this.id}`);
    
    // Set icon if not already specified in options
    if (!this.options.icon) {
      try {
        const { app } = await import('electron');
        const { join } = await import('path');
        const { fileURLToPath } = await import('url');
        const { dirname } = await import('path');
        const { existsSync } = await import('fs');
        
        let iconPath: string;
        const __filename = fileURLToPath(import.meta.url);
        const __dirnameResolved = dirname(__filename);
        
        if (app.isPackaged) {
          // Production: Use icon from resources
          iconPath = join(process.resourcesPath, 'assets', 'icon.ico');
        } else {
          // Development: Use icon from project root
          const projectRoot = join(__dirnameResolved, '..', '..', '..');
          iconPath = join(projectRoot, 'assets', 'icon.ico');
        }
        
        // Fallback to PNG if ICO doesn't exist
        if (!existsSync(iconPath)) {
          iconPath = iconPath.replace('.ico', '.png');
        }
        
        if (existsSync(iconPath)) {
          this.options.icon = iconPath;
          safeLog(`[${this.name}] Window icon set: ${iconPath}`);
        }
      } catch (error) {
        safeError(`[${this.name}] Failed to set window icon:`, error);
      }
    }
    
    this.window = new BrowserWindow(this.options);

    // Window closed event handler
    this.window.on('closed', () => {
      this.window = null;
      safeLog(`[${this.name}] Window closed: ${this.id}`);
    });

    // Show window when ready
    this.window.once('ready-to-show', () => {
      safeLog(`[${this.name}] Window ready: ${this.id}`);
    });

    // Handle navigation errors
    this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      safeError(`[${this.name}] Failed to load: ${errorCode} - ${errorDescription}`);
    });

    safeLog(`[${this.name}] ✅ Window created: ${this.id}`);
  }

  async show(): Promise<void> {
    if (!this.window) {
      await this.create();
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
    }
  }

  async hide(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  async close(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
      this.window = null;
    }
  }

  async focus(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
    }
  }

  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  async loadURL(url: string): Promise<void> {
    if (!this.window) {
      await this.create();
    }

    if (this.window && !this.window.isDestroyed()) {
      await this.window.loadURL(url);
    }
  }

  async getWindowStatus(): Promise<WindowStatus> {
    if (!this.window || this.window.isDestroyed()) {
      return {
        id: this.id,
        visible: false,
        focused: false,
      };
    }

    return {
      id: this.id,
      visible: this.window.isVisible(),
      focused: this.window.isFocused(),
      url: this.window.webContents.getURL(),
      bounds: this.window.getBounds(),
    };
  }
}


/**
 * Electron Application Module - Thought Capsule
 * 
 * Bu modül, Electron uygulamasının ana yönetimini yapar. Tam bağımsız bir düşünce kapsülüdür.
 * 
 * @module ElectronAppModule
 * @description Electron uygulama yönetimi modülü - tam bağımsız
 * @dependencies IElectronWindow (interface), ServerInfo (interface)
 * @exports IElectronApp
 * @lifecycle initialize → activate → (runtime) → deactivate → destroy
 * @capsuleType origin (Başlangıç noktası - uygulama girişi)
 */

import { app, dialog } from 'electron';
import { IModule, CapsuleType } from '../../core/interfaces/IModule.js';
import { ModuleLifecycle } from '../../core/lifecycle/ModuleLifecycle.js';
import { IElectronApp } from '../interfaces/IElectronApp.js';
import { IElectronWindow } from '../interfaces/IElectronWindow.js';
import { startServer, stopServer, ServerInfo } from '../server.js';
import { safeLog, safeError, safeWarn } from '../../utils/ElectronLogger.js';
import { setupElectronConsole } from '../../utils/ElectronLogger.js';

export class ElectronAppModule implements IModule, IElectronApp {
  readonly name: string = 'electron_app';
  readonly version: string = '1.0.0';
  readonly capsuleType: CapsuleType = CapsuleType.ORIGIN;
  readonly dependencies: string[] = [];
  readonly exports: string[] = ['IElectronApp'];

  private lifecycle: ModuleLifecycle;
  private serverInfo: ServerInfo | null = null;
  private isQuitting: boolean = false;
  private windows: Map<string, IElectronWindow> = new Map();

  constructor() {
    this.lifecycle = new ModuleLifecycle(this.name);
    // Setup Electron-safe console handlers (prevent EPIPE errors)
    setupElectronConsole();
  }

  // IModule implementation
  async initialize(): Promise<void> {
    if (!this.lifecycle.canInitialize()) {
      throw new Error(`Cannot initialize ${this.name} in state ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markInitializing();
    safeLog(`[${this.name}] Initializing Electron application...`);

    try {
      // Electron app ready event handler
      if (!app.isReady()) {
        await app.whenReady();
      }

      this.lifecycle.markInitialized();
      safeLog(`[${this.name}] ✅ Electron application initialized`);
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
    safeLog(`[${this.name}] Activating Electron application...`);

    try {
      // Initialize app
      await this.initializeApp();

      this.lifecycle.markActive();
      safeLog(`[${this.name}] ✅ Electron application activated`);
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
    safeLog(`[${this.name}] Deactivating Electron application...`);

    try {
      // Stop server if running
      if (this.serverInfo) {
        await this.stopServer(this.serverInfo);
      }

      // Close all windows
      for (const window of this.windows.values()) {
        await window.deactivate();
      }

      this.lifecycle.markDeactivated();
      safeLog(`[${this.name}] ✅ Electron application deactivated`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to deactivate:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      // Eğer aktifse önce deaktif et
      if (this.lifecycle.currentState === 'active') {
        await this.deactivate();
      }
    }

    this.lifecycle.markDestroying();
    safeLog(`[${this.name}] Destroying Electron application...`);

    try {
      // Destroy all windows
      for (const window of this.windows.values()) {
        await window.destroy();
      }
      this.windows.clear();

      this.lifecycle.markDestroyed();
      safeLog(`[${this.name}] ✅ Electron application destroyed`);
    } catch (error) {
      this.lifecycle.markError();
      safeError(`[${this.name}] ❌ Failed to destroy:`, error);
      throw error;
    }
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      ...this.lifecycle.getInfo(),
      isPackaged: this.isPackaged,
      userDataPath: this.userDataPath,
      serverRunning: this.serverInfo !== null,
      windowsCount: this.windows.size,
    };
  }

  validateDependencies(_registry: any): boolean {
    // Bu modül bağımlılık gerektirmez
    return true;
  }

  // IElectronApp implementation
  get isPackaged(): boolean {
    return app.isPackaged;
  }

  get userDataPath(): string {
    return app.getPath('userData');
  }

  async initializeApp(): Promise<void> {
    safeLog(`[${this.name}] Initializing application...`);

    try {
      // Start the backend server
      this.serverInfo = await this.startServer();

      // Setup app event handlers
      this.setupAppHandlers();

      safeLog(`[${this.name}] ✅ Application initialized successfully`);
    } catch (error) {
      safeError(`[${this.name}] ❌ Failed to initialize application:`, error);

      // Show error dialog
      if (app.isReady()) {
        dialog.showErrorBox(
          'Application Error',
          `Failed to start the application: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Exit the application
      await this.quit();
      throw error;
    }
  }

  async startServer(): Promise<ServerInfo> {
    if (this.serverInfo) {
      safeWarn(`[${this.name}] Server already running`);
      return this.serverInfo;
    }

    safeLog(`[${this.name}] Starting backend server...`);
    this.serverInfo = await startServer();
    safeLog(`[${this.name}] ✅ Backend server started`);
    return this.serverInfo;
  }

  async stopServer(serverInfo: ServerInfo): Promise<void> {
    if (!this.serverInfo) {
      safeWarn(`[${this.name}] Server not running`);
      return;
    }

    safeLog(`[${this.name}] Stopping backend server...`);
    await stopServer(serverInfo);
    this.serverInfo = null;
    safeLog(`[${this.name}] ✅ Backend server stopped`);
  }

  getServerInfo(): ServerInfo | null {
    return this.serverInfo;
  }

  async quit(): Promise<void> {
    if (this.isQuitting) {
      return;
    }

    this.isQuitting = true;
    safeLog(`[${this.name}] Quitting application...`);

    try {
      await this.deactivate();
      app.quit();
    } catch (error) {
      safeError(`[${this.name}] ❌ Error during quit:`, error);
      app.exit(1);
    }
  }

  // Window management (Magnetic Fields - Public API)
  registerWindow(id: string, window: IElectronWindow): void {
    this.windows.set(id, window);
    safeLog(`[${this.name}] Window registered: ${id}`);
  }

  getWindow(id: string): IElectronWindow | undefined {
    return this.windows.get(id);
  }

  unregisterWindow(id: string): void {
    this.windows.delete(id);
    safeLog(`[${this.name}] Window unregistered: ${id}`);
  }

  // Private methods (Magnetic Fields - Internal Logic)
  private setupAppHandlers(): void {
    // Handle macOS activate
    app.on('activate', () => {
      // macOS specific: re-create window if all windows are closed
      if (process.platform === 'darwin') {
        const mainWindow = this.windows.get('main');
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        this.quit();
      }
    });

    // Handle application before quit
    app.on('before-quit', async (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        await this.quit();
      }
    });

    // Handle application will quit
    app.on('will-quit', () => {
      if (this.serverInfo) {
        safeLog(`[${this.name}] Force quitting application...`);
      }
    });

    // Handle application quit
    app.on('quit', () => {
      safeLog(`[${this.name}] Application quit`);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      const nodeError = error as NodeJS.ErrnoException;

      // Ignore EPIPE errors (already handled by setupElectronConsole)
      if (nodeError.code === 'EPIPE' || nodeError.code === 'EOF') {
        return;
      }

      safeError(`[${this.name}] Uncaught exception:`, error);

      // Show dialog if app is ready
      if (app.isReady()) {
        try {
          dialog.showErrorBox('Uncaught Exception', error.message);
        } catch {
          // Ignore if dialog cannot be shown
        }
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      // Check if reason is an EPIPE error
      if (reason instanceof Error) {
        const nodeError = reason as NodeJS.ErrnoException;
        if (nodeError.code === 'EPIPE' || nodeError.code === 'EOF') {
          return;
        }
      }

      // Check if reason string contains EPIPE
      const reasonStr = String(reason);
      if (reasonStr.includes('EPIPE') || reasonStr.includes('EOF') || reasonStr.includes('broken pipe')) {
        return;
      }

      safeError(`[${this.name}] Unhandled rejection:`, reason);

      // Show dialog if app is ready
      if (app.isReady()) {
        try {
          const errorMessage = reason instanceof Error ? reason.message : reasonStr;
          dialog.showErrorBox('Unhandled Rejection', errorMessage);
        } catch {
          // Ignore if dialog cannot be shown
        }
      }
    });
  }
}


/**
 * Electron Main Process - Entry Point
 * 
 * Bu dosya, Electron uygulamasının giriş noktasıdır.
 * Memory prensiplerine göre: Full Modular Architecture, Interface-Driven Design
 * 
 * @module ElectronMain
 * @description Electron ana process giriş noktası
 * @architecture Thought Capsules (Düşünce Kapsülleri)
 * @principles Full Modular, Interface-Driven, Dependency Injection
 */

import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ElectronAppModule } from './modules/ElectronAppModule.js';
import { ElectronWindowModule } from './modules/ElectronWindowModule.js';
import { ElectronIPCModule } from './modules/ElectronIPCModule.js';
import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';
import { safeLog, safeError, setupElectronConsole } from '../utils/ElectronLogger.js';

// Get __dirname for ES modules
let __dirnameResolved: string;
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirnameResolved = dirname(__filename);
} catch (error) {
  // Fallback for Electron production builds
  __dirnameResolved = app.isPackaged 
    ? dirname(process.execPath)
    : process.cwd();
}

// Setup Electron-safe console handlers (prevent EPIPE errors)
setupElectronConsole();

/**
 * Initialize Electron application with modular architecture
 */
async function initializeElectronApp(): Promise<void> {
  safeLog('[Electron] Initializing Electron application with modular architecture...');

  try {
    // Create module registry (Dependency Injection container)
    const registry = new ModuleRegistry();

    // Register Electron App Module
    const appModule = new ElectronAppModule();
    registry.register(
      'electron_app',
      () => appModule,
      [],
      ['IElectronApp'],
      true
    );

    // Register IPC Module (depends on IElectronApp)
    const ipcModule = new ElectronIPCModule(appModule);
    registry.register(
      'electron_ipc',
      () => ipcModule,
      ['IElectronApp'],
      ['IElectronIPC'],
      true
    );

    // Initialize all modules
    await registry.initializeAll();

    // Note: Application icon is set via BrowserWindow options in ElectronWindowModule
    // and via package.json build configuration for the executable
    safeLog('[Electron] Application icon will be set via window options and build config');

    // Create windows after app is ready
    app.whenReady().then(async () => {
      safeLog('[Electron] Application ready, creating windows...');

      try {
        // Activate all modules
        await registry.activateAll();

        // Get server info
        const serverInfo = appModule.getServerInfo();
        if (!serverInfo) {
          throw new Error('Server info not available');
        }

        // Create intro window
        const introWindow = new ElectronWindowModule(
          'intro',
          {
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 700,
            frame: false,
            transparent: false,
            backgroundColor: '#0a0e1a',
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false,
              webSecurity: true,
              allowRunningInsecureContent: false,
              preload: app.isPackaged
                ? join(process.resourcesPath, 'dist', 'electron', 'preload.js')
                : join(__dirnameResolved, 'preload.js'),
            },
            show: false,
            resizable: true,
            movable: true,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
          },
          `${serverInfo.url}/intro`
        );

        // Create main window
        const mainWindow = new ElectronWindowModule(
          'main',
          {
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 700,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false,
              webSecurity: true,
              allowRunningInsecureContent: false,
              preload: app.isPackaged
                ? join(process.resourcesPath, 'dist', 'electron', 'preload.js')
                : join(__dirnameResolved, 'preload.js'),
            },
            show: false,
            titleBarStyle: 'default',
            autoHideMenuBar: true,
          },
          serverInfo.url
        );

        // Register windows with app module
        appModule.registerWindow('intro', introWindow);
        appModule.registerWindow('main', mainWindow);

        // Initialize and activate windows
        await introWindow.initialize();
        await introWindow.activate();

        // Register IPC handler for intro complete
        ipcModule.registerHandler('intro-complete', async () => {
          safeLog('[Electron] Intro completed, switching to main window...');
          
          try {
            // Deactivate intro window
            await introWindow.deactivate();
            appModule.unregisterWindow('intro');
            
            // Activate main window
            await mainWindow.initialize();
            await mainWindow.activate();
            
            return { success: true };
          } catch (error) {
            safeError('[Electron] Error handling intro complete:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          }
        });

        safeLog('[Electron] ✅ Electron application initialized successfully');
      } catch (error) {
        safeError('[Electron] ❌ Failed to initialize windows:', error);
        await appModule.quit();
      }
    });

    // Handle app activation (macOS)
    app.on('activate', async () => {
      const mainWindow = appModule.getWindow('main');
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.focus();
      } else {
        const introWindow = appModule.getWindow('intro');
        if (introWindow) {
          await introWindow.show();
          await introWindow.focus();
        }
      }
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        appModule.quit();
      }
    });

  } catch (error) {
    safeError('[Electron] ❌ Failed to initialize Electron application:', error);
    app.exit(1);
  }
}

// Start Electron application
initializeElectronApp().catch((error) => {
  safeError('[Electron] Fatal error:', error);
  app.exit(1);
});

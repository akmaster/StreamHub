/**
 * Electron Update Module - Auto-updater
 * 
 * Bu modül, Electron uygulamasının otomatik güncelleme sistemini yönetir.
 * İlk açılışta ve periyodik olarak versiyon kontrolü yapar.
 * 
 * @module ElectronUpdateModule
 * @description Electron auto-updater modülü - tam bağımsız
 * @dependencies electron-updater
 * @exports ElectronUpdateModule
 * @lifecycle initialize → activate → (runtime) → deactivate → destroy
 * @capsuleType processor (İşlemci - güncelleme işlemlerini yönetir)
 */

import { autoUpdater } from 'electron-updater';
import { app, dialog } from 'electron';
import { IModule, CapsuleType } from '../../core/interfaces/IModule.js';
import { ModuleLifecycle } from '../../core/lifecycle/ModuleLifecycle.js';
import { safeLog, safeError, safeWarn } from '../../utils/ElectronLogger.js';

export class ElectronUpdateModule implements IModule {
  readonly name: string = 'electron_update';
  readonly version: string = '1.0.0';
  readonly capsuleType: CapsuleType = CapsuleType.PROCESSOR;
  readonly dependencies: string[] = [];
  readonly exports: string[] = ['ElectronUpdateModule'];

  private lifecycle: ModuleLifecycle;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 1000 * 60 * 60 * 24; // 24 saat
  private updateAvailable: boolean = false;
  private updateInfo: any = null;

  constructor() {
    this.lifecycle = new ModuleLifecycle(this.name);
    
    // Auto-updater yapılandırması
    autoUpdater.autoDownload = false; // Otomatik indirme kapalı (kullanıcı onayı gerekli)
    autoUpdater.autoInstallOnAppQuit = true; // Uygulama kapanırken otomatik kurulum
    
    // Log seviyesi
    autoUpdater.logger = {
      info: (message: string) => safeLog(`[${this.name}] ${message}`),
      warn: (message: string) => safeWarn(`[${this.name}] ${message}`),
      error: (message: string) => safeError(`[${this.name}] ${message}`),
    };
  }

  async initialize(): Promise<void> {
    this.lifecycle.markInitializing();
    safeLog(`[${this.name}] Initializing update module...`);
    
    // Sadece packaged uygulamalarda çalışsın
    if (!app.isPackaged) {
      safeLog(`[${this.name}] Development mode - update check disabled`);
      this.lifecycle.markInitialized();
      return;
    }

    // Event handlers
    this.setupEventHandlers();
    
    this.lifecycle.markInitialized();
    safeLog(`[${this.name}] ✅ Update module initialized`);
  }

  async activate(): Promise<void> {
    this.lifecycle.markActivating();
    safeLog(`[${this.name}] Activating update module...`);

    // Sadece packaged uygulamalarda çalışsın
    if (!app.isPackaged) {
      this.lifecycle.markActive();
      return;
    }

    // İlk açılışta versiyon kontrolü (3 saniye gecikme ile - uygulama başlarken)
    setTimeout(async () => {
      await this.checkForUpdates(true);
    }, 3000);

    // Periyodik kontrol başlat
    this.startPeriodicCheck();

    this.lifecycle.markActive();
    safeLog(`[${this.name}] ✅ Update module activated`);
  }

  async deactivate(): Promise<void> {
    this.lifecycle.markDeactivating();
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.lifecycle.markDeactivated();
  }

  async destroy(): Promise<void> {
    await this.deactivate();
    this.lifecycle.markDestroyed();
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      ...this.lifecycle.getInfo(),
      lastCheckTime: this.lastCheckTime,
      isChecking: this.isChecking,
      updateAvailable: this.updateAvailable,
      currentVersion: app.getVersion(),
    };
  }

  validateDependencies(_registry: any): boolean {
    return true;
  }

  /**
   * Versiyon kontrolü yap (ilk açılışta veya manuel)
   */
  async checkForUpdates(isFirstLaunch: boolean = false): Promise<{ available: boolean; version?: string }> {
    if (!app.isPackaged) {
      safeLog(`[${this.name}] Development mode - skipping update check`);
      return { available: false };
    }

    if (this.isChecking) {
      safeWarn(`[${this.name}] Update check already in progress`);
      return { available: false };
    }

    this.isChecking = true;
    this.lastCheckTime = Date.now();

    try {
      safeLog(`[${this.name}] Checking for updates... (first launch: ${isFirstLaunch})`);
      
      const result = await autoUpdater.checkForUpdates();
      
      if (!result || !result.updateInfo) {
        if (isFirstLaunch) {
          safeLog(`[${this.name}] ✅ Application is up to date (v${app.getVersion()})`);
        }
        return { available: false };
      }

      const newVersion = result.updateInfo.version;
      const currentVersion = app.getVersion();

      if (this.compareVersions(newVersion, currentVersion) > 0) {
        safeLog(`[${this.name}] 🆕 New version available: ${newVersion} (current: ${currentVersion})`);
        this.updateAvailable = true;
        this.updateInfo = result.updateInfo;
        
        // İlk açılışta sessizce kontrol et, sonraki kontrollerde kullanıcıya göster
        if (!isFirstLaunch) {
          await this.handleUpdateAvailable(result.updateInfo);
        } else {
          // İlk açılışta bildirim göster (ama bloklamadan)
          this.showUpdateNotification(result.updateInfo);
        }
        
        return { available: true, version: newVersion };
      } else {
        if (isFirstLaunch) {
          safeLog(`[${this.name}] ✅ Application is up to date (v${currentVersion})`);
        }
        this.updateAvailable = false;
        return { available: false };
      }
    } catch (error) {
      safeError(`[${this.name}] ❌ Update check failed:`, error);
      
      // İlk açılışta sessizce başarısız ol, sonraki kontrollerde kullanıcıya göster
      if (!isFirstLaunch) {
        dialog.showErrorBox(
          'Update Check Failed',
          'Could not check for updates. Please check your internet connection.'
        );
      }
      
      return { available: false };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Versiyon karşılaştırması (semantic versioning)
   */
  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  /**
   * Güncelleme bulunduğunda kullanıcıya bildir
   */
  private async handleUpdateAvailable(updateInfo: any): Promise<void> {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (${updateInfo.version}) is available!`,
      detail: `Current version: ${app.getVersion()}\n\n${updateInfo.releaseNotes || 'Update available'}\n\nWould you like to download and install it now?`,
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response.response === 0) {
      await this.downloadAndInstall();
    }
  }

  /**
   * İlk açılışta sessiz bildirim (bloklamadan)
   */
  private showUpdateNotification(updateInfo: any): void {
    // Sistem bildirimi göster (opsiyonel)
    // Electron'un notification API'si kullanılabilir
    safeLog(`[${this.name}] Update available: ${updateInfo.version} - User will be notified on next check`);
  }

  /**
   * Güncellemeyi indir ve kur
   */
  private async downloadAndInstall(): Promise<void> {
    try {
      safeLog(`[${this.name}] Downloading update...`);
      
      // İndirme ilerlemesini göster
      let progressDialog: any = null;
      autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        safeLog(`[${this.name}] Download progress: ${percent}%`);
        
        // İlerleme dialog'u göster (opsiyonel)
        if (!progressDialog && percent > 0) {
          progressDialog = dialog.showMessageBox({
            type: 'info',
            title: 'Downloading Update',
            message: `Downloading update: ${percent}%`,
            buttons: ['Cancel'],
            defaultId: 0,
          });
        }
      });

      await autoUpdater.downloadUpdate();

      safeLog(`[${this.name}] ✅ Update downloaded`);
      
      // Kurulum için onay
      const response = await dialog.showMessageBox({
        type: 'question',
        title: 'Install Update',
        message: 'Update downloaded successfully!',
        detail: 'The application will restart to install the update. Continue?',
        buttons: ['Install Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (error) {
      safeError(`[${this.name}] ❌ Update download failed:`, error);
      dialog.showErrorBox('Update Failed', 'Failed to download update. Please try again later.');
    }
  }

  /**
   * Periyodik versiyon kontrolü başlat
   */
  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkForUpdates(false);
    }, this.CHECK_INTERVAL);

    safeLog(`[${this.name}] Periodic update check started (every 24 hours)`);
  }

  /**
   * Event handlers kurulumu
   */
  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      safeLog(`[${this.name}] Checking for update...`);
    });

    autoUpdater.on('update-available', (info) => {
      safeLog(`[${this.name}] Update available:`, info.version);
      this.updateAvailable = true;
      this.updateInfo = info;
    });

    autoUpdater.on('update-not-available', (info) => {
      safeLog(`[${this.name}] Update not available. Current version:`, info.version);
      this.updateAvailable = false;
    });

    autoUpdater.on('error', (error) => {
      safeError(`[${this.name}] Update error:`, error);
      this.updateAvailable = false;
    });

    autoUpdater.on('download-progress', (progress) => {
      safeLog(`[${this.name}] Download progress:`, Math.round(progress.percent) + '%');
    });

    autoUpdater.on('update-downloaded', (info) => {
      safeLog(`[${this.name}] Update downloaded:`, info.version);
    });
  }

  /**
   * Manuel güncelleme kontrolü (IPC'den çağrılabilir)
   */
  async checkForUpdatesManually(): Promise<{ available: boolean; version?: string; currentVersion: string }> {
    const result = await this.checkForUpdates(false);
    return {
      ...result,
      currentVersion: app.getVersion(),
    };
  }

  /**
   * Güncelleme durumunu al
   */
  getUpdateStatus(): { available: boolean; version?: string; currentVersion: string } {
    return {
      available: this.updateAvailable,
      version: this.updateInfo?.version,
      currentVersion: app.getVersion(),
    };
  }
}


/**
 * Setup Service - İlk kurulum ve dosya yönetimi
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';

export interface SetupConfig {
  appName: string;
  appDataDir: string;
  configFile: string;
  frontendDir: string;
  logsDir: string;
  isFirstRun: boolean;
}

/**
 * Setup Service - İlk kurulum ve dosya yönetimi
 */
export class SetupService {
  private setupConfig: SetupConfig | null = null;
  private readonly SETUP_FLAG_FILE = '.setup-complete';

  private electronAppDataPath: string | null = null;

  /**
   * Set Electron app data path (called from Electron main process)
   */
  public setElectronAppDataPath(path: string): void {
    this.electronAppDataPath = path;
  }

  /**
   * Executable'ın bulunduğu dizini al
   */
  private getExecutableDir(): string {
    // Check if Electron app data path is set (from Electron main process)
    if (this.electronAppDataPath) {
      return this.electronAppDataPath;
    }
    
    // Check if running in Electron (fallback detection)
    if (typeof process !== 'undefined' && process.versions && (process.versions as any).electron) {
      // Running in Electron - use app.getPath('userData') if available
      // This will be set by Electron main process via setElectronAppDataPath
      // Fallback: use executable directory
      try {
        return dirname(process.execPath);
      } catch (error) {
        return process.cwd();
      }
    }
    
    if (typeof process !== 'undefined' && (process as any).pkg) {
      // Running as pkg executable - use executable directory
      // process.execPath contains the path to the executable
      try {
        // pkg executable: process.execPath is the executable file path
        return dirname(process.execPath);
      } catch (error) {
        // Fallback: use process.cwd()
        return process.cwd();
      }
    } else {
      // Normal execution - use current working directory
      return process.cwd();
    }
  }

  /**
   * Kurulum dizinini belirle ve gerekli dosyaları hazırla
   */
  public async setup(): Promise<SetupConfig> {
    if (this.setupConfig) {
      return this.setupConfig;
    }

    // Executable'ın bulunduğu dizini al (kurulum dizini olarak kullan)
    const executableDir = this.getExecutableDir();
    const setupDir = executableDir; // Executable'ın olduğu klasörü direkt kullan
    
    // Kurulum dizinini oluştur (gerekirse)
    this.ensureDirectoryExists(setupDir);
    
    // İlk çalıştırma kontrolü (config.yaml dosyasının varlığına göre)
    const configFile = join(setupDir, 'config.yaml');
    const isFirstRun = !existsSync(configFile);
    
    if (isFirstRun) {
      console.log('İlk kurulum yapılıyor...');
      console.log(`Kurulum dizini: ${setupDir}`);
      await this.performFirstRunSetup(setupDir);
      
      // Kurulum tamamlandı işaretini oluştur
      const setupFlagFile = join(setupDir, this.SETUP_FLAG_FILE);
      writeFileSync(setupFlagFile, new Date().toISOString(), 'utf-8');
      console.log(`Kurulum tamamlandı! Config dosyası: ${configFile}`);
    }
    
    // Config dosyasını hazırla
    const finalConfigFile = await this.ensureConfigFile(setupDir);
    
    // Frontend dizinini hazırla (executable içinden çıkarılacak)
    const frontendDir = await this.ensureFrontendDir(setupDir);
    
    // Logs dizinini oluştur
    const logsDir = join(setupDir, 'logs');
    this.ensureDirectoryExists(logsDir);
    
    this.setupConfig = {
      appName: 'OBS Multi-Platform Streaming',
      appDataDir: setupDir,
      configFile: finalConfigFile,
      frontendDir,
      logsDir,
      isFirstRun,
    };
    
    return this.setupConfig;
  }

  /**
   * İlk kurulum dosyalarını çıkar
   */
  private async performFirstRunSetup(setupDir: string): Promise<void> {
    // Varsayılan config dosyası oluştur
    await this.createDefaultConfig(setupDir);
    
    // Frontend dosyalarını çıkar (eğer executable içindeyse)
    // pkg executable: assets otomatik olarak extract edilir
    await this.extractFrontendFiles(setupDir);
  }

  /**
   * Frontend dosyalarını extract et (pkg executable için)
   */
  private async extractFrontendFiles(setupDir: string): Promise<void> {
    // Check if running as pkg executable
    const isPkg = typeof process !== 'undefined' && (process as any).pkg;
    
    if (!isPkg) {
      // Not pkg executable, skip extraction
      return;
    }

    const frontendDir = join(setupDir, 'frontend');
    
    // Check if frontend already extracted
    const indexFile = join(frontendDir, 'index.html');
    if (existsSync(indexFile)) {
      console.log('✅ Frontend files already extracted');
      return; // Already extracted
    }

    try {
      // pkg assets are in the snapshot, we need to extract them
      // Try to read from pkg snapshot paths
      const pkgEntrypoint = (process as any).pkg?.entrypoint;
      const snapshotPaths = [
        join(dirname(pkgEntrypoint || process.execPath), 'frontend'),
        join(process.cwd(), 'frontend'),
        join(dirname(process.execPath), 'frontend'),
      ];

      let sourcePath: string | null = null;
      for (const path of snapshotPaths) {
        if (existsSync(join(path, 'index.html'))) {
          sourcePath = path;
          break;
        }
      }

      if (!sourcePath) {
        // Try to read from pkg snapshot using require
        try {
          // In pkg, we can try to require the frontend files
          // But we need to copy them manually
          console.log('⚠️  Frontend files not found in snapshot paths, will be served from executable');
          return;
        } catch (error) {
          console.warn('Could not locate frontend files in pkg snapshot:', error);
          return;
        }
      }

      // Copy frontend files from snapshot to setup directory
      console.log(`📁 Extracting frontend files from: ${sourcePath}`);
      this.copyDirectoryRecursive(sourcePath, frontendDir);
      console.log('✅ Frontend files extracted successfully');
      
    } catch (error) {
      console.warn('Could not extract frontend files:', error);
      // Continue without frontend extraction - files may be accessible via pkg snapshot
    }
  }

  /**
   * Recursively copy directory
   */
  private copyDirectoryRecursive(src: string, dest: string): void {
    this.ensureDirectoryExists(dest);
    
    const entries = readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Varsayılan config dosyası oluştur
   */
  private async createDefaultConfig(setupDir: string): Promise<void> {
    const configFile = join(setupDir, 'config.yaml');
    
    if (existsSync(configFile)) {
      return; // Config dosyası zaten var
    }
    
    const defaultConfig = `version: 1.0.0
streamManager:
  obs:
    host: localhost
    port: 4455
    password: null
  rtmpServer:
    host: 0.0.0.0
    port: 1935
    appName: live
    streamKey: obs
    enabled: true
  autoReconnect: true
  reconnectDelay: 5
  maxReconnectAttempts: 10
  platforms: []
ui:
  host: 0.0.0.0
  port: 8000
  debug: false
`;
    
    writeFileSync(configFile, defaultConfig, 'utf-8');
    console.log(`Config dosyası oluşturuldu: ${configFile}`);
  }

  /**
   * Config dosyasının varlığını garanti et
   */
  private async ensureConfigFile(setupDir: string): Promise<string> {
    const configFile = join(setupDir, 'config.yaml');
    
    if (!existsSync(configFile)) {
      await this.createDefaultConfig(setupDir);
    }
    
    return configFile;
  }

  /**
   * Frontend dizinini hazırla
   * Not: pkg assets olarak frontend dosyaları executable içinde
   * pkg için: assets otomatik olarak extract edilir
   */
  private async ensureFrontendDir(setupDir: string): Promise<string> {
    // pkg executable or normal execution
    // Frontend dosyaları executable içinde (pkg assets) veya dist'te
    // Setup dizininde frontend klasörü oluşturmaya gerek yok
    // Ama eğer kullanıcı özelleştirme yapmak isterse burada olabilir
    const frontendDir = join(setupDir, 'frontend');
    this.ensureDirectoryExists(frontendDir);
    return frontendDir;
  }

  /**
   * Dizinin varlığını garanti et
   */
  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Setup config'i al
   */
  public getSetupConfig(): SetupConfig | null {
    return this.setupConfig;
  }

  /**
   * Kurulum dizinini al
   */
  public getAppDataDir(): string | null {
    return this.setupConfig?.appDataDir || null;
  }

  /**
   * Config dosya yolunu al
   */
  public getConfigFile(): string | null {
    return this.setupConfig?.configFile || null;
  }

  /**
   * Frontend dizinini al
   */
  public getFrontendDir(): string | null {
    return this.setupConfig?.frontendDir || null;
  }

  /**
   * Logs dizinini al
   */
  public getLogsDir(): string | null {
    return this.setupConfig?.logsDir || null;
  }

  /**
   * İlk çalıştırma mı kontrol et
   */
  public isFirstRun(): boolean {
    return this.setupConfig?.isFirstRun || false;
  }
}


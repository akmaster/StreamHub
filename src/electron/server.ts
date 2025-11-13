/**
 * Backend Server Module for Electron
 * Starts the Express server in Electron main process
 */

import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';
import { RTMPServer } from '../stream/RTMPServer.js';
import { StreamManager } from '../stream/StreamManager.js';
import { YouTubeAdapter } from '../platforms/YouTubeAdapter.js';
import { TwitchAdapter } from '../platforms/TwitchAdapter.js';
import { FacebookAdapter } from '../platforms/FacebookAdapter.js';
import { KickAdapter } from '../platforms/KickAdapter.js';
import { createApp } from '../ui/App.js';
import { loadConfig, Config, setConfigPath } from '../config/Config.js';
import { PlatformConfig } from '../core/interfaces/IPlatformAdapter.js';
import { createServer, Server } from 'http';
import { WebSocketService } from '../services/WebSocketService.js';
import { checkPorts, PortCheckResult } from '../utils/PortChecker.js';
import { safeLog, safeError, safeWarn } from '../utils/ElectronLogger.js';

export interface ServerInfo {
  server: Server;
  registry: ModuleRegistry;
  port: number;
  url: string;
}

async function setupRegistry(config: Config, httpServer: Server, registry: ModuleRegistry): Promise<void> {
  // RTMP server'ı kaydet
  if (config.streamManager.rtmpServer.enabled) {
    registry.register(
      'rtmp_server',
      () => new RTMPServer(config.streamManager.rtmpServer),
      [],
      ['IStreamProvider'],
      true
    );
  }

  // Platform adaptörlerini kaydet
  registry.register(
    'youtube_adapter',
    () => new YouTubeAdapter(),
    [],
    ['IPlatformAdapter'],
    true
  );

  registry.register(
    'twitch_adapter',
    () => new TwitchAdapter(),
    [],
    ['IPlatformAdapter'],
    true
  );

  registry.register(
    'facebook_adapter',
    () => new FacebookAdapter(),
    [],
    ['IPlatformAdapter'],
    true
  );

  registry.register(
    'kick_adapter',
    () => new KickAdapter(),
    [],
    ['IPlatformAdapter'],
    true
  );

  // WebSocket service'ı kaydet (HTTP server'ı doğrudan parametre olarak geçir)
  registry.register(
    'websocket_service',
    () => new WebSocketService(registry, httpServer),
    [],
    ['IWebSocketService'],
    true
  );

  // Stream manager'ı kaydet
  registry.register(
    'stream_manager',
    () => new StreamManager(registry),
    ['rtmp_server'],
    ['StreamManager'],
    true
  );

  // Tüm modülleri başlat
  await registry.initializeAll();

  // Tüm modülleri etkinleştir
  await registry.activateAll();

  // Stream manager'ı yapılandır
  const streamManager = registry.resolve<StreamManager>('stream_manager');

  // Sadece geçerli platform'ları yükle
  const platformConfigs: PlatformConfig[] = [];
  for (const p of config.streamManager.platforms) {
    if (p.rtmpUrl && p.streamKey && p.streamKey.trim()) {
      try {
        platformConfigs.push({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          rtmpUrl: p.rtmpUrl,
          streamKey: p.streamKey,
          enabled: p.enabled ?? true,
          metadata: p.metadata || {},
        });
      } catch (error) {
        safeWarn(`Skipping invalid platform '${p.name}':`, error);
      }
    }
  }

  const streamConfig = {
    obsHost: config.streamManager.obs.host,
    obsPort: config.streamManager.obs.port,
    obsPassword: config.streamManager.obs.password,
    autoReconnect: config.streamManager.autoReconnect,
    reconnectDelay: config.streamManager.reconnectDelay,
    maxReconnectAttempts: config.streamManager.maxReconnectAttempts,
    platforms: platformConfigs,
    rtmpServer: {
      host: config.streamManager.rtmpServer.host,
      port: config.streamManager.rtmpServer.port,
      appName: config.streamManager.rtmpServer.appName,
      streamKey: config.streamManager.rtmpServer.streamKey,
    },
  };

  try {
    await streamManager.configure(streamConfig);
  } catch (error) {
    safeWarn('Failed to configure stream manager:', error);
    safeLog('You can configure platforms through the web interface.');
  }
}

/**
 * Start the backend server
 * @returns Promise<ServerInfo>
 */
export async function startServer(): Promise<ServerInfo> {
  safeLog('[Electron] Starting backend server...');

  // Setup service ile kurulum yap
  const { SetupService } = await import('../services/SetupService.js');
  const electron = await import('electron');
  const setupService = new SetupService();
  
  // Set Electron app data path for SetupService
  if (electron.app && electron.app.getPath) {
    const userDataPath = electron.app.getPath('userData');
    setupService.setElectronAppDataPath(userDataPath);
    safeLog(`[Electron] Using app data path: ${userDataPath}`);
  }
  
  // Kurulum dizinini belirle ve gerekli dosyaları hazırla
  const setupConfig = await setupService.setup();
  
  // Global config path'i ayarla (API'de kullanılacak)
  setConfigPath(setupConfig.configFile);
  
  // Config dosyasını setup dizininden yükle
  const config = loadConfig(setupConfig.configFile);
  
  // Kurulum bilgilerini logla
  safeLog(`[Electron] Kurulum dizini: ${setupConfig.appDataDir}`);
  safeLog(`[Electron] Config dosyası: ${setupConfig.configFile}`);
  if (setupConfig.isFirstRun) {
    safeLog('[Electron] İlk kurulum tamamlandı. Config dosyasını düzenleyebilirsiniz.');
    safeLog(`[Electron] Config dosyası konumu: ${setupConfig.configFile}`);
  }

  // Check if required ports are available
  const uiConfig = config.ui;
  const rtmpConfig = config.streamManager.rtmpServer;
  const requiredPorts = [
    uiConfig.port,      // Web UI port
    rtmpConfig.port,    // RTMP server port
    8001,               // Node Media Server HTTP/WebSocket port
  ];

  safeLog('[Electron] Checking port availability...');
  const portResults = await checkPorts(requiredPorts, uiConfig.host, 3000);
  
  const unavailablePorts: PortCheckResult[] = portResults.filter(
    (result) => !result.available
  );

  if (unavailablePorts.length > 0) {
    const errorMessage = `Ports already in use: ${unavailablePorts.map(r => r.port).join(', ')}`;
    safeError(`[Electron] ❌ Error: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  safeLog('[Electron] ✅ All required ports are available');

  // Create empty registry first (for Express app)
  const registry = new ModuleRegistry();
  
  // Express uygulamasını oluştur
  const app = createApp(registry);

  // HTTP server oluştur
  const server = createServer(app);

  // Setup registry with HTTP server
  try {
    await setupRegistry(config, server, registry);
  } catch (error) {
    safeError('[Electron] Error setting up registry:', error);
    await registry.deactivateAll();
    await registry.destroyAll();
    server.close();
    throw error;
  }

  // Web UI'yi başlat
  return new Promise<ServerInfo>((resolve, reject) => {
    server.listen(uiConfig.port, uiConfig.host, () => {
      const url = `http://localhost:${uiConfig.port}`;
      safeLog(`[Electron] ✅ Server started successfully!`);
      safeLog(`[Electron] 📡 RTMP server: rtmp://${rtmpConfig.host}:${rtmpConfig.port}/${rtmpConfig.appName}/${rtmpConfig.streamKey}`);
      safeLog(`[Electron] 🌐 Web UI: ${url}`);
      safeLog(`[Electron] 📊 Node Media Server: http://localhost:8001`);
      
      resolve({
        server,
        registry,
        port: uiConfig.port,
        url,
      });
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      safeError('[Electron] ❌ Server error:', error);
      reject(error);
    });
  });
}

/**
 * Stop the backend server
 * @param serverInfo Server info to stop
 */
export async function stopServer(serverInfo: ServerInfo): Promise<void> {
  safeLog('[Electron] Stopping backend server...');
  
  try {
    // Deactivate all modules
    safeLog('[Electron] Deactivating modules...');
    await serverInfo.registry.deactivateAll();
    
    // Destroy all modules
    safeLog('[Electron] Destroying modules...');
    await serverInfo.registry.destroyAll();
    
    // Close HTTP server
    safeLog('[Electron] Closing HTTP server...');
    await new Promise<void>((resolve, reject) => {
      serverInfo.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    safeLog('[Electron] ✅ Server stopped gracefully');
  } catch (error) {
    safeError('[Electron] ❌ Error during server shutdown:', error);
    throw error;
  }
}


/**
 * Ana uygulama - OBS Multi-Platform Streaming System.
 */

import { ModuleRegistry } from './core/registry/ModuleRegistry.js';
import { RTMPServer } from './stream/RTMPServer.js';
import { StreamManager } from './stream/StreamManager.js';
import { YouTubeAdapter } from './platforms/YouTubeAdapter.js';
import { TwitchAdapter } from './platforms/TwitchAdapter.js';
import { FacebookAdapter } from './platforms/FacebookAdapter.js';
import { KickAdapter } from './platforms/KickAdapter.js';
import { createApp } from './ui/App.js';
import { loadConfig, Config, setConfigPath } from './config/Config.js';
import { PlatformConfig } from './core/interfaces/IPlatformAdapter.js';
import { createServer, Server } from 'http';
import { WebSocketService } from './services/WebSocketService.js';
import { checkPorts, PortCheckResult } from './utils/PortChecker.js';
import { checkFFmpeg, getFFmpegInstallInstructions } from './utils/FFmpegChecker.js';
import { exec } from 'child_process';

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
        console.warn(`Skipping invalid platform '${p.name}':`, error);
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
    console.warn('Failed to configure stream manager:', error);
    console.log('You can configure platforms through the web interface.');
  }
}

async function main(): Promise<void> {
  console.log('Starting OBS Multi-Platform Streaming System...');

  // Set executable flag if running as pkg executable
  if (typeof process !== 'undefined' && (process as any).pkg) {
    // pkg executable detected
    process.env.PKG_EXECUTABLE = 'true';
    process.env.EXECUTABLE_MODE = 'true';
  }

  // Setup service ile kurulum yap
  const { SetupService } = await import('./services/SetupService.js');
  const setupService = new SetupService();
  
  // Kurulum dizinini belirle ve gerekli dosyaları hazırla
  const setupConfig = await setupService.setup();
  
  // Global config path'i ayarla (API'de kullanılacak)
  setConfigPath(setupConfig.configFile);
  
  // Config dosyasını setup dizininden yükle
  const config = loadConfig(setupConfig.configFile);
  
  // Kurulum bilgilerini logla
  console.log(`Kurulum dizini: ${setupConfig.appDataDir}`);
  console.log(`Config dosyası: ${setupConfig.configFile}`);
  if (setupConfig.isFirstRun) {
    console.log('İlk kurulum tamamlandı. Config dosyasını düzenleyebilirsiniz.');
    console.log(`Config dosyası konumu: ${setupConfig.configFile}`);
  }

  // Check if required ports are available
  const uiConfig = config.ui;
  const rtmpConfig = config.streamManager.rtmpServer;
  const requiredPorts = [
    uiConfig.port,      // Web UI port
    rtmpConfig.port,    // RTMP server port
    8001,               // Node Media Server HTTP/WebSocket port
  ];

  console.log('Checking port availability...');
  const portResults = await checkPorts(requiredPorts, uiConfig.host, 3000);
  
  const unavailablePorts: PortCheckResult[] = portResults.filter(
    (result) => !result.available
  );

  if (unavailablePorts.length > 0) {
    console.error('\n❌ Error: The following ports are already in use:');
    for (const result of unavailablePorts) {
      console.error(`   - Port ${result.port}: ${result.error}`);
    }
    console.error('\n💡 Solutions:');
    console.error('   1. Stop other applications using these ports');
    console.error('   2. Change the port configuration in config.yaml');
    console.error('   3. Kill processes using these ports:');
    console.error('      Windows: netstat -ano | findstr :<PORT>');
    console.error('      Then: taskkill /PID <PID> /F');
    console.error('\n⚠️  Application will not start until ports are available.\n');
    process.exit(1);
  }

          console.log('✅ All required ports are available');

          // Check FFmpeg availability
          console.log('\nChecking FFmpeg installation...');
          const ffmpegCheck = checkFFmpeg();
          if (!ffmpegCheck.available) {
            console.error('\n❌ Error: FFmpeg is not available');
            console.error(`   ${ffmpegCheck.error}`);
            console.error('\n💡 FFmpeg Installation Instructions:');
            console.error(getFFmpegInstallInstructions());
            console.error('\n⚠️  Application will start, but streaming to platforms will not work without FFmpeg.\n');
          } else {
            console.log(`✅ FFmpeg is available (version: ${ffmpegCheck.version})`);
            if (ffmpegCheck.path) {
              console.log(`   Path: ${ffmpegCheck.path}`);
            }
          }

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
    console.error('Error setting up registry:', error);
    await registry.deactivateAll();
    await registry.destroyAll();
    server.close();
    process.exit(1);
  }

  // Web UI'yi başlat
  server.listen(uiConfig.port, uiConfig.host, () => {
    console.log('\n✅ Server started successfully!');
    console.log(`📡 RTMP server: rtmp://${rtmpConfig.host}:${rtmpConfig.port}/${rtmpConfig.appName}/${rtmpConfig.streamKey}`);
    console.log(`🌐 Web UI: http://localhost:${uiConfig.port}`);
    console.log(`📊 Node Media Server: http://localhost:8001`);
    console.log('\n💡 Tip: Press Ctrl+C to stop the server gracefully\n');

    // Open browser automatically (only in executable mode or first run)
    const isFirstRun = setupConfig.isFirstRun;
    const isExecutable = typeof process !== 'undefined' && ((process as any).pkg || process.env.EXECUTABLE_MODE === 'true');
    
    if (isFirstRun || isExecutable) {
      // Show setup screen on first run, otherwise show main app
      const url = isFirstRun ? `http://localhost:${uiConfig.port}/setup` : `http://localhost:${uiConfig.port}`;
      
      // Open browser after a short delay
      setTimeout(() => {
        try {
          const platform = process.platform;
          
          let command: string;
          if (platform === 'win32') {
            command = `start "" "${url}"`;
          } else if (platform === 'darwin') {
            command = `open "${url}"`;
          } else {
            command = `xdg-open "${url}"`;
          }
          
          exec(command, (error: any) => {
            if (error) {
              console.log(`\n⚠️  Could not open browser automatically. Please open: ${url}`);
            } else {
              console.log(`\n🌐 Opening browser: ${url}`);
            }
          });
        } catch (error) {
          console.log(`\n⚠️  Could not open browser automatically. Please open: http://localhost:${uiConfig.port}`);
        }
      }, 1000);
    }
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Error: Port ${uiConfig.port} is already in use`);
      console.error('💡 Solution: Stop the application using this port or change the port in config.yaml');
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  // Graceful shutdown handler
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\n${signal} received, shutting down gracefully...`);
    
    try {
      // Deactivate all modules
      console.log('Deactivating modules...');
      await registry.deactivateAll();
      
      // Destroy all modules
      console.log('Destroying modules...');
      await registry.destroyAll();
      
      // Close HTTP server
      console.log('Closing HTTP server...');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      console.log('✅ Server closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Uygulamayı başlat
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


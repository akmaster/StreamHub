/**
 * API routes - RESTful API endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';
import { StreamManager } from '../stream/StreamManager.js';
import { IPlatformAdapter, PlatformConfig } from '../core/interfaces/IPlatformAdapter.js';
import { loadConfig, saveConfig, ConfigSchema } from '../config/Config.js';

// Async error handler wrapper (optimization - reduces code duplication)
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function apiRouter(registry: ModuleRegistry): Router {
  const router = Router();

  const getStreamManager = (): StreamManager => {
    return registry.resolve<StreamManager>('stream_manager');
  };

  const getPlatformAdapter = (platformName: string): IPlatformAdapter | null => {
    const streamManager = getStreamManager();
    return streamManager.getPlatformAdapter(platformName);
  };

  // API response cache (optimization)
  let platformsCache: { data: any; timestamp: number } | null = null;
  const CACHE_TTL = 1000; // 1 second cache TTL

  // Health check endpoint (for setup screen)
  router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  }));

  // Stream endpoints

  router.get('/stream/status', asyncHandler(async (_req: Request, res: Response) => {
    const streamManager = getStreamManager();
    const status = await streamManager.getStatus();
    
    // Get actual stream path from RTMP server if available
    let actualStreamPath = null;
    try {
      const rtmpServer = registry.resolve<any>('rtmp_server');
      if (rtmpServer) {
        // Try to get from getStatus first (includes actualStreamPath)
        const rtmpStatus = await rtmpServer.getStatus();
        if (rtmpStatus.actualStreamPath) {
          actualStreamPath = rtmpStatus.actualStreamPath;
        } else if (rtmpServer.getStreamPath) {
          // Fallback to getStreamPath method
          actualStreamPath = rtmpServer.getStreamPath();
        }
      }
    } catch (error) {
      // Ignore if RTMP server not available
    }
    
    res.json({
      status: status.streaming ? 'streaming' : 'idle',
      streamInfo: status.streamInfo,
      platforms: status.platforms,
      actualStreamPath: actualStreamPath, // Include actual stream path for auto-detection
    });
  }));

  router.post('/stream/connect', asyncHandler(async (_req: Request, res: Response) => {
    const streamManager = getStreamManager();
    const success = await streamManager.connect();
    res.json({ success, message: 'Successfully connected to RTMP server' });
  }));

  router.post('/stream/disconnect', asyncHandler(async (_req: Request, res: Response) => {
    const streamManager = getStreamManager();
    await streamManager.disconnect();
    res.json({ success: true, message: 'Disconnected from RTMP server' });
  }));

  router.post('/stream/start', asyncHandler(async (_req: Request, res: Response) => {
    const streamManager = getStreamManager();
    const success = await streamManager.startStream();
    res.json({
      success,
      message: success ? 'Stream started successfully' : 'Stream failed to start',
    });
  }));

  router.post('/stream/stop', asyncHandler(async (_req: Request, res: Response) => {
    const streamManager = getStreamManager();
    await streamManager.stopStream();
    res.json({ success: true, message: 'Stream stopped successfully' });
  }));

  // Platform endpoints

  router.get('/platforms', asyncHandler(async (_req: Request, res: Response) => {
    // Check cache (optimization)
    if (platformsCache && Date.now() - platformsCache.timestamp < CACHE_TTL) {
      res.json(platformsCache.data);
      return;
    }

    const config = loadConfig();
    const streamManager = getStreamManager();
    const streamManagerStatus = await streamManager.getStatus();

    const platformData = config.streamManager.platforms.map((platformConfig) => {
      const platformId = platformConfig.id || platformConfig.name;
      
      // Get platform status by ID (not by adapter name)
      const platformStatus = streamManagerStatus.platforms[platformId];
      
      // Determine status: streaming > connected > disconnected
      let status = 'disconnected';
      if (platformStatus) {
        if (platformStatus.streaming) {
          status = 'streaming';
        } else if (platformStatus.connected) {
          status = 'connected';
        }
      }
      
      return {
        id: platformId,
        name: platformConfig.name,
        displayName: platformConfig.displayName,
        rtmpUrl: platformConfig.rtmpUrl,
        streamKey: platformConfig.streamKey ? '***' : '',
        enabled: platformConfig.enabled,
        status: status,
      };
    });

    // Update cache
    platformsCache = { data: platformData, timestamp: Date.now() };

    res.json(platformData);
  }));

  router.get('/platforms/:platformName', asyncHandler(async (req: Request, res: Response) => {
    // Validate platformName parameter (security optimization - request validation)
    const platformNameSchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/);
    const platformNameResult = platformNameSchema.safeParse(req.params.platformName);
    if (!platformNameResult.success) {
      res.status(400).json({ error: 'Invalid platform name', details: platformNameResult.error.errors });
      return;
    }
    
    const platformName = platformNameResult.data;
    const adapter = getPlatformAdapter(platformName);

    if (!adapter) {
      res.status(404).json({ error: `Platform ${platformName} not found` });
      return;
    }

    const status = await adapter.getPlatformStatus();
    const statistics = await adapter.getStatistics();

    res.json({
      name: platformName,
      status,
      statistics,
    });
  }));

  router.post('/platforms/:platformId/connect', asyncHandler(async (req: Request, res: Response) => {
    // Validate platformId parameter (security optimization - request validation)
    const platformIdSchema = z.string().min(1).max(100);
    const platformIdResult = platformIdSchema.safeParse(req.params.platformId);
    if (!platformIdResult.success) {
      res.status(400).json({ error: 'Invalid platform ID', details: platformIdResult.error.errors });
      return;
    }
    
    const platformId = platformIdResult.data;
    const streamManager = getStreamManager();
    
    // Find platform config using StreamManager's Map (O(1) lookup optimization)
    const platformConfig = streamManager.getPlatformConfig(platformId);
    
    if (!platformConfig) {
      res.status(404).json({ error: `Platform with ID ${platformId} not found` });
      return;
    }
    
    // Start stream for this specific platform (use ID, fallback to name)
    const platformIdentifier = platformConfig.id || platformConfig.name;
    const success = await streamManager.startPlatformStream(platformIdentifier);
    
    // Invalidate cache when platform status changes (optimization)
    platformsCache = null;
    
    res.json({ success, message: `Stream started for platform ${platformConfig.displayName || platformConfig.name}` });
  }));

  router.post('/platforms/:platformId/disconnect', asyncHandler(async (req: Request, res: Response) => {
    // Validate platformId parameter (security optimization - request validation)
    const platformIdSchema = z.string().min(1).max(100);
    const platformIdResult = platformIdSchema.safeParse(req.params.platformId);
    if (!platformIdResult.success) {
      res.status(400).json({ error: 'Invalid platform ID', details: platformIdResult.error.errors });
      return;
    }
    
    const platformId = platformIdResult.data;
    const streamManager = getStreamManager();
    
    // Find platform config using StreamManager's Map (O(1) lookup optimization)
    const platformConfig = streamManager.getPlatformConfig(platformId);
    
    if (!platformConfig) {
      res.status(404).json({ error: `Platform with ID ${platformId} not found` });
      return;
    }
    
    // Stop stream for this specific platform (use ID, fallback to name)
    const platformIdentifier = platformConfig.id || platformConfig.name;
    await streamManager.stopPlatformStream(platformIdentifier);
    
    // Invalidate cache when platform status changes (optimization)
    platformsCache = null;
    
    res.json({ success: true, message: `Stream stopped for platform ${platformConfig.displayName || platformConfig.name}` });
  }));

  // Config endpoints

  router.get('/config', asyncHandler(async (req: Request, res: Response) => {
    // Validate query parameters (security optimization - request validation)
    const querySchema = z.object({
      includeKeys: z.string().optional().transform(val => val === 'true'),
    });
    
    const queryResult = querySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: queryResult.error.errors });
      return;
    }
    
    const config = loadConfig();
    const includeKeys = queryResult.data.includeKeys || false;
    
    // If includeKeys is true, return full config with keys (for internal use)
    // Otherwise, mask stream keys for security
    if (includeKeys) {
      res.json(config);
    } else {
      const safeConfig = {
        ...config,
        streamManager: {
          ...config.streamManager,
          rtmpServer: {
            ...config.streamManager.rtmpServer,
            streamKey: config.streamManager.rtmpServer.streamKey ? '***' : '',
          },
          platforms: config.streamManager.platforms.map((p) => ({
            ...p,
            streamKey: p.streamKey ? '***' : '',
          })),
        },
      };
      res.json(safeConfig);
    }
  }));

  router.post('/config', asyncHandler(async (req: Request, res: Response) => {
    // Validate request body using Zod schema (security optimization - request validation)
    try {
      const configData = ConfigSchema.parse(req.body);
      
      // Get current config to compare RTMP server settings
      const currentConfig = loadConfig();
      const rtmpConfigChanged = 
        currentConfig.streamManager.rtmpServer.host !== configData.streamManager.rtmpServer.host ||
        currentConfig.streamManager.rtmpServer.port !== configData.streamManager.rtmpServer.port ||
        currentConfig.streamManager.rtmpServer.appName !== configData.streamManager.rtmpServer.appName ||
        currentConfig.streamManager.rtmpServer.streamKey !== configData.streamManager.rtmpServer.streamKey;
      
      // Validate and save config (configData is now validated)
      await saveConfig(configData);
      
      // Invalidate cache when config changes (optimization)
      platformsCache = null;
      
      // If RTMP server config changed, restart RTMP server
      if (rtmpConfigChanged) {
        try {
          const rtmpServer = registry.resolve<any>('rtmp_server');
          if (rtmpServer) {
            // Update config first
            if (rtmpServer.updateConfig) {
              rtmpServer.updateConfig({
                host: configData.streamManager.rtmpServer.host,
                port: configData.streamManager.rtmpServer.port,
                appName: configData.streamManager.rtmpServer.appName,
                streamKey: configData.streamManager.rtmpServer.streamKey,
                enabled: configData.streamManager.rtmpServer.enabled ?? true,
              });
            }
            // Deactivate and reactivate RTMP server to apply new config
            await rtmpServer.deactivate();
            await rtmpServer.activate();
            console.log('[API] RTMP server restarted with new configuration');
          }
        } catch (error) {
          console.error('[API] Failed to restart RTMP server:', error);
          // Continue anyway - config is saved, server will use new config on next restart
        }
      }
      
      // Reconfigure stream manager
      const streamManager = getStreamManager();
      
      // Filter and validate platforms (only include valid platforms with required fields)
      const validPlatforms: PlatformConfig[] = configData.streamManager.platforms
        .filter((p: any) => p.name && p.rtmpUrl && p.streamKey && p.streamKey.trim())
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          rtmpUrl: p.rtmpUrl,
          streamKey: p.streamKey,
          enabled: p.enabled ?? true,
          metadata: p.metadata || {},
        }));
      
      await streamManager.configure({
        obsHost: configData.streamManager.obs.host,
        obsPort: configData.streamManager.obs.port,
        obsPassword: configData.streamManager.obs.password,
        autoReconnect: configData.streamManager.autoReconnect,
        reconnectDelay: configData.streamManager.reconnectDelay,
        maxReconnectAttempts: configData.streamManager.maxReconnectAttempts,
        platforms: validPlatforms,
      });
      
      res.json({ 
        success: true, 
        message: rtmpConfigChanged 
          ? 'Configuration saved successfully. RTMP server restarted with new settings.' 
          : 'Configuration saved successfully' 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Invalid configuration data', 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
        return;
      }
      throw error;
    }
  }));

  // Error handler middleware (catches errors from asyncHandler)
  router.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    // Don't send response if headers already sent
    if (res.headersSent) {
      return _next(error);
    }
    
    const errorMsg = error.message || String(error);
    const lines = errorMsg.split('\n');
    res.status(error.status || 500).json({
      error: lines[0],
      details: lines.length > 1 ? lines.slice(1).join('\n') : undefined,
    });
  });

  return router;
}



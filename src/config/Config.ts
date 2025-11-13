/**
 * Yapılandırma yönetimi - Yapılandırma dosyaları ve ayarlar.
 */

import { readFileSync, mkdirSync, statSync, watchFile, unwatchFile, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import { z } from 'zod';

const OBSConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(4455),
  password: z.string().nullable().optional(),
});

const RTMPServerConfigSchema = z.object({
  host: z.string().default('localhost'), // Use localhost by default (not 0.0.0.0) for OBS compatibility
  port: z.number().default(1935),
  appName: z.string().default('live'),
  streamKey: z.string().default('obs'),
  enabled: z.boolean().default(true),
});

const PlatformConfigSchema = z.object({
  id: z.string().optional(), // Unique identifier for platform (auto-generated if not provided)
  name: z.string(),
  displayName: z.string().optional(),
  rtmpUrl: z.string(),
  streamKey: z.string(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

const StreamManagerConfigSchema = z.object({
  obs: OBSConfigSchema,
  rtmpServer: RTMPServerConfigSchema,
  autoReconnect: z.boolean().default(true),
  reconnectDelay: z.number().default(5),
  maxReconnectAttempts: z.number().default(10),
  platforms: z.array(PlatformConfigSchema).default([]),
});

const UIConfigSchema = z.object({
  host: z.string().default('0.0.0.0'),
  port: z.number().default(8000),
  debug: z.boolean().default(false),
});

const ConfigSchema = z.object({
  streamManager: StreamManagerConfigSchema,
  ui: UIConfigSchema,
  version: z.string().default('1.0.0'),
});

export type OBSConfig = z.infer<typeof OBSConfigSchema>;
export type RTMPServerConfig = z.infer<typeof RTMPServerConfigSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export type StreamManagerConfig = z.infer<typeof StreamManagerConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// Export schemas for API validation (optimization - request validation)
export { ConfigSchema, PlatformConfigSchema, StreamManagerConfigSchema };

// Config cache for performance optimization
let configCache: { data: Config; timestamp: number; mtime: number } | null = null;
const CACHE_TTL = 1000; // 1 second cache TTL

// Global config file path (set by SetupService)
let globalConfigPath: string | null = null;

/**
 * Set global config file path (used by SetupService)
 */
export function setConfigPath(configPath: string): void {
  globalConfigPath = configPath;
  // Invalidate cache when config path changes
  configCache = null;
}

/**
 * Get global config file path
 */
export function getConfigPath(): string | null {
  return globalConfigPath;
}

/**
 * Yapılandırmayı yükle - YAML dosyasından veya ortam değişkenlerinden.
 * Optimized with file modification time-based caching.
 */
export function loadConfig(configPath?: string): Config {
  // Determine config file path
  let configFile: string;
  
  if (configPath) {
    // Use provided path directly
    configFile = configPath;
  } else if (globalConfigPath) {
    // Use global config path (from SetupService)
    configFile = globalConfigPath;
  } else {
    // Fallback to default location
    const path = process.env.CONFIG_PATH || 'config.yaml';
    
    // Support for pkg executable - config file should be in executable directory or current working directory
    if (typeof process !== 'undefined' && (process as any).pkg) {
      // Running as pkg executable - use process.cwd() or executable directory
      const exeDir = process.cwd();
      configFile = join(exeDir, path);
      
      // Fallback: try current working directory
      if (!existsSync(configFile)) {
        configFile = join(process.cwd(), path);
      }
    } else {
      // Normal execution - use process.cwd()
      configFile = join(process.cwd(), path);
    }
  }

  // Check cache and file modification time (optimization)
  if (configCache) {
    try {
      const stats = statSync(configFile);
      if (stats.mtimeMs === configCache.mtime && 
          Date.now() - configCache.timestamp < CACHE_TTL) {
        return configCache.data;
      }
    } catch {
      // File doesn't exist, use cache if available and not expired
      if (Date.now() - configCache.timestamp < CACHE_TTL) {
        return configCache.data;
      }
    }
  }

  // Default configuration (used when file is not found)
  const defaultConfig: any = {
    version: '1.0.0',
    streamManager: {
      obs: {
        host: 'localhost',
        port: 4455,
        password: null,
      },
      rtmpServer: {
        host: 'localhost', // Use localhost for RTMP URL (not 0.0.0.0) for OBS compatibility
        port: 1935,
        appName: 'live',
        streamKey: 'obs',
        enabled: true,
      },
      autoReconnect: true,
      reconnectDelay: 5,
      maxReconnectAttempts: 10,
      platforms: [],
    },
    ui: {
      host: '0.0.0.0',
      port: 8000,
      debug: false,
    },
  };

  let configData: any = { ...defaultConfig };
  let fileMtime = 0;

  try {
    const stats = statSync(configFile);
    fileMtime = stats.mtimeMs;
    
    const fileContent = readFileSync(configFile, 'utf-8');
    const yamlData = parse(fileContent);
    // Merge with defaults to ensure all required fields are present
    configData = { ...defaultConfig, ...configData, ...yamlData };
  } catch (error) {
    console.warn(`Config file not found: ${configFile}, using defaults`);
    // Use default config when file is not found
    configData = defaultConfig;
  }

  // YAML'deki snake_case'i camelCase'e çevir
  if (configData.stream_manager) {
    configData.streamManager = {
      ...defaultConfig.streamManager,
      ...configData.stream_manager,
      obs: {
        ...defaultConfig.streamManager.obs,
        ...(configData.stream_manager.obs || {}),
      },
      rtmpServer: configData.stream_manager.rtmp_server
        ? {
            ...defaultConfig.streamManager.rtmpServer,
            ...configData.stream_manager.rtmp_server,
            appName: configData.stream_manager.rtmp_server.app_name || defaultConfig.streamManager.rtmpServer.appName,
            streamKey: configData.stream_manager.rtmp_server.stream_key || defaultConfig.streamManager.rtmpServer.streamKey,
          }
        : defaultConfig.streamManager.rtmpServer,
      autoReconnect: configData.stream_manager.auto_reconnect ?? defaultConfig.streamManager.autoReconnect,
      reconnectDelay: configData.stream_manager.reconnect_delay ?? defaultConfig.streamManager.reconnectDelay,
      maxReconnectAttempts: configData.stream_manager.max_reconnect_attempts ?? defaultConfig.streamManager.maxReconnectAttempts,
      platforms: (configData.stream_manager.platforms || []).map((p: any, index: number) => ({
        ...p,
        id: p.id || `platform_${Date.now()}_${index}`, // Generate ID if not present
        displayName: p.display_name,
        rtmpUrl: p.rtmp_url,
        streamKey: p.stream_key,
      })),
    };
    delete configData.stream_manager;
  }

  // Ensure required fields exist (merge with defaults)
  if (!configData.streamManager) {
    configData.streamManager = defaultConfig.streamManager;
  } else {
    configData.streamManager = {
      ...defaultConfig.streamManager,
      ...configData.streamManager,
      obs: {
        ...defaultConfig.streamManager.obs,
        ...(configData.streamManager.obs || {}),
      },
      rtmpServer: {
        ...defaultConfig.streamManager.rtmpServer,
        ...(configData.streamManager.rtmpServer || {}),
      },
      platforms: configData.streamManager.platforms || defaultConfig.streamManager.platforms,
    };
  }

  if (!configData.ui) {
    configData.ui = defaultConfig.ui;
  } else {
    configData.ui = {
      ...defaultConfig.ui,
      ...configData.ui,
    };
  }

  if (!configData.version) {
    configData.version = defaultConfig.version;
  }

  // Ortam değişkenlerinden yapılandırma
  if (process.env.OBS_HOST) configData.streamManager = configData.streamManager || {};
  if (process.env.OBS_HOST) configData.streamManager.obs = configData.streamManager.obs || {};
  if (process.env.OBS_HOST) configData.streamManager.obs.host = process.env.OBS_HOST;
  if (process.env.OBS_PORT) configData.streamManager.obs.port = parseInt(process.env.OBS_PORT);
  if (process.env.OBS_PASSWORD) configData.streamManager.obs.password = process.env.OBS_PASSWORD;

  if (process.env.UI_HOST) configData.ui = configData.ui || {};
  if (process.env.UI_HOST) configData.ui.host = process.env.UI_HOST;
  if (process.env.UI_PORT) configData.ui.port = parseInt(process.env.UI_PORT);
  if (process.env.UI_DEBUG) configData.ui.debug = process.env.UI_DEBUG === 'true';

  const config = ConfigSchema.parse(configData);
  
  // Update cache (optimization)
  configCache = { data: config, timestamp: Date.now(), mtime: fileMtime };
  
  return config;
}

/**
 * Invalidate config cache (call after config changes)
 */
export function invalidateConfigCache(): void {
  configCache = null;
}

// Config file watcher
let configWatcher: ((curr: any, prev: any) => void) | null = null;

/**
 * Watch config file for changes (optimization - automatic reload)
 */
export function watchConfig(configPath?: string, callback?: (config: Config) => void): () => void {
  const path = configPath || globalConfigPath || process.env.CONFIG_PATH || 'config.yaml';
  // Use path directly if it's absolute, otherwise join with process.cwd()
  const configFile = path.startsWith('/') || path.includes(':\\') ? path : join(process.cwd(), path);
  
  // Stop existing watcher if any
  if (configWatcher) {
    unwatchFile(configFile, configWatcher);
    configWatcher = null;
  }
  
  // Create new watcher
  configWatcher = (curr: any, prev: any) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      // Config file changed, reload
      configCache = null;
      const newConfig = loadConfig(configPath);
      if (callback) {
        callback(newConfig);
      }
    }
  };
  
  watchFile(configFile, { interval: 1000 }, configWatcher);
  
  // Return cleanup function
  return () => {
    if (configWatcher) {
      unwatchFile(configFile, configWatcher);
      configWatcher = null;
    }
  };
}

/**
 * Stop watching config file
 */
export function unwatchConfig(configPath?: string): void {
  const path = configPath || globalConfigPath || process.env.CONFIG_PATH || 'config.yaml';
  // Use path directly if it's absolute, otherwise join with process.cwd()
  const configFile = path.startsWith('/') || path.includes(':\\') ? path : join(process.cwd(), path);
  
  if (configWatcher) {
    unwatchFile(configFile, configWatcher);
    configWatcher = null;
  }
}

/**
 * Yapılandırmayı kaydet - YAML dosyasına.
 */
export async function saveConfig(config: Config, configPath?: string): Promise<void> {
  // Determine config file path
  let configFile: string;
  
  if (configPath) {
    // Use provided path directly
    configFile = configPath;
  } else if (globalConfigPath) {
    // Use global config path (from SetupService)
    configFile = globalConfigPath;
  } else {
    // Fallback to default location
    const path = process.env.CONFIG_PATH || 'config.yaml';
    
    // Support for pkg executable - config file should be in executable directory or current working directory
    if (typeof process !== 'undefined' && (process as any).pkg) {
      // Running as pkg executable - use process.cwd() or executable directory
      const exeDir = process.cwd();
      configFile = join(exeDir, path);
      
      // Fallback: try current working directory
      if (!existsSync(configFile)) {
        configFile = join(process.cwd(), path);
      }
    } else {
      // Normal execution - use process.cwd()
      configFile = join(process.cwd(), path);
    }
  }

  // Yapılandırma dosyası dizinini oluştur
  const dir = join(configFile, '..');
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    // Dizin zaten var
  }

  // camelCase'i snake_case'e çevir (YAML için)
  const yamlData: any = {
    version: config.version,
    stream_manager: {
      obs: {
        host: config.streamManager.obs.host,
        port: config.streamManager.obs.port,
        password: config.streamManager.obs.password,
      },
      rtmp_server: {
        host: config.streamManager.rtmpServer.host,
        port: config.streamManager.rtmpServer.port,
        app_name: config.streamManager.rtmpServer.appName,
        stream_key: config.streamManager.rtmpServer.streamKey,
        enabled: config.streamManager.rtmpServer.enabled,
      },
      auto_reconnect: config.streamManager.autoReconnect,
      reconnect_delay: config.streamManager.reconnectDelay,
      max_reconnect_attempts: config.streamManager.maxReconnectAttempts,
      platforms: config.streamManager.platforms.map((p) => ({
        id: p.id,
        name: p.name,
        display_name: p.displayName,
        rtmp_url: p.rtmpUrl,
        stream_key: p.streamKey,
        enabled: p.enabled,
        metadata: p.metadata,
      })),
    },
    ui: {
      host: config.ui.host,
      port: config.ui.port,
      debug: config.ui.debug,
    },
  };

  // Use async writeFile instead of writeFileSync (optimization - non-blocking)
  await writeFile(configFile, stringify(yamlData), 'utf-8');
  
  // Invalidate cache after save (optimization)
  invalidateConfigCache();
}


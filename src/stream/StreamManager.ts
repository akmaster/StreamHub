/**
 * Stream manager - Stream yönetimi ve platform adaptörleri.
 */

import { IModule, CapsuleType } from '../core/interfaces/IModule.js';
import { IStreamProvider, StreamStatus } from '../core/interfaces/IStreamProvider.js';
import { IPlatformAdapter, PlatformConfig } from '../core/interfaces/IPlatformAdapter.js';
import { ModuleLifecycle } from '../core/lifecycle/ModuleLifecycle.js';
import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';
import { IWebSocketService, StreamStatistics, LogEntry } from '../core/interfaces/IWebSocketService.js';
import { StreamStatisticsParser, ParsedStatistics } from '../services/StreamStatisticsParser.js';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { checkFFmpeg, getFFmpegInstallInstructions } from '../utils/FFmpegChecker.js';

export interface StreamManagerConfig {
  obsHost: string;
  obsPort: number;
  obsPassword?: string | null;
  autoReconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  platforms: PlatformConfig[];
}

export class StreamManager extends EventEmitter implements IModule {
  private readonly registry: ModuleRegistry;
  private readonly lifecycle: ModuleLifecycle;
  private streamProvider: IStreamProvider | null = null;
  private platformAdapters: Map<string, IPlatformAdapter> = new Map();
  private config: StreamManagerConfig | null = null;
  private platformConfigMap: Map<string, PlatformConfig> = new Map(); // Key: platform ID or name -> PlatformConfig (O(1) lookup optimization)
  private streaming: boolean = false;
  private ffmpegProcesses: Map<string, ChildProcess> = new Map(); // Key: platform ID or name
  private platformStreamStates: Map<string, { connected: boolean; streaming: boolean }> = new Map(); // Key: platform ID
  private platformStatistics: Map<string, ParsedStatistics> = new Map(); // Key: platform ID
  private statisticsInterval: NodeJS.Timeout | null = null;
  private statisticsChanged: Set<string> = new Set(); // Track changed platforms for efficient broadcasting
  private statisticsDebounceTimer: NodeJS.Timeout | null = null; // Debounce timer for statistics broadcast (optimization)
  private lastOBSStatus: StreamStatus | null = null;
  private eventListeners: Array<{ emitter: any; event: string; listener: Function }> = []; // Track event listeners for cleanup

  constructor(registry: ModuleRegistry) {
    super();
    this.registry = registry;
    this.lifecycle = new ModuleLifecycle('stream_manager');
  }

  // IModule interface implementation

  get name(): string {
    return 'stream_manager';
  }

  get version(): string {
    return '1.0.0';
  }

  get capsuleType(): CapsuleType {
    return CapsuleType.PROCESSOR;
  }

  get dependencies(): string[] {
    return ['rtmp_server'];
  }

  get exports(): string[] {
    return ['StreamManager'];
  }

  async initialize(): Promise<void> {
    this.lifecycle.markInitializing();

    try {
      this.streamProvider = this.registry.resolve('rtmp_server') as unknown as IStreamProvider;
    } catch (error) {
      throw new Error(
        'No stream provider available. Please configure RTMP server or OBS WebSocket.'
      );
    }

    const platformModules = this.registry.resolveAll('IPlatformAdapter') as unknown as IPlatformAdapter[];
    for (const platform of platformModules) {
      this.platformAdapters.set(platform.platformName, platform);
    }

    this.lifecycle.markInitialized();
  }

  async activate(): Promise<void> {
    if (!this.lifecycle.canActivate()) {
      throw new Error(`Cannot activate stream manager in state: ${this.lifecycle.currentState}`);
    }

    this.lifecycle.markActivating();

    // Get stream provider from registry
    try {
      this.streamProvider = this.registry.resolve<any>('IStreamProvider') as IStreamProvider;
      
      // Listen to RTMP server events for OBS stream status changes (event-based, no polling)
      if (this.streamProvider && typeof (this.streamProvider as any).on === 'function') {
        const streamingListener = () => {
          console.log('[StreamManager] OBS stream started');
          this.lastOBSStatus = StreamStatus.STREAMING;
          this.broadcastStatus();
          // Note: Platforms are now controlled independently by user
          // No automatic start/stop - user controls each platform individually
        };
        
        const donePublishListener = () => {
          console.log('[StreamManager] OBS stream stopped');
          this.lastOBSStatus = StreamStatus.IDLE;
          this.broadcastStatus();
          // Note: Platforms are now controlled independently by user
          // No automatic start/stop - user controls each platform individually
        };
        
        const statusChangeListener = (status: StreamStatus) => {
          if (status !== this.lastOBSStatus) {
            const previousStatus = this.lastOBSStatus;
            this.lastOBSStatus = status;
            
            // Broadcast OBS status update immediately
            this.broadcastStatus();
            
            // Log status change
            if (status === StreamStatus.STREAMING && previousStatus !== StreamStatus.STREAMING) {
              this.logMessage('info', 'OBS stream started', undefined);
            } else if ((status === StreamStatus.IDLE || status === StreamStatus.DISCONNECTED) && 
                       previousStatus === StreamStatus.STREAMING) {
              this.logMessage('info', 'OBS stream stopped', undefined);
            }
          }
        };
        
        // Register event listeners and track them for cleanup
        (this.streamProvider as any).on('streaming', streamingListener);
        (this.streamProvider as any).on('donePublish', donePublishListener);
        (this.streamProvider as any).on('statusChange', statusChangeListener);
        
        // Store listeners for cleanup
        this.eventListeners.push(
          { emitter: this.streamProvider, event: 'streaming', listener: streamingListener },
          { emitter: this.streamProvider, event: 'donePublish', listener: donePublishListener },
          { emitter: this.streamProvider, event: 'statusChange', listener: statusChangeListener }
        );
      }
    } catch (error) {
      console.warn('Stream provider not found in registry:', error);
    }

    // Get platform adapters from registry
    const platformAdapters = this.registry.resolveAll<any>('IPlatformAdapter') as IPlatformAdapter[];
    for (const adapter of platformAdapters) {
      this.platformAdapters.set(adapter.platformName, adapter);
    }

    // Start statistics broadcasting interval (only changed platforms)
    this.startStatisticsBroadcast();

    this.lifecycle.markActive();
  }

  async deactivate(): Promise<void> {
    if (!this.lifecycle.canDeactivate()) {
      return;
    }

    this.lifecycle.markDeactivating();
    
    // Remove event listeners (memory leak prevention)
    for (const { emitter, event, listener } of this.eventListeners) {
      try {
        if (emitter && typeof emitter.off === 'function') {
          emitter.off(event, listener);
        } else if (emitter && typeof emitter.removeListener === 'function') {
          emitter.removeListener(event, listener);
        }
      } catch (error) {
        console.warn(`[StreamManager] Error removing event listener for ${event}:`, error);
      }
    }
    this.eventListeners = [];
    
    await this.stopStream();
    this.stopStatisticsBroadcast();
    
    // Clear debounce timer (memory leak prevention)
    if (this.statisticsDebounceTimer) {
      clearTimeout(this.statisticsDebounceTimer);
      this.statisticsDebounceTimer = null;
    }
    
    this.lifecycle.markDeactivated();
  }

  async destroy(): Promise<void> {
    if (!this.lifecycle.canDestroy()) {
      return;
    }

    this.lifecycle.markDestroying();
    await this.stopStream();
    this.lifecycle.markDestroyed();
  }

  async getStatus(): Promise<Record<string, any>> {
    // Get platform statuses by ID (not by adapter name)
    const platformStatuses: Record<string, any> = {};
    
    if (this.config) {
      for (const platformConfig of this.config.platforms) {
        const platformId = platformConfig.id || platformConfig.name;
        const streamState = this.platformStreamStates.get(platformId);
        
        // Check if FFmpeg process is still alive
        const ffmpegProcess = this.ffmpegProcesses.get(platformId);
        const isProcessAlive = ffmpegProcess && !ffmpegProcess.killed && ffmpegProcess.exitCode === null;
        
        // Use streamState as source of truth - if state says disconnected, respect that
        // Only check process if state is not explicitly set to disconnected
        const stateSaysDisconnected = streamState && (!streamState.streaming && !streamState.connected);
        
        // Determine streaming status
        // Priority: streamState > process status
        // If state says disconnected, use that regardless of process status
        const isStreaming = !stateSaysDisconnected && isProcessAlive && (streamState?.streaming || false);
        const isConnected = !stateSaysDisconnected && isProcessAlive && (streamState?.connected || false);
        
        // Final status determination
        let finalStatus: string;
        if (stateSaysDisconnected) {
          finalStatus = 'idle';
        } else if (isStreaming) {
          finalStatus = 'streaming';
        } else if (isConnected) {
          finalStatus = 'connected';
        } else {
          finalStatus = 'idle';
        }
        
        platformStatuses[platformId] = {
          platform: platformConfig.name,
          status: finalStatus,
          connected: isConnected && !stateSaysDisconnected,
          streaming: isStreaming && !stateSaysDisconnected,
          config: {
            name: platformConfig.name,
            displayName: platformConfig.displayName,
            enabled: platformConfig.enabled,
          },
        };
      }
    }

    // Get stream info and ensure RTMP URL uses localhost (not 0.0.0.0) for OBS compatibility
    let streamInfo = this.streamProvider ? await this.streamProvider.getStreamInfo() : null;
    if (streamInfo && streamInfo.rtmpUrl && streamInfo.rtmpUrl.includes('0.0.0.0')) {
      streamInfo = {
        ...streamInfo,
        rtmpUrl: streamInfo.rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:'),
      };
    }
    
    return {
      name: this.name,
      version: this.version,
      status: this.streaming ? 'streaming' : 'idle',
      streaming: this.streaming,
      lifecycle: this.lifecycle.getInfo(),
      streamInfo: streamInfo,
      platforms: platformStatuses,
    };
  }

  validateDependencies(registry: ModuleRegistry): boolean {
    return registry.has('rtmp_server');
  }

  // Stream manager methods

  async configure(config: StreamManagerConfig): Promise<void> {
    this.config = config;

    // Rebuild platformConfigMap (optimization - O(1) lookup)
    this.rebuildPlatformConfigMap();

    for (const platformConfig of config.platforms) {
      const adapter = this.platformAdapters.get(platformConfig.name);
      if (!adapter) {
        console.warn(`Platform adapter not found: ${platformConfig.name}`);
        continue;
      }

      try {
        const result = await adapter.configure(platformConfig);
        if (!result.success) {
          console.warn(`Failed to configure platform ${platformConfig.name}: ${result.error}`);
        }
      } catch (error) {
        console.warn(`Error configuring platform ${platformConfig.name}:`, error);
      }
    }
  }

  async connect(): Promise<boolean> {
    if (!this.streamProvider) {
      throw new Error('Stream provider is not available');
    }

    try {
      const connected = await this.streamProvider.connect();
      if (connected) {
        this.emit('connected');
      }
      return connected;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.streaming) {
      await this.stopStream();
    }

    if (this.streamProvider) {
      await this.streamProvider.disconnect();
      this.emit('disconnected');
    }
  }

  async startStream(): Promise<boolean> {
    if (!this.streamProvider) {
      throw new Error('Stream provider is not available');
    }

    if (!this.config) {
      throw new Error('Stream manager configuration is not set');
    }

    let streamInfo = await this.streamProvider.getStreamInfo();
    if (!streamInfo) {
      // Default stream info with localhost (not 0.0.0.0)
      streamInfo = {
        streamKey: 'obs',
        rtmpUrl: `rtmp://localhost:1935/live/obs`,
        status: StreamStatus.STREAMING,
      };
    } else {
      // Ensure RTMP URL uses localhost (not 0.0.0.0) for OBS compatibility
      if (streamInfo.rtmpUrl && streamInfo.rtmpUrl.includes('0.0.0.0')) {
        streamInfo = {
          ...streamInfo,
          rtmpUrl: streamInfo.rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:'),
        };
      }
    }

    const activePlatforms = Array.from(this.platformAdapters.values()).filter(
      (adapter) => this.config!.platforms.find((p) => p.name === adapter.platformName)?.enabled
    );

    if (activePlatforms.length === 0) {
      throw new Error(
        'No active platforms configured.\n' +
          'Please configure at least one platform in the web interface.'
      );
    }

    // Get RTMP server stream path
    const rtmpServer = this.registry.resolve<any>('rtmp_server');
    const inputStream = `rtmp://localhost:1935${rtmpServer.getStreamPath()}`;

    const successPlatforms: string[] = [];
    const failedPlatforms: string[] = [];

    for (const platform of activePlatforms) {
      try {
        // Find platform config for this adapter - support multiple platforms with same name
        const platformConfigs = this.config!.platforms.filter((p) => p.name === platform.platformName && p.enabled);
        
        if (platformConfigs.length === 0) {
          console.warn(`Platform config not found for ${platform.platformName}`);
          continue;
        }
        
        // Start stream for each platform config with this adapter name
        for (const platformConfig of platformConfigs) {
          const platformIdentifier = platformConfig.id || platformConfig.name;
          
          // Configure adapter for this specific platform config
          const configureResult = await platform.configure(platformConfig);
          if (!configureResult.success) {
            console.warn(`Failed to configure platform ${platformIdentifier}: ${configureResult.error}`);
            continue;
          }
          
          // Don't call platform.connect() - adapter state is shared, we manage stream state independently
          await this.startPlatformStreamInternal(platform, platformConfig, platformIdentifier, inputStream);
          
          // Update platform stream state
          this.platformStreamStates.set(platformIdentifier, { connected: true, streaming: true });
          
          successPlatforms.push(platformIdentifier);
        }
      } catch (error) {
        console.error(`Failed to start stream for platform ${platform.platformName}:`, error);
        failedPlatforms.push(platform.platformName);
      }
    }

    if (successPlatforms.length === 0) {
      throw new Error(
        `Failed to start stream on all platforms.\n` + `Failed platforms: ${failedPlatforms.join(', ')}`
      );
    }

    this.streaming = true;
    this.emit('streaming', { successPlatforms, failedPlatforms });
    return true;
  }

  async stopStream(): Promise<void> {
    if (!this.streaming) {
      return;
    }

    // Stop all FFmpeg processes for all platforms
    for (const [platformIdentifier, ffmpegProcess] of this.ffmpegProcesses.entries()) {
      try {
        ffmpegProcess.kill('SIGTERM');
        this.ffmpegProcesses.delete(platformIdentifier);
        this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      } catch (error) {
        console.error(`Error stopping FFmpeg process for platform ${platformIdentifier}:`, error);
      }
    }
    
    // Don't call platform.stopStream() or platform.disconnect() - adapter state is shared
    // We manage stream state independently per platform ID

    this.streaming = false;
    this.emit('stopped');
  }

  async startPlatformStream(platformIdOrName: string): Promise<boolean> {
    if (!this.streamProvider) {
      throw new Error('Stream provider is not available');
    }

    if (!this.config) {
      throw new Error('Stream manager configuration is not set');
    }

    // Find platform config using getPlatformConfig (includes lazy initialization)
    const platformConfig = this.getPlatformConfig(platformIdOrName);
    
    if (!platformConfig) {
      throw new Error(`Platform configuration not found: ${platformIdOrName}`);
    }

    if (!platformConfig.enabled) {
      throw new Error(`Platform ${platformIdOrName} is disabled`);
    }

    // Use platform ID for process management, fallback to name
    const platformIdentifier = platformConfig.id || platformConfig.name;

    // Check if stream is already running for this platform
    if (this.ffmpegProcesses.has(platformIdentifier)) {
      console.warn(`Stream already running for platform ${platformIdentifier}`);
      return true;
    }

    const adapter = this.platformAdapters.get(platformConfig.name);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platformConfig.name}`);
    }

    // Check if stream is already active from RTMP server
    const streamInfo = await this.streamProvider.getStreamInfo();
    const isStreamActive = streamInfo && streamInfo.status === StreamStatus.STREAMING;
    
    if (!isStreamActive) {
      console.warn(`RTMP stream is not active for platform ${platformIdentifier}. Attempting to connect anyway...`);
      // Don't throw error - let FFmpeg handle it if stream is not available
      // This allows users to connect platforms before starting OBS stream
    }

    try {
      // Configure adapter for this specific platform config
      // This ensures adapter has the correct RTMP URL and stream key
      const configureResult = await adapter.configure(platformConfig);
      if (!configureResult.success) {
        throw new Error(`Failed to configure platform: ${configureResult.error}`);
      }
      
      // Get RTMP server stream path
      const rtmpServer = this.registry.resolve<any>('rtmp_server');
      const streamPath = rtmpServer.getStreamPath();
      const inputStream = `rtmp://localhost:1935${streamPath}`;
      
      // Start platform stream with platform identifier
      // FFmpeg will fail gracefully if input stream is not available
      // Don't call adapter.connect() - we manage stream state independently per platform ID
      await this.startPlatformStreamInternal(adapter, platformConfig, platformIdentifier, inputStream);
      
      // Update platform stream state
      this.platformStreamStates.set(platformIdentifier, { connected: true, streaming: true });
      
      // Broadcast status update immediately (optimization - real-time updates)
      this.broadcastStatus();
      
      return true;
    } catch (error: any) {
      console.error(`Failed to start stream for platform ${platformIdentifier}:`, error);
      
      // Update platform stream state on error
      this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      
      // Provide more helpful error message
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('Connection refused') || errorMessage.includes('No such file') || errorMessage.includes('Input/output error')) {
        throw new Error(
          'RTMP stream is not available. Please ensure:\n' +
          '1. OBS Studio is running and streaming to rtmp://localhost:1935/live/obs\n' +
          '2. RTMP server is running and accessible\n' +
          '3. Stream key matches the configured key'
        );
      }
      
      throw error;
    }
  }

  async stopPlatformStream(platformIdOrName: string): Promise<void> {
    if (!this.config) {
      throw new Error('Stream manager configuration is not set');
    }

    // Find platform config using getPlatformConfig (includes lazy initialization)
    const platformConfig = this.getPlatformConfig(platformIdOrName);
    
    if (!platformConfig) {
      throw new Error(`Platform configuration not found: ${platformIdOrName}`);
    }

    // Use platform ID for process management, fallback to name
    const platformIdentifier = platformConfig.id || platformConfig.name;

    const adapter = this.platformAdapters.get(platformConfig.name);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platformConfig.name}`);
    }

    try {
      // Stop FFmpeg process for this platform
      const ffmpegProcess = this.ffmpegProcesses.get(platformIdentifier);
      if (ffmpegProcess) {
        try {
          // Kill process gracefully first
          if (!ffmpegProcess.killed) {
            ffmpegProcess.kill('SIGTERM');
          }
        } catch (error) {
          console.warn(`Error killing FFmpeg process for ${platformIdentifier}:`, error);
        }
        // Remove from map immediately to prevent status check from seeing it as alive
        this.ffmpegProcesses.delete(platformIdentifier);
      }

      // Update platform stream state IMMEDIATELY (before broadcast)
      // This ensures getStatus() returns correct state
      this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      
      // Clear statistics for this platform
      this.platformStatistics.delete(platformIdentifier);
      this.statisticsChanged.delete(platformIdentifier);
      
      // Broadcast status update immediately (optimization - real-time updates)
      // This will use the updated state from platformStreamStates
      this.broadcastStatus();
      
      // Don't call adapter.stopStream() or adapter.disconnect() - we manage stream state independently
      // Adapter state is shared between platforms with same name, so we don't want to affect other platforms
    } catch (error) {
      console.error(`Error stopping stream for platform ${platformIdentifier}:`, error);
      // Update state on error
      this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      throw error;
    }
  }

  private async startPlatformStreamInternal(
    _platform: IPlatformAdapter, // Not used - adapter state is shared, we only need config
    platformConfig: PlatformConfig,
    platformIdentifier: string,
    inputStream: string
  ): Promise<void> {
    // Build output URL based on platform RTMP URL format (string operations optimization - cache string literals)
    // For RTMPS (like Kick.com), format: rtmps://server/app/streamKey
    // For RTMP (like Twitch, YouTube), format: rtmp://server/app/streamKey or rtmp://server/streamKey
    
    // Cache string literals for performance (optimization - string operations optimization)
    const rtmpsProtocol = 'rtmps://';
    const appPath = '/app';
    const appPathWithSlash = '/app/';
    const pathSeparator = '/';
    
    let outputUrl: string;
    const rtmpUrl = platformConfig.rtmpUrl; // Cache for repeated access
    const isRTMPS = rtmpUrl.startsWith(rtmpsProtocol);
    
    if (isRTMPS) {
      // RTMPS platforms (Kick.com) - AWS IVS format: rtmps://server/app/streamKey
      // Check if URL already has /app path
      if (rtmpUrl.endsWith(appPath)) {
        outputUrl = `${rtmpUrl}${pathSeparator}${platformConfig.streamKey}`;
      } else if (rtmpUrl.endsWith(appPathWithSlash)) {
        outputUrl = `${rtmpUrl}${platformConfig.streamKey}`;
      } else {
        // Add /app path for RTMPS (Kick.com AWS IVS format)
        const baseUrl = rtmpUrl.replace(/\/$/, ''); // Remove trailing slash
        outputUrl = `${baseUrl}${appPath}${pathSeparator}${platformConfig.streamKey}`;
      }
    } else {
      // RTMP platforms - standard format
      outputUrl = `${rtmpUrl}${pathSeparator}${platformConfig.streamKey}`;
    }

    // Use FFmpeg to relay stream
    const ffmpegArgs = [
      '-i',
      inputStream,
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-f',
      'flv',
      '-threads',
      '2',  // Limit thread count to reduce CPU usage (stream quality not affected)
    ];

    // Add log level for FFmpeg (info level needed for statistics parsing)
    // Statistics (frame=, fps=, bitrate=) are shown at info level
    // We filter non-statistics logs in production to reduce CPU usage
    ffmpegArgs.push('-loglevel', 'info');

    // Add RTMPS-specific parameters for secure RTMP connections
    if (isRTMPS) {
      // Enable protocol whitelist for RTMPS (required for RTMPS)
      ffmpegArgs.push('-protocol_whitelist', 'rtmp,rtmps,file,http,https,tcp,tls');
      // Add reconnect parameters for better stability
      ffmpegArgs.push('-reconnect', '1');
      ffmpegArgs.push('-reconnect_at_eof', '1');
      ffmpegArgs.push('-reconnect_streamed', '1');
      ffmpegArgs.push('-reconnect_delay_max', '2');
      // RTMPS-specific parameters for AWS IVS (Kick.com)
      // Note: These parameters must be placed before the output URL
      ffmpegArgs.push('-rtmp_live', 'live');
      // Add buffer size for RTMPS (optimized for memory usage, stream quality not affected)
      ffmpegArgs.push('-bufsize', '384k');
    }

    ffmpegArgs.push(outputUrl);
    
    // Check if FFmpeg is available before spawning
    const ffmpegCheck = checkFFmpeg();
    if (!ffmpegCheck.available) {
      const errorMessage = `FFmpeg is not available: ${ffmpegCheck.error}\n\n${getFFmpegInstallInstructions()}`;
      console.error(`[FFmpeg ${platformIdentifier}] ${errorMessage}`);
      this.logMessage('error', `FFmpeg not found: ${ffmpegCheck.error}`, platformIdentifier);
      throw new Error(errorMessage);
    }

    // Log FFmpeg command for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FFmpeg ${platformIdentifier}] Command: ffmpeg ${ffmpegArgs.join(' ')}`);
      console.log(`[FFmpeg ${platformIdentifier}] Using FFmpeg ${ffmpegCheck.version} from ${ffmpegCheck.path}`);
    }

    // Track buffer sizes to prevent memory leaks (optimization - FFmpeg output buffering)
    // Note: spawn() doesn't support maxBuffer option, so we track buffer sizes manually
    let stdoutBufferSize = 0;
    let stderrBufferSize = 0;
    const maxBufferResetSize = 1024 * 1024; // 1MB (reset threshold)

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout?.on('data', (data: Buffer) => {
      stdoutBufferSize += data.length;
      // Reset buffer size counter if it gets too large (prevent memory leak)
      if (stdoutBufferSize > maxBufferResetSize) {
        console.warn(`[FFmpeg ${platformIdentifier}] stdout buffer size warning: ${stdoutBufferSize} bytes, resetting counter`);
        stdoutBufferSize = 0; // Reset counter
      }
      
      const output = data.toString();
      // Only log stdout in development mode (optimized for CPU usage)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FFmpeg ${platformIdentifier}] stdout:`, output);
        this.logMessage('info', `[FFmpeg ${platformIdentifier}] ${output}`, platformIdentifier);
      }
    });

    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      stderrBufferSize += data.length;
      // Reset buffer size counter if it gets too large (prevent memory leak)
      if (stderrBufferSize > maxBufferResetSize) {
        console.warn(`[FFmpeg ${platformIdentifier}] stderr buffer size warning: ${stderrBufferSize} bytes, resetting counter`);
        stderrBufferSize = 0; // Reset counter
      }
      
      const output = data.toString();
      // Only log stderr in development mode, or if it contains errors/warnings
      if (process.env.NODE_ENV === 'development') {
        console.error(`[FFmpeg ${platformIdentifier}] stderr:`, output);
      } else if (output.includes('error') || output.includes('Error') || output.includes('failed') || 
                 output.includes('warning') || output.includes('Warning') || output.includes('WARN')) {
        console.error(`[FFmpeg ${platformIdentifier}] stderr:`, output);
      }
      
      // Parse statistics from FFmpeg stderr output
      // Use cached string operations (optimization - string operations optimization)
      const newlineChar = '\n'; // Cache string literal
      const lines = output.split(newlineChar).filter((line: string) => line.trim());
      for (const line of lines) {
        // Check for RTMPS connection errors
        if (isRTMPS && (line.includes('Connection refused') || line.includes('SSL') || line.includes('TLS') || line.includes('certificate') || line.includes('handshake'))) {
          this.logMessage('error', `[FFmpeg ${platformIdentifier}] RTMPS Error: ${line}`, platformIdentifier);
        }
        
        // Check if this is a statistics line (contains frame=, fps=, bitrate=)
        // Statistics lines are crucial for monitoring and must be processed
        if (line.includes('frame=') || line.includes('fps=') || line.includes('bitrate=')) {
          const stats = StreamStatisticsParser.parseStderrLine(line);
          if (stats) {
            // Update latest statistics (only keep latest, no buffer needed)
            this.platformStatistics.set(platformIdentifier, stats);
            
            // Mark platform as changed for efficient broadcasting
            this.statisticsChanged.add(platformIdentifier);
            
            // Schedule debounced broadcast (optimization - reduces network traffic)
            this.scheduleStatisticsBroadcast();
          }
        } else {
          // Regular log message - filter in production to reduce CPU usage
          // Only process non-statistics logs if they contain errors or warnings
          const isErrorOrWarning = line.includes('error') || line.includes('Error') || 
                                   line.includes('failed') || line.includes('warning') || 
                                   line.includes('Warning') || line.includes('WARN') ||
                                   line.includes('Error') || line.toLowerCase().includes('error');
          
          if (process.env.NODE_ENV === 'development') {
            // In development, log everything
            this.logMessage('debug', `[FFmpeg ${platformIdentifier}] ${line}`, platformIdentifier);
          } else if (isErrorOrWarning) {
            // In production, only log errors and warnings (filter out info logs)
            // Skip common info messages that are not errors
            if (!line.includes('Stream #') && !line.includes('Input #') && 
                !line.includes('Output #') && !line.includes('Duration:') &&
                !line.includes('start:') && !line.includes('bitrate:') &&
                !line.includes('frame=') && !line.includes('fps=')) {
              const logLevel = line.includes('error') || line.includes('Error') || line.includes('failed') ? 'error' : 'warn';
              this.logMessage(logLevel, `[FFmpeg ${platformIdentifier}] ${line}`, platformIdentifier);
            }
          }
          // In production, silently ignore non-error/non-warning logs to reduce CPU usage
        }
      }
    });

    ffmpegProcess.on('error', (error) => {
      // Always log errors (important for debugging)
      console.error(`[FFmpeg ${platformIdentifier}] Error:`, error);
      
      // Remove all event listeners (memory leak prevention)
      try {
        ffmpegProcess.removeAllListeners('data');
        ffmpegProcess.removeAllListeners('error');
        ffmpegProcess.removeAllListeners('close');
        ffmpegProcess.stdout?.removeAllListeners('data');
        ffmpegProcess.stderr?.removeAllListeners('data');
      } catch (cleanupError) {
        console.warn(`[FFmpeg ${platformIdentifier}] Error removing event listeners:`, cleanupError);
      }
      
      this.ffmpegProcesses.delete(platformIdentifier);
      this.platformStatistics.delete(platformIdentifier);
      this.statisticsChanged.delete(platformIdentifier);
      this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      this.logMessage('error', `[FFmpeg ${platformIdentifier}] Error: ${error.message}`, platformIdentifier);
      this.broadcastStatus();
    });

    ffmpegProcess.on('close', (code) => {
      // Remove all event listeners (memory leak prevention)
      try {
        ffmpegProcess.removeAllListeners('data');
        ffmpegProcess.removeAllListeners('error');
        ffmpegProcess.removeAllListeners('close');
        ffmpegProcess.stdout?.removeAllListeners('data');
        ffmpegProcess.stderr?.removeAllListeners('data');
      } catch (cleanupError) {
        console.warn(`[FFmpeg ${platformIdentifier}] Error removing event listeners:`, cleanupError);
      }
      
      // Only log process close in development mode, or if exit code is not 0 (error)
      if (process.env.NODE_ENV === 'development' || code !== 0) {
        console.log(`[FFmpeg ${platformIdentifier}] Process exited with code ${code}`);
      }
      
      this.ffmpegProcesses.delete(platformIdentifier);
      this.platformStatistics.delete(platformIdentifier);
      this.statisticsChanged.delete(platformIdentifier);
      this.platformStreamStates.set(platformIdentifier, { connected: false, streaming: false });
      
      // Log message
      if (code === 0) {
        this.logMessage('info', `Stream stopped for platform ${platformIdentifier}`, platformIdentifier);
      } else {
        this.logMessage('error', `Stream process exited with code ${code} for platform ${platformIdentifier}`, platformIdentifier);
      }
      
      // Broadcast status update
      this.broadcastStatus();
    });

    this.ffmpegProcesses.set(platformIdentifier, ffmpegProcess);
    
    // Don't call platform.startStream() or platform.connect() - adapter state is shared
    // We manage stream state independently per platform ID
    // The FFmpeg process handles the actual streaming
  }

  getPlatformAdapter(platformName: string): IPlatformAdapter | null {
    return this.platformAdapters.get(platformName) || null;
  }

  /**
   * Get platform config by ID or name (O(1) lookup optimization)
   */
  getPlatformConfig(platformIdOrName: string): PlatformConfig | null {
    // If platformConfigMap is empty but config exists, rebuild map (lazy initialization)
    if (this.platformConfigMap.size === 0 && this.config) {
      this.rebuildPlatformConfigMap();
    }
    
    return this.platformConfigMap.get(platformIdOrName) || null;
  }
  
  /**
   * Rebuild platformConfigMap from current config (optimization - O(1) lookup)
   */
  private rebuildPlatformConfigMap(): void {
    if (!this.config) {
      return;
    }
    
    // Clear and rebuild platformConfigMap
    this.platformConfigMap.clear();
    
    for (const platformConfig of this.config.platforms) {
      // Add platform config to map by both ID and name for flexible lookup (optimization)
      const platformId = platformConfig.id || platformConfig.name;
      this.platformConfigMap.set(platformId, platformConfig);
      // Also add by name for backward compatibility (if ID exists and is different from name)
      if (platformConfig.id && platformConfig.id !== platformConfig.name) {
        this.platformConfigMap.set(platformConfig.name, platformConfig);
      }
    }
  }

  getAllPlatformAdapters(): IPlatformAdapter[] {
    return Array.from(this.platformAdapters.values());
  }

  // Statistics and broadcasting methods

  private startStatisticsBroadcast(): void {
    // Broadcast statistics every 4 seconds (optimized for CPU/network usage)
    this.statisticsInterval = setInterval(() => {
      this.broadcastStatisticsUpdate();
    }, 4000);
  }

  private stopStatisticsBroadcast(): void {
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
      this.statisticsInterval = null;
    }
  }


  private broadcastStatisticsUpdate(): void {
    // Get WebSocket service from registry
    try {
      const wsService = this.registry.resolve<IWebSocketService>('IWebSocketService');
      if (!wsService) {
        return;
      }

      // If no statistics changed, skip broadcast (optimization)
      if (this.statisticsChanged.size === 0) {
        return;
      }

      // Collect statistics only for changed platforms (optimization)
      const statistics: StreamStatistics[] = [];

      if (this.config) {
        for (const platformId of this.statisticsChanged) {
          // Use Map for O(1) lookup (optimization)
          const platformConfig = this.platformConfigMap.get(platformId);
          if (!platformConfig) {
            continue;
          }

          const stats = this.platformStatistics.get(platformId);
          const streamState = this.platformStreamStates.get(platformId);
          const ffmpegProcess = this.ffmpegProcesses.get(platformId);
          const isStreaming = ffmpegProcess && !ffmpegProcess.killed && (streamState?.streaming || false);

          statistics.push({
            platformId,
            platformName: platformConfig.displayName || platformConfig.name,
            bitrate: stats?.bitrate,
            fps: stats?.fps,
            resolution: stats?.resolution,
            codec: stats?.codec,
            status: isStreaming ? 'streaming' : 'idle',
            uptime: stats?.time,
            errors: 0, // TODO: Track errors
          });
        }
      }

      // Clear changed set after broadcasting
      this.statisticsChanged.clear();

      // Broadcast statistics (only changed platforms)
      if (statistics.length > 0) {
        wsService.broadcastStatistics(statistics);
      }
    } catch (error) {
      // WebSocket service not available, ignore
    }
  }

  /**
   * Debounced statistics broadcast (optimization - reduces network traffic)
   */
  private scheduleStatisticsBroadcast(): void {
    // Clear existing timer
    if (this.statisticsDebounceTimer) {
      clearTimeout(this.statisticsDebounceTimer);
    }

    // Schedule broadcast with debounce (100ms)
    this.statisticsDebounceTimer = setTimeout(() => {
      this.broadcastStatisticsUpdate();
      this.statisticsDebounceTimer = null;
    }, 100); // 100ms debounce
  }


  private broadcastStatus(): void {
    // Get WebSocket service from registry
    try {
      const wsService = this.registry.resolve<IWebSocketService>('IWebSocketService');
      if (!wsService) {
        return;
      }

      // Get current status and broadcast
      this.getStatus()
        .then((status) => {
          wsService.broadcastStatus(status);
        })
        .catch((error) => {
          console.error('Error broadcasting status:', error);
        });
    } catch (error) {
      // WebSocket service not available, ignore
    }
  }

  private logMessage(level: 'debug' | 'info' | 'warn' | 'error', message: string, platformId?: string): void {
    // Get WebSocket service from registry
    try {
      const wsService = this.registry.resolve<IWebSocketService>('IWebSocketService');
      if (!wsService) {
        return;
      }

      const logEntry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        source: 'stream_manager',
        platformId,
      };

      wsService.broadcastLog(logEntry);
    } catch (error) {
      // WebSocket service not available, ignore
    }

    // Also log to console
    switch (level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.log(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }
}


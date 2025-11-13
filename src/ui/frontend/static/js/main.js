// Modern JavaScript - API client and UI management

const API_BASE_URL = '/api';

// API Client
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            
            // Response'u parse et
            let data;
            try {
                data = await response.json();
            } catch {
                // JSON parse edilemezse text olarak al
                const text = await response.text();
                data = { error: text || `HTTP error! status: ${response.status}` };
            }
            
            if (!response.ok) {
                // Hata yanıtını düzgün şekilde fırlat
                const error = new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
                error.response = { data: data, status: response.status };
                throw error;
            }
            
            return data;
        } catch (error) {
            // Network error veya connection refused hatası
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('API request failed - server may be down:', error);
                const networkError = new Error('Cannot connect to server. Please check if the server is running.');
                networkError.response = { data: { error: 'Connection refused. Server may be down.' }, status: 0 };
                throw networkError;
            }
            console.error('API request error:', error);
            throw error;
        }
    }
    
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data,
        });
    }
}

const api = new APIClient(API_BASE_URL);

// Notification System
class NotificationManager {
    show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Çok satırlı mesajları düzgün göster
        if (typeof message === 'string' && message.includes('\n')) {
            const lines = message.split('\n');
            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = lines[0];
            notification.appendChild(title);
            
            if (lines.length > 1) {
                const details = document.createElement('div');
                details.className = 'notification-details';
                details.textContent = lines.slice(1).join('\n');
                notification.appendChild(details);
            }
        } else if (typeof message === 'object' && message.error) {
            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = message.error;
            notification.appendChild(title);
            
            if (message.details) {
                const details = document.createElement('div');
                details.className = 'notification-details';
                details.textContent = message.details;
                notification.appendChild(details);
            }
        } else {
            notification.textContent = typeof message === 'string' ? message : JSON.stringify(message);
        }
        
        document.body.appendChild(notification);
        
        // Hata mesajları daha uzun gösterilsin
        const timeout = type === 'error' ? 8000 : 3000;
        
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, timeout);
    }
    
    success(message) {
        this.show(message, 'success');
    }
    
    error(message) {
        this.show(message, 'error');
    }
    
    info(message) {
        this.show(message, 'info');
    }
    
    warning(message) {
        this.show(message, 'warning');
    }
}

const notificationManager = new NotificationManager();

// Stream Controller
class StreamController {
    constructor() {
        this.streaming = false;
        this.updateStatus();
    }
    
    async updateStatus() {
        try {
            const status = await api.get('/stream/status');
            const statusElement = document.getElementById('stream-status');
            
            if (status.status === 'streaming') {
                statusElement.textContent = 'Streaming';
                statusElement.className = 'status-badge status-streaming';
                this.streaming = true;
            } else if (status.status === 'connected') {
                statusElement.textContent = 'Connected';
                statusElement.className = 'status-badge status-connected';
                this.connected = true;
            } else {
                statusElement.textContent = 'Idle';
                statusElement.className = 'status-badge status-idle';
                this.connected = false;
                this.streaming = false;
            }
            
            // Update RTMP URL from streamInfo
            if (status.streamInfo && status.streamInfo.rtmpUrl) {
                const rtmpUrlElement = document.getElementById('rtmp-url');
                if (rtmpUrlElement) {
                    // Ensure URL uses localhost (not 0.0.0.0)
                    let rtmpUrl = status.streamInfo.rtmpUrl;
                    rtmpUrl = rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:');
                    rtmpUrlElement.textContent = rtmpUrl;
                }
                
                const streamKeyElement = document.getElementById('stream-key');
                if (streamKeyElement && status.streamInfo.streamKey) {
                    streamKeyElement.textContent = status.streamInfo.streamKey;
                }
            }
            
            // Update OBS stream status indicator
            this.updateOBSStatus(status);
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }
    
    updateOBSStatus(status) {
        const obsStatusIcon = document.getElementById('obs-status-icon');
        const obsStatusText = document.getElementById('obs-status-text');
        const obsStatusDetails = document.getElementById('obs-status-details');
        
        if (!obsStatusIcon || !obsStatusText || !obsStatusDetails) return;
        
        // Check if OBS stream is active
        const streamInfo = status.streamInfo;
        // StreamStatus.STREAMING = 'streaming' (from enum)
        const isOBSStreaming = streamInfo && (streamInfo.status === 'streaming' || streamInfo.status === 'STREAMING');
        
        if (isOBSStreaming) {
            obsStatusIcon.textContent = '🟢';
            obsStatusIcon.className = 'obs-status-icon obs-status-active';
            obsStatusText.textContent = 'OBS Stream Active';
            obsStatusText.className = 'obs-status-text obs-status-active';
            
            // Show stream details
            if (streamInfo.rtmpUrl) {
                // Ensure URL uses localhost (not 0.0.0.0)
                let rtmpUrl = streamInfo.rtmpUrl;
                rtmpUrl = rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:');
                
                obsStatusDetails.innerHTML = `
                    <div class="obs-detail-item">
                        <span class="obs-detail-label">RTMP URL:</span>
                        <span class="obs-detail-value">${rtmpUrl}</span>
                    </div>
                    <div class="obs-detail-item">
                        <span class="obs-detail-label">Stream Key:</span>
                        <span class="obs-detail-value">${streamInfo.streamKey || 'N/A'}</span>
                    </div>
                `;
                obsStatusDetails.style.display = 'block';
            } else {
                obsStatusDetails.style.display = 'none';
            }
        } else {
            obsStatusIcon.textContent = '⚫';
            obsStatusIcon.className = 'obs-status-icon obs-status-inactive';
            obsStatusText.textContent = 'No OBS Stream';
            obsStatusText.className = 'obs-status-text obs-status-inactive';
            obsStatusDetails.innerHTML = `
                <div class="obs-detail-item">
                    <span class="obs-detail-label">Status:</span>
                    <span class="obs-detail-value">Waiting for OBS to start streaming...</span>
                </div>
                <div class="obs-detail-item">
                    <span class="obs-detail-label">RTMP URL:</span>
                    <span class="obs-detail-value">${streamInfo && streamInfo.rtmpUrl ? streamInfo.rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:') : 'rtmp://localhost:1935/live/obs'}</span>
                </div>
            `;
            obsStatusDetails.style.display = 'block';
        }
    }
    
    // Update status from WebSocket message
    updateStatusFromWebSocket(statusData) {
        const statusElement = document.getElementById('stream-status');
        
        if (statusData.streaming) {
            statusElement.textContent = 'Streaming';
            statusElement.className = 'status-badge status-streaming';
            this.streaming = true;
        } else {
            statusElement.textContent = 'Idle';
            statusElement.className = 'status-badge status-idle';
            this.streaming = false;
        }
        
        // Update OBS stream status indicator (always update from streamInfo)
        if (statusData.streamInfo) {
            this.updateOBSStatusFromStreamInfo(statusData.streamInfo);
        } else {
            // Fallback: update from statusData itself
            this.updateOBSStatus(statusData);
        }
    }
    
    // Update OBS status from streamInfo (more accurate)
    updateOBSStatusFromStreamInfo(streamInfo) {
        const obsStatusIcon = document.getElementById('obs-status-icon');
        const obsStatusText = document.getElementById('obs-status-text');
        const obsStatusDetails = document.getElementById('obs-status-details');
        
        if (!obsStatusIcon || !obsStatusText || !obsStatusDetails) return;
        
        // Update RTMP URL in stream info card
        if (streamInfo.rtmpUrl) {
            const rtmpUrlElement = document.getElementById('rtmp-url');
            if (rtmpUrlElement) {
                // Ensure URL uses localhost (not 0.0.0.0)
                let rtmpUrl = streamInfo.rtmpUrl;
                rtmpUrl = rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:');
                rtmpUrlElement.textContent = rtmpUrl;
            }
        }
        
        // Update stream key in stream info card
        if (streamInfo.streamKey) {
            const streamKeyElement = document.getElementById('stream-key');
            if (streamKeyElement) {
                streamKeyElement.textContent = streamInfo.streamKey;
            }
        }
        
        // Check if OBS stream is active
        const isOBSStreaming = streamInfo.status === 'streaming' || streamInfo.status === 'STREAMING';
        
        if (isOBSStreaming) {
            obsStatusIcon.textContent = '🟢';
            obsStatusIcon.className = 'obs-status-icon obs-status-active';
            obsStatusText.textContent = 'OBS Stream Active';
            obsStatusText.className = 'obs-status-text obs-status-active';
            
            // Show stream details
            if (streamInfo.rtmpUrl) {
                // Ensure URL uses localhost (not 0.0.0.0)
                let rtmpUrl = streamInfo.rtmpUrl;
                rtmpUrl = rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:');
                
                obsStatusDetails.innerHTML = `
                    <div class="obs-detail-item">
                        <span class="obs-detail-label">Status:</span>
                        <span class="obs-detail-value">Streaming</span>
                    </div>
                    <div class="obs-detail-item">
                        <span class="obs-detail-label">RTMP URL:</span>
                        <span class="obs-detail-value">${rtmpUrl}</span>
                    </div>
                    <div class="obs-detail-item">
                        <span class="obs-detail-label">Stream Key:</span>
                        <span class="obs-detail-value">${streamInfo.streamKey || 'N/A'}</span>
                    </div>
                `;
                obsStatusDetails.style.display = 'block';
            } else {
                obsStatusDetails.style.display = 'none';
            }
        } else {
            obsStatusIcon.textContent = '⚫';
            obsStatusIcon.className = 'obs-status-icon obs-status-inactive';
            obsStatusText.textContent = 'No OBS Stream';
            obsStatusText.className = 'obs-status-text obs-status-inactive';
            
            // Show waiting message
            let rtmpUrl = streamInfo.rtmpUrl || 'rtmp://localhost:1935/live/obs';
            rtmpUrl = rtmpUrl.replace('rtmp://0.0.0.0:', 'rtmp://localhost:');
            
            obsStatusDetails.innerHTML = `
                <div class="obs-detail-item">
                    <span class="obs-detail-label">Status:</span>
                    <span class="obs-detail-value">Waiting for OBS to start streaming...</span>
                </div>
                <div class="obs-detail-item">
                    <span class="obs-detail-label">RTMP URL:</span>
                    <span class="obs-detail-value">${rtmpUrl}</span>
                </div>
            `;
            obsStatusDetails.style.display = 'block';
        }
    }
}

// Platform Manager
class PlatformManager {
    constructor() {
        this.platforms = [];
        this.editingPlatform = null;
        this.statistics = new Map(); // platformId -> statistics
        this.updateQueue = new Map(); // platformId -> stats (for throttling)
        this.updateTimer = null; // Throttle timer
        this.domCache = new Map(); // platformId -> DOM elements (optimization - O(1) lookup)
        this.platformMap = new Map(); // platformId -> platform (optimization - O(1) lookup)
        this.eventListeners = []; // Track event listeners for cleanup (memory leak prevention)
        this.intervals = []; // Track intervals for cleanup (memory leak prevention)
        this.timeouts = []; // Track timeouts for cleanup (memory leak prevention)
    }
    
    async loadPlatforms() {
        try {
            this.platforms = await api.get('/platforms');
            this.renderPlatforms();
        } catch (error) {
            console.error('Error loading platforms:', error);
            notificationManager.error('Failed to load platforms');
        }
    }
    
    renderPlatforms() {
        const container = document.getElementById('platforms-list');
        const streamingList = document.getElementById('streaming-platforms-list');
        const idleList = document.getElementById('idle-platforms-list');
        const emptyState = document.getElementById('platforms-empty-state');
        
        // Clear DOM cache on re-render (optimization)
        this.domCache.clear();
        
        // Build platform map for O(1) lookup (optimization)
        this.platformMap.clear();
        for (const platform of this.platforms) {
            const platformId = platform.id || platform.name;
            this.platformMap.set(platformId, platform);
        }
        
        if (this.platforms.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (streamingList) streamingList.innerHTML = '';
            if (idleList) idleList.innerHTML = '';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        // Separate platforms by status
        const streamingPlatforms = [];
        const idlePlatforms = [];
        
        for (const platform of this.platforms) {
            const platformId = platform.id || platform.name;
            const isStreaming = platform.status === 'streaming';
            const stats = this.statistics.get(platformId);
            
            if (isStreaming) {
                streamingPlatforms.push({ platform, platformId, stats });
            } else {
                idlePlatforms.push({ platform, platformId, stats });
            }
        }
        
        // Render streaming platforms
        if (streamingList) {
            if (streamingPlatforms.length === 0) {
                streamingList.innerHTML = '<div class="platforms-group-empty">No platforms streaming</div>';
            } else {
                streamingList.innerHTML = streamingPlatforms.map(({ platform, platformId, stats }) => {
                    const displayName = platform.displayName || platform.name;
                    const platformName = platform.displayName ? `(${platform.name})` : '';
                    const bitrate = stats?.bitrate ? Math.round(stats.bitrate) : null;
                    const fps = stats?.fps ? stats.fps.toFixed(1) : null;
                    const platformIcon = this.getPlatformIcon(platform.name);
                    
                    return `
                        <div class="platform-item streaming" data-platform-id="${platformId}" data-platform-name="${platform.name}">
                            <label class="platform-toggle-switch">
                                <input type="checkbox" class="platform-toggle-input" data-platform-id="${platformId}" checked ${!platform.enabled ? 'disabled' : ''}>
                                <span class="platform-toggle-slider"></span>
                            </label>
                            <div class="platform-item-icon ${platform.name}">${platformIcon}</div>
                            <div class="platform-item-info">
                                <span class="platform-item-name">${displayName}</span>
                                ${platformName ? `<span class="platform-item-type">${platformName}</span>` : ''}
                            </div>
                            ${(bitrate || fps) ? `
                                <div class="platform-item-stats">
                                    ${bitrate ? `<div class="platform-item-stat-item">
                                        <span class="platform-item-stat-label">Bitrate:</span>
                                        <span class="platform-item-stat-value">${bitrate} kbps</span>
                                    </div>` : ''}
                                    ${fps ? `<div class="platform-item-stat-item">
                                        <span class="platform-item-stat-label">FPS:</span>
                                        <span class="platform-item-stat-value">${fps}</span>
                                    </div>` : ''}
                                </div>
                            ` : ''}
                            <div class="platform-item-actions">
                                <button class="btn-icon tooltip platform-edit-btn" data-platform-id="${platformId}" data-tooltip="Edit Platform" title="Edit">✏️</button>
                                <button class="btn-icon tooltip platform-delete-btn" data-platform-id="${platformId}" data-tooltip="Delete Platform" title="Delete">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Render idle platforms
        if (idleList) {
            if (idlePlatforms.length === 0) {
                idleList.innerHTML = '<div class="platforms-group-empty">All platforms are idle</div>';
            } else {
                idleList.innerHTML = idlePlatforms.map(({ platform, platformId }) => {
                    const displayName = platform.displayName || platform.name;
                    const platformName = platform.displayName ? `(${platform.name})` : '';
                    const platformIcon = this.getPlatformIcon(platform.name);
                    
                    return `
                        <div class="platform-item" data-platform-id="${platformId}" data-platform-name="${platform.name}">
                            <label class="platform-toggle-switch">
                                <input type="checkbox" class="platform-toggle-input" data-platform-id="${platformId}" ${!platform.enabled ? 'disabled' : ''}>
                                <span class="platform-toggle-slider"></span>
                            </label>
                            <div class="platform-item-icon ${platform.name}">${platformIcon}</div>
                            <div class="platform-item-info">
                                <span class="platform-item-name">${displayName}</span>
                                ${platformName ? `<span class="platform-item-type">${platformName}</span>` : ''}
                            </div>
                            <div class="platform-item-actions">
                                <button class="btn-icon tooltip platform-edit-btn" data-platform-id="${platformId}" data-tooltip="Edit Platform" title="Edit">✏️</button>
                                <button class="btn-icon tooltip platform-delete-btn" data-platform-id="${platformId}" data-tooltip="Delete Platform" title="Delete">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }
    
    async connectPlatform(platformId) {
        // Add loading state
        const platformItem = document.querySelector(`.platform-item[data-platform-id="${platformId}"]`);
        if (platformItem) {
            platformItem.classList.add('loading');
        }
        
        // Optimistic UI update - set button to streaming state and disable it
        this.updatePlatformButton(platformId, 'streaming', true);
        
        try {
            const result = await api.post(`/platforms/${platformId}/connect`);
            if (result.success) {
                // Remove loading state
                if (platformItem) {
                    platformItem.classList.remove('loading');
                }
                
                notificationManager.success(`Stream started successfully`);
                // Update platform status optimistically - WebSocket will update with actual status
                const platform = this.platformMap.get(platformId);
                if (platform) {
                    platform.status = 'streaming';
                }
                // Keep button disabled briefly - WebSocket will enable it when stream is confirmed
                // Don't reload all platforms - WebSocket will update status in real-time
                // await this.loadPlatforms();
            } else {
                // Revert optimistic update on failure
                this.updatePlatformButton(platformId, 'idle', false);
                notificationManager.error('Failed to start stream');
            }
        } catch (error) {
            console.error('Error connecting platform:', error);
            // Remove loading state
            const platformItem = document.querySelector(`.platform-item[data-platform-id="${platformId}"]`);
            if (platformItem) {
                platformItem.classList.remove('loading');
            }
            // Revert optimistic update on error
            this.updatePlatformButton(platformId, 'idle', false);
            
            let errorMsg = error.message || 'Failed to start stream';
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                } else if (error.response.data.error) {
                    errorMsg = error.response.data.error;
                    if (error.response.data.details) {
                        errorMsg += '\n' + error.response.data.details;
                    }
                } else {
                    errorMsg = JSON.stringify(error.response.data);
                }
            }
            
            // Show error notification with better formatting for multi-line messages
            if (errorMsg.includes('\n')) {
                const lines = errorMsg.split('\n');
                notificationManager.error({
                    error: lines[0],
                    details: lines.slice(1).join('\n')
                });
            } else {
                notificationManager.error(errorMsg);
            }
        }
    }
    
    async disconnectPlatform(platformId) {
        // Get platform from map
        const platform = this.platformMap.get(platformId);
        const previousStatus = platform?.status || 'streaming';
        
        // Optimistic UI update - immediately update platform status and button
        if (platform) {
            platform.status = 'idle';
            // Mark platform as manually disconnected to prevent WebSocket from reverting
            platform._manuallyDisconnected = true;
            platform._disconnectTime = Date.now();
        }
        
        // Clear statistics for this platform immediately
        this.statistics.delete(platformId);
        this.updatePlatformStatistics(platformId, null);
        
        // Update button to idle state immediately (optimistic update)
        this.updatePlatformButton(platformId, 'idle', false);
        
        // Clear DOM cache to ensure fresh lookup (prevent stale references)
        this.domCache.delete(platformId);
        
        try {
            const result = await api.post(`/platforms/${platformId}/disconnect`);
            if (result.success) {
                notificationManager.success(`Stream stopped successfully`);
                
                // Keep manual disconnect flag until backend confirms idle status
                // WebSocket handler will clear the flag when it receives 'idle' status
                // This prevents stale 'streaming' status from reverting the UI
                // Flag will be cleared automatically when backend sends 'idle' status via WebSocket
                
            } else {
                // Revert optimistic update on failure
                if (platform) {
                    platform.status = previousStatus;
                    delete platform._manuallyDisconnected;
                    delete platform._disconnectTime;
                }
                this.updatePlatformButton(platformId, previousStatus, false);
                this.domCache.delete(platformId); // Clear cache to force refresh
                notificationManager.error('Failed to stop stream');
            }
        } catch (error) {
            console.error('Error disconnecting platform:', error);
            
            // Revert optimistic update on error
            if (platform) {
                platform.status = previousStatus;
                delete platform._manuallyDisconnected;
                delete platform._disconnectTime;
            }
            this.updatePlatformButton(platformId, previousStatus, false);
            this.domCache.delete(platformId); // Clear cache to force refresh
            
            let errorMsg = error.message || 'Failed to stop stream';
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                } else if (error.response.data.error) {
                    errorMsg = error.response.data.error;
                    if (error.response.data.details) {
                        errorMsg += '\n' + error.response.data.details;
                    }
                } else {
                    errorMsg = JSON.stringify(error.response.data);
                }
            }
            
            // Show error notification with better formatting for multi-line messages
            if (errorMsg.includes('\n')) {
                const lines = errorMsg.split('\n');
                notificationManager.error({
                    error: lines[0],
                    details: lines.slice(1).join('\n')
                });
            } else {
                notificationManager.error(errorMsg);
            }
        }
    }
    
    updatePlatformButton(platformId, newStatus, isLoading) {
        // Update platform status in map
        const platform = this.platformMap.get(platformId);
        if (platform) {
            const normalizedStatus = (newStatus === 'disconnected' || newStatus === 'idle') ? 'idle' : newStatus;
            platform.status = normalizedStatus;
        }
        
        // Update the platform item in minimalist list
        this.updatePlatformItem(platformId);
    }
    
    getPlatformIcon(platformName) {
        const icons = {
            'youtube': '▶',
            'twitch': '🎮',
            'facebook': '📘',
            'kick': '⚡',
            'custom': '📡'
        };
        return icons[platformName.toLowerCase()] || '📡';
    }
    
    getStatisticsHTML(platformId) {
        // This method is kept for backward compatibility but not used in minimalist view
        const stats = this.statistics.get(platformId);
        if (!stats || stats.status !== 'streaming') {
            return '';
        }
        
        const parts = [];
        if (stats.bitrate) {
            parts.push(`${Math.round(stats.bitrate)} kbps`);
        }
        if (stats.fps) {
            parts.push(`${stats.fps.toFixed(1)} fps`);
        }
        
        return parts.length > 0 ? parts.join(' • ') : '';
    }
    
    updatePlatformItem(platformId) {
        // Update a single platform item in the minimalist list
        const platform = this.platformMap.get(platformId);
        if (!platform) return;
        
        const isStreaming = platform.status === 'streaming';
        const stats = this.statistics.get(platformId);
        const displayName = platform.displayName || platform.name;
        const platformName = platform.displayName ? `(${platform.name})` : '';
        
        // Find the platform item in DOM
        const platformItem = document.querySelector(`.platform-item[data-platform-id="${platformId}"]`);
        if (!platformItem) {
            // Item doesn't exist, re-render all
            this.renderPlatforms();
            return;
        }
        
        // Determine which list it should be in
        const streamingList = document.getElementById('streaming-platforms-list');
        const idleList = document.getElementById('idle-platforms-list');
        const currentList = platformItem.closest('.platforms-group-list');
        
        // Build new item HTML
        const bitrate = stats?.bitrate ? Math.round(stats.bitrate) : null;
        const fps = stats?.fps ? stats.fps.toFixed(1) : null;
        const platformIcon = this.getPlatformIcon(platform.name);
        const streamingClass = isStreaming ? 'streaming' : '';
        
        const newItemHTML = `
            <div class="platform-item ${streamingClass}" data-platform-id="${platformId}" data-platform-name="${platform.name}">
                <label class="platform-toggle-switch">
                    <input type="checkbox" class="platform-toggle-input" data-platform-id="${platformId}" ${isStreaming ? 'checked' : ''} ${!platform.enabled ? 'disabled' : ''}>
                    <span class="platform-toggle-slider"></span>
                </label>
                <div class="platform-item-icon ${platform.name}">${platformIcon}</div>
                <div class="platform-item-info">
                    <span class="platform-item-name">${displayName}</span>
                    ${platformName ? `<span class="platform-item-type">${platformName}</span>` : ''}
                </div>
                ${isStreaming && (bitrate || fps) ? `
                    <div class="platform-item-stats">
                        ${bitrate ? `<div class="platform-item-stat-item">
                            <span class="platform-item-stat-label">Bitrate:</span>
                            <span class="platform-item-stat-value">${bitrate} kbps</span>
                        </div>` : ''}
                        ${fps ? `<div class="platform-item-stat-item">
                            <span class="platform-item-stat-label">FPS:</span>
                            <span class="platform-item-stat-value">${fps}</span>
                        </div>` : ''}
                    </div>
                ` : ''}
                <div class="platform-item-actions">
                    <button class="btn-icon tooltip platform-edit-btn" data-platform-id="${platformId}" data-tooltip="Edit Platform" title="Edit">✏️</button>
                    <button class="btn-icon tooltip platform-delete-btn" data-platform-id="${platformId}" data-tooltip="Delete Platform" title="Delete">🗑️</button>
                </div>
            </div>
        `;
        
        // Check if we need to move the item to a different list
        const targetList = isStreaming ? streamingList : idleList;
        
        if (currentList !== targetList) {
            // Move to different list
            platformItem.remove();
            if (targetList) {
                targetList.insertAdjacentHTML('beforeend', newItemHTML);
            }
        } else {
            // Update in place
            platformItem.outerHTML = newItemHTML;
        }
        
        // Update empty states after a short delay to ensure DOM is updated
        setTimeout(() => {
            if (streamingList) {
                const streamingItems = streamingList.querySelectorAll('.platform-item');
                if (streamingItems.length === 0) {
                    streamingList.innerHTML = '<div class="platforms-group-empty">No platforms streaming</div>';
                }
            }
            
            if (idleList) {
                const idleItems = idleList.querySelectorAll('.platform-item');
                if (idleItems.length === 0) {
                    idleList.innerHTML = '<div class="platforms-group-empty">All platforms are idle</div>';
                }
            }
        }, 50);
    }
    
    updateStatistics(statisticsArray) {
        // statisticsArray is an array of StreamStatistics objects
        if (!Array.isArray(statisticsArray)) {
            return;
        }
        
        // Add to update queue (throttling for efficient DOM updates)
        for (const stats of statisticsArray) {
            const platformId = stats.platformId;
            if (!platformId) {
                continue;
            }
            
            // Update statistics map immediately
            this.statistics.set(platformId, stats);
            
            // Add to update queue for throttled DOM update
            this.updateQueue.set(platformId, stats);
        }
        
        // Throttle DOM updates (200ms = max 5 updates per second)
        if (!this.updateTimer) {
            this.updateTimer = setTimeout(() => {
                // Process all queued updates
                for (const [platformId, stats] of this.updateQueue) {
                    // Update platform card statistics display
                    this.updatePlatformStatistics(platformId, stats);
                    
                    // Update platform status if it changed (use Map for O(1) lookup)
                    if (stats.status) {
                        const platform = this.platformMap.get(platformId);
                        if (platform && platform.status !== stats.status) {
                            platform.status = stats.status;
                            this.updatePlatformButton(platformId, stats.status, false);
                        }
                    }
                }
                
                // Clear queue and timer
                this.updateQueue.clear();
                this.updateTimer = null;
            }, 200); // 200ms throttle
            
            // Track timeout for cleanup (memory leak prevention)
            if (this.timeouts) {
                this.timeouts.push(this.updateTimer);
            }
        }
    }
    
    /**
     * Cleanup method (memory leak prevention - optimization)
     */
    cleanup() {
        // Clear all timeouts
        if (this.timeouts) {
            for (const timeout of this.timeouts) {
                clearTimeout(timeout);
            }
            this.timeouts = [];
        }
        
        // Clear all intervals
        if (this.intervals) {
            for (const interval of this.intervals) {
                clearInterval(interval);
            }
            this.intervals = [];
        }
        
        // Remove all event listeners
        if (this.eventListeners) {
            for (const { element, event, handler } of this.eventListeners) {
                try {
                    element.removeEventListener(event, handler);
                } catch (error) {
                    console.warn('Error removing event listener:', error);
                }
            }
            this.eventListeners = [];
        }
        
        // Clear caches
        this.domCache.clear();
        this.platformMap.clear();
        this.statistics.clear();
        this.updateQueue.clear();
        
        // Clear update timer
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    updatePlatformStatistics(platformId, stats) {
        // Update statistics if provided, otherwise use cached statistics
        if (stats !== null && stats !== undefined) {
            // If stats is explicitly null, clear statistics
            if (stats === null) {
                this.statistics.delete(platformId);
            } else {
                // Update or set statistics
                this.statistics.set(platformId, stats);
            }
        }
        
        // Update the platform item in minimalist list (includes stats)
        this.updatePlatformItem(platformId);
    }
    
    /**
     * Get platform card DOM elements (optimization - DOM query caching)
     */
    getPlatformCard(platformId) {
        // Check cache first
        if (this.domCache.has(platformId)) {
            const cached = this.domCache.get(platformId);
            // Verify elements still exist
            if (cached.card && document.contains(cached.card)) {
                return cached;
            }
        }
        
        // Cache miss - query DOM
        const card = document.querySelector(`[data-platform-id="${platformId}"]`);
        if (!card) {
            return null;
        }
        
        const cached = {
            card: card,
            button: card.querySelector('.platform-connect-btn'),
            status: card.querySelector('.platform-card-status'),
            statistics: document.getElementById(`platform-statistics-${platformId}`),
            editBtn: card.querySelector('.platform-edit-btn'),
            deleteBtn: card.querySelector('.platform-delete-btn'),
        };
        
        this.domCache.set(platformId, cached);
        return cached;
    }
    
    async deletePlatform(platformId) {
        // Use Map for O(1) lookup (optimization)
        const platform = this.platformMap.get(platformId);
        const platformName = platform?.displayName || platform?.name || platformId;
        if (!confirm(`Are you sure you want to delete ${platformName}?`)) {
            return;
        }
        
        try {
            const config = await api.get('/config?includeKeys=true');
            
            // Find the platform to delete - prioritize ID match, then name match
            const platformToDelete = config.streamManager.platforms.find(p => {
                // If platform has an ID, match by ID
                if (p.id) {
                    return p.id === platformId;
                }
                // Otherwise, match by name (for backward compatibility)
                return p.name === platformId;
            });
            
            if (!platformToDelete) {
                notificationManager.error('Platform not found');
                return;
            }
            
            // Delete only the specific platform by ID if it exists, otherwise by exact match
            if (platformToDelete.id) {
                // Delete by ID (most specific)
                config.streamManager.platforms = config.streamManager.platforms.filter(
                    p => p.id !== platformToDelete.id
                );
            } else {
                // Delete by name (only if no ID exists - backward compatibility)
                // But we need to be careful - if multiple platforms have same name, delete only the one we found
                const indexToDelete = config.streamManager.platforms.findIndex(p => p === platformToDelete);
                if (indexToDelete !== -1) {
                    config.streamManager.platforms.splice(indexToDelete, 1);
                }
            }
            
            await api.post('/config', config);
            notificationManager.success(`Platform deleted`);
            this.loadPlatforms();
        } catch (error) {
            const errorMsg = error.response?.data || error.message;
            notificationManager.error(errorMsg);
        }
    }
    
    async editPlatform(platformId) {
        try {
            // Load full config to get actual platform data
            const config = await api.get('/config?includeKeys=true');
            const fullPlatform = config.streamManager.platforms.find(p => (p.id || p.name) === platformId);
            
            if (!fullPlatform) {
                notificationManager.error('Platform not found in configuration');
                return;
            }
            
            // Store platform ID in hidden input field for reliable access
            const platformIdInput = document.getElementById('platform-id');
            const actualPlatformId = fullPlatform.id || platformId;
            
            if (platformIdInput) {
                platformIdInput.value = actualPlatformId;
            }
            
            // Store original platform ID and name for update logic
            // Use the actual ID from the platform, not the platformId parameter (which might be name)
            this.editingPlatform = { 
                id: actualPlatformId, // Use platform's ID if exists, otherwise use platformId
                name: fullPlatform.name 
            };
            
            // Fill form with platform data BEFORE opening modal
            const nameInput = document.getElementById('platform-name');
            const displayNameInput = document.getElementById('platform-display-name');
            const rtmpUrlInput = document.getElementById('platform-rtmp-url');
            const streamKeyInput = document.getElementById('platform-stream-key');
            const enabledInput = document.getElementById('platform-enabled');
            
            if (nameInput) {
                nameInput.value = fullPlatform.name || '';
                nameInput.disabled = true; // Platform name cannot be changed when editing
            }
            if (displayNameInput) displayNameInput.value = fullPlatform.displayName || '';
            if (rtmpUrlInput) rtmpUrlInput.value = fullPlatform.rtmpUrl || '';
            if (streamKeyInput) streamKeyInput.value = fullPlatform.streamKey || '';
            if (enabledInput) enabledInput.checked = fullPlatform.enabled !== false;
            
            // Open modal after form is filled (this won't reset editingPlatform because it's already set)
            this.openPlatformModal();
        } catch (error) {
            console.error('Error loading platform config:', error);
            notificationManager.error('Failed to load platform configuration');
        }
    }
    
    openPlatformModal() {
        const modal = document.getElementById('platform-modal');
        const modalTitle = document.getElementById('modal-title');
        
        if (modal) {
            modal.classList.add('active');
        }
        if (modalTitle) {
            modalTitle.textContent = this.editingPlatform ? 'Edit Platform' : 'Add Platform';
        }
        // Don't reset editingPlatform here - it should be preserved for savePlatform
    }
}

const platformManager = new PlatformManager();

// Config Manager
class ConfigManager {
    async loadConfig() {
        try {
            const config = await api.get('/config?includeKeys=true');
            // Update UI with config values
            document.getElementById('rtmp-host').value = config.streamManager.rtmpServer.host || '0.0.0.0';
            document.getElementById('rtmp-port').value = config.streamManager.rtmpServer.port || 1935;
            document.getElementById('rtmp-app').value = config.streamManager.rtmpServer.appName || 'live';
            document.getElementById('rtmp-key').value = config.streamManager.rtmpServer.streamKey || 'obs';
            
            // Update RTMP URL display
            this.updateRTMPURL();
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }
    
    async autoDetectSettings() {
        try {
            // Get current stream status to detect actual OBS settings
            const status = await api.get('/stream/status');
            
            if (!status.actualStreamPath) {
                notificationManager.warning('OBS stream not detected. Please start streaming from OBS first, then click Auto-Detect.');
                return;
            }
            
            // Parse actual stream path (format: /appName/streamKey)
            // Example: /liveobs/obs -> appName: liveobs, streamKey: obs
            const pathParts = status.actualStreamPath.split('/').filter(part => part.length > 0);
            
            if (pathParts.length < 2) {
                notificationManager.warning('Could not parse OBS stream path. Please check OBS settings.');
                return;
            }
            
            const detectedAppName = pathParts[0];
            const detectedStreamKey = pathParts[pathParts.length - 1];
            
            // Update UI with detected values
            document.getElementById('rtmp-app').value = detectedAppName;
            document.getElementById('rtmp-key').value = detectedStreamKey;
            
            // Update RTMP URL display
            this.updateRTMPURL();
            
            notificationManager.success(`Auto-detected settings: App Name: ${detectedAppName}, Stream Key: ${detectedStreamKey}`);
        } catch (error) {
            console.error('Error auto-detecting settings:', error);
            notificationManager.error('Failed to auto-detect settings. Make sure OBS is streaming.');
        }
    }
    
    async saveConfig() {
        try {
            const config = await api.get('/config?includeKeys=true');
            config.streamManager.rtmpServer.host = document.getElementById('rtmp-host').value;
            config.streamManager.rtmpServer.port = parseInt(document.getElementById('rtmp-port').value);
            config.streamManager.rtmpServer.appName = document.getElementById('rtmp-app').value;
            const newKey = document.getElementById('rtmp-key').value;
            // Only update key if it's not empty and not masked
            if (newKey && newKey !== '***') {
                config.streamManager.rtmpServer.streamKey = newKey;
            }
            
            await api.post('/config', config);
            notificationManager.success('Settings saved successfully');
            this.updateRTMPURL();
        } catch (error) {
            const errorMsg = error.response?.data || error.message;
            notificationManager.error(errorMsg);
        }
    }
    
    updateRTMPURL() {
        const host = document.getElementById('rtmp-host').value;
        const port = document.getElementById('rtmp-port').value;
        const app = document.getElementById('rtmp-app').value;
        const key = document.getElementById('rtmp-key').value;
        
        const rtmpUrl = `rtmp://${host}:${port}/${app}/${key}`;
        document.getElementById('rtmp-url').textContent = rtmpUrl;
        document.getElementById('stream-key').textContent = key;
    }
}

const configManager = new ConfigManager();

// Utility Functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notificationManager.success('Copied to clipboard');
    }).catch(err => {
        notificationManager.error('Failed to copy to clipboard');
    });
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function updateRTMPPlaceholder() {
    const platformName = document.getElementById('platform-name').value;
    const rtmpInput = document.getElementById('platform-rtmp-url');
    
    const placeholders = {
        'youtube': 'rtmp://a.rtmp.youtube.com/live2',
        'twitch': 'rtmp://live.twitch.tv/app/',
        'facebook': 'rtmps://live-api-s.facebook.com:443/rtmp/',
        'kick': 'rtmps://fa723fc1b171.global-contribute.live-video.net',
        'custom': 'rtmp://...'
    };
    
    if (placeholders[platformName]) {
        rtmpInput.placeholder = placeholders[platformName];
        if (platformName !== 'custom') {
            rtmpInput.value = placeholders[platformName];
        }
    }
}

function openPlatformModal() {
    // Reset editing state only if not already editing
    // This function is called when "Add Platform" button is clicked
    // When editing, editPlatform() sets editingPlatform before calling openPlatformModal()
    if (!platformManager.editingPlatform) {
        platformManager.editingPlatform = null;
        
        // Reset form for new platform
        const form = document.getElementById('platform-form');
        const platformIdInput = document.getElementById('platform-id');
        const nameInput = document.getElementById('platform-name');
        const displayNameInput = document.getElementById('platform-display-name');
        const rtmpUrlInput = document.getElementById('platform-rtmp-url');
        const streamKeyInput = document.getElementById('platform-stream-key');
        
        if (form) form.reset();
        if (platformIdInput) platformIdInput.value = ''; // Clear platform ID for new platform
        if (nameInput) {
            nameInput.disabled = false;
            nameInput.value = '';
        }
        if (displayNameInput) displayNameInput.value = '';
        if (rtmpUrlInput) rtmpUrlInput.value = '';
        if (streamKeyInput) streamKeyInput.value = '';
    }
    
    platformManager.openPlatformModal();
}

function closePlatformModal() {
    const modal = document.getElementById('platform-modal');
    const form = document.getElementById('platform-form');
    const platformIdInput = document.getElementById('platform-id');
    const nameInput = document.getElementById('platform-name');
    
    if (modal) modal.classList.remove('active');
    // Don't reset editingPlatform here - it should be reset after successful save
    // But reset platform ID input when modal closes (unless we're about to save)
    if (form && !platformManager.editingPlatform) {
        form.reset();
        if (platformIdInput) platformIdInput.value = '';
    }
    if (nameInput && !platformManager.editingPlatform) {
        nameInput.disabled = false;
    }
}

async function savePlatform() {
    const nameInput = document.getElementById('platform-name');
    const rtmpUrlInput = document.getElementById('platform-rtmp-url');
    const streamKeyInput = document.getElementById('platform-stream-key');
    const platformIdInput = document.getElementById('platform-id');
    
    // Get platform ID from hidden input (more reliable than editingPlatform state)
    const platformId = platformIdInput?.value?.trim() || null;
    
    // Determine if we're editing based on platform ID presence
    const isEditing = platformId !== null && platformId !== '';
    
    // If editing, use original platform name (since name input is disabled)
    let name;
    if (isEditing && platformManager.editingPlatform) {
        name = platformManager.editingPlatform.name;
    } else {
        name = nameInput.value.trim();
    }
    
    const rtmpUrl = rtmpUrlInput.value.trim();
    const streamKey = streamKeyInput.value.trim();
    const displayName = document.getElementById('platform-display-name').value.trim();
    const enabled = document.getElementById('platform-enabled').checked;
    
    // Validation
    if (!name) {
        notificationManager.error('Platform name is required');
        nameInput?.focus();
        return;
    }
    
    if (!rtmpUrl) {
        notificationManager.error('RTMP URL is required');
        rtmpUrlInput.focus();
        return;
    }
    
    if (!streamKey) {
        notificationManager.error('Stream key is required');
        streamKeyInput.focus();
        return;
    }
    
    // Validate RTMP URL format
    if (!rtmpUrl.startsWith('rtmp://') && !rtmpUrl.startsWith('rtmps://')) {
        notificationManager.error('RTMP URL must start with rtmp:// or rtmps://');
        rtmpUrlInput.focus();
        return;
    }
    
    try {
        // Load config with keys for editing
        const config = await api.get('/config?includeKeys=true');
        
        // Find existing platform for editing using platform ID from hidden input
        let existingPlatform = null;
        if (isEditing && platformId) {
            // Find by ID (most specific and reliable)
            existingPlatform = config.streamManager.platforms.find(p => p.id === platformId);
            console.log('Save platform - isEditing:', isEditing, 'platformId:', platformId, 'found:', existingPlatform);
            
            // If not found by ID, this is an error - we should always have an ID when editing
            if (!existingPlatform) {
                console.error('Platform not found for editing - ID:', platformId);
                notificationManager.error('Platform not found in configuration. Please refresh and try again.');
                return;
            }
        } else {
            console.log('Save platform - Adding new platform, platformId:', platformId);
        }
        
        // Get actual stream key - if editing and new key is empty, preserve existing key
        let actualStreamKey = streamKey;
        if (isEditing && existingPlatform && !streamKey) {
            if (existingPlatform.streamKey) {
                actualStreamKey = existingPlatform.streamKey;
            }
        }
        
        if (!actualStreamKey) {
            notificationManager.error('Stream key is required');
            streamKeyInput.focus();
            return;
        }
        
        if (isEditing && existingPlatform) {
            // Update existing platform - find by ID
            const index = config.streamManager.platforms.findIndex(p => p.id === platformId);
            
            console.log('Editing platform - platformId:', platformId, 'existingPlatform:', existingPlatform, 'index:', index);
            
            if (index !== -1) {
                // Platform found - update it directly
                // Preserve ID and update other fields
                config.streamManager.platforms[index] = {
                    ...existingPlatform, // Preserve all existing fields
                    id: platformId, // Ensure ID is preserved
                    name, // Update name (should be same)
                    displayName: displayName || undefined,
                    rtmpUrl,
                    streamKey: actualStreamKey,
                    enabled,
                    // Preserve metadata if it exists
                    metadata: existingPlatform.metadata || {}
                };
                console.log('Platform updated at index:', index, 'updated platform:', config.streamManager.platforms[index]);
            } else {
                // Platform not found - this is an error condition
                console.error('Platform not found in config by ID:', platformId);
                notificationManager.error('Platform not found in configuration. Please refresh and try again.');
                return;
            }
        } else {
            // Add new platform - generate unique ID
            const newPlatformId = `platform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newPlatform = {
                id: newPlatformId,
                name,
                displayName: displayName || undefined,
                rtmpUrl,
                streamKey: actualStreamKey,
                enabled,
                metadata: {}
            };
            config.streamManager.platforms.push(newPlatform);
            console.log('New platform added:', name, 'ID:', newPlatformId);
        }
        
        await api.post('/config', config);
        notificationManager.success(`Platform ${name} ${isEditing ? 'updated' : 'added'} successfully`);
        
        // Clear editing state and platform ID BEFORE closing modal
        platformManager.editingPlatform = null;
        if (platformIdInput) platformIdInput.value = '';
        
        closePlatformModal();
        await platformManager.loadPlatforms();
    } catch (error) {
        console.error('Error saving platform:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Failed to save platform';
        notificationManager.error(errorMsg);
    }
}

// Log Viewer
class LogViewer {
    constructor() {
        this.logs = [];
        this.maxLogs = 100; // Optimized: reduced from 1000 to 100 (90% memory reduction)
        this.container = null;
    }
    
    init() {
        // Initialize container after DOM is loaded
        this.container = document.getElementById('logs-container');
    }
    
    addLog(logEntry) {
        // Add log to array
        this.logs.push(logEntry);
        
        // Keep only last maxLogs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Render logs
        this.renderLogs();
    }
    
    clearLogs() {
        this.logs = [];
        this.renderLogs();
    }
    
    renderLogs() {
        if (!this.container) {
            return;
        }
        
        if (this.logs.length === 0) {
            this.container.innerHTML = '<div class="logs-empty"><p>No logs available</p></div>';
            return;
        }
        
        // Render last 100 logs
        const recentLogs = this.logs.slice(-100);
        this.container.innerHTML = recentLogs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const source = log.source || 'unknown';
            const platformId = log.platformId ? ` [${log.platformId}]` : '';
            
            return `
                <div class="log-entry log-${log.level}">
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-source">${source}${platformId}</span>
                    <span class="log-message">${this.escapeHtml(log.message)}</span>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        this.container.scrollTop = this.container.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const target = link.getAttribute('href').substring(1);
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(target).style.display = 'block';
    });
});

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        const streamController = new StreamController();
        const platformManager = new PlatformManager();
        const configManager = new ConfigManager();
        
        // Make platformManager available globally for StreamController
        window.platformManager = platformManager;
    
    // Initialize Log Viewer first (before WebSocket)
    window.LogViewer = new LogViewer();
    window.LogViewer.init();
    
    // Load initial data
    configManager.loadConfig();
    platformManager.loadPlatforms();
    streamController.updateStatus();
    
    // Initialize WebSocket client for real-time updates
    if (window.wsClient) {
        const wsClient = window.wsClient;
        
        // Connect WebSocket
        wsClient.connect();
        
        // Handle WebSocket events
        wsClient.on('connected', () => {
            console.log('[WebSocket] Connected to server');
        });
        
        wsClient.on('disconnected', () => {
            console.log('[WebSocket] Disconnected from server');
        });
        
        wsClient.on('status', (data) => {
            // Update stream status in real-time
            streamController.updateStatusFromWebSocket(data);
            
            // Update platform statuses if platforms data is available (optimization - real-time updates)
            if (data.platforms) {
                for (const [platformId, platformStatus] of Object.entries(data.platforms)) {
                    // Get platform from map or create placeholder if not found (optimization - handle new platforms)
                    let platform = platformManager.platformMap.get(platformId);
                    if (!platform) {
                        // Platform not in map - add it (for platforms added after page load)
                        platform = {
                            id: platformId,
                            name: platformStatus.platform || platformStatus.config?.name || platformId,
                            displayName: platformStatus.config?.displayName,
                            status: platformStatus.status || 'idle',
                        };
                        platformManager.platformMap.set(platformId, platform);
                    }
                    
                    // Update platform status
                    const newStatus = platformStatus.status || 'idle';
                    
                    // Check if platform was manually disconnected recently
                    // If so, ignore WebSocket updates for 'streaming' status (prevent revert)
                    if (platform._manuallyDisconnected && platform._disconnectTime) {
                        const timeSinceDisconnect = Date.now() - platform._disconnectTime;
                        // If manually disconnected, always respect the disconnect
                        // Only accept 'idle' or 'disconnected' status from backend
                        if (newStatus === 'streaming' || newStatus === 'connected') {
                            // Ignore streaming/connected status if manually disconnected
                            console.log(`[WebSocket] Ignoring '${newStatus}' status for ${platformId} (manually disconnected ${timeSinceDisconnect}ms ago)`);
                            return; // Skip this update
                        }
                        // If status changed to 'idle' or 'disconnected', clear manual disconnect flag
                        if (newStatus === 'idle' || newStatus === 'disconnected') {
                            delete platform._manuallyDisconnected;
                            delete platform._disconnectTime;
                        }
                    }
                    
                    // Update platform status only if it changed
                    const previousStatus = platform.status;
                    if (platform.status !== newStatus) {
                        platform.status = newStatus;
                    }
                    
                    // Always update button to reflect current backend status (optimization - real-time updates)
                    // But only if not manually disconnected (or manual disconnect was cleared)
                    if (!platform._manuallyDisconnected || (newStatus === 'idle' || newStatus === 'disconnected')) {
                        platformManager.updatePlatformButton(platformId, newStatus, false);
                        // Clear DOM cache to ensure fresh button reference
                        platformManager.domCache.delete(platformId);
                    } else {
                        // If manually disconnected, ensure UI shows idle state
                        platformManager.updatePlatformButton(platformId, 'idle', false);
                    }
                }
            }
        });
        
        wsClient.on('statistics', (data) => {
            // Update platform statistics in real-time
            platformManager.updateStatistics(data);
        });
        
        wsClient.on('log', (logEntry) => {
            // Handle log entries for log viewer
            if (window.LogViewer) {
                window.LogViewer.addLog(logEntry);
            } else {
                console.log('[Log]', logEntry);
            }
        });
        
        // Heartbeat ping every 60 seconds (optimized for network usage)
        const pingInterval = setInterval(() => {
            if (wsClient.isConnected) {
                wsClient.ping();
            }
        }, 60000);
        // Track interval for cleanup (memory leak prevention)
        if (platformManager.intervals) {
            platformManager.intervals.push(pingInterval);
        }
    }
    
    // Fallback: Update status every 5 seconds if WebSocket is not available
    const statusInterval = setInterval(() => {
        if (!window.wsClient || !window.wsClient.isConnected) {
            streamController.updateStatus();
        }
    }, 5000);
    // Track interval for cleanup (memory leak prevention)
    if (platformManager.intervals) {
        platformManager.intervals.push(statusInterval);
    }
    
    // Cleanup on page unload (memory leak prevention - optimization)
    window.addEventListener('beforeunload', () => {
        platformManager.cleanup();
    });
    
    // Event listeners
    document.getElementById('add-platform-btn').addEventListener('click', openPlatformModal);
    document.getElementById('save-settings-btn').addEventListener('click', () => configManager.saveConfig());
    document.getElementById('auto-detect-settings-btn').addEventListener('click', () => configManager.autoDetectSettings());
    
    // Platform form submit handler
    document.getElementById('platform-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePlatform();
    });
    
    // Platform modal handlers
    document.getElementById('close-platform-modal-btn')?.addEventListener('click', () => {
        platformManager.editingPlatform = null;
        closePlatformModal();
    });
    document.getElementById('cancel-platform-modal-btn')?.addEventListener('click', () => {
        platformManager.editingPlatform = null;
        closePlatformModal();
    });
    
    // Debounce helper function (optimization - reduces CPU usage for input events)
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Platform name change handler (with debouncing - optimization)
    const debouncedUpdateRTMPPlaceholder = debounce(updateRTMPPlaceholder, 300);
    const platformNameElement = document.getElementById('platform-name');
    if (platformNameElement) {
        const changeHandler = () => debouncedUpdateRTMPPlaceholder();
        platformNameElement.addEventListener('change', changeHandler);
        // Track listener for cleanup (memory leak prevention)
        if (platformManager.eventListeners) {
            platformManager.eventListeners.push({
                element: platformNameElement,
                event: 'change',
                handler: changeHandler
            });
        }
    }
    
    // Toggle password visibility (use event delegation for dynamically added elements)
    const togglePasswordHandler = (e) => {
        if (e.target.classList.contains('toggle-password-btn') || e.target.closest('.toggle-password-btn')) {
            const btn = e.target.classList.contains('toggle-password-btn') ? e.target : e.target.closest('.toggle-password-btn');
            const targetId = btn.getAttribute('data-target');
            if (targetId) {
                togglePassword(targetId);
            }
        }
    };
    document.addEventListener('click', togglePasswordHandler);
    // Track listener for cleanup (memory leak prevention)
    if (platformManager.eventListeners) {
        platformManager.eventListeners.push({
            element: document,
            event: 'click',
            handler: togglePasswordHandler
        });
    }
    
    // Copy to clipboard handlers (use event delegation)
    const copyToClipboardHandler = (e) => {
        if (e.target.classList.contains('copy-rtmp-url-btn') || e.target.closest('.copy-rtmp-url-btn')) {
            const btn = e.target.classList.contains('copy-rtmp-url-btn') ? e.target : e.target.closest('.copy-rtmp-url-btn');
            const targetId = btn.getAttribute('data-copy-target');
            if (targetId) {
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    copyToClipboard(targetElement.textContent);
                }
            }
        } else if (e.target.classList.contains('copy-stream-key-btn') || e.target.closest('.copy-stream-key-btn')) {
            const btn = e.target.classList.contains('copy-stream-key-btn') ? e.target : e.target.closest('.copy-stream-key-btn');
            const targetId = btn.getAttribute('data-copy-target');
            if (targetId) {
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    copyToClipboard(targetElement.textContent);
                }
            }
        }
    };
    document.addEventListener('click', copyToClipboardHandler);
    // Track listener for cleanup (memory leak prevention)
    if (platformManager.eventListeners) {
        platformManager.eventListeners.push({
            element: document,
            event: 'click',
            handler: copyToClipboardHandler
        });
    }
    
    // Platform item action handlers (event delegation for minimalist list)
    const platformsListElement = document.getElementById('platforms-list');
    
    // Handle toggle switch change events
    const platformToggleChangeHandler = async (e) => {
        if (e.target.classList.contains('platform-toggle-input')) {
            const toggleInput = e.target;
            const platformItem = toggleInput.closest('.platform-item');
            if (!platformItem) return;
            
            const platformId = platformItem.getAttribute('data-platform-id') || platformItem.getAttribute('data-platform-name');
            if (!platformId) return;
            
            // Disable toggle during operation
            if (toggleInput.disabled) return;
            
            const isChecked = toggleInput.checked;
            
            if (isChecked) {
                // Connect/Start streaming
                await platformManager.connectPlatform(platformId);
            } else {
                // Disconnect/Stop streaming
                await platformManager.disconnectPlatform(platformId);
            }
        }
    };
    
    // Handle other platform item actions (edit, delete)
    const platformItemClickHandler = async (e) => {
        const platformItem = e.target.closest('.platform-item');
        if (!platformItem) return;
        
        const platformId = platformItem.getAttribute('data-platform-id') || platformItem.getAttribute('data-platform-name');
        if (!platformId) return;
        
        if (e.target.classList.contains('platform-edit-btn') || e.target.closest('.platform-edit-btn')) {
            platformManager.editPlatform(platformId);
        } else if (e.target.classList.contains('platform-delete-btn') || e.target.closest('.platform-delete-btn')) {
            platformManager.deletePlatform(platformId);
        }
    };
    
    if (platformsListElement) {
        // Use change event for toggle switches (more reliable than click)
        platformsListElement.addEventListener('change', platformToggleChangeHandler);
        platformsListElement.addEventListener('click', platformItemClickHandler);
        
        // Track listeners for cleanup (memory leak prevention)
        if (platformManager.eventListeners) {
            platformManager.eventListeners.push(
                {
                    element: platformsListElement,
                    event: 'change',
                    handler: platformToggleChangeHandler
                },
                {
                    element: platformsListElement,
                    event: 'click',
                    handler: platformItemClickHandler
                }
            );
        }
    }
    
    // Config inputs update RTMP URL (with debouncing - optimization)
    const debouncedUpdateRTMPURL = debounce(() => configManager.updateRTMPURL(), 300);
    ['rtmp-host', 'rtmp-port', 'rtmp-app', 'rtmp-key'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const inputHandler = () => debouncedUpdateRTMPURL();
            element.addEventListener('input', inputHandler);
            // Track listener for cleanup (memory leak prevention)
            if (platformManager.eventListeners) {
                platformManager.eventListeners.push({
                    element: element,
                    event: 'input',
                    handler: inputHandler
                });
            }
        }
    });
    
    // Clear logs button (LogViewer is already initialized above)
    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
        window.LogViewer.clearLogs();
    });
    
    // Show stream section by default
    document.getElementById('stream').style.display = 'block';
});


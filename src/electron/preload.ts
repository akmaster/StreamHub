/**
 * Electron Preload Script
 * Provides secure communication between main and renderer processes
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get server URL
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  
  // Get server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // Intro complete notification
  introComplete: () => ipcRenderer.invoke('intro-complete'),
  
  // Platform information
  platform: process.platform,
  versions: process.versions,
});


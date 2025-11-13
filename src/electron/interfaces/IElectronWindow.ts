/**
 * Electron Window Interface - Thought Capsule Portal
 * 
 * Bu interface, Electron pencerelerinin dış dünyayla konuşma noktasını (portal) tanımlar.
 * Magnetic Fields prensibine göre: Public API (çekim bölgesi)
 */

import { BrowserWindow } from 'electron';

export interface IElectronWindow {
  readonly windowId: string;
  readonly windowInstance: BrowserWindow | null;
  
  create(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  close(): Promise<void>;
  focus(): Promise<void>;
  isVisible(): boolean;
  loadURL(url: string): Promise<void>;
  getWindowStatus(): Promise<WindowStatus>;
  deactivate(): Promise<void>;
  destroy(): Promise<void>;
}

export interface WindowStatus {
  id: string;
  visible: boolean;
  focused: boolean;
  url?: string;
  bounds?: Electron.Rectangle;
}


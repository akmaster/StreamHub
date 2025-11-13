/**
 * Electron Application Interface - Thought Capsule Core
 * 
 * Bu interface, Electron uygulamasının öz kimliğini (core) tanımlar.
 * Full Modular Architecture prensibine göre: Tam bağımsız modül
 */

import { IModule } from '../../core/interfaces/IModule.js';
import { ServerInfo } from '../server.js';

export interface IElectronApp extends IModule {
  readonly isPackaged: boolean;
  readonly userDataPath: string;
  
  initializeApp(): Promise<void>;
  startServer(): Promise<ServerInfo>;
  stopServer(serverInfo: ServerInfo): Promise<void>;
  getServerInfo(): ServerInfo | null;
  quit(): Promise<void>;
}


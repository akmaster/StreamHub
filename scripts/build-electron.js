/**
 * Electron Build Script
 * Alternative build method using Electron
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const electronDir = join(process.cwd(), 'electron');
const buildDir = join(process.cwd(), 'dist');

console.log('Building Electron application...');

try {
  // Create electron directory if it doesn't exist
  if (!existsSync(electronDir)) {
    mkdirSync(electronDir, { recursive: true });
  }

  // Create main.js for Electron
  const electronMain = `const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Start the Node.js server
  const serverPath = path.join(__dirname, '..', 'dist', 'main.js');
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  // Wait for server to start, then load the UI
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8000');
  }, 3000);

  mainWindow.on('closed', () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
`;

  writeFileSync(join(electronDir, 'main.js'), electronMain);

  // Create package.json for Electron
  const electronPackage = {
    name: 'obs-multi-platform-streaming',
    version: '1.0.0',
    main: 'main.js',
    scripts: {
      start: 'electron .'
    },
    dependencies: {
      electron: '^28.0.0'
    }
  };

  writeFileSync(join(electronDir, 'package.json'), JSON.stringify(electronPackage, null, 2));

  console.log('✅ Electron application structure created!');
  console.log('Run "npm install" in electron directory, then "npm start"');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}


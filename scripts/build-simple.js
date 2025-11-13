/**
 * Simple Build Script
 * Creates a simple executable wrapper using node-launcher
 * This is the most reliable method for Node.js applications
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Recursively copy directory
 */
function copyDirectory(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const outputDir = join(process.cwd(), 'build');
const distDir = join(process.cwd(), 'dist');

console.log('Building simple executable package...');

try {
  // Create build directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Check if dist exists
  if (!existsSync(distDir)) {
    console.error('Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Copy dist files to build
  console.log('Copying files to build directory...');
  execSync(`xcopy /E /I /Y "${distDir}\\*" "${outputDir}\\dist\\"`, { stdio: 'inherit' });

  // Copy frontend files
  const frontendSrc = join(process.cwd(), 'dist', 'ui', 'frontend');
  const frontendDest = join(outputDir, 'dist', 'ui', 'frontend');
  if (existsSync(frontendSrc)) {
    execSync(`xcopy /E /I /Y "${frontendSrc}\\*" "${frontendDest}\\"`, { stdio: 'inherit' });
  }

  // Copy config.yaml if exists
  const configSrc = join(process.cwd(), 'config.yaml');
  const configDest = join(outputDir, 'config.yaml');
  if (existsSync(configSrc)) {
    copyFileSync(configSrc, configDest);
  } else {
    // Create default config
    const defaultConfig = `version: 1.0.0
streamManager:
  obs:
    host: localhost
    port: 4455
    password: null
  rtmpServer:
    host: 0.0.0.0
    port: 1935
    appName: live
    streamKey: obs
    enabled: true
  autoReconnect: true
  reconnectDelay: 5
  maxReconnectAttempts: 10
  platforms: []
ui:
  host: 0.0.0.0
  port: 8000
  debug: false
`;
    writeFileSync(configDest, defaultConfig);
  }

  // Create batch file launcher
  const launcherBat = `@echo off
cd /d "%~dp0"
node dist\\main.js
pause
`;
  writeFileSync(join(outputDir, 'start.bat'), launcherBat);

  // Create PowerShell launcher
  const launcherPs1 = `# OBS Multi-Platform Streaming Launcher
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
node dist\\main.js
`;
  writeFileSync(join(outputDir, 'start.ps1'), launcherPs1);

  // Create README
  const readme = `# OBS Multi-Platform Streaming

## Kurulum

1. Node.js 18.0.0 veya üzeri yüklü olmalıdır
2. Bu klasördeki tüm dosyaları koruyun
3. start.bat veya start.ps1 dosyasını çalıştırın

## Kullanım

- Windows: start.bat dosyasına çift tıklayın
- PowerShell: .\\start.ps1 komutunu çalıştırın
- Komut satırı: node dist\\main.js

## Yapılandırma

config.yaml dosyasını düzenleyerek yapılandırma yapabilirsiniz.

## Web Arayüzü

Uygulama başladıktan sonra tarayıcınızda http://localhost:8000 adresine gidin.
`;
  writeFileSync(join(outputDir, 'README.txt'), readme);

  console.log('✅ Simple package built successfully!');
  console.log(`Output directory: ${outputDir}`);
  console.log('');
  console.log('To run:');
  console.log('  Windows: Double-click start.bat');
  console.log('  PowerShell: .\\start.ps1');
  console.log('  Command line: node dist\\main.js');
  console.log('');
  console.log('Note: Node.js 18.0.0+ must be installed on the target system.');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}


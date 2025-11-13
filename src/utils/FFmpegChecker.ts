/**
 * FFmpeg availability checker - Checks if FFmpeg is installed and accessible
 */

import { execSync } from 'child_process';
import { platform } from 'os';

export interface FFmpegCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Check if FFmpeg is available in system PATH
 */
export function checkFFmpeg(): FFmpegCheckResult {
  try {
    // Try to get FFmpeg version (this will fail if FFmpeg is not in PATH)
    const output = execSync('ffmpeg -version', { 
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Extract version from output (first line usually contains version info)
    const versionMatch = output.match(/ffmpeg version ([\d.]+)/i);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    // Try to get full path (Windows: where, Unix: which)
    let path: string | undefined;
    try {
      if (platform() === 'win32') {
        const pathOutput = execSync('where ffmpeg', { 
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        path = pathOutput.trim().split('\n')[0];
      } else {
        const pathOutput = execSync('which ffmpeg', { 
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        path = pathOutput.trim();
      }
    } catch {
      // Path detection failed, but FFmpeg is available
      path = 'ffmpeg (in PATH)';
    }
    
    return {
      available: true,
      version,
      path,
    };
  } catch (error: any) {
    let errorMessage = 'FFmpeg not found in system PATH';
    
    if (error.code === 'ENOENT') {
      errorMessage = 'FFmpeg is not installed or not in system PATH';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      available: false,
      error: errorMessage,
    };
  }
}

/**
 * Get FFmpeg installation instructions based on platform
 */
export function getFFmpegInstallInstructions(): string {
  const osPlatform = platform();
  
  if (osPlatform === 'win32') {
    return `FFmpeg Installation for Windows:
1. Download FFmpeg from: https://ffmpeg.org/download.html
2. Extract the ZIP file
3. Add FFmpeg bin folder to system PATH:
   - Open System Properties > Environment Variables
   - Edit PATH variable
   - Add path to FFmpeg bin folder (e.g., C:\\ffmpeg\\bin)
4. Restart the application
5. Verify installation: Open Command Prompt and type "ffmpeg -version"`;
  } else if (osPlatform === 'darwin') {
    return `FFmpeg Installation for macOS:
1. Install Homebrew (if not installed): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
2. Install FFmpeg: brew install ffmpeg
3. Verify installation: ffmpeg -version`;
  } else {
    return `FFmpeg Installation for Linux:
1. Ubuntu/Debian: sudo apt-get update && sudo apt-get install ffmpeg
2. Fedora: sudo dnf install ffmpeg
3. Arch: sudo pacman -S ffmpeg
4. Verify installation: ffmpeg -version`;
  }
}


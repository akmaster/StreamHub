/**
 * Electron-safe Logger Utility
 * Handles console output in Electron environment without EPIPE errors
 * 
 * EPIPE errors occur when trying to write to a closed pipe (normal in Electron)
 * This utility prevents these errors from crashing the application
 */

/**
 * Check if running in Electron
 */
function isElectron(): boolean {
  return typeof process !== 'undefined' && 
         process.versions && 
         (process.versions as any).electron !== undefined;
}

/**
 * Setup Electron-safe console handlers
 * This prevents EPIPE errors from crashing the application
 * 
 * EPIPE errors occur when:
 * - Console output is redirected to a closed pipe
 * - Electron's stdout/stderr is not available
 * - Process is detached or running in background
 * 
 * This function:
 * 1. Adds error handlers to stdout/stderr to ignore EPIPE errors
 * 2. Wraps console methods to catch EPIPE errors gracefully
 */
export function setupElectronConsole(): void {
  if (!isElectron()) {
    return;
  }

  // Handle stdout errors (silently ignore EPIPE errors)
  if (process.stdout) {
    process.stdout.on('error', (error: NodeJS.ErrnoException) => {
      // Ignore EPIPE and EOF errors (pipe is closed, normal in Electron)
      if (error.code === 'EPIPE' || error.code === 'EOF') {
        return;
      }
      // For other errors, we could log them, but in Electron it's usually safe to ignore
      // as they're often related to console output redirection
    });
  }

  // Handle stderr errors (silently ignore EPIPE errors)
  if (process.stderr) {
    process.stderr.on('error', (error: NodeJS.ErrnoException) => {
      // Ignore EPIPE and EOF errors (pipe is closed, normal in Electron)
      if (error.code === 'EPIPE' || error.code === 'EOF') {
        return;
      }
      // For other errors, we could log them, but in Electron it's usually safe to ignore
    });
  }

  // Wrap console methods to handle EPIPE errors gracefully
  // This catches EPIPE errors that might occur during console.log/error/warn calls
  const originalConsoleLog = console.log.bind(console);
  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleInfo = console.info?.bind(console) || console.log.bind(console);

  console.log = (...args: any[]) => {
    try {
      originalConsoleLog(...args);
    } catch (error: any) {
      // Ignore EPIPE and EOF errors (normal in Electron)
      if (error && (error.code === 'EPIPE' || error.code === 'EOF')) {
        return;
      }
      // For other errors, silently ignore (don't cause more errors)
    }
  };

  console.error = (...args: any[]) => {
    try {
      originalConsoleError(...args);
    } catch (error: any) {
      // Ignore EPIPE and EOF errors (normal in Electron)
      if (error && (error.code === 'EPIPE' || error.code === 'EOF')) {
        return;
      }
      // For other errors, silently ignore
    }
  };

  console.warn = (...args: any[]) => {
    try {
      originalConsoleWarn(...args);
    } catch (error: any) {
      // Ignore EPIPE and EOF errors (normal in Electron)
      if (error && (error.code === 'EPIPE' || error.code === 'EOF')) {
        return;
      }
      // For other errors, silently ignore
    }
  };

  if (console.info) {
    console.info = (...args: any[]) => {
      try {
        originalConsoleInfo(...args);
      } catch (error: any) {
        // Ignore EPIPE and EOF errors (normal in Electron)
        if (error && (error.code === 'EPIPE' || error.code === 'EOF')) {
          return;
        }
        // For other errors, silently ignore
      }
    };
  }
}

/**
 * Safe console.log that handles EPIPE errors in Electron
 * Note: setupElectronConsole() wraps console methods, so this is optional
 * but can be used for additional safety
 */
export function safeLog(...args: any[]): void {
  console.log(...args);
}

/**
 * Safe console.error that handles EPIPE errors in Electron
 * Note: setupElectronConsole() wraps console methods, so this is optional
 * but can be used for additional safety
 */
export function safeError(...args: any[]): void {
  console.error(...args);
}

/**
 * Safe console.warn that handles EPIPE errors in Electron
 * Note: setupElectronConsole() wraps console methods, so this is optional
 * but can be used for additional safety
 */
export function safeWarn(...args: any[]): void {
  console.warn(...args);
}

/**
 * Port Checker Utility
 * Checks if a port is available before starting servers
 */

import { createServer, Server } from 'net';

export interface PortCheckResult {
  available: boolean;
  error?: string;
  port: number;
}

/**
 * Check if a port is available
 * @param port Port number to check
 * @param host Host address (default: '0.0.0.0')
 * @param timeout Timeout in milliseconds (default: 2000)
 * @returns Promise<PortCheckResult>
 */
export async function checkPort(
  port: number,
  host: string = '0.0.0.0',
  timeout: number = 2000
): Promise<PortCheckResult> {
  return new Promise<PortCheckResult>((resolve) => {
    const server: Server = createServer();

    server.listen(port, host, () => {
      // Port is available
      server.once('close', () => {
        resolve({
          available: true,
          port,
        });
      });
      server.close();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({
          available: false,
          port,
          error: `Port ${port} is already in use`,
        });
      } else {
        resolve({
          available: false,
          port,
          error: `Error checking port ${port}: ${err.message}`,
        });
      }
    });

    // Timeout
    setTimeout(() => {
      server.close();
      resolve({
        available: false,
        port,
        error: `Timeout checking port ${port}`,
      });
    }, timeout);
  });
}

/**
 * Check multiple ports
 * @param ports Array of port numbers to check
 * @param host Host address (default: '0.0.0.0')
 * @param timeout Timeout in milliseconds (default: 2000)
 * @returns Promise<PortCheckResult[]>
 */
export async function checkPorts(
  ports: number[],
  host: string = '0.0.0.0',
  timeout: number = 2000
): Promise<PortCheckResult[]> {
  const results = await Promise.all(
    ports.map((port) => checkPort(port, host, timeout))
  );
  return results;
}

/**
 * Find an available port in a range
 * @param startPort Starting port number
 * @param endPort Ending port number
 * @param host Host address (default: '0.0.0.0')
 * @param timeout Timeout in milliseconds (default: 2000)
 * @returns Promise<number | null> Available port number or null if none found
 */
export async function findAvailablePort(
  startPort: number,
  endPort: number,
  host: string = '0.0.0.0',
  timeout: number = 2000
): Promise<number | null> {
  for (let port = startPort; port <= endPort; port++) {
    const result = await checkPort(port, host, timeout);
    if (result.available) {
      return port;
    }
  }
  return null;
}


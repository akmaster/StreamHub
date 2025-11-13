/**
 * Web UI - Express uygulaması.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { ModuleRegistry } from '../core/registry/ModuleRegistry.js';
import { apiRouter } from './api.js';

// Get __dirname and __filename for ES modules and CommonJS
// Support for pkg (executable) - use process.pkg if available
// Support for CommonJS bundle (esbuild) - use __dirname directly
// In CommonJS bundles, __dirname is automatically available
// In ES modules, we use fileURLToPath(import.meta.url)
let __dirnameResolved: string;

// Check if we're in a CommonJS environment (bundled with esbuild)
// @ts-ignore - __dirname is available in CommonJS but not in ES modules
if (typeof __dirname !== 'undefined') {
  // CommonJS bundle - use __dirname directly
  // @ts-ignore
  __dirnameResolved = __dirname;
} else {
  // ES modules or pkg executable - determine __dirname
  if (typeof process !== 'undefined' && (process as any).pkg) {
    // Running as pkg executable - use process.cwd()
    __dirnameResolved = process.cwd();
  } else {
    // ES modules - use fileURLToPath
    try {
      const __filename = fileURLToPath(import.meta.url);
      __dirnameResolved = dirname(__filename);
    } catch (error) {
      // Fallback to process.cwd() if import.meta is not available
      __dirnameResolved = process.cwd();
    }
  }
}

export function createApp(registry: ModuleRegistry): Express {
  const app = express();

  // Middleware
  // HTTP response compression (optimization)
  app.use(compression({
    level: 6, // Compression level (0-9, 6 = balanced)
    threshold: 1024, // Only compress responses > 1KB
  }));
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));
  app.use(cors());
  app.use(express.json({ limit: '10mb' })); // Set limit (optimization)
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Set limit (optimization)

  // Rate limiting (security optimization)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  // API routes with rate limiting
  app.use('/api', apiLimiter, apiRouter(registry));

  // Static files - support for Electron, pkg executable and normal execution
  // Electron packaged: files are in ASAR archive, __dirname automatically resolves ASAR
  // pkg executable: files are in snapshot (process.pkg.entrypoint directory)
  // Normal execution: files are in dist/ui/frontend
  let staticPath: string;
  let indexPath: string;
  
  // Check if running in Electron
  const isElectron = typeof process !== 'undefined' && 
    (process.versions && (process.versions as any).electron);
  
  if (isElectron) {
    // Electron app - __dirname automatically resolves ASAR in packaged apps
    // In packaged apps: __dirname points to app.asar/dist/ui
    // In development: __dirname points to dist/ui
    // __dirnameResolved is already at dist/ui level (where App.js is located)
    // So frontend is at dist/ui/frontend
    const basePath = __dirnameResolved;
    staticPath = join(basePath, 'frontend', 'static');
    indexPath = join(basePath, 'frontend', 'index.html');
    
    // If not found, try alternative paths (for edge cases)
    if (!existsSync(staticPath)) {
      const altPaths = [
        join(dirname(basePath), 'ui', 'frontend', 'static'),
        join(basePath, '..', 'ui', 'frontend', 'static'),
      ];
      
      for (const altPath of altPaths) {
        if (existsSync(altPath)) {
          staticPath = altPath;
          indexPath = join(dirname(altPath), 'index.html');
          break;
        }
      }
    }
  } else if (typeof process !== 'undefined' && (process as any).pkg) {
    // Running as pkg executable - use process.cwd() or executable directory
    // pkg assets are unpacked to process.cwd() or executable directory
    const exeDir = process.cwd();
    staticPath = join(exeDir, 'dist', 'ui', 'frontend', 'static');
    indexPath = join(exeDir, 'dist', 'ui', 'frontend', 'index.html');
    
    // Fallback: try current working directory
    if (!existsSync(staticPath)) {
      staticPath = join(exeDir, 'frontend', 'static');
      indexPath = join(exeDir, 'frontend', 'index.html');
    }
  } else {
    // Normal execution - try dist first, then src (for development)
    // Use resolved __dirname (handles both ES modules and CommonJS)
    const staticPathDist = join(__dirnameResolved, 'frontend', 'static');
    const staticPathSrc = join(process.cwd(), 'src', 'ui', 'frontend', 'static');
    staticPath = existsSync(staticPathDist) ? staticPathDist : staticPathSrc;
    
    const indexPathDist = join(__dirnameResolved, 'frontend', 'index.html');
    const indexPathSrc = join(process.cwd(), 'src', 'ui', 'frontend', 'index.html');
    indexPath = existsSync(indexPathDist) ? indexPathDist : indexPathSrc;
  }
  
  // Serve static files
  if (existsSync(staticPath)) {
    // Static file caching (optimization)
    app.use('/static', express.static(staticPath, {
      maxAge: '1d', // Cache for 1 day
      etag: true,
      lastModified: true,
      immutable: true, // Files in /static are immutable
    }));
  }

  // Setup route (for first-time setup screen)
  const setupPath = indexPath.replace('index.html', 'setup.html');
  app.get('/setup', (_req: Request, res: Response) => {
    if (existsSync(setupPath)) {
      res.sendFile(setupPath);
    } else {
      // Fallback to index.html if setup.html doesn't exist
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Frontend files not found. Looking for: ${setupPath}. Please run "npm run build" first.`);
      }
    }
  });

  // Intro route (for Electron intro screen)
  const introPath = indexPath.replace('index.html', 'intro.html');
  app.get('/intro', (_req: Request, res: Response) => {
    if (existsSync(introPath)) {
      res.sendFile(introPath);
    } else {
      // Fallback to index.html if intro.html doesn't exist
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Frontend files not found. Looking for: ${introPath}. Please run "npm run build" first.`);
      }
    }
  });

  // Frontend route
  app.get('*', (_req: Request, res: Response) => {
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`Frontend files not found. Looking for: ${indexPath}. Please run "npm run build" first.`);
    }
  });

  // Error handler (catches errors from asyncHandler in API routes)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Error already handled by API router error handler
    if (res.headersSent) {
      return _next(err);
    }
    
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  });

  return app;
}


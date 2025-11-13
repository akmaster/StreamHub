/**
 * Copy frontend files to dist directory
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const srcFrontend = join(projectRoot, 'src', 'ui', 'frontend');
const distFrontend = join(projectRoot, 'dist', 'ui', 'frontend');
const assetsDir = join(projectRoot, 'assets');
const distStatic = join(distFrontend, 'static');

try {
  // Create dist/ui/frontend directory if it doesn't exist
  if (!existsSync(distFrontend)) {
    mkdirSync(distFrontend, { recursive: true });
  }

  // Create static directory if it doesn't exist
  if (!existsSync(distStatic)) {
    mkdirSync(distStatic, { recursive: true });
  }

  // Copy frontend files
  if (existsSync(srcFrontend)) {
    cpSync(srcFrontend, distFrontend, { recursive: true });
    console.log('Frontend files copied to dist/ui/frontend');
  } else {
    console.warn('Source frontend directory not found:', srcFrontend);
  }

  // Copy icon files to static directory
  const iconFiles = ['icon.png', 'icon.ico', 'icon-256.png'];
  const staticIconDir = join(distStatic, 'icons');
  
  if (!existsSync(staticIconDir)) {
    mkdirSync(staticIconDir, { recursive: true });
  }

  for (const iconFile of iconFiles) {
    const srcIconPath = join(assetsDir, iconFile);
    const distIconPath = join(staticIconDir, iconFile);
    
    if (existsSync(srcIconPath)) {
      cpSync(srcIconPath, distIconPath, { recursive: false });
      console.log(`Icon copied: ${iconFile}`);
    }
  }

  console.log('✅ Frontend and icon files copied successfully');
} catch (error) {
  console.error('Error copying frontend files:', error);
  process.exit(1);
}


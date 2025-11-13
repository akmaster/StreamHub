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

try {
  // Create dist/ui/frontend directory if it doesn't exist
  if (!existsSync(distFrontend)) {
    mkdirSync(distFrontend, { recursive: true });
  }

  // Copy frontend files
  if (existsSync(srcFrontend)) {
    cpSync(srcFrontend, distFrontend, { recursive: true });
    console.log('Frontend files copied to dist/ui/frontend');
  } else {
    console.warn('Source frontend directory not found:', srcFrontend);
  }
} catch (error) {
  console.error('Error copying frontend files:', error);
  process.exit(1);
}


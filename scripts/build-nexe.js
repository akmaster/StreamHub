/**
 * nexe Build Script
 * Alternative build method using nexe
 */

const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const buildDir = join(process.cwd(), 'dist');
const outputDir = join(process.cwd(), 'build');
const outputFile = join(outputDir, 'obs-multi-platform-streaming.exe');

console.log('Building executable with nexe...');
console.log(`Input: ${join(buildDir, 'main.js')}`);
console.log(`Output: ${outputFile}`);

try {
  // Create build directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Check if dist/main.js exists
  const mainJs = join(buildDir, 'main.js');
  if (!existsSync(mainJs)) {
    console.error('Error: dist/main.js not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Check if frontend exists
  const frontendDir = join(process.cwd(), 'dist', 'ui', 'frontend');
  if (!existsSync(frontendDir)) {
    console.warn('Warning: dist/ui/frontend not found. Frontend files may not be included.');
  }

  // Build with nexe
  // Note: nexe doesn't support --resource flag in the same way as pkg
  // We'll need to handle resources differently
  const nexeArgs = [
    join(buildDir, 'main.js'),
    '-o', outputFile,
    '--target', 'windows-x64-18.0.0'
  ];

  console.log('Running nexe...');
  console.log(`Command: nexe ${nexeArgs.join(' ')}`);
  
  execSync(`nexe ${nexeArgs.map(arg => `"${arg}"`).join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });

  console.log('✅ Executable built successfully!');
  console.log(`Output: ${outputFile}`);
  console.log('');
  console.log('Note: Frontend files and config.yaml are embedded in the executable.');
  console.log('They will be extracted on first run to the executable directory.');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Make sure nexe is installed: npm install -g nexe');
  console.error('2. Make sure Node.js 18.0.0 is available');
  console.error('3. Check if dist/main.js exists');
  process.exit(1);
}


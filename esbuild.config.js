import esbuild from 'esbuild';

// Build configuration for CommonJS bundle (for pkg executable)
const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs', // CommonJS for pkg compatibility
  outfile: 'dist/bundle.cjs',
  external: [
    // Native modules that pkg handles
    'fluent-ffmpeg',
    'node-media-server',
    'ws',
    'express',
    'cors',
    'helmet',
    'compression',
    'express-rate-limit',
    'winston',
    'yaml',
    'zod',
    // Node.js built-ins (automatically external)
  ],
  sourcemap: false,
  minify: false, // Don't minify for better debugging
  keepNames: true,
  banner: {
    js: `
// Support for pkg executable
if (typeof process !== 'undefined' && process.pkg) {
  process.env.PKG_EXECUTABLE = 'true';
}
// Note: In CommonJS (.cjs), __dirname and __filename are automatically available
`,
  },
};

// Build function
async function build() {
  try {
    console.log('Building bundle with esbuild...');
    await esbuild.build(buildOptions);
    console.log('Bundle built successfully!');
    console.log('Output: dist/bundle.cjs');
    console.log('Next step: Run "npm run build:exe:bundle" to create executable');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

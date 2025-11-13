/**
 * nexe Configuration
 * Alternative to pkg for creating Node.js executables
 */

module.exports = {
  input: 'dist/main.js',
  output: 'build/obs-multi-platform-streaming.exe',
  target: 'windows-x64-18.0.0',
  resources: [
    'dist/ui/frontend/**/*',
    'config.yaml'
  ],
  ico: undefined, // Icon file path (optional)
  build: false, // Don't rebuild Node.js
  python: undefined, // Python path (if needed)
  flags: [
    '--expose-gc'
  ],
  // Node.js version
  nodeVersion: '18.0.0',
  // Node.js build options
  nodeTempDir: undefined,
  // Node.js configure options
  nodeConfigureArgs: [],
  // Node.js make options
  nodeMakeArgs: [],
};


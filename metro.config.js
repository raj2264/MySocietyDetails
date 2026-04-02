// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Support for polyfills
config.resolver.extraNodeModules = {
  'stream': require.resolve('stream-browserify'),
  'buffer': require.resolve('buffer'),
  'crypto': require.resolve('react-native-crypto'),
  'http': require.resolve('@tradle/react-native-http'),
  'https': require.resolve('https-browserify'),
  'zlib': require.resolve('browserify-zlib'),
  'net': path.resolve(__dirname, './lib/empty-module.js'),
  'tls': path.resolve(__dirname, './lib/empty-module.js'),
  'fs': path.resolve(__dirname, './lib/empty-module.js'),
  'ws': path.resolve(__dirname, './lib/ws-mock.js'),
  '@supabase/realtime-js': path.resolve(__dirname, './lib/realtime-mock.js')
};

// Block nested node modules from being bundled
config.resolver.blockList = [
  /\/node_modules\/.*\/node_modules\/crypto\/.*/,
  /\/node_modules\/.*\/node_modules\/http\/.*/,
  /\/node_modules\/.*\/node_modules\/zlib\/.*/,
  /\/node_modules\/.*\/node_modules\/net\/.*/,
  /\/node_modules\/ws\/.*/,
  /\/node_modules\/.*websocket.*/,
  /\/node_modules\/@supabase\/realtime-js\/.*/,
];

// Configure resolver to prioritize our mocks
config.resolver.sourceExts = ['js', 'jsx', 'ts', 'tsx', 'json'];
config.resolver.assetExts = ['mjs', 'db', 'ttf', 'woff', 'woff2', 'otf', 'png', 'jpg'];

module.exports = config; 
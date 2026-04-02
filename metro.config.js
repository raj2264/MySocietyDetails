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
  /\/node_modules\/@supabase\/realtime-js\/.*/,
];

// Add 'db' to asset extensions for SQLite support
if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}
// Ensure 'mjs' is in sourceExts (not assetExts) so .mjs JS modules compile correctly
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'mjs');
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

module.exports = config; 
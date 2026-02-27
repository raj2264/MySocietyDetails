const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add node polyfills
  config.resolve.alias = {
    ...config.resolve.alias,
    stream: 'stream-browserify',
    crypto: 'crypto-browserify',
    buffer: 'buffer',
    process: 'process/browser',
  };

  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
    path: require.resolve('path-browserify'),
    url: require.resolve('url'),
    util: require.resolve('util'),
    fs: false,
    net: false,
    tls: false,
    child_process: false,
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );

  return config;
}; 
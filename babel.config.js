module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            // Replace the ws module with our mock implementation
            'ws': './lib/ws-mock.js',
            // Replace Node.js modules with our mocks
            'net': './lib/empty-module.js',
            'tls': './lib/empty-module.js',
            'fs': './lib/empty-module.js',
            'zlib': './lib/empty-module.js',
            'http': './lib/empty-module.js',
            'https': './lib/empty-module.js',
            // Replace crypto with our mock
            'crypto': './lib/crypto-mock.js',
            // Replace Supabase realtime with mock
            '@supabase/realtime-js': './lib/realtime-mock.js',
            // Fix for the useLatestCallback issue
            'use-latest-callback': './lib/useLatestCallback.js'
          }
        }
      ]
    ]
  };
}; 
// cleanup.js - Script to remove cached files before rebuilding
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to clean
const dirsToClean = [
  '.expo',
  'node_modules/.cache'
];

console.log('Cleaning up cached files...');

// Delete directories
dirsToClean.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`Removing ${dir}...`);
    try {
      if (process.platform === 'win32') {
        // Windows needs special handling for some directories
        execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'inherit' });
      } else {
        execSync(`rm -rf "${dirPath}"`, { stdio: 'inherit' });
      }
      console.log(`Successfully removed ${dir}`);
    } catch (err) {
      console.error(`Error removing ${dir}:`, err.message);
    }
  } else {
    console.log(`${dir} does not exist - skipping`);
  }
});

console.log('Cleanup complete! Now start your app with "npx expo start --clear"'); 
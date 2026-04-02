#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get paths
const appJsonPath = path.join(__dirname, '../app.json');
const aboutJsPath = path.join(__dirname, '../app/about.js');

try {
  // Read app.json
  const appJsonContent = fs.readFileSync(appJsonPath, 'utf8');
  const appJson = JSON.parse(appJsonContent);

  // Increment Android version code
  const currentVersionCode = appJson.expo.android.versionCode || 6;
  const newVersionCode = currentVersionCode + 1;
  appJson.expo.android.versionCode = newVersionCode;

  // Get the app version
  const appVersion = appJson.expo.version;

  // Write updated app.json
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`✓ Updated Android versionCode: ${currentVersionCode} → ${newVersionCode}`);

  // Update about.js with new version
  let aboutJsContent = fs.readFileSync(aboutJsPath, 'utf8');
  aboutJsContent = aboutJsContent.replace(
    /Version \d+\.\d+\.\d+/,
    `Version ${appVersion} (Build ${newVersionCode})`
  );
  fs.writeFileSync(aboutJsPath, aboutJsContent);
  console.log(`✓ Updated About Us version display: ${appVersion} (Build ${newVersionCode})`);

} catch (error) {
  console.error('Error incrementing version:', error.message);
  process.exit(1);
}

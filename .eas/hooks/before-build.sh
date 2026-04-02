#!/bin/bash
# EAS Build hook to auto-increment version code before build

set -ei

# Run the version increment script
echo "📦 Auto-incrementing build version..."
node scripts/increment-version.js

echo "✓ Version increment complete!"

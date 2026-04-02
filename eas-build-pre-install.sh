#!/bin/bash
# EAS modifies package.json before running npm ci (adding native deps).
# This causes npm ci to fail because the lock file doesn't match.
# Fix: update the lock file to match the modified package.json before npm ci runs.
npm install --package-lock-only

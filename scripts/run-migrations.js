#!/usr/bin/env node

/**
 * Script to run database migrations for MySocietyApp
 * 
 * Usage: node run-migrations.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jjgsggmufkpadchkodab.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`Running migration: ${path.basename(filePath)}`);
  
  try {
    const { error } = await supabase.rpc('run_sql', { sql });
    
    if (error) {
      console.error(`Error running migration ${path.basename(filePath)}:`, error);
      return false;
    }
    
    console.log(`Successfully executed migration: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`Exception during migration ${path.basename(filePath)}:`, error);
    return false;
  }
}

async function main() {
  console.log('Starting database migrations...');
  
  const migrationsDir = path.join(__dirname, '..', 'supabase-sql', 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }
  
  // Get list of migration files and sort them alphabetically to ensure order
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('No migration files found');
    process.exit(0);
  }
  
  console.log(`Found ${migrationFiles.length} migration files`);
  
  // Run migrations sequentially
  let success = true;
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const result = await runMigration(filePath);
    
    if (!result) {
      success = false;
      console.error(`Migration ${file} failed`);
      break;
    }
  }
  
  if (success) {
    console.log('All migrations completed successfully');
    process.exit(0);
  } else {
    console.error('Migration failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 
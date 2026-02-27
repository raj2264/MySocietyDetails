/**
 * Supabase OTP Setup Script
 * 
 * This script sets up the required Supabase resources for OTP verification:
 * - Creates the verification_codes table
 * - Creates the verify_otp function
 * - Creates the profiles table (if it doesn't exist)
 * 
 * Usage:
 * node scripts/setup-supabase-otp.js
 */

// Import required dependencies
// You may need to run: npm install node-fetch
const fetch = require('node-fetch');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask user for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Get Supabase credentials from environment or .env file
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

// SQL statements
const CREATE_VERIFICATION_CODES_TABLE = `
-- Create the table
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);

-- Add RLS policies
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow insertion from authenticated API calls
CREATE POLICY "Anyone can insert verification codes" 
ON verification_codes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow the service role to manage all records
CREATE POLICY "Service role can do anything" 
ON verification_codes
USING (auth.role() = 'service_role');
`;

const CREATE_VERIFY_OTP_FUNCTION = `
-- Function to verify an OTP code
CREATE OR REPLACE FUNCTION verify_otp(p_email TEXT, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_verification_record RECORD;
  v_user_id UUID;
BEGIN
  -- Get the most recent unexpired and unused verification code for this email
  SELECT * INTO v_verification_record
  FROM verification_codes
  WHERE email = p_email
    AND code = p_code
    AND used = FALSE
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if we found a valid code
  IF v_verification_record.id IS NULL THEN
    -- Try to find any code for this email to determine if it's expired or invalid
    SELECT * INTO v_verification_record
    FROM verification_codes
    WHERE email = p_email
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_verification_record.id IS NULL THEN
      -- No code found at all
      RETURN json_build_object('valid', FALSE, 'reason', 'invalid_code');
    ELSIF v_verification_record.expires_at < NOW() THEN
      -- Code is expired
      RETURN json_build_object('valid', FALSE, 'reason', 'expired');
    ELSE
      -- Code is invalid
      RETURN json_build_object('valid', FALSE, 'reason', 'invalid_code');
    END IF;
  END IF;
  
  -- Mark the code as used
  UPDATE verification_codes
  SET used = TRUE
  WHERE id = v_verification_record.id;
  
  -- Get user id if it exists
  v_user_id := v_verification_record.user_id;
  
  -- If the record didn't have a user_id (pre-registration verification), try to find it now
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
  END IF;
  
  -- Return success with user_id
  RETURN json_build_object(
    'valid', TRUE,
    'user_id', v_user_id
  );
END;
$$;
`;

const CREATE_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profiles
CREATE POLICY "Users can read their own profiles" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profiles
CREATE POLICY "Users can update their own profiles" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Allow service role to manage all profiles
CREATE POLICY "Service role can do anything" 
ON profiles
USING (auth.role() = 'service_role');

-- Allow records to be created through API calls (will be restricted by auth in app)
CREATE POLICY "Allow insert with proper id" 
ON profiles FOR INSERT
TO authenticated, anon
WITH CHECK (true);
`;

// Execute SQL on Supabase
async function executeSQL(sql, description) {
  console.log(`\nExecuting: ${description}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  Failed: ${response.status} ${response.statusText}`);
      console.error(`  Error: ${errorText}`);
      return false;
    }
    
    console.log(`  Success: ${description} completed`);
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('\n🔐 Supabase OTP Verification Setup 🔐\n');
  console.log('This script will set up the required tables and functions for OTP verification in Supabase.\n');
  
  // Get credentials if not provided
  if (!SUPABASE_URL) {
    SUPABASE_URL = await prompt('Enter your Supabase URL (e.g., https://xyz.supabase.co): ');
  }
  
  if (!SUPABASE_KEY) {
    console.log('\n⚠️ NOTE: You need the service role key for this script, not the anon key! ⚠️');
    SUPABASE_KEY = await prompt('Enter your Supabase service role key: ');
  }
  
  // Test connection
  console.log('\nTesting connection to Supabase...');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (response.ok) {
      console.log('  Connection successful! ✅');
    } else {
      console.error(`  Connection failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`  Connection failed: ${error.message}`);
    process.exit(1);
  }
  
  // Execute each SQL statement
  console.log('\nStarting setup...');
  
  // First, check if execute_sql RPC function exists, we need to create it if not
  const executeRPCExists = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ query: 'SELECT 1;' })
  }).then(res => res.ok).catch(() => false);
  
  if (!executeRPCExists) {
    console.log('\nFirst, we need to create the execute_sql RPC function...');
    const createRPC = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({
        sql: `
        CREATE OR REPLACE FUNCTION execute_sql(query text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE query;
        END;
        $$;`
      })
    });
    
    if (!createRPC.ok) {
      console.error('Failed to create execute_sql function. Please run the SQL directly in the Supabase SQL editor.');
      console.log('Visit https://app.supabase.com/project/_/sql and run the SQL manually.');
      process.exit(1);
    }
  }
  
  // Execute the SQL statements
  let success = true;
  success = success && await executeSQL(CREATE_VERIFICATION_CODES_TABLE, 'Creating verification_codes table');
  success = success && await executeSQL(CREATE_VERIFY_OTP_FUNCTION, 'Creating verify_otp function');
  success = success && await executeSQL(CREATE_PROFILES_TABLE, 'Creating profiles table');
  
  if (success) {
    console.log('\n🎉 Setup completed successfully! 🎉');
    console.log('\nNext steps:');
    console.log('1. Set up email provider in Supabase: Authentication → Email Templates → Email Provider Settings');
    console.log('2. Test the OTP verification in your app');
  } else {
    console.log('\n⚠️ Setup completed with some errors ⚠️');
    console.log('Please check the error messages above and fix them manually.');
    console.log('You can run the SQL statements directly in the Supabase SQL editor:');
    console.log('https://app.supabase.com/project/_/sql');
  }
  
  rl.close();
}

// Run the main function
main().catch(err => {
  console.error('Error running setup script:', err);
  rl.close();
  process.exit(1);
}); 
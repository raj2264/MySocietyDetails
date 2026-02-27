/**
 * Test script for OTP verification
 * 
 * This script tests OTP generation, storage, and verification directly
 * against your Supabase instance to verify that RLS policies are working correctly.
 * 
 * Usage:
 * node scripts/test-otp.js
 */

// Use the same Supabase credentials as in auth.js
const SUPABASE_URL = 'https://jjgsggmufkpadchkodab.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ3NnZ211ZmtwYWRjaGtvZGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0Njg3MTAsImV4cCI6MjA2MDA0NDcxMH0.V6VxViTuJJdivrKKp51VcLyezeUmFNjLFb4wkVacQOk';

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Test email for verification
const testEmail = 'test@example.com';

// OTP expiry time (10 minutes)
const OTP_EXPIRY_TIME = 10 * 60 * 1000;

async function runTest() {
  try {
    console.log('🧪 Starting OTP test...');
    console.log(`Using Supabase URL: ${SUPABASE_URL}`);
    
    // Step 1: Generate an OTP
    const otp = generateOTP();
    console.log(`Generated OTP: ${otp}`);
    
    // Step 2: Store the OTP in Supabase
    console.log('\n📤 Storing OTP in Supabase...');
    const storeResponse = await fetch(`${SUPABASE_URL}/rest/v1/verification_codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: testEmail,
        code: otp,
        expires_at: new Date(Date.now() + OTP_EXPIRY_TIME).toISOString()
      }),
    });
    
    if (!storeResponse.ok) {
      const errorText = await storeResponse.text();
      console.error('❌ Failed to store OTP in Supabase:', storeResponse.status);
      console.error('Error details:', errorText);
      console.log('\n🔍 This likely means your RLS policies are not set correctly.');
      console.log('Please follow the steps in docs/fix-rls-policy.md to fix this issue.');
      return;
    }
    
    console.log('✅ OTP stored successfully in Supabase');
    
    // Step 3: Verify the OTP
    console.log('\n🔐 Verifying OTP...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({
        p_email: testEmail,
        p_code: otp
      }),
    });
    
    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('❌ Failed to verify OTP:', verifyResponse.status);
      console.error('Error details:', errorText);
      return;
    }
    
    const verifyResult = await verifyResponse.json();
    console.log('Verification result:', verifyResult);
    
    if (verifyResult.valid) {
      console.log('✅ OTP verified successfully!');
      console.log('🎉 Your RLS policies and OTP verification are working correctly.');
    } else {
      console.log('❌ OTP verification failed:', verifyResult.reason);
      console.log('Please check the error message and fix the issue.');
    }
  } catch (error) {
    console.error('❌ Error running test:', error.message);
  }
}

// Run the test
runTest(); 
#!/usr/bin/env node

/**
 * Script to setup Razorpay test accounts for all societies
 * Usage: node scripts/setup-razorpay-test.js
 * 
 * This script:
 * 1. Fetches all societies
 * 2. For each society without a Razorpay account, creates a test account
 * 3. Uses provided test keys or interactive input
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jjgsggmufkpadchkodab.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is not set');
  console.error('Please set it in your .env file or as an environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 Razorpay Test Account Setup\n');
  console.log('='.repeat(50));

  try {
    // Get Razorpay credentials
    console.log('\n📝 Enter your Razorpay Test Credentials:\n');

    const testKeyId = await question('Razorpay Test Key ID (rzp_test_...): ');
    const testKeySecret = await question('Razorpay Test Key Secret: ');
    const accountId = await question('Your Account ID (optional, press Enter to skip): ') || 'test_account_001';

    if (!testKeyId || !testKeySecret) {
      console.error('\n❌ Key ID and Key Secret are required');
      rl.close();
      process.exit(1);
    }

    // Validate format
    if (!testKeyId.startsWith('rzp_test_')) {
      console.warn('\n⚠️ Warning: Your Key ID should start with "rzp_test_" for test mode');
    }

    console.log('\n✅ Credentials received\n');

    // Fetch all societies
    console.log('📦 Fetching societies from database...\n');
    const { data: societies, error: societiesError } = await supabase
      .from('societies')
      .select('id, name, address');

    if (societiesError) {
      throw new Error(`Failed to fetch societies: ${societiesError.message}`);
    }

    if (!societies || societies.length === 0) {
      console.warn('ℹ️ No societies found in database');
      rl.close();
      process.exit(0);
    }

    console.log(`✅ Found ${societies.length} societies\n`);

    // Check existing Razorpay accounts
    const { data: existingAccounts, error: accountsError } = await supabase
      .from('razorpay_accounts')
      .select('society_id');

    if (accountsError) {
      throw new Error(`Failed to fetch existing accounts: ${accountsError.message}`);
    }

    const existingSocietyIds = new Set((existingAccounts || []).map((a) => a.society_id));

    // Setup Razorpay for each society without an account
    const societiesToSetup = societies.filter((s) => !existingSocietyIds.has(s.id));

    if (societiesToSetup.length === 0) {
      console.log('ℹ️ All societies already have Razorpay accounts configured\n');
      rl.close();
      process.exit(0);
    }

    console.log(`🔧 Setting up Razorpay for ${societiesToSetup.length} societies:\n`);

    for (const society of societiesToSetup) {
      try {
        // Get admin user
        const { data: admin, error: adminError } = await supabase
          .from('society_admins')
          .select('user_id')
          .eq('society_id', society.id)
          .limit(1)
          .single();

        const createdBy = admin?.user_id || null;

        // Insert Razorpay account
        const { data, error } = await supabase
          .from('razorpay_accounts')
          .insert([
            {
              society_id: society.id,
              account_id: accountId,
              key_id: testKeyId,
              key_secret: testKeySecret,
              is_active: true,
              created_by: createdBy,
            },
          ])
          .select();

        if (error) {
          console.error(`❌ ${society.name}: ${error.message}`);
        } else {
          console.log(`✅ ${society.name}`);
          console.log(`   Account ID: ${accountId}`);
          console.log(`   Type: Test Account\n`);
        }
      } catch (err) {
        console.error(`❌ ${society.name}: ${err.message}\n`);
      }
    }

    console.log('='.repeat(50));
    console.log('\n✨ Setup Complete!\n');
    console.log('📋 Summary:');
    console.log(`   • Configured: ${societiesToSetup.length} societies`);
    console.log(`   • Mode: Test (${testKeyId})`);
    console.log(`   • Account ID: ${accountId}\n`);

    console.log('🧪 Next Steps:');
    console.log('   1. Test the payment flow in MySocietyApp');
    console.log('   2. Use test card: 4111111111111111');
    console.log('   3. Any expiry date in future');
    console.log('   4. Any 3-digit CVV\n');

    console.log('📚 For more details, see: RAZORPAY_SETUP_GUIDE.md\n');

    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    rl.close();
    process.exit(1);
  }
}

main();

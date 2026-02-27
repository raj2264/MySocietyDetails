const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt function that returns a promise
function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

// Main function
async function main() {
  console.log('\n🔔 Setting up Announcements and Notifications for MySociety App 🔔\n');
  
  // Get Supabase credentials
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl) {
    supabaseUrl = await prompt('Enter your Supabase URL (e.g., https://xyz.supabase.co): ');
  }
  
  if (!supabaseServiceKey) {
    console.log('\n⚠️ NOTE: You need the service role key for this script, not the anon key! ⚠️');
    supabaseServiceKey = await prompt('Enter your Supabase service role key: ');
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Test the connection
  console.log('\nTesting connection to Supabase...');
  try {
    const { data, error } = await supabase.from('societies').select('id').limit(1);
    
    if (error) {
      console.error('Connection failed:', error.message);
      process.exit(1);
    }
    
    console.log('Connection successful! ✅');
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  }
  
  // Read the SQL file
  const sqlFilePath = path.join(__dirname, '..', 'supabase-sql', 'create-announcements-table.sql');
  let sql;
  
  try {
    sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('Successfully read SQL file ✅');
  } catch (error) {
    console.error('Error reading SQL file:', error.message);
    process.exit(1);
  }
  
  // Execute the SQL
  console.log('\nCreating announcements and notifications tables...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: sql
    });
    
    if (error) {
      console.error('Error executing SQL:', error.message);
      process.exit(1);
    }
    
    console.log('Successfully set up announcements and notifications! ✅');
  } catch (error) {
    console.error('Error executing SQL RPC function:', error.message);
    console.log('\nTrying alternative method...');
    
    try {
      // Try direct query if RPC fails
      const { error } = await supabase.auth.admin.useRootFunctions();
      
      if (error) {
        throw new Error('Failed to use root functions: ' + error.message);
      }
      
      // Split the SQL into separate statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        const { error } = await supabase.query(statement + ';');
        if (error) {
          throw new Error(`Error executing SQL statement: ${error.message}`);
        }
      }
      
      console.log('Successfully set up announcements and notifications! ✅');
    } catch (err) {
      console.error('Failed to create tables using alternative method:', err.message);
      console.log('\n⚠️ Please run the SQL manually in the Supabase SQL Editor ⚠️');
      console.log(`SQL file path: ${sqlFilePath}`);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 Setup completed successfully! 🎉');
  console.log('\nYou can now use the announcements feature in your app.');
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
}); 
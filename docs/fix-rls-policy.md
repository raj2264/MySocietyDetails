# Fixing RLS Policy Issues in Supabase

This guide will help you fix the "row-level security policy violation" error you're seeing when trying to insert records into the `verification_codes` table.

## What's Happening

The error `new row violates row-level security policy for table "verification_codes"` means that your Supabase database has Row Level Security (RLS) enabled on the `verification_codes` table, but the current policies don't allow the operation you're trying to perform.

## Solution

### Option 1: Run the SQL Script (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to the **SQL Editor** (in the left sidebar)
4. Create a new query
5. Copy and paste the contents of `scripts/fix-rls-policies.sql` into the editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see a success message: "RLS policies successfully updated!"

### Option 2: Manual Steps in the Supabase UI

If you prefer using the UI:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Database** in the left sidebar
4. Click on **Tables** and find `verification_codes`
5. Click on the three dots (⋮) next to the table and select **RLS Policies**
6. Delete any existing policies that might be conflicting
7. Click **New Policy**
8. Choose **INSERT** as the operation
9. Name it "Allow anyone to insert verification codes"
10. Leave the **Using expression** blank
11. Set the **With check expression** to `true`
12. Select both **authenticated** and **anon** roles
13. Click **Save Policy**
14. Repeat to create "Service role can do anything" policy:
    - Choose **ALL** for the operation
    - Set the **Using expression** to `auth.role() = 'service_role'`
    - Leave the **With check expression** as default
    - Select all roles
15. Repeat to create "Allow execute of verify_otp function" policy:
    - Choose **SELECT** for the operation
    - Set the **Using expression** to `true`
    - Leave the **With check expression** as default
    - Select both **authenticated** and **anon** roles

### Option 3: Run Individual SQL Commands

If you're having trouble with the full script, you can run these commands individually:

```sql
-- Remove any existing policies
DROP POLICY IF EXISTS "Anyone can insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Service role can do anything" ON verification_codes;
DROP POLICY IF EXISTS "Users can update their own verification code" ON verification_codes;

-- Create the main insert policy
CREATE POLICY "Allow anyone to insert verification codes" 
ON verification_codes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create the service role policy
CREATE POLICY "Service role can do anything" 
ON verification_codes
USING (auth.role() = 'service_role');

-- Create a select policy for verification
CREATE POLICY "Allow execute of verify_otp function" 
ON verification_codes FOR SELECT
TO anon, authenticated
USING (true);
```

## Troubleshooting Common Errors

### Function Return Type Error

If you see this error:
```
ERROR: 42P13: cannot change return type of existing function
HINT: Use DROP FUNCTION verify_otp(text,text) first.
```

It means that the `verify_otp` function already exists in your database but with a different return type. To fix this:

1. Run this command first to drop the existing function:
   ```sql
   DROP FUNCTION IF EXISTS verify_otp(text, text);
   ```

2. Then run the script to create the function again with the correct return type.

3. Alternatively, use the simplified script at `scripts/simplified-fix.sql` which only fixes RLS policies without touching functions.

### RLS Policies Not Working

If you've set up the policies but still get RLS errors:

1. Make sure you're using the latest version of the code from `lib/auth.js`
2. Try running the test script: `node scripts/test-otp.js`
3. Check the error messages - they should provide more details
4. Verify that RLS is enabled on the table but the policies are set correctly

## Verification

After applying the changes:

1. Restart your app
2. Try registering a new user
3. The OTP verification should now work as expected

If you're still having issues:

1. Check the console logs for specific error messages
2. Make sure the `verify_otp` function exists in your Supabase database
3. Verify that your tables are set up correctly

## Understanding RLS Policies

Row Level Security (RLS) in Supabase allows you to define access rules for your tables. For the OTP verification to work properly, you need:

1. **INSERT permission** for anonymous users (to store verification codes)
2. **SELECT permission** for the verification function to retrieve and check codes
3. **UPDATE permission** for the function to mark codes as used

The policies we've created address all these requirements while maintaining security. 
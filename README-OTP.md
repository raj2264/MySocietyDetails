# Email OTP Verification for MySociety App

This README provides a complete guide to implement email OTP (One-Time Password) verification in your MySociety App.

## Overview

The app implements a hybrid approach for email verification:

1. **Development Mode**: Shows OTP directly in the app for easy testing
2. **Production Mode**: Uses Supabase to store OTPs and send emails

The implementation automatically falls back to development mode if any Supabase operations fail, ensuring your app continues to work during development.

## Features

- 6-digit numeric OTP codes
- 10-minute expiry
- Email delivery via Supabase
- Fallback to development mode
- UI with OTP input fields and animations

## Setup Instructions

### Step 1: Set Up Supabase Resources

You need to create the necessary database tables and functions in Supabase:

#### Option A: Using the Setup Script (Recommended)

1. Install dependencies:
   ```
   npm install node-fetch
   ```

2. Run the setup script:
   ```
   node scripts/setup-supabase-otp.js
   ```

3. Follow the on-screen instructions. You'll need your Supabase URL and service role key.

#### Option B: Manual Setup

If the setup script doesn't work, manually create the resources in Supabase:

1. Open the Supabase SQL Editor: https://app.supabase.com/project/_/sql
2. Create the verification_codes table:
   ```sql
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
   ```

3. Create the verify_otp function:
   ```sql
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
   ```

4. Create the profiles table (if it doesn't exist):
   ```sql
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
   ```

### Step 2: Configure Email Settings in Supabase

1. Go to **Authentication** → **Email Templates** in the Supabase dashboard
2. Click on **Email Provider Settings**
3. Choose and configure your email provider:
   
   **Recommended: Resend.com**
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: Your Resend API key
   - Password: Leave blank
   - From Email: Your verified sender email
   - Enable SSL: Yes

   > Resend.com offers a free tier with 100 emails/day, which is perfect for development and small apps.

4. Click **Save** to update your email settings

### Step 3: Test the Implementation

1. Run your app in development mode
2. Try to register a new user
3. The OTP verification screen should appear
4. In development mode, the OTP will be displayed directly in the app (in console logs)
5. Check that the verification process works

## How It Works

The OTP verification process follows these steps:

1. **User Registration**: 
   - User enters email, password, and name
   - App creates an unverified account

2. **OTP Generation and Sending**:
   - App generates a 6-digit OTP
   - OTP is stored locally in AsyncStorage
   - App attempts to store OTP in Supabase and send email
   - If Supabase operations fail, falls back to development mode

3. **OTP Verification**:
   - User enters the OTP
   - App attempts to verify via Supabase
   - If Supabase verification fails, falls back to local verification
   - Upon successful verification, user's account is marked as verified

4. **Post-Verification**:
   - User is redirected to the login screen or logged in automatically
   - App stores verification status in user's profile

## Troubleshooting

### Email Not Being Sent

1. Check Supabase email provider settings
2. Verify that your email provider (e.g., Resend.com) is properly configured
3. Check Supabase logs for any email sending errors
4. Test email sending using the "Reset Password" feature in Supabase

### Database Table Errors

If you see errors about the verification_codes table not existing:

1. Check that you've run the setup script or SQL commands
2. Verify that the SQL executed successfully without errors
3. Check Supabase database for the presence of the verification_codes table

### RLS Policy Errors

If you see errors like "new row violates row-level security policy for table 'verification_codes'":

1. You need to fix your Row Level Security (RLS) policies in Supabase. Run this SQL in the Supabase SQL Editor:

   ```sql
   -- First drop any existing policies that might conflict
   DROP POLICY IF EXISTS "Anyone can insert verification codes" ON verification_codes;
   
   -- Create the new policy to allow anonymous inserts
   CREATE POLICY "Anyone can insert verification codes" 
   ON verification_codes FOR INSERT
   TO anon, authenticated
   WITH CHECK (true);
   
   -- Also ensure there's a policy for the service role
   DROP POLICY IF EXISTS "Service role can do anything" ON verification_codes;
   CREATE POLICY "Service role can do anything" 
   ON verification_codes
   USING (auth.role() = 'service_role');
   ```

2. If you're still seeing RLS errors, temporarily enable development mode by setting `FORCE_DEV_MODE = true` in lib/auth.js 

3. For a more permanent solution, consider enabling the "Row Level Security Bypass" option for your service role in Supabase

### Verification Always Fails

1. Make sure OTP expiry time (10 minutes) hasn't elapsed
2. Check that the code entered matches exactly
3. Look for any error messages in the app console
4. Verify the verify_otp function exists in Supabase

## Development vs Production Mode

The app implements a hybrid approach to ensure seamless development:

- **Development Mode**: OTPs are stored locally and displayed in the app
- **Production Mode**: OTPs are stored in Supabase and sent via email

The system automatically falls back to development mode if any Supabase operations fail, making it easy to develop without a fully configured Supabase setup.

To force development mode only (for testing):
```javascript
// In lib/auth.js, set this flag to true
const FORCE_DEV_MODE = true; // Add this line near the top
```

## Security Considerations

For production use, consider these security enhancements:

1. Rate limiting OTP requests to prevent abuse
2. Adding IP-based restrictions for verification attempts
3. Implementing additional verification factors for high-risk actions
4. Using more secure email templates with your branded styling
5. Monitoring failed verification attempts for potential security issues

## Next Steps

- Customize email templates in Supabase for better branding
- Implement resend functionality with cooldown period
- Add phone number verification as an alternative
- Consider adding CAPTCHA for additional security 
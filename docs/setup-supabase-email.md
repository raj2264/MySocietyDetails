# Setting Up OTP Email Verification in Supabase

This guide will help you configure Supabase to send OTP verification emails for your MySociety App.

## Step 1: Configure Email Provider

1. In the Supabase dashboard, go to **Authentication** → **Email Templates**
2. Click on **Email Provider Settings**
3. Choose your email provider:
   - **SMTP** (recommended for production)
   - **SendGrid**
   - **Mailgun**
   - **Custom SMTP**

### Example: Setting up Resend.com (Recommended)

1. Create a Resend account at [resend.com](https://resend.com/)
2. Generate an API key
3. In Supabase, choose SMTP as the provider and enter:
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: Your Resend API key
   - **Password**: Leave blank
   - **Set From email**: `noreply@yourdomain.com` (must be verified in Resend)
   - **Enable SSL**: Yes

## Step 2: Create Custom Email Template

1. In the Supabase dashboard, go to **Authentication** → **Email Templates**
2. Click on **Custom Templates**
3. Click **Add New Template**
4. Choose a template name: `OTP_EMAIL`
5. Fill in the subject: `Your MySociety App Verification Code`
6. In the HTML template editor, paste the following code:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 10px; border: 1px solid #eaeaea; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #333; margin-bottom: 5px;">MySociety App</h1>
    <p style="color: #666; font-size: 16px; margin-top: 0;">Email Verification</p>
  </div>
  
  <div style="margin-bottom: 30px;">
    <p style="font-size: 16px; color: #333; margin-bottom: 10px;">Hello {{ .user_name }},</p>
    <p style="font-size: 16px; color: #333;">Your verification code is:</p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #333;">{{ .otp }}</span>
    </div>
    
    <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
    <p style="font-size: 14px; color: #666;">If you didn't request this code, please ignore this email.</p>
  </div>
  
  <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
    <p style="font-size: 14px; color: #999; margin: 5px 0;">Thanks for using MySociety App</p>
    <p style="font-size: 12px; color: #999; margin: 5px 0;">&copy; 2023 MySociety App. All rights reserved.</p>
  </div>
</div>
```

7. Save the template

## Step 3: Create the Verification Codes Table

Run the following SQL in the Supabase SQL editor:

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

## Step 4: Create the Verification Function

Run the following SQL to create an RPC function for verifying OTP codes:

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

## Step 5: Create the Profiles Table (if not exists)

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

## Troubleshooting

If you encounter errors during OTP verification:

1. Check that the `verification_codes` table exists in your Supabase database
2. Verify the `verify_otp` RPC function is properly created
3. Check Supabase logs for any error messages
4. The app will fall back to development mode verification if Supabase operations fail
5. Make sure your Supabase email configuration is working by testing the "Reset Password" feature

## Development Mode

When in development, or if Supabase operations fail, the app will:

1. Generate and display the OTP directly in the app for testing
2. Store the OTP in AsyncStorage for local verification
3. Attempt to send emails via Supabase (which may fail if not properly configured)

This hybrid approach ensures you can continue development while setting up the Supabase infrastructure. 
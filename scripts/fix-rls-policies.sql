-- SQL script to fix RLS policies for verification_codes table
-- Run this in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- First drop any existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Anyone can insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Service role can do anything" ON verification_codes;
DROP POLICY IF EXISTS "Users can update their own verification code" ON verification_codes;
DROP POLICY IF EXISTS "Anon can insert" ON verification_codes;

-- Enable RLS on the table (if not already enabled)
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to insert records (important for OTP creation)
CREATE POLICY "Allow anyone to insert verification codes" 
ON verification_codes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create a policy that allows the service role to do anything
CREATE POLICY "Service role can do anything" 
ON verification_codes
USING (auth.role() = 'service_role');

-- Create a policy that allows users to read their own verification codes
CREATE POLICY "Users can read their own verification codes" 
ON verification_codes FOR SELECT
TO authenticated
USING (email = auth.email());

-- Create a policy that allows access to verification_codes RPC function
CREATE POLICY "Allow execute of verify_otp function" 
ON verification_codes FOR SELECT
TO anon, authenticated
USING (true);

-- Drop the existing verify_otp function if it exists
DROP FUNCTION IF EXISTS verify_otp(text, text);

-- Recreate the verify_otp function
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

-- Print confirmation
SELECT 'RLS policies successfully updated!' as result; 
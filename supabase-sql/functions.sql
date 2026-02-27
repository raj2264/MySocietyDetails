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
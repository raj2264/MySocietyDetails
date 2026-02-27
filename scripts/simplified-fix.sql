-- Simplified script to fix ONLY the RLS policies without touching functions
-- Use this if you're still having issues with the full script

-- First drop any existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Anyone can insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Allow anyone to insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Service role can do anything" ON verification_codes;
DROP POLICY IF EXISTS "Users can update their own verification code" ON verification_codes;
DROP POLICY IF EXISTS "Anon can insert" ON verification_codes;
DROP POLICY IF EXISTS "Users can read their own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Allow execute of verify_otp function" ON verification_codes;

-- Enable RLS on the table (if not already enabled)
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Create policies one by one
CREATE POLICY "Allow anyone to insert verification codes" 
ON verification_codes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service role can do anything" 
ON verification_codes
USING (auth.role() = 'service_role');

CREATE POLICY "Allow execute of verify_otp function" 
ON verification_codes FOR SELECT
TO anon, authenticated
USING (true);

-- Print confirmation
SELECT 'RLS policies successfully updated - simplified version!' as result; 
-- Add policies for superadmins to view societies and residents tables
-- First, create the is_superadmin function if it doesn't exist
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND id IN (SELECT id FROM superadmins)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for superadmins to view societies
DROP POLICY IF EXISTS "Superadmins can view all societies" ON societies;
CREATE POLICY "Superadmins can view all societies" ON societies
    FOR SELECT
    USING (is_superadmin());

-- Add policy for superadmins to view residents
DROP POLICY IF EXISTS "Superadmins can view all residents" ON residents;
CREATE POLICY "Superadmins can view all residents" ON residents
    FOR SELECT
    USING (is_superadmin());

-- Grant necessary permissions
GRANT SELECT ON societies TO authenticated;
GRANT SELECT ON residents TO authenticated; 
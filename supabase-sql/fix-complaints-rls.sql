-- First, enable RLS on the complaints table
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Residents can create complaints" ON complaints;
DROP POLICY IF EXISTS "Residents can view their own personal complaints" ON complaints;
DROP POLICY IF EXISTS "Society admins can view all society complaints" ON complaints;
DROP POLICY IF EXISTS "Society admins can insert complaints" ON complaints;
DROP POLICY IF EXISTS "Society admins can update complaints" ON complaints;

-- Create new policies with proper permissions

-- Allow residents to create complaints
CREATE POLICY "Residents can create complaints"
ON complaints
FOR INSERT
TO authenticated
WITH CHECK (
    resident_id IN (
        SELECT id FROM residents
        WHERE user_id = auth.uid()
    )
);

-- Allow residents to view their own personal complaints and all community complaints
CREATE POLICY "Residents can view their own personal complaints and community complaints"
ON complaints
FOR SELECT
TO authenticated
USING (
    resident_id IN (
        SELECT id FROM residents
        WHERE user_id = auth.uid()
    )
    OR
    (
        type = 'community'
        AND society_id IN (
            SELECT society_id FROM residents
            WHERE user_id = auth.uid()
        )
    )
);

-- Allow society admins to view all complaints in their society
CREATE POLICY "Society admins can view all society complaints"
ON complaints
FOR SELECT
TO authenticated
USING (
    society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
    )
);

-- Allow society admins to update complaints in their society
CREATE POLICY "Society admins can update complaints"
ON complaints
FOR UPDATE
TO authenticated
USING (
    society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
    )
);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON complaints TO authenticated; 
-- Fix for the announcements RLS policies
-- This script will update the Row Level Security policies to ensure residents
-- can view announcements from their society while admins can manage them

-- First, drop any existing RLS policies for the announcements table to start fresh
DROP POLICY IF EXISTS "Allow society members to view announcements" ON announcements;
DROP POLICY IF EXISTS "Allow society admins to manage announcements" ON announcements;
DROP POLICY IF EXISTS "Public can view announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Public view announcements" ON announcements;
DROP POLICY IF EXISTS "Society admins can manage their announcements" ON announcements;
DROP POLICY IF EXISTS "Society members can view announcements" ON announcements;

-- Enable Row Level Security on the announcements table
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all authenticated users to view announcements
-- This simplifies the permissions model for troubleshooting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'announcements' AND policyname = 'Public view announcements'
  ) THEN
    EXECUTE 'CREATE POLICY "Public view announcements" 
    ON announcements
    FOR SELECT 
    TO authenticated
    USING (true)';
  END IF;
END
$$;

-- Create a policy that allows society admins to manage announcements for their society
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'announcements' AND policyname = 'Society admins can manage their announcements'
  ) THEN
    EXECUTE 'CREATE POLICY "Society admins can manage their announcements" 
    ON announcements
    FOR ALL 
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM society_admins
        WHERE society_admins.user_id = auth.uid()
        AND society_admins.society_id = announcements.society_id
      )
    )';
  END IF;
END
$$;

-- Create a policy to allow members to view active announcements for their society
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'announcements' AND policyname = 'Society members can view announcements'
  ) THEN
    EXECUTE 'CREATE POLICY "Society members can view announcements" 
    ON announcements
    FOR SELECT 
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM residents
        WHERE residents.user_id = auth.uid()
        AND residents.society_id = announcements.society_id
        AND announcements.active = true
      )
    )';
  END IF;
END
$$;

-- Log the fix
SELECT NOW() as timestamp, 'Announcements RLS policies fixed' as message; 
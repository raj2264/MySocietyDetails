-- Fix RLS policies for approval_requests table
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Society admins can manage approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Residents can view their approval requests" ON approval_requests;
DROP POLICY IF EXISTS "Residents can create approval requests" ON approval_requests;

-- Society admins can manage all approval requests in their society
CREATE POLICY "Society admins can manage approval requests"
ON approval_requests
FOR ALL
USING (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
);

-- Residents can view their own approval requests
CREATE POLICY "Residents can view their approval requests"
ON approval_requests
FOR SELECT
USING (
  resident_id IN (
    SELECT id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- Residents can create approval requests for their society
CREATE POLICY "Residents can create approval requests"
ON approval_requests
FOR INSERT
WITH CHECK (
  resident_id IN (
    SELECT id FROM residents
    WHERE user_id = auth.uid()
  )
  AND
  society_id IN (
    SELECT society_id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT ALL ON approval_requests TO authenticated; 
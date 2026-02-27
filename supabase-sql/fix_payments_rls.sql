-- Fix RLS policies for payments table to allow society admins to insert/update payments

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Society admins can insert payments" ON payments;
DROP POLICY IF EXISTS "Society admins can update payments" ON payments;
DROP POLICY IF EXISTS "Society admins can view society payments" ON payments;

-- Allow society admins to insert payments for their society
CREATE POLICY "Society admins can insert payments" ON payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = payments.society_id
  )
);

-- Allow society admins to update payments for their society
CREATE POLICY "Society admins can update payments" ON payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = payments.society_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = payments.society_id
  )
);

-- Allow society admins to view all payments for their society
CREATE POLICY "Society admins can view society payments" ON payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = payments.society_id
  )
);

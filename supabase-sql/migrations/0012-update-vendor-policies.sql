-- Update vendor and booking policies to allow superadmin access
-- First, ensure RLS is enabled on both tables
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Society admins can manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Society admins can see all bookings" ON public.vendor_bookings;
DROP POLICY IF EXISTS "Residents can view vendors in their society" ON public.vendors;
DROP POLICY IF EXISTS "Residents can manage their own bookings" ON public.vendor_bookings;

-- Create new policies for vendors table
-- Superadmins can manage all vendors
CREATE POLICY "Superadmins can manage all vendors" ON public.vendors
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM superadmins
    WHERE superadmins.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = vendors.society_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM superadmins
    WHERE superadmins.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id = vendors.society_id
  )
);

-- Create new policies for vendor_bookings table
-- Superadmins can see all bookings
CREATE POLICY "Superadmins can see all bookings" ON public.vendor_bookings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM superadmins
    WHERE superadmins.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id IN (
      SELECT society_id FROM vendors
      WHERE vendors.id = vendor_bookings.vendor_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM superadmins
    WHERE superadmins.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM society_admins
    WHERE society_admins.user_id = auth.uid()
    AND society_admins.society_id IN (
      SELECT society_id FROM vendors
      WHERE vendors.id = vendor_bookings.vendor_id
    )
  )
);

-- Create policies for residents
-- Residents can view vendors in their society
CREATE POLICY "Residents can view vendors in their society" ON public.vendors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM residents
    WHERE residents.user_id = auth.uid()
    AND residents.society_id = vendors.society_id
  )
);

-- Residents can manage their own bookings
CREATE POLICY "Residents can manage their own bookings" ON public.vendor_bookings
FOR ALL
USING (
  resident_id IN (
    SELECT id FROM residents 
    WHERE user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bookings TO authenticated; 
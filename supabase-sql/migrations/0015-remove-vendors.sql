-- Drop vendor-related tables and their dependencies
DROP TABLE IF EXISTS public.vendor_bookings CASCADE;
DROP TABLE IF EXISTS public.vendor_services CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;

-- Update service_bookings table to ensure it has all necessary fields
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS service_description TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES society_staff(id),
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS completion_date TIMESTAMP WITH TIME ZONE;

-- Update RLS policies for service_bookings
DROP POLICY IF EXISTS "Superadmins can manage all bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Residents can manage their own bookings" ON public.service_bookings;
DROP POLICY IF EXISTS "Society admins can manage bookings" ON public.service_bookings;

-- Create new policies for service_bookings
-- Superadmins can manage all bookings
CREATE POLICY "Superadmins can manage all bookings" ON public.service_bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM superadmins
      WHERE superadmins.id = auth.uid()
    )
  );

-- Society admins can manage bookings in their society
CREATE POLICY "Society admins can manage bookings" ON public.service_bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM society_admins
      WHERE society_admins.user_id = auth.uid()
      AND society_admins.society_id IN (
        SELECT society_id FROM residents
        WHERE residents.id = service_bookings.resident_id
      )
    )
  );

-- Residents can manage their own bookings
CREATE POLICY "Residents can manage their own bookings" ON public.service_bookings
  FOR ALL
  USING (
    resident_id IN (
      SELECT id FROM residents
      WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON public.service_bookings TO authenticated;
GRANT ALL ON public.services TO authenticated;

-- First, delete any existing vendor-related approval requests
DELETE FROM public.approval_requests
WHERE type = 'vendor';

-- Then update the approval_requests table to remove vendor-related types
ALTER TABLE public.approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_type_check,
  ADD CONSTRAINT approval_requests_type_check
    CHECK (type IN ('visitor', 'event', 'other')); 
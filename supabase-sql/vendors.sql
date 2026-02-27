-- Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  description TEXT,
  address TEXT,
  service_hours TEXT,
  rating NUMERIC(3,2),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Allow society admins to manage vendors
CREATE POLICY "Society admins can manage vendors" ON public.vendors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM society_admins
      WHERE society_admins.user_id = auth.uid()
      AND society_admins.society_id = vendors.society_id
    )
  );

-- Allow residents to view vendors in their society
CREATE POLICY "Residents can view vendors in their society" ON public.vendors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM residents
      WHERE residents.user_id = auth.uid()
      AND residents.society_id = vendors.society_id
    )
  );

-- Create bookings table for vendor services
CREATE TABLE IF NOT EXISTS public.vendor_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  service_description TEXT NOT NULL,
  booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for bookings
ALTER TABLE public.vendor_bookings ENABLE ROW LEVEL SECURITY;

-- Allow residents to manage their own bookings
CREATE POLICY "Residents can manage their own bookings" ON public.vendor_bookings
  FOR ALL
  USING (resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid()));

-- Allow vendors to see bookings for their services
CREATE POLICY "Vendors can see their bookings" ON public.vendor_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = vendor_bookings.vendor_id
      AND vendors.society_id IN (
        SELECT society_id FROM residents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow society admins to see all bookings in their society
CREATE POLICY "Society admins can see all bookings" ON public.vendor_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM society_admins
      WHERE society_admins.user_id = auth.uid()
      AND society_admins.society_id IN (
        SELECT society_id FROM vendors
        WHERE vendors.id = vendor_bookings.vendor_id
      )
    )
  ); 
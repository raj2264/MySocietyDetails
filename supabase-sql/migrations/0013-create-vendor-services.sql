-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_range TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create service_bookings table
CREATE TABLE IF NOT EXISTS public.service_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for services

-- Superadmins can manage all services
CREATE POLICY "Superadmins can manage all services" ON public.services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM superadmins
      WHERE superadmins.id = auth.uid()
    )
  );

-- Everyone can view active services
CREATE POLICY "Anyone can view active services" ON public.services
  FOR SELECT
  USING (is_active = true);

-- Create policies for service_bookings

-- Superadmins can manage all bookings
CREATE POLICY "Superadmins can manage all bookings" ON public.service_bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM superadmins
      WHERE superadmins.id = auth.uid()
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

-- Society admins can view bookings for residents in their society
CREATE POLICY "Society admins can view bookings" ON public.service_bookings
  FOR SELECT
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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_bookings TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_bookings_service_id ON public.service_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_resident_id ON public.service_bookings(resident_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON public.service_bookings(status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_booking_date ON public.service_bookings(booking_date); 
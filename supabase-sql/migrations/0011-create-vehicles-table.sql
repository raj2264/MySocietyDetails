-- Create vehicles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'bike', 'other')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  license_plate TEXT NOT NULL,
  parking_spot TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(resident_id, license_plate)
);

-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Society admins can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Residents can manage their own vehicles" ON public.vehicles;

-- Society admins can manage vehicles in their society
CREATE POLICY "Society admins can manage vehicles" ON public.vehicles
  USING (
    resident_id IN (
      SELECT id FROM residents 
      WHERE society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    resident_id IN (
      SELECT id FROM residents 
      WHERE society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
      )
    )
  );

-- Residents can manage their own vehicles
CREATE POLICY "Residents can manage their own vehicles" ON public.vehicles
  USING (
    resident_id IN (
      SELECT id FROM residents 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    resident_id IN (
      SELECT id FROM residents 
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated; 
-- This file can be executed directly in the Supabase SQL editor

-- First check if vehicles table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vehicles') THEN
    -- Create vehicles table if it doesn't exist
    CREATE TABLE vehicles (
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

    -- Create RLS policies for vehicles table
    ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Table vehicles already exists';
  END IF;
END
$$;

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Society admins can manage vehicles" ON vehicles;
DROP POLICY IF EXISTS "Residents can manage their own vehicles" ON vehicles;

-- Society admins can manage vehicles in their society
CREATE POLICY "Society admins can manage vehicles" ON vehicles
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
CREATE POLICY "Residents can manage their own vehicles" ON vehicles
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
GRANT SELECT, INSERT, UPDATE, DELETE ON vehicles TO authenticated; 
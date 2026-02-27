-- Add flags to track visitors that were manually added by guards
DO $$
BEGIN
    -- Add manually_added column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
        AND column_name = 'manually_added'
    ) THEN
        -- Add manually_added column with default false
        ALTER TABLE visitors 
        ADD COLUMN manually_added BOOLEAN DEFAULT FALSE;
        
        -- Create an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_visitors_manually_added ON visitors(manually_added);
        
        RAISE NOTICE 'Added manually_added column to visitors table';
    ELSE
        RAISE NOTICE 'manually_added column already exists in visitors table';
    END IF;

    -- Add added_by_guard column if it doesn't exist (alternative name)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
        AND column_name = 'added_by_guard'
    ) THEN
        -- Add added_by_guard column with default false
        ALTER TABLE visitors 
        ADD COLUMN added_by_guard BOOLEAN DEFAULT FALSE;
        
        -- Create an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_visitors_added_by_guard ON visitors(added_by_guard);
        
        RAISE NOTICE 'Added added_by_guard column to visitors table';
    ELSE
        RAISE NOTICE 'added_by_guard column already exists in visitors table';
    END IF;
END
$$;

-- Update RPC functions to include the new fields
-- Update add_visitor_without_notification function
DROP FUNCTION IF EXISTS add_visitor_without_notification(JSONB);
CREATE OR REPLACE FUNCTION add_visitor_without_notification(visitor_data JSONB)
RETURNS JSONB AS $$
DECLARE
  new_visitor_id UUID;
  inserted_visitor JSONB;
BEGIN
  -- Insert the visitor with SECURITY DEFINER to bypass RLS
  INSERT INTO visitors (
    society_id,
    name,
    phone,
    purpose,
    flat_number,
    resident_id,
    access_code,
    type,
    expected_arrival,
    expiry_time,
    approval_status,
    visit_date,
    manually_added,
    added_by_guard
  )
  VALUES (
    (visitor_data->>'society_id')::UUID,
    visitor_data->>'name',
    visitor_data->>'phone',
    visitor_data->>'purpose',
    visitor_data->>'flat_number',
    (visitor_data->>'resident_id')::UUID,
    visitor_data->>'access_code',
    visitor_data->>'type',
    (visitor_data->>'expected_arrival')::TIMESTAMP WITH TIME ZONE,
    (visitor_data->>'expiry_time')::TIMESTAMP WITH TIME ZONE,
    visitor_data->>'approval_status',
    COALESCE((visitor_data->>'visit_date')::TIMESTAMP WITH TIME ZONE, NOW()),
    COALESCE((visitor_data->>'manually_added')::BOOLEAN, FALSE),
    COALESCE((visitor_data->>'added_by_guard')::BOOLEAN, FALSE)
  )
  RETURNING id INTO new_visitor_id;
  
  -- Get the full visitor record
  SELECT to_jsonb(v)
  FROM visitors v
  WHERE v.id = new_visitor_id
  INTO inserted_visitor;
  
  RETURN inserted_visitor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update insert_visitor_directly function
DROP FUNCTION IF EXISTS insert_visitor_directly(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, TIMESTAMP WITH TIME ZONE);
CREATE OR REPLACE FUNCTION insert_visitor_directly(
  society_id UUID,
  name TEXT,
  phone TEXT,
  purpose TEXT,
  flat_number TEXT,
  resident_id UUID,
  access_code TEXT,
  visitor_type TEXT,
  expected_arrival TIMESTAMP WITH TIME ZONE,
  expiry_time TIMESTAMP WITH TIME ZONE,
  approval_status TEXT,
  visit_date TIMESTAMP WITH TIME ZONE,
  manually_added BOOLEAN DEFAULT TRUE,
  added_by_guard BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  new_visitor_id UUID;
BEGIN
  -- Direct SQL approach to completely bypass any triggers
  EXECUTE '
    INSERT INTO visitors (
      society_id,
      name,
      phone,
      purpose,
      flat_number,
      resident_id,
      access_code,
      type,
      expected_arrival,
      expiry_time,
      approval_status,
      visit_date,
      manually_added,
      added_by_guard
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id'
  INTO new_visitor_id
  USING 
    society_id,
    name,
    phone,
    purpose,
    flat_number,
    resident_id,
    access_code,
    visitor_type,
    expected_arrival,
    expiry_time,
    approval_status,
    COALESCE(visit_date, NOW()),
    manually_added,
    added_by_guard;
  
  RETURN new_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
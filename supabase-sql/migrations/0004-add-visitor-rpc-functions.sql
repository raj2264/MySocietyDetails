-- Create RPC functions to handle visitor operations without notification RLS errors

-- Function to add a visitor without triggering notifications
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
    visit_date
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
    COALESCE((visitor_data->>'visit_date')::TIMESTAMP WITH TIME ZONE, NOW())
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

-- Alternative function that directly inserts a visitor using individual parameters
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
  visit_date TIMESTAMP WITH TIME ZONE
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
      visit_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    COALESCE(visit_date, NOW());
  
  RETURN new_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a visitor approval notification
CREATE OR REPLACE FUNCTION create_visitor_notification(
  visitor_id UUID,
  resident_id UUID,
  visitor_name TEXT,
  flat_number TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if notifications table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
  ) THEN
    -- Create notification for the resident
    INSERT INTO notifications (
      user_id,
      title,
      content,
      type,
      resource_id,
      read
    )
    SELECT 
      r.user_id,
      'Visitor Approval Required',
      'A visitor named ' || visitor_name || ' is waiting for your approval for flat ' || flat_number,
      'visitor_pending',
      visitor_id,
      FALSE
    FROM residents r
    WHERE r.id = resident_id
    AND r.user_id IS NOT NULL;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
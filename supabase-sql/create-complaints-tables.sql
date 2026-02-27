-- Create complaints table for residents to register complaints
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('personal', 'community')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create complaint comments/updates table
CREATE TABLE IF NOT EXISTS complaint_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for complaints

-- Society admins can view and manage all complaints in their society
CREATE POLICY "Society admins can view all society complaints" 
ON complaints
FOR SELECT
USING (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Society admins can insert complaints" 
ON complaints
FOR INSERT
WITH CHECK (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Society admins can update complaints" 
ON complaints
FOR UPDATE
USING (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
);

-- Residents can view their own personal complaints
CREATE POLICY "Residents can view their own personal complaints" 
ON complaints
FOR SELECT
USING (
  resident_id IN (
    SELECT id FROM residents
    WHERE user_id = auth.uid()
  )
  OR
  (
    type = 'community' 
    AND society_id IN (
      SELECT society_id FROM residents
      WHERE user_id = auth.uid()
    )
  )
);

-- Residents can create complaints
CREATE POLICY "Residents can create complaints" 
ON complaints
FOR INSERT
WITH CHECK (
  resident_id IN (
    SELECT id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- Residents can update only their own complaints
CREATE POLICY "Residents can update their own complaints" 
ON complaints
FOR UPDATE
USING (
  resident_id IN (
    SELECT id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- RLS policies for complaint updates

-- Society admins can view all updates
CREATE POLICY "Society admins can view all complaint updates" 
ON complaint_updates
FOR SELECT
USING (
  complaint_id IN (
    SELECT id FROM complaints
    WHERE society_id IN (
      SELECT society_id FROM society_admins
      WHERE user_id = auth.uid()
    )
  )
);

-- Society admins can add updates to any complaint
CREATE POLICY "Society admins can add updates to complaints" 
ON complaint_updates
FOR INSERT
WITH CHECK (
  complaint_id IN (
    SELECT id FROM complaints
    WHERE society_id IN (
      SELECT society_id FROM society_admins
      WHERE user_id = auth.uid()
    )
  )
);

-- Residents can view updates on complaints they have access to
CREATE POLICY "Residents can view updates on accessible complaints" 
ON complaint_updates
FOR SELECT
USING (
  complaint_id IN (
    SELECT id FROM complaints
    WHERE resident_id IN (
      SELECT id FROM residents
      WHERE user_id = auth.uid()
    )
    OR
    (
      type = 'community' 
      AND society_id IN (
        SELECT society_id FROM residents
        WHERE user_id = auth.uid()
      )
    )
  )
);

-- Residents can add updates to their own complaints
CREATE POLICY "Residents can add updates to their own complaints" 
ON complaint_updates
FOR INSERT
WITH CHECK (
  complaint_id IN (
    SELECT id FROM complaints
    WHERE resident_id IN (
      SELECT id FROM residents
      WHERE user_id = auth.uid()
    )
  )
);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON complaints TO authenticated;
GRANT SELECT, INSERT ON complaint_updates TO authenticated; 
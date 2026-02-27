-- Add attachment columns to poll_options table
ALTER TABLE poll_options
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Update RLS policies to include new columns
DROP POLICY IF EXISTS "Society admins can manage poll options" ON poll_options;
CREATE POLICY "Society admins can manage poll options"
ON poll_options
USING (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN society_admins sa ON p.society_id = sa.society_id
    WHERE sa.user_id = auth.uid()
  )
)
WITH CHECK (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN society_admins sa ON p.society_id = sa.society_id
    WHERE sa.user_id = auth.uid()
  )
);

-- Ensure residents can still view the new columns
DROP POLICY IF EXISTS "Residents can view poll options for their society" ON poll_options;
CREATE POLICY "Residents can view poll options for their society"
ON poll_options FOR SELECT
USING (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN residents r ON p.society_id = r.society_id
    WHERE r.user_id = auth.uid()
  )
); 
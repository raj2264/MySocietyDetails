-- Create polls table for society admins to create polls
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE
);

-- Create poll options table
CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, user_id) -- Ensure each user can only vote once per poll
);

-- Create RLS policies
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Society admins can manage polls for their society
CREATE POLICY "Society admins can manage their polls"
ON polls
USING (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  society_id IN (
    SELECT society_id FROM society_admins
    WHERE user_id = auth.uid()
  )
);

-- Society admins can manage poll options
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

-- Residents can view polls for their society
CREATE POLICY "Residents can view their society polls"
ON polls FOR SELECT
USING (
  society_id IN (
    SELECT society_id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- Residents can view poll options for polls in their society
CREATE POLICY "Residents can view poll options for their society"
ON poll_options FOR SELECT
USING (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN residents r ON p.society_id = r.society_id
    WHERE r.user_id = auth.uid()
  )
);

-- Residents can vote in polls for their society
CREATE POLICY "Residents can vote in polls for their society"
ON poll_votes
USING (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN residents r ON p.society_id = r.society_id
    WHERE r.user_id = auth.uid()
  )
)
WITH CHECK (
  poll_id IN (
    SELECT p.id FROM polls p
    JOIN residents r ON p.society_id = r.society_id
    WHERE r.user_id = auth.uid() 
  ) AND user_id = auth.uid()
);

-- Users can see all votes (for viewing results)
CREATE POLICY "Users can view all poll votes"
ON poll_votes FOR SELECT
USING (TRUE);

-- Create function to notify residents of new polls
CREATE OR REPLACE FUNCTION notify_new_poll()
RETURNS TRIGGER AS $$
BEGIN
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
    'New Poll: ' || NEW.title,
    LEFT(NEW.description, 100) || CASE WHEN LENGTH(NEW.description) > 100 THEN '...' ELSE '' END,
    'poll',
    NEW.id,
    FALSE
  FROM residents r
  WHERE r.society_id = NEW.society_id AND r.user_id IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for the function
DROP TRIGGER IF EXISTS trigger_notify_new_poll ON polls;
CREATE TRIGGER trigger_notify_new_poll
  AFTER INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_poll();

-- Create RLS policy for inserting poll notifications
CREATE POLICY "Allow poll triggers to insert notifications"
ON notifications FOR INSERT
WITH CHECK (type = 'poll');

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON polls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_options TO authenticated;
GRANT SELECT, INSERT, DELETE ON poll_votes TO authenticated;
GRANT INSERT ON notifications TO authenticated; 
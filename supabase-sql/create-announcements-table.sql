-- Create announcements table for society admins to post notices
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_important BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE
);

-- Create RLS policies
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Society admins can manage announcements for their society
CREATE POLICY "Society admins can manage their announcements"
ON announcements
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

-- Residents can view announcements for their society
CREATE POLICY "Residents can view their society announcements"
ON announcements FOR SELECT
USING (
  society_id IN (
    SELECT society_id FROM residents
    WHERE user_id = auth.uid()
  )
);

-- Create a function to notify residents of new announcements
CREATE OR REPLACE FUNCTION notify_new_announcement()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into a notifications table that will be used by the app to show push notifications
  -- This is a simplified version - a real implementation would integrate with a push notification service
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
    NEW.title,
    LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
    'announcement',
    NEW.id,
    FALSE
  FROM residents r
  WHERE r.society_id = NEW.society_id AND r.user_id IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for the function
DROP TRIGGER IF EXISTS trigger_notify_new_announcement ON announcements;
CREATE TRIGGER trigger_notify_new_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_announcement();

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Add RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT SELECT, UPDATE ON notifications TO authenticated; 
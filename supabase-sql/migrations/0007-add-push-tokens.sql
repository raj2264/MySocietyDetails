-- Create a table to store push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Add RLS policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push tokens
CREATE POLICY "Users can manage their own push tokens"
ON push_tokens
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO authenticated;

-- Create a function to send push notifications
CREATE OR REPLACE FUNCTION send_push_notification(
  user_id UUID,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
DECLARE
  push_token TEXT;
BEGIN
  -- Get the user's push token
  SELECT token INTO push_token
  FROM push_tokens
  WHERE push_tokens.user_id = send_push_notification.user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If no token found, return false
  IF push_token IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Send push notification using Supabase Edge Functions
  -- This will be implemented in a separate Edge Function
  PERFORM
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-push-notification'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := jsonb_build_object(
        'token', push_token,
        'title', title,
        'body', body,
        'data', data
      )
    );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify the notify_resident_about_bill function to also send push notifications
CREATE OR REPLACE FUNCTION notify_resident_about_bill()
RETURNS TRIGGER AS $$
DECLARE
  push_sent BOOLEAN;
  resident_user_id UUID;
BEGIN
  -- Check if notifications table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
  ) THEN
    -- Get the resident's user_id first
    SELECT r.user_id INTO resident_user_id
    FROM residents r
    WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;

    -- If we have a user_id, create the notification and send push
    IF resident_user_id IS NOT NULL THEN
      -- Insert notification for the resident
      INSERT INTO notifications (
        user_id,
        title,
        content,
        type,
        resource_id,
        read
      )
      VALUES (
        resident_user_id,
        'New Maintenance Bill Generated',
        'A new maintenance bill of ₹' || NEW.total_amount || ' has been generated for your unit. Due date: ' || 
        TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
        'bill',
        NEW.id,
        FALSE
      );

      -- Try to send push notification
      SELECT send_push_notification(
        resident_user_id,
        'New Maintenance Bill Generated',
        'A new maintenance bill of ₹' || NEW.total_amount || ' has been generated for your unit. Due date: ' || 
        TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
        jsonb_build_object(
          'type', 'bill',
          'bill_id', NEW.id
        )
      ) INTO push_sent;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
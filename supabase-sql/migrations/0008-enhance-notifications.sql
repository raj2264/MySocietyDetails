-- Migration: Enhance Notifications System
-- Description: Updates all notification triggers to include push notifications for all major features
-- Author: Claude
-- Date: 2024

-- First, ensure the notifications table exists
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

-- Add RLS policies for notifications if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, UPDATE ON notifications TO authenticated;

-- Create push_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Add RLS policies for push_tokens if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'push_tokens' 
    AND policyname = 'Users can manage their own push tokens'
  ) THEN
    CREATE POLICY "Users can manage their own push tokens"
    ON push_tokens
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Enable RLS on push_tokens table
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions for push_tokens
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO authenticated;

-- Create or replace the function to send push notifications
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

-- Update the notify_new_announcement function to include push notifications
CREATE OR REPLACE FUNCTION notify_new_announcement()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- Get all residents in the society
  FOR resident_user_id IN 
    SELECT r.user_id 
    FROM residents r 
    WHERE r.society_id = NEW.society_id AND r.user_id IS NOT NULL
  LOOP
    -- Insert notification
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
      NEW.title,
      LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      'announcement',
      NEW.id,
      FALSE
    );

    -- Send push notification
    SELECT send_push_notification(
      resident_user_id,
      NEW.title,
      LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      jsonb_build_object(
        'type', 'announcement',
        'announcement_id', NEW.id
      )
    ) INTO push_sent;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new announcements
DROP TRIGGER IF EXISTS trigger_notify_new_announcement ON announcements;
CREATE TRIGGER trigger_notify_new_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_announcement();

-- Update the notify_new_poll function to include push notifications
CREATE OR REPLACE FUNCTION notify_new_poll()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- Get all residents in the society
  FOR resident_user_id IN 
    SELECT r.user_id 
    FROM residents r 
    WHERE r.society_id = NEW.society_id AND r.user_id IS NOT NULL
  LOOP
    -- Insert notification
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
      'New Poll: ' || NEW.title,
      LEFT(NEW.description, 100) || CASE WHEN LENGTH(NEW.description) > 100 THEN '...' ELSE '' END,
      'poll',
      NEW.id,
      FALSE
    );

    -- Send push notification
    SELECT send_push_notification(
      resident_user_id,
      'New Poll: ' || NEW.title,
      LEFT(NEW.description, 100) || CASE WHEN LENGTH(NEW.description) > 100 THEN '...' ELSE '' END,
      jsonb_build_object(
        'type', 'poll',
        'poll_id', NEW.id
      )
    ) INTO push_sent;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new polls
DROP TRIGGER IF EXISTS trigger_notify_new_poll ON polls;
CREATE TRIGGER trigger_notify_new_poll
  AFTER INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_poll();

-- Update the notify_resident_about_visitor function to include push notifications
CREATE OR REPLACE FUNCTION notify_resident_about_visitor()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- If the visitor has a resident_id and approval_status = 'pending'
  IF NEW.resident_id IS NOT NULL AND NEW.approval_status = 'pending' THEN
    -- Get the resident's user_id
    SELECT r.user_id INTO resident_user_id
    FROM residents r
    WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;

    IF resident_user_id IS NOT NULL THEN
      -- Insert notification
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
        'Visitor Approval Required',
        'A visitor (' || NEW.name || ') is waiting for your approval',
        'visitor_approval',
        NEW.id,
        FALSE
      );

      -- Send push notification
      SELECT send_push_notification(
        resident_user_id,
        'Visitor Approval Required',
        'A visitor (' || NEW.name || ') is waiting for your approval',
        jsonb_build_object(
          'type', 'visitor_approval',
          'visitor_id', NEW.id
        )
      ) INTO push_sent;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for visitor approval requests
DROP TRIGGER IF EXISTS on_visitor_created ON visitors;
CREATE TRIGGER on_visitor_created
  AFTER INSERT ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION notify_resident_about_visitor();

-- Update the handle_visitor_approval_status_change function to include push notifications
CREATE OR REPLACE FUNCTION handle_visitor_approval_status_change()
RETURNS TRIGGER AS $$
DECLARE
  guard_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- If status changed from pending to approved
  IF OLD.approval_status = 'pending' AND NEW.approval_status = 'approved' THEN
    -- Get the guard's user_id
    SELECT user_id INTO guard_user_id
    FROM guards
    WHERE id = NEW.checked_in_by;

    IF guard_user_id IS NOT NULL THEN
      -- Insert notification
      INSERT INTO notifications (
        user_id,
        title,
        content,
        type,
        resource_id,
        read
      )
      VALUES (
        guard_user_id,
        'Visitor Approved',
        'A visitor for flat ' || NEW.flat_number || ' has been approved',
        'visitor_approved',
        NEW.id,
        FALSE
      );

      -- Send push notification
      SELECT send_push_notification(
        guard_user_id,
        'Visitor Approved',
        'A visitor for flat ' || NEW.flat_number || ' has been approved',
        jsonb_build_object(
          'type', 'visitor_approved',
          'visitor_id', NEW.id
        )
      ) INTO push_sent;
    END IF;
  -- If status changed from pending to rejected
  ELSIF OLD.approval_status = 'pending' AND NEW.approval_status = 'rejected' THEN
    -- Get the guard's user_id
    SELECT user_id INTO guard_user_id
    FROM guards
    WHERE id = NEW.checked_in_by;

    IF guard_user_id IS NOT NULL THEN
      -- Insert notification
      INSERT INTO notifications (
        user_id,
        title,
        content,
        type,
        resource_id,
        read
      )
      VALUES (
        guard_user_id,
        'Visitor Rejected',
        'A visitor for flat ' || NEW.flat_number || ' has been rejected',
        'visitor_rejected',
        NEW.id,
        FALSE
      );

      -- Send push notification
      SELECT send_push_notification(
        guard_user_id,
        'Visitor Rejected',
        'A visitor for flat ' || NEW.flat_number || ' has been rejected',
        jsonb_build_object(
          'type', 'visitor_rejected',
          'visitor_id', NEW.id
        )
      ) INTO push_sent;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for visitor approval status changes
DROP TRIGGER IF EXISTS on_visitor_approval_status_change ON visitors;
CREATE TRIGGER on_visitor_approval_status_change
  AFTER UPDATE ON visitors
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION handle_visitor_approval_status_change();

-- Create a function to notify about complaint updates
CREATE OR REPLACE FUNCTION notify_complaint_update()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
  latest_update TEXT;
BEGIN
  -- If this is an update (not a new complaint) and the resident has a user_id
  IF OLD.id IS NOT NULL AND NEW.resident_id IS NOT NULL THEN
    -- Get the resident's user_id
    SELECT r.user_id INTO resident_user_id
    FROM residents r
    WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;

    IF resident_user_id IS NOT NULL THEN
      -- Get the latest admin update if any
      SELECT cu.comment INTO latest_update
      FROM complaint_updates cu
      WHERE cu.complaint_id = NEW.id
        AND cu.is_admin = true
      ORDER BY cu.created_at DESC
      LIMIT 1;

      -- Insert notification
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
        'Update on your complaint: ' || NEW.title,
        COALESCE(latest_update, 'Status updated to: ' || NEW.status),
        'complaint_update',
        NEW.id,
        FALSE
      );

      -- Send push notification
      SELECT send_push_notification(
        resident_user_id,
        'Update on your complaint: ' || NEW.title,
        COALESCE(latest_update, 'Status updated to: ' || NEW.status),
        jsonb_build_object(
          'type', 'complaint_update',
          'complaint_id', NEW.id
        )
      ) INTO push_sent;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for complaint updates
DROP TRIGGER IF EXISTS on_complaint_updated ON complaints;
CREATE TRIGGER on_complaint_updated
  AFTER UPDATE ON complaints
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_complaint_update();

-- Create a trigger for complaint updates from admin comments
CREATE OR REPLACE FUNCTION notify_complaint_admin_update()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- Only notify if this is an admin update
  IF NEW.is_admin = true THEN
    -- Get the resident's user_id from the complaint
    SELECT r.user_id INTO resident_user_id
    FROM residents r
    JOIN complaints c ON c.resident_id = r.id
    WHERE c.id = NEW.complaint_id AND r.user_id IS NOT NULL;

    IF resident_user_id IS NOT NULL THEN
      -- Insert notification
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
        'Admin Response on your complaint',
        NEW.comment,
        'complaint_update',
        NEW.complaint_id,
        FALSE
      );

      -- Send push notification
      SELECT send_push_notification(
        resident_user_id,
        'Admin Response on your complaint',
        NEW.comment,
        jsonb_build_object(
          'type', 'complaint_update',
          'complaint_id', NEW.complaint_id
        )
      ) INTO push_sent;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin updates
DROP TRIGGER IF EXISTS on_complaint_admin_update ON complaint_updates;
CREATE TRIGGER on_complaint_admin_update
  AFTER INSERT ON complaint_updates
  FOR EACH ROW
  WHEN (NEW.is_admin = true)
  EXECUTE FUNCTION notify_complaint_admin_update();

-- Create a function to notify about new complaints
CREATE OR REPLACE FUNCTION notify_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- Get all society admins
  FOR admin_user_id IN 
    SELECT sa.user_id 
    FROM society_admins sa 
    WHERE sa.society_id = NEW.society_id
  LOOP
    -- Insert notification
    INSERT INTO notifications (
      user_id,
      title,
      content,
      type,
      resource_id,
      read
    )
    VALUES (
      admin_user_id,
      'New Complaint: ' || NEW.title,
      LEFT(NEW.description, 100) || CASE WHEN LENGTH(NEW.description) > 100 THEN '...' ELSE '' END,
      'complaint',
      NEW.id,
      FALSE
    );

    -- Send push notification
    SELECT send_push_notification(
      admin_user_id,
      'New Complaint: ' || NEW.title,
      LEFT(NEW.description, 100) || CASE WHEN LENGTH(NEW.description) > 100 THEN '...' ELSE '' END,
      jsonb_build_object(
        'type', 'complaint',
        'complaint_id', NEW.id
      )
    ) INTO push_sent;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new complaints
DROP TRIGGER IF EXISTS on_complaint_created ON complaints;
CREATE TRIGGER on_complaint_created
  AFTER INSERT ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_complaint();

-- Create a function to notify about bill generation
CREATE OR REPLACE FUNCTION notify_resident_about_bill()
RETURNS TRIGGER AS $$
DECLARE
  resident_user_id UUID;
  push_sent BOOLEAN;
BEGIN
  -- Get the resident's user_id
  SELECT r.user_id INTO resident_user_id
  FROM residents r
  WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;

  IF resident_user_id IS NOT NULL THEN
    -- Insert notification
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

    -- Send push notification
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bill generation
DROP TRIGGER IF EXISTS on_bill_created ON maintenance_bills;
CREATE TRIGGER on_bill_created
  AFTER INSERT ON maintenance_bills
  FOR EACH ROW
  EXECUTE FUNCTION notify_resident_about_bill();

-- Create function to mark a single notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN;
BEGIN
  -- Update the notification if it belongs to the current user
  UPDATE notifications
  SET read = TRUE
  WHERE id = notification_id
    AND user_id = auth.uid()
  RETURNING TRUE INTO success;

  RETURN COALESCE(success, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark all notifications as read for the current user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update all unread notifications for the current user
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = auth.uid()
    AND read = FALSE
  RETURNING COUNT(*) INTO updated_count;

  RETURN COALESCE(updated_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete a single notification
CREATE OR REPLACE FUNCTION delete_notification(notification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN;
BEGIN
  -- Delete the notification if it belongs to the current user
  DELETE FROM notifications
  WHERE id = notification_id
    AND user_id = auth.uid()
  RETURNING TRUE INTO success;

  RETURN COALESCE(success, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete all notifications for the current user
CREATE OR REPLACE FUNCTION delete_all_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Get count before deletion
  SELECT COUNT(*) INTO deleted_count
  FROM notifications
  WHERE user_id = auth.uid();

  -- Delete all notifications for the current user
  DELETE FROM notifications
  WHERE user_id = auth.uid();

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy to allow users to delete their own notifications
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can delete their own notifications'
  ) THEN
    CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Grant DELETE permission on notifications table
GRANT DELETE ON notifications TO authenticated;

-- Create RPC endpoints for notification management
CREATE OR REPLACE FUNCTION api_mark_notification_read(notification_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF mark_notification_read(notification_id) THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Notification marked as read'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Failed to mark notification as read'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_mark_all_notifications_read()
RETURNS JSONB AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  updated_count := mark_all_notifications_read();
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'All notifications marked as read',
    'updated_count', updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_delete_notification(notification_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF delete_notification(notification_id) THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Notification deleted'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Failed to delete notification'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION api_delete_all_notifications()
RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  deleted_count := delete_all_notifications();
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'All notifications deleted',
    'deleted_count', deleted_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION api_mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_all_notifications() TO authenticated; 
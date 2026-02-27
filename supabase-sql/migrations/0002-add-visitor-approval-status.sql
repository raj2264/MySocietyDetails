-- Add approval_status to visitors table
DO $$
BEGIN
    -- Add approval_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
        AND column_name = 'approval_status'
    ) THEN
        -- Add approval_status column with default 'approved' for backward compatibility
        ALTER TABLE visitors 
        ADD COLUMN approval_status TEXT DEFAULT 'approved';
        
        -- Create an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_visitors_approval_status ON visitors(approval_status);
        
        RAISE NOTICE 'Added approval_status column to visitors table';
    ELSE
        RAISE NOTICE 'approval_status column already exists in visitors table';
    END IF;

    -- Add is_checked_in flag
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
        AND column_name = 'is_checked_in'
    ) THEN
        -- Add is_checked_in column with default false 
        ALTER TABLE visitors 
        ADD COLUMN is_checked_in BOOLEAN DEFAULT FALSE;
        
        -- Create an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_visitors_is_checked_in ON visitors(is_checked_in);
        
        RAISE NOTICE 'Added is_checked_in column to visitors table';
    ELSE
        RAISE NOTICE 'is_checked_in column already exists in visitors table';
    END IF;
    
    -- Update existing visitors to maintain compatibility
    UPDATE visitors 
    SET approval_status = 'approved', 
        is_checked_in = CASE WHEN check_in_time IS NOT NULL THEN TRUE ELSE FALSE END
    WHERE approval_status IS NULL;
    
END
$$;

-- Create a function to notify residents about visitors requiring approval
CREATE OR REPLACE FUNCTION notify_resident_about_visitor()
RETURNS TRIGGER AS $$
BEGIN
    -- If the visitor has a resident_id and approval_status = 'pending'
    IF NEW.resident_id IS NOT NULL AND NEW.approval_status = 'pending' THEN
        -- Check if notifications table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'notifications'
        ) THEN
            -- Insert notification for the resident
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
                'A visitor (' || NEW.name || ') is waiting for your approval',
                'visitor_approval',
                NEW.id,
                FALSE
            FROM residents r
            WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for the visitor notification function
DROP TRIGGER IF EXISTS on_visitor_created ON visitors;
CREATE TRIGGER on_visitor_created
  AFTER INSERT ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION notify_resident_about_visitor();

-- Create a function to handle visitor approval status changes
CREATE OR REPLACE FUNCTION handle_visitor_approval_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed from pending to approved
    IF OLD.approval_status = 'pending' AND NEW.approval_status = 'approved' THEN
        -- Check if notifications table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'notifications'
        ) THEN
            -- Notify the guard
            INSERT INTO notifications (
                title,
                content,
                type,
                resource_id,
                read
            )
            SELECT 
                'Visitor Approved',
                'A visitor for flat ' || NEW.flat_number || ' has been approved',
                'visitor_approved',
                NEW.id,
                FALSE
            WHERE NEW.checked_in_by IS NOT NULL;
        END IF;
    -- If status changed from pending to rejected
    ELSIF OLD.approval_status = 'pending' AND NEW.approval_status = 'rejected' THEN
        -- Check if notifications table exists
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'notifications'
        ) THEN
            -- Notify the guard
            INSERT INTO notifications (
                title,
                content,
                type,
                resource_id,
                read
            )
            SELECT 
                'Visitor Rejected',
                'A visitor for flat ' || NEW.flat_number || ' has been rejected',
                'visitor_rejected',
                NEW.id,
                FALSE
            WHERE NEW.checked_in_by IS NOT NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for approval status changes
DROP TRIGGER IF EXISTS on_visitor_approval_status_change ON visitors;
CREATE TRIGGER on_visitor_approval_status_change
  AFTER UPDATE OF approval_status ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION handle_visitor_approval_status_change(); 
-- Create a function to notify residents about new bills
CREATE OR REPLACE FUNCTION notify_resident_about_bill()
RETURNS TRIGGER AS $$
BEGIN
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
            'New Maintenance Bill Generated',
            'A new maintenance bill of ₹' || NEW.total_amount || ' has been generated for your unit. Due date: ' || 
            TO_CHAR(NEW.due_date, 'DD/MM/YYYY'),
            'bill',
            NEW.id,
            FALSE
        FROM residents r
        WHERE r.id = NEW.resident_id AND r.user_id IS NOT NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger for the bill notification function
DROP TRIGGER IF EXISTS on_bill_created ON maintenance_bills;
CREATE TRIGGER on_bill_created
  AFTER INSERT ON maintenance_bills
  FOR EACH ROW
  EXECUTE FUNCTION notify_resident_about_bill();

-- Create a policy to allow bill notifications to be inserted
DROP POLICY IF EXISTS "Allow bill notifications to be inserted" ON notifications;
CREATE POLICY "Allow bill notifications to be inserted" 
ON notifications 
FOR INSERT 
WITH CHECK (type = 'bill');

-- Grant necessary permissions
GRANT INSERT ON notifications TO authenticated; 
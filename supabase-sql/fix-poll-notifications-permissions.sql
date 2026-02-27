-- Grant INSERT permission on notifications table to authenticated users
GRANT INSERT ON notifications TO authenticated;

-- Fix the notify_new_poll function to bypass RLS
ALTER FUNCTION notify_new_poll() SECURITY DEFINER;

-- Create better policy for poll notifications
DROP POLICY IF EXISTS "Allow poll notifications to be inserted" ON notifications;
CREATE POLICY "Allow poll notifications to be inserted" 
ON notifications 
FOR INSERT 
WITH CHECK (type = 'poll');

-- Execute the new function
DROP TRIGGER IF EXISTS trigger_notify_new_poll ON polls;
CREATE TRIGGER trigger_notify_new_poll
  AFTER INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_poll();

-- Create the vote count function
CREATE OR REPLACE FUNCTION get_poll_vote_counts(poll_ids UUID[])
RETURNS TABLE (
  poll_id UUID,
  option_id UUID,
  vote_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.poll_id,
    pv.option_id,
    COUNT(pv.id)::BIGINT as vote_count
  FROM 
    poll_votes pv
  WHERE 
    pv.poll_id = ANY(poll_ids)
  GROUP BY 
    pv.poll_id, pv.option_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
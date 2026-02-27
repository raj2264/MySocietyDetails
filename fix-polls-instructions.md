# Fixing Poll Feature Issues

You're encountering two main issues with the polls feature:

1. **Notifications Error**: When creating a poll, you get a row-level security policy error for the notifications table
2. **Vote Counting Error**: When viewing polls, you get a SQL error about GROUP BY requirements

## Solution Instructions

To fix these issues, please run the following SQL in your Supabase SQL Editor:

```sql
-- Fix RLS policies for poll notifications

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
```

## How to Run This SQL

1. Go to your Supabase project dashboard
2. Navigate to the "SQL Editor" from the left sidebar
3. Create a "New Query"
4. Paste the SQL code above
5. Click "Run" to execute the SQL

After running this SQL, both issues should be fixed:
- Poll creation will properly create notifications
- Vote counts will display correctly in the polls view

## Explanation

1. The `SECURITY DEFINER` option allows the function to bypass RLS policies
2. The new policy allows inserting notifications with type 'poll'
3. The new vote counting function properly handles GROUP BY requirements 
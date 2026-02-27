-- Create a function to get vote counts grouped by poll_id and option_id
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
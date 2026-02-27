-- Create a function to delete a complaint
CREATE OR REPLACE FUNCTION delete_complaint(p_complaint_id UUID, p_resident_id UUID)
RETURNS void AS $$
DECLARE
  v_complaint_exists BOOLEAN;
  v_resident_owns_complaint BOOLEAN;
BEGIN
  -- Check if complaint exists and belongs to the resident
  SELECT EXISTS (
    SELECT 1 FROM complaints 
    WHERE id = p_complaint_id 
    AND resident_id = p_resident_id
  ) INTO v_resident_owns_complaint;

  IF NOT v_resident_owns_complaint THEN
    RAISE EXCEPTION 'Complaint not found or you do not have permission to delete it';
  END IF;

  -- Delete the complaint (this will cascade delete updates due to foreign key)
  DELETE FROM complaints 
  WHERE id = p_complaint_id 
  AND resident_id = p_resident_id;

  -- If no rows were deleted, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete complaint';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_complaint(UUID, UUID) TO authenticated; 
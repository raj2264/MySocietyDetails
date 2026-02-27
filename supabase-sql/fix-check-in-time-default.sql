-- Remove default value from check_in_time column
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Remove the default value from check_in_time
        ALTER TABLE visitors 
        ALTER COLUMN check_in_time DROP DEFAULT;
        
        -- Update any existing records that have check_in_time set but no checked_in_by
        UPDATE visitors 
        SET check_in_time = NULL 
        WHERE check_in_time IS NOT NULL 
        AND checked_in_by IS NULL;
        
        RAISE NOTICE 'Removed default value from check_in_time column and cleaned up existing records';
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
END$$; 
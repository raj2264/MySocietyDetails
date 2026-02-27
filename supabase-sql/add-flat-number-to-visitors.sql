-- Add flat_number column to visitors table if it doesn't exist
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Check if flat_number column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'flat_number'
        ) THEN
            -- Add flat_number column if it doesn't exist
            ALTER TABLE visitors 
            ADD COLUMN flat_number TEXT NOT NULL DEFAULT '';
            
            RAISE NOTICE 'Added flat_number column to visitors table';
        ELSE
            RAISE NOTICE 'flat_number column already exists in visitors table';
        END IF;
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
    
    RAISE NOTICE 'Visitors table update complete';
END$$; 
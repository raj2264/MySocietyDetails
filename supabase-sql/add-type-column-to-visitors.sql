-- Add type column to visitors table with a default value
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Check if type column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'type'
        ) THEN
            -- Add type column with a default value to avoid NOT NULL constraint violations
            ALTER TABLE visitors 
            ADD COLUMN type TEXT NOT NULL DEFAULT 'guest';
            
            RAISE NOTICE 'Added type column to visitors table with default value "guest"';
        ELSE
            -- If the column exists but might have NULL values, update the constraint
            UPDATE visitors SET type = 'guest' WHERE type IS NULL;
            RAISE NOTICE 'Updated any NULL type values to "guest"';
        END IF;
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
    
    RAISE NOTICE 'Visitors table update complete';
END$$; 
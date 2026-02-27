-- Add check_in_time and related columns to visitors table
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Check if check_in_time column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'check_in_time'
        ) THEN
            -- Add check_in_time column
            ALTER TABLE visitors 
            ADD COLUMN check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            
            RAISE NOTICE 'Added check_in_time column to visitors table';
        ELSE
            RAISE NOTICE 'check_in_time column already exists in visitors table';
        END IF;

        -- Check if check_out_time column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'check_out_time'
        ) THEN
            -- Add check_out_time column
            ALTER TABLE visitors 
            ADD COLUMN check_out_time TIMESTAMP WITH TIME ZONE;
            
            RAISE NOTICE 'Added check_out_time column to visitors table';
        ELSE
            RAISE NOTICE 'check_out_time column already exists in visitors table';
        END IF;

        -- Check if checked_in_by column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'checked_in_by'
        ) THEN
            -- Add checked_in_by column
            ALTER TABLE visitors 
            ADD COLUMN checked_in_by UUID REFERENCES guards(id);
            
            RAISE NOTICE 'Added checked_in_by column to visitors table';
        ELSE
            RAISE NOTICE 'checked_in_by column already exists in visitors table';
        END IF;

        -- Check if checked_out_by column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'checked_out_by'
        ) THEN
            -- Add checked_out_by column
            ALTER TABLE visitors 
            ADD COLUMN checked_out_by UUID REFERENCES guards(id);
            
            RAISE NOTICE 'Added checked_out_by column to visitors table';
        ELSE
            RAISE NOTICE 'checked_out_by column already exists in visitors table';
        END IF;
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
    
    RAISE NOTICE 'Visitors table update complete';
END$$; 
-- Fix foreign key constraints on visitors table
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Drop existing foreign key constraints
        ALTER TABLE visitors 
        DROP CONSTRAINT IF EXISTS visitors_checked_in_by_fkey,
        DROP CONSTRAINT IF EXISTS visitors_checked_out_by_fkey;
        
        -- Add correct foreign key constraints
        ALTER TABLE visitors 
        ADD CONSTRAINT visitors_checked_in_by_fkey 
        FOREIGN KEY (checked_in_by) 
        REFERENCES guards(id),
        
        ADD CONSTRAINT visitors_checked_out_by_fkey 
        FOREIGN KEY (checked_out_by) 
        REFERENCES guards(id);
        
        RAISE NOTICE 'Fixed foreign key constraints on visitors table';
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
END$$; 
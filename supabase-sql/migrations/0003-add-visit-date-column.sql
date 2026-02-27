-- Add visit_date column to visitors table
DO $$
BEGIN
    -- Add visit_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
        AND column_name = 'visit_date'
    ) THEN
        -- Add visit_date column with default value to avoid not-null constraint errors
        ALTER TABLE visitors 
        ADD COLUMN visit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Create an index for faster queries
        CREATE INDEX IF NOT EXISTS idx_visitors_visit_date ON visitors(visit_date);
        
        RAISE NOTICE 'Added visit_date column to visitors table';
    ELSE
        RAISE NOTICE 'visit_date column already exists in visitors table';
    END IF;
END
$$; 
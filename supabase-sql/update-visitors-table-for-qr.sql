-- Update visitors table to add QR code and unique access code fields
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Check if access_code column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'access_code'
        ) THEN
            -- Add access_code column for unique entry code
            ALTER TABLE visitors 
            ADD COLUMN access_code TEXT;
            
            -- Create a unique index on access_code
            CREATE UNIQUE INDEX IF NOT EXISTS idx_visitors_access_code ON visitors(access_code);
            
            RAISE NOTICE 'Added access_code column to visitors table';
        ELSE
            RAISE NOTICE 'access_code column already exists in visitors table';
        END IF;
        
        -- Check if resident_id column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'resident_id'
        ) THEN
            -- Add resident_id column to track which resident added the visitor
            ALTER TABLE visitors 
            ADD COLUMN resident_id UUID REFERENCES residents(id) ON DELETE SET NULL;
            
            -- Create an index on resident_id for performance
            CREATE INDEX IF NOT EXISTS idx_visitors_resident_id ON visitors(resident_id);
            
            RAISE NOTICE 'Added resident_id column to visitors table';
        ELSE
            RAISE NOTICE 'resident_id column already exists in visitors table';
        END IF;
        
        -- Check if expected_arrival column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'expected_arrival'
        ) THEN
            -- Add expected_arrival column for when the visitor is expected
            ALTER TABLE visitors 
            ADD COLUMN expected_arrival TIMESTAMP WITH TIME ZONE;
            
            RAISE NOTICE 'Added expected_arrival column to visitors table';
        ELSE
            RAISE NOTICE 'expected_arrival column already exists in visitors table';
        END IF;
        
        -- Check if expiry_time column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'expiry_time'
        ) THEN
            -- Add expiry_time column for when the access code expires
            ALTER TABLE visitors 
            ADD COLUMN expiry_time TIMESTAMP WITH TIME ZONE;
            
            RAISE NOTICE 'Added expiry_time column to visitors table';
        ELSE
            RAISE NOTICE 'expiry_time column already exists in visitors table';
        END IF;
        
        -- Update RLS policies to allow residents to manage their own visitors
        DROP POLICY IF EXISTS "Residents can manage their own visitors" ON visitors;
        
        CREATE POLICY "Residents can manage their own visitors" ON visitors
        FOR ALL
        USING (
            resident_id IN (
                SELECT id FROM residents
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            resident_id IN (
                SELECT id FROM residents
                WHERE user_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Updated RLS policies for visitors table';
        
    ELSE
        RAISE NOTICE 'Visitors table does not exist';
    END IF;
    
    RAISE NOTICE 'Visitors table update complete';
END$$; 
-- First check if the visitors table exists
DO $$
BEGIN
    -- Check if the visitors table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'visitors'
    ) THEN
        -- Check if society_id column already exists
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'visitors'
            AND column_name = 'society_id'
        ) THEN
            -- Add society_id column if it doesn't exist
            ALTER TABLE visitors 
            ADD COLUMN society_id UUID REFERENCES societies(id) ON DELETE CASCADE;
            
            -- Create an index on society_id for performance
            CREATE INDEX IF NOT EXISTS idx_visitors_society_id ON visitors(society_id);
            
            RAISE NOTICE 'Added society_id column to visitors table';
        ELSE
            RAISE NOTICE 'society_id column already exists in visitors table';
        END IF;
    ELSE
        -- Create the visitors table from scratch
        CREATE TABLE visitors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phone TEXT,
            purpose TEXT,
            flat_number TEXT NOT NULL,
            check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            check_out_time TIMESTAMP WITH TIME ZONE,
            checked_in_by UUID REFERENCES guards(id),
            checked_out_by UUID REFERENCES guards(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created new visitors table with society_id column';
    END IF;
    
    -- Ensure Row Level Security is enabled
    ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "Society members can view their society's visitors" ON visitors;
    DROP POLICY IF EXISTS "Guards can manage their society's visitors" ON visitors;
    
    -- Create policies for visitors table
    -- Society members (admins, guards, residents) can view visitors for their society
    CREATE POLICY "Society members can view their society's visitors" ON visitors
    FOR SELECT
    USING (
        society_id IN (
        -- Society admins
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
        UNION
        -- Guards
        SELECT society_id FROM guards
        WHERE user_id = auth.uid()
        UNION
        -- Residents
        SELECT society_id FROM residents
        WHERE user_id = auth.uid()
        )
    );
    
    -- Guards can manage visitors for their society
    CREATE POLICY "Guards can manage their society's visitors" ON visitors
    FOR ALL
    USING (
        society_id IN (
        SELECT society_id FROM guards
        WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        society_id IN (
        SELECT society_id FROM guards
        WHERE user_id = auth.uid()
        )
    );
    
    -- Grant permissions
    GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO authenticated;
    
    RAISE NOTICE 'Visitors table setup complete';
END$$; 
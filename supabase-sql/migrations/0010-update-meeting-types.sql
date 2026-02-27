-- First, normalize existing records to lowercase and trim whitespace
UPDATE public.meetings 
SET meeting_type = LOWER(TRIM(meeting_type));

-- Update any existing records to use valid meeting types
UPDATE public.meetings 
SET meeting_type = 'committee' 
WHERE meeting_type NOT IN ('committee', 'annual');

-- Now drop the existing constraint if it exists
ALTER TABLE public.meetings 
DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;

-- Add a trigger to normalize meeting_type before insert/update
CREATE OR REPLACE FUNCTION normalize_meeting_type()
RETURNS TRIGGER AS $$
BEGIN
    NEW.meeting_type := LOWER(TRIM(NEW.meeting_type));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_meeting_type_trigger ON public.meetings;

CREATE TRIGGER normalize_meeting_type_trigger
    BEFORE INSERT OR UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION normalize_meeting_type();

-- Add the new constraint
ALTER TABLE public.meetings 
ADD CONSTRAINT meetings_meeting_type_check 
CHECK (meeting_type = ANY(ARRAY['committee', 'annual']));

-- Log the update results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % records to use valid meeting types', updated_count;
END $$; 
-- Create ca_requests table
CREATE TABLE IF NOT EXISTS public.ca_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('accounting', 'audit')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.ca_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ca_requests

-- Residents can create and view their own requests
CREATE POLICY "Residents can manage their own CA requests"
ON public.ca_requests
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

-- Superadmins can view and manage all CA requests
CREATE POLICY "Superadmins can manage all CA requests"
ON public.ca_requests
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM superadmins
        WHERE superadmins.id = auth.uid()
    )
);

-- Society admins can view CA requests for their society
CREATE POLICY "Society admins can view CA requests"
ON public.ca_requests
FOR SELECT
USING (
    society_id IN (
        SELECT society_id FROM society_admins
        WHERE user_id = auth.uid()
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ca_requests_society_id ON public.ca_requests(society_id);
CREATE INDEX IF NOT EXISTS idx_ca_requests_resident_id ON public.ca_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_ca_requests_status ON public.ca_requests(status);
CREATE INDEX IF NOT EXISTS idx_ca_requests_request_type ON public.ca_requests(request_type);

-- Grant necessary permissions
GRANT ALL ON public.ca_requests TO authenticated;

-- Create function to notify superadmins about new CA requests
CREATE OR REPLACE FUNCTION notify_superadmin_about_ca_request()
RETURNS TRIGGER AS $$
DECLARE
    superadmin_id UUID;
    push_sent BOOLEAN;
BEGIN
    -- Notify all superadmins
    FOR superadmin_id IN 
        SELECT id FROM superadmins
    LOOP
        -- Insert notification
        INSERT INTO notifications (
            user_id,
            title,
            content,
            type,
            resource_id,
            read
        )
        VALUES (
            superadmin_id,
            'New CA Request',
            'A new CA request for ' || NEW.request_type || ' has been submitted by ' || NEW.name,
            'ca_request',
            NEW.id,
            FALSE
        );

        -- Send push notification
        SELECT send_push_notification(
            superadmin_id,
            'New CA Request',
            'A new CA request for ' || NEW.request_type || ' has been submitted by ' || NEW.name,
            jsonb_build_object(
                'type', 'ca_request',
                'request_id', NEW.id
            )
        ) INTO push_sent;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new CA requests
CREATE TRIGGER on_ca_request_created
    AFTER INSERT ON public.ca_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_superadmin_about_ca_request(); 
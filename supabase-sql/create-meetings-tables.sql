-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_type TEXT NOT NULL CHECK (meeting_type IN ('quarterly', 'annual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

-- Create meeting minutes table
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for meetings table
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society admins can create meetings" ON public.meetings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            WHERE sa.society_id = meetings.society_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Society admins can update their society's meetings" ON public.meetings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            WHERE sa.society_id = meetings.society_id
            AND sa.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            WHERE sa.society_id = meetings.society_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Society admins can delete their society's meetings" ON public.meetings
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            WHERE sa.society_id = meetings.society_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Society admins can view their society's meetings" ON public.meetings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            WHERE sa.society_id = meetings.society_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Residents can view meetings of their society" ON public.meetings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.residents r
            WHERE r.society_id = meetings.society_id
            AND r.user_id = auth.uid()
        )
    );

-- Create RLS policies for meeting minutes table
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society admins can create meeting minutes" ON public.meeting_minutes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            JOIN public.meetings m ON m.society_id = sa.society_id
            WHERE m.id = meeting_minutes.meeting_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Society admins can update meeting minutes" ON public.meeting_minutes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            JOIN public.meetings m ON m.society_id = sa.society_id
            WHERE m.id = meeting_minutes.meeting_id
            AND sa.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            JOIN public.meetings m ON m.society_id = sa.society_id
            WHERE m.id = meeting_minutes.meeting_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Society admins can view meeting minutes" ON public.meeting_minutes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.society_admins sa
            JOIN public.meetings m ON m.society_id = sa.society_id
            WHERE m.id = meeting_minutes.meeting_id
            AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY "Residents can view meeting minutes of their society" ON public.meeting_minutes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.residents r
            JOIN public.meetings m ON m.society_id = r.society_id
            WHERE m.id = meeting_minutes.meeting_id
            AND r.user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_meeting_minutes_updated_at
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at(); 
-- Create apartment listings table
CREATE TABLE IF NOT EXISTS public.apartment_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    apartment_number TEXT NOT NULL,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    contact_phone TEXT,
    contact_email TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for apartment_listings table
ALTER TABLE public.apartment_listings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Residents can manage their own listings" ON public.apartment_listings;
DROP POLICY IF EXISTS "Society admins can view listings for their society" ON public.apartment_listings;
DROP POLICY IF EXISTS "Superadmins can view all listings" ON public.apartment_listings;

-- Residents can create and manage their own listings
CREATE POLICY "Residents can manage their own listings" ON public.apartment_listings
    FOR ALL
    USING (resident_id = (SELECT id FROM residents WHERE user_id = auth.uid()))
    WITH CHECK (resident_id = (SELECT id FROM residents WHERE user_id = auth.uid()));

-- Society admins can view listings for their society
CREATE POLICY "Society admins can view listings for their society" ON public.apartment_listings
    FOR SELECT
    USING (
        society_id IN (
            SELECT society_id FROM society_admins
            WHERE user_id = auth.uid()
        )
    );

-- Superadmins can view all listings
CREATE POLICY "Superadmins can view all listings" ON public.apartment_listings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM superadmins
            WHERE user_id = auth.uid()
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartment_listings TO authenticated; 
-- Insert a test apartment listing
-- First, get the first society and resident IDs
DO $$
DECLARE
    v_society_id UUID;
    v_resident_id UUID;
BEGIN
    -- Get the first society ID
    SELECT id INTO v_society_id FROM societies LIMIT 1;
    
    -- Get the first resident ID
    SELECT id INTO v_resident_id FROM residents LIMIT 1;
    
    -- Insert the test listing
    INSERT INTO apartment_listings (
        society_id,
        resident_id,
        apartment_number,
        listing_type,
        title,
        description,
        price,
        contact_phone,
        contact_email,
        is_available
    ) VALUES (
        v_society_id,
        v_resident_id,
        '101',
        'rent',
        'Spacious 2BHK Apartment for Rent',
        'Beautiful 2BHK apartment with modern amenities, available for rent. Located in a prime area with 24/7 security.',
        25000.00,
        '+919876543210',
        'resident@example.com',
        true
    );
END $$; 
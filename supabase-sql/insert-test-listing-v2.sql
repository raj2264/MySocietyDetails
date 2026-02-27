-- Insert a test apartment listing with better error handling
DO $$
DECLARE
    v_society_id UUID;
    v_resident_id UUID;
    v_inserted_id UUID;
BEGIN
    -- Get the first society ID
    SELECT id INTO v_society_id FROM societies LIMIT 1;
    IF v_society_id IS NULL THEN
        RAISE EXCEPTION 'No society found in the database';
    END IF;
    
    -- Get the first resident ID
    SELECT id INTO v_resident_id FROM residents LIMIT 1;
    IF v_resident_id IS NULL THEN
        RAISE EXCEPTION 'No resident found in the database';
    END IF;
    
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
    )
    RETURNING id INTO v_inserted_id;
    
    -- Log the insertion
    RAISE NOTICE 'Successfully inserted test listing with ID: %', v_inserted_id;
    
    -- Verify the insertion
    IF NOT EXISTS (
        SELECT 1 FROM apartment_listings WHERE id = v_inserted_id
    ) THEN
        RAISE EXCEPTION 'Failed to verify the insertion of the test listing';
    END IF;
    
    -- Log the verification
    RAISE NOTICE 'Successfully verified the test listing insertion';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred: %', SQLERRM;
        RAISE;
END $$; 
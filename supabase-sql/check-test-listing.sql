-- Check if the test listing exists
SELECT 
    al.*,
    s.name as society_name,
    r.name as resident_name,
    r.email as resident_email
FROM apartment_listings al
JOIN societies s ON al.society_id = s.id
JOIN residents r ON al.resident_id = r.id;

-- Check if the superadmin policy is working
SELECT 
    al.*,
    s.name as society_name,
    r.name as resident_name,
    r.email as resident_email
FROM apartment_listings al
JOIN societies s ON al.society_id = s.id
JOIN residents r ON al.resident_id = r.id
WHERE EXISTS (
    SELECT 1 FROM superadmins
    WHERE user_id = auth.uid()
);

-- Check if the test listing was inserted correctly
SELECT 
    al.*,
    s.name as society_name,
    r.name as resident_name,
    r.email as resident_email
FROM apartment_listings al
JOIN societies s ON al.society_id = s.id
JOIN residents r ON al.resident_id = r.id
WHERE al.apartment_number = '101'
AND al.title = 'Spacious 2BHK Apartment for Rent'; 
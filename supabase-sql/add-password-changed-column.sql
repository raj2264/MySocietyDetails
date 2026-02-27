-- Add password_changed column to residents table
ALTER TABLE residents
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT FALSE;

-- Update existing residents to have password_changed = true
UPDATE residents
SET password_changed = true
WHERE password_changed IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN residents.password_changed IS 'Indicates whether the resident has changed their password after first login'; 
-- Remove password_changed column from residents table
ALTER TABLE residents
DROP COLUMN IF EXISTS password_changed; 
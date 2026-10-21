-- Migration: Add event customization columns (subtitle, organization_name)
-- and support dynamic event configuration

ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT '60 seconds. One hour. Type your way to the top.';
ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'TENSOR';

-- Update the default seed event with subtitle and organization_name if present
UPDATE events 
SET 
  subtitle = COALESCE(subtitle, '60 seconds. One hour. Type your way to the top.'),
  organization_name = COALESCE(organization_name, 'TENSOR')
WHERE id = '00000000-0000-0000-0000-000000000001';

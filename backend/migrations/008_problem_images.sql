-- Add image_url column to problems table for visual support
ALTER TABLE problems ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Add image_url to scaffold_steps for step-specific images
ALTER TABLE scaffold_steps ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Add grade level to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade INTEGER DEFAULT 3;

-- Update existing classes to have grade 3 as default
UPDATE classes SET grade = 3 WHERE grade IS NULL;

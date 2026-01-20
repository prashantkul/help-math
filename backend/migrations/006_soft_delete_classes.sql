-- Add soft delete to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for filtering out deleted classes
CREATE INDEX IF NOT EXISTS idx_classes_deleted_at ON classes(deleted_at);

-- Migration 010: Scan Pipeline - batch paper intake system
-- Supports both style scan (training) and grade scan (inference) modes

CREATE TABLE IF NOT EXISTS scan_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('style', 'grade')),
    assignment_id TEXT REFERENCES assignments(id),
    class_id TEXT REFERENCES classes(id),
    total_pages INTEGER NOT NULL DEFAULT 0,
    pages_processed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS scan_pages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    batch_id TEXT NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    student_id TEXT REFERENCES students(id),
    student_name_detected TEXT,
    student_match_confidence DECIMAL,
    match_type TEXT,
    teacher_confirmed BOOLEAN DEFAULT FALSE,
    processing_status TEXT DEFAULT 'pending',
    result_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_batches_teacher ON scan_batches(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_pages_batch ON scan_pages(batch_id, page_number);

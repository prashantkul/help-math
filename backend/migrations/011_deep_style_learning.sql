-- Migration 011: Deep Style Learning - 4-Tier Architecture
-- Tier 1: Raw Extraction (annotations with context)
-- Tier 2: Pattern Synthesis (conditional style model)
-- Tier 3: Application (enhanced grading)
-- Tier 4: Continuous Learning (corrections feedback loop)

-- Add deep style columns to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS style_model JSONB DEFAULT '{}';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS style_overrides JSONB DEFAULT '{}';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS style_updated_at TIMESTAMPTZ;

-- Update style_samples to support Tier 1 extraction status
ALTER TABLE style_samples ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';
ALTER TABLE style_samples ADD COLUMN IF NOT EXISTS raw_extraction JSONB DEFAULT '{}';
ALTER TABLE style_samples ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Individual annotations extracted from samples (Tier 1 output, normalized)
CREATE TABLE IF NOT EXISTS style_annotations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sample_id TEXT REFERENCES style_samples(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    annotation_text TEXT,
    annotation_type TEXT NOT NULL,
    location TEXT,
    student_work_nearby TEXT,
    student_was_correct BOOLEAN,
    error_type TEXT,
    subject_area TEXT,
    work_shown BOOLEAN,
    apparent_intent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier 2 synthesis history
CREATE TABLE IF NOT EXISTS style_syntheses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    sample_count INTEGER NOT NULL,
    annotation_count INTEGER NOT NULL,
    model_output JSONB NOT NULL,
    confidence_score DECIMAL NOT NULL,
    gaps TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher corrections to AI feedback (Tier 4 input)
CREATE TABLE IF NOT EXISTS style_corrections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(id),
    submission_id TEXT,
    assignment_context TEXT,
    student_work_summary TEXT,
    ai_feedback TEXT NOT NULL,
    teacher_feedback TEXT NOT NULL,
    correction_analysis JSONB DEFAULT '{}',
    applied_to_model BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Style validation test results
CREATE TABLE IF NOT EXISTS style_tests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    test_items JSONB NOT NULL,
    results JSONB DEFAULT '{}',
    approval_rate DECIMAL,
    corrections_made JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_style_annotations_teacher ON style_annotations(teacher_id);
CREATE INDEX IF NOT EXISTS idx_style_annotations_intent ON style_annotations(teacher_id, apparent_intent);
CREATE INDEX IF NOT EXISTS idx_style_annotations_sample ON style_annotations(sample_id);
CREATE INDEX IF NOT EXISTS idx_style_corrections_teacher ON style_corrections(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_style_corrections_unapplied ON style_corrections(teacher_id) WHERE applied_to_model = false;
CREATE INDEX IF NOT EXISTS idx_style_syntheses_teacher ON style_syntheses(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_style_tests_teacher ON style_tests(teacher_id, created_at DESC);

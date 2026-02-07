-- Migration 009: Teacher Style Learning + AI-Assisted Grading
-- Feature 1: Teacher style profiles from scanned graded papers
-- Feature 2: AI grading in teacher's voice

-- Add style profile columns to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS style_profile JSONB DEFAULT '{}';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS style_confidence DECIMAL DEFAULT 0.0;

-- Style samples: uploaded scanned graded papers
CREATE TABLE IF NOT EXISTS style_samples (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    extracted_annotations JSONB DEFAULT '{}',
    feedback_patterns JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graded submissions: AI-assisted grading in teacher's voice
CREATE TABLE IF NOT EXISTS graded_submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{}',
    scanned_file TEXT,
    ai_feedback TEXT,
    ai_score DECIMAL,
    ai_skill_gaps TEXT[] DEFAULT '{}',
    teacher_approved BOOLEAN DEFAULT FALSE,
    teacher_edits TEXT,
    final_feedback TEXT,
    final_score DECIMAL,
    status TEXT DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_style_samples_teacher ON style_samples(teacher_id);
CREATE INDEX IF NOT EXISTS idx_graded_submissions_assignment ON graded_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_graded_submissions_student ON graded_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_graded_submissions_status ON graded_submissions(status);

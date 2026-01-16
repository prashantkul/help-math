-- Math Scaffold App - Initial Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Teachers table
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_teachers_email ON teachers(email);

-- Classes table
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    join_code VARCHAR(6) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{"ell_level": 2, "show_emojis": true, "retry_limit": 3, "point_multiplier": 1}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_join_code ON classes(join_code);

-- Students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    avatar VARCHAR(50) DEFAULT 'bear' NOT NULL,
    total_points INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_students_class_id ON students(class_id);

-- Problems table (original problems from PDF uploads)
CREATE TABLE problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    simplified_text TEXT,
    skill_tags VARCHAR(50)[] DEFAULT '{}' NOT NULL,
    difficulty INT DEFAULT 1 NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    week_number INT,
    scene_emoji VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_problems_class_id ON problems(class_id);
CREATE INDEX idx_problems_is_published ON problems(is_published);

-- Scaffold steps table (AI-generated, teacher-approved)
CREATE TABLE scaffold_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    prompt_text TEXT NOT NULL,
    simplified_text TEXT,
    correct_answer JSONB NOT NULL,
    answer_type VARCHAR(50) NOT NULL,
    options JSONB,
    hints TEXT[] DEFAULT '{}' NOT NULL,
    points INT DEFAULT 10 NOT NULL,
    emoji_hint VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(problem_id, step_order)
);

CREATE INDEX idx_scaffold_steps_problem_id ON scaffold_steps(problem_id);

-- Student progress table
CREATE TABLE student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    current_step INT DEFAULT 0 NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE NOT NULL,
    total_points_earned INT DEFAULT 0 NOT NULL,
    stars_earned INT DEFAULT 0 NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    UNIQUE(student_id, problem_id)
);

CREATE INDEX idx_student_progress_student_id ON student_progress(student_id);
CREATE INDEX idx_student_progress_problem_id ON student_progress(problem_id);

-- Step attempts table (for analytics)
CREATE TABLE step_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES scaffold_steps(id) ON DELETE CASCADE,
    progress_id UUID NOT NULL REFERENCES student_progress(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    answer_given JSONB NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_earned INT DEFAULT 0 NOT NULL,
    time_spent_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_step_attempts_student_id ON step_attempts(student_id);
CREATE INDEX idx_step_attempts_step_id ON step_attempts(step_id);
CREATE INDEX idx_step_attempts_progress_id ON step_attempts(progress_id);

-- Assignments table (grouping problems for a week)
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    week_start DATE,
    week_end DATE,
    problem_ids UUID[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_assignments_class_id ON assignments(class_id);

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS VARCHAR(6) AS $$
DECLARE
    chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code VARCHAR(6) := '';
    i INT;
BEGIN
    FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join code for new classes
CREATE OR REPLACE FUNCTION set_join_code() RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := generate_join_code();
        SELECT EXISTS(SELECT 1 FROM classes WHERE join_code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.join_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_join_code
    BEFORE INSERT ON classes
    FOR EACH ROW
    WHEN (NEW.join_code IS NULL OR NEW.join_code = '')
    EXECUTE FUNCTION set_join_code();

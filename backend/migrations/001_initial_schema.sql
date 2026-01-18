-- Math Scaffold App - Initial Database Schema (PostgreSQL)

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY NOT NULL,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{"ell_level": 2, "show_emojis": true, "retry_limit": 3, "point_multiplier": 1}'::jsonb NOT NULL,
    purpose TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);

-- Students table (created by teachers, students join with passcode)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    external_id TEXT,  -- Teacher's internal student ID for roster correlation
    roster_id TEXT,    -- Teacher's roster reference
    notes TEXT,        -- Teacher notes about student
    passcode TEXT NOT NULL,  -- Unique passcode for student to join (e.g., "bear-7823")
    avatar TEXT DEFAULT 'bear' NOT NULL,
    total_points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(class_id, passcode)  -- Passcode unique within class
);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_passcode ON students(class_id, passcode);

-- Problems table (original problems from PDF uploads)
CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY NOT NULL,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    lesson_id TEXT,  -- Added later, references lessons table
    original_text TEXT NOT NULL,
    simplified_text TEXT,
    skill_tags JSONB DEFAULT '[]'::jsonb NOT NULL,
    difficulty INTEGER DEFAULT 1 NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    state TEXT DEFAULT 'draft' NOT NULL,  -- draft, scaffolded, reviewed, published
    week_number INTEGER,
    scene_emoji TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_problems_class_id ON problems(class_id);
CREATE INDEX IF NOT EXISTS idx_problems_is_published ON problems(is_published);

-- Scaffold steps table (AI-generated, teacher-approved)
CREATE TABLE IF NOT EXISTS scaffold_steps (
    id TEXT PRIMARY KEY NOT NULL,
    problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    simplified_text TEXT,
    correct_answer TEXT NOT NULL,
    answer_type TEXT NOT NULL,
    options JSONB,
    hints JSONB DEFAULT '[]'::jsonb NOT NULL,
    points INTEGER DEFAULT 10 NOT NULL,
    emoji_hint TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(problem_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_scaffold_steps_problem_id ON scaffold_steps(problem_id);

-- Student progress table
CREATE TABLE IF NOT EXISTS student_progress (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0 NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE NOT NULL,
    total_points_earned INTEGER DEFAULT 0 NOT NULL,
    stars_earned INTEGER DEFAULT 0 NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMPTZ,
    UNIQUE(student_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_problem_id ON student_progress(problem_id);

-- Step attempts table (for analytics)
CREATE TABLE IF NOT EXISTS step_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL REFERENCES scaffold_steps(id) ON DELETE CASCADE,
    progress_id TEXT NOT NULL REFERENCES student_progress(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    answer_given TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_earned INTEGER DEFAULT 0 NOT NULL,
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_step_attempts_student_id ON step_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_step_attempts_step_id ON step_attempts(step_id);
CREATE INDEX IF NOT EXISTS idx_step_attempts_progress_id ON step_attempts(progress_id);

-- Assignments table (grouping problems for a week)
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY NOT NULL,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    week_start DATE,
    week_end DATE,
    problem_ids JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);

-- Co-teachers table (teachers who can manage a class but aren't the owner)
CREATE TABLE IF NOT EXISTS class_teachers (
    id TEXT PRIMARY KEY NOT NULL,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    added_by TEXT NOT NULL REFERENCES teachers(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON class_teachers(teacher_id);

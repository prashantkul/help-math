-- Seed data for testing
-- This creates test accounts matching TEST_CREDENTIALS.md

-- Teacher 1: Sarah Johnson (password: 'password123' - bcrypt hash)
INSERT OR IGNORE INTO teachers (id, email, password_hash, name, created_at)
VALUES (
    'teacher-sarah-001',
    'teacher1@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.tTtZzPXqLXO1Uy',
    'Sarah Johnson',
    datetime('now')
);

-- Teacher 2: Michael Chen (password: 'password123' - bcrypt hash)
INSERT OR IGNORE INTO teachers (id, email, password_hash, name, created_at)
VALUES (
    'teacher-michael-002',
    'teacher2@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.tTtZzPXqLXO1Uy',
    'Michael Chen',
    datetime('now')
);

-- Class 1: 3rd Grade Math - Room 101 (Join Code: 96T2A2)
INSERT OR IGNORE INTO classes (id, teacher_id, name, join_code, settings, created_at)
VALUES (
    'class-3rd-grade-101',
    'teacher-sarah-001',
    '3rd Grade Math - Room 101',
    '96T2A2',
    '{"ell_level": 2, "show_emojis": true}',
    datetime('now')
);

-- Class 2: 4th Grade Math - Room 205 (Join Code: 6Y78B7)
INSERT OR IGNORE INTO classes (id, teacher_id, name, join_code, settings, created_at)
VALUES (
    'class-4th-grade-205',
    'teacher-michael-002',
    '4th Grade Math - Room 205',
    '6Y78B7',
    '{"ell_level": 2, "show_emojis": true}',
    datetime('now')
);

-- Students for Class 1: 3rd Grade Math (passcodes are 4-digit codes)
INSERT OR IGNORE INTO students (id, class_id, name, passcode, avatar, total_points, created_at)
VALUES
    ('student-001', 'class-3rd-grade-101', 'Student A1', '1111', 'bear', 0, datetime('now')),
    ('student-002', 'class-3rd-grade-101', 'Student A2', '2222', 'cat', 0, datetime('now')),
    ('student-003', 'class-3rd-grade-101', 'Student A3', '3333', 'dog', 0, datetime('now'));

-- Students for Class 2: 4th Grade Math (passcodes are 4-digit codes)
INSERT OR IGNORE INTO students (id, class_id, name, passcode, avatar, total_points, created_at)
VALUES
    ('student-004', 'class-4th-grade-205', 'Student B1', '4444', 'fox', 0, datetime('now')),
    ('student-005', 'class-4th-grade-205', 'Student B2', '5555', 'panda', 0, datetime('now'));

-- Module for Class 1
INSERT OR IGNORE INTO modules (id, class_id, name, description, sort_order, is_published, created_at)
VALUES (
    'module-addition-101',
    'class-3rd-grade-101',
    'Addition & Subtraction',
    'Practice adding and subtracting numbers',
    1,
    1,
    datetime('now')
);

-- Lessons for Class 1
INSERT OR IGNORE INTO lessons (id, module_id, name, description, sort_order, is_published, created_at)
VALUES
    ('lesson-single-digit', 'module-addition-101', 'Single Digit Addition', 'Adding numbers 1-9', 1, 1, datetime('now')),
    ('lesson-double-digit', 'module-addition-101', 'Double Digit Addition', 'Adding numbers 10-99', 2, 1, datetime('now'));

-- Sample problem with scaffolding steps
INSERT OR IGNORE INTO problems (id, class_id, lesson_id, original_text, simplified_text, skill_tags, difficulty, is_published, scene_emoji, created_at)
VALUES (
    'problem-apples-001',
    'class-3rd-grade-101',
    'lesson-single-digit',
    'Maria has 5 apples. Her friend gives her 3 more apples. How many apples does Maria have now?',
    'Maria has 5 apples. She gets 3 more. How many total?',
    '["addition"]',
    1,
    1,
    '🍎',
    datetime('now')
);

-- Scaffold steps for the sample problem
INSERT OR IGNORE INTO scaffold_steps (id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at)
VALUES
    ('step-001', 'problem-apples-001', 0, 'find_objects', 'What is this problem about?', 'What things are we counting?', '"apples"', 'multiple_choice', '[{"value": "apples", "label": "Apples"}, {"value": "oranges", "label": "Oranges"}, {"value": "bananas", "label": "Bananas"}]', '["Look for the thing being counted", "It is a fruit"]', 10, '🍎', datetime('now')),
    ('step-002', 'problem-apples-001', 1, 'find_numbers', 'How many apples does Maria start with?', 'How many at the start?', '5', 'number_input', NULL, '["Read the first sentence", "Look for the first number"]', 10, '5️⃣', datetime('now')),
    ('step-003', 'problem-apples-001', 2, 'find_numbers', 'How many more apples does Maria get?', 'How many more?', '3', 'number_input', NULL, '["Read about what her friend gives", "Look for the second number"]', 10, '3️⃣', datetime('now')),
    ('step-004', 'problem-apples-001', 3, 'identify_operation', 'What operation should we use?', 'Add or subtract?', '"+"', 'multiple_choice', '[{"value": "+", "label": "Add (+)"}, {"value": "-", "label": "Subtract (-)"}]', '["She is getting MORE apples", "When we get more, we add"]', 10, '➕', datetime('now')),
    ('step-005', 'problem-apples-001', 4, 'solve', 'What is 5 + 3?', 'Solve: 5 + 3 = ?', '8', 'number_input', NULL, '["Count 5, then add 3 more", "Use your fingers if needed"]', 20, '🎯', datetime('now'));

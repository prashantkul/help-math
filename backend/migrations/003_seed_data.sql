-- Seed data for testing
-- This creates default test accounts for easier development and testing

-- Test teacher account (password: 'testpass123' - hashed with bcrypt)
INSERT OR IGNORE INTO teachers (id, email, password_hash, name, created_at)
VALUES (
    'test-teacher-001',
    'teacher@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.tTtZzPXqLXO1Uy',
    'Test Teacher',
    datetime('now')
);

-- Test class for the teacher
INSERT OR IGNORE INTO classes (id, teacher_id, name, join_code, settings, created_at)
VALUES (
    'test-class-001',
    'test-teacher-001',
    'Test Math Class',
    'TEST123',
    '{"ell_level": 2, "show_emojis": true}',
    datetime('now')
);

-- Test students (passcodes are simple 4-digit codes for testing)
INSERT OR IGNORE INTO students (id, class_id, name, passcode, avatar, total_points, created_at)
VALUES
    ('test-student-001', 'test-class-001', 'Alice Student', '1234', 'bear', 0, datetime('now')),
    ('test-student-002', 'test-class-001', 'Bob Student', '5678', 'cat', 0, datetime('now')),
    ('test-student-003', 'test-class-001', 'Charlie Student', '9012', 'dog', 0, datetime('now'));

-- Test module
INSERT OR IGNORE INTO modules (id, class_id, name, description, sort_order, is_published, created_at)
VALUES (
    'test-module-001',
    'test-class-001',
    'Addition & Subtraction',
    'Practice adding and subtracting numbers',
    1,
    1,
    datetime('now')
);

-- Test lessons
INSERT OR IGNORE INTO lessons (id, module_id, name, description, sort_order, is_published, created_at)
VALUES
    ('test-lesson-001', 'test-module-001', 'Single Digit Addition', 'Adding numbers 1-9', 1, 1, datetime('now')),
    ('test-lesson-002', 'test-module-001', 'Double Digit Addition', 'Adding numbers 10-99', 2, 1, datetime('now'));

-- Test problem with scaffolding steps
INSERT OR IGNORE INTO problems (id, class_id, lesson_id, original_text, simplified_text, skill_tags, difficulty, is_published, scene_emoji, created_at)
VALUES (
    'test-problem-001',
    'test-class-001',
    'test-lesson-001',
    'Maria has 5 apples. Her friend gives her 3 more apples. How many apples does Maria have now?',
    'Maria has 5 apples. She gets 3 more. How many total?',
    '["addition"]',
    1,
    1,
    '🍎',
    datetime('now')
);

-- Scaffold steps for the test problem
INSERT OR IGNORE INTO scaffold_steps (id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at)
VALUES
    ('test-step-001', 'test-problem-001', 0, 'find_objects', 'What is this problem about?', 'What things are we counting?', '"apples"', 'multiple_choice', '[{"value": "apples", "label": "Apples"}, {"value": "oranges", "label": "Oranges"}, {"value": "bananas", "label": "Bananas"}]', '["Look for the thing being counted", "It is a fruit"]', 10, '🍎', datetime('now')),
    ('test-step-002', 'test-problem-001', 1, 'find_numbers', 'How many apples does Maria start with?', 'How many at the start?', '5', 'number_input', NULL, '["Read the first sentence", "Look for the first number"]', 10, '5️⃣', datetime('now')),
    ('test-step-003', 'test-problem-001', 2, 'find_numbers', 'How many more apples does Maria get?', 'How many more?', '3', 'number_input', NULL, '["Read about what her friend gives", "Look for the second number"]', 10, '3️⃣', datetime('now')),
    ('test-step-004', 'test-problem-001', 3, 'identify_operation', 'What operation should we use?', 'Add or subtract?', '"+"', 'multiple_choice', '[{"value": "+", "label": "Add (+)"}, {"value": "-", "label": "Subtract (-)"}]', '["She is getting MORE apples", "When we get more, we add"]', 10, '➕', datetime('now')),
    ('test-step-005', 'test-problem-001', 4, 'solve', 'What is 5 + 3?', 'Solve: 5 + 3 = ?', '8', 'number_input', NULL, '["Count 5, then add 3 more", "Use your fingers if needed"]', 20, '🎯', datetime('now'));

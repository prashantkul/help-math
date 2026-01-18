# Test Data for Help Math

This folder contains test data files for Phase 2 feature testing.

## Files

### PDF Problems
| File | Description |
|------|-------------|
| `grade_3_mixed_addition_subtraction_word_problems_a1.pdf` | Grade 3 math problems for PDF upload testing |

### CSV Files (Bulk Import)
| File | Description |
|------|-------------|
| `bulk_import_students.csv` | Standard import with 10 students |
| `bulk_import_edge_cases.csv` | Edge cases: duplicates, special chars, empty fields |

### JSON Test Data
| File | Description |
|------|-------------|
| `sample_student_ids.json` | Student IDs in `{animal}-{number}` format |
| `sample_problems.json` | Problems in different states (draft, scaffolded, reviewed, published) |
| `sample_classes.json` | Class configurations with different settings |
| `sample_lesson_schedules.json` | Lesson release scheduling scenarios |
| `password_reset_scenarios.json` | Password reset test cases |

---

## Usage by Feature

### T3.4 Bulk Student Import
```bash
# Test standard import
curl -X POST /api/classes/{id}/students/bulk-import \
  -F "file=@test_data/bulk_import_students.csv"

# Test edge cases
curl -X POST /api/classes/{id}/students/bulk-import \
  -F "file=@test_data/bulk_import_edge_cases.csv"
```

### T6.2 PDF Upload
```bash
curl -X POST /api/problems/upload \
  -F "file=@test_data/grade_3_mixed_addition_subtraction_word_problems_a1.pdf" \
  -F "class_id={class_id}"
```

### T6.3 Problem State Workflow
Use `sample_problems.json` to test state transitions:
- `problem_draft_001` → Generate scaffold → Should become "scaffolded"
- `problem_scaffolded_001` → Publish → Should become "published"
- `problem_published_001` → Unpublish → Should freeze student access

### T5.5 Lesson Release Scheduling
Use `sample_lesson_schedules.json` test scenarios:
- `sequential_80_percent_threshold` - Test 80% unlock
- `sequential_round_down` - Test round-down with 3 problems
- `timezone_test` - Test scheduled release with timezone

### T1.3 Password Reset
Use `password_reset_scenarios.json` for:
- Valid/invalid email requests
- Token expiration (1 hour)
- Used token handling
- Rate limiting (5 per hour)

---

## Student ID Format

Students use auto-generated IDs in format: `{animal}-{4-digit-number}`

**Example:** `bear-7823`, `tiger-4521`, `wolf-9156`

**Animals:** bear, tiger, wolf, eagle, dolphin, panda, lion, fox, owl, rabbit, koala, penguin, otter, hawk, deer

**Important:**
- Student ID = Passcode (same value)
- Never use real student names
- Teachers can map IDs to their roster via `external_id` and `roster_id`

---

## Quick Test Credentials

| Role | Credential | Value |
|------|------------|-------|
| Teacher | Email | teacher1@test.com |
| Teacher | Password | password123 |
| Student | Class Code | 96T2A2 |
| Student | Passcode | bear-7823 |

See `docs/TEST_CREDENTIALS.md` for full list.

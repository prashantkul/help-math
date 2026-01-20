# Phase 2 Implementation Guide for Coding Agent

**Status:** Ready for Implementation
**Last Updated:** January 2026

---

## Existing Migration

**IMPORTANT:** A migration file already exists at `backend/migrations/004_phase2_features.sql` with most schema changes. Review it before making database changes.

**Database:** PostgreSQL (NOT SQLite)

**Already in migration 004:**
- `password_reset_tokens` table
- `classes.purpose`, `classes.description`
- `students.roster_id`, `students.notes`
- `lessons.release_type`, `lessons.release_at`, `lessons.release_after_lesson_id`
- `problems.state`

**MISSING - Need to add:**
- `problems.scaffold_version` (for re-scaffold versioning)
- `teachers.timezone` (for scheduled lesson releases)

---

## Critical Context

### Student Privacy Model

**NEVER use real student names anywhere in the system.** Students are identified by:

| Field | Description | Example | Storage |
|-------|-------------|---------|---------|
| `student_id` | Auto-generated memorable ID | `bear-7823` | `students.id` (display) |
| `passcode` | Same as student_id | `bear-7823` | `students.passcode` |
| `roster_id` | Teacher's internal reference | `15`, `Seat-3A` | `students.roster_id` |
| `external_id` | School system ID | `STU001` | `students.external_id` |

The `student_id` format should be: `{animal}-{4-digit-number}` (e.g., `bear-7823`, `tiger-4521`, `wolf-9156`).

**Animal list suggestion:** bear, tiger, wolf, eagle, dolphin, panda, lion, fox, owl, rabbit, koala, penguin, otter, hawk, deer

---

## Phase 2 Features to Implement

### Priority Order

1. **Problem State Workflow** (T6.3) - Foundation for other features
2. **Edit Scaffold Steps** (T7.3) - High teacher value
3. **Bulk Student Import** (T3.4) - High teacher value
4. **Credential Export** (T3.9) - Pairs with bulk import
5. **Roster Mapping** (T3.2) - Enhances student management
6. **Password Reset** (T1.3) - Critical for production
7. **Class Purpose/Description** (T2.3) - Simple addition
8. **Lesson Release Scheduling** (T5.5) - Complex, do last

---

## Feature Specifications

### 1. Problem State Workflow (T6.3)

**Database Changes:**
```sql
-- Already in migration 004:
ALTER TABLE problems ADD COLUMN state TEXT DEFAULT 'draft' NOT NULL;
-- Valid states: 'draft', 'scaffolded', 'reviewed', 'published'

-- MISSING - Add to migration for re-scaffold versioning:
ALTER TABLE problems ADD COLUMN scaffold_version INTEGER DEFAULT 1 NOT NULL;
```

**State Transitions:**
```
draft → scaffolded     (auto when scaffold generated)
draft → published      (manual, only if scaffold exists)
scaffolded → reviewed  (teacher marks reviewed)
scaffolded → published (teacher publishes, skip review)
scaffolded → draft     (delete scaffold)
reviewed → published   (release to students)
reviewed → scaffolded  (regenerate scaffold)
published → reviewed   (unpublish)
```

**Business Rules:**
- Cannot transition to `draft` if students have attempts
- Unpublish (`published → reviewed`) freezes ALL student access
- Re-scaffold with existing attempts: increment `scaffold_version`, preserve old attempts

**API Endpoint:**
```
PUT /api/problems/:id/state
Body: { "state": "published" }
Response: { "id": "...", "state": "published", "scaffold_version": 1 }
```

---

### 2. Edit Scaffold Steps (T7.3)

**Editable Fields:**
- `question` - The prompt shown to students
- `correct_answers` - Array of correct responses
- `wrong_answers` - Distractor options
- `hint_text` - Text hint
- `hint_emoji` - Emoji hint

**Non-Editable:** `step_type` (must delete and recreate)

**Validation:**
- Question text required (min 5 chars)
- At least 1 correct answer
- At least 2 total options for multiple choice
- Max 6 answer options

**API Endpoints:**
```
PUT /api/problems/:id/steps/:step_id
Body: { "question": "...", "correct_answers": [...], ... }

PUT /api/problems/:id/steps/reorder
Body: { "step_order": ["step_id_1", "step_id_2", ...] }

POST /api/problems/:id/steps
Body: { "step_type": "multiple_choice", "question": "...", ... }

DELETE /api/problems/:id/steps/:step_id
```

**Version Behavior:** Edits apply immediately; students who completed step keep original score.

---

### 3. Bulk Student Import (T3.4)

**CSV Format:**
```csv
external_id,roster_id,notes
STU001,15,Front row
STU002,16,Needs extra time
,17,New student
```

- Header row required
- All columns optional (can be blank)
- Max 50 students per import

**Student ID Generation:**
Generate memorable IDs in format `{animal}-{4-digit-number}`:
```rust
fn generate_student_id() -> String {
    let animals = ["bear", "tiger", "wolf", "eagle", "dolphin", ...];
    let animal = animals[rand::random::<usize>() % animals.len()];
    let number = rand::random::<u16>() % 9000 + 1000; // 1000-9999
    format!("{}-{}", animal, number)
}
```

**Duplicate Handling:** Skip rows where `external_id` already exists in class.

**API Endpoint:**
```
POST /api/classes/:id/students/bulk-import
Content-Type: multipart/form-data
Body: file=<csv_file>

Response: {
  "created": 45,
  "skipped": 3,
  "errors": [
    { "row": 12, "error": "Duplicate external_id: STU001" }
  ],
  "students": [
    { "student_id": "bear-7823", "external_id": "STU001", ... }
  ]
}
```

**Alternative Mode - Generate N Students:**
```
POST /api/classes/:id/students/bulk-import
Body: { "count": 25 }

Response: { "created": 25, "students": [...] }
```

---

### 4. Credential Export (T3.9)

**Formats:** PDF and CSV

**CSV Columns:**
```
student_id,passcode,class_code,external_id,roster_id,created_at
bear-7823,bear-7823,96T2A2,STU001,15,2026-01-17T10:00:00Z
```

**PDF Layout:**
- One card per student
- Card contains: Student ID, Passcode, Class Code, QR Code
- QR Code encodes: `helpmath://{class_code}/{passcode}`
- 4-6 cards per page

**API Endpoint:**
```
GET /api/classes/:id/students/export?format=csv
GET /api/classes/:id/students/export?format=pdf

Response: File download
```

---

### 5. Roster Mapping (T3.2)

**Database:** Already in migration 004:
```sql
-- external_id already exists in students table
ALTER TABLE students ADD COLUMN roster_id TEXT;
ALTER TABLE students ADD COLUMN notes TEXT;
```

**API Endpoint:**
```
PUT /api/classes/:id/students/:student_id/roster-mapping
Body: {
  "external_id": "STU001",
  "roster_id": "15",
  "notes": "Front row, needs glasses"
}
```

**Privacy:** Mapping fields visible only to teachers, never to students.

---

### 6. Password Reset (T1.3)

**Database:** Already in migration 004:
```sql
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,  -- Store hashed token
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

**Flow:**
1. Teacher requests reset → generate token, hash it, store, send email
2. Teacher clicks link → validate token hash, check expiry, check not used
3. Teacher sets password → update password, mark token used

**Rules:**
- Token expiration: 1 hour
- Rate limit: 5 requests per hour per email
- Unknown email: Return same success message (prevent enumeration)
- Used/expired token: Show "This link has expired or already been used"

**API Endpoints:**
```
POST /api/auth/teacher/forgot-password
Body: { "email": "teacher@example.com" }
Response: { "message": "If an account exists, a reset link has been sent" }

POST /api/auth/teacher/reset-password
Body: { "token": "abc123", "new_password": "newpass123" }
Response: { "message": "Password updated successfully" }
```

---

### 7. Class Purpose/Description (T2.3)

**Database:** Already in migration 004:
```sql
ALTER TABLE classes ADD COLUMN purpose TEXT;
ALTER TABLE classes ADD COLUMN description TEXT;
```

**Validation:**
- Purpose: max 200 characters
- Description: max 1000 characters

**Visibility:** Teacher dashboard only (NOT shown to students)

**API:** Update existing `PUT /api/classes/:id` to accept `purpose` and `description` fields.

---

### 8. Lesson Release Scheduling (T5.5)

**Database:** Already in migration 004:
```sql
ALTER TABLE lessons ADD COLUMN release_type TEXT DEFAULT 'immediate' NOT NULL;
-- Values: 'immediate', 'scheduled', 'manual', 'sequential'

ALTER TABLE lessons ADD COLUMN release_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN release_after_lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL;
```

**MISSING - Add to migration for timezone support:**
```sql
ALTER TABLE teachers ADD COLUMN timezone TEXT DEFAULT 'UTC';
```

**Release Types:**
- `immediate`: Available now
- `scheduled`: Available at `release_at` timestamp (use teacher's timezone, default UTC)
- `manual`: Teacher explicitly releases
- `sequential`: Available when student completes 80% of `release_after_lesson_id`

**Sequential Logic:**
- Per-student (not class-wide)
- 80% threshold, round down (e.g., 2 of 3 problems = 67% qualifies)
- If prerequisite lesson deleted → lesson becomes immediately available

**API Endpoint:**
```
PUT /api/lessons/:id/schedule
Body: {
  "release_type": "sequential",
  "release_after_lesson_id": "lesson_abc123"
}
```

---

## Testing

See `docs/TESTING_GUIDE.md` for detailed test scenarios (P2.1-P2.8).

Run existing tests:
```bash
# Backend
cd backend && cargo test

# Frontend
cd frontend && npm test

# E2E
cd e2e && npm test
```

---

## Files to Modify

### Backend (Rust/Axum)
- `backend/src/models/problem.rs` - Add state field, transitions
- `backend/src/models/student.rs` - Add roster_id, notes fields
- `backend/src/models/lesson.rs` - Add scheduling fields
- `backend/src/models/teacher.rs` - Add timezone field
- `backend/src/routes/problems.rs` - State change, step editing endpoints
- `backend/src/routes/classes.rs` - Bulk import, credential export
- `backend/src/routes/auth.rs` - Password reset endpoints
- `backend/migrations/` - New migration file for schema changes

### Frontend (React/TypeScript)
- Student management UI - bulk import, export, roster mapping
- Problem editor - state workflow, step editing
- Lesson settings - release scheduling
- Teacher settings - timezone
- Login page - forgot password flow

---

## Reference Documents

- `PRODUCT_SPEC.md` - Full PRD with detailed specifications
- `docs/TESTING_GUIDE.md` - Test scenarios and API endpoints
- `review/PHASE2_PRD_REVIEW.md` - Original review (issues now addressed)

---

*Ready for implementation. Start with Problem State Workflow (T6.3) as foundation.*

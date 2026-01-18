# Help Math App - Testing Guide

## Overview

Help Math is an educational app designed to help students learn math through scaffolded word problems. Teachers can create classes, upload math problems, and track student progress. Students join classes and work through problems step-by-step.

**Live App:** https://web-frontend-production-594c.up.railway.app

---

## Important: Student Privacy Model

**Students are NEVER identified by real names.** Instead, students use:

| Field | Description | Example |
|-------|-------------|---------|
| **Student ID** | Auto-generated memorable identifier | `bear-7823`, `tiger-4521` |
| **Passcode** | Same as Student ID | `bear-7823` |
| **Roster ID** | Optional teacher-defined reference | `15`, `Seat-3A` |
| **External ID** | Optional school system ID | `STU001`, `12345` |

The Student ID serves as both the display name and login credential. Teachers can privately map Student IDs to their own roster using Roster ID/External ID fields.

---

## Quick Start

### Test Credentials

See `TEST_CREDENTIALS.md` for pre-created accounts, or create your own:

**Teachers:**
| Email | Password |
|-------|----------|
| teacher1@test.com | password123 |
| teacher2@test.com | password123 |

**Students:**
| Student ID (also Passcode) | Class Code |
|----------------------------|------------|
| Student A1 / 1111 | 96T2A2 |
| Student A2 / 2222 | 96T2A2 |
| Student B1 / 4444 | 6Y78B7 |

> **Note:** Current test data uses simple IDs. Production will use animal-number format (e.g., `bear-7823`).

---

## Testing as a Teacher

### 1. Registration & Login

1. Go to `/teacher/login`
2. Click "Create an account" to register a new teacher
3. Fill in name, email, and password
4. After registration, you'll be redirected to the dashboard

**Test Points:**
- [ ] Registration with valid email works
- [ ] Login with correct credentials works
- [ ] Login with wrong password shows errori
- [ ] Logout works correctly

### 2. Class Management

1. From the dashboard, click "Create Class"
2. Enter a class name (e.g., "5th Grade Math")
3. Note the generated **Join Code** (6 characters)

**Test Points:**
- [ ] Class is created successfully
- [ ] Join code is displayed
- [ ] Class appears in dashboard
- [ ] Can copy join code to clipboard

### 3. Adding Math Problems

#### Option A: Manual Entry
1. Go to your class
2. Click "Add Problem"
3. Type or paste a word problem
4. Click "Generate Scaffold" to create step-by-step breakdown

#### Option B: PDF Upload
1. Click "Upload PDF"
2. Select a PDF containing math word problems
3. The system extracts and parses problems automatically

**Test Points:**
- [ ] Manual problem entry works
- [ ] AI generates scaffold steps correctly
- [ ] PDF upload extracts problems
- [ ] Can edit generated scaffolds
- [ ] Can publish/unpublish problems

### 4. Class Settings

1. Go to class management
2. Click "Settings"
3. Adjust:
   - **ELL Level** (1-3): Vocabulary simplification level
   - **Show Emojis**: Visual hints for problems

**Test Points:**
- [ ] Settings save correctly
- [ ] ELL level affects problem text simplification
- [ ] Emoji toggle works

### 5. Viewing Analytics

1. Go to class dashboard
2. Click "Analytics" or view individual student progress
3. See completion rates, points earned, and problem performance

**Test Points:**
- [ ] Class-level analytics display correctly
- [ ] Individual student progress is accurate
- [ ] Points and stars are calculated correctly

---

## Testing as a Student

### 1. Joining a Class

1. Go to `/student` (or click "I'm a Student")
2. Enter the class join code (e.g., `96T2A2`)
3. Enter your passcode (same as your Student ID, e.g., `bear-7823`)
4. Select an avatar
5. Click "Join Class"

> **Privacy Note:** Students never enter their real name. The system uses the auto-generated Student ID (e.g., `bear-7823`) as both identifier and passcode.

**Test Points:**
- [ ] Valid join code + passcode works
- [ ] Invalid join code shows error
- [ ] Invalid passcode shows error
- [ ] Avatar selection persists
- [ ] Redirected to student dashboard
- [ ] Student ID displayed (not real name)

### 2. Viewing Assignments

1. After joining, see available assignments
2. Each assignment shows:
   - Title
   - Number of problems
   - Your progress

**Test Points:**
- [ ] Assignments from teacher are visible
- [ ] Progress indicator is accurate
- [ ] Can click to start a problem

### 3. Solving Problems

1. Click on a problem to start
2. Read the word problem (simplified based on ELL level)
3. Work through each scaffold step:
   - Answer questions
   - Select from multiple choice
   - Enter numeric answers
4. Get immediate feedback on each step
5. Earn points and stars upon completion

**Test Points:**
- [ ] Problem text displays correctly
- [ ] Emoji hints appear (if enabled)
- [ ] Can submit answers for each step
- [ ] Correct answers give points
- [ ] Wrong answers show hints
- [ ] Progress saves between sessions
- [ ] Stars awarded on completion

### 4. Student Profile

1. Click on profile/avatar
2. Can change avatar
3. View total points earned

**Test Points:**
- [ ] Avatar selection works
- [ ] Points total is accurate
- [ ] Profile updates persist

---

## Key User Flows to Test

### Flow 1: Complete Teacher-Student Cycle
1. Teacher registers → creates class → adds problem → publishes
2. Student joins class → sees problem → completes all steps
3. Teacher views analytics → sees student progress

### Flow 2: ELL Accommodation
1. Teacher sets class to ELL Level 1 (most simplified)
2. Student sees simplified vocabulary in problems
3. Compare with ELL Level 3 (less simplified)

### Flow 3: Multi-Step Problem
1. Teacher creates problem with 5+ scaffold steps
2. Student works through each step
3. Verify hints appear on wrong answers
4. Verify points decrease with multiple attempts
5. Verify stars calculation at end

---

## Phase 2 Features Testing

### P2.1 Bulk Student Import

**Scenario: CSV Import**
1. Teacher goes to class → "Import Students"
2. Upload CSV with columns: `external_id,roster_id,notes`
3. System creates students with auto-generated IDs (e.g., `bear-7823`)
4. Download credential list

**Test Points:**
- [ ] CSV with header row parses correctly
- [ ] Optional columns (all blank) work
- [ ] Max 50 students per import enforced
- [ ] Duplicate `external_id` rows are skipped
- [ ] Partial success reported (some rows fail, others succeed)
- [ ] Generated Student IDs use animal-number format

**Test CSV:**
```csv
external_id,roster_id,notes
STU001,15,Front row
STU002,16,Needs extra time
,17,New student (no external ID)
```

### P2.2 Student Credential Export

1. Teacher goes to class → "Export Credentials"
2. Choose format: PDF or CSV
3. Download file

**Test Points:**
- [ ] PDF generates with one card per student
- [ ] PDF includes QR codes for quick login
- [ ] CSV includes: student_id, passcode, class_code, external_id, roster_id
- [ ] No real student names in export
- [ ] Co-teachers with Edit permission can export

### P2.3 Teacher Roster Mapping

1. Teacher views student roster
2. Click on a student → "Edit Mapping"
3. Add/edit External ID, Roster ID, Notes
4. Save mapping

**Test Points:**
- [ ] Can set external_id for existing student
- [ ] Can set roster_id for existing student
- [ ] Notes field saves correctly
- [ ] Mapping visible only to teachers (not students)
- [ ] Mapping included in exports

### P2.4 Password Reset (Teacher)

1. Teacher goes to login page → "Forgot Password"
2. Enter email address
3. Check email for reset link
4. Click link → enter new password

**Test Points:**
- [ ] Reset email sent within 1 minute
- [ ] Token expires after 1 hour
- [ ] Used token shows "already used" error
- [ ] Unknown email shows same success message (no enumeration)
- [ ] Rate limit: max 5 requests per hour per email
- [ ] New password works for login

### P2.5 Problem State Workflow

**States:** Draft → Scaffolded → Reviewed → Published

1. Create problem (Draft)
2. Generate scaffold (auto → Scaffolded)
3. Review/edit scaffold (→ Reviewed)
4. Publish (→ Published)
5. Unpublish (→ Reviewed, freezes student access)

**Test Points:**
- [ ] New problem starts in Draft
- [ ] Generating scaffold auto-transitions to Scaffolded
- [ ] Can publish directly from Scaffolded (skip Reviewed)
- [ ] Cannot transition to Draft if students have attempts
- [ ] Unpublish freezes ALL student access (even in-progress)
- [ ] Re-scaffold with attempts creates new version

### P2.6 Edit Individual Scaffold Steps

1. Go to problem → "Edit Scaffold"
2. Click on a step to edit
3. Modify: question text, answers, hints
4. Reorder steps via drag-and-drop
5. Add/remove steps

**Test Points:**
- [ ] Can edit question text
- [ ] Can edit correct answer(s)
- [ ] Can edit wrong answer options
- [ ] Can edit hint text
- [ ] At least 1 correct answer required (validation)
- [ ] At least 2 options for multiple choice (validation)
- [ ] Max 6 answer options enforced
- [ ] Reordering persists
- [ ] Cannot change step type (must delete and recreate)
- [ ] Edits don't affect already-completed student attempts

### P2.7 Lesson Release Scheduling

1. Go to lesson → "Schedule Release"
2. Choose mode:
   - **Immediate**: Available now
   - **Scheduled**: Set date/time
   - **Sequential**: After prerequisite lesson

**Test Points:**
- [ ] Immediate release makes lesson visible to students
- [ ] Scheduled release uses teacher's timezone
- [ ] Sequential unlocks when student completes 80% of prerequisite (round down)
- [ ] Sequential is per-student (not class-wide)
- [ ] Deleting prerequisite makes lesson immediately available
- [ ] Changing schedule applies immediately

### P2.8 Class Purpose/Description

1. Teacher creates/edits class
2. Add Purpose (max 200 chars) and Description (max 1000 chars)
3. Save

**Test Points:**
- [ ] Purpose field enforces 200 char limit
- [ ] Description field enforces 1000 char limit
- [ ] Purpose/description visible on teacher dashboard
- [ ] Purpose/description NOT visible to students

---

## API Endpoints (for developers)

### Authentication
- `POST /api/auth/teacher/register` - Register teacher
- `POST /api/auth/teacher/login` - Teacher login
- `POST /api/auth/teacher/forgot-password` - Request password reset *(Phase 2)*
- `POST /api/auth/teacher/reset-password` - Execute password reset *(Phase 2)*
- `POST /api/auth/student/join` - Student joins class

### Classes
- `GET /api/classes` - List teacher's classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id/students` - List students in class
- `POST /api/classes/:id/students/bulk-import` - Bulk import students from CSV *(Phase 2)*
- `GET /api/classes/:id/students/export` - Export student credentials (PDF/CSV) *(Phase 2)*
- `PUT /api/classes/:id/students/:sid/roster-mapping` - Set external/roster ID *(Phase 2)*
- `PUT /api/classes/:id/settings` - Update class settings

### Lessons
- `GET /api/lessons/:id` - Get lesson
- `PUT /api/lessons/:id` - Update lesson
- `PUT /api/lessons/:id/schedule` - Set release schedule *(Phase 2)*

### Problems
- `GET /api/problems?class_id=X` - List problems
- `POST /api/problems` - Create problem
- `POST /api/problems/:id/scaffold` - Generate AI scaffold
- `POST /api/problems/:id/publish` - Publish problem
- `PUT /api/problems/:id/state` - Change problem state *(Phase 2)*
- `PUT /api/problems/:id/steps/:step_id` - Edit individual scaffold step *(Phase 2)*
- `PUT /api/problems/:id/steps/reorder` - Reorder scaffold steps *(Phase 2)*

### Student
- `GET /api/student/assignments` - Get assignments
- `GET /api/student/problems/:id` - Get problem with steps
- `POST /api/student/problems/:id/attempt` - Submit step answer
- `GET /api/student/progress` - Get overall progress

---

## Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| "Failed to create account" | Check if email is already registered |
| "Invalid join code" | Verify 6-character code with teacher |
| "Invalid passcode" | Passcode is the Student ID (e.g., `bear-7823`) |
| Problems not showing | Ensure teacher has published the problems |
| Points not updating | Refresh the page or check network |
| PDF upload fails | Ensure PDF contains text (not scanned images) |
| CSV import fails | Check header row exists, max 50 students |
| Password reset not received | Check spam folder, wait up to 1 minute |

---

## Browser Compatibility

Tested on:
- Chrome (recommended)
- Firefox
- Safari
- Edge

Mobile responsive design works on iOS and Android.

---

## Feedback

Report issues or suggestions at the project repository.

---

*Last Updated: January 2026 (Phase 2 testing scenarios added)*

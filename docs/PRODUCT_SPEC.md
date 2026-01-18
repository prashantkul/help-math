# Help Math - Product Specification

## Overview

Help Math is an educational platform designed to help elementary students (grades 3-5) master word problems through AI-powered scaffolding. The platform breaks down complex math problems into manageable steps, providing immediate feedback and rewards to keep students engaged.

---

## Target Users

### Primary Users
- **Teachers** - Create and manage math content, monitor student progress
- **Students** - Practice solving scaffolded word problems, earn rewards

### Secondary Users
- **Co-Teachers** - Assist primary teachers with class management
- **Parents** (future) - Monitor child's progress

---

## High-Level Themes

### 1. Teacher Portal
Complete classroom management and curriculum creation tools.

### 2. Student Portal
Engaging problem-solving experience with rewards and progress tracking.

### 3. AI-Powered Scaffolding
Intelligent breakdown of word problems into digestible steps.

### 4. Gamification & Rewards
Points, stars, and achievements to motivate students.

---

## Feature Specifications

---

## Teacher Portal

### T1. Authentication

#### T1.1 Teacher Registration
| Status | **Implemented** |
|--------|-----------------|
| Description | Teachers create accounts with email and password |
| Flow | 1. Enter email, password, name → 2. Account created → 3. Redirect to dashboard |
| Validation | Email format, password strength (min 8 chars) |
| Security | Bcrypt password hashing, JWT tokens (30-day expiry) |

#### T1.2 Teacher Login
| Status | **Implemented** |
|--------|-----------------|
| Description | Teachers log in with email and password |
| Flow | 1. Enter credentials → 2. Validate → 3. Issue JWT → 4. Redirect to dashboard |
| Error States | Invalid credentials, account not found |

#### T1.3 Password Reset
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Teachers can reset forgotten passwords via email |
| Flow | 1. Enter email → 2. Send reset link → 3. Click link → 4. Set new password |
| Requirements | Email service integration, secure reset tokens |
| Token Expiration | 1 hour |
| Rate Limit | 5 requests per hour per email |
| Unknown Email | Show same success message as valid email (prevent enumeration) |
| Invalid/Used Token | Show "This link has expired or already been used" |
| Email Content | Subject: "Reset your Help Math password", body with single-use link |

---

### T2. Class Management

#### T2.1 Create Class
| Status | **Implemented** |
|--------|-----------------|
| Description | Teachers create classes with auto-generated join codes |
| Fields | Class name, grade level (optional) |
| Auto-generated | 6-character alphanumeric join code |
| Output | Class appears on teacher dashboard |

#### T2.2 Class Settings
| Status | **Implemented** |
|--------|-----------------|
| Description | Configure class-wide settings |
| Settings | |
| - ELL Level | 1 (basic), 2 (intermediate), 3 (advanced) - affects AI language |
| - Emoji Display | Toggle emoji hints on/off |
| - Retry Limit | Max attempts per step (default: 3) |
| - Point Multiplier | Scale points earned (0.5x - 2x) |

#### T2.3 Class Purpose/Description
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Teachers can set a purpose/description for each class |
| Fields | Purpose text (max 200 chars), Description (max 1000 chars) |
| Display | Teacher dashboard and class settings only (not shown to students) |
| Use Case | Teacher notes for organizing classes by learning objectives |

#### T2.4 View Class Dashboard
| Status | **Implemented** |
|--------|-----------------|
| Description | Overview of class with students, modules, and stats |
| Shows | Student count, completion rates, recent activity |

#### T2.5 Delete/Archive Class
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Remove or archive a class |
| Current | Delete available |
| Needed | Archive option to preserve data |

---

### T3. Student Management

> **Privacy Note**: Students are identified by memorable IDs (e.g., "bear-7823"), NOT their real names. This protects student privacy while allowing teachers to correlate students with their class roster using optional external/roster IDs.

#### T3.1 Student Privacy ID System
| Status | **Implemented** |
|--------|-----------------|
| Description | Students use memorable IDs instead of real names for privacy |
| ID Format | Animal-number combination (e.g., "bear-7823", "tiger-4521") |
| Display | Student ID shown throughout the system (dashboards, analytics, leaderboards) |
| Passcode | Same as ID - serves as both identifier and login credential |
| Privacy | Real student names are never stored or displayed in the system |

#### T3.2 Teacher Roster Mapping
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Teachers can associate external/roster IDs with student IDs |
| Fields | External ID (optional), Roster ID (optional), Notes |
| Use Case | Teacher maps "bear-7823" to "Student #15" or their internal tracking system |
| Storage | Mapping stored only for teacher reference, not exposed to students |
| Export | Include mapping in roster exports for teacher records |

#### T3.3 Add Individual Student
| Status | **Implemented** |
|--------|-----------------|
| Description | Teacher creates student with auto-generated ID/passcode |
| Fields | None required (ID auto-generated) |
| Auto-generated | Memorable ID/passcode (e.g., "bear-7823") |
| Output | Student credentials displayed for teacher to share |

#### T3.4 Bulk Import Students
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Import multiple students from CSV or generate in bulk |
| **CSV Import Mode** | |
| - CSV Format | Columns: `external_id`, `roster_id`, `notes` (all optional) |
| - Header Row | Required - first row must be column names |
| - Max Import | 50 students per upload |
| - Duplicate Handling | Skip rows where `external_id` already exists in class |
| - Error Reporting | Report errors per row, allow partial success |
| **Generate Mode** | |
| - Input | Specify count of students to create (1-50) |
| - Output | All fields auto-generated (student IDs, passcodes) |
| **Output** | List of created students with generated IDs/passcodes |

**Example CSV:**
```csv
external_id,roster_id,notes
STU001,15,Front row
STU002,16,Needs extra time
,17,New student (no external ID)
```

#### T3.5 View Student Roster
| Status | **Implemented** |
|--------|-----------------|
| Description | List all students in a class |
| Shows | Student ID, passcode, points, progress, last active |
| Actions | View details, reset passcode, remove, add roster mapping |

#### T3.6 Reset Student Passcode
| Status | **Implemented** |
|--------|-----------------|
| Description | Generate new passcode for student who forgot theirs |
| Flow | Click reset → New passcode generated → Display to teacher |
| Note | Generates entirely new ID (e.g., "bear-7823" → "wolf-9156") |

#### T3.7 Remove Student
| Status | **Implemented** |
|--------|-----------------|
| Description | Remove student from class |
| Behavior | Preserves progress data (soft delete) |
| Confirmation | Required before deletion |

#### T3.8 View Individual Student Progress
| Status | **Implemented** |
|--------|-----------------|
| Description | Detailed view of student's progress and performance |
| Shows | Problems attempted, completion rate, strengths, weaknesses, step-level performance |
| Identifier | Student shown by ID only (e.g., "bear-7823"), teacher can reference roster mapping |

#### T3.9 Export Student Credentials
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Download class roster with student credentials |
| **Formats** | |
| - PDF | Printable cards - one per student |
| - CSV | Spreadsheet format for teacher records |
| **PDF Layout** | |
| - Per Card | Student ID, Passcode, Class Code, QR code |
| - QR Code | Encodes class code + passcode for quick scan login |
| - Print Format | 4-6 cards per page, perforated/cut lines |
| **CSV Columns** | `student_id, passcode, class_code, external_id, roster_id, created_at` |
| Access | Class owner and co-teachers with Edit permission |
| Privacy | Never includes real student names |

---

### T4. Co-Teacher Management

#### T4.1 Invite Co-Teacher
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Add another teacher to help manage class |
| Flow | 1. Enter email → 2. Send invite → 3. Co-teacher accepts → 4. Access granted |
| Current State | Database model exists, endpoint exists |
| Needed | Email notification, invitation UI polish |

#### T4.2 Co-Teacher Permissions
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Define what co-teachers can do |
| Levels | |
| - View Only | See students, progress, analytics |
| - Edit | Create/edit problems, manage students |
| - Full | All permissions except delete class |

#### T4.3 Remove Co-Teacher
| Status | **Implemented** |
|--------|-----------------|
| Description | Remove co-teacher access from class |
| Flow | Select co-teacher → Confirm removal → Access revoked |

---

### T5. Curriculum Organization

#### T5.1 Create Module
| Status | **Implemented** |
|--------|-----------------|
| Description | Create curriculum containers (e.g., "Addition & Subtraction") |
| Fields | Module name, description, order |
| Hierarchy | Class → Module → Lesson → Problem |

#### T5.2 Edit Module
| Status | **Implemented** |
|--------|-----------------|
| Description | Update module name, description, reorder |
| Actions | Edit details, reorder within class, delete |

#### T5.3 Create Lesson
| Status | **Implemented** |
|--------|-----------------|
| Description | Create lesson within a module (e.g., "Single Digit Addition") |
| Fields | Lesson name, description, order |
| State | Draft or Published |

#### T5.4 Edit Lesson
| Status | **Implemented** |
|--------|-----------------|
| Description | Update lesson details |
| Actions | Edit name/description, reorder, delete |

#### T5.5 Lesson Release Scheduling
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Schedule when lessons become available to students |
| **Release Modes** | |
| - Immediate | Available now |
| - Scheduled | Available on specific date/time |
| - Manual | Teacher manually releases |
| - Sequential | Unlock after previous lesson completed |
| **Timezone** | Teacher's configured timezone (add timezone setting to teacher profile; default: UTC) |
| **Sequential Mode Details** | |
| - Unlock Trigger | Per-student: lesson unlocks when student completes 80% of problems in prerequisite lesson |
| - Scope | Individual - each student progresses independently |
| - Prerequisite Deleted | Lesson becomes immediately available to all students |
| **Schedule Change Behavior** | |
| - New schedule takes effect immediately |
| - Students who already accessed retain access |

#### T5.6 Lesson Release Manual Control
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Teacher manually releases lesson for practice |
| Current | Publish/unpublish exists |
| Needed | "Release for practice" as separate from "published" state |

---

### T6. Problem Management

#### T6.1 Create Problem - Manual Entry
| Status | **Implemented** |
|--------|-----------------|
| Description | Teacher types/pastes problem text |
| Fields | Problem text, difficulty (1-5), skill tags |
| Output | Problem saved in draft state |

#### T6.2 Create Problem - PDF Upload
| Status | **Implemented** |
|--------|-----------------|
| Description | Extract problems from uploaded PDF |
| Supported | Text-based PDFs (not scanned images) |
| Flow | 1. Upload PDF → 2. Extract text → 3. Review extracted problems → 4. Save selected |
| Limitations | OCR not supported (scanned PDFs won't work) |

#### T6.3 Problem States
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Problems progress through states |
| **States** | |
| - **Draft** | Just created, not scaffolded |
| - **Scaffolded** | AI has generated steps (optional review) |
| - **Reviewed** | Teacher has reviewed/edited scaffolding |
| - **Published** | Available to students |
| Current | Draft → Published exists |
| Needed | Scaffolded and Reviewed intermediate states |

**State Machine:**
```
draft ──────────────────────────────────────────────────→ published (if has scaffold)
  │                                                           ↑
  ↓ (auto on scaffold generation)                             │
scaffolded ──→ reviewed ──────────────────────────────────────┘
  │    ↑          │
  │    └──────────┘ (regenerate scaffold)
  │
  └───────────────────────────────────────────────────────────→ published (skip review)
```

**Allowed Transitions:**
| From | To | Trigger |
|------|----|---------|
| draft | scaffolded | Automatic when scaffold generated |
| draft | published | Manual (only if scaffold exists, skips review) |
| scaffolded | reviewed | Teacher marks as reviewed |
| scaffolded | published | Teacher publishes directly (skip review) |
| scaffolded | draft | Delete scaffold |
| reviewed | published | Release to students |
| reviewed | scaffolded | Regenerate scaffold |
| published | reviewed | Unpublish |

**NOT Allowed:**
- published → draft (must go through reviewed first)
- Any state → draft if students have attempts

**Student Impact:**
| Action | Behavior |
|--------|----------|
| Unpublish (published → reviewed) | Freeze ALL student access (students who started cannot continue) |
| Re-scaffold with attempts | Creates new version; existing attempts preserved against old scaffold |
| State change with attempts | Preserve all existing attempt data |

#### T6.4 Edit Problem
| Status | **Implemented** |
|--------|-----------------|
| Description | Modify problem text, difficulty, tags |
| Constraint | Cannot edit after students have attempted |

#### T6.5 Delete Problem
| Status | **Implemented** |
|--------|-----------------|
| Description | Remove problem from lesson/class |
| Behavior | Soft delete, preserves student progress data |

#### T6.6 Assign Problem to Lesson
| Status | **Implemented** |
|--------|-----------------|
| Description | Move/copy problem to a lesson |
| Actions | Assign to lesson, reorder within lesson |

---

### T7. AI Scaffolding

#### T7.1 Generate Scaffolding
| Status | **Implemented** |
|--------|-----------------|
| Description | AI breaks down problem into steps |
| AI Model | Claude Sonnet |
| Step Types | |
| - `find_objects` | Identify what the problem is about |
| - `find_numbers` | Extract numerical values |
| - `identify_operation` | Determine +, -, ×, ÷ |
| - `build_equation` | Construct the math equation |
| - `solve` | Calculate the answer |
| - `comprehension_check` | Verify understanding |
| ELL Support | Language complexity adjusts based on class ELL level |

#### T7.2 Review Scaffolding
| Status | **Implemented** |
|--------|-----------------|
| Description | Teacher reviews AI-generated steps before publishing |
| View | All steps with questions, answers, hints |

#### T7.3 Edit Scaffolding
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Teacher modifies AI-generated scaffolding |
| Current | Can regenerate entire scaffold |
| Needed | Edit individual steps, add/remove/reorder steps |
| **Editable Fields** | |
| - Question text | The prompt shown to students |
| - Correct answer(s) | One or more correct responses |
| - Wrong answer options | Distractor options for multiple choice |
| - Hint text | Text hint shown after incorrect attempt |
| - Emoji hint | Visual hint (if enabled for class) |
| **Non-Editable** | Step type (must delete and recreate to change) |
| **Validation Rules** | |
| - At least one correct answer required |
| - Question text required (min 5 chars) |
| - Max 6 answer options per step |
| - At least 2 answer options for multiple choice |
| **Reordering** | Drag-and-drop to reorder steps |
| **Add/Remove** | Add step button, delete step with confirmation |
| **Version Behavior** | Edits apply immediately; students who already completed step keep their original score |

#### T7.4 Scaffold Templates
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Save and reuse scaffolding patterns |
| Use Case | Apply consistent step structure across similar problems |

---

### T8. Publishing & Release

#### T8.1 Publish Problem
| Status | **Implemented** |
|--------|-----------------|
| Description | Make problem available to students |
| Prerequisite | Must have scaffolding generated |
| Flow | Click publish → Problem visible to students |

#### T8.2 Unpublish Problem
| Status | **Implemented** |
|--------|-----------------|
| Description | Hide problem from students |
| Behavior | Students who started can complete, new students cannot start |

#### T8.3 Bulk Publish
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Publish multiple problems at once |
| Use Case | Release entire lesson's problems together |

---

### T9. Assignments

#### T9.1 Create Assignment
| Status | **Implemented** |
|--------|-----------------|
| Description | Group problems into weekly/daily assignments |
| Fields | Name, description, due date, problem list |
| Assignment To | Entire class |

#### T9.2 Assignment to Specific Students
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Assign to individual students or groups |
| Use Case | Differentiated instruction, remediation |

#### T9.3 View Assignment Progress
| Status | **Implemented** |
|--------|-----------------|
| Description | See how class is progressing on assignment |
| Shows | Completion rate, average score, struggling students |

---

### T10. Analytics & Reporting

#### T10.1 Class Analytics Dashboard
| Status | **Implemented** |
|--------|-----------------|
| Description | Overview of class performance |
| Metrics | |
| - Total students |
| - Problems completed |
| - Average completion rate |
| - Average points earned |
| - Step type performance |

#### T10.2 Individual Student Analytics
| Status | **Implemented** |
|--------|-----------------|
| Description | Detailed student performance |
| Metrics | |
| - Problems attempted/completed |
| - Strengths (step types mastered) |
| - Weaknesses (step types struggling) |
| - Recent activity |
| - Point history |

#### T10.3 Problem Analytics
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | How students perform on specific problems |
| Current | Completion rates |
| Needed | Step-by-step breakdown, common wrong answers |

#### T10.4 Export Reports
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Download analytics as CSV/PDF |
| Reports | |
| - Student roster with passcodes |
| - Grade book (scores per problem) |
| - Progress report per student |

#### T10.5 Enhanced Progress Analytics Export
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Export detailed student progress analytics for deeper analysis |
| Purpose | Enable teachers to import data into AI tools (ChatGPT, Claude, etc.) for insights |
| Formats | JSON, CSV with clear column headers |
| **Included Metrics** | |
| - First Attempt Success | Number/percentage of students who got correct answer on first try |
| - Attempt Distribution | Average attempts per step and per problem |
| - Struggle Analysis | Which steps students struggle with most (by error rate) |
| - Time Metrics | Time spent per problem, per step |
| - Common Errors | Most frequent wrong answers per step |
| - Completion Patterns | When students abandon vs. complete problems |
| **Export Granularity** | |
| - Class Level | Aggregate stats across all students |
| - Student Level | Individual student performance (identified by ID only) |
| - Problem Level | Per-problem breakdown |
| - Step Level | Detailed step-by-step analytics |
| **AI-Friendly Format** | |
| - JSON Schema | Documented schema for programmatic access |
| - CSV Headers | Clear, descriptive column names (e.g., "first_attempt_correct_count", "avg_attempts_per_step") |
| - Metadata | Export includes class settings, date range, problem details |
| **Privacy** | Students identified by ID only (e.g., "bear-7823"), never by real name |

---

## Student Portal

### S1. Authentication

#### S1.1 Student Login
| Status | **Implemented** |
|--------|-----------------|
| Description | Students join with class code and passcode |
| Flow | 1. Enter class code (6 chars) → 2. Enter passcode → 3. Select avatar → 4. Access dashboard |
| No Registration | Teachers create student accounts |

#### S1.2 Remember Me
| Status | **Implemented** |
|--------|-----------------|
| Description | Stay logged in on device |
| Storage | JWT in localStorage |

#### S1.3 Avatar Selection
| Status | **Implemented** |
|--------|-----------------|
| Description | Students choose their avatar on login |
| Avatars | Animated selection UI |
| Persistence | Saved to student profile |

---

### S2. Student Dashboard

#### S2.1 View Assignments
| Status | **Implemented** |
|--------|-----------------|
| Description | See all assigned work |
| Shows | Assignment name, problem count, completion status |

#### S2.2 View Progress
| Status | **Implemented** |
|--------|-----------------|
| Description | See overall progress and points |
| Shows | Total points, problems completed, stars earned |

#### S2.3 Problem List
| Status | **Implemented** |
|--------|-----------------|
| Description | Browse available problems |
| Shows | Problem preview, difficulty, status (not started, in progress, completed) |

---

### S3. Problem Solving

#### S3.1 Problem Display
| Status | **Implemented** |
|--------|-----------------|
| Description | Show the word problem |
| Features | Large text, read-aloud button |

#### S3.2 Step-by-Step Workflow
| Status | **Implemented** |
|--------|-----------------|
| Description | Progress through scaffolded steps |
| Flow | Complete step → Feedback → Next step → ... → Completion |
| Progress | Visual progress bar |

#### S3.3 Step Types (Interactive)
| Status | **Implemented** |
|--------|-----------------|
| Types | |
| - **Multiple Choice** | Select one answer from options |
| - **Multi-Select** | Select multiple answers |
| - **Number Input** | Enter a number |
| - **Equation Builder** | Drag/build equation |
| - **Drag & Drop** | Arrange items |

#### S3.4 Read Aloud
| Status | **Implemented** |
|--------|-----------------|
| Description | Text-to-speech for all text |
| Technology | Web Speech API |
| Scope | Problem text, step questions, hints, feedback |

#### S3.5 Instant Feedback
| Status | **Implemented** |
|--------|-----------------|
| Description | Immediate response to answers |
| Correct | Green checkmark, celebration, points |
| Incorrect | Try again message, hint offered |

#### S3.6 Hints
| Status | **Implemented** |
|--------|-----------------|
| Description | Help when stuck |
| Types | Text hint, emoji hint (if enabled) |
| Trigger | After incorrect attempt or on request |

#### S3.7 Retry Mechanism
| Status | **Implemented** |
|--------|-----------------|
| Description | Multiple attempts per step |
| Limit | Configurable per class (default: 3) |
| Point Penalty | Reduced points on retries |

---

### S4. Rewards & Gamification

#### S4.1 Points System
| Status | **Implemented** |
|--------|-----------------|
| Description | Earn points for correct answers |
| Calculation | Base points × class multiplier × attempt penalty |
| Display | Running total on dashboard |

#### S4.2 Star Ratings
| Status | **Implemented** |
|--------|-----------------|
| Description | Star rating per problem based on performance |
| Scale | 1-3 stars |
| Criteria | Accuracy, number of attempts, hints used |

#### S4.3 Completion Celebration
| Status | **Implemented** |
|--------|-----------------|
| Description | Animation when completing a problem |
| Animation | Confetti effect |
| Sound | Success sound (if enabled) |

#### S4.4 Achievements/Badges
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Unlock badges for milestones |
| Examples | |
| - "First Problem Solved" |
| - "Perfect Score" (3 stars) |
| - "Streak" (5 problems in a row) |
| - "Math Master" (complete all problems in lesson) |

#### S4.5 Leaderboard
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Class leaderboard by points |
| Privacy | Teacher can enable/disable |
| Display | Top 10, student's rank |

#### S4.6 Lesson & Module Completion Rewards
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Earn rewards for completing lessons and modules (roll-up from problem-level) |
| **Reward Hierarchy** | |
| - Problem Level | Points + Stars (existing) |
| - Lesson Level | Lesson badge/trophy when completing 80% of problems in lesson |
| - Module Level | Module badge/trophy when completing 80% of lessons in module |
| **Lesson Reward Criteria** | |
| - Completion threshold | 80% of published problems completed (round down, e.g., 2 of 3 = 67% qualifies) |
| - Badge tiers | Bronze (80%), Silver (90%), Gold (100%) based on average stars |
| **Module Reward Criteria** | |
| - Completion threshold | 80% of lessons completed (round down) |
| - Badge tiers | Bronze (80%), Silver (90%), Gold (100%) based on lesson badge quality |
| **Display** | |
| - Student dashboard | Show earned lesson/module badges |
| - Lesson list | Badge icon next to completed lessons |
| - Module list | Badge icon next to completed modules |
| **Celebration** | Animation when earning lesson or module badge |

---

### S5. Accessibility

#### S5.1 Read Aloud (TTS)
| Status | **Implemented** |
|--------|-----------------|
| Description | All text can be read aloud |
| Control | Button on each text element |

#### S5.2 Large Text Mode
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Increase text size |
| Control | Student preference setting |

#### S5.3 High Contrast Mode
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Higher contrast colors |
| Use Case | Visual impairments |

#### S5.4 Keyboard Navigation
| Status | **Partially Implemented** |
|--------|---------------------------|
| Description | Full keyboard accessibility |
| Needed | Focus indicators, tab order |

---

## Technical Specifications

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - React 19, TypeScript, Tailwind CSS                   │
│  - Vite build tool                                       │
│  - React Router v7                                       │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                   Backend (Rust)                         │
│  - Axum web framework                                    │
│  - SQLx (compile-time checked SQL)                       │
│  - JWT authentication                                    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Database (SQLite)                       │
│  - Local file-based storage                              │
│  - Migrations managed via SQLx                           │
└─────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               External Services                          │
│  - Claude API (AI scaffolding)                           │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

#### Core Tables
| Table | Description |
|-------|-------------|
| `teachers` | Teacher accounts |
| `classes` | Teacher-created classes |
| `students` | Student accounts (per class) |
| `modules` | Curriculum containers |
| `lessons` | Lesson containers |
| `problems` | Word problems |
| `scaffold_steps` | AI-generated steps |
| `student_progress` | Progress per student/problem |
| `step_attempts` | Detailed attempt logs |
| `assignments` | Problem groupings |
| `class_teachers` | Co-teacher relationships |

### API Structure

```
/api
├── /auth
│   ├── /teacher/register        POST
│   ├── /teacher/login           POST
│   ├── /teacher/forgot-password POST  (request password reset)
│   ├── /teacher/reset-password  POST  (execute reset with token)
│   └── /student/join            POST
├── /classes                      GET, POST
│   ├── /:id                     GET, PUT, DELETE
│   ├── /:id/students            GET, POST
│   ├── /:id/students/bulk-import POST (CSV upload or generate N students)
│   ├── /:id/students/export     GET   (credential PDF/CSV download)
│   ├── /:id/students/:sid/roster-mapping PUT (set external/roster ID)
│   ├── /:id/coteachers          GET, POST
│   ├── /:id/modules             GET, POST
│   └── /:id/settings            PUT
├── /modules/:id                 GET, PUT, DELETE
│   └── /lessons                 GET, POST
├── /lessons/:id                 GET, PUT, DELETE
│   └── /schedule                PUT   (set release schedule)
├── /problems                    GET, POST
│   ├── /upload                  POST (PDF)
│   ├── /:id                     GET, PUT, DELETE
│   ├── /:id/scaffold            POST
│   ├── /:id/publish             POST
│   ├── /:id/state               PUT   (change problem state)
│   └── /:id/steps/:step_id      PUT   (edit individual step)
│       └── /reorder             PUT   (reorder steps)
├── /assignments                 GET, POST
├── /analytics
│   ├── /class/:id               GET
│   ├── /student/:id             GET
│   ├── /class/:id/export        GET (CSV/JSON export)
│   └── /class/:id/export/detailed GET (AI-friendly detailed export)
└── /student (protected)
    ├── /assignments             GET
    ├── /problems/:id            GET
    ├── /problems/:id/attempt    POST
    ├── /progress                GET
    ├── /profile                 GET
    └── /avatar                  PUT
```

---

## Implementation Priority

### Phase 1 - Core Complete (Current)
- [x] Teacher authentication
- [x] Student authentication (sessionless)
- [x] Class management
- [x] Student management (individual)
- [x] Module/Lesson structure
- [x] Problem creation (manual + PDF)
- [x] AI scaffolding generation
- [x] Problem solving workflow
- [x] Points and stars
- [x] Basic analytics

### Phase 2 - Teacher Experience Enhancement
- [ ] Edit individual scaffold steps
- [ ] Lesson release scheduling
- [ ] Bulk student import with CSV
- [ ] Student credential export (PDF)
- [ ] Password reset for teachers
- [ ] Class purpose/description field
- [ ] Problem state workflow (Draft → Scaffolded → Reviewed → Published)
- [ ] Teacher roster mapping (associate external IDs with student IDs)

### Phase 3 - Student Engagement
- [ ] Achievement badges
- [ ] Lesson/module completion rewards (badges roll up from problems → lessons → modules)
- [ ] Class leaderboard (optional)
- [ ] Student preferences (text size, sounds)
- [ ] Improved celebration animations
- [ ] Teacher timezone setting (for scheduled lesson releases)

### Phase 4 - Advanced Features
- [ ] Co-teacher permission levels
- [ ] Assignment to specific students
- [ ] Analytics export (CSV/PDF)
- [ ] Enhanced progress analytics export (AI-friendly JSON/CSV with detailed metrics)
- [ ] Scaffold templates
- [ ] OCR for scanned PDFs

### Phase 5 - Future Considerations
- [ ] Parent portal
- [ ] Mobile app
- [ ] Real-time collaboration
- [ ] Multi-language support

---

## Appendix

### Test Credentials

See `TEST_CREDENTIALS.md` for development/testing accounts.

### Glossary

| Term | Definition |
|------|------------|
| **Scaffolding** | Breaking a problem into manageable steps |
| **ELL** | English Language Learner |
| **Module** | Top-level curriculum container |
| **Lesson** | Collection of related problems |
| **Student ID** | Privacy-preserving identifier for students (e.g., "bear-7823") - used instead of real names |
| **Passcode** | Same as Student ID - serves as both identifier and login credential |
| **Join Code** | 6-character class identifier |
| **Roster Mapping** | Teacher's internal association between Student IDs and their own tracking system |
| **External ID** | Optional teacher-defined identifier to correlate Student ID with class roster |

---

*Last Updated: January 2026*

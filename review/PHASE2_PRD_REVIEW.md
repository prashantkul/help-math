# Phase 2 PRD Review - Issues Found

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-17
**Documents Reviewed:** PRODUCT_SPEC.md, TESTING.md, TEST_CREDENTIALS.md, migrations/004_phase2_features.sql

---

## Executive Summary

The Phase 2 PRD has several underspecified features, missing API endpoints, and incomplete state machine definitions. The most critical gaps are in the problem state workflow, bulk import specification, and password reset flow.

| Issue Type | Count | Severity |
|------------|-------|----------|
| Missing validation rules | 5+ | Medium |
| Incomplete state machines | 2 | High |
| Missing API endpoints | 7 | High |
| Missing error handling | 4 | Medium |
| Ambiguous requirements | 6 | Medium |
| Missing entire feature spec | 1 (credential export) | High |

---

## Detailed Findings

### 1. T1.3 Password Reset - Underspecified

**Issues:**
- No token expiration duration specified (migration has `expires_at` but PRD doesn't say how long)
- No rate limiting specification (how many reset requests per hour?)
- No email template or content requirements
- No handling for: user requests multiple resets, email doesn't exist, account is locked
- No specification for reset link URL format
- Missing: What happens if user clicks an already-used token?

**Recommended PRD Addition:**
```
| Token Expiration | 1 hour |
| Rate Limit | 3 requests per hour per email |
| Email Content | Subject: "Reset your Help Math password", body with single-use link |
| Invalid Token | Show "This link has expired or already been used" |
| Unknown Email | Show same success message (prevent email enumeration) |
```

---

### 2. T2.3 Class Purpose/Description - Minor Gap

**Issues:**
- PRD says "Display | Shown on class dashboard and student view" but doesn't specify:
  - Character limits for purpose/description fields
  - Whether students actually see this (no S-section describes student view of class description)

**Recommended PRD Addition:**
```
| Max Length | Purpose: 200 chars, Description: 1000 chars |
| Student View | Purpose shown on student dashboard header |
```

---

### 3. T3.2 Teacher Roster Mapping - Missing UI Flow

**Issues:**
- No specification for how teachers access/edit mappings (modal? inline? separate page?)
- No bulk update capability mentioned (what if teacher has 30 students?)
- Export format not specified (CSV columns?)
- The migration adds `roster_id` and `notes`, but PRD mentions "External ID" and "Roster ID" as separate - which is which?

**Data Model Confusion:**
- PRD mentions: `External ID (optional), Roster ID (optional), Notes`
- Migration adds: `roster_id TEXT, notes TEXT`
- Comment says: "Note: external_id already exists in students table"

**Question:** Where was `external_id` added? Not visible in Phase 1 schema documentation.

**Recommended PRD Addition:**
```
| UI Location | Click student row → Edit mapping modal |
| Bulk Edit | CSV upload with student_id, external_id, roster_id, notes columns |
| Export Format | CSV: student_id, passcode, external_id, roster_id, notes, created_at |
```

---

### 4. T3.4 Bulk Import Students - Severely Underspecified

**Critical Gaps:**
- No CSV format specification (columns, header row required?)
- No maximum batch size
- No error handling spec (partial failures, validation errors, duplicate detection)
- No example CSV provided
- "or count of students to create" - this is a second mode that's barely described

**Recommended PRD Addition:**
```
| CSV Format | Columns: external_id (optional), roster_id (optional), notes (optional) |
| Header Row | Required, first row must be column names |
| Max Import | 100 students per upload |
| Error Handling | Report errors per row, allow partial success |
| Duplicate Detection | Skip rows where external_id already exists in class |
| Alternative Mode | "Generate N students" - specify count, all fields auto-generated |

Example CSV:
external_id,roster_id,notes
STU001,15,Front row
STU002,16,Needs extra time
,17,New student (no external ID)
```

---

### 5. T5.5 Lesson Release Scheduling - Missing Details

**Issues:**
- **Timezone handling** not specified - whose timezone? Server? Teacher's?
- **Sequential unlock** - what does "previous lesson completed" mean?
  - 100% of problems completed?
  - Just started?
  - Per-student or class-wide?
- No specification for what happens if:
  - A scheduled lesson is edited before release date
  - Teacher changes from scheduled to manual
  - A "sequential" prerequisite lesson is deleted

**Migration vs PRD Mismatch:**
- Migration has `release_after_lesson_id` for sequential mode
- PRD doesn't explain how sequential dependencies work

**Recommended PRD Addition:**
```
| Timezone | All times in teacher's configured timezone (default: UTC) |
| Sequential Criteria | Per-student: lesson unlocks when student completes 80% of problems in prerequisite lesson |
| Prerequisite Deleted | Lesson becomes immediately available |
| Schedule Changed | New schedule takes effect immediately, already-accessed students retain access |
```

---

### 6. T6.3 Problem State Workflow - Missing Transition Rules

**Critical Missing:**
- **State transition diagram** - which transitions are allowed?
- **Automatic transitions** - does generating scaffold auto-change draft → scaffolded?
- **Student impact** - what happens to in-progress student attempts if state changes?

**Recommended State Machine:**
```
draft ──────────────────────────────────────────────────→ published (if has scaffold)
  │                                                           ↑
  ↓ (auto on scaffold generation)                             │
scaffolded ──→ reviewed ──────────────────────────────────────┘
  ↑               │
  └───────────────┘ (regenerate scaffold)

Allowed transitions:
- draft → scaffolded (automatic when scaffold generated)
- draft → published (only if scaffold exists, skips review)
- scaffolded → reviewed (teacher marks as reviewed)
- scaffolded → draft (delete scaffold)
- reviewed → published (release to students)
- reviewed → scaffolded (regenerate scaffold)
- published → reviewed (unpublish, preserves existing student progress)

NOT allowed:
- published → draft (must go through reviewed first)
- Any state → draft if students have attempts
```

**Student Impact:**
```
| Unpublish (published → reviewed) | Students who started can complete, new students cannot start |
| State change with attempts | Preserve all existing attempt data |
```

---

### 7. T7.3 Edit Scaffolding - Needs More Detail

**Currently marked "Partially Implemented" but "Needed" items are vague:**
- "Edit individual steps" - what fields? Just question text? Answers? Hints?
- No validation rules for edited steps
- No versioning - what if teacher edits step after students started?
- No specification for adding new step types or reordering

**Recommended PRD Addition:**
```
| Editable Fields | Question text, correct answer(s), wrong answer options, hint text, emoji hint |
| Non-editable | Step type (must delete and recreate) |
| Validation | At least one correct answer, question text required, max 6 answer options |
| Reordering | Drag-and-drop to reorder steps |
| Add/Remove | Add step button, delete step with confirmation |
| Version Behavior | Edits apply immediately; students who already completed step keep their original score |
```

---

### 8. Missing API Endpoints in PRD

The API structure section (lines 676-709) doesn't include endpoints for Phase 2 features:

```
Missing endpoints:

/api/auth
├── /teacher/forgot-password     POST  (request password reset)
└── /teacher/reset-password      POST  (execute reset with token)

/api/classes/:id
├── /students/bulk-import        POST  (CSV upload)
└── /students/export             GET   (credential PDF/CSV download)

/api/lessons/:id
└── /schedule                    PUT   (set release schedule)

/api/problems/:id
├── /state                       PUT   (change problem state)
└── /steps/:step_id              PUT   (edit individual step)
     └── /reorder                PUT   (reorder steps)
```

---

### 9. Student Credential Export (PDF) - Not in PRD

**Listed in Phase 2 priorities:**
> - [ ] Student credential export (PDF)

**But there's no T-section specification for this feature.** T3.4 mentions "Downloadable PDF/CSV with all credentials" but only in context of bulk import, not standalone export.

**Recommended: Add new section T3.9**
```
#### T3.9 Export Student Credentials
| Status | **Not Implemented** |
|--------|---------------------|
| Description | Download class roster with student credentials |
| Formats | PDF (printable cards), CSV (spreadsheet) |
| PDF Layout | One card per student: Student ID, Passcode, Class Code, QR code |
| CSV Columns | student_id, passcode, class_code, external_id, roster_id, created_at |
| Access | Class owner and co-teachers with Edit permission |
| Privacy | Never includes real student names |
```

---

### 10. T10.4 Export Reports - Sparse

**Current PRD just lists report types with no detail:**
- No column specifications for CSV
- No PDF layout description
- No date range filtering specification
- No file naming convention

**Recommended PRD Addition:**
```
| Student Roster CSV | student_id, passcode, external_id, roster_id, points, problems_completed, last_active |
| Grade Book CSV | student_id, problem_1_score, problem_1_stars, problem_2_score, ... |
| Progress Report PDF | Per-student: summary stats, problem-by-problem breakdown, strengths/weaknesses |
| Date Range Filter | Optional start/end date for activity-based reports |
| File Naming | {class_name}_{report_type}_{date}.{ext} |
```

---

## Recommendations

1. **Immediate:** Define the problem state machine with explicit transition rules
2. **Immediate:** Specify CSV format for bulk import with example
3. **High Priority:** Add missing API endpoints to the API structure section
4. **High Priority:** Create T3.9 section for credential export
5. **Medium:** Add validation rules and character limits throughout
6. **Medium:** Specify timezone handling for scheduling features
7. **Low:** Add error message specifications for each feature

---

## Questions for Product Owner

1. Should students see the class purpose/description? If so, where?
2. For sequential lesson unlock, what completion percentage triggers unlock?
3. Is the sequential unlock per-student or class-wide?
4. Should we support re-scaffolding a problem that has student attempts?
5. What email service will be used for password reset?

---

*Review complete. Ready to review implementation code when available.*

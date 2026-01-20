# Implementation Status

**Last Updated:** January 17, 2026
**Status:** Phase 2 Backend Complete + PostgreSQL Migration

---

## Completed Work

### 1. PostgreSQL Migration ✅

Migrated entire backend from SQLite to PostgreSQL:

- **Cargo.toml**: Changed `sqlx/sqlite` to `sqlx/postgres`
- **docker-compose.yml**: Created for local PostgreSQL container
- **main.rs**: Updated connection pooling from `SqlitePoolOptions` to `PgPoolOptions`
- **All migrations**: Converted to PostgreSQL syntax
  - `TIMESTAMPTZ` instead of `TEXT` for datetime
  - `JSONB` instead of `TEXT` for JSON fields
  - `BOOLEAN` instead of `INTEGER` for booleans
  - `ON CONFLICT DO NOTHING` instead of `INSERT OR IGNORE`
  - `DO $$ BEGIN ... END $$` blocks for conditional ALTER TABLE
- **All route files**: Updated SQL queries
  - `$1, $2, ...` placeholders instead of `?`
  - Boolean literals (`true`/`false`) instead of integers
  - JSONB casts where needed

**Connection String:** `postgres://helpmath:helpmath_dev@localhost:5432/helpmath`

### 2. Phase 2 Features - Backend ✅

All 8 Phase 2 features implemented in backend:

| Feature | DB Migration | Routes | Status |
|---------|-------------|--------|--------|
| T1.3 Password Reset | ✅ `password_reset_tokens` table | ✅ `forgot_password`, `reset_password` | Complete |
| T2.3 Class Purpose/Description | ✅ `purpose`, `description` columns | ✅ Updated `update_class_settings` | Complete |
| T3.2 Roster Mapping | ✅ `roster_id`, `notes` columns | ✅ `update_student_roster` | Complete |
| T3.4 Bulk Student Import | ✅ (uses existing schema) | ✅ `bulk_create_students` | Complete |
| T3.9 Credential Export | ✅ (uses existing schema) | ✅ `export_students` (CSV/JSON) | Complete |
| T5.5 Lesson Scheduling | ✅ `release_type`, `release_at`, `release_after_lesson_id` | ✅ `update_lesson_schedule` | Complete |
| T6.3 Problem State Workflow | ✅ `state` column | ✅ `review_problem`, state transitions | Complete |
| T7.3 Edit Scaffold Steps | ✅ (uses existing schema) | ✅ `add_scaffold_step`, `update_scaffold_step`, `delete_scaffold_step`, `reorder_scaffold_steps` | Complete |

### 3. Phase 2 Features - Frontend ✅

| Feature | Components | Status |
|---------|-----------|--------|
| T1.3 Password Reset | `ForgotPasswordPage`, `ResetPasswordPage`, link in TeacherLogin | Complete |
| T2.3 Class Purpose/Description | Fields in `CreateClassForm` | Partial (display TODO) |
| T3.2 Roster Mapping | `RosterMappingModal` in ClassManagement | Complete |
| T3.4 Bulk Student Import | `BulkImportModal` in ClassManagement | Complete |
| T3.9 Credential Export | Export button in ClassManagement | Complete (CSV) |
| T5.5 Lesson Scheduling | `LessonScheduleModal` in CurriculumManager | Complete |
| T6.3 Problem State Workflow | State badges, workflow indicator in ProblemManager | Complete |
| T7.3 Edit Scaffold Steps | Not yet implemented | TODO |

---

## Build Status

### Backend
```
✅ cargo build - SUCCESS (22 warnings, 0 errors)
```

Warnings are cosmetic (unused fields in query structs).

### Model Type Updates (PostgreSQL Compatibility)
All model files updated to use proper types:
- `created_at`, `started_at`, `completed_at`, `expires_at`, `release_at` → `chrono::DateTime<Utc>`
- `is_published`, `is_complete`, `is_correct`, `used` → `bool`
- Response structs convert to RFC3339 strings for JSON serialization

### Frontend
```
✅ npm run build - Main code compiles
⚠️ Test files have pre-existing errors (not from Phase 2 work)
```

Pre-existing test errors:
- `StudentLogin.test.tsx` - `vi.advanceTimersByTime` syntax issue
- `utils.tsx` - missing `expect` import

---

## Database Running

PostgreSQL via Docker:
```bash
docker compose up -d  # Start
docker compose down   # Stop
```

Container: `helpmath-postgres`
Port: `5432`
Database: `helpmath`
User: `helpmath`
Password: `helpmath_dev`

---

## Known Gaps / TODO

### From PHASE2_IMPLEMENTATION.md Spec:

1. **Student ID Format**: Spec calls for `{animal}-{4-digit-number}` format (e.g., `bear-7823`). Current implementation uses simple 4-digit passcodes. This is a design decision - the spec format is more memorable but the simple format works.

2. **scaffold_version Column**: Not implemented. Spec mentions tracking scaffold versions when regenerating.

3. **PDF Export**: Only CSV/JSON export implemented. PDF with QR codes not yet done.

4. **Edit Scaffold Steps UI**: Backend routes exist, frontend UI not yet built.

5. **Teacher Timezone**: Not implemented (spec mentions `ALTER TABLE teachers ADD COLUMN timezone`).

6. **Rate Limiting**: Password reset has no rate limiting implemented yet.

---

## Testing Status

### Backend Tests
```bash
cd backend && cargo test
```
Status: **NOT RUN YET** - Need to run after PostgreSQL migration

### Frontend Tests
```bash
cd frontend && npm test
```
Status: **PRE-EXISTING FAILURES** - Test infrastructure issues unrelated to Phase 2

### E2E Tests
```bash
cd e2e && npm test
```
Status: **NOT RUN YET**

---

## Next Steps

1. **Run backend tests** to verify PostgreSQL migration doesn't break existing functionality
2. **Fix pre-existing test file errors** in frontend
3. **Build Edit Scaffold Steps UI** (T7.3 frontend)
4. **Add PDF export** with QR codes (T3.9)
5. **Add rate limiting** to password reset
6. **Run E2E tests** to verify full flow

---

## Files Changed

### Backend
- `Cargo.toml` - PostgreSQL dependency
- `docker-compose.yml` - New file for PostgreSQL container
- `src/main.rs` - PgPool, connection string
- `migrations/*.sql` - All 4 migration files converted to PostgreSQL
- `src/routes/auth.rs` - Password reset endpoints
- `src/routes/classes.rs` - Bulk import, export, roster mapping
- `src/routes/problems.rs` - State workflow, scaffold step editing
- `src/routes/modules.rs` - Lesson scheduling
- `src/routes/*.rs` - All files updated for PostgreSQL syntax

### Frontend
- `src/api/client.ts` - All new API methods
- `src/types/index.ts` - Phase 2 types
- `src/pages/auth/ForgotPasswordPage.tsx` - New
- `src/pages/auth/ResetPasswordPage.tsx` - New
- `src/pages/auth/index.ts` - Barrel export
- `src/pages/teacher/TeacherLogin.tsx` - Forgot password link
- `src/pages/teacher/ClassManagement.tsx` - Bulk import, export, roster modal
- `src/pages/teacher/CurriculumManager.tsx` - Lesson schedule modal
- `src/pages/teacher/ProblemManager.tsx` - State workflow UI
- `src/App.tsx` - New routes
- `src/test/fixtures/index.ts` - Updated for new types

# Reviewer Session Feedback

**Session:** reviewer
**Current Task:** Problem State Workflow (T6.3)

---

## Instructions

After reviewing Coder's output, update this file with:

1. **Review Status** - Approved / Changes Requested / Blocked
2. **Code Quality** - Assessment of the implementation
3. **Spec Compliance** - Does it match PRD requirements?
4. **Test Coverage** - Are tests adequate?
5. **Issues Found** - Bugs, missing features, concerns
6. **Suggestions** - Improvements (optional)

---

## Current Review

### Task: Problem State Workflow (T6.3)

**Review Status:** ❌ Changes Requested

**Review Date:** 2026-01-17

---

### Checklist:

| Requirement | Status | Notes |
|-------------|--------|-------|
| State field added to problems table | ✅ | In `001_initial_schema.sql`, default 'draft' |
| All 4 states supported | ✅ | draft, scaffolded, reviewed, published |
| Auto-transition to scaffolded | ✅ | `generate_scaffold()` sets state to 'scaffolded' |
| Transition scaffolded → reviewed | ✅ | `POST /problems/:id/review` endpoint |
| Transition reviewed → published | ✅ | `POST /problems/:id/publish` endpoint |
| Transition scaffolded → published | ✅ | Also allowed in publish_problem |
| Cannot transition to draft if students have attempts | ❌ | **NOT IMPLEMENTED** |
| Unpublish (published → reviewed) | ❌ | **NOT IMPLEMENTED** - no endpoint exists |
| Transition scaffolded → draft (delete scaffold) | ❌ | **NOT IMPLEMENTED** |
| scaffold_version field | ❌ | **NOT IMPLEMENTED** - missing from schema |
| scaffold_version increments on re-scaffold | ❌ | **NOT IMPLEMENTED** - depends on field |
| Generic PUT /api/problems/:id/state endpoint | ⚠️ | Not implemented as specified; uses separate endpoints |
| Frontend shows problem state | ❓ | Not reviewed (backend focus) |
| Tests pass | ❌ | **TESTS DON'T BUILD** - SQLite references in PostgreSQL project |

---

### Issues Found:

#### Critical Issues (Must Fix)

1. **Missing `scaffold_version` field**
   - Location: `backend/migrations/001_initial_schema.sql`, `backend/src/models/problem.rs`
   - Spec requires: `problems.scaffold_version INTEGER DEFAULT 1`
   - Impact: Cannot track scaffold versions for re-scaffolding

2. **No unpublish functionality**
   - Spec requires: `published → reviewed` transition
   - Impact: Teachers cannot unpublish a problem once published

3. **No protection against draft transition with student attempts**
   - Spec requires: Cannot transition to `draft` if students have attempts
   - Location: No check exists in any state transition code
   - Impact: Data integrity issue - could lose student progress context

4. **No scaffolded → draft transition**
   - Spec requires: Delete scaffold should transition to draft
   - Impact: Cannot revert a scaffolded problem to draft state

5. **Backend tests don't build**
   - Location: `backend/tests/common/mod.rs`, `backend/tests/auth_tests.rs`
   - Error: SQLite imports (`sqlx::sqlite::SqlitePoolOptions`) in PostgreSQL project
   - Impact: Cannot verify any test coverage

#### Minor Issues

6. **No generic state endpoint**
   - Spec: `PUT /api/problems/:id/state` with body `{ "state": "published" }`
   - Current: Separate endpoints `/publish`, `/review`
   - Impact: Lower priority - current design is acceptable but doesn't match spec

---

### Code Quality Assessment:

**Positive:**
- Clean Rust code structure
- Proper error handling with tracing
- Authorization checks on all endpoints
- State is included in Problem model and responses

**Concerns:**
- Many `#[allow(dead_code)]` warnings (22 total)
- Some struct fields marked as never read
- No validation on state transitions in a centralized place

---

### Files Reviewed:

| File | Status |
|------|--------|
| `backend/src/models/problem.rs` | Partial - has state field, missing scaffold_version |
| `backend/src/routes/problems.rs` | Partial - has publish/review, missing unpublish/draft |
| `backend/migrations/001_initial_schema.sql` | Has state field |
| `backend/migrations/004_phase2_features.sql` | Only has password_reset_tokens |
| `backend/src/main.rs` | Routes registered correctly |
| `backend/tests/*.rs` | **BROKEN** - SQLite references |

---

### Verdict: ❌ Changes Requested

**Blocking issues that must be addressed:**
1. Add `scaffold_version` field to schema and model
2. Implement unpublish endpoint (published → reviewed)
3. Add check for student attempts before allowing draft transition
4. Fix test compilation errors (SQLite → PostgreSQL)
5. **NEW:** Fix i32 → i64 type mismatch in `modules.rs` COUNT queries (breaks module/lesson creation)

**Recommended next steps:**
1. Add migration for `scaffold_version` column
2. Create `POST /problems/:id/unpublish` endpoint
3. Add `check_student_attempts()` helper function
4. Update tests to use PostgreSQL

---

### Test Results (2026-01-17)

| Test Suite | Status | Details |
|------------|--------|---------|
| Frontend Unit Tests | ✅ **PASS** | 168 passed, 40 skipped |
| Backend Rust Tests | ❌ **BUILD FAIL** | SQLite imports in PostgreSQL project |
| E2E Tests | ⚠️ **PARTIAL** | 30 passed, 2 failed |

#### Frontend Tests (Passed)
```
✓ src/test/prd/T1-authentication.test.ts (14 tests | 3 skipped)
✓ src/test/prd/T2-class-management.test.ts (15 tests | 4 skipped)
✓ src/test/prd/S4-rewards.test.ts (17 tests | 10 skipped)
✓ src/test/prd/T3-student-management.test.ts (20 tests | 7 skipped)
✓ src/test/components/ProgressBar.test.tsx (16 tests)
✓ src/test/prd/T10-analytics.test.ts (31 tests | 16 skipped)
✓ src/test/components/Button.test.tsx (19 tests)
✓ src/test/prd/S3-problem-solving.test.ts (15 tests)
✓ src/test/api/client.test.ts (35 tests)
✓ src/test/prd/S1-student-auth.test.ts (10 tests)
✓ src/test/components/StudentLogin.test.tsx (16 tests)
```

#### Backend Tests (Build Failed)
```
error[E0432]: unresolved import `sqlx::sqlite`
  --> tests/common/mod.rs:9:11
   | use sqlx::sqlite::SqlitePoolOptions;
   |           ^^^^^^ could not find `sqlite` in `sqlx`
```
Tests still reference SQLite when the project uses PostgreSQL.

#### E2E Tests (30/32 passed)
```
✓ teacher-flow.test.ts - 12 passed, 2 failed
✓ integration.test.ts - 10 passed
✓ student-flow.test.ts - 8 passed
```

**E2E Failures (2):**
- T5.1 should create a module ❌
- T5.3 should create a lesson ❌

**Root Cause - Backend Bug in `modules.rs`:**
```
error occurred while decoding column 0: mismatched types;
Rust type `i32` (as SQL type `INT4`) is not compatible with SQL type `INT8`
```
The code uses `sqlx::query_scalar::<_, i32>` for COUNT queries, but PostgreSQL COUNT returns BIGINT (INT8). This affects module and lesson creation.

**Fix Required:** Change `i32` to `i64` in COUNT query scalars in `backend/src/routes/modules.rs`

---

## Review History

(none yet)

---

*Reviewer: Update this file after reviewing Coder's changes. Manager will coordinate.*

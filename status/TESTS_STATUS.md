# Tests Status

**Last Updated:** January 17, 2026
**Overall Status:** Needs Attention

---

## Summary

| Test Suite | Status | Notes |
|------------|--------|-------|
| Backend (Rust) | ⚠️ Not Run | Need to run after PostgreSQL migration |
| Frontend (Vitest) | ❌ Pre-existing failures | Test infrastructure issues |
| E2E (Playwright) | ⚠️ Not Run | Blocked by frontend test issues |

---

## Backend Tests

**Location:** `backend/tests/`

**Command:**
```bash
cd backend && cargo test
```

**Status:** NOT RUN YET

**Risk Areas After PostgreSQL Migration:**
1. Boolean handling (was INTEGER, now BOOLEAN)
2. JSON/JSONB field parsing
3. Timestamp handling
4. Parameter placeholder changes ($1 vs ?)

**Recommendation:** Run tests immediately to catch any PostgreSQL compatibility issues.

---

## Frontend Tests

**Location:** `frontend/src/test/`

**Command:**
```bash
cd frontend && npm test
```

**Status:** PRE-EXISTING FAILURES (not caused by Phase 2 work)

### Known Issues:

#### 1. `src/test/components/StudentLogin.test.tsx`
```
error TS2345: Argument of type '() => void' is not assignable to parameter of type 'number'.
Lines: 143, 158, 178
```
**Cause:** Incorrect usage of `vi.advanceTimersByTime()` - should pass number, not callback.

**Fix:**
```typescript
// Wrong:
vi.advanceTimersByTime(() => { ... })

// Correct:
vi.advanceTimersByTime(1000)
```

#### 2. `src/test/utils.tsx`
```
error TS2304: Cannot find name 'expect'.
Lines: 116, 120
```
**Cause:** Missing import for `expect` from Vitest.

**Fix:**
```typescript
import { expect } from 'vitest';
```

### Test Fixtures Updated ✅

Updated `frontend/src/test/fixtures/index.ts` for Phase 2 types:
- Added `state: 'published'` to problem fixtures
- Added `release_type: 'immediate'` to lesson fixtures

---

## E2E Tests

**Location:** `e2e/`

**Command:**
```bash
cd e2e && npm test
```

**Status:** NOT RUN YET

**Dependencies:**
- Frontend must build successfully
- Backend must be running
- PostgreSQL must be running

---

## Phase 2 Test Coverage Needed

Based on `PHASE2_IMPLEMENTATION.md`, these test scenarios should be verified:

### P2.1 - Problem State Workflow
- [ ] Create problem → state is 'draft'
- [ ] Generate scaffold → state is 'scaffolded'
- [ ] Review problem → state is 'reviewed'
- [ ] Publish problem → state is 'published'
- [ ] Cannot transition to 'draft' if student attempts exist

### P2.2 - Edit Scaffold Steps
- [ ] Update step question
- [ ] Update step answers
- [ ] Reorder steps
- [ ] Add new step
- [ ] Delete step
- [ ] Validation (min chars, at least 1 correct answer)

### P2.3 - Bulk Student Import
- [ ] Create N students
- [ ] CSV import with external_id, roster_id, notes
- [ ] Duplicate handling (skip existing external_id)
- [ ] Max 50 students limit

### P2.4 - Credential Export
- [ ] CSV export with all fields
- [ ] JSON export
- [ ] PDF export (NOT IMPLEMENTED YET)

### P2.5 - Roster Mapping
- [ ] Update roster_id
- [ ] Update notes
- [ ] Clear fields (set to null)

### P2.6 - Password Reset
- [ ] Request reset for existing email
- [ ] Request reset for non-existent email (same response)
- [ ] Use valid token to reset password
- [ ] Reject expired token
- [ ] Reject used token
- [ ] Rate limiting (NOT IMPLEMENTED YET)

### P2.7 - Class Purpose/Description
- [ ] Create class with purpose and description
- [ ] Update class purpose and description
- [ ] Max length validation

### P2.8 - Lesson Release Scheduling
- [ ] Immediate release (default)
- [ ] Scheduled release at specific datetime
- [ ] Manual release (hidden until explicitly released)
- [ ] Sequential release (after previous lesson completed)

---

## Recommendations

1. **Immediate:** Fix the two pre-existing frontend test file errors
2. **Next:** Run `cargo test` to verify PostgreSQL migration
3. **Then:** Run full test suite and fix any failures
4. **Finally:** Add new tests for Phase 2 features

---

## Test Commands Quick Reference

```bash
# Backend tests
cd backend && cargo test

# Frontend tests (watch mode)
cd frontend && npm test

# Frontend tests (single run)
cd frontend && npm test -- --run

# E2E tests
cd e2e && npm test

# Type check only
cd frontend && npx tsc --noEmit
```

# Phase 2 Coordination Hub

**Manager Session:** manager
**Coder Session:** coder
**Reviewer Session:** reviewer

---

## Current Sprint: Phase 2 Implementation

### Task Queue (Priority Order)

| # | Feature | Status | Coder | Reviewer |
|---|---------|--------|-------|----------|
| 1 | Problem State Workflow (T6.3) | 🔄 Pending | - | - |
| 2 | Edit Scaffold Steps (T7.3) | ⏳ Queued | - | - |
| 3 | Bulk Student Import (T3.4) | ⏳ Queued | - | - |
| 4 | Credential Export (T3.9) | ⏳ Queued | - | - |
| 5 | Roster Mapping (T3.2) | ⏳ Queued | - | - |
| 6 | Password Reset (T1.3) | ⏳ Queued | - | - |
| 7 | Class Purpose/Description (T2.3) | ⏳ Queued | - | - |
| 8 | Lesson Release Scheduling (T5.5) | ⏳ Queued | - | - |

**Legend:** ⏳ Queued | 🔄 In Progress | 🔍 In Review | ✅ Done | ❌ Blocked

---

## Active Task

**Task:** Problem State Workflow (T6.3)
**Status:** Waiting for Coder to start

### Coder Instructions
1. Read `status/PHASE2_IMPLEMENTATION.md` for full spec
2. Check existing migration `backend/migrations/004_phase2_features.sql`
3. Implement state field and transitions in backend
4. Add API endpoint `PUT /api/problems/:id/state`
5. Update frontend to show/change problem states
6. Run tests: `cd backend && cargo test`
7. Update `status/CODER_OUTPUT.md` with results

### Reviewer Instructions
1. Wait for Coder to update `status/CODER_OUTPUT.md`
2. Review code changes for:
   - State machine correctness (allowed transitions)
   - Business rules (no draft if students have attempts)
   - Unpublish freezes ALL student access
3. Update `status/REVIEWER_FEEDBACK.md` with findings
4. Mark approved or request changes

---

## Communication Protocol

### Coder → Manager
Update `status/CODER_OUTPUT.md` with:
- Files changed
- Tests run and results
- Any blockers or questions

### Reviewer → Manager
Update `status/REVIEWER_FEEDBACK.md` with:
- Code review findings
- Approval or changes requested
- Suggestions

### Manager → Both
Updates this file (`status/COORDINATION.md`) with:
- Next task assignment
- Priority changes
- Clarifications

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `PRODUCT_SPEC.md` | Full PRD |
| `status/PHASE2_IMPLEMENTATION.md` | Implementation guide |
| `docs/TESTING_GUIDE.md` | Test scenarios |
| `test_data/` | Test data files |

---

## Session Log

### 2026-01-17 19:15
- Manager: Created coordination system
- Waiting for Coder to start Task 1 (Problem State Workflow)

---

*Update this file to track progress. All sessions should check this file regularly.*

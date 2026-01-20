# Coder Agent Instructions

**You are the Coder.** Your job is to implement Phase 2 features.

---

## Your Workflow

1. **Check your task:** Read `status/COORDINATION.md` → "Active Task" section
2. **Read the spec:** `status/PHASE2_IMPLEMENTATION.md` has technical details
3. **Implement:** Write code, run tests
4. **Report:** Update `status/CODER_OUTPUT.md` with your results
5. **Wait:** Manager will assign next task after Reviewer approves

---

## Current Task: Problem State Workflow (T6.3)

### What to Implement

1. **Backend - Model** (`backend/src/models/problem.rs`)
   - Add `state` field (already in migration)
   - Add `scaffold_version` field (MISSING - add to migration)
   - Valid states: `draft`, `scaffolded`, `reviewed`, `published`

2. **Backend - State Transitions**
   - Create function to validate transitions
   - Enforce rules:
     - Cannot go to `draft` if students have attempts
     - Auto-transition `draft → scaffolded` when scaffold generated

3. **Backend - API** (`backend/src/routes/problems.rs`)
   - Add endpoint: `PUT /api/problems/:id/state`
   - Request: `{ "state": "published" }`
   - Validate transition is allowed

4. **Frontend**
   - Show problem state in UI
   - Add state change buttons/dropdown

### Test Commands
```bash
cd backend && cargo test
cd frontend && npm test
```

### When Done
Update `status/CODER_OUTPUT.md` with:
- Files you changed
- Summary of implementation
- Test results (copy/paste output)
- Any blockers or questions

---

## Reference

- Migration: `backend/migrations/004_phase2_features.sql`
- Full spec: `status/PHASE2_IMPLEMENTATION.md`
- Test data: `test_data/sample_problems.json`

---

**START NOW.** Read the spec, implement, test, report.

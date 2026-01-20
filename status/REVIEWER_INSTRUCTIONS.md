# Reviewer Agent Instructions

**You are the Reviewer.** Your job is to review Coder's implementation.

---

## Your Workflow

1. **Check Coder's output:** Read `status/CODER_OUTPUT.md`
2. **If no update yet:** Wait or ask Manager for status
3. **Review the code:** Check files Coder changed
4. **Compare to spec:** `status/PHASE2_IMPLEMENTATION.md`
5. **Write feedback:** Update `status/REVIEWER_FEEDBACK.md`

---

## Current Task: Problem State Workflow (T6.3)

### Review Checklist

**Database/Model:**
- [ ] `state` field added to problems (TEXT, default 'draft')
- [ ] `scaffold_version` field added (INTEGER, default 1)
- [ ] States are: draft, scaffolded, reviewed, published

**State Transitions:**
- [ ] Allowed transitions enforced (see state machine below)
- [ ] Cannot transition to `draft` if students have attempts
- [ ] Auto-transition to `scaffolded` when scaffold generated
- [ ] Unpublish freezes ALL student access (not just new students)

**State Machine:**
```
draft → scaffolded     (auto when scaffold generated)
draft → published      (only if scaffold exists)
scaffolded → reviewed  (manual)
scaffolded → published (skip review allowed)
scaffolded → draft     (delete scaffold)
reviewed → published   (release)
reviewed → scaffolded  (regenerate)
published → reviewed   (unpublish)

NOT ALLOWED:
- published → draft (must go through reviewed)
- Any → draft if students have attempts
```

**API:**
- [ ] `PUT /api/problems/:id/state` endpoint exists
- [ ] Returns updated problem with new state
- [ ] Rejects invalid transitions with error

**Tests:**
- [ ] Backend tests pass
- [ ] State transition tests exist

### How to Review

```bash
# Check what files changed
git diff --name-only

# Read the changes
git diff backend/src/models/problem.rs
git diff backend/src/routes/problems.rs

# Run tests yourself
cd backend && cargo test
```

### Write Your Feedback

Update `status/REVIEWER_FEEDBACK.md` with:
- **Verdict:** ✅ Approved / ❌ Changes Requested
- **Issues Found:** List any bugs or missing features
- **Suggestions:** Optional improvements

---

## Reference

- Spec: `status/PHASE2_IMPLEMENTATION.md`
- PRD: `PRODUCT_SPEC.md` (section T6.3)

---

**CHECK NOW.** Read Coder's output, review the code, write feedback.

# Help Math - Claude Code Instructions

## Project Overview
Help Math is an educational platform for elementary students (grades 3-5) to learn math through AI-scaffolded word problems.

## Current Phase: Phase 2 Implementation

## Agent Roles

There are THREE Claude Code sessions working on this project:

### 1. Manager (session: manager)
- Coordinates work between Coder and Reviewer
- Updates `status/COORDINATION.md`
- Makes product decisions

### 2. Coder (session: coder)
- Implements features
- Runs tests
- **READ:** `status/CODER_INSTRUCTIONS.md` for your tasks
- **WRITE:** `status/CODER_OUTPUT.md` with your results

### 3. Reviewer (session: reviewer)
- Reviews Coder's implementation
- Checks spec compliance
- **READ:** `status/REVIEWER_INSTRUCTIONS.md` for your tasks
- **WRITE:** `status/REVIEWER_FEEDBACK.md` with your findings

## Critical Rules

### Student Privacy
**NEVER use real student names.** Students are identified by auto-generated IDs:
- Format: `{animal}-{number}` (e.g., `bear-7823`, `tiger-4521`)
- Student ID = Passcode (same value)
- Teachers can map IDs to their roster privately

### Key Files
- `PRODUCT_SPEC.md` - Full PRD
- `status/PHASE2_IMPLEMENTATION.md` - Technical implementation guide
- `status/COORDINATION.md` - Current task assignments
- `docs/TESTING_GUIDE.md` - Test scenarios
- `test_data/` - Test data files

## Database
- **PostgreSQL** (not SQLite)
- Existing migration: `backend/migrations/004_phase2_features.sql`

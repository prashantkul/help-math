# Help Math - Test Harness Documentation

This document describes the test harness for the Help Math application. **All tests are based on the Product Specification (PRODUCT_SPEC.md)**, not the code. This ensures that:

1. Tests serve as executable specifications
2. Feature completeness is measured against the PRD
3. Unimplemented features are clearly marked as skipped/pending
4. Code progress is tracked by test passage, not code coverage

## Test Philosophy

```
PRD (Source of Truth) → Tests (Executable Specs) → Code (Implementation)
```

**NOT:**
```
Code → Tests → PRD
```

Tests marked with `.skip()` indicate features that are specified in the PRD but not yet implemented.

---

## Test Structure

```
help-math/
├── frontend/
│   └── src/test/
│       ├── setup.ts                    # Global test setup
│       ├── utils.tsx                   # Test utilities
│       ├── fixtures/                   # Test data
│       │   └── index.ts
│       ├── mocks/                      # MSW API mocks
│       │   ├── handlers.ts
│       │   └── server.ts
│       ├── api/                        # API client tests
│       │   └── client.test.ts
│       ├── components/                 # Component tests
│       │   ├── Button.test.tsx
│       │   ├── ProgressBar.test.tsx
│       │   └── StudentLogin.test.tsx
│       └── prd/                        # PRD-based feature tests
│           ├── T1-authentication.test.ts
│           ├── T2-class-management.test.ts
│           ├── T3-student-management.test.ts
│           ├── T10-analytics.test.ts
│           ├── S1-student-auth.test.ts
│           ├── S3-problem-solving.test.ts
│           └── S4-rewards.test.ts
├── backend/
│   └── tests/
│       ├── common/
│       │   └── mod.rs                  # Test utilities
│       └── auth_tests.rs               # Auth integration tests
└── e2e/
    └── src/
        ├── setup.ts                    # E2E setup
        ├── helpers/
        │   ├── api.ts                  # API helpers
        │   └── fixtures.ts             # Test data generators
        └── tests/
            ├── teacher-flow.test.ts    # Complete teacher workflow
            ├── student-flow.test.ts    # Complete student workflow
            └── integration.test.ts     # Cross-cutting tests
```

---

## PRD Feature Coverage

### Teacher Portal (T1-T10)

| Feature | PRD Section | Test File | Status |
|---------|-------------|-----------|--------|
| Teacher Registration | T1.1 | `T1-authentication.test.ts` | ✅ Tested |
| Teacher Login | T1.2 | `T1-authentication.test.ts` | ✅ Tested |
| Password Reset | T1.3 | `T1-authentication.test.ts` | ⏭️ Skipped (Not Implemented) |
| Create Class | T2.1 | `T2-class-management.test.ts` | ✅ Tested |
| Class Settings | T2.2 | `T2-class-management.test.ts` | ✅ Tested |
| Class Purpose | T2.3 | `T2-class-management.test.ts` | ⏭️ Skipped (Not Implemented) |
| Student Privacy ID | T3.1 | `T3-student-management.test.ts` | ✅ Tested |
| Roster Mapping | T3.2 | `T3-student-management.test.ts` | ⏭️ Skipped (Not Implemented) |
| Add Student | T3.3 | `T3-student-management.test.ts` | ✅ Tested |
| Bulk Import | T3.4 | `T3-student-management.test.ts` | ⏭️ Skipped (Not Implemented) |
| Class Analytics | T10.1 | `T10-analytics.test.ts` | ✅ Tested |
| Student Analytics | T10.2 | `T10-analytics.test.ts` | ✅ Tested |
| Problem Analytics | T10.3 | `T10-analytics.test.ts` | ⚠️ Partial |
| Export Reports | T10.4 | `T10-analytics.test.ts` | ⏭️ Skipped (Not Implemented) |
| AI-Friendly Export | T10.5 | `T10-analytics.test.ts` | ⏭️ Skipped (Not Implemented) |

### Student Portal (S1-S5)

| Feature | PRD Section | Test File | Status |
|---------|-------------|-----------|--------|
| Student Login | S1.1 | `S1-student-auth.test.ts` | ✅ Tested |
| Remember Me | S1.2 | `S1-student-auth.test.ts` | ✅ Tested |
| Avatar Selection | S1.3 | `S1-student-auth.test.ts` | ✅ Tested |
| Problem Display | S3.1 | `S3-problem-solving.test.ts` | ✅ Tested |
| Step Workflow | S3.2 | `S3-problem-solving.test.ts` | ✅ Tested |
| Step Types | S3.3 | `S3-problem-solving.test.ts` | ✅ Tested |
| Instant Feedback | S3.5 | `S3-problem-solving.test.ts` | ✅ Tested |
| Hints | S3.6 | `S3-problem-solving.test.ts` | ✅ Tested |
| Retry Mechanism | S3.7 | `S3-problem-solving.test.ts` | ✅ Tested |
| Points System | S4.1 | `S4-rewards.test.ts` | ✅ Tested |
| Star Ratings | S4.2 | `S4-rewards.test.ts` | ✅ Tested |
| Achievements | S4.4 | `S4-rewards.test.ts` | ⏭️ Skipped (Not Implemented) |
| Leaderboard | S4.5 | `S4-rewards.test.ts` | ⏭️ Skipped (Not Implemented) |

---

## Running Tests

### Frontend Unit & Integration Tests

```bash
cd frontend

# Install dependencies (first time)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run only PRD-based tests
npm test -- --grep "T1|T2|T3|T10|S1|S3|S4"
```

### Backend Tests

```bash
cd backend

# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test auth_tests
```

### E2E Integration Tests

```bash
# Terminal 1: Start backend
cd backend
cargo run

# Terminal 2: Run E2E tests
cd e2e
npm install
npm test
```

---

## Writing New Tests

### PRD-Based Test Template

When adding tests for new PRD features, follow this structure:

```typescript
/**
 * TX. [Section Name] Tests
 * Based on PRODUCT_SPEC.md - [Portal] > TX. [Section Name]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../../api/client';
import { fixtures } from '../fixtures';

describe('TX. [Section Name]', () => {
  beforeEach(() => {
    // Setup
  });

  describe('TX.Y [Feature Name]', () => {
    /**
     * PRD Specification:
     * - [Copy relevant PRD text]
     * - [Fields, flows, validation rules]
     */

    it('should [expected behavior from PRD]', async () => {
      // Test implementation
    });

    // For unimplemented features:
    it.skip('should [future behavior from PRD]', async () => {
      // TODO: Implement when feature is available
    });
  });
});
```

### Test Naming Convention

- Test files: `TX-[section-name].test.ts` (e.g., `T3-student-management.test.ts`)
- Describe blocks: Match PRD section numbers (e.g., `T3.1 Student Privacy ID System`)
- Test names: Start with "should" and describe expected behavior from PRD

---

## Feature Implementation Workflow

When implementing a new feature:

1. **Read PRD** - Understand the feature specification in `PRODUCT_SPEC.md`
2. **Write Tests First** - Create tests based on PRD in `frontend/src/test/prd/`
3. **Verify Tests Fail** - Run tests to confirm feature is not implemented
4. **Implement Feature** - Write code to make tests pass
5. **Remove `.skip()`** - Once feature works, remove skip from tests
6. **Update PRD Status** - Change "Not Implemented" to "Implemented" in PRD

This ensures tests always reflect the PRD, not the code.

---

## Test Data & Fixtures

### Frontend Fixtures (`frontend/src/test/fixtures/index.ts`)

Pre-defined test data matching the PRD's data models:

- `fixtures.teachers` - Teacher accounts
- `fixtures.classes` - Classes with settings
- `fixtures.students` - Students with IDs (not real names)
- `fixtures.modules` - Curriculum modules
- `fixtures.lessons` - Lessons
- `fixtures.problems` - Problems with scaffold steps
- `fixtures.analytics` - Analytics data

### E2E Fixtures (`e2e/src/helpers/fixtures.ts`)

Generators for unique test data:

- `generateTeacher()` - Creates unique teacher credentials
- `generateClassName()` - Creates unique class names
- `sampleProblems` - Array of sample word problems

---

## Continuous Integration

Tests should run on every PR:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm test

  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: cd backend && cargo test

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [frontend-tests, backend-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd backend && cargo run &
      - run: sleep 10
      - run: cd e2e && npm ci && npm test
```

---

## Measuring Progress

Progress is measured by test passage against PRD, not code coverage:

```bash
# See which PRD features are passing
npm test -- --reporter=verbose 2>&1 | grep -E "✓|✗|↓" | head -50

# Count implemented vs. skipped tests
npm test -- --reporter=json 2>&1 | jq '.testResults[].assertionResults[] | .status' | sort | uniq -c
```

**Goal:** All non-skipped tests passing = PRD features implemented correctly.

---

## Troubleshooting

### Tests Fail with "Network Error"

For unit tests, check MSW handlers in `frontend/src/test/mocks/handlers.ts`.

### E2E Tests Fail with "Backend not available"

Ensure backend is running: `cd backend && cargo run`

### Tests Pass but Feature Doesn't Work

Tests may be too lenient. Review PRD and add more specific assertions.

### Skipped Tests Should Now Pass

Feature was implemented. Remove `.skip()` and verify test passes.

---

*Tests are the executable specification of the PRD. If the PRD changes, tests must change first.*

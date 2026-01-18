# E2E Integration Tests

This directory contains end-to-end integration tests that test the frontend and backend together.

## Overview

These tests run against a live backend server and test complete user flows through the application.

## Prerequisites

1. Backend server running on `http://localhost:8080`
2. Frontend dev server running on `http://localhost:5173` (optional for API-only tests)

## Running Tests

```bash
# Start the backend first
cd backend
cargo run

# In another terminal, run the E2E tests
cd e2e
npm test
```

## Test Structure

```
e2e/
├── package.json          # E2E test dependencies
├── vitest.config.ts      # Vitest configuration
├── src/
│   ├── setup.ts          # Global test setup
│   ├── helpers/
│   │   ├── api.ts        # API helper functions
│   │   └── fixtures.ts   # Test data generators
│   └── tests/
│       ├── teacher-flow.test.ts    # Complete teacher workflow
│       ├── student-flow.test.ts    # Complete student workflow
│       └── integration.test.ts     # Cross-cutting integration tests
```

## Test Scenarios

### Teacher Flow
1. Register a new teacher account
2. Create a class
3. Add students
4. Create a module and lesson
5. Create a problem
6. Generate AI scaffolding
7. Review and publish
8. View analytics

### Student Flow
1. Join class with code + passcode
2. Select avatar
3. View assignments
4. Solve a problem step by step
5. Earn points and stars
6. View progress

### Integration Tests
- Teacher creates problem → Student solves it
- Analytics update after student completion
- Multiple students in same class

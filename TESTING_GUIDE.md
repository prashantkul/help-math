# Help Math App - Testing Guide

## Overview

Help Math is an educational app designed to help students learn math through scaffolded word problems. Teachers can create classes, upload math problems, and track student progress. Students join classes and work through problems step-by-step.

**Live App:** https://web-frontend-production-594c.up.railway.app

---

## Quick Start

### Test Credentials

See `TEST_CREDENTIALS.md` for pre-created accounts, or create your own:

| Role | Email | Password |
|------|-------|----------|
| Teacher 1 | teacher1@test.com | password123 |
| Teacher 2 | teacher2@test.com | password123 |

| Student | Class Code |
|---------|------------|
| Emma Wilson | 96T2A2 |
| Liam Garcia | 96T2A2 |
| Noah Thompson | 6Y78B7 |

---

## Testing as a Teacher

### 1. Registration & Login

1. Go to `/teacher/login`
2. Click "Create an account" to register a new teacher
3. Fill in name, email, and password
4. After registration, you'll be redirected to the dashboard

**Test Points:**
- [ ] Registration with valid email works
- [ ] Login with correct credentials works
- [ ] Login with wrong password shows errori
- [ ] Logout works correctly

### 2. Class Management

1. From the dashboard, click "Create Class"
2. Enter a class name (e.g., "5th Grade Math")
3. Note the generated **Join Code** (6 characters)

**Test Points:**
- [ ] Class is created successfully
- [ ] Join code is displayed
- [ ] Class appears in dashboard
- [ ] Can copy join code to clipboard

### 3. Adding Math Problems

#### Option A: Manual Entry
1. Go to your class
2. Click "Add Problem"
3. Type or paste a word problem
4. Click "Generate Scaffold" to create step-by-step breakdown

#### Option B: PDF Upload
1. Click "Upload PDF"
2. Select a PDF containing math word problems
3. The system extracts and parses problems automatically

**Test Points:**
- [ ] Manual problem entry works
- [ ] AI generates scaffold steps correctly
- [ ] PDF upload extracts problems
- [ ] Can edit generated scaffolds
- [ ] Can publish/unpublish problems

### 4. Class Settings

1. Go to class management
2. Click "Settings"
3. Adjust:
   - **ELL Level** (1-3): Vocabulary simplification level
   - **Show Emojis**: Visual hints for problems

**Test Points:**
- [ ] Settings save correctly
- [ ] ELL level affects problem text simplification
- [ ] Emoji toggle works

### 5. Viewing Analytics

1. Go to class dashboard
2. Click "Analytics" or view individual student progress
3. See completion rates, points earned, and problem performance

**Test Points:**
- [ ] Class-level analytics display correctly
- [ ] Individual student progress is accurate
- [ ] Points and stars are calculated correctly

---

## Testing as a Student

### 1. Joining a Class

1. Go to `/student` (or click "I'm a Student")
2. Enter your name
3. Enter the class join code (e.g., `96T2A2`)
4. Click "Join Class"

**Test Points:**
- [ ] Valid join code works
- [ ] Invalid join code shows error
- [ ] Student name is saved
- [ ] Redirected to student dashboard

### 2. Viewing Assignments

1. After joining, see available assignments
2. Each assignment shows:
   - Title
   - Number of problems
   - Your progress

**Test Points:**
- [ ] Assignments from teacher are visible
- [ ] Progress indicator is accurate
- [ ] Can click to start a problem

### 3. Solving Problems

1. Click on a problem to start
2. Read the word problem (simplified based on ELL level)
3. Work through each scaffold step:
   - Answer questions
   - Select from multiple choice
   - Enter numeric answers
4. Get immediate feedback on each step
5. Earn points and stars upon completion

**Test Points:**
- [ ] Problem text displays correctly
- [ ] Emoji hints appear (if enabled)
- [ ] Can submit answers for each step
- [ ] Correct answers give points
- [ ] Wrong answers show hints
- [ ] Progress saves between sessions
- [ ] Stars awarded on completion

### 4. Student Profile

1. Click on profile/avatar
2. Can change avatar
3. View total points earned

**Test Points:**
- [ ] Avatar selection works
- [ ] Points total is accurate
- [ ] Profile updates persist

---

## Key User Flows to Test

### Flow 1: Complete Teacher-Student Cycle
1. Teacher registers → creates class → adds problem → publishes
2. Student joins class → sees problem → completes all steps
3. Teacher views analytics → sees student progress

### Flow 2: ELL Accommodation
1. Teacher sets class to ELL Level 1 (most simplified)
2. Student sees simplified vocabulary in problems
3. Compare with ELL Level 3 (less simplified)

### Flow 3: Multi-Step Problem
1. Teacher creates problem with 5+ scaffold steps
2. Student works through each step
3. Verify hints appear on wrong answers
4. Verify points decrease with multiple attempts
5. Verify stars calculation at end

---

## API Endpoints (for developers)

### Authentication
- `POST /api/auth/teacher/register` - Register teacher
- `POST /api/auth/teacher/login` - Teacher login
- `POST /api/auth/student/join` - Student joins class

### Classes
- `GET /api/classes` - List teacher's classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id/students` - List students in class
- `PUT /api/classes/:id/settings` - Update class settings

### Problems
- `GET /api/problems?class_id=X` - List problems
- `POST /api/problems` - Create problem
- `POST /api/problems/:id/scaffold` - Generate AI scaffold
- `POST /api/problems/:id/publish` - Publish problem

### Student
- `GET /api/student/assignments` - Get assignments
- `GET /api/student/problems/:id` - Get problem with steps
- `POST /api/student/problems/:id/attempt` - Submit step answer
- `GET /api/student/progress` - Get overall progress

---

## Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| "Failed to create account" | Check if email is already registered |
| "Invalid join code" | Verify 6-character code with teacher |
| Problems not showing | Ensure teacher has published the problems |
| Points not updating | Refresh the page or check network |
| PDF upload fails | Ensure PDF contains text (not scanned images) |

---

## Browser Compatibility

Tested on:
- Chrome (recommended)
- Firefox
- Safari
- Edge

Mobile responsive design works on iOS and Android.

---

## Feedback

Report issues or suggestions at the project repository.

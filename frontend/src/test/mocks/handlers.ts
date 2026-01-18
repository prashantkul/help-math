import { http, HttpResponse, delay } from 'msw';
import { fixtures } from '../fixtures';

const API_BASE = '/api';

export const handlers = [
  // ============ AUTH HANDLERS ============

  // Teacher Registration
  http.post(`${API_BASE}/auth/teacher/register`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name: string };

    if (!body.email || !body.password || !body.name) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // PRD T1.1: Email format validation
    if (!body.email.includes('@') || !body.email.includes('.')) {
      return HttpResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // PRD T1.1: Password strength (min 8 chars per PRD)
    if (body.password.length < 8) {
      return HttpResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (body.email === 'existing@test.com') {
      return HttpResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      token: fixtures.tokens.teacher,
      teacher: { ...fixtures.teachers.default, email: body.email, name: body.name },
    });
  }),

  // Teacher Login
  http.post(`${API_BASE}/auth/teacher/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === 'teacher1@test.com' && body.password === 'password123') {
      return HttpResponse.json({
        token: fixtures.tokens.teacher,
        teacher: fixtures.teachers.default,
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Student Join
  http.post(`${API_BASE}/auth/student/join`, async ({ request }) => {
    const body = await request.json() as { class_code: string; passcode: string };

    if (body.class_code === '96T2A2' && body.passcode === '1111') {
      return HttpResponse.json({
        student: fixtures.students.default,
        class_name: fixtures.classes.default.name,
        session_token: fixtures.tokens.student,
      });
    }

    return HttpResponse.json(
      { error: 'Invalid class code or passcode' },
      { status: 401 }
    );
  }),

  // ============ CLASS HANDLERS ============

  // List Classes
  http.get(`${API_BASE}/classes`, () => {
    return HttpResponse.json([fixtures.classes.default]);
  }),

  // Create Class
  http.post(`${API_BASE}/classes`, async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json({
      ...fixtures.classes.default,
      id: crypto.randomUUID(),
      name: body.name,
      join_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    });
  }),

  // Get Class Students
  http.get(`${API_BASE}/classes/:classId/students`, ({ params }) => {
    if (params.classId === fixtures.classes.default.id) {
      return HttpResponse.json(fixtures.studentList);
    }
    return HttpResponse.json([]);
  }),

  // Create Student
  http.post(`${API_BASE}/classes/:classId/students`, async ({ request }) => {
    const body = await request.json() as { name: string; external_id?: string };
    return HttpResponse.json({
      ...fixtures.students.default,
      id: crypto.randomUUID(),
      name: body.name,
      external_id: body.external_id,
      passcode: `test-${Math.floor(Math.random() * 10000)}`,
    });
  }),

  // Remove Student
  http.delete(`${API_BASE}/classes/:classId/students/:studentId`, () => {
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  // Reset Student Passcode
  http.post(`${API_BASE}/classes/:classId/students/:studentId/reset-passcode`, () => {
    return HttpResponse.json({
      ...fixtures.students.default,
      passcode: `new-${Math.floor(Math.random() * 10000)}`,
    });
  }),

  // Update Class Settings
  http.put(`${API_BASE}/classes/:classId/settings`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...fixtures.classes.default,
      id: params.classId,
      settings: { ...fixtures.classes.default.settings, ...body },
    });
  }),

  // ============ MODULE HANDLERS ============

  // List Modules
  http.get(`${API_BASE}/classes/:classId/modules`, () => {
    return HttpResponse.json([fixtures.modules.default]);
  }),

  // Create Module
  http.post(`${API_BASE}/classes/:classId/modules`, async ({ request, params }) => {
    const body = await request.json() as { name: string; description?: string };
    return HttpResponse.json({
      id: crypto.randomUUID(),
      class_id: params.classId,
      name: body.name,
      description: body.description || null,
      sort_order: 1,
      is_published: false,
      created_at: new Date().toISOString(),
    });
  }),

  // Update Module
  http.put(`${API_BASE}/modules/:moduleId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...fixtures.modules.default,
      id: params.moduleId,
      ...body,
    });
  }),

  // Delete Module
  http.delete(`${API_BASE}/modules/:moduleId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ============ LESSON HANDLERS ============

  // List Lessons
  http.get(`${API_BASE}/modules/:moduleId/lessons`, () => {
    return HttpResponse.json([fixtures.lessons.default]);
  }),

  // Create Lesson
  http.post(`${API_BASE}/modules/:moduleId/lessons`, async ({ request, params }) => {
    const body = await request.json() as { name: string; description?: string };
    return HttpResponse.json({
      id: crypto.randomUUID(),
      module_id: params.moduleId,
      name: body.name,
      description: body.description || null,
      sort_order: 1,
      is_published: false,
      created_at: new Date().toISOString(),
    });
  }),

  // Get Lesson
  http.get(`${API_BASE}/lessons/:lessonId`, ({ params }) => {
    return HttpResponse.json({
      ...fixtures.lessons.default,
      id: params.lessonId,
    });
  }),

  // Update Lesson
  http.put(`${API_BASE}/lessons/:lessonId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...fixtures.lessons.default,
      id: params.lessonId,
      ...body,
    });
  }),

  // Delete Lesson
  http.delete(`${API_BASE}/lessons/:lessonId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ============ PROBLEM HANDLERS ============

  // List Problems
  http.get(`${API_BASE}/problems`, ({ request }) => {
    const url = new URL(request.url);
    const classId = url.searchParams.get('class_id');
    const lessonId = url.searchParams.get('lesson_id');

    if (classId || lessonId) {
      return HttpResponse.json([fixtures.problems.default]);
    }
    return HttpResponse.json([]);
  }),

  // Create Problem
  http.post(`${API_BASE}/problems`, async ({ request }) => {
    const body = await request.json() as { class_id?: string; lesson_id?: string; original_text: string };
    return HttpResponse.json({
      ...fixtures.problems.default,
      id: crypto.randomUUID(),
      class_id: body.class_id || fixtures.classes.default.id,
      lesson_id: body.lesson_id,
      original_text: body.original_text,
      is_published: false,
      steps: [],
    });
  }),

  // Get Problem
  http.get(`${API_BASE}/problems/:problemId`, ({ params }) => {
    return HttpResponse.json({
      ...fixtures.problems.default,
      id: params.problemId,
    });
  }),

  // Update Problem
  http.put(`${API_BASE}/problems/:problemId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...fixtures.problems.default,
      id: params.problemId,
      ...body,
    });
  }),

  // Delete Problem
  http.delete(`${API_BASE}/problems/:problemId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Generate Scaffold
  http.post(`${API_BASE}/problems/:problemId/scaffold`, async () => {
    await delay(100); // Simulate AI processing time
    return HttpResponse.json(fixtures.scaffoldingResponse);
  }),

  // Publish Problem
  http.post(`${API_BASE}/problems/:problemId/publish`, ({ params }) => {
    return HttpResponse.json({
      ...fixtures.problems.default,
      id: params.problemId,
      is_published: true,
    });
  }),

  // Upload PDF
  http.post(`${API_BASE}/problems/upload`, async () => {
    await delay(200);
    return HttpResponse.json({
      extracted_problems: [
        { text: 'Maria has 5 apples. She gives 2 to her friend. How many does she have left?', page_number: 1, confidence: 0.95 },
        { text: 'Tom has 3 cars. He gets 4 more. How many cars does Tom have now?', page_number: 1, confidence: 0.92 },
      ],
    });
  }),

  // ============ ASSIGNMENT HANDLERS ============

  // List Assignments
  http.get(`${API_BASE}/assignments`, () => {
    return HttpResponse.json([fixtures.assignments.default]);
  }),

  // Create Assignment
  http.post(`${API_BASE}/assignments`, async ({ request }) => {
    const body = await request.json() as { class_id: string; title: string; problem_ids: string[] };
    return HttpResponse.json({
      id: crypto.randomUUID(),
      class_id: body.class_id,
      title: body.title,
      problem_ids: body.problem_ids,
      created_at: new Date().toISOString(),
    });
  }),

  // ============ ANALYTICS HANDLERS ============

  // Class Analytics
  http.get(`${API_BASE}/analytics/class/:classId`, () => {
    return HttpResponse.json(fixtures.analytics.class);
  }),

  // Student Analytics
  http.get(`${API_BASE}/analytics/student/:studentId`, () => {
    return HttpResponse.json(fixtures.analytics.student);
  }),

  // ============ STUDENT ROUTE HANDLERS ============

  // Student Assignments
  http.get(`${API_BASE}/student/assignments`, () => {
    return HttpResponse.json([fixtures.assignments.withProblems]);
  }),

  // Student Problem
  http.get(`${API_BASE}/student/problems/:problemId`, ({ params }) => {
    return HttpResponse.json({
      ...fixtures.problems.withSteps,
      id: params.problemId,
    });
  }),

  // Submit Step Attempt
  http.post(`${API_BASE}/student/problems/:problemId/attempt`, async ({ request }) => {
    const body = await request.json() as { step_id: string; answer: unknown };

    // Simulate correct/incorrect based on answer
    const isCorrect = body.answer === 'apples' || body.answer === 5 || body.answer === 3;

    return HttpResponse.json({
      is_correct: isCorrect,
      points_earned: isCorrect ? 10 : 0,
      hint: isCorrect ? undefined : 'Try reading the problem again carefully.',
    });
  }),

  // Student Progress
  http.get(`${API_BASE}/student/progress`, () => {
    return HttpResponse.json({
      progress: [fixtures.progress.default],
      total_points: 150,
    });
  }),

  // Student Profile
  http.get(`${API_BASE}/student/profile`, () => {
    return HttpResponse.json(fixtures.students.default);
  }),

  // Update Avatar
  http.put(`${API_BASE}/student/avatar`, async ({ request }) => {
    const body = await request.json() as { avatar: string };
    return HttpResponse.json({
      ...fixtures.students.default,
      avatar: body.avatar,
    });
  }),

  // ============ CO-TEACHER HANDLERS ============

  // List Co-Teachers
  http.get(`${API_BASE}/classes/:classId/coteachers`, () => {
    return HttpResponse.json([]);
  }),

  // Add Co-Teacher
  http.post(`${API_BASE}/classes/:classId/coteachers`, async ({ request }) => {
    const body = await request.json() as { email: string };
    return HttpResponse.json({
      id: crypto.randomUUID(),
      teacher_id: crypto.randomUUID(),
      teacher_email: body.email,
      teacher_name: 'Co-Teacher',
      added_at: new Date().toISOString(),
    });
  }),

  // Remove Co-Teacher
  http.delete(`${API_BASE}/classes/:classId/coteachers/:coteacherId`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

/**
 * E2E API Helper Functions
 * Provides typed wrappers for making API calls to the backend
 */

export const API_BASE = process.env.API_URL || 'http://localhost:8080/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || `HTTP ${response.status}` };
    }

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// ============ HEALTH CHECK ============

export async function healthCheck(): Promise<boolean> {
  // Try health endpoint first
  try {
    const response = await fetch(`${API_BASE.replace('/api', '')}/health`);
    if (response.ok) {
      return true;
    }
    // Health endpoint returned non-ok (e.g., 404), try fallback
  } catch {
    // Network error, try fallback
  }

  // Fallback: try auth endpoint - any response < 500 means server is up
  try {
    const response = await fetch(`${API_BASE}/auth/teacher/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

// ============ TEACHER AUTH ============

export interface Teacher {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  teacher?: Teacher;
}

export async function registerTeacher(
  email: string,
  password: string,
  name: string
): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/teacher/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function loginTeacher(
  email: string,
  password: string
): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/teacher/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ============ STUDENT AUTH ============

export interface Student {
  id: string;
  name: string;
  class_id: string;
  avatar: string;
  total_points: number;
}

export interface StudentJoinResponse {
  student: Student;
  class_name: string;
  session_token: string;
}

export async function joinClass(
  classCode: string,
  passcode: string
): Promise<ApiResponse<StudentJoinResponse>> {
  return request<StudentJoinResponse>('/auth/student/join', {
    method: 'POST',
    body: JSON.stringify({ class_code: classCode, passcode }),
  });
}

// ============ CLASSES ============

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  settings: {
    ell_level: 1 | 2 | 3;
    show_emojis: boolean;
    retry_limit?: number;
    point_multiplier?: number;
  };
}

export async function createClass(
  name: string,
  token: string
): Promise<ApiResponse<Class>> {
  return request<Class>('/classes', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }, token);
}

export async function getClasses(token: string): Promise<ApiResponse<Class[]>> {
  return request<Class[]>('/classes', {}, token);
}

// ============ STUDENTS ============

export interface TeacherStudent extends Student {
  passcode: string;
}

export async function createStudent(
  classId: string,
  name: string,
  token: string,
  externalId?: string
): Promise<ApiResponse<TeacherStudent>> {
  return request<TeacherStudent>(`/classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ name, external_id: externalId }),
  }, token);
}

export async function getClassStudents(
  classId: string,
  token: string
): Promise<ApiResponse<TeacherStudent[]>> {
  return request<TeacherStudent[]>(`/classes/${classId}/students`, {}, token);
}

// ============ MODULES ============

export interface Module {
  id: string;
  class_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_published: boolean;
}

export async function createModule(
  classId: string,
  name: string,
  token: string,
  description?: string
): Promise<ApiResponse<Module>> {
  return request<Module>(`/classes/${classId}/modules`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  }, token);
}

// ============ LESSONS ============

export interface Lesson {
  id: string;
  module_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_published: boolean;
}

export async function createLesson(
  moduleId: string,
  name: string,
  token: string,
  description?: string
): Promise<ApiResponse<Lesson>> {
  return request<Lesson>(`/modules/${moduleId}/lessons`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  }, token);
}

// ============ PROBLEMS ============

export interface Problem {
  id: string;
  class_id: string;
  lesson_id?: string;
  original_text: string;
  simplified_text?: string;
  is_published: boolean;
  steps?: ScaffoldStep[];
}

export interface ScaffoldStep {
  id: string;
  step_order: number;
  step_type: string;
  prompt_text: string;
  correct_answer: unknown;
  answer_type: string;
  hints: string[];
  points: number;
}

export async function createProblem(
  classId: string,
  text: string,
  token: string,
  lessonId?: string
): Promise<ApiResponse<Problem>> {
  const body = lessonId
    ? { lesson_id: lessonId, original_text: text }
    : { class_id: classId, original_text: text };

  return request<Problem>('/problems', {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
}

export async function generateScaffold(
  problemId: string,
  token: string,
  ellLevel: 1 | 2 | 3 = 2
): Promise<ApiResponse<unknown>> {
  return request<unknown>(`/problems/${problemId}/scaffold`, {
    method: 'POST',
    body: JSON.stringify({ ell_level: ellLevel }),
  }, token);
}

export async function publishProblem(
  problemId: string,
  token: string
): Promise<ApiResponse<Problem>> {
  return request<Problem>(`/problems/${problemId}/publish`, {
    method: 'POST',
  }, token);
}

// ============ STUDENT ENDPOINTS ============

export async function getStudentProblem(
  problemId: string,
  token: string
): Promise<ApiResponse<Problem>> {
  return request<Problem>(`/student/problems/${problemId}`, {}, token);
}

export async function submitStepAttempt(
  problemId: string,
  stepId: string,
  answer: unknown,
  token: string,
  timeSpentSeconds?: number
): Promise<ApiResponse<{ is_correct: boolean; points_earned: number; hint?: string }>> {
  return request<{ is_correct: boolean; points_earned: number; hint?: string }>(
    `/student/problems/${problemId}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({
        step_id: stepId,
        answer,
        time_spent_seconds: timeSpentSeconds,
      }),
    },
    token
  );
}

export async function getStudentProgress(
  token: string
): Promise<ApiResponse<{ progress: unknown[]; total_points: number }>> {
  return request<{ progress: unknown[]; total_points: number }>('/student/progress', {}, token);
}

// ============ ANALYTICS ============

export interface ClassAnalytics {
  class_id: string;
  total_students: number;
  total_problems: number;
  average_completion_rate: number;
  average_points_per_student: number;
}

export async function getClassAnalytics(
  classId: string,
  token: string
): Promise<ApiResponse<ClassAnalytics>> {
  return request<ClassAnalytics>(`/analytics/class/${classId}`, {}, token);
}

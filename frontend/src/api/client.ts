import type {
  ApiResponse,
  AuthResponse,
  Class,
  Student,
  Problem,
  Assignment,
  StudentProgress,
  ClassAnalytics,
  StudentAnalytics,
  ScaffoldingResponse,
  PDFUploadResponse,
  StudentJoinResponse,
  StepAttempt,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private teacherToken: string | null = null;
  private studentToken: string | null = null;

  constructor() {
    this.teacherToken = localStorage.getItem('teacher_token');
    this.studentToken = localStorage.getItem('student_token');
  }

  private getHeaders(isTeacher: boolean = true): HeadersInit {
    const token = isTeacher ? this.teacherToken : this.studentToken;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isTeacher: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(isTeacher),
          ...(options.headers || {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || data.message || 'An error occurred' };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Auth methods
  setTeacherToken(token: string) {
    this.teacherToken = token;
    localStorage.setItem('teacher_token', token);
  }

  setStudentToken(token: string) {
    this.studentToken = token;
    localStorage.setItem('student_token', token);
  }

  clearTeacherToken() {
    this.teacherToken = null;
    localStorage.removeItem('teacher_token');
  }

  clearStudentToken() {
    this.studentToken = null;
    localStorage.removeItem('student_token');
  }

  // Teacher Auth
  async registerTeacher(email: string, password: string, name: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('/auth/teacher/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (result.data?.token) {
      this.setTeacherToken(result.data.token);
    }
    return result;
  }

  async loginTeacher(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('/auth/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.data?.token) {
      this.setTeacherToken(result.data.token);
    }
    return result;
  }

  // Student Auth
  async joinClass(name: string, classCode: string): Promise<ApiResponse<StudentJoinResponse>> {
    const result = await this.request<StudentJoinResponse>('/auth/student/join', {
      method: 'POST',
      body: JSON.stringify({ name, class_code: classCode }),
    }, false);
    if (result.data?.session_token) {
      this.setStudentToken(result.data.session_token);
    }
    return result;
  }

  // Classes
  async getClasses(): Promise<ApiResponse<Class[]>> {
    return this.request<Class[]>('/classes');
  }

  async createClass(name: string): Promise<ApiResponse<Class>> {
    return this.request<Class>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getClassStudents(classId: string): Promise<ApiResponse<Student[]>> {
    return this.request<Student[]>(`/classes/${classId}/students`);
  }

  async removeStudent(classId: string, studentId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  async updateClassSettings(classId: string, settings: Partial<Class['settings']>): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${classId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Problems
  async uploadPDF(classId: string, file: File): Promise<ApiResponse<PDFUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('class_id', classId);

    const response = await fetch(`${API_BASE}/problems/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.teacherToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: data.error || 'Upload failed' };
    }
    return { data };
  }

  async createProblem(classId: string, originalText: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>('/problems', {
      method: 'POST',
      body: JSON.stringify({ class_id: classId, original_text: originalText }),
    });
  }

  async getProblems(classId: string): Promise<ApiResponse<Problem[]>> {
    return this.request<Problem[]>(`/problems?class_id=${classId}`);
  }

  async getProblem(problemId: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>(`/problems/${problemId}`);
  }

  async generateScaffold(problemId: string, ellLevel: 1 | 2 | 3 = 2): Promise<ApiResponse<ScaffoldingResponse>> {
    return this.request<ScaffoldingResponse>(`/problems/${problemId}/scaffold`, {
      method: 'POST',
      body: JSON.stringify({ ell_level: ellLevel }),
    });
  }

  async updateProblem(problemId: string, updates: Partial<Problem>): Promise<ApiResponse<Problem>> {
    return this.request<Problem>(`/problems/${problemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProblem(problemId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/problems/${problemId}`, {
      method: 'DELETE',
    });
  }

  async publishProblem(problemId: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>(`/problems/${problemId}/publish`, {
      method: 'POST',
    });
  }

  // Assignments
  async createAssignment(classId: string, title: string, problemIds: string[], weekStart?: string, weekEnd?: string): Promise<ApiResponse<Assignment>> {
    return this.request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        class_id: classId,
        title,
        problem_ids: problemIds,
        week_start: weekStart,
        week_end: weekEnd,
      }),
    });
  }

  async getAssignments(classId: string): Promise<ApiResponse<Assignment[]>> {
    return this.request<Assignment[]>(`/assignments?class_id=${classId}`);
  }

  // Analytics
  async getClassAnalytics(classId: string): Promise<ApiResponse<ClassAnalytics>> {
    return this.request<ClassAnalytics>(`/analytics/class/${classId}`);
  }

  async getStudentAnalytics(studentId: string): Promise<ApiResponse<StudentAnalytics>> {
    return this.request<StudentAnalytics>(`/analytics/student/${studentId}`);
  }

  // Student endpoints
  async getStudentAssignments(): Promise<ApiResponse<Assignment[]>> {
    return this.request<Assignment[]>('/student/assignments', {}, false);
  }

  async getStudentProblem(problemId: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>(`/student/problems/${problemId}`, {}, false);
  }

  async submitStepAttempt(
    problemId: string,
    stepId: string,
    answer: unknown,
    timeSpentSeconds?: number
  ): Promise<ApiResponse<{ is_correct: boolean; points_earned: number; hint?: string }>> {
    return this.request<{ is_correct: boolean; points_earned: number; hint?: string }>(
      `/student/problems/${problemId}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({
          step_id: stepId,
          answer,
          time_spent_seconds: timeSpentSeconds,
        }),
      },
      false
    );
  }

  async getStudentProgress(): Promise<ApiResponse<{ progress: StudentProgress[]; total_points: number }>> {
    return this.request<{ progress: StudentProgress[]; total_points: number }>('/student/progress', {}, false);
  }

  async getStudentProfile(): Promise<ApiResponse<Student>> {
    return this.request<Student>('/student/profile', {}, false);
  }

  async updateStudentAvatar(avatar: string): Promise<ApiResponse<Student>> {
    return this.request<Student>('/student/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar }),
    }, false);
  }
}

export const apiClient = new ApiClient();
export default apiClient;

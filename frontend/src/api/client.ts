import type {
  ApiResponse,
  AuthResponse,
  Class,
  Student,
  TeacherStudent,
  CoTeacher,
  Module,
  Lesson,
  Problem,
  Assignment,
  StudentProgress,
  ClassAnalytics,
  StudentAnalytics,
  ScaffoldingResponse,
  PDFUploadResponse,
  StudentJoinResponse,
  ForgotPasswordResponse,
  BulkStudentEntry,
  UpdateStudentRoster,
  UpdateLessonSchedule,
  CreateScaffoldStep,
  UpdateScaffoldStep,
  ScaffoldStep,
  StyleProfileResponse,
  StyleSample,
  UpdateStyleProfile,
  TestStyleResponse,
  GradingQueueResponse,
  GradedSubmission,
  ApproveGradingRequest,
} from '../types';

// API URL is set via environment files:
// - .env.development: /api (local proxy)
// - .env.production: Railway backend URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

      // Handle 204 No Content (successful delete/update with no body)
      if (response.status === 204) {
        return { data: undefined as T };
      }

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

  // Student Auth (students join with class code + passcode)
  async joinClass(classCode: string, passcode: string): Promise<ApiResponse<StudentJoinResponse>> {
    const result = await this.request<StudentJoinResponse>('/auth/student/join', {
      method: 'POST',
      body: JSON.stringify({ class_code: classCode, passcode }),
    }, false);
    if (result.data?.session_token) {
      this.setStudentToken(result.data.session_token);
    }
    return result;
  }

  // Password Reset (T1.3)
  async forgotPassword(email: string): Promise<ApiResponse<ForgotPasswordResponse>> {
    return this.request<ForgotPasswordResponse>('/auth/teacher/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/teacher/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Classes
  async getClasses(): Promise<ApiResponse<Class[]>> {
    return this.request<Class[]>('/classes');
  }

  async createClass(name: string, purpose?: string, description?: string, grade?: number): Promise<ApiResponse<Class>> {
    return this.request<Class>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, purpose, description, grade }),
    });
  }

  async getClassStudents(classId: string): Promise<ApiResponse<TeacherStudent[]>> {
    return this.request<TeacherStudent[]>(`/classes/${classId}/students`);
  }

  async createStudent(classId: string, name: string, externalId?: string): Promise<ApiResponse<TeacherStudent>> {
    return this.request<TeacherStudent>(`/classes/${classId}/students`, {
      method: 'POST',
      body: JSON.stringify({ name, external_id: externalId }),
    });
  }

  async removeStudent(classId: string, studentId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  async resetStudentPasscode(classId: string, studentId: string): Promise<ApiResponse<TeacherStudent>> {
    return this.request<TeacherStudent>(`/classes/${classId}/students/${studentId}/reset-passcode`, {
      method: 'POST',
    });
  }

  // T3.2 Roster Mapping
  async updateStudentRoster(classId: string, studentId: string, roster: UpdateStudentRoster): Promise<ApiResponse<TeacherStudent>> {
    return this.request<TeacherStudent>(`/classes/${classId}/students/${studentId}/roster`, {
      method: 'PUT',
      body: JSON.stringify(roster),
    });
  }

  // T3.4 Bulk Student Import
  async bulkCreateStudents(classId: string, students: BulkStudentEntry[]): Promise<ApiResponse<TeacherStudent[]>> {
    return this.request<TeacherStudent[]>(`/classes/${classId}/students/bulk`, {
      method: 'POST',
      body: JSON.stringify({ students }),
    });
  }

  // T3.4 Student Credential Export
  async exportStudents(classId: string, format: 'json' | 'csv' = 'json'): Promise<ApiResponse<TeacherStudent[] | Blob>> {
    if (format === 'csv') {
      // For CSV, we need to handle the blob response differently
      try {
        const response = await fetch(`${API_BASE}/classes/${classId}/students/export?format=csv`, {
          headers: {
            'Authorization': `Bearer ${this.teacherToken}`,
          },
        });
        if (!response.ok) {
          return { error: 'Failed to export students' };
        }
        const blob = await response.blob();
        return { data: blob as unknown as TeacherStudent[] };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Network error' };
      }
    }
    return this.request<TeacherStudent[]>(`/classes/${classId}/students/export?format=${format}`);
  }

  async updateClassSettings(classId: string, settings: Partial<Class['settings']> & { name?: string; purpose?: string; description?: string }): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${classId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async deleteClass(classId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/classes/${classId}`, {
      method: 'DELETE',
    });
  }

  // Co-teachers
  async getCoTeachers(classId: string): Promise<ApiResponse<CoTeacher[]>> {
    return this.request<CoTeacher[]>(`/classes/${classId}/coteachers`);
  }

  async addCoTeacher(classId: string, email: string): Promise<ApiResponse<CoTeacher>> {
    return this.request<CoTeacher>(`/classes/${classId}/coteachers`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async removeCoTeacher(classId: string, coteacherId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/classes/${classId}/coteachers/${coteacherId}`, {
      method: 'DELETE',
    });
  }

  // Modules
  async getModules(classId: string): Promise<ApiResponse<Module[]>> {
    return this.request<Module[]>(`/classes/${classId}/modules`);
  }

  async createModule(classId: string, name: string, description?: string, scaffoldPrompt?: string): Promise<ApiResponse<Module>> {
    return this.request<Module>(`/classes/${classId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ name, description, scaffold_prompt: scaffoldPrompt }),
    });
  }

  async updateModule(moduleId: string, updates: { name?: string; description?: string; sort_order?: number; is_published?: boolean; scaffold_prompt?: string }): Promise<ApiResponse<Module>> {
    return this.request<Module>(`/modules/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteModule(moduleId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/modules/${moduleId}`, {
      method: 'DELETE',
    });
  }

  // Scaffold Preview - test prompt with a problem before saving
  async previewScaffold(
    moduleId: string,
    problemText: string,
    scaffoldPrompt: string,
    ellLevel: 1 | 2 | 3 = 2
  ): Promise<ApiResponse<ScaffoldingResponse>> {
    return this.request<ScaffoldingResponse>(`/modules/${moduleId}/scaffold-preview`, {
      method: 'POST',
      body: JSON.stringify({
        problem_text: problemText,
        scaffold_prompt: scaffoldPrompt,
        ell_level: ellLevel,
      }),
    });
  }

  // Lessons
  async getLessons(moduleId: string): Promise<ApiResponse<Lesson[]>> {
    return this.request<Lesson[]>(`/modules/${moduleId}/lessons`);
  }

  async createLesson(moduleId: string, name: string, description?: string): Promise<ApiResponse<Lesson>> {
    return this.request<Lesson>(`/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async getLesson(lessonId: string): Promise<ApiResponse<Lesson>> {
    return this.request<Lesson>(`/lessons/${lessonId}`);
  }

  async updateLesson(lessonId: string, updates: { name?: string; description?: string; sort_order?: number; is_published?: boolean }): Promise<ApiResponse<Lesson>> {
    return this.request<Lesson>(`/lessons/${lessonId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteLesson(lessonId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/lessons/${lessonId}`, {
      method: 'DELETE',
    });
  }

  // T5.5 Lesson Release Scheduling
  async updateLessonSchedule(lessonId: string, schedule: UpdateLessonSchedule): Promise<ApiResponse<Lesson>> {
    return this.request<Lesson>(`/lessons/${lessonId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
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

  async createLessonProblem(lessonId: string, originalText: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>('/problems', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: lessonId, original_text: originalText }),
    });
  }

  async getProblems(classId: string): Promise<ApiResponse<Problem[]>> {
    return this.request<Problem[]>(`/problems?class_id=${classId}`);
  }

  async getLessonProblems(lessonId: string): Promise<ApiResponse<Problem[]>> {
    return this.request<Problem[]>(`/problems?lesson_id=${lessonId}`);
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

  // T6.3 Problem State Workflow
  async reviewProblem(problemId: string): Promise<ApiResponse<Problem>> {
    return this.request<Problem>(`/problems/${problemId}/review`, {
      method: 'POST',
    });
  }

  // T7.3 Edit Individual Scaffold Steps
  async addScaffoldStep(problemId: string, step: CreateScaffoldStep): Promise<ApiResponse<ScaffoldStep>> {
    return this.request<ScaffoldStep>(`/problems/${problemId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step),
    });
  }

  async updateScaffoldStep(problemId: string, stepId: string, updates: UpdateScaffoldStep): Promise<ApiResponse<ScaffoldStep>> {
    return this.request<ScaffoldStep>(`/problems/${problemId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteScaffoldStep(problemId: string, stepId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/problems/${problemId}/steps/${stepId}`, {
      method: 'DELETE',
    });
  }

  async reorderScaffoldSteps(problemId: string, stepIds: string[]): Promise<ApiResponse<ScaffoldStep[]>> {
    return this.request<ScaffoldStep[]>(`/problems/${problemId}/steps/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ step_ids: stepIds }),
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

  // ====== Teacher Style Learning ======

  async uploadStyleSample(file: File): Promise<ApiResponse<StyleSample>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/teacher/style/upload`, {
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

  async getStyleProfile(): Promise<ApiResponse<StyleProfileResponse>> {
    return this.request<StyleProfileResponse>('/teacher/style/profile');
  }

  async updateStyleProfile(updates: UpdateStyleProfile): Promise<ApiResponse<StyleProfileResponse>> {
    return this.request<StyleProfileResponse>('/teacher/style/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async testStyle(studentWork: string, studentName?: string, gradeLevel?: number, subject?: string): Promise<ApiResponse<TestStyleResponse>> {
    return this.request<TestStyleResponse>('/teacher/style/test', {
      method: 'POST',
      body: JSON.stringify({
        student_work: studentWork,
        student_name: studentName,
        grade_level: gradeLevel,
        subject,
      }),
    });
  }

  async getStyleSamples(): Promise<ApiResponse<StyleSample[]>> {
    return this.request<StyleSample[]>('/teacher/style/samples');
  }

  async deleteStyleSample(sampleId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/teacher/style/samples/${sampleId}`, {
      method: 'DELETE',
    });
  }

  // ====== AI-Assisted Grading ======

  async getGradingQueue(): Promise<ApiResponse<GradingQueueResponse>> {
    return this.request<GradingQueueResponse>('/teacher/grading/queue');
  }

  async aiGradeSubmission(submissionId: string): Promise<ApiResponse<GradedSubmission>> {
    return this.request<GradedSubmission>(`/teacher/grading/${submissionId}/ai-grade`, {
      method: 'POST',
    });
  }

  async approveGrading(submissionId: string, request: ApproveGradingRequest): Promise<ApiResponse<GradedSubmission>> {
    return this.request<GradedSubmission>(`/teacher/grading/${submissionId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async rejectGrading(submissionId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/teacher/grading/${submissionId}/reject`, {
      method: 'PUT',
    });
  }

  async batchApproveGrading(submissionIds: string[]): Promise<ApiResponse<{ approved_count: number; total_requested: number }>> {
    return this.request<{ approved_count: number; total_requested: number }>('/teacher/grading/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ submission_ids: submissionIds }),
    });
  }

  async getStudentFeedback(assignmentId: string): Promise<ApiResponse<GradedSubmission[]>> {
    return this.request<GradedSubmission[]>(`/student/feedback/${assignmentId}`, {}, false);
  }
}

export const apiClient = new ApiClient();
export default apiClient;

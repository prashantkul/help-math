import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { fixtures } from '../fixtures';

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the client tokens
    apiClient.clearTeacherToken();
    apiClient.clearStudentToken();
  });

  describe('Teacher Authentication', () => {
    it('should register a new teacher', async () => {
      const result = await apiClient.registerTeacher(
        'newteacher@test.com',
        'password123',
        'New Teacher'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.token).toBe(fixtures.tokens.teacher);
      expect(localStorage.getItem('teacher_token')).toBe(fixtures.tokens.teacher);
    });

    it('should fail registration with existing email', async () => {
      const result = await apiClient.registerTeacher(
        'existing@test.com',
        'password123',
        'Existing Teacher'
      );

      expect(result.error).toBe('Email already registered');
      expect(result.data).toBeUndefined();
    });

    it('should login an existing teacher', async () => {
      const result = await apiClient.loginTeacher('teacher1@test.com', 'password123');

      expect(result.data).toBeDefined();
      expect(result.data?.token).toBe(fixtures.tokens.teacher);
      expect(result.data?.teacher?.email).toBe('teacher1@test.com');
      expect(localStorage.getItem('teacher_token')).toBe(fixtures.tokens.teacher);
    });

    it('should fail login with invalid credentials', async () => {
      const result = await apiClient.loginTeacher('teacher1@test.com', 'wrongpassword');

      expect(result.error).toBe('Invalid credentials');
      expect(result.data).toBeUndefined();
    });

    it('should clear teacher token on logout', () => {
      apiClient.setTeacherToken('test-token');
      expect(localStorage.getItem('teacher_token')).toBe('test-token');

      apiClient.clearTeacherToken();
      expect(localStorage.getItem('teacher_token')).toBeNull();
    });
  });

  describe('Student Authentication', () => {
    it('should join class with valid credentials', async () => {
      const result = await apiClient.joinClass('96T2A2', '1111');

      expect(result.data).toBeDefined();
      expect(result.data?.student.name).toBe('Student A1');
      expect(result.data?.class_name).toBe(fixtures.classes.default.name);
      expect(localStorage.getItem('student_token')).toBe(fixtures.tokens.student);
    });

    it('should fail join with invalid credentials', async () => {
      const result = await apiClient.joinClass('WRONG', '0000');

      expect(result.error).toBe('Invalid class code or passcode');
      expect(result.data).toBeUndefined();
    });

    it('should clear student token on logout', () => {
      apiClient.setStudentToken('test-token');
      expect(localStorage.getItem('student_token')).toBe('test-token');

      apiClient.clearStudentToken();
      expect(localStorage.getItem('student_token')).toBeNull();
    });
  });

  describe('Classes', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch all classes', async () => {
      const result = await apiClient.getClasses();

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].name).toBe(fixtures.classes.default.name);
    });

    it('should create a new class', async () => {
      const result = await apiClient.createClass('New Math Class');

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('New Math Class');
      expect(result.data?.join_code).toBeDefined();
    });

    it('should get class students', async () => {
      const result = await apiClient.getClassStudents(fixtures.classes.default.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(3);
    });

    it('should create a student', async () => {
      const result = await apiClient.createStudent(
        fixtures.classes.default.id,
        'New Student',
        'EXT-001'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('New Student');
      expect(result.data?.external_id).toBe('EXT-001');
      expect(result.data?.passcode).toBeDefined();
    });

    it('should update class settings', async () => {
      const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
        ell_level: 3,
        show_emojis: false,
      });

      expect(result.data).toBeDefined();
      expect(result.data?.settings.ell_level).toBe(3);
      expect(result.data?.settings.show_emojis).toBe(false);
    });
  });

  describe('Modules', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch modules for a class', async () => {
      const result = await apiClient.getModules(fixtures.classes.default.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should create a module', async () => {
      const result = await apiClient.createModule(
        fixtures.classes.default.id,
        'New Module',
        'Module description'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('New Module');
      expect(result.data?.description).toBe('Module description');
    });

    it('should update a module', async () => {
      const result = await apiClient.updateModule(fixtures.modules.default.id, {
        name: 'Updated Module Name',
      });

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Updated Module Name');
    });
  });

  describe('Lessons', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch lessons for a module', async () => {
      const result = await apiClient.getLessons(fixtures.modules.default.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should create a lesson', async () => {
      const result = await apiClient.createLesson(
        fixtures.modules.default.id,
        'New Lesson',
        'Lesson description'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('New Lesson');
    });

    it('should get a lesson by id', async () => {
      const result = await apiClient.getLesson(fixtures.lessons.default.id);

      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(fixtures.lessons.default.id);
    });
  });

  describe('Problems', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch problems for a class', async () => {
      const result = await apiClient.getProblems(fixtures.classes.default.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should create a problem', async () => {
      const result = await apiClient.createProblem(
        fixtures.classes.default.id,
        'John has 10 books. He gives 3 to his friend. How many books does John have?'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.original_text).toContain('John has 10 books');
      expect(result.data?.is_published).toBe(false);
    });

    it('should create a lesson problem', async () => {
      const result = await apiClient.createLessonProblem(
        fixtures.lessons.default.id,
        'Sam has 5 pencils.'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.lesson_id).toBe(fixtures.lessons.default.id);
    });

    it('should generate scaffold for a problem', async () => {
      const result = await apiClient.generateScaffold(fixtures.problems.default.id, 2);

      expect(result.data).toBeDefined();
      expect(result.data?.simplified_problem).toBeDefined();
      expect(result.data?.steps).toBeDefined();
      expect(result.data?.steps.length).toBeGreaterThan(0);
    });

    it('should publish a problem', async () => {
      const result = await apiClient.publishProblem(fixtures.problems.unpublished.id);

      expect(result.data).toBeDefined();
      expect(result.data?.is_published).toBe(true);
    });
  });

  describe('Assignments', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch assignments', async () => {
      const result = await apiClient.getAssignments(fixtures.classes.default.id);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should create an assignment', async () => {
      const result = await apiClient.createAssignment(
        fixtures.classes.default.id,
        'Week 2 Assignment',
        [fixtures.problems.default.id],
        '2025-01-20',
        '2025-01-26'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Week 2 Assignment');
      expect(result.data?.problem_ids).toContain(fixtures.problems.default.id);
    });
  });

  describe('Analytics', () => {
    beforeEach(() => {
      apiClient.setTeacherToken(fixtures.tokens.teacher);
    });

    it('should fetch class analytics', async () => {
      const result = await apiClient.getClassAnalytics(fixtures.classes.default.id);

      expect(result.data).toBeDefined();
      expect(result.data?.total_students).toBe(3);
      expect(result.data?.total_problems).toBe(5);
      expect(result.data?.step_failure_rates).toBeDefined();
    });

    it('should fetch student analytics', async () => {
      const result = await apiClient.getStudentAnalytics(fixtures.students.default.id);

      expect(result.data).toBeDefined();
      expect(result.data?.student_name).toBe('Student A1');
      expect(result.data?.strengths).toBeDefined();
      expect(result.data?.areas_for_improvement).toBeDefined();
    });
  });

  describe('Student Routes', () => {
    beforeEach(() => {
      apiClient.setStudentToken(fixtures.tokens.student);
    });

    it('should fetch student assignments', async () => {
      const result = await apiClient.getStudentAssignments();

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].problems).toBeDefined();
    });

    it('should fetch student problem', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      expect(result.data).toBeDefined();
      expect(result.data?.steps).toBeDefined();
      expect(result.data?.steps?.length).toBeGreaterThan(0);
    });

    it('should submit step attempt - correct', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'apples',
        30
      );

      expect(result.data).toBeDefined();
      expect(result.data?.is_correct).toBe(true);
      expect(result.data?.points_earned).toBeGreaterThan(0);
    });

    it('should submit step attempt - incorrect', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'oranges',
        30
      );

      expect(result.data).toBeDefined();
      expect(result.data?.is_correct).toBe(false);
      expect(result.data?.hint).toBeDefined();
    });

    it('should fetch student progress', async () => {
      const result = await apiClient.getStudentProgress();

      expect(result.data).toBeDefined();
      expect(result.data?.total_points).toBe(150);
      expect(result.data?.progress).toHaveLength(1);
    });

    it('should fetch student profile', async () => {
      const result = await apiClient.getStudentProfile();

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Student A1');
      expect(result.data?.avatar).toBe('bear');
    });

    it('should update student avatar', async () => {
      const result = await apiClient.updateStudentAvatar('fox');

      expect(result.data).toBeDefined();
      expect(result.data?.avatar).toBe('fox');
    });
  });
});

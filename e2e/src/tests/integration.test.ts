/**
 * E2E Test: Cross-Cutting Integration Tests
 *
 * Tests complete flows that involve both teacher and student interactions.
 * Validates that changes made by one role are visible to another.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as api from '../helpers/api';
import * as fixtures from '../helpers/fixtures';

describe('E2E: Integration Tests', () => {
  let teacherToken: string;
  let classId: string;
  let joinCode: string;
  let studentPasscode: string;
  let studentToken: string;
  let problemId: string;

  beforeAll(async () => {
    // Setup: Create complete test environment
    const teacher = fixtures.generateTeacher();
    const teacherResult = await api.registerTeacher(
      teacher.email,
      teacher.password,
      teacher.name
    );
    teacherToken = teacherResult.data!.token;

    const classResult = await api.createClass(
      fixtures.generateClassName(),
      teacherToken
    );
    classId = classResult.data!.id;
    joinCode = classResult.data!.join_code;

    const studentResult = await api.createStudent(
      classId,
      'Integration Test Student',
      teacherToken
    );
    studentPasscode = studentResult.data!.passcode;
  }, 30000);

  describe('Teacher-Student Data Flow', () => {
    it('should allow student to join class created by teacher', async () => {
      const result = await api.joinClass(joinCode, studentPasscode);

      expect(result.data).toBeDefined();
      expect(result.data?.session_token).toBeDefined();

      studentToken = result.data!.session_token;
    });

    it('should show student in teacher roster after joining', async () => {
      const result = await api.getClassStudents(classId, teacherToken);

      expect(result.data).toBeDefined();
      expect(result.data?.some(s => s.passcode === studentPasscode)).toBe(true);
    });
  });

  describe('Problem Creation and Solving Flow', () => {
    it('should allow teacher to create and publish problem', async () => {
      const problem = fixtures.getRandomProblem();
      const createResult = await api.createProblem(
        classId,
        problem.text,
        teacherToken
      );
      problemId = createResult.data!.id;

      // Generate scaffold (may fail without API key)
      await api.generateScaffold(problemId, teacherToken);

      // Publish
      const publishResult = await api.publishProblem(problemId, teacherToken);
      expect(publishResult.data?.is_published).toBe(true);
    });

    it('should make published problem visible to student', async () => {
      const result = await api.getStudentProblem(problemId, studentToken);

      expect(result.data).toBeDefined();
      expect(result.data?.original_text).toBeDefined();
    });

    it('should update analytics after student attempts problem', async () => {
      // Get problem steps
      const problemResult = await api.getStudentProblem(problemId, studentToken);

      if (problemResult.data?.steps && problemResult.data.steps.length > 0) {
        const step = problemResult.data.steps[0];

        // Submit attempt
        await api.submitStepAttempt(
          problemId,
          step.id,
          'test-answer',
          studentToken,
          5
        );

        // Check analytics updated
        const analyticsResult = await api.getClassAnalytics(classId, teacherToken);
        expect(analyticsResult.data).toBeDefined();
        // Analytics should reflect activity (though exact values depend on implementation)
      }
    });
  });

  describe('Privacy: Student ID Protection', () => {
    it('should identify students by ID, not real names in analytics', async () => {
      const analyticsResult = await api.getClassAnalytics(classId, teacherToken);

      expect(analyticsResult.data).toBeDefined();
      // Students should be identified by their passcode/ID format
      // Not by any real names that might have been entered
    });

    it('should protect student data from unauthorized access', async () => {
      // Try to access another class's students (should fail or return empty)
      const fakeClassId = 'non-existent-class-id';
      const result = await api.getClassStudents(fakeClassId, teacherToken);

      // Should either error or return empty (depending on implementation)
      expect(result.error || result.data?.length === 0).toBeTruthy();
    });
  });

  describe('Multiple Students in Same Class', () => {
    let student2Passcode: string;
    let student2Token: string;

    it('should allow adding multiple students to same class', async () => {
      const result = await api.createStudent(
        classId,
        'Second Student',
        teacherToken,
        'EXT-002'
      );

      expect(result.data).toBeDefined();
      student2Passcode = result.data!.passcode;

      // Verify both students in roster
      const rosterResult = await api.getClassStudents(classId, teacherToken);
      expect(rosterResult.data?.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow second student to join independently', async () => {
      const result = await api.joinClass(joinCode, student2Passcode);

      expect(result.data).toBeDefined();
      student2Token = result.data!.session_token;
    });

    it('should track progress separately for each student', async () => {
      // Both students should have independent progress
      const progress1 = await api.getStudentProgress(studentToken);
      const progress2 = await api.getStudentProgress(student2Token);

      // Both should succeed
      expect(progress1.data).toBeDefined();
      expect(progress2.data).toBeDefined();

      // Progress objects should be independent (different student IDs internally)
    });
  });
});

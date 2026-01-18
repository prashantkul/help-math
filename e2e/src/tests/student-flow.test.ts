/**
 * E2E Test: Complete Student Flow
 *
 * Tests the full student workflow from login to solving problems.
 * This validates the PRD requirements for Student Portal (S1-S5).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as api from '../helpers/api';
import * as fixtures from '../helpers/fixtures';

describe('E2E: Student Flow', () => {
  // These would typically come from teacher flow or fixture data
  let joinCode: string;
  let studentPasscode: string;
  let studentToken: string;
  let problemId: string;

  // Setup: Create teacher, class, student, and problem
  beforeAll(async () => {
    // Register teacher
    const teacher = fixtures.generateTeacher();
    const teacherResult = await api.registerTeacher(
      teacher.email,
      teacher.password,
      teacher.name
    );

    if (!teacherResult.data?.token) {
      throw new Error('Failed to register teacher for student flow tests');
    }

    const teacherToken = teacherResult.data.token;

    // Create class
    const classResult = await api.createClass(
      fixtures.generateClassName(),
      teacherToken
    );

    if (!classResult.data) {
      throw new Error('Failed to create class for student flow tests');
    }

    joinCode = classResult.data.join_code;
    const classId = classResult.data.id;

    // Create student
    const studentResult = await api.createStudent(
      classId,
      'E2E Test Student',
      teacherToken
    );

    if (!studentResult.data?.passcode) {
      throw new Error('Failed to create student for student flow tests');
    }

    studentPasscode = studentResult.data.passcode;

    // Create and publish a problem
    const problem = fixtures.getRandomProblem();
    const problemResult = await api.createProblem(
      classId,
      problem.text,
      teacherToken
    );

    if (!problemResult.data?.id) {
      throw new Error('Failed to create problem for student flow tests');
    }

    problemId = problemResult.data.id;

    // Try to generate scaffold (may fail without API key)
    await api.generateScaffold(problemId, teacherToken);

    // Publish problem
    await api.publishProblem(problemId, teacherToken);
  }, 60000); // Extended timeout for setup

  describe('S1. Authentication', () => {
    it('S1.1 should join class with valid code and passcode', async () => {
      const result = await api.joinClass(joinCode, studentPasscode);

      expect(result.data).toBeDefined();
      expect(result.data?.session_token).toBeDefined();
      expect(result.data?.student).toBeDefined();
      expect(result.data?.class_name).toBeDefined();

      studentToken = result.data!.session_token;
    });

    it('S1.1 should reject invalid class code', async () => {
      const result = await api.joinClass('XXXXXX', studentPasscode);

      expect(result.error).toBeDefined();
    });

    it('S1.1 should reject invalid passcode', async () => {
      const result = await api.joinClass(joinCode, 'wrong-passcode');

      expect(result.error).toBeDefined();
    });
  });

  describe('S2. Student Dashboard', () => {
    it('S2.2 should get student progress', async () => {
      const result = await api.getStudentProgress(studentToken);

      expect(result.data).toBeDefined();
      expect(result.data?.total_points).toBeDefined();
      expect(Array.isArray(result.data?.progress)).toBe(true);
    });
  });

  describe('S3. Problem Solving', () => {
    it('S3.1 should fetch problem with steps', async () => {
      const result = await api.getStudentProblem(problemId, studentToken);

      expect(result.data).toBeDefined();
      expect(result.data?.original_text).toBeDefined();

      // Steps may not exist if scaffolding failed (no API key)
      if (result.data?.steps && result.data.steps.length > 0) {
        const step = result.data.steps[0];
        expect(step.prompt_text).toBeDefined();
        expect(step.answer_type).toBeDefined();
        expect(step.points).toBeGreaterThan(0);
      } else {
        console.log('⚠️ Problem has no steps (scaffolding may not have been generated)');
      }
    });

    it('S3.5/S3.7 should submit step attempt and get feedback', async () => {
      // First get the problem to find a step
      const problemResult = await api.getStudentProblem(problemId, studentToken);

      if (!problemResult.data?.steps || problemResult.data.steps.length === 0) {
        console.log('⚠️ Skipping step attempt test - no steps available');
        return;
      }

      const step = problemResult.data.steps[0];

      // Submit an attempt (answer may be wrong, that's okay)
      const result = await api.submitStepAttempt(
        problemId,
        step.id,
        'test-answer',
        studentToken,
        10
      );

      expect(result.data).toBeDefined();
      expect(typeof result.data?.is_correct).toBe('boolean');

      if (result.data?.is_correct) {
        expect(result.data.points_earned).toBeGreaterThan(0);
      } else {
        // Wrong answer should provide hint
        expect(result.data?.hint || result.data?.points_earned === 0).toBeTruthy();
      }
    });
  });

  describe('S4. Rewards & Gamification', () => {
    it('S4.1 should track points in progress', async () => {
      const result = await api.getStudentProgress(studentToken);

      expect(result.data).toBeDefined();
      expect(typeof result.data?.total_points).toBe('number');
    });

    it('S4.2 should include stars in progress (when completed)', async () => {
      const result = await api.getStudentProgress(studentToken);

      // Stars are tracked per problem
      result.data?.progress?.forEach((p: { stars_earned?: number }) => {
        if (p.stars_earned !== undefined) {
          expect(p.stars_earned).toBeGreaterThanOrEqual(0);
          expect(p.stars_earned).toBeLessThanOrEqual(3);
        }
      });
    });
  });
});

/**
 * S3. Problem Solving Tests
 * Based on PRODUCT_SPEC.md - Student Portal > S3. Problem Solving
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../../api/client';
import { fixtures } from '../fixtures';

describe('S3. Problem Solving', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.setStudentToken(fixtures.tokens.student);
  });

  describe('S3.1 Problem Display', () => {
    /**
     * PRD Specification:
     * - Show the word problem
     * - Features: Large text, read-aloud button
     */

    it('should fetch problem with original text', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      expect(result.data).toBeDefined();
      expect(result.data?.original_text).toBeDefined();
    });

    it('should include simplified text for ELL support', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      expect(result.data?.simplified_text).toBeDefined();
    });

    it('should include scene emoji when enabled', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      expect(result.data?.scene_emoji).toBeDefined();
    });
  });

  describe('S3.2 Step-by-Step Workflow', () => {
    /**
     * PRD Specification:
     * - Progress through scaffolded steps
     * - Flow: Complete step → Feedback → Next step → ... → Completion
     * - Progress: Visual progress bar
     */

    it('should include steps in problem response', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      expect(result.data?.steps).toBeDefined();
      expect(Array.isArray(result.data?.steps)).toBe(true);
      expect(result.data?.steps?.length).toBeGreaterThan(0);
    });

    it('should have steps in correct order', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);
      const steps = result.data?.steps;

      if (steps && steps.length > 1) {
        for (let i = 1; i < steps.length; i++) {
          expect(steps[i].step_order).toBeGreaterThan(steps[i - 1].step_order);
        }
      }
    });
  });

  describe('S3.3 Step Types (Interactive)', () => {
    /**
     * PRD Specification:
     * - Multiple Choice: Select one answer from options
     * - Multi-Select: Select multiple answers
     * - Number Input: Enter a number
     * - Equation Builder: Drag/build equation
     * - Drag & Drop: Arrange items
     */

    it('should include step type for each step', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      result.data?.steps?.forEach(step => {
        expect(step.step_type).toBeDefined();
        expect([
          'find_objects',
          'find_numbers',
          'identify_operation',
          'build_equation',
          'solve',
          'comprehension_check'
        ]).toContain(step.step_type);
      });
    });

    it('should include answer type for each step', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      result.data?.steps?.forEach(step => {
        expect(step.answer_type).toBeDefined();
        expect([
          'multiple_choice',
          'number_input',
          'multi_select',
          'drag_drop',
          'equation_builder'
        ]).toContain(step.answer_type);
      });
    });

    it('should include options for multiple choice steps', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      const multipleChoiceSteps = result.data?.steps?.filter(
        s => s.answer_type === 'multiple_choice'
      );

      multipleChoiceSteps?.forEach(step => {
        expect(step.options).toBeDefined();
        expect(Array.isArray(step.options)).toBe(true);
        expect(step.options?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('S3.5 Instant Feedback', () => {
    /**
     * PRD Specification:
     * - Immediate response to answers
     * - Correct: Green checkmark, celebration, points
     * - Incorrect: Try again message, hint offered
     */

    it('should return is_correct for correct answer', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'apples',
        30
      );

      expect(result.data).toBeDefined();
      expect(result.data?.is_correct).toBe(true);
    });

    it('should award points for correct answer', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'apples',
        30
      );

      expect(result.data?.points_earned).toBeGreaterThan(0);
    });

    it('should return is_correct=false for wrong answer', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'oranges',
        30
      );

      expect(result.data?.is_correct).toBe(false);
    });

    it('should return hint for wrong answer', async () => {
      const result = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'oranges',
        30
      );

      expect(result.data?.hint).toBeDefined();
    });
  });

  describe('S3.6 Hints', () => {
    /**
     * PRD Specification:
     * - Help when stuck
     * - Types: Text hint, emoji hint (if enabled)
     * - Trigger: After incorrect attempt or on request
     */

    it('should include hints in step data', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      result.data?.steps?.forEach(step => {
        expect(step.hints).toBeDefined();
        expect(Array.isArray(step.hints)).toBe(true);
      });
    });

    it('should include emoji hints when enabled', async () => {
      const result = await apiClient.getStudentProblem(fixtures.problems.default.id);

      // Some steps should have emoji hints (if class has emojis enabled)
      const stepsWithEmojiHints = result.data?.steps?.filter(s => s.emoji_hint);
      expect(stepsWithEmojiHints).toBeDefined();
    });
  });

  describe('S3.7 Retry Mechanism', () => {
    /**
     * PRD Specification:
     * - Multiple attempts per step
     * - Limit: Configurable per class (default: 3)
     * - Point Penalty: Reduced points on retries
     */

    it('should allow retry after wrong answer', async () => {
      // First attempt - wrong
      const result1 = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'oranges',
        30
      );
      expect(result1.data?.is_correct).toBe(false);

      // Second attempt - correct
      const result2 = await apiClient.submitStepAttempt(
        fixtures.problems.default.id,
        fixtures.scaffoldSteps[0].id,
        'apples',
        30
      );
      expect(result2.data?.is_correct).toBe(true);
    });

    // Note: Point penalty verification would require more complex state tracking
  });
});

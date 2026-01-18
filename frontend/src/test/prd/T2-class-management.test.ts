/**
 * T2. Class Management Tests
 * Based on PRODUCT_SPEC.md - Teacher Portal > T2. Class Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../../api/client';
import { fixtures } from '../fixtures';

describe('T2. Class Management', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.setTeacherToken(fixtures.tokens.teacher);
  });

  describe('T2.1 Create Class', () => {
    /**
     * PRD Specification:
     * - Teachers create classes with auto-generated join codes
     * - Fields: Class name, grade level (optional)
     * - Auto-generated: 6-character alphanumeric join code
     * - Output: Class appears on teacher dashboard
     */

    it('should create a class with just a name', async () => {
      const result = await apiClient.createClass('5th Grade Math');

      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('5th Grade Math');
    });

    it('should auto-generate a 6-character join code', async () => {
      const result = await apiClient.createClass('Test Class');

      expect(result.data?.join_code).toBeDefined();
      expect(result.data?.join_code.length).toBe(6);
    });

    it('should set default settings for new class', async () => {
      const result = await apiClient.createClass('Test Class');

      expect(result.data?.settings).toBeDefined();
      expect(result.data?.settings.ell_level).toBeDefined();
    });

    it('should list created class in teacher dashboard', async () => {
      await apiClient.createClass('New Class');
      const result = await apiClient.getClasses();

      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe('T2.2 Class Settings', () => {
    /**
     * PRD Specification:
     * - Configure class-wide settings
     * - ELL Level: 1 (basic), 2 (intermediate), 3 (advanced) - affects AI language
     * - Emoji Display: Toggle emoji hints on/off
     * - Retry Limit: Max attempts per step (default: 3)
     * - Point Multiplier: Scale points earned (0.5x - 2x)
     */

    it('should update ELL level (1-3)', async () => {
      const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
        ell_level: 1,
      });

      expect(result.data?.settings.ell_level).toBe(1);
    });

    it('should toggle emoji display', async () => {
      const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
        show_emojis: false,
      });

      expect(result.data?.settings.show_emojis).toBe(false);
    });

    it('should set retry limit', async () => {
      const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
        retry_limit: 5,
      });

      expect(result.data?.settings.retry_limit).toBe(5);
    });

    it('should set point multiplier', async () => {
      const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
        point_multiplier: 1.5,
      });

      expect(result.data?.settings.point_multiplier).toBe(1.5);
    });

    it('should validate ELL level is 1, 2, or 3', async () => {
      // ELL level should only accept 1, 2, or 3
      const validLevels = [1, 2, 3] as const;
      for (const level of validLevels) {
        const result = await apiClient.updateClassSettings(fixtures.classes.default.id, {
          ell_level: level,
        });
        expect(result.data?.settings.ell_level).toBe(level);
      }
    });
  });

  describe('T2.3 Class Purpose/Description', () => {
    /**
     * PRD Status: NOT IMPLEMENTED
     * - Teachers can set a purpose/description for each class
     * - Fields: Purpose text, learning objectives, class description
     * - Display: Shown on class dashboard and student view
     */

    it.skip('should set class purpose/description', async () => {
      // TODO: Implement when class description field is available
      // const result = await apiClient.updateClassDescription(classId, {
      //   purpose: 'Master addition and subtraction',
      //   description: 'A class focused on basic math operations'
      // });
    });

    it.skip('should display purpose on class dashboard', async () => {
      // TODO: Implement when feature is available
    });
  });

  describe('T2.4 View Class Dashboard', () => {
    /**
     * PRD Specification:
     * - Overview of class with students, modules, and stats
     * - Shows: Student count, completion rates, recent activity
     */

    it('should fetch class list', async () => {
      const result = await apiClient.getClasses();

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should include class details in response', async () => {
      const result = await apiClient.getClasses();
      const firstClass = result.data?.[0];

      expect(firstClass?.id).toBeDefined();
      expect(firstClass?.name).toBeDefined();
      expect(firstClass?.join_code).toBeDefined();
      expect(firstClass?.settings).toBeDefined();
    });
  });

  describe('T2.5 Delete/Archive Class', () => {
    /**
     * PRD Status: PARTIALLY IMPLEMENTED
     * - Remove or archive a class
     * - Current: Delete available
     * - Needed: Archive option to preserve data
     */

    it.skip('should delete a class', async () => {
      // TODO: Add deleteClass method to API client
      // const result = await apiClient.deleteClass(classId);
    });

    it.skip('should archive a class (preserves data)', async () => {
      // TODO: Implement when archive feature is available
      // const result = await apiClient.archiveClass(classId);
    });
  });
});

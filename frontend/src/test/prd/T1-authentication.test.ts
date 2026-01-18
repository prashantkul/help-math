/**
 * T1. Teacher Authentication Tests
 * Based on PRODUCT_SPEC.md - Teacher Portal > T1. Authentication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../../api/client';
import { fixtures } from '../fixtures';

describe('T1. Teacher Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    apiClient.clearTeacherToken();
  });

  describe('T1.1 Teacher Registration', () => {
    /**
     * PRD Specification:
     * - Teachers create accounts with email and password
     * - Flow: Enter email, password, name → Account created → Redirect to dashboard
     * - Validation: Email format, password strength (min 8 chars)
     * - Security: Bcrypt password hashing, JWT tokens (30-day expiry)
     */

    it('should register a new teacher with valid credentials', async () => {
      const result = await apiClient.registerTeacher(
        'newteacher@example.com',
        'securePassword123',
        'New Teacher'
      );

      expect(result.data).toBeDefined();
      expect(result.data?.token).toBeDefined();
      expect(result.data?.teacher?.email).toBe('newteacher@example.com');
      expect(result.data?.teacher?.name).toBe('New Teacher');
    });

    it('should store JWT token in localStorage after registration', async () => {
      await apiClient.registerTeacher(
        'teacher@example.com',
        'securePassword123',
        'Test Teacher'
      );

      expect(localStorage.getItem('teacher_token')).toBe(fixtures.tokens.teacher);
    });

    it('should reject registration with invalid email format', async () => {
      const result = await apiClient.registerTeacher(
        'invalid-email', // No @ or domain
        'securePassword123',
        'Test Teacher'
      );

      expect(result.error).toBeDefined();
      expect(result.error).toContain('email');
    });

    it('should reject registration with short password (< 8 chars per PRD)', async () => {
      // PRD specifies min 8 chars
      const result = await apiClient.registerTeacher(
        'test@example.com',
        'short', // Only 5 chars, PRD requires 8
        'Test Teacher'
      );

      expect(result.error).toBeDefined();
      expect(result.error).toContain('8');
    });

    it('should reject registration with empty name', async () => {
      const result = await apiClient.registerTeacher(
        'test@example.com',
        'securePassword123',
        ''
      );

      expect(result.error).toBeDefined();
    });

    it('should reject registration with already registered email', async () => {
      const result = await apiClient.registerTeacher(
        'existing@test.com',
        'securePassword123',
        'Test Teacher'
      );

      expect(result.error).toBe('Email already registered');
    });
  });

  describe('T1.2 Teacher Login', () => {
    /**
     * PRD Specification:
     * - Teachers log in with email and password
     * - Flow: Enter credentials → Validate → Issue JWT → Redirect to dashboard
     * - Error States: Invalid credentials, account not found
     */

    it('should login with valid credentials', async () => {
      const result = await apiClient.loginTeacher('teacher1@test.com', 'password123');

      expect(result.data).toBeDefined();
      expect(result.data?.token).toBeDefined();
      expect(result.data?.teacher?.email).toBe('teacher1@test.com');
    });

    it('should store JWT token in localStorage after login', async () => {
      await apiClient.loginTeacher('teacher1@test.com', 'password123');

      expect(localStorage.getItem('teacher_token')).toBe(fixtures.tokens.teacher);
    });

    it('should reject login with invalid password', async () => {
      const result = await apiClient.loginTeacher('teacher1@test.com', 'wrongpassword');

      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const result = await apiClient.loginTeacher('nonexistent@test.com', 'password123');

      expect(result.error).toBeDefined();
    });

    it('should clear token on logout', () => {
      apiClient.setTeacherToken('test-token');
      expect(localStorage.getItem('teacher_token')).toBe('test-token');

      apiClient.clearTeacherToken();
      expect(localStorage.getItem('teacher_token')).toBeNull();
    });
  });

  describe('T1.3 Password Reset', () => {
    /**
     * PRD Status: NOT IMPLEMENTED
     * - Teachers can reset forgotten passwords via email
     * - Flow: Enter email → Send reset link → Click link → Set new password
     * - Requirements: Email service integration, secure reset tokens
     */

    it.skip('should send password reset email', async () => {
      // TODO: Implement when password reset is available
      // await apiClient.requestPasswordReset('teacher@test.com');
    });

    it.skip('should reset password with valid token', async () => {
      // TODO: Implement when password reset is available
      // await apiClient.resetPassword('reset-token', 'newPassword123');
    });

    it.skip('should reject invalid reset token', async () => {
      // TODO: Implement when password reset is available
    });
  });
});

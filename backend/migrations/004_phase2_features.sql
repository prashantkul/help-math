-- Phase 2 Features Migration (PostgreSQL)
-- Note: Most columns are now in the initial schema. This file adds the password_reset_tokens table
-- and the foreign key constraint for lesson_id.

-- ===========================================
-- T1.3 Password Reset Tokens
-- ===========================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY NOT NULL,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_teacher_id ON password_reset_tokens(teacher_id)

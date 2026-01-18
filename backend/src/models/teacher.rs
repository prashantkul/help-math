use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Teacher {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTeacher {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginTeacher {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct TeacherResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub created_at: String,
}

impl From<Teacher> for TeacherResponse {
    fn from(teacher: Teacher) -> Self {
        Self {
            id: teacher.id,
            email: teacher.email,
            name: teacher.name,
            created_at: teacher.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub teacher: Option<TeacherResponse>,
    pub student: Option<super::StudentResponse>,
}

// Password reset types
#[derive(Debug, Clone, FromRow)]
pub struct PasswordResetToken {
    pub id: String,
    pub teacher_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub used: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct ForgotPasswordResponse {
    pub message: String,
    // In a real app, you wouldn't include this - it would be sent via email
    // For demo purposes, we include the reset link
    pub reset_link: Option<String>,
}

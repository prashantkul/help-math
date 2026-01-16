use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Teacher {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub created_at: String,
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
            created_at: teacher.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub teacher: Option<TeacherResponse>,
    pub student: Option<super::StudentResponse>,
}

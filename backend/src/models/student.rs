use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Student {
    pub id: Uuid,
    pub name: String,
    pub class_id: Uuid,
    pub avatar: String,
    pub total_points: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct JoinClass {
    pub name: String,
    pub class_code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStudentAvatar {
    pub avatar: String,
}

#[derive(Debug, Serialize)]
pub struct StudentResponse {
    pub id: Uuid,
    pub name: String,
    pub class_id: Uuid,
    pub avatar: String,
    pub total_points: i32,
    pub created_at: DateTime<Utc>,
}

impl From<Student> for StudentResponse {
    fn from(student: Student) -> Self {
        Self {
            id: student.id,
            name: student.name,
            class_id: student.class_id,
            avatar: student.avatar,
            total_points: student.total_points,
            created_at: student.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StudentJoinResponse {
    pub student: StudentResponse,
    pub class_name: String,
    pub session_token: String,
}

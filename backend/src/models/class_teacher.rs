use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ClassTeacher {
    pub id: String,
    pub class_id: String,
    pub teacher_id: String,
    pub added_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddCoTeacher {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct CoTeacherResponse {
    pub id: String,
    pub teacher_id: String,
    pub teacher_email: String,
    pub teacher_name: String,
    pub added_at: String,
}

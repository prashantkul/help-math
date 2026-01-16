use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Class {
    pub id: Uuid,
    pub teacher_id: Uuid,
    pub name: String,
    pub join_code: String,
    pub settings: sqlx::types::Json<ClassSettings>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClassSettings {
    #[serde(default = "default_ell_level")]
    pub ell_level: i32,
    #[serde(default = "default_true")]
    pub show_emojis: bool,
    #[serde(default = "default_retry_limit")]
    pub retry_limit: i32,
    #[serde(default = "default_point_multiplier")]
    pub point_multiplier: f32,
}

fn default_ell_level() -> i32 {
    2
}

fn default_true() -> bool {
    true
}

fn default_retry_limit() -> i32 {
    3
}

fn default_point_multiplier() -> f32 {
    1.0
}

#[derive(Debug, Deserialize)]
pub struct CreateClass {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClassSettings {
    pub ell_level: Option<i32>,
    pub show_emojis: Option<bool>,
    pub retry_limit: Option<i32>,
    pub point_multiplier: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ClassResponse {
    pub id: Uuid,
    pub teacher_id: Uuid,
    pub name: String,
    pub join_code: String,
    pub settings: ClassSettings,
    pub created_at: DateTime<Utc>,
}

impl From<Class> for ClassResponse {
    fn from(class: Class) -> Self {
        Self {
            id: class.id,
            teacher_id: class.teacher_id,
            name: class.name,
            join_code: class.join_code,
            settings: class.settings.0,
            created_at: class.created_at,
        }
    }
}

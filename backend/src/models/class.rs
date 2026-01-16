use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Class {
    pub id: String,
    pub teacher_id: String,
    pub name: String,
    pub join_code: String,
    pub settings: String, // JSON stored as text
    pub created_at: String,
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
    pub id: String,
    pub teacher_id: String,
    pub name: String,
    pub join_code: String,
    pub settings: ClassSettings,
    pub created_at: String,
}

impl Class {
    pub fn get_settings(&self) -> ClassSettings {
        serde_json::from_str(&self.settings).unwrap_or_default()
    }
}

impl From<Class> for ClassResponse {
    fn from(class: Class) -> Self {
        Self {
            id: class.id.clone(),
            teacher_id: class.teacher_id.clone(),
            name: class.name.clone(),
            join_code: class.join_code.clone(),
            settings: class.get_settings(),
            created_at: class.created_at.clone(),
        }
    }
}

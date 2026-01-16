use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Module {
    pub id: String,
    pub class_id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub is_published: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateModule {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModule {
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub is_published: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ModuleResponse {
    pub id: String,
    pub class_id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub is_published: bool,
    pub created_at: String,
    pub lessons: Option<Vec<super::LessonResponse>>,
}

impl ModuleResponse {
    pub fn from_module(module: Module, lessons: Option<Vec<super::Lesson>>) -> Self {
        Self {
            id: module.id,
            class_id: module.class_id,
            name: module.name,
            description: module.description,
            sort_order: module.sort_order,
            is_published: module.is_published != 0,
            created_at: module.created_at,
            lessons: lessons.map(|l| l.into_iter().map(super::LessonResponse::from_lesson).collect()),
        }
    }
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Lesson {
    pub id: String,
    pub module_id: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub is_published: bool,
    pub release_type: String, // 'immediate', 'scheduled', 'manual', 'sequential'
    pub release_at: Option<DateTime<Utc>>,
    pub release_after_lesson_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLesson {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLesson {
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub is_published: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLessonSchedule {
    pub release_type: String, // 'immediate', 'scheduled', 'manual', 'sequential'
    pub release_at: Option<String>,
    pub release_after_lesson_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LessonResponse {
    pub id: String,
    pub module_id: String,
    pub class_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub is_published: bool,
    pub release_type: String,
    pub release_at: Option<String>,
    pub release_after_lesson_id: Option<String>,
    pub created_at: String,
    pub problem_count: Option<i32>,
}

impl LessonResponse {
    pub fn from_lesson(lesson: Lesson) -> Self {
        Self {
            id: lesson.id,
            module_id: lesson.module_id,
            class_id: None,
            name: lesson.name,
            description: lesson.description,
            sort_order: lesson.sort_order,
            is_published: lesson.is_published,
            release_type: lesson.release_type,
            release_at: lesson.release_at.map(|dt| dt.to_rfc3339()),
            release_after_lesson_id: lesson.release_after_lesson_id,
            created_at: lesson.created_at.to_rfc3339(),
            problem_count: None,
        }
    }

    pub fn from_lesson_with_count(lesson: Lesson, count: i32) -> Self {
        Self {
            id: lesson.id,
            module_id: lesson.module_id,
            class_id: None,
            name: lesson.name,
            description: lesson.description,
            sort_order: lesson.sort_order,
            is_published: lesson.is_published,
            release_type: lesson.release_type,
            release_at: lesson.release_at.map(|dt| dt.to_rfc3339()),
            release_after_lesson_id: lesson.release_after_lesson_id,
            created_at: lesson.created_at.to_rfc3339(),
            problem_count: Some(count),
        }
    }

    pub fn from_lesson_with_class(lesson: Lesson, class_id: String, count: i32) -> Self {
        Self {
            id: lesson.id,
            module_id: lesson.module_id,
            class_id: Some(class_id),
            name: lesson.name,
            description: lesson.description,
            sort_order: lesson.sort_order,
            is_published: lesson.is_published,
            release_type: lesson.release_type,
            release_at: lesson.release_at.map(|dt| dt.to_rfc3339()),
            release_after_lesson_id: lesson.release_after_lesson_id,
            created_at: lesson.created_at.to_rfc3339(),
            problem_count: Some(count),
        }
    }
}

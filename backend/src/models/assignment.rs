use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Assignment {
    pub id: String,
    pub class_id: String,
    pub title: String,
    pub week_start: Option<String>,
    pub week_end: Option<String>,
    pub problem_ids: String, // JSON array stored as text
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssignment {
    pub class_id: String,
    pub title: String,
    pub week_start: Option<String>,
    pub week_end: Option<String>,
    pub problem_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AssignmentResponse {
    pub id: String,
    pub class_id: String,
    pub title: String,
    pub week_start: Option<String>,
    pub week_end: Option<String>,
    pub problem_ids: Vec<String>,
    pub created_at: String,
    pub problems: Option<Vec<super::ProblemResponse>>,
}

impl AssignmentResponse {
    pub fn from_assignment(assignment: Assignment, problems: Option<Vec<super::ProblemResponse>>) -> Self {
        Self {
            id: assignment.id,
            class_id: assignment.class_id,
            title: assignment.title,
            week_start: assignment.week_start,
            week_end: assignment.week_end,
            problem_ids: serde_json::from_str(&assignment.problem_ids).unwrap_or_default(),
            created_at: assignment.created_at.to_rfc3339(),
            problems,
        }
    }
}

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Assignment {
    pub id: Uuid,
    pub class_id: Uuid,
    pub title: String,
    pub week_start: Option<NaiveDate>,
    pub week_end: Option<NaiveDate>,
    pub problem_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssignment {
    pub class_id: Uuid,
    pub title: String,
    pub week_start: Option<NaiveDate>,
    pub week_end: Option<NaiveDate>,
    pub problem_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AssignmentResponse {
    pub id: Uuid,
    pub class_id: Uuid,
    pub title: String,
    pub week_start: Option<NaiveDate>,
    pub week_end: Option<NaiveDate>,
    pub problem_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
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
            problem_ids: assignment.problem_ids,
            created_at: assignment.created_at,
            problems,
        }
    }
}

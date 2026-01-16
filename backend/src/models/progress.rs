use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StudentProgress {
    pub id: String,
    pub student_id: String,
    pub problem_id: String,
    pub current_step: i32,
    pub is_complete: i32, // SQLite uses 0/1 for booleans
    pub total_points_earned: i32,
    pub stars_earned: i32,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StepAttempt {
    pub id: String,
    pub student_id: String,
    pub step_id: String,
    pub progress_id: String,
    pub attempt_number: i32,
    pub answer_given: String, // JSON stored as text
    pub is_correct: i32, // SQLite uses 0/1 for booleans
    pub points_earned: i32,
    pub time_spent_seconds: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitAttempt {
    pub step_id: String,
    pub answer: serde_json::Value,
    pub time_spent_seconds: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AttemptResult {
    pub is_correct: bool,
    pub points_earned: i32,
    pub hint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentProgressResponse {
    pub id: String,
    pub student_id: String,
    pub problem_id: String,
    pub current_step: i32,
    pub is_complete: bool,
    pub total_points_earned: i32,
    pub stars_earned: i32,
    pub started_at: String,
    pub completed_at: Option<String>,
}

impl From<StudentProgress> for StudentProgressResponse {
    fn from(progress: StudentProgress) -> Self {
        Self {
            id: progress.id,
            student_id: progress.student_id,
            problem_id: progress.problem_id,
            current_step: progress.current_step,
            is_complete: progress.is_complete != 0,
            total_points_earned: progress.total_points_earned,
            stars_earned: progress.stars_earned,
            started_at: progress.started_at,
            completed_at: progress.completed_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StudentOverallProgress {
    pub progress: Vec<StudentProgressResponse>,
    pub total_points: i32,
}

// Analytics types
#[derive(Debug, Serialize)]
pub struct ClassAnalytics {
    pub class_id: String,
    pub total_students: i64,
    pub total_problems: i64,
    pub average_completion_rate: f64,
    pub average_points_per_student: f64,
    pub step_failure_rates: Vec<StepFailureRate>,
    pub weekly_progress: Vec<WeeklyProgress>,
}

#[derive(Debug, Serialize)]
pub struct StepFailureRate {
    pub step_type: String,
    pub failure_rate: f64,
    pub total_attempts: i64,
}

#[derive(Debug, Serialize)]
pub struct WeeklyProgress {
    pub week: String,
    pub problems_completed: i64,
    pub average_stars: f64,
}

#[derive(Debug, Serialize)]
pub struct StudentAnalytics {
    pub student_id: String,
    pub student_name: String,
    pub total_problems_attempted: i64,
    pub total_problems_completed: i64,
    pub total_points: i32,
    pub average_stars: f64,
    pub strengths: Vec<String>,
    pub areas_for_improvement: Vec<String>,
    pub recent_activity: Vec<RecentActivity>,
}

#[derive(Debug, Serialize)]
pub struct RecentActivity {
    pub problem_id: String,
    pub problem_text: String,
    pub completed_at: String,
    pub stars_earned: i32,
    pub points_earned: i32,
}

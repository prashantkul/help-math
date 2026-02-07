use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// Database model for graded_submissions table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GradedSubmission {
    pub id: String,
    pub assignment_id: Option<String>,
    pub student_id: String,
    pub content: String, // JSONB stored as text
    pub scanned_file: Option<String>,
    pub ai_feedback: Option<String>,
    pub ai_score: Option<f64>,
    pub ai_skill_gaps: Vec<String>,
    pub teacher_approved: bool,
    pub teacher_edits: Option<String>,
    pub final_feedback: Option<String>,
    pub final_score: Option<f64>,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
    pub graded_at: Option<DateTime<Utc>>,
    pub returned_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct GradedSubmissionResponse {
    pub id: String,
    pub assignment_id: Option<String>,
    pub student_id: String,
    pub student_name: Option<String>,
    pub content: serde_json::Value,
    pub scanned_file: Option<String>,
    pub ai_feedback: Option<String>,
    pub ai_score: Option<f64>,
    pub ai_skill_gaps: Vec<String>,
    pub teacher_approved: bool,
    pub teacher_edits: Option<String>,
    pub final_feedback: Option<String>,
    pub final_score: Option<f64>,
    pub status: String,
    pub submitted_at: String,
    pub graded_at: Option<String>,
    pub returned_at: Option<String>,
}

impl GradedSubmission {
    pub fn to_response(self, student_name: Option<String>) -> GradedSubmissionResponse {
        GradedSubmissionResponse {
            id: self.id,
            assignment_id: self.assignment_id,
            student_id: self.student_id,
            student_name,
            content: serde_json::from_str(&self.content).unwrap_or_default(),
            scanned_file: self.scanned_file,
            ai_feedback: self.ai_feedback,
            ai_score: self.ai_score,
            ai_skill_gaps: self.ai_skill_gaps,
            teacher_approved: self.teacher_approved,
            teacher_edits: self.teacher_edits,
            final_feedback: self.final_feedback,
            final_score: self.final_score,
            status: self.status,
            submitted_at: self.submitted_at.to_rfc3339(),
            graded_at: self.graded_at.map(|d| d.to_rfc3339()),
            returned_at: self.returned_at.map(|d| d.to_rfc3339()),
        }
    }
}

// AI grading response from Claude
#[derive(Debug, Serialize, Deserialize)]
pub struct AIGradingResponse {
    pub feedback: String,
    pub score: f64,
    pub skill_gaps: Vec<String>,
    pub strengths_shown: Vec<String>,
    pub reasoning: String,
}

// Request to approve grading
#[derive(Debug, Deserialize)]
pub struct ApproveGradingRequest {
    pub edits: Option<String>,
    pub final_score: Option<f64>,
}

// Request for batch approval
#[derive(Debug, Deserialize)]
pub struct BatchApproveRequest {
    pub submission_ids: Vec<String>,
}

// Grading queue stats
#[derive(Debug, Serialize)]
pub struct GradingQueueStats {
    pub total: i64,
    pub submitted: i64,
    pub ai_graded: i64,
    pub teacher_reviewed: i64,
    pub returned: i64,
}

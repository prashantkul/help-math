use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// Database model for style_samples table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleSample {
    pub id: String,
    pub teacher_id: String,
    pub file_path: String,
    pub file_type: String,
    pub extracted_annotations: String, // JSONB stored as text
    pub feedback_patterns: String,     // JSONB stored as text
    pub processed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct StyleSampleResponse {
    pub id: String,
    pub file_path: String,
    pub file_type: String,
    pub extracted_annotations: serde_json::Value,
    pub feedback_patterns: serde_json::Value,
    pub processed: bool,
    pub created_at: String,
}

impl From<StyleSample> for StyleSampleResponse {
    fn from(s: StyleSample) -> Self {
        Self {
            id: s.id,
            file_path: s.file_path,
            file_type: s.file_type,
            extracted_annotations: serde_json::from_str(&s.extracted_annotations).unwrap_or_default(),
            feedback_patterns: serde_json::from_str(&s.feedback_patterns).unwrap_or_default(),
            processed: s.processed,
            created_at: s.created_at.to_rfc3339(),
        }
    }
}

// The style profile stored in teachers.style_profile JSONB
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StyleProfile {
    #[serde(default)]
    pub tone: String,
    #[serde(default)]
    pub praise_phrases: Vec<String>,
    #[serde(default)]
    pub correction_phrases: Vec<String>,
    #[serde(default)]
    pub correction_style: String,
    #[serde(default)]
    pub strictness: StyleStrictness,
    #[serde(default)]
    pub common_annotations: Vec<String>,
    #[serde(default)]
    pub visual_markers: Vec<String>,
    #[serde(default)]
    pub feedback_length: String,
    #[serde(default)]
    pub differentiation_notes: String,
    #[serde(default)]
    pub sample_count: i32,
    #[serde(default)]
    pub confidence_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StyleStrictness {
    #[serde(default)]
    pub spelling: String,
    #[serde(default)]
    pub math_work_shown: String,
    #[serde(default)]
    pub neatness: String,
}

// Request type for updating style profile
#[derive(Debug, Deserialize)]
pub struct UpdateStyleProfile {
    pub tone: Option<String>,
    pub praise_phrases: Option<Vec<String>>,
    pub correction_phrases: Option<Vec<String>>,
    pub correction_style: Option<String>,
    pub strictness: Option<StyleStrictness>,
    pub common_annotations: Option<Vec<String>>,
    pub visual_markers: Option<Vec<String>>,
    pub feedback_length: Option<String>,
    pub differentiation_notes: Option<String>,
}

// Request type for testing the style
#[derive(Debug, Deserialize)]
pub struct TestStyleRequest {
    pub student_work: String,
    pub student_name: Option<String>,
    pub grade_level: Option<i32>,
    pub subject: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TestStyleResponse {
    pub feedback: String,
    pub style_applied: bool,
}

// Response for the style profile endpoint
#[derive(Debug, Serialize)]
pub struct StyleProfileResponse {
    pub profile: StyleProfile,
    pub confidence: f64,
    pub sample_count: i32,
}

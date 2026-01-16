use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Problem {
    pub id: Uuid,
    pub class_id: Uuid,
    pub original_text: String,
    pub simplified_text: Option<String>,
    pub skill_tags: Vec<String>,
    pub difficulty: i32,
    pub is_published: bool,
    pub week_number: Option<i32>,
    pub scene_emoji: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScaffoldStep {
    pub id: Uuid,
    pub problem_id: Uuid,
    pub step_order: i32,
    pub step_type: String,
    pub prompt_text: String,
    pub simplified_text: Option<String>,
    pub correct_answer: sqlx::types::Json<serde_json::Value>,
    pub answer_type: String,
    pub options: Option<sqlx::types::Json<serde_json::Value>>,
    pub hints: Vec<String>,
    pub points: i32,
    pub emoji_hint: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProblem {
    pub class_id: Uuid,
    pub original_text: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProblem {
    pub original_text: Option<String>,
    pub simplified_text: Option<String>,
    pub skill_tags: Option<Vec<String>>,
    pub difficulty: Option<i32>,
    pub is_published: Option<bool>,
    pub week_number: Option<i32>,
    pub scene_emoji: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateScaffoldRequest {
    pub ell_level: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ProblemResponse {
    pub id: Uuid,
    pub class_id: Uuid,
    pub original_text: String,
    pub simplified_text: Option<String>,
    pub skill_tags: Vec<String>,
    pub difficulty: i32,
    pub is_published: bool,
    pub week_number: Option<i32>,
    pub scene_emoji: Option<String>,
    pub created_at: DateTime<Utc>,
    pub steps: Option<Vec<ScaffoldStepResponse>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScaffoldStepResponse {
    pub id: Uuid,
    pub problem_id: Uuid,
    pub step_order: i32,
    pub step_type: String,
    pub prompt_text: String,
    pub simplified_text: Option<String>,
    pub correct_answer: serde_json::Value,
    pub answer_type: String,
    pub options: Option<serde_json::Value>,
    pub hints: Vec<String>,
    pub points: i32,
    pub emoji_hint: Option<String>,
}

impl From<ScaffoldStep> for ScaffoldStepResponse {
    fn from(step: ScaffoldStep) -> Self {
        Self {
            id: step.id,
            problem_id: step.problem_id,
            step_order: step.step_order,
            step_type: step.step_type,
            prompt_text: step.prompt_text,
            simplified_text: step.simplified_text,
            correct_answer: step.correct_answer.0,
            answer_type: step.answer_type,
            options: step.options.map(|o| o.0),
            hints: step.hints,
            points: step.points,
            emoji_hint: step.emoji_hint,
        }
    }
}

impl ProblemResponse {
    pub fn from_problem(problem: Problem, steps: Option<Vec<ScaffoldStep>>) -> Self {
        Self {
            id: problem.id,
            class_id: problem.class_id,
            original_text: problem.original_text,
            simplified_text: problem.simplified_text,
            skill_tags: problem.skill_tags,
            difficulty: problem.difficulty,
            is_published: problem.is_published,
            week_number: problem.week_number,
            scene_emoji: problem.scene_emoji,
            created_at: problem.created_at,
            steps: steps.map(|s| s.into_iter().map(ScaffoldStepResponse::from).collect()),
        }
    }
}

// AI Scaffolding types
#[derive(Debug, Serialize, Deserialize)]
pub struct ScaffoldingAIRequest {
    pub problem_text: String,
    pub ell_level: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScaffoldingAIResponse {
    pub simplified_problem: String,
    pub skill_tags: Vec<String>,
    pub difficulty: i32,
    pub scene_emoji: String,
    pub steps: Vec<ScaffoldStepAI>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScaffoldStepAI {
    pub step_type: String,
    pub prompt_text: String,
    pub simplified_text: Option<String>,
    pub correct_answer: serde_json::Value,
    pub answer_type: String,
    pub options: Option<serde_json::Value>,
    pub hints: Vec<String>,
    pub points: i32,
    pub emoji_hint: Option<String>,
}

// PDF extraction types
#[derive(Debug, Serialize)]
pub struct PDFUploadResponse {
    pub extracted_problems: Vec<ExtractedProblem>,
}

#[derive(Debug, Serialize)]
pub struct ExtractedProblem {
    pub text: String,
    pub page_number: i32,
    pub confidence: f32,
}

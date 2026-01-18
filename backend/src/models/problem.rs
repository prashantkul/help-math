use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Problem {
    pub id: String,
    pub class_id: String,
    pub lesson_id: Option<String>,
    pub original_text: String,
    pub simplified_text: Option<String>,
    pub skill_tags: String, // JSON array stored as text
    pub difficulty: i32,
    pub is_published: bool,
    pub state: String, // 'draft', 'scaffolded', 'reviewed', 'published'
    pub week_number: Option<i32>,
    pub scene_emoji: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScaffoldStep {
    pub id: String,
    pub problem_id: String,
    pub step_order: i32,
    pub step_type: String,
    pub prompt_text: String,
    pub simplified_text: Option<String>,
    pub correct_answer: String, // JSON stored as text
    pub answer_type: String,
    pub options: Option<String>, // JSON stored as text
    pub hints: String, // JSON array stored as text
    pub points: i32,
    pub emoji_hint: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProblem {
    pub class_id: Option<String>,
    pub lesson_id: Option<String>,
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
    pub id: String,
    pub class_id: String,
    pub lesson_id: Option<String>,
    pub original_text: String,
    pub simplified_text: Option<String>,
    pub skill_tags: Vec<String>,
    pub difficulty: i32,
    pub is_published: bool,
    pub state: String, // 'draft', 'scaffolded', 'reviewed', 'published'
    pub week_number: Option<i32>,
    pub scene_emoji: Option<String>,
    pub created_at: String,
    pub steps: Option<Vec<ScaffoldStepResponse>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScaffoldStepResponse {
    pub id: String,
    pub problem_id: String,
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
            correct_answer: serde_json::from_str(&step.correct_answer).unwrap_or(serde_json::Value::Null),
            answer_type: step.answer_type,
            options: step.options.and_then(|o| serde_json::from_str(&o).ok()),
            hints: serde_json::from_str(&step.hints).unwrap_or_default(),
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
            lesson_id: problem.lesson_id,
            original_text: problem.original_text,
            simplified_text: problem.simplified_text,
            skill_tags: serde_json::from_str(&problem.skill_tags).unwrap_or_default(),
            difficulty: problem.difficulty,
            is_published: problem.is_published,
            state: problem.state,
            week_number: problem.week_number,
            scene_emoji: problem.scene_emoji,
            created_at: problem.created_at.to_rfc3339(),
            steps: steps.map(|s| s.into_iter().map(ScaffoldStepResponse::from).collect()),
        }
    }
}

// Request to create a new scaffold step
#[derive(Debug, Deserialize)]
pub struct CreateScaffoldStep {
    pub step_type: String,
    pub prompt_text: String,
    pub simplified_text: Option<String>,
    pub correct_answer: serde_json::Value,
    pub answer_type: String,
    pub options: Option<serde_json::Value>,
    pub hints: Vec<String>,
    pub points: Option<i32>,
    pub emoji_hint: Option<String>,
}

// Request to update an existing scaffold step
#[derive(Debug, Deserialize)]
pub struct UpdateScaffoldStep {
    pub step_type: Option<String>,
    pub prompt_text: Option<String>,
    pub simplified_text: Option<String>,
    pub correct_answer: Option<serde_json::Value>,
    pub answer_type: Option<String>,
    pub options: Option<serde_json::Value>,
    pub hints: Option<Vec<String>>,
    pub points: Option<i32>,
    pub emoji_hint: Option<String>,
}

// Request to reorder scaffold steps
#[derive(Debug, Deserialize)]
pub struct ReorderScaffoldSteps {
    pub step_ids: Vec<String>,
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

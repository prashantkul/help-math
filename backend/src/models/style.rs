use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ==================== Tier 1: Raw Extraction ====================

/// Database model for style_samples table (enhanced with extraction status)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleSample {
    pub id: String,
    pub teacher_id: String,
    pub file_path: String,
    pub file_type: String,
    pub extracted_annotations: String, // JSONB stored as text
    pub feedback_patterns: String,     // JSONB stored as text
    pub processed: bool,
    pub extraction_status: Option<String>,
    pub raw_extraction: Option<String>, // JSONB stored as text
    pub error_message: Option<String>,
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
    pub extraction_status: String,
    pub annotation_count: i64,
    pub created_at: String,
}

impl StyleSample {
    pub fn to_response(self, annotation_count: i64) -> StyleSampleResponse {
        StyleSampleResponse {
            id: self.id,
            file_path: self.file_path,
            file_type: self.file_type,
            extracted_annotations: serde_json::from_str(&self.extracted_annotations).unwrap_or_default(),
            feedback_patterns: serde_json::from_str(&self.feedback_patterns).unwrap_or_default(),
            processed: self.processed,
            extraction_status: self.extraction_status.unwrap_or_else(|| "pending".to_string()),
            annotation_count,
            created_at: self.created_at.to_rfc3339(),
        }
    }
}

/// For backward compat
impl From<StyleSample> for StyleSampleResponse {
    fn from(s: StyleSample) -> Self {
        s.to_response(0)
    }
}

/// Individual annotation extracted from a scanned page (Tier 1 output)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleAnnotation {
    pub id: String,
    pub sample_id: Option<String>,
    pub teacher_id: String,
    pub annotation_text: Option<String>,
    pub annotation_type: String,
    pub location: Option<String>,
    pub student_work_nearby: Option<String>,
    pub student_was_correct: Option<bool>,
    pub error_type: Option<String>,
    pub subject_area: Option<String>,
    pub work_shown: Option<bool>,
    pub apparent_intent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Claude Vision Tier 1 extraction response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tier1Extraction {
    pub annotations: Vec<Tier1Annotation>,
    pub page_level: Option<serde_json::Value>,
    pub extraction_confidence: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tier1Annotation {
    pub annotation_text: Option<String>,
    pub annotation_type: String,
    pub location: Option<String>,
    pub student_context: Option<Tier1StudentContext>,
    pub apparent_intent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tier1StudentContext {
    pub student_work_nearby: Option<String>,
    pub was_correct: Option<bool>,
    pub error_type: Option<String>,
    pub work_shown: Option<bool>,
    pub subject_area: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExtractionResponse {
    pub processed: i64,
    pub annotations_extracted: i64,
    pub synthesis_triggered: bool,
}

// ==================== Tier 2: Pattern Synthesis ====================

/// Synthesis record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleSynthesis {
    pub id: String,
    pub teacher_id: String,
    pub sample_count: i32,
    pub annotation_count: i32,
    pub model_output: String, // JSONB as text
    pub confidence_score: f64,
    pub gaps: Vec<String>,
    pub created_at: DateTime<Utc>,
}

/// The conditional style model output from Tier 2
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConditionalStyleModel {
    #[serde(default)]
    pub voice_description: String,
    #[serde(default)]
    pub conditional_responses: Vec<ConditionalResponse>,
    #[serde(default)]
    pub marking_system: Option<MarkingSystem>,
    #[serde(default)]
    pub general_tendencies: Option<GeneralTendencies>,
    #[serde(default)]
    pub adaptation_patterns: Option<serde_json::Value>,
    #[serde(default)]
    pub confidence_assessment: Option<ConfidenceAssessment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalResponse {
    pub condition: String,
    pub description: String,
    pub response_type: String,
    #[serde(default)]
    pub example_phrases: Vec<String>,
    pub typical_length: Option<String>,
    pub frequency: Option<String>,
    pub additional_behaviors: Option<String>,
    #[serde(default)]
    pub evidence_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkingSystem {
    pub correct_mark: Option<String>,
    pub incorrect_mark: Option<String>,
    pub exceptional_mark: Option<String>,
    pub needs_attention_mark: Option<String>,
    pub marking_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralTendencies {
    pub question_vs_statement_ratio: Option<f64>,
    pub uses_student_name: Option<bool>,
    pub references_class_rules: Option<bool>,
    pub uses_humor: Option<String>,
    pub exclamation_points: Option<String>,
    pub emoji_or_drawings: Option<bool>,
    pub feedback_position: Option<String>,
    pub handwriting_style: Option<String>,
    pub abbreviations_used: Option<Vec<String>>,
    pub always_says: Option<Vec<String>>,
    pub never_says: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceAssessment {
    pub overall_confidence: Option<f64>,
    pub strongest_patterns: Option<Vec<String>>,
    pub weakest_patterns: Option<Vec<String>>,
    pub gaps: Option<Vec<String>>,
    pub recommendations: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct SynthesisResponse {
    pub synthesis_id: String,
    pub annotations_analyzed: i64,
    pub samples_analyzed: i64,
    pub confidence: f64,
    pub gaps: Vec<String>,
    pub voice_description: String,
    pub conditional_responses_count: usize,
}

// ==================== Tier 3: Application ====================

/// Enhanced grading response with per-problem feedback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tier3GradingResponse {
    #[serde(default)]
    pub per_problem_feedback: Vec<ProblemFeedback>,
    pub overall_feedback: String,
    pub score: f64,
    pub score_reasoning: Option<String>,
    #[serde(default)]
    pub skill_gaps_identified: Vec<String>,
    #[serde(default)]
    pub strengths_shown: Vec<String>,
    pub growth_noted: Option<bool>,
    pub style_confidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemFeedback {
    pub problem_number: Option<i32>,
    pub student_answer: Option<String>,
    pub is_correct: Option<bool>,
    pub error_type: Option<String>,
    pub condition_matched: Option<String>,
    pub feedback: String,
}

// ==================== Tier 4: Continuous Learning ====================

/// Correction record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleCorrection {
    pub id: String,
    pub teacher_id: String,
    pub student_id: Option<String>,
    pub submission_id: Option<String>,
    pub assignment_context: Option<String>,
    pub student_work_summary: Option<String>,
    pub ai_feedback: String,
    pub teacher_feedback: String,
    pub correction_analysis: String, // JSONB as text
    pub applied_to_model: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LearnFromCorrectionRequest {
    pub submission_id: Option<String>,
    pub ai_feedback: String,
    pub teacher_feedback: String,
    pub student_id: Option<String>,
    pub assignment_context: Option<String>,
    pub student_work_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectionAnalysis {
    pub changes_made: Vec<CorrectionChange>,
    pub style_model_updates: Vec<StyleModelUpdate>,
    pub new_pattern_detected: Option<bool>,
    pub pattern_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectionChange {
    pub what_changed: String,
    pub ai_said: Option<String>,
    pub teacher_said: Option<String>,
    pub likely_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleModelUpdate {
    pub update_type: String,
    pub target: Option<String>,
    pub current_value: Option<String>,
    pub suggested_value: Option<String>,
    pub confidence: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CorrectionResponse {
    pub correction_id: String,
    pub insights: Vec<String>,
}

// ==================== Test My Style ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StyleTest {
    pub id: String,
    pub teacher_id: String,
    pub test_items: String,     // JSONB as text
    pub results: Option<String>, // JSONB as text
    pub approval_rate: Option<f64>,
    pub corrections_made: Option<String>, // JSONB as text
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestItem {
    pub item_id: i32,
    pub student_work: String,
    pub error_context: Option<String>,
    pub feedback: String,
    pub source: String, // "ai" or "real"
}

#[derive(Debug, Serialize)]
pub struct GenerateTestResponse {
    pub test_id: String,
    pub items: Vec<TestItemResponse>,
}

#[derive(Debug, Serialize)]
pub struct TestItemResponse {
    pub item_id: i32,
    pub student_work: String,
    pub error_context: Option<String>,
    pub feedback: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTestRequest {
    pub ratings: Vec<TestRating>,
}

#[derive(Debug, Deserialize)]
pub struct TestRating {
    pub item_id: i32,
    pub sounds_like_me: bool,
    pub what_id_change: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TestResultsResponse {
    pub test_id: String,
    pub results: TestResults,
}

#[derive(Debug, Serialize)]
pub struct TestResults {
    pub ai_items_approved: i32,
    pub ai_items_total: i32,
    pub real_items_approved: i32,
    pub real_items_total: i32,
    pub pass_rate: f64,
    pub confidence_update: String,
    pub insights: String,
}

// ==================== Style Overrides ====================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StyleOverrides {
    #[serde(default)]
    pub always_say: Vec<String>,
    #[serde(default)]
    pub never_say: Vec<String>,
    #[serde(default)]
    pub feedback_length: Option<String>,
    #[serde(default)]
    pub grading_priorities: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStyleOverrides {
    pub always_say: Option<Vec<String>>,
    pub never_say: Option<Vec<String>>,
    pub feedback_length: Option<String>,
    pub grading_priorities: Option<Vec<String>>,
}

// ==================== Backward-Compatible Types ====================

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

/// Full style center dashboard response
#[derive(Debug, Serialize)]
pub struct StyleProfileResponse {
    pub profile: StyleProfile,
    pub confidence: f64,
    pub sample_count: i32,
    pub has_deep_model: bool,
    pub deep_model: Option<DeepModelSummary>,
    pub overrides: StyleOverrides,
    pub annotation_count: i64,
    pub correction_count: i64,
    pub recent_corrections_summary: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeepModelSummary {
    pub voice_description: String,
    pub conditional_responses: Vec<ConditionalResponseSummary>,
    pub gaps: Vec<String>,
    pub last_synthesized: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConditionalResponseSummary {
    pub condition: String,
    pub description: String,
    pub response_type: String,
    pub example_phrases: Vec<String>,
    pub evidence_count: i64,
}

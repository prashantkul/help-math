use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::models::{
    AIGradingResponse, ConditionalStyleModel, CorrectionAnalysis,
    StyleOverrides, StyleProfile, Tier1Extraction, Tier3GradingResponse,
};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";

#[derive(Debug, Serialize)]
struct VisionRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<VisionMessage>,
    system: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisionMessage {
    role: String,
    content: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

#[derive(Serialize)]
struct SimpleRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<SimpleMessage>,
    system: String,
}

#[derive(Serialize)]
struct SimpleMessage {
    role: String,
    content: String,
}

// ==================== Style Cache ====================

struct CachedModel {
    style_model: ConditionalStyleModel,
    overrides: StyleOverrides,
    loaded_at: Instant,
}

pub struct StyleCache {
    models: RwLock<HashMap<String, CachedModel>>,
    ttl: Duration,
}

impl StyleCache {
    pub fn new() -> Self {
        Self {
            models: RwLock::new(HashMap::new()),
            ttl: Duration::from_secs(300),
        }
    }

    pub async fn get(&self, teacher_id: &str) -> Option<(ConditionalStyleModel, StyleOverrides)> {
        let cache = self.models.read().await;
        if let Some(cached) = cache.get(teacher_id) {
            if cached.loaded_at.elapsed() < self.ttl {
                return Some((cached.style_model.clone(), cached.overrides.clone()));
            }
        }
        None
    }

    pub async fn set(&self, teacher_id: &str, model: ConditionalStyleModel, overrides: StyleOverrides) {
        let mut cache = self.models.write().await;
        cache.insert(teacher_id.to_string(), CachedModel {
            style_model: model,
            overrides,
            loaded_at: Instant::now(),
        });
    }

    pub async fn invalidate(&self, teacher_id: &str) {
        let mut cache = self.models.write().await;
        cache.remove(teacher_id);
    }
}

// ==================== Main Service ====================

pub struct StyleAIService {
    client: Client,
    api_key: String,
    pub cache: Arc<StyleCache>,
}

impl StyleAIService {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            cache: Arc::new(StyleCache::new()),
        }
    }

    // ==================== Tier 1: Raw Extraction ====================

    pub async fn extract_annotations_tier1(
        &self,
        image_base64: &str,
        media_type: &str,
        grade_level: i32,
        subject: &str,
    ) -> Result<Tier1Extraction> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let system_prompt = format!(
            r#"You are analyzing a scanned, hand-graded student assignment to extract EVERY teacher annotation with full context. This is a grade {grade_level} {subject} class.

Your job is forensic — capture everything the teacher wrote, drew, or marked, and understand what the student's work looked like next to each annotation.

For EACH annotation you find on this page, extract:

{{
  "annotation_text": "exact text if written, or description if a mark",
  "annotation_type": "written_comment | checkmark | x_mark | circle | underline | star | smiley | arrow | question_mark | exclamation | other",
  "location": "margin_left | margin_right | above_work | below_work | between_lines | bottom_of_page | top_of_page | inline | circled_area",
  "student_context": {{
    "student_work_nearby": "what the student wrote near this annotation",
    "was_correct": true/false/null,
    "error_type": "careless_arithmetic | conceptual_misunderstanding | incomplete_work | no_attempt | wrong_operation | formatting | null",
    "work_shown": true/false/null,
    "subject_area": "addition | subtraction | multiplication | division | place_value | regrouping | word_problem | fractions | measurement | other"
  }},
  "apparent_intent": "praise | correction | guiding_question | encouragement | reminder | growth_celebration | constructive_criticism | instruction | humor | acknowledgment"
}}

ALSO extract at the page level:
{{
  "page_level": {{
    "overall_score_visible": "85%" or null,
    "general_comment_at_bottom": "text if present",
    "overall_tone_of_this_page": "brief description",
    "total_annotations_found": 12,
    "marking_color": "red pen | blue pen | pencil | green pen | mixed"
  }}
}}

Return JSON with:
{{
  "annotations": [...array of annotation objects...],
  "page_level": {{...}},
  "extraction_confidence": 0.0-1.0,
  "notes": "any issues"
}}

IMPORTANT:
- Copy handwritten text EXACTLY, including spelling/abbreviations
- If you can't read something, write "unclear: [best guess]"
- Capture marks (checkmarks, X marks, circles) as annotations too
- Pay attention to WHAT the student wrote near each annotation
- A single problem may have multiple annotations

Return ONLY the JSON object, no other text."#
        );

        let content = serde_json::json!([
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_base64
                }
            },
            {
                "type": "text",
                "text": "Analyze this scanned graded paper. Extract every teacher annotation with full context."
            }
        ]);

        let request = VisionRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 4096,
            messages: vec![VisionMessage {
                role: "user".to_string(),
                content,
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_raw(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse Tier 1 extraction: {}", e))
    }

    // ==================== Tier 2: Pattern Synthesis ====================

    pub async fn synthesize_style_tier2(
        &self,
        annotations_json: &str,
        annotation_count: i64,
        sample_count: i64,
        grade_level: i32,
        subject: &str,
        corrections_json: Option<&str>,
    ) -> Result<ConditionalStyleModel> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let corrections_section = if let Some(corr) = corrections_json {
            format!(
                r#"

=== TEACHER CORRECTIONS TO PREVIOUS AI FEEDBACK ===
These corrections are HIGH-SIGNAL data about where the current model is wrong:

{corr}"#
            )
        } else {
            String::new()
        };

        let system_prompt = format!(
            r#"You are building a comprehensive model of a grade {grade_level} {subject} teacher's grading and feedback style by analyzing {annotation_count} annotations extracted from {sample_count} graded student papers.

Your goal is to identify CONDITIONAL PATTERNS — not just what phrases this teacher uses, but WHEN and WHY they use different responses.

Analyze the annotations and return a CONDITIONAL STYLE MODEL as JSON:

{{
  "voice_description": "2-3 sentence description of this teacher's personality as a grader",
  "conditional_responses": [
    {{
      "condition": "correct_with_work_shown",
      "description": "When the student gets it right AND shows their work",
      "response_type": "enthusiastic praise",
      "example_phrases": ["exact phrases from annotations"],
      "typical_length": "1 sentence",
      "frequency": "always / usually / sometimes",
      "additional_behaviors": "Also adds a star mark",
      "evidence_count": 12
    }}
  ],
  "marking_system": {{
    "correct_mark": "how they mark correct answers",
    "incorrect_mark": "how they mark wrong answers",
    "exceptional_mark": "stars, stickers, smiley faces",
    "needs_attention_mark": "how they flag things to review",
    "marking_color": "red pen / blue pen / pencil / etc."
  }},
  "general_tendencies": {{
    "question_vs_statement_ratio": 0.0-1.0,
    "uses_student_name": true/false,
    "references_class_rules": true/false,
    "uses_humor": "never / rarely / occasionally / frequently",
    "exclamation_points": "rare / moderate / frequent",
    "emoji_or_drawings": true/false,
    "feedback_position": "margin / below work / bottom of page / mixed",
    "abbreviations_used": ["list"],
    "always_says": ["phrases in almost every paper"],
    "never_says": ["notable absences"]
  }},
  "confidence_assessment": {{
    "overall_confidence": 0.0-1.0,
    "strongest_patterns": ["conditions with most evidence"],
    "weakest_patterns": ["conditions with little evidence"],
    "gaps": ["specific scenarios without examples"],
    "recommendations": ["what to upload next to improve the model"]
  }}
}}

RULES:
- Only include conditional_responses with 2+ examples of evidence
- Quote exact phrases from annotations — don't paraphrase
- The gaps field is CRITICAL — specific and actionable
- Be specific about what makes this teacher UNIQUE{corrections_section}

Return ONLY the JSON object, no other text."#
        );

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 8192,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Here are all the extracted annotations:\n\n{}", annotations_json),
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_simple(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse Tier 2 synthesis: {}", e))
    }

    pub fn calculate_confidence(model: &ConditionalStyleModel) -> f64 {
        let mut score = 0.0;

        let conditions_covered = model.conditional_responses.len() as f64;
        let ideal_conditions = 8.0;
        score += (conditions_covered / ideal_conditions).min(1.0) * 0.3;

        let total_evidence: i64 = model.conditional_responses.iter()
            .map(|c| c.evidence_count)
            .sum();
        let avg_evidence = total_evidence as f64 / conditions_covered.max(1.0);
        score += (avg_evidence / 5.0).min(1.0) * 0.3;

        let key_conditions = [
            "correct_with_work_shown", "minor_error", "conceptual", "no_attempt",
        ];
        let covered = key_conditions.iter()
            .filter(|kc| model.conditional_responses.iter().any(|c| c.condition.contains(*kc)))
            .count() as f64;
        score += (covered / key_conditions.len() as f64) * 0.2;

        let gap_count = model.confidence_assessment.as_ref()
            .and_then(|ca| ca.gaps.as_ref())
            .map(|g| g.len())
            .unwrap_or(0);
        let gap_penalty = (gap_count as f64 * 0.03).min(0.2);
        score -= gap_penalty;

        score.max(0.0).min(1.0)
    }

    // ==================== Tier 3: Application ====================

    pub async fn grade_with_deep_model(
        &self,
        style_model: &ConditionalStyleModel,
        overrides: &StyleOverrides,
        student_name: &str,
        grade_level: i32,
        subject: &str,
        assignment_title: &str,
        student_work: &str,
        student_history: Option<&str>,
    ) -> Result<Tier3GradingResponse> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let model_json = serde_json::to_string_pretty(style_model)
            .unwrap_or_else(|_| "{}".to_string());

        let overrides_section = if !overrides.always_say.is_empty() || !overrides.never_say.is_empty() {
            let mut s = String::from("\n\n=== HARD RULES (override everything else) ===\n");
            if !overrides.always_say.is_empty() {
                s.push_str(&format!("ALWAYS include: {}\n", overrides.always_say.join(", ")));
            }
            if !overrides.never_say.is_empty() {
                s.push_str(&format!("NEVER use: {}\n", overrides.never_say.join(", ")));
            }
            if let Some(ref len) = overrides.feedback_length {
                s.push_str(&format!("Feedback length: {}\n", len));
            }
            s
        } else {
            String::new()
        };

        let history_section = student_history.map(|h| format!(
            "\n\n=== STUDENT HISTORY ===\n{}", h
        )).unwrap_or_default();

        let system_prompt = format!(
            r#"You are grading a grade {grade_level} student's {subject} work. You MUST write feedback INDISTINGUISHABLE from this specific teacher.

=== TEACHER STYLE MODEL ===
{model_json}

=== STUDENT ===
Name: {student_name}{history_section}

=== ASSIGNMENT ===
Title: {assignment_title}{overrides_section}

Return JSON:
{{
  "per_problem_feedback": [
    {{
      "problem_number": 1,
      "student_answer": "what they wrote",
      "is_correct": true/false,
      "error_type": "careless | conceptual | wrong_operation | incomplete | null",
      "condition_matched": "which conditional_response was used",
      "feedback": "the feedback text"
    }}
  ],
  "overall_feedback": "general comment matching teacher's closing style",
  "score": 85,
  "score_reasoning": "how score was calculated",
  "skill_gaps_identified": ["place_value"],
  "strengths_shown": ["effort"],
  "growth_noted": true/false,
  "style_confidence": "high/medium/low"
}}

Return ONLY the JSON object."#
        );

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 2048,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Grade this student work:\n\n{}", student_work),
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_simple(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse Tier 3 grading: {}", e))
    }

    // ==================== Tier 4: Correction Analysis ====================

    pub async fn analyze_correction_tier4(
        &self,
        ai_feedback: &str,
        teacher_feedback: &str,
        context: &str,
        relevant_model_section: Option<&str>,
    ) -> Result<CorrectionAnalysis> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let model_section = relevant_model_section.map(|s| format!(
            "\n\n=== CURRENT STYLE MODEL (relevant section) ===\n{}", s
        )).unwrap_or_default();

        let system_prompt = format!(
            r#"A teacher reviewed AI-generated feedback and edited it before approving.
Analyze what they changed and what this reveals about their style.

=== CONTEXT ===
{context}

=== AI-GENERATED VERSION ===
"{ai_feedback}"

=== TEACHER'S EDITED VERSION ===
"{teacher_feedback}"{model_section}

Return JSON:
{{
  "changes_made": [
    {{
      "what_changed": "description of the specific change",
      "ai_said": "the specific phrase that was changed",
      "teacher_said": "what they replaced it with",
      "likely_reason": "why"
    }}
  ],
  "style_model_updates": [
    {{
      "update_type": "add_phrase | remove_phrase | adjust_tone | adjust_length | new_condition | modify_condition",
      "target": "which part of the style model to update",
      "current_value": "what the model says",
      "suggested_value": "what it should say",
      "confidence": "high | medium | low"
    }}
  ],
  "new_pattern_detected": true/false,
  "pattern_description": "if true, describe the new pattern"
}}

Distinguish style corrections from content corrections. Only style corrections matter.
Return ONLY the JSON object."#
        );

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 1024,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: "Analyze this correction.".to_string(),
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_simple(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse Tier 4 analysis: {}", e))
    }

    // ==================== Test My Style ====================

    pub async fn generate_test_feedback(
        &self,
        style_model: &ConditionalStyleModel,
        student_work: &str,
        error_context: &str,
        grade_level: i32,
    ) -> Result<String> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let model_json = serde_json::to_string_pretty(style_model)
            .unwrap_or_else(|_| "{}".to_string());

        let system_prompt = format!(
            r#"You are a grade {grade_level} math teacher providing feedback on student work.
Write feedback EXACTLY in this teacher's voice using their conditional style model:

{model_json}

Match their exact tone, phrases, length, and conditional patterns.
Write ONLY the feedback text, nothing else."#
        );

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 512,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Student work: {}\nContext: {}", student_work, error_context),
            }],
            system: system_prompt,
        };

        self.call_claude_simple(&request).await
    }

    // ==================== Backward-Compatible Methods ====================

    pub async fn extract_style_from_image(
        &self,
        image_base64: &str,
        media_type: &str,
        grade_level: i32,
        subject: &str,
    ) -> Result<StyleProfile> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let system_prompt = format!(
            r#"You are analyzing a scanned, hand-graded student assignment to learn this teacher's personal grading and feedback style. Grade level: {grade_level}, Subject: {subject}.

Extract from handwritten annotations:
1. EXACT PHRASES — copy every handwritten comment verbatim
2. TONE — warm/firm/playful/clinical/encouraging
3. PRAISE PATTERNS — how they celebrate correct work
4. CORRECTION PATTERNS — direct correction vs. guiding questions vs. hints
5. VISUAL MARKERS — symbols used
6. STRICTNESS — what they comment on vs. let slide
7. FEEDBACK LENGTH — how much per problem
8. DIFFERENTIATION — evidence of adjusting by student

Return structured JSON:
{{
  "tone": "description of tone",
  "praise_phrases": ["exact phrase 1", "exact phrase 2"],
  "correction_phrases": ["exact phrase 1", "exact phrase 2"],
  "correction_style": "description of how they correct",
  "strictness": {{
    "spelling": "lenient/moderate/strict",
    "math_work_shown": "lenient/moderate/strict",
    "neatness": "lenient/moderate/strict"
  }},
  "common_annotations": ["annotation 1", "annotation 2"],
  "visual_markers": ["checkmarks", "stars"],
  "feedback_length": "brief/moderate/detailed",
  "differentiation_notes": "any evidence of differentiation",
  "sample_count": 1,
  "confidence_score": 0.07
}}

If handwriting is unclear, mark as "unclear".
Return ONLY the JSON object, no other text."#
        );

        let content = serde_json::json!([
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_base64
                }
            },
            {
                "type": "text",
                "text": "Please analyze this scanned graded paper and extract the teacher's grading style."
            }
        ]);

        let request = VisionRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 4096,
            messages: vec![VisionMessage {
                role: "user".to_string(),
                content,
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_raw(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse style profile: {}", e))
    }

    pub fn aggregate_style(existing: &StyleProfile, new_sample: &StyleProfile) -> StyleProfile {
        let mut result = existing.clone();

        if !new_sample.tone.is_empty() && new_sample.tone != "unclear" {
            if result.tone.is_empty() {
                result.tone = new_sample.tone.clone();
            } else {
                result.tone = format!("{}, {}", result.tone, new_sample.tone);
            }
        }
        for phrase in &new_sample.praise_phrases {
            if !result.praise_phrases.contains(phrase) {
                result.praise_phrases.push(phrase.clone());
            }
        }
        for phrase in &new_sample.correction_phrases {
            if !result.correction_phrases.contains(phrase) {
                result.correction_phrases.push(phrase.clone());
            }
        }
        if !new_sample.correction_style.is_empty() && new_sample.correction_style != "unclear" {
            result.correction_style = new_sample.correction_style.clone();
        }
        if !new_sample.strictness.spelling.is_empty() {
            result.strictness.spelling = new_sample.strictness.spelling.clone();
        }
        if !new_sample.strictness.math_work_shown.is_empty() {
            result.strictness.math_work_shown = new_sample.strictness.math_work_shown.clone();
        }
        if !new_sample.strictness.neatness.is_empty() {
            result.strictness.neatness = new_sample.strictness.neatness.clone();
        }
        for ann in &new_sample.common_annotations {
            if !result.common_annotations.contains(ann) {
                result.common_annotations.push(ann.clone());
            }
        }
        for marker in &new_sample.visual_markers {
            if !result.visual_markers.contains(marker) {
                result.visual_markers.push(marker.clone());
            }
        }
        if !new_sample.feedback_length.is_empty() {
            result.feedback_length = new_sample.feedback_length.clone();
        }
        if !new_sample.differentiation_notes.is_empty() {
            result.differentiation_notes = new_sample.differentiation_notes.clone();
        }
        result.sample_count += 1;
        result.confidence_score = (result.sample_count as f64 * 0.07).min(1.0);
        result
    }

    pub async fn grade_in_teacher_voice(
        &self,
        style_profile: &StyleProfile,
        student_name: &str,
        grade_level: i32,
        subject: &str,
        assignment_title: &str,
        student_work: &str,
    ) -> Result<AIGradingResponse> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let style_json = serde_json::to_string_pretty(style_profile)
            .unwrap_or_else(|_| "{}".to_string());

        let system_prompt = format!(
            r#"You are grading a grade {grade_level} student's {subject} assignment.
Write feedback EXACTLY in this teacher's voice:

=== TEACHER STYLE PROFILE ===
{style_json}

=== STUDENT CONTEXT ===
Name: {student_name}

=== ASSIGNMENT ===
Title: {assignment_title}

Match their exact tone, praise phrases, correction style, and feedback length.
Return JSON:
{{
  "feedback": "feedback in teacher's voice",
  "score": 85,
  "skill_gaps": ["place_value", "regrouping"],
  "strengths_shown": ["number_sense", "effort"],
  "reasoning": "grading rationale (teacher-only)"
}}

Return ONLY the JSON object."#
        );

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 2048,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Please grade this student work:\n\n{}", student_work),
            }],
            system: system_prompt,
        };

        let response_text = self.call_claude_simple(&request).await?;
        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse grading response: {}", e))
    }

    pub async fn test_style(
        &self,
        style_profile: &StyleProfile,
        student_work: &str,
        student_name: &str,
        grade_level: i32,
        subject: &str,
    ) -> Result<String> {
        if self.api_key.is_empty() {
            return Err(anyhow!("ANTHROPIC_API_KEY is not configured"));
        }

        let style_json = serde_json::to_string_pretty(style_profile)
            .unwrap_or_else(|_| "{}".to_string());

        let system_prompt = format!(
            r#"You are a grade {grade_level} {subject} teacher providing feedback on student work.
Write feedback EXACTLY in this teacher's voice:

=== TEACHER STYLE PROFILE ===
{style_json}

Rules:
- Match their exact tone, praise phrases, correction style, and feedback length
- If the profile is empty or sparse, write warm, encouraging feedback

Write the feedback as if you ARE this teacher talking to {student_name}.
Return ONLY the feedback text, nothing else."#
        );

        let request = SimpleRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 1024,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Here is {}'s work:\n\n{}", student_name, student_work),
            }],
            system: system_prompt,
        };

        self.call_claude_simple(&request).await
    }

    // ==================== Internal Helpers ====================

    async fn call_claude_raw(&self, request: &VisionRequest) -> Result<String> {
        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Claude API: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Claude API error ({}): {}", status, error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse Claude response: {}", e))?;

        claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow!("Empty response from Claude"))
    }

    async fn call_claude_simple(&self, request: &SimpleRequest) -> Result<String> {
        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Claude API: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Claude API error ({}): {}", status, error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse Claude response: {}", e))?;

        claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow!("Empty response from Claude"))
    }
}

fn extract_json(text: &str) -> Result<String> {
    if let Some(start) = text.find("```json") {
        let json_start = start + 7;
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }
    if let Some(start) = text.find("```") {
        let json_start = text[start + 3..].find('\n').map(|i| start + 4 + i).unwrap_or(start + 3);
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            return Ok(text[start..=end].to_string());
        }
    }
    Err(anyhow!("No valid JSON found in response"))
}

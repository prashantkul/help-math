use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::models::{StyleProfile, AIGradingResponse};

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

pub struct StyleAIService {
    client: Client,
    api_key: String,
}

impl StyleAIService {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Extract teaching style from a scanned graded paper using Claude Vision
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
5. VISUAL MARKERS — symbols used (checkmarks, X marks, circles, stars, smiley faces)
6. STRICTNESS — what they comment on vs. let slide
7. FEEDBACK LENGTH — how much per problem
8. DIFFERENTIATION — evidence of adjusting by student

Return structured JSON matching this exact schema:
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
  "visual_markers": ["checkmarks", "stars", etc.],
  "feedback_length": "brief/moderate/detailed",
  "differentiation_notes": "any evidence of differentiation",
  "sample_count": 1,
  "confidence_score": 0.07
}}

If handwriting is unclear, mark as "unclear" — do not guess.
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

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
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

        let response_text = claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow!("Empty response from Claude"))?;

        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse style profile: {}", e))
    }

    /// Aggregate a new style sample into the existing profile
    pub fn aggregate_style(existing: &StyleProfile, new_sample: &StyleProfile) -> StyleProfile {
        let mut result = existing.clone();

        // Update tone if new info available
        if !new_sample.tone.is_empty() && new_sample.tone != "unclear" {
            if result.tone.is_empty() {
                result.tone = new_sample.tone.clone();
            } else {
                result.tone = format!("{}, {}", result.tone, new_sample.tone);
            }
        }

        // Append unique phrases
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

        // Update correction style
        if !new_sample.correction_style.is_empty() && new_sample.correction_style != "unclear" {
            result.correction_style = new_sample.correction_style.clone();
        }

        // Merge strictness
        if !new_sample.strictness.spelling.is_empty() {
            result.strictness.spelling = new_sample.strictness.spelling.clone();
        }
        if !new_sample.strictness.math_work_shown.is_empty() {
            result.strictness.math_work_shown = new_sample.strictness.math_work_shown.clone();
        }
        if !new_sample.strictness.neatness.is_empty() {
            result.strictness.neatness = new_sample.strictness.neatness.clone();
        }

        // Append unique annotations and markers
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

        // Update feedback length
        if !new_sample.feedback_length.is_empty() {
            result.feedback_length = new_sample.feedback_length.clone();
        }

        // Update differentiation
        if !new_sample.differentiation_notes.is_empty() {
            result.differentiation_notes = new_sample.differentiation_notes.clone();
        }

        // Increment sample count and recalculate confidence
        result.sample_count += 1;
        result.confidence_score = (result.sample_count as f64 * 0.07).min(1.0);

        result
    }

    /// Grade student work in the teacher's voice
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
Identify specific skill gaps from errors.

Return JSON:
{{
  "feedback": "feedback in teacher's voice",
  "score": 85,
  "skill_gaps": ["place_value", "regrouping"],
  "strengths_shown": ["number_sense", "effort"],
  "reasoning": "grading rationale (teacher-only, not shown to student)"
}}

Return ONLY the JSON object, no other text."#
        );

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

        let request = SimpleRequest {
            model: "claude-opus-4-20250514".to_string(),
            max_tokens: 2048,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Please grade this student work:\n\n{}", student_work),
            }],
            system: system_prompt,
        };

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
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

        let response_text = claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow!("Empty response from Claude"))?;

        let json_str = extract_json(&response_text)?;
        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse grading response: {}", e))
    }

    /// Test the teacher's style by generating feedback on sample work
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
- Use their specific phrases when appropriate
- Keep the same level of strictness
- If the profile is empty or sparse, write warm, encouraging feedback typical of an elementary teacher

Write the feedback as if you ARE this teacher talking directly to the student {student_name}.
Return ONLY the feedback text, nothing else."#
        );

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

        let request = SimpleRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 1024,
            messages: vec![SimpleMessage {
                role: "user".to_string(),
                content: format!("Here is {}'s work:\n\n{}", student_name, student_work),
            }],
            system: system_prompt,
        };

        let response = self
            .client
            .post(CLAUDE_API_URL)
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
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
    // Try to find JSON in code blocks first
    if let Some(start) = text.find("```json") {
        let json_start = start + 7;
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }

    // Try generic code blocks
    if let Some(start) = text.find("```") {
        let json_start = text[start + 3..].find('\n').map(|i| start + 4 + i).unwrap_or(start + 3);
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }

    // Try raw JSON
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            return Ok(text[start..=end].to_string());
        }
    }

    Err(anyhow!("No valid JSON found in response"))
}

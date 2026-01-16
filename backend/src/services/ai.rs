use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::models::{ScaffoldingAIResponse, ScaffoldStepAI};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
    system: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    text: String,
}

pub struct AIService {
    client: Client,
    api_key: String,
}

impl AIService {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    pub async fn generate_scaffold(
        &self,
        problem_text: &str,
        ell_level: i32,
    ) -> Result<ScaffoldingAIResponse> {
        let system_prompt = self.get_system_prompt(ell_level);
        let user_prompt = format!(
            "Please scaffold the following math word problem for a 3rd grade ELL student:\n\n{}",
            problem_text
        );

        let request = ClaudeRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            max_tokens: 4096,
            messages: vec![ClaudeMessage {
                role: "user".to_string(),
                content: user_prompt,
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

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Claude API error: {}", error_text));
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

        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        let json_str = self.extract_json(&response_text)?;

        serde_json::from_str(&json_str)
            .map_err(|e| anyhow!("Failed to parse scaffolding response: {}", e))
    }

    fn extract_json(&self, text: &str) -> Result<String> {
        // Try to find JSON in code blocks first
        if let Some(start) = text.find("```json") {
            let json_start = start + 7;
            if let Some(end) = text[json_start..].find("```") {
                return Ok(text[json_start..json_start + end].trim().to_string());
            }
        }

        // Try to find JSON in generic code blocks
        if let Some(start) = text.find("```") {
            let json_start = text[start + 3..].find('\n').map(|i| start + 4 + i).unwrap_or(start + 3);
            if let Some(end) = text[json_start..].find("```") {
                return Ok(text[json_start..json_start + end].trim().to_string());
            }
        }

        // Try to find raw JSON
        if let Some(start) = text.find('{') {
            if let Some(end) = text.rfind('}') {
                return Ok(text[start..=end].to_string());
            }
        }

        Err(anyhow!("No valid JSON found in response"))
    }

    fn get_system_prompt(&self, ell_level: i32) -> String {
        let vocab_level = match ell_level {
            1 => "very basic vocabulary (Lexile 200-400)",
            2 => "simple vocabulary (Lexile 400-600)",
            3 => "moderate vocabulary (Lexile 600-800)",
            _ => "simple vocabulary (Lexile 400-600)",
        };

        format!(r#"You are an expert elementary math educator specializing in helping English Language Learners (ELL) understand word problems. Your task is to decompose a 3rd grade math word problem into scaffolded steps.

Target audience: 8-9 year old students who are good at math but struggle with reading comprehension. Use {}.

For each problem, generate a JSON response with this structure:

{{
  "simplified_problem": "A shorter, simpler version of the problem using basic vocabulary",
  "skill_tags": ["addition", "subtraction", "multiplication", "division", "multi-step"],
  "difficulty": 1-3,
  "scene_emoji": "🍎👧",
  "steps": [
    {{
      "step_type": "find_objects",
      "prompt_text": "Who or what is in this problem?",
      "simplified_text": "Maria has apples.",
      "correct_answer": ["Maria", "apples"],
      "answer_type": "multi_select",
      "options": ["Maria", "apples", "store", "mother", "neighbor"],
      "hints": ["Look for names of people", "Look for things you can count"],
      "points": 10,
      "emoji_hint": "👧🍎"
    }},
    {{
      "step_type": "find_numbers",
      "prompt_text": "What numbers do you see?",
      "correct_answer": [12, 5],
      "answer_type": "multi_select",
      "options": [5, 10, 12, 15, 7],
      "hints": ["Numbers tell us 'how many'"],
      "points": 10,
      "emoji_hint": "🔢"
    }},
    {{
      "step_type": "identify_operation",
      "prompt_text": "Maria gives apples away. What do we do when we give things away?",
      "correct_answer": "subtract",
      "answer_type": "multiple_choice",
      "options": [
        {{"value": "add", "label": "Add (put together)", "emoji": "➕"}},
        {{"value": "subtract", "label": "Subtract (take away)", "emoji": "➖"}},
        {{"value": "multiply", "label": "Multiply (groups of)", "emoji": "✖️"}},
        {{"value": "divide", "label": "Divide (share equally)", "emoji": "➗"}}
      ],
      "hints": ["When we give something away, do we have more or less?"],
      "points": 15,
      "emoji_hint": "🤔"
    }},
    {{
      "step_type": "build_equation",
      "prompt_text": "Build the math sentence!",
      "correct_answer": {{"left": 12, "operator": "-", "right": 5}},
      "answer_type": "equation_builder",
      "hints": ["Start with how many Maria had", "Then subtract what she gave away"],
      "points": 15,
      "emoji_hint": "📝"
    }},
    {{
      "step_type": "solve",
      "prompt_text": "What is 12 - 5?",
      "correct_answer": 7,
      "answer_type": "number_input",
      "hints": ["Count back 5 from 12", "Use your fingers if it helps!"],
      "points": 20,
      "emoji_hint": "🎯"
    }},
    {{
      "step_type": "comprehension_check",
      "prompt_text": "Maria now has 7 apples. She started with 12. Does she have MORE or LESS now?",
      "correct_answer": "less",
      "answer_type": "multiple_choice",
      "options": [
        {{"value": "more", "label": "More apples"}},
        {{"value": "less", "label": "Less apples"}}
      ],
      "hints": ["She gave some away..."],
      "points": 10,
      "emoji_hint": "✅"
    }}
  ]
}}

Rules:
1. Use vocabulary appropriate for ELL students at the specified level
2. Each step should test ONE thing only
3. Provide 2-3 wrong options that are plausible but clearly wrong to a student who understands
4. Hints should guide without giving away the answer
5. Emojis should be simple and universally understood
6. The comprehension check should verify the answer makes sense in context
7. For multi-step problems, you may need more steps - break it down as much as needed
8. Avoid: complex sentences, idioms, uncommon words, unnecessary details
9. Always return valid JSON that can be parsed

Respond ONLY with the JSON object, no other text."#, vocab_level)
    }
}

// Fallback scaffolding for when AI is unavailable
pub fn generate_fallback_scaffold(problem_text: &str) -> ScaffoldingAIResponse {
    // Simple heuristic-based scaffolding
    let has_subtraction = problem_text.to_lowercase().contains("gave")
        || problem_text.to_lowercase().contains("left")
        || problem_text.to_lowercase().contains("took");

    let has_addition = problem_text.to_lowercase().contains("total")
        || problem_text.to_lowercase().contains("altogether")
        || problem_text.to_lowercase().contains("more");

    let has_multiplication = problem_text.to_lowercase().contains("each")
        || problem_text.to_lowercase().contains("groups")
        || problem_text.to_lowercase().contains("times");

    let has_division = problem_text.to_lowercase().contains("share")
        || problem_text.to_lowercase().contains("equally")
        || problem_text.to_lowercase().contains("split");

    let operation = if has_subtraction {
        "subtraction"
    } else if has_addition {
        "addition"
    } else if has_multiplication {
        "multiplication"
    } else if has_division {
        "division"
    } else {
        "addition"
    };

    ScaffoldingAIResponse {
        simplified_problem: problem_text.to_string(),
        skill_tags: vec![operation.to_string()],
        difficulty: 1,
        scene_emoji: "📚".to_string(),
        steps: vec![
            ScaffoldStepAI {
                step_type: "find_objects".to_string(),
                prompt_text: "Who or what is in this problem?".to_string(),
                simplified_text: Some("Read the problem carefully.".to_string()),
                correct_answer: serde_json::json!(["item"]),
                answer_type: "multi_select".to_string(),
                options: Some(serde_json::json!(["item", "person", "thing"])),
                hints: vec!["Look for names or things".to_string()],
                points: 10,
                emoji_hint: Some("👀".to_string()),
            },
            ScaffoldStepAI {
                step_type: "find_numbers".to_string(),
                prompt_text: "What numbers do you see?".to_string(),
                simplified_text: None,
                correct_answer: serde_json::json!([1]),
                answer_type: "multi_select".to_string(),
                options: Some(serde_json::json!([1, 2, 3, 4, 5])),
                hints: vec!["Numbers tell us how many".to_string()],
                points: 10,
                emoji_hint: Some("🔢".to_string()),
            },
            ScaffoldStepAI {
                step_type: "solve".to_string(),
                prompt_text: "What is the answer?".to_string(),
                simplified_text: None,
                correct_answer: serde_json::json!(0),
                answer_type: "number_input".to_string(),
                options: None,
                hints: vec!["Think about the numbers".to_string()],
                points: 20,
                emoji_hint: Some("🎯".to_string()),
            },
        ],
    }
}

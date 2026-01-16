use anyhow::{anyhow, Result};
use crate::models::ExtractedProblem;

pub struct PDFService;

impl PDFService {
    pub fn new() -> Self {
        Self
    }

    pub fn extract_problems(&self, pdf_bytes: &[u8]) -> Result<Vec<ExtractedProblem>> {
        // Try to extract text from PDF
        let text = pdf_extract::extract_text_from_mem(pdf_bytes)
            .map_err(|e| anyhow!("Failed to extract text from PDF: {}", e))?;

        // Parse the extracted text into individual problems
        let problems = self.parse_problems(&text);

        if problems.is_empty() {
            return Err(anyhow!("No problems found in the PDF"));
        }

        Ok(problems)
    }

    fn parse_problems(&self, text: &str) -> Vec<ExtractedProblem> {
        let mut problems = Vec::new();
        let mut current_page = 1;

        // Split by common problem indicators
        let lines: Vec<&str> = text.lines().collect();
        let mut current_problem = String::new();
        let mut in_problem = false;

        for line in lines {
            let trimmed = line.trim();

            // Check for page breaks (common markers)
            if trimmed.contains("Page") && trimmed.chars().any(|c| c.is_ascii_digit()) {
                if let Some(page_num) = self.extract_page_number(trimmed) {
                    current_page = page_num;
                }
                continue;
            }

            // Check for problem number indicators
            let is_problem_start = self.is_problem_start(trimmed);

            if is_problem_start {
                // Save the previous problem if exists
                if !current_problem.is_empty() {
                    let clean_problem = self.clean_problem_text(&current_problem);
                    if self.looks_like_word_problem(&clean_problem) {
                        problems.push(ExtractedProblem {
                            text: clean_problem,
                            page_number: current_page,
                            confidence: 0.8,
                        });
                    }
                }
                current_problem = self.strip_problem_number(trimmed).to_string();
                in_problem = true;
            } else if in_problem && !trimmed.is_empty() {
                // Continue adding to current problem
                current_problem.push(' ');
                current_problem.push_str(trimmed);
            }

            // Check if this line ends a problem (contains a question mark)
            if current_problem.contains('?') && !trimmed.ends_with('?') && !trimmed.is_empty() {
                let clean_problem = self.clean_problem_text(&current_problem);
                if self.looks_like_word_problem(&clean_problem) {
                    problems.push(ExtractedProblem {
                        text: clean_problem,
                        page_number: current_page,
                        confidence: 0.85,
                    });
                }
                current_problem.clear();
                in_problem = false;
            }
        }

        // Don't forget the last problem
        if !current_problem.is_empty() {
            let clean_problem = self.clean_problem_text(&current_problem);
            if self.looks_like_word_problem(&clean_problem) {
                problems.push(ExtractedProblem {
                    text: clean_problem,
                    page_number: current_page,
                    confidence: 0.75,
                });
            }
        }

        // If no problems found with the structured approach, try a simpler split
        if problems.is_empty() {
            problems = self.fallback_extraction(text);
        }

        problems
    }

    fn is_problem_start(&self, line: &str) -> bool {
        // Check for numbered problems: "1.", "1)", "1:", "#1", etc.
        let patterns = [
            |s: &str| {
                s.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .count() > 0
                    && s.chars()
                        .skip_while(|c| c.is_ascii_digit())
                        .next()
                        .map(|c| c == '.' || c == ')' || c == ':')
                        .unwrap_or(false)
            },
            |s: &str| s.starts_with('#') && s.chars().nth(1).map(|c| c.is_ascii_digit()).unwrap_or(false),
            |s: &str| s.to_lowercase().starts_with("problem"),
            |s: &str| s.to_lowercase().starts_with("question"),
        ];

        patterns.iter().any(|p| p(line))
    }

    fn strip_problem_number<'a>(&self, line: &'a str) -> &'a str {
        let trimmed = line.trim();

        // Skip leading digits and punctuation
        let skip_count = trimmed
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == ')' || *c == ':' || *c == '#' || *c == ' ')
            .count();

        trimmed[skip_count..].trim()
    }

    fn extract_page_number(&self, line: &str) -> Option<i32> {
        let digits: String = line.chars().filter(|c| c.is_ascii_digit()).collect();
        digits.parse().ok()
    }

    fn clean_problem_text(&self, text: &str) -> String {
        text.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string()
    }

    fn looks_like_word_problem(&self, text: &str) -> bool {
        // Check if text looks like a math word problem
        let has_numbers = text.chars().any(|c| c.is_ascii_digit());
        let has_question = text.contains('?') || text.to_lowercase().contains("how many")
            || text.to_lowercase().contains("how much")
            || text.to_lowercase().contains("what is");
        let min_length = text.len() >= 20;
        let has_math_keywords = text.to_lowercase().contains("total")
            || text.to_lowercase().contains("left")
            || text.to_lowercase().contains("more")
            || text.to_lowercase().contains("less")
            || text.to_lowercase().contains("each")
            || text.to_lowercase().contains("share")
            || text.to_lowercase().contains("gave")
            || text.to_lowercase().contains("had");

        has_numbers && (has_question || has_math_keywords) && min_length
    }

    fn fallback_extraction(&self, text: &str) -> Vec<ExtractedProblem> {
        // Simple fallback: split by sentences ending with question marks
        let mut problems = Vec::new();
        let mut current = String::new();

        for c in text.chars() {
            current.push(c);
            if c == '?' {
                let trimmed = self.clean_problem_text(&current);
                if self.looks_like_word_problem(&trimmed) {
                    problems.push(ExtractedProblem {
                        text: trimmed,
                        page_number: 1,
                        confidence: 0.6,
                    });
                }
                current.clear();
            }
        }

        problems
    }
}

impl Default for PDFService {
    fn default() -> Self {
        Self::new()
    }
}

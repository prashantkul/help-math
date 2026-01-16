use serde_json::Value;

pub struct GradingService;

impl GradingService {
    pub fn new() -> Self {
        Self
    }

    /// Calculate points based on attempt number
    /// First attempt: 100% of points
    /// Second attempt: 75% of points
    /// Third attempt: 50% of points
    /// Fourth+ attempt: 25% of points
    pub fn calculate_step_points(&self, base_points: i32, attempt_number: i32) -> i32 {
        match attempt_number {
            1 => base_points,
            2 => (base_points * 3) / 4,
            3 => base_points / 2,
            _ => base_points / 4,
        }
    }

    /// Calculate stars based on performance
    /// 3 stars: 90%+ accuracy with avg attempts <= 1.2
    /// 2 stars: 70%+ accuracy
    /// 1 star: Completed (always at least 1 star for finishing)
    pub fn calculate_stars(
        &self,
        total_earned: i32,
        total_possible: i32,
        total_attempts: i32,
        total_steps: i32,
    ) -> i32 {
        if total_possible == 0 || total_steps == 0 {
            return 1;
        }

        let accuracy = total_earned as f32 / total_possible as f32;
        let avg_attempts = total_attempts as f32 / total_steps as f32;

        if accuracy >= 0.9 && avg_attempts <= 1.2 {
            3
        } else if accuracy >= 0.7 {
            2
        } else {
            1
        }
    }

    /// Check if the given answer matches the correct answer
    pub fn check_answer(&self, correct: &Value, given: &Value, answer_type: &str) -> bool {
        match answer_type {
            "number_input" => self.check_number_answer(correct, given),
            "multiple_choice" => self.check_single_choice_answer(correct, given),
            "multi_select" => self.check_multi_select_answer(correct, given),
            "equation_builder" => self.check_equation_answer(correct, given),
            "drag_drop" => self.check_drag_drop_answer(correct, given),
            _ => false,
        }
    }

    fn check_number_answer(&self, correct: &Value, given: &Value) -> bool {
        match (correct.as_i64(), given.as_i64()) {
            (Some(c), Some(g)) => c == g,
            _ => {
                // Try as float
                match (correct.as_f64(), given.as_f64()) {
                    (Some(c), Some(g)) => (c - g).abs() < 0.001,
                    _ => false,
                }
            }
        }
    }

    fn check_single_choice_answer(&self, correct: &Value, given: &Value) -> bool {
        match (correct.as_str(), given.as_str()) {
            (Some(c), Some(g)) => c.to_lowercase() == g.to_lowercase(),
            _ => correct == given,
        }
    }

    fn check_multi_select_answer(&self, correct: &Value, given: &Value) -> bool {
        let correct_arr = match correct.as_array() {
            Some(arr) => arr,
            None => return false,
        };

        let given_arr = match given.as_array() {
            Some(arr) => arr,
            None => return false,
        };

        if correct_arr.len() != given_arr.len() {
            return false;
        }

        // Convert to comparable format
        let mut correct_set: Vec<String> = correct_arr
            .iter()
            .map(|v| self.value_to_comparable_string(v))
            .collect();
        let mut given_set: Vec<String> = given_arr
            .iter()
            .map(|v| self.value_to_comparable_string(v))
            .collect();

        correct_set.sort();
        given_set.sort();

        correct_set == given_set
    }

    fn check_equation_answer(&self, correct: &Value, given: &Value) -> bool {
        // Equation format: {"left": number, "operator": string, "right": number}
        let correct_obj = match correct.as_object() {
            Some(obj) => obj,
            None => return false,
        };

        let given_obj = match given.as_object() {
            Some(obj) => obj,
            None => return false,
        };

        let left_match = correct_obj.get("left") == given_obj.get("left");
        let right_match = correct_obj.get("right") == given_obj.get("right");
        let op_match = correct_obj.get("operator") == given_obj.get("operator");

        left_match && right_match && op_match
    }

    fn check_drag_drop_answer(&self, correct: &Value, given: &Value) -> bool {
        // For drag and drop, we expect the same structure
        correct == given
    }

    fn value_to_comparable_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.to_lowercase(),
            Value::Number(n) => n.to_string(),
            _ => value.to_string().to_lowercase(),
        }
    }

    /// Get a hint based on the attempt number
    pub fn get_hint(&self, hints: &[String], attempt_number: i32) -> Option<String> {
        if hints.is_empty() {
            return None;
        }

        // Return hints based on attempt number (0-indexed for hints)
        let hint_index = (attempt_number - 1) as usize;
        if hint_index < hints.len() {
            Some(hints[hint_index].clone())
        } else {
            // Return last hint if we've exceeded the hint count
            hints.last().cloned()
        }
    }
}

impl Default for GradingService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_calculate_step_points() {
        let grading = GradingService::new();

        assert_eq!(grading.calculate_step_points(100, 1), 100);
        assert_eq!(grading.calculate_step_points(100, 2), 75);
        assert_eq!(grading.calculate_step_points(100, 3), 50);
        assert_eq!(grading.calculate_step_points(100, 4), 25);
        assert_eq!(grading.calculate_step_points(100, 10), 25);
    }

    #[test]
    fn test_calculate_stars() {
        let grading = GradingService::new();

        // Perfect performance
        assert_eq!(grading.calculate_stars(100, 100, 6, 6), 3);

        // Good performance
        assert_eq!(grading.calculate_stars(75, 100, 8, 6), 2);

        // Completed but struggled
        assert_eq!(grading.calculate_stars(50, 100, 15, 6), 1);
    }

    #[test]
    fn test_check_number_answer() {
        let grading = GradingService::new();

        assert!(grading.check_answer(&json!(7), &json!(7), "number_input"));
        assert!(!grading.check_answer(&json!(7), &json!(8), "number_input"));
    }

    #[test]
    fn test_check_multi_select() {
        let grading = GradingService::new();

        assert!(grading.check_answer(
            &json!(["apple", "banana"]),
            &json!(["banana", "apple"]),
            "multi_select"
        ));

        assert!(!grading.check_answer(
            &json!(["apple", "banana"]),
            &json!(["apple"]),
            "multi_select"
        ));
    }

    #[test]
    fn test_check_equation() {
        let grading = GradingService::new();

        assert!(grading.check_answer(
            &json!({"left": 12, "operator": "-", "right": 5}),
            &json!({"left": 12, "operator": "-", "right": 5}),
            "equation_builder"
        ));

        assert!(!grading.check_answer(
            &json!({"left": 12, "operator": "-", "right": 5}),
            &json!({"left": 12, "operator": "+", "right": 5}),
            "equation_builder"
        ));
    }
}

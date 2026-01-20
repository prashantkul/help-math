use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumIndex {
    pub modules: Vec<ModuleSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModuleSummary {
    pub id: String,
    pub name: String,
    pub title: String,
    pub grade: i32,
    pub lesson_count: i32,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumModule {
    pub id: String,
    pub name: String,
    pub title: String,
    pub topics: Vec<Topic>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Topic {
    pub id: String,
    pub code: String,
    pub title: String,
    pub lessons: Vec<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumLesson {
    pub lesson_number: i32,
    pub topic: String,
    pub objective: String,
    pub problems: Vec<CurriculumProblem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumProblem {
    pub id: String,
    pub number: String,
    pub text: String,
    #[serde(rename = "type")]
    pub problem_type: String,
    pub visual_model: Option<String>,
    pub answer: Option<serde_json::Value>,
    pub skills: Option<Vec<String>>,
}

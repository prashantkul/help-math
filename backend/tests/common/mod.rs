//! Test utilities and helpers for backend integration tests

use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use serde_json::Value;
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tower::ServiceExt;

// Re-export for tests
pub use axum_test::TestServer;

/// Test configuration
pub struct TestConfig {
    pub jwt_secret: String,
    pub anthropic_api_key: String,
}

impl Default for TestConfig {
    fn default() -> Self {
        Self {
            jwt_secret: "test-jwt-secret-key-for-testing".to_string(),
            anthropic_api_key: "".to_string(), // Empty for tests
        }
    }
}

/// Create a test database with fresh schema
pub async fn create_test_db() -> sqlx::SqlitePool {
    // Use in-memory database for tests
    let db = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("Failed to create test database");

    // Run migrations
    let schema = include_str!("../../migrations/001_initial_schema.sql");
    let modules = include_str!("../../migrations/002_modules_lessons.sql");

    for migration in [schema, modules] {
        for statement in migration.split(';').filter(|s| !s.trim().is_empty()) {
            sqlx::query(statement)
                .execute(&db)
                .await
                .ok();
        }
    }

    db
}

/// Create test app state
pub async fn create_test_state() -> math_scaffold_backend::AppState {
    let config = TestConfig::default();
    let db = create_test_db().await;

    math_scaffold_backend::AppState {
        db,
        auth_service: Arc::new(
            math_scaffold_backend::services::AuthService::new(config.jwt_secret)
        ),
        ai_service: Arc::new(
            math_scaffold_backend::services::AIService::new(config.anthropic_api_key)
        ),
        grading_service: Arc::new(
            math_scaffold_backend::services::GradingService::new()
        ),
    }
}

/// Test fixtures for commonly used test data
pub mod fixtures {
    pub const TEACHER_EMAIL: &str = "test@teacher.com";
    pub const TEACHER_PASSWORD: &str = "password123";
    pub const TEACHER_NAME: &str = "Test Teacher";

    pub const STUDENT_NAME: &str = "Test Student";
    pub const STUDENT_PASSCODE: &str = "bear-1234";

    pub const CLASS_NAME: &str = "Test Math Class";

    pub const PROBLEM_TEXT: &str = "Maria has 5 apples. She gives 2 to her friend. How many apples does Maria have left?";
}

/// Helper to extract JSON from response body
pub async fn response_json(response: axum::response::Response) -> Value {
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("Failed to read response body");
    serde_json::from_slice(&body_bytes).expect("Failed to parse JSON")
}

/// Helper struct for making authenticated requests
pub struct TestClient {
    pub teacher_token: Option<String>,
    pub student_token: Option<String>,
}

impl TestClient {
    pub fn new() -> Self {
        Self {
            teacher_token: None,
            student_token: None,
        }
    }

    pub fn with_teacher_token(mut self, token: String) -> Self {
        self.teacher_token = Some(token);
        self
    }

    pub fn with_student_token(mut self, token: String) -> Self {
        self.student_token = Some(token);
        self
    }

    pub fn auth_header(&self, is_teacher: bool) -> Option<String> {
        let token = if is_teacher {
            self.teacher_token.as_ref()
        } else {
            self.student_token.as_ref()
        };
        token.map(|t| format!("Bearer {}", t))
    }
}

/// Assertions helpers
pub fn assert_status(response: &axum::response::Response, expected: StatusCode) {
    assert_eq!(
        response.status(),
        expected,
        "Expected status {} but got {}",
        expected,
        response.status()
    );
}

pub fn assert_json_has_key(json: &Value, key: &str) {
    assert!(
        json.get(key).is_some(),
        "Expected JSON to have key '{}', but it was missing. JSON: {}",
        key,
        json
    );
}

pub fn assert_json_string_eq(json: &Value, key: &str, expected: &str) {
    let actual = json
        .get(key)
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("Key '{}' not found or not a string in JSON: {}", key, json));
    assert_eq!(
        actual, expected,
        "Expected '{}' to be '{}' but got '{}'",
        key, expected, actual
    );
}

/// Seed test data into the database
pub async fn seed_test_teacher(db: &sqlx::SqlitePool) -> (String, String) {
    let id = uuid::Uuid::new_v4().to_string();
    let password_hash = bcrypt::hash(fixtures::TEACHER_PASSWORD, 4).unwrap();

    sqlx::query(
        "INSERT INTO teachers (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(fixtures::TEACHER_EMAIL)
    .bind(&password_hash)
    .bind(fixtures::TEACHER_NAME)
    .execute(db)
    .await
    .expect("Failed to seed teacher");

    (id, fixtures::TEACHER_EMAIL.to_string())
}

pub async fn seed_test_class(db: &sqlx::SqlitePool, teacher_id: &str) -> (String, String) {
    let id = uuid::Uuid::new_v4().to_string();
    let join_code = "TEST01";

    sqlx::query(
        "INSERT INTO classes (id, teacher_id, name, join_code, settings) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(teacher_id)
    .bind(fixtures::CLASS_NAME)
    .bind(join_code)
    .bind(r#"{"ell_level": 2, "show_emojis": true}"#)
    .execute(db)
    .await
    .expect("Failed to seed class");

    (id, join_code.to_string())
}

pub async fn seed_test_student(db: &sqlx::SqlitePool, class_id: &str) -> (String, String) {
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO students (id, name, class_id, passcode, avatar, total_points) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(fixtures::STUDENT_NAME)
    .bind(class_id)
    .bind(fixtures::STUDENT_PASSCODE)
    .bind("bear")
    .bind(0)
    .execute(db)
    .await
    .expect("Failed to seed student");

    (id, fixtures::STUDENT_PASSCODE.to_string())
}

pub async fn seed_test_problem(db: &sqlx::SqlitePool, class_id: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO problems (id, class_id, original_text, skill_tags, difficulty, is_published)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(class_id)
    .bind(fixtures::PROBLEM_TEXT)
    .bind(r#"["subtraction"]"#)
    .bind(1)
    .bind(false)
    .execute(db)
    .await
    .expect("Failed to seed problem");

    id
}

/// Full test setup that creates db, seeds data, and returns all IDs
pub async fn setup_test_environment(db: &sqlx::SqlitePool) -> TestEnvironment {
    let (teacher_id, teacher_email) = seed_test_teacher(db).await;
    let (class_id, join_code) = seed_test_class(db, &teacher_id).await;
    let (student_id, student_passcode) = seed_test_student(db, &class_id).await;
    let problem_id = seed_test_problem(db, &class_id).await;

    TestEnvironment {
        teacher_id,
        teacher_email,
        class_id,
        join_code,
        student_id,
        student_passcode,
        problem_id,
    }
}

pub struct TestEnvironment {
    pub teacher_id: String,
    pub teacher_email: String,
    pub class_id: String,
    pub join_code: String,
    pub student_id: String,
    pub student_passcode: String,
    pub problem_id: String,
}

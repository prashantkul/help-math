//! Authentication API integration tests

mod common;

use axum_test::TestServer;
use serde_json::json;

use common::fixtures;

/// Helper to create test server
async fn create_server() -> TestServer {
    let state = common::create_test_state().await;

    // Build the router (simplified version for testing)
    let app = axum::Router::new()
        .route("/api/auth/teacher/register", axum::routing::post(math_scaffold_backend::routes::register_teacher))
        .route("/api/auth/teacher/login", axum::routing::post(math_scaffold_backend::routes::login_teacher))
        .route("/api/auth/student/join", axum::routing::post(math_scaffold_backend::routes::student_join))
        .with_state(state);

    TestServer::new(app).unwrap()
}

#[tokio::test]
async fn test_teacher_registration_success() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "new@teacher.com",
            "password": "password123",
            "name": "New Teacher"
        }))
        .await;

    response.assert_status_ok();

    let body = response.json::<serde_json::Value>();
    assert!(body.get("token").is_some());
    assert!(body.get("teacher").is_some());

    let teacher = body.get("teacher").unwrap();
    assert_eq!(teacher.get("email").unwrap().as_str().unwrap(), "new@teacher.com");
    assert_eq!(teacher.get("name").unwrap().as_str().unwrap(), "New Teacher");
}

#[tokio::test]
async fn test_teacher_registration_invalid_email() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "invalid-email",
            "password": "password123",
            "name": "Test Teacher"
        }))
        .await;

    response.assert_status_bad_request();

    let body = response.json::<serde_json::Value>();
    assert!(body.get("error").unwrap().as_str().unwrap().contains("email"));
}

#[tokio::test]
async fn test_teacher_registration_short_password() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "test@teacher.com",
            "password": "123",
            "name": "Test Teacher"
        }))
        .await;

    response.assert_status_bad_request();

    let body = response.json::<serde_json::Value>();
    assert!(body.get("error").unwrap().as_str().unwrap().contains("Password"));
}

#[tokio::test]
async fn test_teacher_registration_duplicate_email() {
    let server = create_server().await;

    // First registration
    server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "duplicate@teacher.com",
            "password": "password123",
            "name": "First Teacher"
        }))
        .await
        .assert_status_ok();

    // Second registration with same email
    let response = server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "duplicate@teacher.com",
            "password": "password123",
            "name": "Second Teacher"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CONFLICT);

    let body = response.json::<serde_json::Value>();
    assert!(body.get("error").unwrap().as_str().unwrap().contains("already"));
}

#[tokio::test]
async fn test_teacher_login_success() {
    let server = create_server().await;

    // First register
    server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": fixtures::TEACHER_EMAIL,
            "password": fixtures::TEACHER_PASSWORD,
            "name": fixtures::TEACHER_NAME
        }))
        .await
        .assert_status_ok();

    // Then login
    let response = server
        .post("/api/auth/teacher/login")
        .json(&json!({
            "email": fixtures::TEACHER_EMAIL,
            "password": fixtures::TEACHER_PASSWORD
        }))
        .await;

    response.assert_status_ok();

    let body = response.json::<serde_json::Value>();
    assert!(body.get("token").is_some());
    assert!(body.get("teacher").is_some());
}

#[tokio::test]
async fn test_teacher_login_wrong_password() {
    let server = create_server().await;

    // First register
    server
        .post("/api/auth/teacher/register")
        .json(&json!({
            "email": "login@teacher.com",
            "password": "correct-password",
            "name": "Test Teacher"
        }))
        .await
        .assert_status_ok();

    // Login with wrong password
    let response = server
        .post("/api/auth/teacher/login")
        .json(&json!({
            "email": "login@teacher.com",
            "password": "wrong-password"
        }))
        .await;

    response.assert_status_unauthorized();
}

#[tokio::test]
async fn test_teacher_login_nonexistent_email() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/teacher/login")
        .json(&json!({
            "email": "nonexistent@teacher.com",
            "password": "password123"
        }))
        .await;

    response.assert_status_unauthorized();
}

#[tokio::test]
async fn test_student_join_invalid_class_code() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/student/join")
        .json(&json!({
            "class_code": "INVALID",
            "passcode": "bear-1234"
        }))
        .await;

    response.assert_status_not_found();
}

#[tokio::test]
async fn test_student_join_short_class_code() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/student/join")
        .json(&json!({
            "class_code": "ABC",
            "passcode": "bear-1234"
        }))
        .await;

    response.assert_status_bad_request();
}

#[tokio::test]
async fn test_student_join_empty_passcode() {
    let server = create_server().await;

    let response = server
        .post("/api/auth/student/join")
        .json(&json!({
            "class_code": "ABC123",
            "passcode": ""
        }))
        .await;

    response.assert_status_bad_request();
}

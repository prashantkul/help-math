use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;
use uuid::Uuid;

use crate::{
    models::{
        AuthResponse, CreateTeacher, JoinClass, LoginTeacher, Student, StudentJoinResponse,
        StudentResponse, Teacher, TeacherResponse,
    },
    AppState,
};

pub async fn register_teacher(
    State(state): State<AppState>,
    Json(payload): Json<CreateTeacher>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Validate input
    if payload.email.is_empty() || !payload.email.contains('@') {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid email address"})),
        ));
    }

    if payload.password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Password must be at least 6 characters"})),
        ));
    }

    if payload.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Name is required"})),
        ));
    }

    // Hash password
    let password_hash = state
        .auth_service
        .hash_password(&payload.password)
        .map_err(|e| {
            tracing::error!("Failed to hash password: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create account"})),
            )
        })?;

    let id = Uuid::new_v4().to_string();

    // Insert teacher
    sqlx::query(
        "INSERT INTO teachers (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.name)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            (
                StatusCode::CONFLICT,
                Json(json!({"error": "Email already registered"})),
            )
        } else {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create account"})),
            )
        }
    })?;

    // Fetch the created teacher
    let teacher: Teacher = sqlx::query_as(
        "SELECT id, email, password_hash, name, created_at FROM teachers WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create account"})),
        )
    })?;

    // Generate token
    let token = state
        .auth_service
        .generate_teacher_token(&teacher.id)
        .map_err(|e| {
            tracing::error!("Failed to generate token: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create session"})),
            )
        })?;

    Ok(Json(AuthResponse {
        token,
        teacher: Some(TeacherResponse::from(teacher)),
        student: None,
    }))
}

pub async fn login_teacher(
    State(state): State<AppState>,
    Json(payload): Json<LoginTeacher>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Find teacher
    let teacher: Teacher = sqlx::query_as(
        "SELECT id, email, password_hash, name, created_at FROM teachers WHERE email = ?"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Login failed"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid email or password"})),
        )
    })?;

    // Verify password
    let valid = state
        .auth_service
        .verify_password(&payload.password, &teacher.password_hash)
        .map_err(|e| {
            tracing::error!("Password verification error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Login failed"})),
            )
        })?;

    if !valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid email or password"})),
        ));
    }

    // Generate token
    let token = state
        .auth_service
        .generate_teacher_token(&teacher.id)
        .map_err(|e| {
            tracing::error!("Failed to generate token: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Login failed"})),
            )
        })?;

    Ok(Json(AuthResponse {
        token,
        teacher: Some(TeacherResponse::from(teacher)),
        student: None,
    }))
}

pub async fn student_join(
    State(state): State<AppState>,
    Json(payload): Json<JoinClass>,
) -> Result<Json<StudentJoinResponse>, (StatusCode, Json<serde_json::Value>)> {
    if payload.class_code.len() != 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid class code"})),
        ));
    }

    if payload.passcode.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Passcode is required"})),
        ));
    }

    // Find class by join code
    #[derive(sqlx::FromRow)]
    struct ClassInfo {
        id: String,
        name: String,
    }

    let class: ClassInfo = sqlx::query_as(
        "SELECT id, name FROM classes WHERE join_code = ?"
    )
    .bind(payload.class_code.to_uppercase())
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to join class"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found. Check your code!"})),
        )
    })?;

    // Find student by passcode in this class
    let student: Student = sqlx::query_as(
        "SELECT id, name, class_id, external_id, passcode, avatar, total_points, created_at
         FROM students WHERE class_id = ? AND passcode = ?"
    )
    .bind(&class.id)
    .bind(&payload.passcode)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to join class"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid passcode. Ask your teacher for your passcode!"})),
        )
    })?;

    // Generate student token
    let token = state
        .auth_service
        .generate_student_token(&student.id)
        .map_err(|e| {
            tracing::error!("Failed to generate token: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create session"})),
            )
        })?;

    Ok(Json(StudentJoinResponse {
        student: StudentResponse::from(student),
        class_name: class.name,
        session_token: token,
    }))
}

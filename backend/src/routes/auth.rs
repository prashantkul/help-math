use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;

use crate::{
    models::{
        AuthResponse, CreateTeacher, JoinClass, LoginTeacher, StudentJoinResponse,
        StudentResponse, TeacherResponse,
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

    // Insert teacher
    let teacher = sqlx::query_as!(
        crate::models::Teacher,
        r#"
        INSERT INTO teachers (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, password_hash, name, created_at
        "#,
        payload.email,
        password_hash,
        payload.name
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if e.to_string().contains("duplicate key") {
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

    // Generate token
    let token = state
        .auth_service
        .generate_teacher_token(teacher.id)
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
    let teacher = sqlx::query_as!(
        crate::models::Teacher,
        r#"SELECT id, email, password_hash, name, created_at FROM teachers WHERE email = $1"#,
        payload.email
    )
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
        .generate_teacher_token(teacher.id)
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
    if payload.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Name is required"})),
        ));
    }

    if payload.class_code.len() != 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid class code"})),
        ));
    }

    // Find class by join code
    let class = sqlx::query!(
        r#"SELECT id, name FROM classes WHERE join_code = $1"#,
        payload.class_code.to_uppercase()
    )
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

    // Check if student with same name already exists in class
    let existing = sqlx::query!(
        r#"SELECT id, name, class_id, avatar, total_points, created_at FROM students WHERE name = $1 AND class_id = $2"#,
        payload.name,
        class.id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to join class"})),
        )
    })?;

    let student = if let Some(existing) = existing {
        // Return existing student
        crate::models::Student {
            id: existing.id,
            name: existing.name,
            class_id: existing.class_id,
            avatar: existing.avatar,
            total_points: existing.total_points,
            created_at: existing.created_at,
        }
    } else {
        // Create new student
        sqlx::query_as!(
            crate::models::Student,
            r#"
            INSERT INTO students (name, class_id)
            VALUES ($1, $2)
            RETURNING id, name, class_id, avatar, total_points, created_at
            "#,
            payload.name,
            class.id
        )
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to join class"})),
            )
        })?
    };

    // Generate student token
    let token = state
        .auth_service
        .generate_student_token(student.id)
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

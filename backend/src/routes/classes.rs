use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    middleware::TeacherAuth,
    models::{Class, ClassResponse, ClassSettings, CreateClass, StudentResponse, UpdateClassSettings},
    AppState,
};

pub async fn list_classes(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<Vec<ClassResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let classes = sqlx::query_as!(
        Class,
        r#"
        SELECT id, teacher_id, name, join_code, settings as "settings: sqlx::types::Json<ClassSettings>", created_at
        FROM classes
        WHERE teacher_id = $1
        ORDER BY created_at DESC
        "#,
        auth.teacher_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch classes"})),
        )
    })?;

    Ok(Json(classes.into_iter().map(ClassResponse::from).collect()))
}

pub async fn create_class(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateClass>,
) -> Result<Json<ClassResponse>, (StatusCode, Json<serde_json::Value>)> {
    if payload.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Class name is required"})),
        ));
    }

    let class = sqlx::query_as!(
        Class,
        r#"
        INSERT INTO classes (teacher_id, name)
        VALUES ($1, $2)
        RETURNING id, teacher_id, name, join_code, settings as "settings: sqlx::types::Json<ClassSettings>", created_at
        "#,
        auth.teacher_id,
        payload.name
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create class"})),
        )
    })?;

    Ok(Json(ClassResponse::from(class)))
}

pub async fn get_class_students(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<Uuid>,
) -> Result<Json<Vec<StudentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    let class_exists = sqlx::query!(
        r#"SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"#,
        class_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch students"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let students = sqlx::query_as!(
        crate::models::Student,
        r#"
        SELECT id, name, class_id, avatar, total_points, created_at
        FROM students
        WHERE class_id = $1
        ORDER BY name
        "#,
        class_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch students"})),
        )
    })?;

    Ok(Json(students.into_iter().map(StudentResponse::from).collect()))
}

pub async fn remove_student(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((class_id, student_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    let class_exists = sqlx::query!(
        r#"SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"#,
        class_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to remove student"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    sqlx::query!(
        r#"DELETE FROM students WHERE id = $1 AND class_id = $2"#,
        student_id,
        class_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to remove student"})),
        )
    })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_class_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<Uuid>,
    Json(payload): Json<UpdateClassSettings>,
) -> Result<Json<ClassResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Get current settings
    let current = sqlx::query!(
        r#"SELECT settings as "settings: sqlx::types::Json<ClassSettings>" FROM classes WHERE id = $1 AND teacher_id = $2"#,
        class_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update settings"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        )
    })?;

    // Merge settings
    let mut settings = current.settings.0;
    if let Some(ell_level) = payload.ell_level {
        settings.ell_level = ell_level;
    }
    if let Some(show_emojis) = payload.show_emojis {
        settings.show_emojis = show_emojis;
    }
    if let Some(retry_limit) = payload.retry_limit {
        settings.retry_limit = retry_limit;
    }
    if let Some(point_multiplier) = payload.point_multiplier {
        settings.point_multiplier = point_multiplier;
    }

    let class = sqlx::query_as!(
        Class,
        r#"
        UPDATE classes
        SET settings = $1
        WHERE id = $2 AND teacher_id = $3
        RETURNING id, teacher_id, name, join_code, settings as "settings: sqlx::types::Json<ClassSettings>", created_at
        "#,
        sqlx::types::Json(settings) as _,
        class_id,
        auth.teacher_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update settings"})),
        )
    })?;

    Ok(Json(ClassResponse::from(class)))
}

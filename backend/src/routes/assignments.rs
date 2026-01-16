use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    middleware::TeacherAuth,
    models::{Assignment, AssignmentResponse, CreateAssignment},
    AppState,
};

#[derive(Deserialize)]
pub struct ListAssignmentsQuery {
    pub class_id: Uuid,
}

pub async fn list_assignments(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListAssignmentsQuery>,
) -> Result<Json<Vec<AssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    let class_exists = sqlx::query!(
        r#"SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"#,
        query.class_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch assignments"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let assignments = sqlx::query_as!(
        Assignment,
        r#"
        SELECT id, class_id, title, week_start, week_end, problem_ids, created_at
        FROM assignments
        WHERE class_id = $1
        ORDER BY created_at DESC
        "#,
        query.class_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch assignments"})),
        )
    })?;

    Ok(Json(
        assignments
            .into_iter()
            .map(|a| AssignmentResponse::from_assignment(a, None))
            .collect(),
    ))
}

pub async fn create_assignment(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateAssignment>,
) -> Result<Json<AssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    let class_exists = sqlx::query!(
        r#"SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"#,
        payload.class_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create assignment"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    if payload.title.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Title is required"})),
        ));
    }

    if payload.problem_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "At least one problem is required"})),
        ));
    }

    let assignment = sqlx::query_as!(
        Assignment,
        r#"
        INSERT INTO assignments (class_id, title, week_start, week_end, problem_ids)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, class_id, title, week_start, week_end, problem_ids, created_at
        "#,
        payload.class_id,
        payload.title,
        payload.week_start,
        payload.week_end,
        &payload.problem_ids
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create assignment"})),
        )
    })?;

    Ok(Json(AssignmentResponse::from_assignment(assignment, None)))
}

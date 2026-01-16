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
    pub class_id: String,
}

pub async fn list_assignments(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListAssignmentsQuery>,
) -> Result<Json<Vec<AssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&query.class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch assignments"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    let assignments: Vec<Assignment> = sqlx::query_as(
        "SELECT id, class_id, title, week_start, week_end, problem_ids, created_at FROM assignments WHERE class_id = ? ORDER BY created_at DESC"
    )
    .bind(&query.class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch assignments"})))
    })?;

    Ok(Json(assignments.into_iter().map(|a| AssignmentResponse::from_assignment(a, None)).collect()))
}

pub async fn create_assignment(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateAssignment>,
) -> Result<Json<AssignmentResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&payload.class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create assignment"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    if payload.title.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Title is required"}))));
    }

    if payload.problem_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "At least one problem is required"}))));
    }

    let id = Uuid::new_v4().to_string();
    let problem_ids_json = serde_json::to_string(&payload.problem_ids).unwrap();

    sqlx::query(
        "INSERT INTO assignments (id, class_id, title, week_start, week_end, problem_ids) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&payload.class_id)
    .bind(&payload.title)
    .bind(&payload.week_start)
    .bind(&payload.week_end)
    .bind(&problem_ids_json)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create assignment"})))
    })?;

    let assignment: Assignment = sqlx::query_as(
        "SELECT id, class_id, title, week_start, week_end, problem_ids, created_at FROM assignments WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create assignment"})))
    })?;

    Ok(Json(AssignmentResponse::from_assignment(assignment, None)))
}

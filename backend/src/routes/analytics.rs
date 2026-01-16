use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;

use crate::{
    middleware::TeacherAuth,
    models::{ClassAnalytics, StudentAnalytics},
    AppState,
};

pub async fn get_class_analytics(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
) -> Result<Json<ClassAnalytics>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch analytics"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    #[derive(sqlx::FromRow)]
    struct Count { count: i64 }

    let total_students: i64 = sqlx::query_as::<_, Count>(
        "SELECT COUNT(*) as count FROM students WHERE class_id = ?"
    )
    .bind(&class_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.count)
    .unwrap_or(0);

    let total_problems: i64 = sqlx::query_as::<_, Count>(
        "SELECT COUNT(*) as count FROM problems WHERE class_id = ? AND is_published = 1"
    )
    .bind(&class_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.count)
    .unwrap_or(0);

    #[derive(sqlx::FromRow)]
    struct AvgPoints { avg_points: Option<f64> }

    let avg_points = sqlx::query_as::<_, AvgPoints>(
        "SELECT AVG(total_points) as avg_points FROM students WHERE class_id = ?"
    )
    .bind(&class_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.avg_points.unwrap_or(0.0))
    .unwrap_or(0.0);

    Ok(Json(ClassAnalytics {
        class_id: class_id.clone(),
        total_students,
        total_problems,
        average_completion_rate: 0.0,
        average_points_per_student: avg_points,
        step_failure_rates: vec![],
        weekly_progress: vec![],
    }))
}

pub async fn get_student_analytics(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((class_id, student_id)): Path<(String, String)>,
) -> Result<Json<StudentAnalytics>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch analytics"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    #[derive(sqlx::FromRow)]
    struct StudentInfo { name: String, total_points: i32 }

    let student: Option<StudentInfo> = sqlx::query_as(
        "SELECT name, total_points FROM students WHERE id = ? AND class_id = ?"
    )
    .bind(&student_id)
    .bind(&class_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch analytics"})))
    })?;

    let student = student.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Student not found"}))))?;

    #[derive(sqlx::FromRow)]
    struct Count { count: i64 }

    let total_attempted: i64 = sqlx::query_as::<_, Count>(
        "SELECT COUNT(DISTINCT problem_id) as count FROM student_progress WHERE student_id = ?"
    )
    .bind(&student_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.count)
    .unwrap_or(0);

    let total_completed: i64 = sqlx::query_as::<_, Count>(
        "SELECT COUNT(*) as count FROM student_progress WHERE student_id = ? AND is_complete = 1"
    )
    .bind(&student_id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.count)
    .unwrap_or(0);

    Ok(Json(StudentAnalytics {
        student_id: student_id.clone(),
        student_name: student.name,
        total_problems_attempted: total_attempted,
        total_problems_completed: total_completed,
        total_points: student.total_points,
        average_stars: 0.0,
        strengths: vec![],
        areas_for_improvement: vec![],
        recent_activity: vec![],
    }))
}

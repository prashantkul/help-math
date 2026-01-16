use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::TeacherAuth,
    models::{ClassAnalytics, RecentActivity, StepFailureRate, StudentAnalytics, WeeklyProgress},
    AppState,
};

pub async fn get_class_analytics(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<Uuid>,
) -> Result<Json<ClassAnalytics>, (StatusCode, Json<serde_json::Value>)> {
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
            Json(json!({"error": "Failed to fetch analytics"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    // Get counts
    let total_students = sqlx::query!(
        r#"SELECT COUNT(*) as count FROM students WHERE class_id = $1"#,
        class_id
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.count.unwrap_or(0))
    .unwrap_or(0);

    let total_problems = sqlx::query!(
        r#"SELECT COUNT(*) as count FROM problems WHERE class_id = $1 AND is_published = true"#,
        class_id
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.count.unwrap_or(0))
    .unwrap_or(0);

    // Calculate completion rate
    let completion_stats = sqlx::query!(
        r#"
        SELECT
            COUNT(CASE WHEN sp.is_complete THEN 1 END) as completed,
            COUNT(*) as total
        FROM student_progress sp
        JOIN problems p ON sp.problem_id = p.id
        WHERE p.class_id = $1
        "#,
        class_id
    )
    .fetch_one(&state.db)
    .await
    .ok();

    let average_completion_rate = completion_stats
        .map(|s| {
            let total = s.total.unwrap_or(0) as f64;
            if total > 0.0 {
                s.completed.unwrap_or(0) as f64 / total
            } else {
                0.0
            }
        })
        .unwrap_or(0.0);

    // Average points per student
    let avg_points = sqlx::query!(
        r#"SELECT AVG(total_points)::float8 as avg FROM students WHERE class_id = $1"#,
        class_id
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.avg.unwrap_or(0.0))
    .unwrap_or(0.0);

    // Step failure rates
    let failure_rates = sqlx::query!(
        r#"
        SELECT
            ss.step_type,
            COUNT(CASE WHEN NOT sa.is_correct THEN 1 END)::float8 / NULLIF(COUNT(*)::float8, 0) as failure_rate,
            COUNT(*) as total_attempts
        FROM step_attempts sa
        JOIN scaffold_steps ss ON sa.step_id = ss.id
        JOIN problems p ON ss.problem_id = p.id
        WHERE p.class_id = $1
        GROUP BY ss.step_type
        ORDER BY failure_rate DESC
        "#,
        class_id
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|r| StepFailureRate {
                step_type: r.step_type,
                failure_rate: r.failure_rate.unwrap_or(0.0),
                total_attempts: r.total_attempts.unwrap_or(0),
            })
            .collect()
    })
    .unwrap_or_default();

    // Weekly progress (last 8 weeks)
    let weekly_progress = sqlx::query!(
        r#"
        SELECT
            to_char(date_trunc('week', sp.completed_at), 'YYYY-MM-DD') as week,
            COUNT(*) as problems_completed,
            AVG(sp.stars_earned)::float8 as average_stars
        FROM student_progress sp
        JOIN problems p ON sp.problem_id = p.id
        WHERE p.class_id = $1 AND sp.is_complete = true AND sp.completed_at IS NOT NULL
        GROUP BY date_trunc('week', sp.completed_at)
        ORDER BY week DESC
        LIMIT 8
        "#,
        class_id
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|r| WeeklyProgress {
                week: r.week.unwrap_or_default(),
                problems_completed: r.problems_completed.unwrap_or(0),
                average_stars: r.average_stars.unwrap_or(0.0),
            })
            .collect()
    })
    .unwrap_or_default();

    Ok(Json(ClassAnalytics {
        class_id,
        total_students,
        total_problems,
        average_completion_rate,
        average_points_per_student: avg_points,
        step_failure_rates: failure_rates,
        weekly_progress,
    }))
}

pub async fn get_student_analytics(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<StudentAnalytics>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher has access to this student through their class
    let student = sqlx::query!(
        r#"
        SELECT s.id, s.name, s.total_points
        FROM students s
        JOIN classes c ON s.class_id = c.id
        WHERE s.id = $1 AND c.teacher_id = $2
        "#,
        student_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch analytics"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Student not found"})),
        )
    })?;

    // Problem stats
    let problem_stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*) as attempted,
            COUNT(CASE WHEN is_complete THEN 1 END) as completed,
            AVG(stars_earned)::float8 as avg_stars
        FROM student_progress
        WHERE student_id = $1
        "#,
        student_id
    )
    .fetch_one(&state.db)
    .await
    .ok();

    let total_problems_attempted = problem_stats.as_ref().map(|s| s.attempted.unwrap_or(0)).unwrap_or(0);
    let total_problems_completed = problem_stats.as_ref().map(|s| s.completed.unwrap_or(0)).unwrap_or(0);
    let average_stars = problem_stats.as_ref().map(|s| s.avg_stars.unwrap_or(0.0)).unwrap_or(0.0);

    // Strengths (skill tags with highest success rate)
    let strengths: Vec<String> = sqlx::query!(
        r#"
        SELECT DISTINCT unnest(p.skill_tags) as skill
        FROM student_progress sp
        JOIN problems p ON sp.problem_id = p.id
        WHERE sp.student_id = $1 AND sp.stars_earned >= 2
        "#,
        student_id
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| rows.into_iter().filter_map(|r| r.skill).collect())
    .unwrap_or_default();

    // Areas for improvement (skill tags with lower success)
    let areas_for_improvement: Vec<String> = sqlx::query!(
        r#"
        SELECT DISTINCT unnest(p.skill_tags) as skill
        FROM student_progress sp
        JOIN problems p ON sp.problem_id = p.id
        WHERE sp.student_id = $1 AND sp.stars_earned = 1
        "#,
        student_id
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| rows.into_iter().filter_map(|r| r.skill).collect())
    .unwrap_or_default();

    // Recent activity
    let recent_activity: Vec<RecentActivity> = sqlx::query!(
        r#"
        SELECT
            sp.problem_id,
            p.original_text,
            sp.completed_at,
            sp.stars_earned,
            sp.total_points_earned
        FROM student_progress sp
        JOIN problems p ON sp.problem_id = p.id
        WHERE sp.student_id = $1 AND sp.is_complete = true
        ORDER BY sp.completed_at DESC
        LIMIT 10
        "#,
        student_id
    )
    .fetch_all(&state.db)
    .await
    .map(|rows| {
        rows.into_iter()
            .filter_map(|r| {
                r.completed_at.map(|completed_at| RecentActivity {
                    problem_id: r.problem_id,
                    problem_text: r.original_text.chars().take(100).collect::<String>() + "...",
                    completed_at,
                    stars_earned: r.stars_earned,
                    points_earned: r.total_points_earned,
                })
            })
            .collect()
    })
    .unwrap_or_default();

    Ok(Json(StudentAnalytics {
        student_id,
        student_name: student.name,
        total_problems_attempted,
        total_problems_completed,
        total_points: student.total_points,
        average_stars,
        strengths,
        areas_for_improvement,
        recent_activity,
    }))
}

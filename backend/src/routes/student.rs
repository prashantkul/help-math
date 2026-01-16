use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::StudentAuth,
    models::{
        Assignment, AssignmentResponse, AttemptResult, Problem, ProblemResponse, ScaffoldStep,
        StudentOverallProgress, StudentProgress, StudentProgressResponse, StudentResponse,
        SubmitAttempt, UpdateStudentAvatar,
    },
    AppState,
};

pub async fn get_student_assignments(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
) -> Result<Json<Vec<AssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Get student's class
    let student = sqlx::query!(
        r#"SELECT class_id FROM students WHERE id = $1"#,
        auth.student_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch assignments"})),
        )
    })?;

    let assignments = sqlx::query_as!(
        Assignment,
        r#"
        SELECT id, class_id, title, week_start, week_end, problem_ids, created_at
        FROM assignments
        WHERE class_id = $1
        ORDER BY created_at DESC
        "#,
        student.class_id
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

    // Fetch problems for each assignment
    let mut responses = Vec::new();
    for assignment in assignments {
        let problems = sqlx::query_as!(
            Problem,
            r#"
            SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at
            FROM problems
            WHERE id = ANY($1) AND is_published = true
            "#,
            &assignment.problem_ids
        )
        .fetch_all(&state.db)
        .await
        .ok()
        .map(|problems| {
            problems.into_iter().map(|p| ProblemResponse::from_problem(p, None)).collect()
        });

        responses.push(AssignmentResponse::from_assignment(assignment, problems));
    }

    Ok(Json(responses))
}

pub async fn get_student_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Path(problem_id): Path<Uuid>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify student has access to this problem through their class
    let problem = sqlx::query_as!(
        Problem,
        r#"
        SELECT p.id, p.class_id, p.original_text, p.simplified_text, p.skill_tags, p.difficulty, p.is_published, p.week_number, p.scene_emoji, p.created_at
        FROM problems p
        JOIN students s ON p.class_id = s.class_id
        WHERE p.id = $1 AND s.id = $2 AND p.is_published = true
        "#,
        problem_id,
        auth.student_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch problem"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Problem not found"})),
        )
    })?;

    let steps = sqlx::query_as!(
        ScaffoldStep,
        r#"
        SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text,
               correct_answer as "correct_answer: sqlx::types::Json<serde_json::Value>",
               answer_type, options as "options: sqlx::types::Json<serde_json::Value>",
               hints, points, emoji_hint, created_at
        FROM scaffold_steps
        WHERE problem_id = $1
        ORDER BY step_order
        "#,
        problem_id
    )
    .fetch_all(&state.db)
    .await
    .ok();

    // Create or get progress
    sqlx::query!(
        r#"
        INSERT INTO student_progress (student_id, problem_id)
        VALUES ($1, $2)
        ON CONFLICT (student_id, problem_id) DO NOTHING
        "#,
        auth.student_id,
        problem_id
    )
    .execute(&state.db)
    .await
    .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn submit_step_attempt(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Path(problem_id): Path<Uuid>,
    Json(payload): Json<SubmitAttempt>,
) -> Result<Json<AttemptResult>, (StatusCode, Json<serde_json::Value>)> {
    // Get the step
    let step = sqlx::query_as!(
        ScaffoldStep,
        r#"
        SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text,
               correct_answer as "correct_answer: sqlx::types::Json<serde_json::Value>",
               answer_type, options as "options: sqlx::types::Json<serde_json::Value>",
               hints, points, emoji_hint, created_at
        FROM scaffold_steps
        WHERE id = $1 AND problem_id = $2
        "#,
        payload.step_id,
        problem_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to submit attempt"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Step not found"})),
        )
    })?;

    // Get or create progress
    let progress = sqlx::query_as!(
        StudentProgress,
        r#"
        INSERT INTO student_progress (student_id, problem_id)
        VALUES ($1, $2)
        ON CONFLICT (student_id, problem_id)
        DO UPDATE SET student_id = EXCLUDED.student_id
        RETURNING id, student_id, problem_id, current_step, is_complete, total_points_earned, stars_earned, started_at, completed_at
        "#,
        auth.student_id,
        problem_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to submit attempt"})),
        )
    })?;

    // Count previous attempts for this step
    let attempt_count = sqlx::query!(
        r#"SELECT COUNT(*) as count FROM step_attempts WHERE student_id = $1 AND step_id = $2 AND progress_id = $3"#,
        auth.student_id,
        payload.step_id,
        progress.id
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.count.unwrap_or(0) as i32)
    .unwrap_or(0);

    let attempt_number = attempt_count + 1;

    // Check answer
    let is_correct = state
        .grading_service
        .check_answer(&step.correct_answer.0, &payload.answer, &step.answer_type);

    let points_earned = if is_correct {
        state
            .grading_service
            .calculate_step_points(step.points, attempt_number)
    } else {
        0
    };

    // Record attempt
    sqlx::query!(
        r#"
        INSERT INTO step_attempts (student_id, step_id, progress_id, attempt_number, answer_given, is_correct, points_earned, time_spent_seconds)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        auth.student_id,
        payload.step_id,
        progress.id,
        attempt_number,
        serde_json::to_value(&payload.answer).unwrap(),
        is_correct,
        points_earned,
        payload.time_spent_seconds
    )
    .execute(&state.db)
    .await
    .ok();

    // Update progress if correct
    if is_correct {
        // Get total steps
        let total_steps = sqlx::query!(
            r#"SELECT COUNT(*) as count FROM scaffold_steps WHERE problem_id = $1"#,
            problem_id
        )
        .fetch_one(&state.db)
        .await
        .map(|r| r.count.unwrap_or(0) as i32)
        .unwrap_or(0);

        let new_step = step.step_order + 1;
        let is_complete = new_step >= total_steps;

        // Calculate stars if complete
        let (stars, total_points) = if is_complete {
            let total_points = progress.total_points_earned + points_earned;
            let total_possible: i32 = sqlx::query!(
                r#"SELECT COALESCE(SUM(points), 0)::int as total FROM scaffold_steps WHERE problem_id = $1"#,
                problem_id
            )
            .fetch_one(&state.db)
            .await
            .map(|r| r.total.unwrap_or(0))
            .unwrap_or(0);

            let total_attempts: i32 = sqlx::query!(
                r#"SELECT COUNT(*)::int as count FROM step_attempts WHERE progress_id = $1"#,
                progress.id
            )
            .fetch_one(&state.db)
            .await
            .map(|r| r.count.unwrap_or(0))
            .unwrap_or(0);

            let stars = state.grading_service.calculate_stars(
                total_points,
                total_possible,
                total_attempts,
                total_steps,
            );

            (stars, total_points)
        } else {
            (0, progress.total_points_earned + points_earned)
        };

        sqlx::query!(
            r#"
            UPDATE student_progress
            SET current_step = $1, total_points_earned = $2, is_complete = $3, stars_earned = $4, completed_at = $5
            WHERE id = $6
            "#,
            new_step,
            total_points,
            is_complete,
            stars,
            if is_complete { Some(Utc::now()) } else { None },
            progress.id
        )
        .execute(&state.db)
        .await
        .ok();

        // Update student total points
        if points_earned > 0 {
            sqlx::query!(
                r#"UPDATE students SET total_points = total_points + $1 WHERE id = $2"#,
                points_earned,
                auth.student_id
            )
            .execute(&state.db)
            .await
            .ok();
        }
    }

    // Get hint if wrong
    let hint = if !is_correct {
        state
            .grading_service
            .get_hint(&step.hints, attempt_number)
    } else {
        None
    };

    Ok(Json(AttemptResult {
        is_correct,
        points_earned,
        hint,
    }))
}

pub async fn get_student_progress(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
) -> Result<Json<StudentOverallProgress>, (StatusCode, Json<serde_json::Value>)> {
    let progress = sqlx::query_as!(
        StudentProgress,
        r#"
        SELECT id, student_id, problem_id, current_step, is_complete, total_points_earned, stars_earned, started_at, completed_at
        FROM student_progress
        WHERE student_id = $1
        "#,
        auth.student_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch progress"})),
        )
    })?;

    let student = sqlx::query!(
        r#"SELECT total_points FROM students WHERE id = $1"#,
        auth.student_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch progress"})),
        )
    })?;

    Ok(Json(StudentOverallProgress {
        progress: progress
            .into_iter()
            .map(StudentProgressResponse::from)
            .collect(),
        total_points: student.total_points,
    }))
}

pub async fn get_student_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
) -> Result<Json<StudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let student = sqlx::query_as!(
        crate::models::Student,
        r#"
        SELECT id, name, class_id, avatar, total_points, created_at
        FROM students
        WHERE id = $1
        "#,
        auth.student_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch profile"})),
        )
    })?;

    Ok(Json(StudentResponse::from(student)))
}

pub async fn update_student_avatar(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Json(payload): Json<UpdateStudentAvatar>,
) -> Result<Json<StudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let student = sqlx::query_as!(
        crate::models::Student,
        r#"
        UPDATE students
        SET avatar = $1
        WHERE id = $2
        RETURNING id, name, class_id, avatar, total_points, created_at
        "#,
        payload.avatar,
        auth.student_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update avatar"})),
        )
    })?;

    Ok(Json(StudentResponse::from(student)))
}

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::StudentAuth,
    models::{
        Assignment, AssignmentResponse, AttemptResult, Problem, ProblemResponse, ScaffoldStep,
        Student, StudentOverallProgress, StudentProgress, StudentProgressResponse, StudentResponse,
        SubmitAttempt, UpdateStudentAvatar,
    },
    AppState,
};

pub async fn get_student_assignments(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
) -> Result<Json<Vec<AssignmentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct StudentInfo { class_id: String }

    let student: StudentInfo = sqlx::query_as("SELECT class_id FROM students WHERE id = $1")
        .bind(&auth.student_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch assignments"})))
        })?;

    let assignments: Vec<Assignment> = sqlx::query_as(
        "SELECT id, class_id, title, week_start, week_end, problem_ids::text, created_at FROM assignments WHERE class_id = $1 ORDER BY created_at DESC"
    )
    .bind(&student.class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch assignments"})))
    })?;

    let mut responses = Vec::new();

    // First, add all published problems as a virtual "All Problems" assignment
    let all_published: Vec<Problem> = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, image_url, created_at FROM problems WHERE class_id = $1 AND is_published = true ORDER BY created_at DESC"
    )
    .bind(&student.class_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    if !all_published.is_empty() {
        let problems: Vec<ProblemResponse> = all_published
            .into_iter()
            .map(|p| ProblemResponse::from_problem(p, None))
            .collect();

        // Create a virtual assignment containing all published problems
        let virtual_assignment = Assignment {
            id: "all-problems".to_string(),
            class_id: student.class_id.clone(),
            title: "All Problems".to_string(),
            week_start: None,
            week_end: None,
            problem_ids: "[]".to_string(),
            created_at: chrono::Utc::now(),
        };
        responses.push(AssignmentResponse::from_assignment(virtual_assignment, Some(problems)));
    }

    // Then add explicit assignments
    for assignment in assignments {
        let problem_ids: Vec<String> = serde_json::from_str(&assignment.problem_ids).unwrap_or_default();
        let mut problems = Vec::new();
        for pid in &problem_ids {
            if let Ok(Some(p)) = sqlx::query_as::<_, Problem>(
                "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, image_url, created_at FROM problems WHERE id = $1 AND is_published = true"
            ).bind(pid).fetch_optional(&state.db).await {
                problems.push(ProblemResponse::from_problem(p, None));
            }
        }
        responses.push(AssignmentResponse::from_assignment(assignment, Some(problems)));
    }

    Ok(Json(responses))
}

pub async fn get_student_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Path(problem_id): Path<String>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    let problem: Option<Problem> = sqlx::query_as(
        "SELECT p.id, p.class_id, p.lesson_id, p.original_text, p.simplified_text, p.skill_tags::text, p.difficulty, p.is_published, p.state, p.week_number, p.scene_emoji, p.image_url, p.created_at FROM problems p JOIN students s ON p.class_id = s.class_id WHERE p.id = $1 AND s.id = $2 AND p.is_published = true"
    )
    .bind(&problem_id)
    .bind(&auth.student_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problem"})))
    })?;

    let problem = problem.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))))?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, image_url, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .ok();

    // Create progress if not exists
    let progress_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO student_progress (id, student_id, problem_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
        .bind(&progress_id)
        .bind(&auth.student_id)
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn submit_step_attempt(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Path(problem_id): Path<String>,
    Json(payload): Json<SubmitAttempt>,
) -> Result<Json<AttemptResult>, (StatusCode, Json<serde_json::Value>)> {
    let step: Option<ScaffoldStep> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, image_url, created_at FROM scaffold_steps WHERE id = $1 AND problem_id = $2"
    )
    .bind(&payload.step_id)
    .bind(&problem_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to submit attempt"})))
    })?;

    let step = step.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Step not found"}))))?;

    // Get or create progress
    let progress_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO student_progress (id, student_id, problem_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
        .bind(&progress_id)
        .bind(&auth.student_id)
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .ok();

    let progress: StudentProgress = sqlx::query_as(
        "SELECT id, student_id, problem_id, current_step, is_complete, total_points_earned, stars_earned, started_at, completed_at FROM student_progress WHERE student_id = $1 AND problem_id = $2"
    )
    .bind(&auth.student_id)
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to submit attempt"})))
    })?;

    #[derive(sqlx::FromRow)]
    struct Count { count: i32 }

    let attempt_count: i32 = sqlx::query_as::<_, Count>(
        "SELECT COUNT(*) as count FROM step_attempts WHERE student_id = $1 AND step_id = $2 AND progress_id = $3"
    )
    .bind(&auth.student_id)
    .bind(&payload.step_id)
    .bind(&progress.id)
    .fetch_one(&state.db)
    .await
    .map(|r| r.count)
    .unwrap_or(0);

    let attempt_number = attempt_count + 1;

    // Check answer
    let correct_answer: serde_json::Value = serde_json::from_str(&step.correct_answer).unwrap_or(serde_json::Value::Null);
    let is_correct = state.grading_service.check_answer(&correct_answer, &payload.answer, &step.answer_type);

    let points_earned = if is_correct {
        state.grading_service.calculate_step_points(step.points, attempt_number)
    } else {
        0
    };

    // Record attempt
    let attempt_id = Uuid::new_v4().to_string();
    let answer_json = serde_json::to_string(&payload.answer).unwrap();
    sqlx::query(
        "INSERT INTO step_attempts (id, student_id, step_id, progress_id, attempt_number, answer_given, is_correct, points_earned, time_spent_seconds) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
    )
    .bind(&attempt_id)
    .bind(&auth.student_id)
    .bind(&payload.step_id)
    .bind(&progress.id)
    .bind(attempt_number)
    .bind(&answer_json)
    .bind(is_correct)
    .bind(points_earned)
    .bind(payload.time_spent_seconds)
    .execute(&state.db)
    .await
    .ok();

    // Update progress if correct
    if is_correct {
        let total_steps: i32 = sqlx::query_as::<_, Count>("SELECT COUNT(*) as count FROM scaffold_steps WHERE problem_id = $1")
            .bind(&problem_id)
            .fetch_one(&state.db)
            .await
            .map(|r| r.count)
            .unwrap_or(0);

        let new_step = step.step_order + 1;
        let is_complete = new_step >= total_steps;
        let new_total = progress.total_points_earned + points_earned;

        let stars = if is_complete { 3 } else { 0 }; // Simplified star calculation

        sqlx::query("UPDATE student_progress SET current_step = $1, total_points_earned = $2, is_complete = $3, stars_earned = $4 WHERE id = $5")
            .bind(new_step)
            .bind(new_total)
            .bind(is_complete)
            .bind(stars)
            .bind(&progress.id)
            .execute(&state.db)
            .await
            .ok();

        if points_earned > 0 {
            sqlx::query("UPDATE students SET total_points = total_points + $1 WHERE id = $2")
                .bind(points_earned)
                .bind(&auth.student_id)
                .execute(&state.db)
                .await
                .ok();
        }
    }

    // Get hint if wrong
    let hints: Vec<String> = serde_json::from_str(&step.hints).unwrap_or_default();
    let hint = if !is_correct {
        state.grading_service.get_hint(&hints, attempt_number)
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
    let progress: Vec<StudentProgress> = sqlx::query_as(
        "SELECT id, student_id, problem_id, current_step, is_complete, total_points_earned, stars_earned, started_at, completed_at FROM student_progress WHERE student_id = $1"
    )
    .bind(&auth.student_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch progress"})))
    })?;

    #[derive(sqlx::FromRow)]
    struct Points { total_points: i32 }

    let student: Points = sqlx::query_as("SELECT total_points FROM students WHERE id = $1")
        .bind(&auth.student_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch progress"})))
        })?;

    Ok(Json(StudentOverallProgress {
        progress: progress.into_iter().map(StudentProgressResponse::from).collect(),
        total_points: student.total_points,
    }))
}

pub async fn get_student_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
) -> Result<Json<StudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    let student: Student = sqlx::query_as(
        "SELECT id, name, class_id, external_id, roster_id, notes, passcode, avatar, total_points, created_at FROM students WHERE id = $1"
    )
    .bind(&auth.student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch profile"})))
    })?;

    Ok(Json(StudentResponse::from(student)))
}

pub async fn update_student_avatar(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Json(payload): Json<UpdateStudentAvatar>,
) -> Result<Json<StudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    sqlx::query("UPDATE students SET avatar = $1 WHERE id = $2")
        .bind(&payload.avatar)
        .bind(&auth.student_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update avatar"})))
        })?;

    let student: Student = sqlx::query_as(
        "SELECT id, name, class_id, external_id, roster_id, notes, passcode, avatar, total_points, created_at FROM students WHERE id = $1"
    )
    .bind(&auth.student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update avatar"})))
    })?;

    Ok(Json(StudentResponse::from(student)))
}

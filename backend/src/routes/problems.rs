use axum::{
    extract::{Extension, Multipart, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::TeacherAuth,
    models::{
        CreateProblem, CreateScaffoldStep, GenerateScaffoldRequest, PDFUploadResponse, Problem,
        ProblemResponse, ReorderScaffoldSteps, ScaffoldStep, ScaffoldStepResponse,
        ScaffoldingAIResponse, UpdateProblem, UpdateScaffoldStep,
    },
    services::{generate_fallback_scaffold, PDFService},
    AppState,
};

#[derive(Deserialize)]
pub struct ListProblemsQuery {
    pub class_id: Option<String>,
    pub lesson_id: Option<String>,
}

pub async fn list_problems(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListProblemsQuery>,
) -> Result<Json<Vec<ProblemResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Handle lesson_id query - get problems for a specific lesson
    if let Some(lesson_id) = &query.lesson_id {
        // Verify teacher has access via lesson -> module -> class
        #[derive(sqlx::FromRow)]
        struct LessonInfo { class_id: String }

        let lesson_info: Option<LessonInfo> = sqlx::query_as(
            r#"
            SELECT c.id as class_id
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            JOIN classes c ON m.class_id = c.id
            WHERE l.id = $1 AND (c.teacher_id = $2 OR c.id IN (
                SELECT class_id FROM class_teachers WHERE teacher_id = $3
            ))
            "#
        )
        .bind(lesson_id)
        .bind(&auth.teacher_id)
        .bind(&auth.teacher_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
        })?;

        if lesson_info.is_none() {
            return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Lesson not found or access denied"}))));
        }

        let problems: Vec<Problem> = sqlx::query_as(
            "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE lesson_id = $1 ORDER BY created_at DESC"
        )
        .bind(lesson_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
        })?;

        let mut responses = Vec::new();
        for problem in problems {
            let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
                "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
            )
            .bind(&problem.id)
            .fetch_all(&state.db)
            .await
            .ok();
            responses.push(ProblemResponse::from_problem(problem, steps));
        }

        return Ok(Json(responses));
    }

    // Handle class_id query - get all problems for a class
    let class_id = query.class_id.as_ref().ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Either class_id or lesson_id is required"})))
    })?;

    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"
    )
    .bind(class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    let problems: Vec<Problem> = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE class_id = $1 ORDER BY created_at DESC"
    )
    .bind(class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
    })?;

    let mut responses = Vec::new();
    for problem in problems {
        let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
            "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
        )
        .bind(&problem.id)
        .fetch_all(&state.db)
        .await
        .ok();
        responses.push(ProblemResponse::from_problem(problem, steps));
    }

    Ok(Json(responses))
}

pub async fn get_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    let problem: Option<Problem> = sqlx::query_as(
        "SELECT p.id, p.class_id, p.lesson_id, p.original_text, p.simplified_text, p.skill_tags::text, p.difficulty, p.is_published, p.state, p.week_number, p.scene_emoji, p.created_at FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problem"})))
    })?;

    let problem = problem.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))))?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn create_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateProblem>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Determine class_id - either directly provided or derived from lesson_id
    let (class_id, lesson_id) = if let Some(lesson_id) = &payload.lesson_id {
        // Get class_id from lesson -> module -> class chain
        #[derive(sqlx::FromRow)]
        struct LessonInfo { class_id: String }

        let lesson_info: Option<LessonInfo> = sqlx::query_as(
            r#"
            SELECT c.id as class_id
            FROM lessons l
            JOIN modules m ON l.module_id = m.id
            JOIN classes c ON m.class_id = c.id
            WHERE l.id = $1 AND (c.teacher_id = $2 OR c.id IN (
                SELECT class_id FROM class_teachers WHERE teacher_id = $3
            ))
            "#
        )
        .bind(lesson_id)
        .bind(&auth.teacher_id)
        .bind(&auth.teacher_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
        })?;

        let info = lesson_info.ok_or_else(|| {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Lesson not found or access denied"})))
        })?;

        (info.class_id, Some(lesson_id.clone()))
    } else if let Some(class_id) = &payload.class_id {
        // Use directly provided class_id
        #[derive(sqlx::FromRow)]
        struct ClassExists { id: String }

        let class_exists: Option<ClassExists> = sqlx::query_as(
            "SELECT id FROM classes WHERE id = $1 AND teacher_id = $2"
        )
        .bind(class_id)
        .bind(&auth.teacher_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
        })?;

        if class_exists.is_none() {
            return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
        }

        (class_id.clone(), None)
    } else {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Either class_id or lesson_id is required"}))));
    };

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO problems (id, class_id, lesson_id, original_text, skill_tags, state) VALUES ($1, $2, $3, $4, '[]'::jsonb, 'draft')"
    )
    .bind(&id)
    .bind(&class_id)
    .bind(&lesson_id)
    .bind(&payload.original_text)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
    })?;

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE id = $1"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
    })?;

    Ok(Json(ProblemResponse::from_problem(problem, None)))
}

pub async fn upload_pdf(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    mut multipart: Multipart,
) -> Result<Json<PDFUploadResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut class_id: Option<String> = None;
    let mut pdf_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to process upload"})))
    })? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "class_id" {
            class_id = Some(field.text().await.map_err(|e| {
                tracing::error!("Failed to read class_id: {}", e);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid class_id"})))
            })?);
        } else if name == "file" {
            pdf_bytes = Some(field.bytes().await.map_err(|e| {
                tracing::error!("Failed to read file: {}", e);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read file"})))
            })?.to_vec());
        }
    }

    let class_id = class_id.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "class_id is required"}))))?;
    let pdf_bytes = pdf_bytes.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "PDF file is required"}))))?;

    #[derive(sqlx::FromRow)]
    struct ClassExists { id: String }

    let class_exists: Option<ClassExists> = sqlx::query_as("SELECT id FROM classes WHERE id = $1 AND teacher_id = $2")
        .bind(&class_id)
        .bind(&auth.teacher_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to process upload"})))
        })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    let pdf_service = PDFService::new();
    let extracted = pdf_service.extract_problems(&pdf_bytes).map_err(|e| {
        tracing::error!("PDF extraction error: {}", e);
        (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Failed to extract text from PDF: {}", e)})))
    })?;

    Ok(Json(PDFUploadResponse { extracted_problems: extracted }))
}

pub async fn generate_scaffold(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
    Json(payload): Json<GenerateScaffoldRequest>,
) -> Result<Json<ScaffoldingAIResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ProblemInfo { id: String, original_text: String, lesson_id: Option<String> }

    let problem: Option<ProblemInfo> = sqlx::query_as(
        "SELECT p.id, p.original_text, p.lesson_id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to generate scaffold"})))
    })?;

    let problem = problem.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))))?;
    let ell_level = payload.ell_level.unwrap_or(2);

    // Fetch module's scaffold_prompt if problem belongs to a lesson
    let scaffold_prompt: Option<String> = if let Some(lesson_id) = &problem.lesson_id {
        sqlx::query_scalar(
            "SELECT m.scaffold_prompt FROM modules m JOIN lessons l ON l.module_id = m.id WHERE l.id = $1"
        )
        .bind(lesson_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    tracing::info!("Generating scaffold for problem: {} (custom_prompt: {})", problem_id, scaffold_prompt.is_some());
    let scaffold = match state.ai_service.generate_scaffold_with_prompt(&problem.original_text, ell_level, scaffold_prompt.as_deref()).await {
        Ok(scaffold) => {
            tracing::info!("AI scaffold generated successfully with {} steps", scaffold.steps.len());
            scaffold
        },
        Err(e) => {
            tracing::error!("AI scaffold generation FAILED: {}", e);
            generate_fallback_scaffold(&problem.original_text)
        }
    };

    // Delete existing steps
    sqlx::query("DELETE FROM scaffold_steps WHERE problem_id = $1")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .ok();

    // Save new steps
    for (i, step) in scaffold.steps.iter().enumerate() {
        let step_id = Uuid::new_v4().to_string();
        let correct_answer = serde_json::to_string(&step.correct_answer).unwrap();
        let options = step.options.as_ref().map(|o| serde_json::to_string(o).unwrap());
        let hints = serde_json::to_string(&step.hints).unwrap();

        sqlx::query(
            "INSERT INTO scaffold_steps (id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)"
        )
        .bind(&step_id)
        .bind(&problem_id)
        .bind(i as i32)
        .bind(&step.step_type)
        .bind(&step.prompt_text)
        .bind(&step.simplified_text)
        .bind(&correct_answer)
        .bind(&step.answer_type)
        .bind(&options)
        .bind(&hints)
        .bind(step.points)
        .bind(&step.emoji_hint)
        .execute(&state.db)
        .await
        .ok();
    }

    // Update problem metadata and set state to 'scaffolded'
    let skill_tags = serde_json::to_string(&scaffold.skill_tags).unwrap();
    sqlx::query("UPDATE problems SET simplified_text = $1, skill_tags = $2::jsonb, difficulty = $3, scene_emoji = $4, state = 'scaffolded' WHERE id = $5")
        .bind(&scaffold.simplified_problem)
        .bind(&skill_tags)
        .bind(scaffold.difficulty)
        .bind(&scaffold.scene_emoji)
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(scaffold))
}

pub async fn update_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
    Json(payload): Json<UpdateProblem>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct Exists { id: String }

    let existing: Option<Exists> = sqlx::query_as(
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update problem"})))
    })?;

    if existing.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))));
    }

    // Build dynamic update
    if let Some(text) = &payload.original_text {
        sqlx::query("UPDATE problems SET original_text = $1 WHERE id = $2").bind(text).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(text) = &payload.simplified_text {
        sqlx::query("UPDATE problems SET simplified_text = $1 WHERE id = $2").bind(text).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(tags) = &payload.skill_tags {
        let tags_json = serde_json::to_string(tags).unwrap();
        sqlx::query("UPDATE problems SET skill_tags = $1::jsonb WHERE id = $2").bind(&tags_json).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(diff) = payload.difficulty {
        sqlx::query("UPDATE problems SET difficulty = $1 WHERE id = $2").bind(diff).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(pub_) = payload.is_published {
        sqlx::query("UPDATE problems SET is_published = $1 WHERE id = $2").bind(pub_).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(week) = payload.week_number {
        sqlx::query("UPDATE problems SET week_number = $1 WHERE id = $2").bind(week).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(emoji) = &payload.scene_emoji {
        sqlx::query("UPDATE problems SET scene_emoji = $1 WHERE id = $2").bind(emoji).bind(&problem_id).execute(&state.db).await.ok();
    }

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE id = $1"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update problem"})))
    })?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn publish_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ProblemState { id: String, state: String }

    let existing: Option<ProblemState> = sqlx::query_as(
        "SELECT p.id, p.state FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
    })?;

    let problem_state = existing.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"})))
    })?;

    // Require 'reviewed' state to publish (allow direct publish for backwards compatibility)
    if problem_state.state != "reviewed" && problem_state.state != "scaffolded" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Problem must be reviewed before publishing. Current state: ".to_string() + &problem_state.state}))));
    }

    sqlx::query("UPDATE problems SET is_published = true, state = 'published' WHERE id = $1")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
        })?;

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE id = $1"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
    })?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

// Mark problem as reviewed (T6.3 Problem State Workflow)
pub async fn review_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct ProblemState { id: String, state: String }

    let existing: Option<ProblemState> = sqlx::query_as(
        "SELECT p.id, p.state FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to review problem"})))
    })?;

    let problem_state = existing.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"})))
    })?;

    // Require 'scaffolded' state to mark as reviewed
    if problem_state.state != "scaffolded" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Problem must be scaffolded before reviewing. Current state: ".to_string() + &problem_state.state}))));
    }

    sqlx::query("UPDATE problems SET state = 'reviewed' WHERE id = $1")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to review problem"})))
        })?;

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, lesson_id, original_text, simplified_text, skill_tags::text, difficulty, is_published, state, week_number, scene_emoji, created_at FROM problems WHERE id = $1"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to review problem"})))
    })?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .ok();

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn delete_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct Exists { id: String }

    let existing: Option<Exists> = sqlx::query_as(
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete problem"})))
    })?;

    if existing.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))));
    }

    sqlx::query("DELETE FROM problems WHERE id = $1")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete problem"})))
        })?;

    Ok(StatusCode::NO_CONTENT)
}

// ============ Scaffold Step Editing (T7.3) ============

// Helper to verify teacher has access to problem
async fn verify_problem_access(
    db: &sqlx::PgPool,
    problem_id: &str,
    teacher_id: &str,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = $1 AND c.teacher_id = $2"
    )
    .bind(problem_id)
    .bind(teacher_id)
    .fetch_optional(db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to verify access"})))
    })?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))));
    }

    Ok(())
}

// Add a new scaffold step
pub async fn add_scaffold_step(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
    Json(payload): Json<CreateScaffoldStep>,
) -> Result<Json<ScaffoldStepResponse>, (StatusCode, Json<serde_json::Value>)> {
    verify_problem_access(&state.db, &problem_id, &auth.teacher_id).await?;

    // Get the next step order
    let max_order = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(step_order) FROM scaffold_steps WHERE problem_id = $1"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to add step"})))
    })?
    .unwrap_or(-1);

    let step_id = Uuid::new_v4().to_string();
    let correct_answer = serde_json::to_string(&payload.correct_answer).unwrap();
    let options = payload.options.as_ref().map(|o| serde_json::to_string(o).unwrap());
    let hints = serde_json::to_string(&payload.hints).unwrap();

    sqlx::query(
        "INSERT INTO scaffold_steps (id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)"
    )
    .bind(&step_id)
    .bind(&problem_id)
    .bind(max_order + 1)
    .bind(&payload.step_type)
    .bind(&payload.prompt_text)
    .bind(&payload.simplified_text)
    .bind(&correct_answer)
    .bind(&payload.answer_type)
    .bind(&options)
    .bind(&hints)
    .bind(payload.points.unwrap_or(10))
    .bind(&payload.emoji_hint)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to add step"})))
    })?;

    let step: ScaffoldStep = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE id = $1"
    )
    .bind(&step_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch step"})))
    })?;

    Ok(Json(ScaffoldStepResponse::from(step)))
}

// Update an existing scaffold step
pub async fn update_scaffold_step(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((problem_id, step_id)): Path<(String, String)>,
    Json(payload): Json<UpdateScaffoldStep>,
) -> Result<Json<ScaffoldStepResponse>, (StatusCode, Json<serde_json::Value>)> {
    verify_problem_access(&state.db, &problem_id, &auth.teacher_id).await?;

    // Verify step exists and belongs to this problem
    let existing: Option<ScaffoldStep> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE id = $1 AND problem_id = $2"
    )
    .bind(&step_id)
    .bind(&problem_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update step"})))
    })?;

    let existing = existing.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Step not found"})))
    })?;

    // Merge updates
    let step_type = payload.step_type.unwrap_or(existing.step_type);
    let prompt_text = payload.prompt_text.unwrap_or(existing.prompt_text);
    let simplified_text = payload.simplified_text.or(existing.simplified_text);
    let correct_answer = payload.correct_answer
        .map(|a| serde_json::to_string(&a).unwrap())
        .unwrap_or(existing.correct_answer);
    let answer_type = payload.answer_type.unwrap_or(existing.answer_type);
    let options = payload.options
        .map(|o| serde_json::to_string(&o).unwrap())
        .or(existing.options);
    let hints = payload.hints
        .map(|h| serde_json::to_string(&h).unwrap())
        .unwrap_or(existing.hints);
    let points = payload.points.unwrap_or(existing.points);
    let emoji_hint = payload.emoji_hint.or(existing.emoji_hint);

    sqlx::query(
        "UPDATE scaffold_steps SET step_type = $1, prompt_text = $2, simplified_text = $3, correct_answer = $4, answer_type = $5, options = $6::jsonb, hints = $7::jsonb, points = $8, emoji_hint = $9 WHERE id = $10"
    )
    .bind(&step_type)
    .bind(&prompt_text)
    .bind(&simplified_text)
    .bind(&correct_answer)
    .bind(&answer_type)
    .bind(&options)
    .bind(&hints)
    .bind(points)
    .bind(&emoji_hint)
    .bind(&step_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update step"})))
    })?;

    let step: ScaffoldStep = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE id = $1"
    )
    .bind(&step_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch step"})))
    })?;

    Ok(Json(ScaffoldStepResponse::from(step)))
}

// Delete a scaffold step
pub async fn delete_scaffold_step(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((problem_id, step_id)): Path<(String, String)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    verify_problem_access(&state.db, &problem_id, &auth.teacher_id).await?;

    // Verify step exists and belongs to this problem
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM scaffold_steps WHERE id = $1 AND problem_id = $2"
    )
    .bind(&step_id)
    .bind(&problem_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete step"})))
    })?;

    if existing.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Step not found"}))));
    }

    // Get the step order before deletion
    let step_order: i32 = sqlx::query_scalar(
        "SELECT step_order FROM scaffold_steps WHERE id = $1"
    )
    .bind(&step_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete step"})))
    })?;

    // Delete the step
    sqlx::query("DELETE FROM scaffold_steps WHERE id = $1")
        .bind(&step_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete step"})))
        })?;

    // Reorder remaining steps to close the gap
    sqlx::query(
        "UPDATE scaffold_steps SET step_order = step_order - 1 WHERE problem_id = $1 AND step_order > $2"
    )
    .bind(&problem_id)
    .bind(step_order)
    .execute(&state.db)
    .await
    .ok();

    Ok(StatusCode::NO_CONTENT)
}

// Reorder scaffold steps
pub async fn reorder_scaffold_steps(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<String>,
    Json(payload): Json<ReorderScaffoldSteps>,
) -> Result<Json<Vec<ScaffoldStepResponse>>, (StatusCode, Json<serde_json::Value>)> {
    verify_problem_access(&state.db, &problem_id, &auth.teacher_id).await?;

    if payload.step_ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "step_ids cannot be empty"}))));
    }

    // Verify all step_ids belong to this problem
    let existing_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM scaffold_steps WHERE problem_id = $1"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to reorder steps"})))
    })?;

    if payload.step_ids.len() != existing_count as usize {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "step_ids must contain all steps for this problem"}))));
    }

    // Update step orders
    for (i, step_id) in payload.step_ids.iter().enumerate() {
        sqlx::query("UPDATE scaffold_steps SET step_order = $1 WHERE id = $2 AND problem_id = $3")
            .bind(i as i32)
            .bind(step_id)
            .bind(&problem_id)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to reorder steps"})))
            })?;
    }

    // Fetch and return all steps in new order
    let steps: Vec<ScaffoldStep> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options::text, hints::text, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = $1 ORDER BY step_order"
    )
    .bind(&problem_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch steps"})))
    })?;

    Ok(Json(steps.into_iter().map(ScaffoldStepResponse::from).collect()))
}

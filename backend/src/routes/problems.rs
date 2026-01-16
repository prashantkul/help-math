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
        CreateProblem, GenerateScaffoldRequest, PDFUploadResponse, Problem, ProblemResponse,
        ScaffoldStep, ScaffoldingAIResponse, UpdateProblem,
    },
    services::{generate_fallback_scaffold, PDFService},
    AppState,
};

#[derive(Deserialize)]
pub struct ListProblemsQuery {
    pub class_id: Uuid,
}

pub async fn list_problems(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListProblemsQuery>,
) -> Result<Json<Vec<ProblemResponse>>, (StatusCode, Json<serde_json::Value>)> {
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
            Json(json!({"error": "Failed to fetch problems"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let problems = sqlx::query_as!(
        Problem,
        r#"
        SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at
        FROM problems
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
            Json(json!({"error": "Failed to fetch problems"})),
        )
    })?;

    // Fetch steps for each problem
    let mut responses = Vec::new();
    for problem in problems {
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
            problem.id
        )
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
    Path(problem_id): Path<Uuid>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    let problem = sqlx::query_as!(
        Problem,
        r#"
        SELECT p.id, p.class_id, p.original_text, p.simplified_text, p.skill_tags,
               p.difficulty, p.is_published, p.week_number, p.scene_emoji, p.created_at
        FROM problems p
        JOIN classes c ON p.class_id = c.id
        WHERE p.id = $1 AND c.teacher_id = $2
        "#,
        problem_id,
        auth.teacher_id
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

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn create_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateProblem>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
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
            Json(json!({"error": "Failed to create problem"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let problem = sqlx::query_as!(
        Problem,
        r#"
        INSERT INTO problems (class_id, original_text)
        VALUES ($1, $2)
        RETURNING id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at
        "#,
        payload.class_id,
        payload.original_text
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create problem"})),
        )
    })?;

    Ok(Json(ProblemResponse::from_problem(problem, None)))
}

pub async fn upload_pdf(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    mut multipart: Multipart,
) -> Result<Json<PDFUploadResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut class_id: Option<Uuid> = None;
    let mut pdf_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Failed to process upload"})),
        )
    })? {
        let name = field.name().unwrap_or_default().to_string();

        if name == "class_id" {
            let text = field.text().await.map_err(|e| {
                tracing::error!("Failed to read class_id: {}", e);
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "Invalid class_id"})),
                )
            })?;
            class_id = Some(Uuid::parse_str(&text).map_err(|_| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "Invalid class_id format"})),
                )
            })?);
        } else if name == "file" {
            pdf_bytes = Some(field.bytes().await.map_err(|e| {
                tracing::error!("Failed to read file: {}", e);
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "Failed to read file"})),
                )
            })?.to_vec());
        }
    }

    let class_id = class_id.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "class_id is required"})),
        )
    })?;

    let pdf_bytes = pdf_bytes.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "PDF file is required"})),
        )
    })?;

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
            Json(json!({"error": "Failed to process upload"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    // Extract problems from PDF
    let pdf_service = PDFService::new();
    let extracted = pdf_service.extract_problems(&pdf_bytes).map_err(|e| {
        tracing::error!("PDF extraction error: {}", e);
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Failed to extract text from PDF: {}", e)})),
        )
    })?;

    Ok(Json(PDFUploadResponse {
        extracted_problems: extracted,
    }))
}

pub async fn generate_scaffold(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<Uuid>,
    Json(payload): Json<GenerateScaffoldRequest>,
) -> Result<Json<ScaffoldingAIResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Get problem and verify ownership
    let problem = sqlx::query!(
        r#"
        SELECT p.id, p.original_text
        FROM problems p
        JOIN classes c ON p.class_id = c.id
        WHERE p.id = $1 AND c.teacher_id = $2
        "#,
        problem_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to generate scaffold"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Problem not found"})),
        )
    })?;

    let ell_level = payload.ell_level.unwrap_or(2);

    // Generate scaffold using AI
    let scaffold = match state
        .ai_service
        .generate_scaffold(&problem.original_text, ell_level)
        .await
    {
        Ok(scaffold) => scaffold,
        Err(e) => {
            tracing::warn!("AI scaffold generation failed, using fallback: {}", e);
            generate_fallback_scaffold(&problem.original_text)
        }
    };

    // Delete existing steps
    sqlx::query!(
        r#"DELETE FROM scaffold_steps WHERE problem_id = $1"#,
        problem_id
    )
    .execute(&state.db)
    .await
    .ok();

    // Save new steps
    for (i, step) in scaffold.steps.iter().enumerate() {
        sqlx::query!(
            r#"
            INSERT INTO scaffold_steps (problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
            problem_id,
            i as i32,
            step.step_type,
            step.prompt_text,
            step.simplified_text,
            serde_json::to_value(&step.correct_answer).unwrap(),
            step.answer_type,
            step.options.as_ref().map(|o| serde_json::to_value(o).unwrap()),
            &step.hints,
            step.points,
            step.emoji_hint
        )
        .execute(&state.db)
        .await
        .ok();
    }

    // Update problem metadata
    sqlx::query!(
        r#"
        UPDATE problems
        SET simplified_text = $1, skill_tags = $2, difficulty = $3, scene_emoji = $4
        WHERE id = $5
        "#,
        scaffold.simplified_problem,
        &scaffold.skill_tags,
        scaffold.difficulty,
        scaffold.scene_emoji,
        problem_id
    )
    .execute(&state.db)
    .await
    .ok();

    Ok(Json(scaffold))
}

pub async fn update_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<Uuid>,
    Json(payload): Json<UpdateProblem>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify ownership
    let existing = sqlx::query!(
        r#"
        SELECT p.id
        FROM problems p
        JOIN classes c ON p.class_id = c.id
        WHERE p.id = $1 AND c.teacher_id = $2
        "#,
        problem_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update problem"})),
        )
    })?;

    if existing.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Problem not found"})),
        ));
    }

    let problem = sqlx::query_as!(
        Problem,
        r#"
        UPDATE problems
        SET
            original_text = COALESCE($1, original_text),
            simplified_text = COALESCE($2, simplified_text),
            skill_tags = COALESCE($3, skill_tags),
            difficulty = COALESCE($4, difficulty),
            is_published = COALESCE($5, is_published),
            week_number = COALESCE($6, week_number),
            scene_emoji = COALESCE($7, scene_emoji)
        WHERE id = $8
        RETURNING id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at
        "#,
        payload.original_text,
        payload.simplified_text,
        payload.skill_tags.as_deref(),
        payload.difficulty,
        payload.is_published,
        payload.week_number,
        payload.scene_emoji,
        problem_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update problem"})),
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

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn publish_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<Uuid>,
) -> Result<Json<ProblemResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify ownership and get problem
    let problem = sqlx::query_as!(
        Problem,
        r#"
        UPDATE problems p
        SET is_published = true
        FROM classes c
        WHERE p.class_id = c.id AND p.id = $1 AND c.teacher_id = $2
        RETURNING p.id, p.class_id, p.original_text, p.simplified_text, p.skill_tags, p.difficulty, p.is_published, p.week_number, p.scene_emoji, p.created_at
        "#,
        problem_id,
        auth.teacher_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to publish problem"})),
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

    Ok(Json(ProblemResponse::from_problem(problem, steps)))
}

pub async fn delete_problem(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(problem_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query!(
        r#"
        DELETE FROM problems p
        USING classes c
        WHERE p.class_id = c.id AND p.id = $1 AND c.teacher_id = $2
        "#,
        problem_id,
        auth.teacher_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to delete problem"})),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Problem not found"})),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

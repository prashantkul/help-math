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
    pub class_id: String,
}

pub async fn list_problems(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListProblemsQuery>,
) -> Result<Json<Vec<ProblemResponse>>, (StatusCode, Json<serde_json::Value>)> {
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
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    let problems: Vec<Problem> = sqlx::query_as(
        "SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at FROM problems WHERE class_id = ? ORDER BY created_at DESC"
    )
    .bind(&query.class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch problems"})))
    })?;

    let mut responses = Vec::new();
    for problem in problems {
        let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
            "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = ? ORDER BY step_order"
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
        "SELECT p.id, p.class_id, p.original_text, p.simplified_text, p.skill_tags, p.difficulty, p.is_published, p.week_number, p.scene_emoji, p.created_at FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = ? AND c.teacher_id = ?"
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
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = ? ORDER BY step_order"
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
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
    })?;

    if class_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Class not found"}))));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO problems (id, class_id, original_text, skill_tags) VALUES (?, ?, ?, '[]')"
    )
    .bind(&id)
    .bind(&payload.class_id)
    .bind(&payload.original_text)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create problem"})))
    })?;

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at FROM problems WHERE id = ?"
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

    let class_exists: Option<ClassExists> = sqlx::query_as("SELECT id FROM classes WHERE id = ? AND teacher_id = ?")
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
    struct ProblemInfo { id: String, original_text: String }

    let problem: Option<ProblemInfo> = sqlx::query_as(
        "SELECT p.id, p.original_text FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = ? AND c.teacher_id = ?"
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

    let scaffold = match state.ai_service.generate_scaffold(&problem.original_text, ell_level).await {
        Ok(scaffold) => scaffold,
        Err(e) => {
            tracing::warn!("AI scaffold generation failed, using fallback: {}", e);
            generate_fallback_scaffold(&problem.original_text)
        }
    };

    // Delete existing steps
    sqlx::query("DELETE FROM scaffold_steps WHERE problem_id = ?")
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
            "INSERT INTO scaffold_steps (id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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

    // Update problem metadata
    let skill_tags = serde_json::to_string(&scaffold.skill_tags).unwrap();
    sqlx::query("UPDATE problems SET simplified_text = ?, skill_tags = ?, difficulty = ?, scene_emoji = ? WHERE id = ?")
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
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = ? AND c.teacher_id = ?"
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
        sqlx::query("UPDATE problems SET original_text = ? WHERE id = ?").bind(text).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(text) = &payload.simplified_text {
        sqlx::query("UPDATE problems SET simplified_text = ? WHERE id = ?").bind(text).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(tags) = &payload.skill_tags {
        let tags_json = serde_json::to_string(tags).unwrap();
        sqlx::query("UPDATE problems SET skill_tags = ? WHERE id = ?").bind(&tags_json).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(diff) = payload.difficulty {
        sqlx::query("UPDATE problems SET difficulty = ? WHERE id = ?").bind(diff).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(pub_) = payload.is_published {
        sqlx::query("UPDATE problems SET is_published = ? WHERE id = ?").bind(if pub_ { 1 } else { 0 }).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(week) = payload.week_number {
        sqlx::query("UPDATE problems SET week_number = ? WHERE id = ?").bind(week).bind(&problem_id).execute(&state.db).await.ok();
    }
    if let Some(emoji) = &payload.scene_emoji {
        sqlx::query("UPDATE problems SET scene_emoji = ? WHERE id = ?").bind(emoji).bind(&problem_id).execute(&state.db).await.ok();
    }

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at FROM problems WHERE id = ?"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update problem"})))
    })?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = ? ORDER BY step_order"
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
    struct Exists { id: String }

    let existing: Option<Exists> = sqlx::query_as(
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = ? AND c.teacher_id = ?"
    )
    .bind(&problem_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
    })?;

    if existing.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Problem not found"}))));
    }

    sqlx::query("UPDATE problems SET is_published = 1 WHERE id = ?")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
        })?;

    let problem: Problem = sqlx::query_as(
        "SELECT id, class_id, original_text, simplified_text, skill_tags, difficulty, is_published, week_number, scene_emoji, created_at FROM problems WHERE id = ?"
    )
    .bind(&problem_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to publish problem"})))
    })?;

    let steps: Option<Vec<ScaffoldStep>> = sqlx::query_as(
        "SELECT id, problem_id, step_order, step_type, prompt_text, simplified_text, correct_answer, answer_type, options, hints, points, emoji_hint, created_at FROM scaffold_steps WHERE problem_id = ? ORDER BY step_order"
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
        "SELECT p.id FROM problems p JOIN classes c ON p.class_id = c.id WHERE p.id = ? AND c.teacher_id = ?"
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

    sqlx::query("DELETE FROM problems WHERE id = ?")
        .bind(&problem_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete problem"})))
        })?;

    Ok(StatusCode::NO_CONTENT)
}

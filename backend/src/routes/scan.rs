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
        ScanBatch, ScanBatchResponse, ScanPage, ScanUploadResponse,
        BatchReviewResponse, AssignmentInfo, BatchSummary,
        ConfirmMatchesRequest, NameDetectionResult, StudentMatch,
    },
    AppState,
};

/// POST /api/teacher/scan/upload - Upload scanned files as a batch
pub async fn upload_scan_batch(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    mut multipart: Multipart,
) -> Result<Json<ScanUploadResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut mode = String::from("grade");
    let mut class_id: Option<String> = None;
    let mut assignment_id: Option<String> = None;
    let mut files: Vec<(String, Vec<u8>, String)> = Vec::new(); // (filename, bytes, content_type)

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to process upload"})))
    })? {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "mode" => {
                mode = field.text().await.unwrap_or_else(|_| "grade".to_string());
            }
            "class_id" => {
                class_id = Some(field.text().await.unwrap_or_default());
            }
            "assignment_id" => {
                let val = field.text().await.unwrap_or_default();
                if !val.is_empty() {
                    assignment_id = Some(val);
                }
            }
            "files" | "file" => {
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                let filename = field.file_name().unwrap_or("page.jpg").to_string();
                let bytes = field.bytes().await.map_err(|e| {
                    tracing::error!("Failed to read file: {}", e);
                    (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read file"})))
                })?.to_vec();
                files.push((filename, bytes, content_type));
            }
            _ => {}
        }
    }

    if files.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "At least one file is required"}))));
    }

    // Validate mode
    if mode != "style" && mode != "grade" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Mode must be 'style' or 'grade'"}))));
    }

    // Create the batch record
    let batch_id = Uuid::new_v4().to_string();

    // Create upload directory
    let upload_dir = format!("uploads/scans/{}", batch_id);
    tokio::fs::create_dir_all(&upload_dir).await.map_err(|e| {
        tracing::error!("Failed to create upload dir: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create upload directory"})))
    })?;

    // Save files and create page records
    let mut page_count = 0;

    for (filename, bytes, content_type) in &files {
        if content_type.starts_with("application/pdf") {
            // For PDFs: save the original and create one page record per file
            // In production, we'd split PDFs into individual pages using a crate
            // For hackathon: treat each PDF as a single page
            page_count += 1;
            let page_path = format!("{}/page_{}.pdf", upload_dir, page_count);
            tokio::fs::write(&page_path, bytes).await.map_err(|e| {
                tracing::error!("Failed to write file: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save file"})))
            })?;

            let page_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO scan_pages (id, batch_id, page_number, file_path, processing_status) VALUES ($1, $2, $3, $4, 'pending')"
            )
            .bind(&page_id)
            .bind(&batch_id)
            .bind(page_count)
            .bind(&page_path)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save page record"})))
            })?;
        } else {
            // Image files: save directly as pages
            page_count += 1;
            let ext = if content_type.contains("png") { "png" } else { "jpg" };
            let page_path = format!("{}/page_{}.{}", upload_dir, page_count, ext);
            tokio::fs::write(&page_path, bytes).await.map_err(|e| {
                tracing::error!("Failed to write file: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save file"})))
            })?;

            // Create thumbnail (just use the original path for now; in production use image crate)
            let thumb_path = format!("{}/page_{}_thumb.{}", upload_dir, page_count, ext);
            tokio::fs::copy(&page_path, &thumb_path).await.ok();

            let page_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO scan_pages (id, batch_id, page_number, file_path, thumbnail_path, processing_status) VALUES ($1, $2, $3, $4, $5, 'pending')"
            )
            .bind(&page_id)
            .bind(&batch_id)
            .bind(page_count)
            .bind(&page_path)
            .bind(&thumb_path)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save page record"})))
            })?;
        }
    }

    // Create batch record
    sqlx::query(
        "INSERT INTO scan_batches (id, teacher_id, mode, assignment_id, class_id, total_pages, status) VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')"
    )
    .bind(&batch_id)
    .bind(&auth.teacher_id)
    .bind(&mode)
    .bind(&assignment_id)
    .bind(&class_id)
    .bind(page_count)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create batch"})))
    })?;

    // For grade mode, start async identification
    if mode == "grade" {
        let state_clone = state.clone();
        let batch_id_clone = batch_id.clone();
        let teacher_id_clone = auth.teacher_id.clone();
        let class_id_clone = class_id.clone();
        tokio::spawn(async move {
            if let Err(e) = run_student_identification(&state_clone, &batch_id_clone, &teacher_id_clone, class_id_clone.as_deref()).await {
                tracing::error!("Student identification failed for batch {}: {}", batch_id_clone, e);
                sqlx::query("UPDATE scan_batches SET status = 'error', error_message = $1 WHERE id = $2")
                    .bind(format!("{}", e))
                    .bind(&batch_id_clone)
                    .execute(&state_clone.db)
                    .await
                    .ok();
            }
        });
    } else {
        // Style mode: mark as ready for confirmation immediately
        sqlx::query("UPDATE scan_batches SET status = 'ready' WHERE id = $1")
            .bind(&batch_id)
            .execute(&state.db)
            .await
            .ok();
    }

    Ok(Json(ScanUploadResponse {
        batch_id,
        total_pages: page_count,
        status: if mode == "grade" { "identifying".to_string() } else { "ready".to_string() },
        message: format!("Processing {} pages...", page_count),
    }))
}

/// Run student identification on all pages in a batch
async fn run_student_identification(
    state: &AppState,
    batch_id: &str,
    teacher_id: &str,
    class_id: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE scan_batches SET status = 'identifying' WHERE id = $1")
        .bind(batch_id)
        .execute(&state.db)
        .await?;

    // Get class roster for matching
    let roster = if let Some(cid) = class_id {
        sqlx::query_as::<_, (String, String)>("SELECT id, name FROM students WHERE class_id = $1")
            .bind(cid)
            .fetch_all(&state.db)
            .await?
    } else {
        // Get all students across teacher's classes
        sqlx::query_as::<_, (String, String)>(
            "SELECT s.id, s.name FROM students s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = $1"
        )
        .bind(teacher_id)
        .fetch_all(&state.db)
        .await?
    };

    // Get pages
    let pages: Vec<ScanPage> = sqlx::query_as(
        "SELECT * FROM scan_pages WHERE batch_id = $1 ORDER BY page_number"
    )
    .bind(batch_id)
    .fetch_all(&state.db)
    .await?;

    let mut identified_count = 0;

    for page in &pages {
        // Read image file for Claude Vision name detection
        let file_bytes = match tokio::fs::read(&page.file_path).await {
            Ok(b) => b,
            Err(e) => {
                tracing::error!("Failed to read page file {}: {}", page.file_path, e);
                sqlx::query("UPDATE scan_pages SET processing_status = 'error', error_message = $1 WHERE id = $2")
                    .bind(format!("Failed to read file: {}", e))
                    .bind(&page.id)
                    .execute(&state.db)
                    .await?;
                continue;
            }
        };

        // Determine media type
        let media_type = if page.file_path.ends_with(".png") {
            "image/png"
        } else if page.file_path.ends_with(".pdf") {
            // Skip PDFs for now - would need conversion
            sqlx::query("UPDATE scan_pages SET processing_status = 'pending', student_name_detected = 'PDF - manual assignment needed' WHERE id = $1")
                .bind(&page.id)
                .execute(&state.db)
                .await?;
            identified_count += 1;
            sqlx::query("UPDATE scan_batches SET pages_processed = $1 WHERE id = $2")
                .bind(identified_count)
                .bind(batch_id)
                .execute(&state.db)
                .await?;
            continue;
        } else {
            "image/jpeg"
        };

        // Call Claude to detect student name
        let detection = detect_student_name(&state.style_ai_service, &file_bytes, media_type).await;

        match detection {
            Ok(result) => {
                if result.name_found && !result.name_text.is_empty() {
                    // Fuzzy match against roster
                    let matched = fuzzy_match_student(&result.name_text, &roster);

                    match matched {
                        Some(m) => {
                            sqlx::query(
                                "UPDATE scan_pages SET student_name_detected = $1, student_id = $2, student_match_confidence = $3, match_type = $4, processing_status = 'identified' WHERE id = $5"
                            )
                            .bind(&result.name_text)
                            .bind(&m.student_id)
                            .bind(m.confidence)
                            .bind(&m.match_type)
                            .bind(&page.id)
                            .execute(&state.db)
                            .await?;
                        }
                        None => {
                            sqlx::query(
                                "UPDATE scan_pages SET student_name_detected = $1, student_match_confidence = 0.0, match_type = 'none', processing_status = 'identified' WHERE id = $2"
                            )
                            .bind(&result.name_text)
                            .bind(&page.id)
                            .execute(&state.db)
                            .await?;
                        }
                    }
                } else {
                    sqlx::query(
                        "UPDATE scan_pages SET processing_status = 'identified', student_name_detected = NULL WHERE id = $1"
                    )
                    .bind(&page.id)
                    .execute(&state.db)
                    .await?;
                }
            }
            Err(e) => {
                tracing::error!("Name detection failed for page {}: {}", page.id, e);
                sqlx::query("UPDATE scan_pages SET processing_status = 'error', error_message = $1 WHERE id = $2")
                    .bind(format!("Detection failed: {}", e))
                    .bind(&page.id)
                    .execute(&state.db)
                    .await?;
            }
        }

        identified_count += 1;
        sqlx::query("UPDATE scan_batches SET pages_processed = $1 WHERE id = $2")
            .bind(identified_count)
            .bind(batch_id)
            .execute(&state.db)
            .await?;
    }

    sqlx::query("UPDATE scan_batches SET status = 'identified', pages_processed = total_pages WHERE id = $1")
        .bind(batch_id)
        .execute(&state.db)
        .await?;

    Ok(())
}

/// Use Claude to detect student name from a scanned page image
async fn detect_student_name(
    style_ai: &crate::services::StyleAIService,
    image_bytes: &[u8],
    media_type: &str,
) -> anyhow::Result<NameDetectionResult> {
    use base64::Engine;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(image_bytes);

    // Use the style AI service's internal client for the API call
    let client = reqwest::Client::new();
    let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();

    if api_key.is_empty() {
        return Err(anyhow::anyhow!("ANTHROPIC_API_KEY not configured"));
    }

    let content = serde_json::json!([
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64_data
            }
        },
        {
            "type": "text",
            "text": "Read the student's name from this scanned assignment page."
        }
    ]);

    let request_body = serde_json::json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 256,
        "system": r#"Read the student's name from this scanned assignment page.

Look for:
- "Name:" field (usually top of page)
- Student name in header area
- Name labels or stickers

Return JSON only:
{
  "name_found": true,
  "name_text": "exact text read",
  "name_confidence": 0.9,
  "name_location": "top_left",
  "notes": ""
}

Do NOT analyze any other content. Do NOT identify by handwriting style.
If no name is found, return name_found: false with empty name_text."#,
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Claude API error: {}", e))?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("Claude API error: {}", err));
    }

    #[derive(serde::Deserialize)]
    struct ClaudeResp { content: Vec<ClaudeContent> }
    #[derive(serde::Deserialize)]
    struct ClaudeContent { text: String }

    let claude_resp: ClaudeResp = response.json().await
        .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;

    let text = claude_resp.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_default();

    // Extract JSON from response
    let json_str = if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            &text[start..=end]
        } else {
            &text
        }
    } else {
        &text
    };

    serde_json::from_str(json_str)
        .map_err(|e| anyhow::anyhow!("Failed to parse name detection: {} from: {}", e, json_str))
}

/// Fuzzy match a detected name against the class roster
fn fuzzy_match_student(detected: &str, roster: &[(String, String)]) -> Option<StudentMatch> {
    let normalized = detected.trim().to_lowercase();

    if normalized.is_empty() {
        return None;
    }

    // 1. Exact match
    for (id, name) in roster {
        if name.trim().to_lowercase() == normalized {
            return Some(StudentMatch {
                student_id: id.clone(),
                student_name: name.clone(),
                confidence: 1.0,
                match_type: "exact".to_string(),
            });
        }
    }

    // 2. First name match
    let detected_first = normalized.split_whitespace().next().unwrap_or("");
    if detected_first.len() >= 3 {
        let first_matches: Vec<_> = roster.iter().filter(|(_, name)| {
            name.trim().to_lowercase()
                .split_whitespace().next().unwrap_or("") == detected_first
        }).collect();

        if first_matches.len() == 1 {
            return Some(StudentMatch {
                student_id: first_matches[0].0.clone(),
                student_name: first_matches[0].1.clone(),
                confidence: 0.85,
                match_type: "first_name".to_string(),
            });
        }
    }

    // 3. Fuzzy match using Levenshtein distance
    let mut best: Option<StudentMatch> = None;
    for (id, name) in roster {
        let roster_norm = name.trim().to_lowercase();
        let dist = levenshtein_distance(&normalized, &roster_norm);
        let max_len = normalized.len().max(roster_norm.len()) as f64;
        if max_len == 0.0 { continue; }
        let similarity = 1.0 - (dist as f64 / max_len);

        if similarity > 0.70 {
            if best.is_none() || similarity > best.as_ref().unwrap().confidence {
                best = Some(StudentMatch {
                    student_id: id.clone(),
                    student_name: name.clone(),
                    confidence: similarity,
                    match_type: "fuzzy".to_string(),
                });
            }
        }
    }

    best
}

/// Simple Levenshtein distance implementation (avoids external dependency)
fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();

    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 0..=m { dp[i][0] = i; }
    for j in 0..=n { dp[0][j] = j; }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }

    dp[m][n]
}

/// POST /api/teacher/scan/batch/:id/identify - Trigger student identification
pub async fn identify_scan_batch(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(batch_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Verify ownership
    let batch: Option<ScanBatch> = sqlx::query_as(
        "SELECT * FROM scan_batches WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&batch_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let batch = batch.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Batch not found"})))
    })?;

    let state_clone = state.clone();
    let teacher_id = auth.teacher_id.clone();
    let class_id = batch.class_id.clone();
    let bid = batch_id.clone();
    tokio::spawn(async move {
        if let Err(e) = run_student_identification(&state_clone, &bid, &teacher_id, class_id.as_deref()).await {
            tracing::error!("Identification failed: {}", e);
        }
    });

    Ok(Json(json!({
        "message": format!("Identification started for {} pages", batch.total_pages)
    })))
}

/// GET /api/teacher/scan/batch/:id/review - Get batch review data
pub async fn review_scan_batch(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(batch_id): Path<String>,
) -> Result<Json<BatchReviewResponse>, (StatusCode, Json<serde_json::Value>)> {
    let batch: ScanBatch = sqlx::query_as(
        "SELECT * FROM scan_batches WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&batch_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Batch not found"}))))?;

    let pages: Vec<ScanPage> = sqlx::query_as(
        "SELECT * FROM scan_pages WHERE batch_id = $1 ORDER BY page_number"
    )
    .bind(&batch_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    // Get assignment info
    let assignment = if let Some(ref aid) = batch.assignment_id {
        sqlx::query_as::<_, (String, String)>("SELECT id, title FROM assignments WHERE id = $1")
            .bind(aid)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .map(|(id, title)| AssignmentInfo { id, title })
    } else {
        None
    };

    // Build page responses with student names
    let mut page_responses = Vec::new();
    let mut auto_matched = 0;
    let mut needs_confirmation = 0;
    let mut unmatched = 0;

    for page in pages {
        let student_name: Option<String> = if let Some(ref sid) = page.student_id {
            sqlx::query_scalar("SELECT name FROM students WHERE id = $1")
                .bind(sid)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten()
        } else {
            None
        };

        let confidence = page.student_match_confidence.unwrap_or(0.0);
        if page.student_id.is_some() && confidence >= 0.90 {
            auto_matched += 1;
        } else if page.student_id.is_some() && confidence >= 0.70 {
            needs_confirmation += 1;
        } else if page.student_name_detected.is_some() {
            unmatched += 1;
        } else {
            unmatched += 1;
        }

        page_responses.push(page.to_response(student_name));
    }

    Ok(Json(BatchReviewResponse {
        batch_id: batch.id,
        mode: batch.mode,
        status: batch.status,
        assignment,
        pages: page_responses,
        summary: BatchSummary {
            total: batch.total_pages,
            auto_matched,
            needs_confirmation,
            unmatched,
        },
    }))
}

/// PUT /api/teacher/scan/batch/:id/confirm - Confirm matches and trigger processing
pub async fn confirm_scan_batch(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(batch_id): Path<String>,
    Json(payload): Json<ConfirmMatchesRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Verify ownership
    let batch: ScanBatch = sqlx::query_as(
        "SELECT * FROM scan_batches WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&batch_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Batch not found"}))))?;

    // Apply corrections
    for correction in &payload.corrections {
        sqlx::query(
            "UPDATE scan_pages SET student_id = $1, teacher_confirmed = true, match_type = 'manual' WHERE id = $2 AND batch_id = $3"
        )
        .bind(&correction.student_id)
        .bind(&correction.page_id)
        .bind(&batch_id)
        .execute(&state.db)
        .await
        .ok();
    }

    // Confirm all auto-matched
    if payload.confirm_all_auto {
        sqlx::query(
            "UPDATE scan_pages SET teacher_confirmed = true WHERE batch_id = $1 AND student_match_confidence >= 0.90"
        )
        .bind(&batch_id)
        .execute(&state.db)
        .await
        .ok();
    }

    // Update batch status
    sqlx::query("UPDATE scan_batches SET status = 'processing', pages_processed = 0 WHERE id = $1")
        .bind(&batch_id)
        .execute(&state.db)
        .await
        .ok();

    // Capture values before moving batch into the spawned task
    let total_pages = batch.total_pages;
    let batch_mode = batch.mode.clone();

    // Start async processing pipeline
    let state_clone = state.clone();
    let mode_clone = batch.mode.clone();
    let teacher_id_clone = batch.teacher_id.clone();
    let bid = batch_id.clone();
    tokio::spawn(async move {
        if let Err(e) = run_processing_pipeline(&state_clone, &bid, &mode_clone, &teacher_id_clone).await {
            tracing::error!("Processing pipeline failed: {}", e);
            sqlx::query("UPDATE scan_batches SET status = 'error', error_message = $1 WHERE id = $2")
                .bind(format!("{}", e))
                .bind(&bid)
                .execute(&state_clone.db)
                .await
                .ok();
        }
    });

    Ok(Json(json!({
        "confirmed": total_pages,
        "processing": true,
        "message": format!("{} {} submissions...",
            if batch_mode == "style" { "Analyzing" } else { "Grading" },
            total_pages
        )
    })))
}

/// Process confirmed pages through the style or grading pipeline
async fn run_processing_pipeline(
    state: &AppState,
    batch_id: &str,
    mode: &str,
    teacher_id: &str,
) -> anyhow::Result<()> {
    let pages: Vec<ScanPage> = sqlx::query_as(
        "SELECT * FROM scan_pages WHERE batch_id = $1 ORDER BY page_number"
    )
    .bind(batch_id)
    .fetch_all(&state.db)
    .await?;

    let batch: ScanBatch = sqlx::query_as("SELECT * FROM scan_batches WHERE id = $1")
        .bind(batch_id)
        .fetch_one(&state.db)
        .await?;

    let mut processed = 0;

    for page in &pages {
        if mode == "style" {
            // Style mode: route to style extraction
            let file_bytes = tokio::fs::read(&page.file_path).await?;
            let media_type = if page.file_path.ends_with(".png") { "image/png" } else { "image/jpeg" };

            use base64::Engine;
            let base64_data = base64::engine::general_purpose::STANDARD.encode(&file_bytes);

            // Get teacher's current grade level
            let grade_level: Option<i32> = sqlx::query_scalar(
                "SELECT grade FROM classes WHERE teacher_id = $1 LIMIT 1"
            )
            .bind(teacher_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            match state.style_ai_service.extract_style_from_image(&base64_data, media_type, grade_level.unwrap_or(3), "math").await {
                Ok(profile) => {
                    // Save as style sample
                    let sample_id = uuid::Uuid::new_v4().to_string();
                    let annotations = serde_json::to_string(&serde_json::json!({
                        "praise_phrases": profile.praise_phrases,
                        "correction_phrases": profile.correction_phrases,
                    })).unwrap_or_else(|_| "{}".to_string());
                    let patterns = serde_json::to_string(&serde_json::json!({
                        "tone": profile.tone,
                        "correction_style": profile.correction_style,
                    })).unwrap_or_else(|_| "{}".to_string());

                    sqlx::query(
                        "INSERT INTO style_samples (id, teacher_id, file_path, file_type, extracted_annotations, feedback_patterns, processed) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, true)"
                    )
                    .bind(&sample_id)
                    .bind(teacher_id)
                    .bind(&page.file_path)
                    .bind(media_type)
                    .bind(&annotations)
                    .bind(&patterns)
                    .execute(&state.db)
                    .await?;

                    // Aggregate into profile
                    let current_str: Option<String> = sqlx::query_scalar(
                        "SELECT style_profile::text FROM teachers WHERE id = $1"
                    )
                    .bind(teacher_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten();

                    let current: crate::models::StyleProfile = current_str
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default();

                    let aggregated = crate::services::StyleAIService::aggregate_style(&current, &profile);
                    let agg_json = serde_json::to_string(&aggregated).unwrap_or_else(|_| "{}".to_string());

                    sqlx::query("UPDATE teachers SET style_profile = $1::jsonb, style_confidence = $2 WHERE id = $3")
                        .bind(&agg_json)
                        .bind(aggregated.confidence_score)
                        .bind(teacher_id)
                        .execute(&state.db)
                        .await?;

                    sqlx::query("UPDATE scan_pages SET processing_status = 'complete', result_id = $1 WHERE id = $2")
                        .bind(&sample_id)
                        .bind(&page.id)
                        .execute(&state.db)
                        .await?;
                }
                Err(e) => {
                    tracing::error!("Style extraction failed for page {}: {}", page.id, e);
                    sqlx::query("UPDATE scan_pages SET processing_status = 'error', error_message = $1 WHERE id = $2")
                        .bind(format!("{}", e))
                        .bind(&page.id)
                        .execute(&state.db)
                        .await?;
                }
            }
        } else {
            // Grade mode: create graded_submission and trigger AI grading
            if let Some(ref student_id) = page.student_id {
                let submission_id = uuid::Uuid::new_v4().to_string();
                let content = serde_json::json!({"scanned_page": page.file_path, "page_number": page.page_number});

                sqlx::query(
                    "INSERT INTO graded_submissions (id, assignment_id, student_id, content, scanned_file, status) VALUES ($1, $2, $3, $4::jsonb, $5, 'submitted')"
                )
                .bind(&submission_id)
                .bind(&batch.assignment_id)
                .bind(student_id)
                .bind(serde_json::to_string(&content).unwrap_or_else(|_| "{}".to_string()))
                .bind(&page.file_path)
                .execute(&state.db)
                .await?;

                // Try to AI grade immediately
                let style_str: Option<String> = sqlx::query_scalar(
                    "SELECT style_profile::text FROM teachers WHERE id = $1"
                )
                .bind(teacher_id)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten();

                let style_profile: crate::models::StyleProfile = style_str
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();

                let student_name: String = sqlx::query_scalar("SELECT name FROM students WHERE id = $1")
                    .bind(student_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "Student".to_string());

                let assignment_title: String = if let Some(ref aid) = batch.assignment_id {
                    sqlx::query_scalar::<_, String>("SELECT title FROM assignments WHERE id = $1")
                        .bind(aid)
                        .fetch_optional(&state.db)
                        .await
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "Assignment".to_string())
                } else {
                    "Assignment".to_string()
                };

                // Read scanned image and send to Claude for grading
                let file_bytes = tokio::fs::read(&page.file_path).await.ok();
                let student_work = if let Some(bytes) = file_bytes {
                    use base64::Engine;
                    format!("[Scanned image: {} bytes, page {}]", bytes.len(), page.page_number)
                } else {
                    format!("Page {} of scanned submission", page.page_number)
                };

                match state.style_ai_service.grade_in_teacher_voice(
                    &style_profile, &student_name, 3, "math", &assignment_title, &student_work
                ).await {
                    Ok(ai_response) => {
                        sqlx::query(
                            "UPDATE graded_submissions SET ai_feedback = $1, ai_score = $2, ai_skill_gaps = $3, status = 'ai_graded', graded_at = NOW() WHERE id = $4"
                        )
                        .bind(&ai_response.feedback)
                        .bind(ai_response.score)
                        .bind(&ai_response.skill_gaps)
                        .bind(&submission_id)
                        .execute(&state.db)
                        .await?;
                    }
                    Err(e) => {
                        tracing::error!("AI grading failed for submission {}: {}", submission_id, e);
                    }
                }

                sqlx::query("UPDATE scan_pages SET processing_status = 'complete', result_id = $1 WHERE id = $2")
                    .bind(&submission_id)
                    .bind(&page.id)
                    .execute(&state.db)
                    .await?;
            } else {
                sqlx::query("UPDATE scan_pages SET processing_status = 'skipped', error_message = 'No student assigned' WHERE id = $1")
                    .bind(&page.id)
                    .execute(&state.db)
                    .await?;
            }
        }

        processed += 1;
        sqlx::query("UPDATE scan_batches SET pages_processed = $1 WHERE id = $2")
            .bind(processed)
            .bind(batch_id)
            .execute(&state.db)
            .await?;
    }

    sqlx::query("UPDATE scan_batches SET status = 'complete', pages_processed = total_pages, completed_at = NOW() WHERE id = $1")
        .bind(batch_id)
        .execute(&state.db)
        .await?;

    Ok(())
}

/// GET /api/teacher/scan/batch/:id/status - Get batch processing status
pub async fn get_scan_batch_status(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(batch_id): Path<String>,
) -> Result<Json<ScanBatchResponse>, (StatusCode, Json<serde_json::Value>)> {
    let batch: ScanBatch = sqlx::query_as(
        "SELECT * FROM scan_batches WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&batch_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "Batch not found"}))))?;

    Ok(Json(ScanBatchResponse::from(batch)))
}

#[derive(Debug, Deserialize)]
pub struct ListBatchesQuery {
    pub mode: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/teacher/scan/batches - List all batches for teacher
pub async fn list_scan_batches(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Query(query): Query<ListBatchesQuery>,
) -> Result<Json<Vec<ScanBatchResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(20);

    let batches: Vec<ScanBatch> = if let (Some(mode), Some(status)) = (&query.mode, &query.status) {
        sqlx::query_as(
            "SELECT * FROM scan_batches WHERE teacher_id = $1 AND mode = $2 AND status = $3 ORDER BY created_at DESC LIMIT $4"
        )
        .bind(&auth.teacher_id)
        .bind(mode)
        .bind(status)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else if let Some(mode) = &query.mode {
        sqlx::query_as(
            "SELECT * FROM scan_batches WHERE teacher_id = $1 AND mode = $2 ORDER BY created_at DESC LIMIT $3"
        )
        .bind(&auth.teacher_id)
        .bind(mode)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else if let Some(status) = &query.status {
        sqlx::query_as(
            "SELECT * FROM scan_batches WHERE teacher_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3"
        )
        .bind(&auth.teacher_id)
        .bind(status)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as(
            "SELECT * FROM scan_batches WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT $2"
        )
        .bind(&auth.teacher_id)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    }
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    Ok(Json(batches.into_iter().map(ScanBatchResponse::from).collect()))
}

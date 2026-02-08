use axum::{
    extract::{Extension, Multipart, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::TeacherAuth,
    models::{
        ConditionalResponseSummary, ConditionalStyleModel, CorrectionResponse,
        DeepModelSummary, ExtractionResponse, GenerateTestResponse, LearnFromCorrectionRequest,
        StyleAnnotation, StyleOverrides, StyleProfile, StyleProfileResponse, StyleSample,
        StyleSampleResponse, StyleTest, SubmitTestRequest, SynthesisResponse,
        TestItem, TestItemResponse, TestResults, TestResultsResponse, TestStyleRequest,
        TestStyleResponse, UpdateStyleOverrides, UpdateStyleProfile,
    },
    AppState,
};

// ==================== 1. Upload Style Sample ====================

/// POST /api/teacher/style/upload - Upload scanned graded paper for style extraction
pub async fn upload_style_sample(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    mut multipart: Multipart,
) -> Result<Json<StyleSampleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_type: Option<String> = None;
    let mut file_name: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to process upload"})))
    })? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
            file_name = field.file_name().map(|s| s.to_string());
            file_type = Some(content_type);
            file_bytes = Some(field.bytes().await.map_err(|e| {
                tracing::error!("Failed to read file: {}", e);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read file"})))
            })?.to_vec());
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "File is required"})))
    })?;
    let file_type = file_type.unwrap_or_else(|| "image/jpeg".to_string());

    // Validate file type
    let valid_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if !valid_types.iter().any(|t| file_type.starts_with(t)) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "File must be JPEG, PNG, WebP, or PDF"}))));
    }

    // Determine media type for Claude Vision
    let media_type = if file_type.starts_with("image/jpeg") {
        "image/jpeg"
    } else if file_type.starts_with("image/png") {
        "image/png"
    } else if file_type.starts_with("image/webp") {
        "image/webp"
    } else {
        // For PDF, we'd need to convert to image first; for now treat as jpeg
        "image/jpeg"
    };

    // Encode as base64 for Claude Vision
    use base64::Engine;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&file_bytes);

    // Get teacher's grade level from their classes
    let grade_level: Option<i32> = sqlx::query_scalar(
        "SELECT grade FROM classes WHERE teacher_id = $1 LIMIT 1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let grade_level = grade_level.unwrap_or(3);

    // Call Claude Vision to extract style (backward-compatible simple profile)
    let style_result = state.style_ai_service.extract_style_from_image(
        &base64_data,
        media_type,
        grade_level,
        "math",
    ).await;

    let (extracted_annotations, feedback_patterns, processed) = match style_result {
        Ok(profile) => {
            let annotations = serde_json::to_string(&json!({
                "praise_phrases": profile.praise_phrases,
                "correction_phrases": profile.correction_phrases,
                "common_annotations": profile.common_annotations,
                "visual_markers": profile.visual_markers,
            })).unwrap_or_else(|_| "{}".to_string());

            let patterns = serde_json::to_string(&json!({
                "tone": profile.tone,
                "correction_style": profile.correction_style,
                "strictness": profile.strictness,
                "feedback_length": profile.feedback_length,
                "differentiation_notes": profile.differentiation_notes,
            })).unwrap_or_else(|_| "{}".to_string());

            // Aggregate into teacher's style profile
            let current_profile_str: Option<String> = sqlx::query_scalar(
                "SELECT style_profile::text FROM teachers WHERE id = $1"
            )
            .bind(&auth.teacher_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            let current_profile: StyleProfile = current_profile_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();

            let aggregated = crate::services::StyleAIService::aggregate_style(&current_profile, &profile);
            let aggregated_json = serde_json::to_string(&aggregated).unwrap_or_else(|_| "{}".to_string());

            // Update teacher's style profile
            sqlx::query(
                "UPDATE teachers SET style_profile = $1::jsonb, style_confidence = $2 WHERE id = $3"
            )
            .bind(&aggregated_json)
            .bind(aggregated.confidence_score)
            .bind(&auth.teacher_id)
            .execute(&state.db)
            .await
            .ok();

            (annotations, patterns, true)
        }
        Err(e) => {
            tracing::error!("Style extraction failed: {}", e);
            ("{}".to_string(), "{}".to_string(), false)
        }
    };

    // Save the sample record
    let sample_id = Uuid::new_v4().to_string();
    let file_path = format!("style_samples/{}/{}", auth.teacher_id, file_name.unwrap_or_else(|| format!("{}.jpg", sample_id)));

    sqlx::query(
        "INSERT INTO style_samples (id, teacher_id, file_path, file_type, extracted_annotations, feedback_patterns, processed, extraction_status) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'pending')"
    )
    .bind(&sample_id)
    .bind(&auth.teacher_id)
    .bind(&file_path)
    .bind(&file_type)
    .bind(&extracted_annotations)
    .bind(&feedback_patterns)
    .bind(processed)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save sample"})))
    })?;

    let sample: StyleSample = sqlx::query_as(
        "SELECT id, teacher_id, file_path, file_type, extracted_annotations::text, feedback_patterns::text, processed, extraction_status, raw_extraction::text, error_message, created_at FROM style_samples WHERE id = $1"
    )
    .bind(&sample_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch sample"})))
    })?;

    // Trigger Tier 1 extraction in background
    let bg_state = state.clone();
    let bg_teacher_id = auth.teacher_id.clone();
    let bg_sample_id = sample_id.clone();
    let bg_base64 = base64_data.clone();
    let bg_media_type = media_type.to_string();
    let bg_grade = grade_level;
    tokio::spawn(async move {
        tracing::info!("Starting Tier 1 extraction for sample {}", bg_sample_id);
        match bg_state.style_ai_service.extract_annotations_tier1(
            &bg_base64,
            &bg_media_type,
            bg_grade,
            "math",
        ).await {
            Ok(extraction) => {
                let raw_json = serde_json::to_string(&extraction).unwrap_or_else(|_| "{}".to_string());

                // Store each annotation in style_annotations
                let mut annotation_count: i64 = 0;
                for ann in &extraction.annotations {
                    let ann_id = Uuid::new_v4().to_string();
                    let ctx = &ann.student_context;
                    let student_work = ctx.as_ref().and_then(|c| c.student_work_nearby.clone());
                    let was_correct = ctx.as_ref().and_then(|c| c.was_correct);
                    let error_type = ctx.as_ref().and_then(|c| c.error_type.clone());
                    let subject_area = ctx.as_ref().and_then(|c| c.subject_area.clone());
                    let work_shown = ctx.as_ref().and_then(|c| c.work_shown);

                    let insert_result = sqlx::query(
                        "INSERT INTO style_annotations (id, sample_id, teacher_id, annotation_text, annotation_type, location, student_work_nearby, student_was_correct, error_type, subject_area, work_shown, apparent_intent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
                    )
                    .bind(&ann_id)
                    .bind(&bg_sample_id)
                    .bind(&bg_teacher_id)
                    .bind(&ann.annotation_text)
                    .bind(&ann.annotation_type)
                    .bind(&ann.location)
                    .bind(&student_work)
                    .bind(was_correct)
                    .bind(&error_type)
                    .bind(&subject_area)
                    .bind(work_shown)
                    .bind(&ann.apparent_intent)
                    .execute(&bg_state.db)
                    .await;

                    if let Err(e) = insert_result {
                        tracing::error!("Failed to insert annotation: {}", e);
                    } else {
                        annotation_count += 1;
                    }
                }

                // Update sample extraction status
                let _ = sqlx::query(
                    "UPDATE style_samples SET extraction_status = 'completed', raw_extraction = $1::jsonb WHERE id = $2"
                )
                .bind(&raw_json)
                .bind(&bg_sample_id)
                .execute(&bg_state.db)
                .await;

                tracing::info!("Tier 1 extraction completed for sample {}: {} annotations", bg_sample_id, annotation_count);

                // Check if total annotations cross auto-synthesis thresholds (10, 25, 50, 100)
                let total_count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM style_annotations WHERE teacher_id = $1"
                )
                .bind(&bg_teacher_id)
                .fetch_one(&bg_state.db)
                .await
                .unwrap_or(0);

                let previous_count = total_count - annotation_count;
                let thresholds = [10i64, 25, 50, 100];
                let should_synthesize = thresholds.iter().any(|&t| previous_count < t && total_count >= t);

                if should_synthesize {
                    tracing::info!("Auto-triggering synthesis for teacher {} (total annotations: {})", bg_teacher_id, total_count);
                    let _ = run_synthesis(&bg_state, &bg_teacher_id).await;
                }
            }
            Err(e) => {
                tracing::error!("Tier 1 extraction failed for sample {}: {}", bg_sample_id, e);
                let _ = sqlx::query(
                    "UPDATE style_samples SET extraction_status = 'failed', error_message = $1 WHERE id = $2"
                )
                .bind(&e.to_string())
                .bind(&bg_sample_id)
                .execute(&bg_state.db)
                .await;
            }
        }
    });

    Ok(Json(StyleSampleResponse::from(sample)))
}

// ==================== 2. Extract Samples (Tier 1) ====================

/// POST /api/teacher/style/extract - Trigger Tier 1 extraction for pending samples
pub async fn extract_samples(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<ExtractionResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Find all pending samples for this teacher
    let pending_samples: Vec<StyleSample> = sqlx::query_as(
        "SELECT id, teacher_id, file_path, file_type, extracted_annotations::text, feedback_patterns::text, processed, extraction_status, raw_extraction::text, error_message, created_at FROM style_samples WHERE teacher_id = $1 AND (extraction_status = 'pending' OR extraction_status IS NULL) ORDER BY created_at ASC"
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch pending samples"})))
    })?;

    if pending_samples.is_empty() {
        return Ok(Json(ExtractionResponse {
            processed: 0,
            annotations_extracted: 0,
            synthesis_triggered: false,
        }));
    }

    // Get teacher's grade level
    let grade_level: Option<i32> = sqlx::query_scalar(
        "SELECT grade FROM classes WHERE teacher_id = $1 LIMIT 1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();
    let grade_level = grade_level.unwrap_or(3);

    let mut total_processed: i64 = 0;
    let mut total_annotations: i64 = 0;

    for sample in &pending_samples {
        // Skip if no file_path available
        if sample.file_path.is_empty() {
            continue;
        }

        // Mark as extracting
        let _ = sqlx::query(
            "UPDATE style_samples SET extraction_status = 'extracting' WHERE id = $1"
        )
        .bind(&sample.id)
        .execute(&state.db)
        .await;

        // Try to load image data from the raw_extraction field if it contains base64,
        // otherwise we need the file. For uploaded samples, we stored the image at upload time
        // and the base64 was used directly. We'll re-read from extracted_annotations
        // for the image data. In practice, the image bytes should be available from the
        // upload flow. Here we attempt to read from file system or skip.
        let image_data = match tokio::fs::read(&sample.file_path).await {
            Ok(bytes) => {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD.encode(&bytes)
            }
            Err(_) => {
                tracing::warn!("Could not read file for sample {}: {}", sample.id, sample.file_path);
                let _ = sqlx::query(
                    "UPDATE style_samples SET extraction_status = 'failed', error_message = 'File not found on disk' WHERE id = $1"
                )
                .bind(&sample.id)
                .execute(&state.db)
                .await;
                continue;
            }
        };

        let media_type = if sample.file_type.starts_with("image/jpeg") {
            "image/jpeg"
        } else if sample.file_type.starts_with("image/png") {
            "image/png"
        } else if sample.file_type.starts_with("image/webp") {
            "image/webp"
        } else {
            "image/jpeg"
        };

        match state.style_ai_service.extract_annotations_tier1(
            &image_data,
            media_type,
            grade_level,
            "math",
        ).await {
            Ok(extraction) => {
                let raw_json = serde_json::to_string(&extraction).unwrap_or_else(|_| "{}".to_string());

                let mut sample_annotations: i64 = 0;
                for ann in &extraction.annotations {
                    let ann_id = Uuid::new_v4().to_string();
                    let ctx = &ann.student_context;
                    let student_work = ctx.as_ref().and_then(|c| c.student_work_nearby.clone());
                    let was_correct = ctx.as_ref().and_then(|c| c.was_correct);
                    let error_type = ctx.as_ref().and_then(|c| c.error_type.clone());
                    let subject_area = ctx.as_ref().and_then(|c| c.subject_area.clone());
                    let work_shown = ctx.as_ref().and_then(|c| c.work_shown);

                    let insert_result = sqlx::query(
                        "INSERT INTO style_annotations (id, sample_id, teacher_id, annotation_text, annotation_type, location, student_work_nearby, student_was_correct, error_type, subject_area, work_shown, apparent_intent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
                    )
                    .bind(&ann_id)
                    .bind(&sample.id)
                    .bind(&auth.teacher_id)
                    .bind(&ann.annotation_text)
                    .bind(&ann.annotation_type)
                    .bind(&ann.location)
                    .bind(&student_work)
                    .bind(was_correct)
                    .bind(&error_type)
                    .bind(&subject_area)
                    .bind(work_shown)
                    .bind(&ann.apparent_intent)
                    .execute(&state.db)
                    .await;

                    if let Err(e) = insert_result {
                        tracing::error!("Failed to insert annotation: {}", e);
                    } else {
                        sample_annotations += 1;
                    }
                }

                // Update sample status
                let _ = sqlx::query(
                    "UPDATE style_samples SET extraction_status = 'completed', raw_extraction = $1::jsonb WHERE id = $2"
                )
                .bind(&raw_json)
                .bind(&sample.id)
                .execute(&state.db)
                .await;

                total_processed += 1;
                total_annotations += sample_annotations;
            }
            Err(e) => {
                tracing::error!("Tier 1 extraction failed for sample {}: {}", sample.id, e);
                let _ = sqlx::query(
                    "UPDATE style_samples SET extraction_status = 'failed', error_message = $1 WHERE id = $2"
                )
                .bind(&e.to_string())
                .bind(&sample.id)
                .execute(&state.db)
                .await;
            }
        }
    }

    // Check if we should auto-trigger synthesis
    let total_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM style_annotations WHERE teacher_id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let previous_count = total_count - total_annotations;
    let thresholds = [10i64, 25, 50, 100];
    let synthesis_triggered = thresholds.iter().any(|&t| previous_count < t && total_count >= t);

    if synthesis_triggered {
        tracing::info!("Auto-triggering synthesis for teacher {} (total annotations: {})", auth.teacher_id, total_count);
        let bg_state = state.clone();
        let bg_teacher_id = auth.teacher_id.clone();
        tokio::spawn(async move {
            let _ = run_synthesis(&bg_state, &bg_teacher_id).await;
        });
    }

    Ok(Json(ExtractionResponse {
        processed: total_processed,
        annotations_extracted: total_annotations,
        synthesis_triggered,
    }))
}

// ==================== 3. Synthesize Style (Tier 2) ====================

/// POST /api/teacher/style/synthesize - Trigger Tier 2 synthesis
pub async fn synthesize_style(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<SynthesisResponse>, (StatusCode, Json<serde_json::Value>)> {
    run_synthesis(&state, &auth.teacher_id).await
}

/// Internal helper: run full synthesis pipeline
async fn run_synthesis(
    state: &AppState,
    teacher_id: &str,
) -> Result<Json<SynthesisResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Load ALL style_annotations for this teacher
    let annotations: Vec<StyleAnnotation> = sqlx::query_as(
        "SELECT id, sample_id, teacher_id, annotation_text, annotation_type, location, student_work_nearby, student_was_correct, error_type, subject_area, work_shown, apparent_intent, created_at FROM style_annotations WHERE teacher_id = $1 ORDER BY created_at ASC"
    )
    .bind(teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch annotations"})))
    })?;

    if annotations.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No annotations available for synthesis. Upload and extract samples first."}))));
    }

    let annotation_count = annotations.len() as i64;
    let annotations_json = serde_json::to_string(&annotations).unwrap_or_else(|_| "[]".to_string());

    // Count distinct samples
    let sample_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT sample_id) FROM style_annotations WHERE teacher_id = $1 AND sample_id IS NOT NULL"
    )
    .bind(teacher_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // Load unapplied corrections
    let corrections: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT ai_feedback, teacher_feedback, correction_analysis::text FROM style_corrections WHERE teacher_id = $1 AND applied_to_model = false ORDER BY created_at ASC"
    )
    .bind(teacher_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let corrections_json = if corrections.is_empty() {
        None
    } else {
        let corr_data: Vec<serde_json::Value> = corrections.iter().map(|(ai, teacher, analysis)| {
            json!({
                "ai_feedback": ai,
                "teacher_feedback": teacher,
                "analysis": serde_json::from_str::<serde_json::Value>(analysis).unwrap_or_default()
            })
        }).collect();
        Some(serde_json::to_string(&corr_data).unwrap_or_else(|_| "[]".to_string()))
    };

    // Get teacher's grade level
    let grade_level: Option<i32> = sqlx::query_scalar(
        "SELECT grade FROM classes WHERE teacher_id = $1 LIMIT 1"
    )
    .bind(teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();
    let grade_level = grade_level.unwrap_or(3);

    // Call Tier 2 synthesis
    let model = state.style_ai_service.synthesize_style_tier2(
        &annotations_json,
        annotation_count,
        sample_count,
        grade_level,
        "math",
        corrections_json.as_deref(),
    ).await.map_err(|e| {
        tracing::error!("Tier 2 synthesis failed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Synthesis failed: {}", e)})))
    })?;

    let confidence = crate::services::StyleAIService::calculate_confidence(&model);
    let model_json = serde_json::to_string(&model).unwrap_or_else(|_| "{}".to_string());

    // Extract gaps from the model
    let gaps: Vec<String> = model.confidence_assessment.as_ref()
        .and_then(|ca| ca.gaps.clone())
        .unwrap_or_default();
    let gaps_clone = gaps.clone();

    // Store synthesis record
    let synthesis_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO style_syntheses (id, teacher_id, sample_count, annotation_count, model_output, confidence_score, gaps) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)"
    )
    .bind(&synthesis_id)
    .bind(teacher_id)
    .bind(sample_count as i32)
    .bind(annotation_count as i32)
    .bind(&model_json)
    .bind(confidence)
    .bind(&gaps)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store synthesis: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to store synthesis"})))
    })?;

    // Update teacher's style_model, style_confidence, style_updated_at
    sqlx::query(
        "UPDATE teachers SET style_model = $1::jsonb, style_confidence = $2, style_updated_at = NOW() WHERE id = $3"
    )
    .bind(&model_json)
    .bind(confidence)
    .bind(teacher_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update teacher model: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update teacher model"})))
    })?;

    // Mark corrections as applied
    if !corrections.is_empty() {
        let _ = sqlx::query(
            "UPDATE style_corrections SET applied_to_model = true WHERE teacher_id = $1 AND applied_to_model = false"
        )
        .bind(teacher_id)
        .execute(&state.db)
        .await;
    }

    // Invalidate cache
    state.style_ai_service.cache.invalidate(teacher_id).await;

    let conditional_responses_count = model.conditional_responses.len();
    let voice_description = model.voice_description.clone();

    Ok(Json(SynthesisResponse {
        synthesis_id,
        annotations_analyzed: annotation_count,
        samples_analyzed: sample_count,
        confidence,
        gaps: gaps_clone,
        voice_description,
        conditional_responses_count,
    }))
}

// ==================== 4. Get Style Profile (Enhanced) ====================

/// GET /api/teacher/style/profile - Get current style profile with deep model summary
pub async fn get_style_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<StyleProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct TeacherStyle {
        style_profile: Option<String>,
        style_confidence: Option<f64>,
        style_model: Option<String>,
        style_overrides: Option<String>,
        style_updated_at: Option<chrono::DateTime<chrono::Utc>>,
    }

    let teacher_style: Option<TeacherStyle> = sqlx::query_as(
        "SELECT style_profile::text, style_confidence, style_model::text, style_overrides::text, style_updated_at FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch style profile"})))
    })?;

    let (profile, confidence, style_model_opt, overrides, style_updated_at) = match teacher_style {
        Some(ts) => {
            let profile: StyleProfile = ts.style_profile
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            let confidence = ts.style_confidence.unwrap_or(0.0);
            let style_model: Option<ConditionalStyleModel> = ts.style_model
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            let overrides: StyleOverrides = ts.style_overrides
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_default();
            (profile, confidence, style_model, overrides, ts.style_updated_at)
        }
        None => (StyleProfile::default(), 0.0, None, StyleOverrides::default(), None),
    };

    // Count annotations
    let annotation_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM style_annotations WHERE teacher_id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // Count unapplied corrections
    let correction_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM style_corrections WHERE teacher_id = $1 AND applied_to_model = false"
    )
    .bind(&auth.teacher_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // Build DeepModelSummary if we have a style model
    let (has_deep_model, deep_model) = match style_model_opt {
        Some(ref model) if !model.voice_description.is_empty() => {
            let conditional_responses: Vec<ConditionalResponseSummary> = model.conditional_responses.iter().map(|cr| {
                ConditionalResponseSummary {
                    condition: cr.condition.clone(),
                    description: cr.description.clone(),
                    response_type: cr.response_type.clone(),
                    example_phrases: cr.example_phrases.clone(),
                    evidence_count: cr.evidence_count,
                }
            }).collect();

            let gaps = model.confidence_assessment.as_ref()
                .and_then(|ca| ca.gaps.clone())
                .unwrap_or_default();

            let summary = DeepModelSummary {
                voice_description: model.voice_description.clone(),
                conditional_responses,
                gaps,
                last_synthesized: style_updated_at.map(|dt| dt.to_rfc3339()),
            };
            (true, Some(summary))
        }
        _ => (false, None),
    };

    // Get a brief summary of recent corrections if any
    let recent_corrections_summary = if correction_count > 0 {
        let recent: Vec<(String,)> = sqlx::query_as(
            "SELECT teacher_feedback FROM style_corrections WHERE teacher_id = $1 AND applied_to_model = false ORDER BY created_at DESC LIMIT 3"
        )
        .bind(&auth.teacher_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        if recent.is_empty() {
            None
        } else {
            Some(format!("{} unapplied correction(s). Recent: {}", correction_count,
                recent.iter().map(|(f,)| {
                    if f.len() > 60 { format!("{}...", &f[..60]) } else { f.clone() }
                }).collect::<Vec<_>>().join("; ")
            ))
        }
    } else {
        None
    };

    Ok(Json(StyleProfileResponse {
        sample_count: profile.sample_count,
        profile,
        confidence,
        has_deep_model,
        deep_model,
        overrides,
        annotation_count,
        correction_count,
        recent_corrections_summary,
    }))
}

// ==================== 5. Update Style Profile ====================

/// PUT /api/teacher/style/profile - Update/override style profile
pub async fn update_style_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<UpdateStyleProfile>,
) -> Result<Json<StyleProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Get current profile
    let current_str: Option<String> = sqlx::query_scalar(
        "SELECT style_profile::text FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let mut profile: StyleProfile = current_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Apply overrides
    if let Some(tone) = payload.tone {
        profile.tone = tone;
    }
    if let Some(phrases) = payload.praise_phrases {
        profile.praise_phrases = phrases;
    }
    if let Some(phrases) = payload.correction_phrases {
        profile.correction_phrases = phrases;
    }
    if let Some(style) = payload.correction_style {
        profile.correction_style = style;
    }
    if let Some(strictness) = payload.strictness {
        profile.strictness = strictness;
    }
    if let Some(annotations) = payload.common_annotations {
        profile.common_annotations = annotations;
    }
    if let Some(markers) = payload.visual_markers {
        profile.visual_markers = markers;
    }
    if let Some(length) = payload.feedback_length {
        profile.feedback_length = length;
    }
    if let Some(notes) = payload.differentiation_notes {
        profile.differentiation_notes = notes;
    }

    let profile_json = serde_json::to_string(&profile).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        "UPDATE teachers SET style_profile = $1::jsonb WHERE id = $2"
    )
    .bind(&profile_json)
    .bind(&auth.teacher_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update style profile"})))
    })?;

    // Return full profile response by calling get_style_profile logic
    // For simplicity, we re-fetch via the full handler
    get_style_profile(State(state), Extension(auth)).await
}

// ==================== 6. Update Style Overrides ====================

/// PUT /api/teacher/style/overrides - Save always_say, never_say, etc.
pub async fn update_style_overrides(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<UpdateStyleOverrides>,
) -> Result<Json<StyleOverrides>, (StatusCode, Json<serde_json::Value>)> {
    // Get current overrides
    let current_str: Option<String> = sqlx::query_scalar(
        "SELECT style_overrides::text FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let mut overrides: StyleOverrides = current_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Apply updates
    if let Some(always_say) = payload.always_say {
        overrides.always_say = always_say;
    }
    if let Some(never_say) = payload.never_say {
        overrides.never_say = never_say;
    }
    if let Some(feedback_length) = payload.feedback_length {
        overrides.feedback_length = Some(feedback_length);
    }
    if let Some(grading_priorities) = payload.grading_priorities {
        overrides.grading_priorities = grading_priorities;
    }

    let overrides_json = serde_json::to_string(&overrides).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        "UPDATE teachers SET style_overrides = $1::jsonb WHERE id = $2"
    )
    .bind(&overrides_json)
    .bind(&auth.teacher_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to update style overrides"})))
    })?;

    // Invalidate cache so grading picks up new overrides
    state.style_ai_service.cache.invalidate(&auth.teacher_id).await;

    Ok(Json(overrides))
}

// ==================== 7. Test Style (Simple) ====================

/// POST /api/teacher/style/test - Test style with sample student work
pub async fn test_style(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<TestStyleRequest>,
) -> Result<Json<TestStyleResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Get current profile
    let current_str: Option<String> = sqlx::query_scalar(
        "SELECT style_profile::text FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let profile: StyleProfile = current_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let student_name = payload.student_name.unwrap_or_else(|| "Student".to_string());
    let grade_level = payload.grade_level.unwrap_or(3);
    let subject = payload.subject.unwrap_or_else(|| "math".to_string());

    let feedback = state.style_ai_service.test_style(
        &profile,
        &payload.student_work,
        &student_name,
        grade_level,
        &subject,
    ).await.map_err(|e| {
        tracing::error!("Style test failed: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to generate test feedback: {}", e)})))
    })?;

    Ok(Json(TestStyleResponse {
        feedback,
        style_applied: profile.sample_count > 0,
    }))
}

// ==================== 8. Generate Style Test (Blind Test) ====================

/// POST /api/teacher/style/test/generate - Generate blind test with AI + real annotations
pub async fn generate_style_test(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<GenerateTestResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Load the teacher's style model
    let model_str: Option<String> = sqlx::query_scalar(
        "SELECT style_model::text FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let style_model: ConditionalStyleModel = model_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    if style_model.voice_description.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No style model available. Run synthesis first."}))));
    }

    // Get teacher's grade level
    let grade_level: Option<i32> = sqlx::query_scalar(
        "SELECT grade FROM classes WHERE teacher_id = $1 LIMIT 1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();
    let grade_level = grade_level.unwrap_or(3);

    // Create 5 test items: 3 AI-generated, 2 real annotations from DB
    let mut test_items: Vec<TestItem> = Vec::new();
    let mut item_id_counter = 1;

    // Generate 3 AI test items using the style model
    let scenarios = vec![
        ("3 + 5 = 7", "minor arithmetic error, student showed work"),
        ("12 x 4 = 48, with all work shown neatly", "correct answer with work shown"),
        ("Word problem left blank, student wrote 'I don't know'", "no attempt, student gave up"),
    ];

    for (student_work, error_context) in &scenarios {
        match state.style_ai_service.generate_test_feedback(
            &style_model,
            student_work,
            error_context,
            grade_level,
        ).await {
            Ok(feedback) => {
                test_items.push(TestItem {
                    item_id: item_id_counter,
                    student_work: student_work.to_string(),
                    error_context: Some(error_context.to_string()),
                    feedback,
                    source: "ai".to_string(),
                });
                item_id_counter += 1;
            }
            Err(e) => {
                tracing::error!("Failed to generate test item: {}", e);
            }
        }
    }

    // Get 2 real annotations from DB that have written comments
    let real_annotations: Vec<StyleAnnotation> = sqlx::query_as(
        "SELECT id, sample_id, teacher_id, annotation_text, annotation_type, location, student_work_nearby, student_was_correct, error_type, subject_area, work_shown, apparent_intent, created_at FROM style_annotations WHERE teacher_id = $1 AND annotation_text IS NOT NULL AND annotation_text != '' AND annotation_type = 'written_comment' ORDER BY RANDOM() LIMIT 2"
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for ann in &real_annotations {
        let student_work = ann.student_work_nearby.clone()
            .unwrap_or_else(|| "Student work near this annotation".to_string());
        let error_context = format!(
            "{}{}",
            ann.apparent_intent.clone().unwrap_or_default(),
            ann.error_type.as_ref().map(|e| format!(", error: {}", e)).unwrap_or_default()
        );
        let feedback = ann.annotation_text.clone().unwrap_or_default();

        test_items.push(TestItem {
            item_id: item_id_counter,
            student_work,
            error_context: Some(error_context),
            feedback,
            source: "real".to_string(),
        });
        item_id_counter += 1;
    }

    // If we don't have enough real annotations, fill with more AI items
    while test_items.len() < 5 {
        let fallback_work = format!("25 - 18 = {}", if test_items.len() % 2 == 0 { "7" } else { "13" });
        let fallback_context = if test_items.len() % 2 == 0 {
            "correct answer"
        } else {
            "subtraction with regrouping error"
        };

        match state.style_ai_service.generate_test_feedback(
            &style_model,
            &fallback_work,
            fallback_context,
            grade_level,
        ).await {
            Ok(feedback) => {
                test_items.push(TestItem {
                    item_id: item_id_counter,
                    student_work: fallback_work,
                    error_context: Some(fallback_context.to_string()),
                    feedback,
                    source: "ai".to_string(),
                });
                item_id_counter += 1;
            }
            Err(e) => {
                tracing::error!("Failed to generate fallback test item: {}", e);
                break;
            }
        }
    }

    // Shuffle test items deterministically using a simple Fisher-Yates with index swap
    // We'll use a seeded approach based on teacher_id hash
    let len = test_items.len();
    if len > 1 {
        let seed: usize = auth.teacher_id.bytes().map(|b| b as usize).sum::<usize>()
            + chrono::Utc::now().timestamp() as usize;
        for i in (1..len).rev() {
            let j = (seed.wrapping_mul(i + 7)) % (i + 1);
            test_items.swap(i, j);
        }
        // Re-assign item_ids after shuffle
        for (idx, item) in test_items.iter_mut().enumerate() {
            item.item_id = (idx + 1) as i32;
        }
    }

    // Store test in DB
    let test_id = Uuid::new_v4().to_string();
    let test_items_json = serde_json::to_string(&test_items).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO style_tests (id, teacher_id, test_items) VALUES ($1, $2, $3::jsonb)"
    )
    .bind(&test_id)
    .bind(&auth.teacher_id)
    .bind(&test_items_json)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store style test: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create test"})))
    })?;

    // Return items WITHOUT revealing source
    let response_items: Vec<TestItemResponse> = test_items.iter().map(|item| {
        TestItemResponse {
            item_id: item.item_id,
            student_work: item.student_work.clone(),
            error_context: item.error_context.clone(),
            feedback: item.feedback.clone(),
        }
    }).collect();

    Ok(Json(GenerateTestResponse {
        test_id,
        items: response_items,
    }))
}

// ==================== 9. Submit Style Test ====================

/// POST /api/teacher/style/test/:id/submit - Rate test items
pub async fn submit_style_test(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(test_id): Path<String>,
    Json(payload): Json<SubmitTestRequest>,
) -> Result<Json<TestResultsResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Load the test
    let test: StyleTest = sqlx::query_as(
        "SELECT id, teacher_id, test_items::text, results::text, approval_rate, corrections_made::text, created_at FROM style_tests WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&test_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch test"})))
    })?
    .ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Test not found"})))
    })?;

    // Parse test items
    let test_items: Vec<TestItem> = serde_json::from_str(&test.test_items)
        .unwrap_or_default();

    if test_items.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Test has no items"}))));
    }

    // Compute results by comparing ratings with source
    let mut ai_items_approved = 0i32;
    let mut ai_items_total = 0i32;
    let mut real_items_approved = 0i32;
    let mut real_items_total = 0i32;
    let mut corrections_for_tier4: Vec<serde_json::Value> = Vec::new();

    for rating in &payload.ratings {
        if let Some(item) = test_items.iter().find(|i| i.item_id == rating.item_id) {
            match item.source.as_str() {
                "ai" => {
                    ai_items_total += 1;
                    if rating.sounds_like_me {
                        ai_items_approved += 1;
                    }
                }
                "real" => {
                    real_items_total += 1;
                    if rating.sounds_like_me {
                        real_items_approved += 1;
                    }
                }
                _ => {}
            }

            // Collect corrections for Tier 4 learning
            if let Some(ref change) = rating.what_id_change {
                if !change.is_empty() {
                    corrections_for_tier4.push(json!({
                        "item_id": rating.item_id,
                        "source": item.source,
                        "original_feedback": item.feedback,
                        "what_id_change": change,
                        "student_work": item.student_work,
                        "error_context": item.error_context,
                    }));
                }
            }
        }
    }

    let total_items = ai_items_total + real_items_total;
    let total_approved = ai_items_approved + real_items_approved;
    let pass_rate = if total_items > 0 {
        total_approved as f64 / total_items as f64
    } else {
        0.0
    };

    let confidence_update = if pass_rate >= 0.8 {
        "Style model is performing well. Confidence maintained.".to_string()
    } else if pass_rate >= 0.6 {
        "Style model needs some tuning. Consider uploading more samples or adding overrides.".to_string()
    } else {
        "Style model needs significant improvement. Upload more diverse samples and provide corrections.".to_string()
    };

    let insights = if ai_items_total > 0 && ai_items_approved == ai_items_total {
        "All AI-generated feedback was approved! The model captures your voice well.".to_string()
    } else if ai_items_total > 0 && ai_items_approved == 0 {
        "None of the AI-generated feedback matched your style. The model needs more training data.".to_string()
    } else {
        format!(
            "AI accuracy: {}/{} approved. {} correction(s) submitted for learning.",
            ai_items_approved, ai_items_total, corrections_for_tier4.len()
        )
    };

    let results = TestResults {
        ai_items_approved,
        ai_items_total,
        real_items_approved,
        real_items_total,
        pass_rate,
        confidence_update,
        insights,
    };

    let results_json = serde_json::to_string(&results).unwrap_or_else(|_| "{}".to_string());
    let corrections_json = serde_json::to_string(&corrections_for_tier4).unwrap_or_else(|_| "[]".to_string());

    // Store results
    sqlx::query(
        "UPDATE style_tests SET results = $1::jsonb, approval_rate = $2, corrections_made = $3::jsonb WHERE id = $4"
    )
    .bind(&results_json)
    .bind(pass_rate)
    .bind(&corrections_json)
    .bind(&test_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store test results: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save test results"})))
    })?;

    // Feed corrections to Tier 4 in background
    if !corrections_for_tier4.is_empty() {
        let bg_state = state.clone();
        let bg_teacher_id = auth.teacher_id.clone();
        tokio::spawn(async move {
            for correction in &corrections_for_tier4 {
                let ai_feedback = correction["original_feedback"].as_str().unwrap_or_default();
                let teacher_feedback = correction["what_id_change"].as_str().unwrap_or_default();
                let context = format!(
                    "Student work: {}\nContext: {}",
                    correction["student_work"].as_str().unwrap_or_default(),
                    correction["error_context"].as_str().unwrap_or_default(),
                );

                // Store correction record
                let correction_id = Uuid::new_v4().to_string();
                let analysis_result = bg_state.style_ai_service.analyze_correction_tier4(
                    ai_feedback,
                    teacher_feedback,
                    &context,
                    None,
                ).await;

                let analysis_json = match analysis_result {
                    Ok(analysis) => serde_json::to_string(&analysis).unwrap_or_else(|_| "{}".to_string()),
                    Err(e) => {
                        tracing::error!("Tier 4 analysis failed: {}", e);
                        "{}".to_string()
                    }
                };

                let _ = sqlx::query(
                    "INSERT INTO style_corrections (id, teacher_id, ai_feedback, teacher_feedback, assignment_context, correction_analysis) VALUES ($1, $2, $3, $4, $5, $6::jsonb)"
                )
                .bind(&correction_id)
                .bind(&bg_teacher_id)
                .bind(ai_feedback)
                .bind(teacher_feedback)
                .bind(&context)
                .bind(&analysis_json)
                .execute(&bg_state.db)
                .await;
            }

            // Check if we should auto re-synthesize
            let unapplied_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM style_corrections WHERE teacher_id = $1 AND applied_to_model = false"
            )
            .bind(&bg_teacher_id)
            .fetch_one(&bg_state.db)
            .await
            .unwrap_or(0);

            if unapplied_count >= 5 {
                tracing::info!("Auto re-synthesizing for teacher {} ({} unapplied corrections)", bg_teacher_id, unapplied_count);
                let _ = run_synthesis(&bg_state, &bg_teacher_id).await;
            }
        });
    }

    Ok(Json(TestResultsResponse {
        test_id,
        results,
    }))
}

// ==================== 10. Learn From Correction (Tier 4) ====================

/// POST /api/teacher/style/learn-correction - Submit a correction for Tier 4 learning
pub async fn learn_from_correction(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<LearnFromCorrectionRequest>,
) -> Result<Json<CorrectionResponse>, (StatusCode, Json<serde_json::Value>)> {
    let correction_id = Uuid::new_v4().to_string();

    // Build context string
    let context = format!(
        "{}{}",
        payload.assignment_context.as_deref().unwrap_or(""),
        payload.student_work_summary.as_ref().map(|s| format!("\nStudent work: {}", s)).unwrap_or_default()
    );

    // Analyze the correction with Tier 4
    let analysis_result = state.style_ai_service.analyze_correction_tier4(
        &payload.ai_feedback,
        &payload.teacher_feedback,
        &context,
        None,
    ).await;

    let (analysis_json, insights) = match analysis_result {
        Ok(analysis) => {
            let insights: Vec<String> = analysis.changes_made.iter().map(|c| {
                format!("{}: \"{}\" -> \"{}\"",
                    c.what_changed,
                    c.ai_said.as_deref().unwrap_or(""),
                    c.teacher_said.as_deref().unwrap_or("")
                )
            }).collect();
            let json = serde_json::to_string(&analysis).unwrap_or_else(|_| "{}".to_string());
            (json, insights)
        }
        Err(e) => {
            tracing::error!("Tier 4 analysis failed: {}", e);
            ("{}".to_string(), vec!["Correction recorded but analysis pending.".to_string()])
        }
    };

    // Store correction
    sqlx::query(
        "INSERT INTO style_corrections (id, teacher_id, student_id, submission_id, assignment_context, student_work_summary, ai_feedback, teacher_feedback, correction_analysis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)"
    )
    .bind(&correction_id)
    .bind(&auth.teacher_id)
    .bind(&payload.student_id)
    .bind(&payload.submission_id)
    .bind(&payload.assignment_context)
    .bind(&payload.student_work_summary)
    .bind(&payload.ai_feedback)
    .bind(&payload.teacher_feedback)
    .bind(&analysis_json)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store correction: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save correction"})))
    })?;

    // Check if we have 5+ unapplied corrections and should re-synthesize
    let unapplied_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM style_corrections WHERE teacher_id = $1 AND applied_to_model = false"
    )
    .bind(&auth.teacher_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    if unapplied_count >= 5 {
        tracing::info!("Auto re-synthesizing for teacher {} ({} unapplied corrections)", auth.teacher_id, unapplied_count);
        let bg_state = state.clone();
        let bg_teacher_id = auth.teacher_id.clone();
        tokio::spawn(async move {
            let _ = run_synthesis(&bg_state, &bg_teacher_id).await;
        });
    }

    Ok(Json(CorrectionResponse {
        correction_id,
        insights,
    }))
}

// ==================== 11. List Style Samples (Enhanced) ====================

/// GET /api/teacher/style/samples - List uploaded samples with annotation counts
pub async fn list_style_samples(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<Vec<StyleSampleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let samples: Vec<StyleSample> = sqlx::query_as(
        "SELECT id, teacher_id, file_path, file_type, extracted_annotations::text, feedback_patterns::text, processed, extraction_status, raw_extraction::text, error_message, created_at FROM style_samples WHERE teacher_id = $1 ORDER BY created_at DESC"
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch samples"})))
    })?;

    // Get annotation counts per sample
    let sample_ids: Vec<String> = samples.iter().map(|s| s.id.clone()).collect();

    let mut annotation_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    if !sample_ids.is_empty() {
        let counts: Vec<(String, i64)> = sqlx::query_as(
            "SELECT sample_id, COUNT(*) as count FROM style_annotations WHERE teacher_id = $1 AND sample_id IS NOT NULL GROUP BY sample_id"
        )
        .bind(&auth.teacher_id)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        for (sample_id, count) in counts {
            annotation_counts.insert(sample_id, count);
        }
    }

    let responses: Vec<StyleSampleResponse> = samples.into_iter().map(|s| {
        let count = annotation_counts.get(&s.id).copied().unwrap_or(0);
        s.to_response(count)
    }).collect();

    Ok(Json(responses))
}

// ==================== 12. Delete Style Sample ====================

/// DELETE /api/teacher/style/samples/:id - Remove a sample
pub async fn delete_style_sample(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(sample_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        "DELETE FROM style_samples WHERE id = $1 AND teacher_id = $2"
    )
    .bind(&sample_id)
    .bind(&auth.teacher_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to delete sample"})))
    })?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Sample not found"}))));
    }

    Ok(StatusCode::NO_CONTENT)
}

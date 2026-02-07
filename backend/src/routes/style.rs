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
        StyleProfile, StyleSample, StyleSampleResponse, StyleProfileResponse,
        TestStyleRequest, TestStyleResponse, UpdateStyleProfile,
    },
    AppState,
};

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

    // Call Claude Vision to extract style
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
        "INSERT INTO style_samples (id, teacher_id, file_path, file_type, extracted_annotations, feedback_patterns, processed) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)"
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
        "SELECT id, teacher_id, file_path, file_type, extracted_annotations::text, feedback_patterns::text, processed, created_at FROM style_samples WHERE id = $1"
    )
    .bind(&sample_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch sample"})))
    })?;

    Ok(Json(StyleSampleResponse::from(sample)))
}

/// GET /api/teacher/style/profile - Get current style profile
pub async fn get_style_profile(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<StyleProfileResponse>, (StatusCode, Json<serde_json::Value>)> {
    #[derive(sqlx::FromRow)]
    struct TeacherStyle {
        style_profile: String,
        style_confidence: Option<f64>,
    }

    let teacher_style: Option<TeacherStyle> = sqlx::query_as(
        "SELECT style_profile::text, style_confidence FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch style profile"})))
    })?;

    let (profile, confidence) = match teacher_style {
        Some(ts) => {
            let profile: StyleProfile = serde_json::from_str(&ts.style_profile).unwrap_or_default();
            let confidence = ts.style_confidence.unwrap_or(0.0);
            (profile, confidence)
        }
        None => (StyleProfile::default(), 0.0),
    };

    Ok(Json(StyleProfileResponse {
        sample_count: profile.sample_count,
        profile,
        confidence,
    }))
}

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

    Ok(Json(StyleProfileResponse {
        confidence: profile.confidence_score,
        sample_count: profile.sample_count,
        profile,
    }))
}

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

/// GET /api/teacher/style/samples - List uploaded samples
pub async fn list_style_samples(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<Vec<StyleSampleResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let samples: Vec<StyleSample> = sqlx::query_as(
        "SELECT id, teacher_id, file_path, file_type, extracted_annotations::text, feedback_patterns::text, processed, created_at FROM style_samples WHERE teacher_id = $1 ORDER BY created_at DESC"
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch samples"})))
    })?;

    Ok(Json(samples.into_iter().map(StyleSampleResponse::from).collect()))
}

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

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;

use crate::AppState;

#[derive(Deserialize)]
pub struct TTSRequest {
    pub text: String,
}

pub async fn synthesize_speech(
    State(state): State<AppState>,
    Json(payload): Json<TTSRequest>,
) -> Response {
    // Validate text length (ElevenLabs has limits)
    if payload.text.is_empty() {
        return (StatusCode::BAD_REQUEST, "Text is required").into_response();
    }

    if payload.text.len() > 1000 {
        return (StatusCode::BAD_REQUEST, "Text too long (max 1000 characters)").into_response();
    }

    // Check if TTS is configured
    if !state.tts_service.is_configured() {
        return (StatusCode::SERVICE_UNAVAILABLE, "TTS service not configured").into_response();
    }

    // Generate audio
    match state.tts_service.synthesize(&payload.text).await {
        Ok(audio_bytes) => {
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "audio/mpeg"),
                    (header::CACHE_CONTROL, "public, max-age=86400"), // Cache for 24 hours
                ],
                audio_bytes,
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("TTS synthesis failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("TTS failed: {}", e)).into_response()
        }
    }
}

pub async fn tts_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "configured": state.tts_service.is_configured()
    }))
}

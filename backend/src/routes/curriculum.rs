use axum::{
    extract::Path,
    http::StatusCode,
    routing::get,
    Json, Router,
};
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use std::env;

use crate::models::curriculum::*;
use crate::AppState;

pub fn curriculum_routes() -> Router<AppState> {
    Router::new()
        .route("/curriculum/modules", get(list_modules))
        .route("/curriculum/modules/:id", get(get_module))
        .route("/curriculum/modules/:module_id/lessons/:lesson_num", get(get_lesson))
}

fn get_bucket() -> Result<Bucket, (StatusCode, String)> {
    // Support both custom names and Railway's default AWS_* names
    let bucket_name = env::var("CURRICULUM_BUCKET_NAME")
        .or_else(|_| env::var("AWS_S3_BUCKET_NAME"))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "CURRICULUM_BUCKET_NAME or AWS_S3_BUCKET_NAME not set".to_string()))?;
    let endpoint = env::var("RAILWAY_BUCKET_ENDPOINT")
        .or_else(|_| env::var("AWS_ENDPOINT_URL"))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "RAILWAY_BUCKET_ENDPOINT or AWS_ENDPOINT_URL not set".to_string()))?;
    let access_key = env::var("BUCKET_ACCESS_KEY_ID")
        .or_else(|_| env::var("AWS_ACCESS_KEY_ID"))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "BUCKET_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID not set".to_string()))?;
    let secret_key = env::var("BUCKET_SECRET_ACCESS_KEY")
        .or_else(|_| env::var("AWS_SECRET_ACCESS_KEY"))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "BUCKET_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY not set".to_string()))?;

    let region = Region::Custom {
        region: "auto".to_string(),
        endpoint,
    };

    let credentials = Credentials::new(
        Some(&access_key),
        Some(&secret_key),
        None,
        None,
        None,
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create credentials: {}", e)))?;

    let bucket = Bucket::new(&bucket_name, region, credentials)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create bucket: {}", e)))?
        .with_path_style();

    Ok(bucket)
}

async fn fetch_json<T: serde::de::DeserializeOwned>(path: &str) -> Result<T, (StatusCode, String)> {
    let bucket = get_bucket()?;

    let response = bucket.get_object(path).await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to fetch {}: {}", path, e)))?;

    if response.status_code() != 200 {
        return Err((
            StatusCode::NOT_FOUND,
            format!("Object not found: {} (status: {})", path, response.status_code()),
        ));
    }

    let data: T = serde_json::from_slice(response.bytes())
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse {}: {}", path, e)))?;

    Ok(data)
}

async fn list_modules() -> Result<Json<CurriculumIndex>, (StatusCode, String)> {
    let index: CurriculumIndex = fetch_json("curriculum/index.json").await?;
    Ok(Json(index))
}

async fn get_module(Path(id): Path<String>) -> Result<Json<CurriculumModule>, (StatusCode, String)> {
    let path = format!("curriculum/{}/module.json", id);
    let module: CurriculumModule = fetch_json(&path).await?;
    Ok(Json(module))
}

async fn get_lesson(
    Path((module_id, lesson_num)): Path<(String, i32)>,
) -> Result<Json<CurriculumLesson>, (StatusCode, String)> {
    let path = format!("curriculum/{}/lessons/lesson-{:02}.json", module_id, lesson_num);
    let lesson: CurriculumLesson = fetch_json(&path).await?;
    Ok(Json(lesson))
}

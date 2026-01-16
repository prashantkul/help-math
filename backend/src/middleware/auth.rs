use axum::{
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::AppState;

#[derive(Clone, Debug)]
pub struct TeacherAuth {
    pub teacher_id: Uuid,
}

#[derive(Clone, Debug)]
pub struct StudentAuth {
    pub student_id: Uuid,
}

pub async fn teacher_auth_middleware<B>(
    State(state): State<AppState>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let teacher_id = state
        .auth_service
        .extract_teacher_id(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(TeacherAuth { teacher_id });

    Ok(next.run(request).await)
}

pub async fn student_auth_middleware<B>(
    State(state): State<AppState>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let student_id = state
        .auth_service
        .extract_student_id(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(StudentAuth { student_id });

    Ok(next.run(request).await)
}

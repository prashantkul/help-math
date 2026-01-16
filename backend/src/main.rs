use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[path = "middleware/mod.rs"]
mod app_middleware;
mod models;
mod routes;
mod services;

use services::{AIService, AuthService, GradingService};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub auth_service: Arc<AuthService>,
    pub ai_service: Arc<AIService>,
    pub grading_service: Arc<GradingService>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "math_scaffold_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/math_scaffold".to_string());

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Connected to database");

    // Run migrations (in production, use sqlx migrate)
    sqlx::query(include_str!("../migrations/001_initial_schema.sql"))
        .execute(&db)
        .await
        .ok(); // Ignore errors if tables already exist

    // Initialize services
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-key-change-in-production".to_string());
    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();

    let state = AppState {
        db,
        auth_service: Arc::new(AuthService::new(jwt_secret)),
        ai_service: Arc::new(AIService::new(anthropic_api_key)),
        grading_service: Arc::new(GradingService::new()),
    };

    // Build router
    let app = Router::new()
        // Auth routes (public)
        .route("/api/auth/teacher/register", post(routes::register_teacher))
        .route("/api/auth/teacher/login", post(routes::login_teacher))
        .route("/api/auth/student/join", post(routes::student_join))
        // Teacher routes (protected)
        .nest(
            "/api",
            Router::new()
                .route("/classes", get(routes::list_classes))
                .route("/classes", post(routes::create_class))
                .route("/classes/:id/students", get(routes::get_class_students))
                .route("/classes/:id/students/:student_id", delete(routes::remove_student))
                .route("/classes/:id/settings", put(routes::update_class_settings))
                .route("/problems", get(routes::list_problems))
                .route("/problems", post(routes::create_problem))
                .route("/problems/upload", post(routes::upload_pdf))
                .route("/problems/:id", get(routes::get_problem))
                .route("/problems/:id", put(routes::update_problem))
                .route("/problems/:id", delete(routes::delete_problem))
                .route("/problems/:id/scaffold", post(routes::generate_scaffold))
                .route("/problems/:id/publish", post(routes::publish_problem))
                .route("/assignments", get(routes::list_assignments))
                .route("/assignments", post(routes::create_assignment))
                .route("/analytics/class/:id", get(routes::get_class_analytics))
                .route("/analytics/student/:id", get(routes::get_student_analytics))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    app_middleware::teacher_auth_middleware,
                )),
        )
        // Student routes (protected with student auth)
        .nest(
            "/api/student",
            Router::new()
                .route("/assignments", get(routes::get_student_assignments))
                .route("/problems/:id", get(routes::get_student_problem))
                .route("/problems/:id/attempt", post(routes::submit_step_attempt))
                .route("/progress", get(routes::get_student_progress))
                .route("/profile", get(routes::get_student_profile))
                .route("/avatar", put(routes::update_student_avatar))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    app_middleware::student_auth_middleware,
                )),
        )
        // CORS and tracing
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

use axum::{
    middleware as axum_middleware,
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

use services::{AIService, AuthService, GradingService, TTSService, StyleAIService};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub auth_service: Arc<AuthService>,
    pub ai_service: Arc<AIService>,
    pub grading_service: Arc<GradingService>,
    pub tts_service: Arc<TTSService>,
    pub style_ai_service: Arc<StyleAIService>,
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
        .unwrap_or_else(|_| "postgres://helpmath:helpmath_dev@localhost:5432/helpmath".to_string());

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    tracing::info!("Connected to database");

    // Run migrations - execute each statement separately for PostgreSQL
    let migrations = [
        include_str!("../migrations/001_initial_schema.sql"),
        include_str!("../migrations/002_modules_lessons.sql"),
        include_str!("../migrations/003_seed_data.sql"),
        include_str!("../migrations/004_phase2_features.sql"),
        include_str!("../migrations/005_add_class_grade.sql"),
        include_str!("../migrations/006_soft_delete_classes.sql"),
        include_str!("../migrations/007_module_scaffold_prompt.sql"),
        include_str!("../migrations/008_problem_images.sql"),
        include_str!("../migrations/009_teacher_style_grading.sql"),
    ];

    for migration in migrations {
        for statement in migration.split(';').filter(|s| !s.trim().is_empty()) {
            if let Err(e) = sqlx::query(statement).execute(&db).await {
                // Log but continue - table may already exist
                tracing::debug!("Migration statement skipped: {}", e);
            }
        }
    }

    // Initialize services
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-key-change-in-production".to_string());
    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();
    let eleven_api_key = std::env::var("ELEVEN_API_KEY").unwrap_or_default();
    let eleven_voice_id = std::env::var("ELEVEN_VOICE_ID").unwrap_or_default();

    let state = AppState {
        db,
        auth_service: Arc::new(AuthService::new(jwt_secret)),
        ai_service: Arc::new(AIService::new(anthropic_api_key.clone())),
        grading_service: Arc::new(GradingService::new()),
        tts_service: Arc::new(TTSService::new(eleven_api_key, eleven_voice_id)),
        style_ai_service: Arc::new(StyleAIService::new(anthropic_api_key)),
    };

    // Build protected teacher routes
    let teacher_routes = Router::new()
        .route("/classes", get(routes::list_classes).post(routes::create_class))
        .route("/classes/:id", delete(routes::delete_class))
        .route("/classes/:id/students", get(routes::get_class_students).post(routes::create_student))
        .route("/classes/:id/students/bulk", post(routes::bulk_create_students))
        .route("/classes/:id/students/export", get(routes::export_students))
        .route("/classes/:id/students/:student_id", delete(routes::remove_student))
        .route("/classes/:id/students/:student_id/reset-passcode", post(routes::reset_student_passcode))
        .route("/classes/:id/students/:student_id/roster", put(routes::update_student_roster))
        .route("/classes/:id/settings", put(routes::update_class_settings))
        .route("/classes/:id/coteachers", get(routes::get_co_teachers).post(routes::add_co_teacher))
        .route("/classes/:id/coteachers/:coteacher_id", delete(routes::remove_co_teacher))
        .route("/classes/:id/modules", get(routes::list_modules).post(routes::create_module))
        .route("/modules/:id", get(routes::get_lesson).put(routes::update_module).delete(routes::delete_module))
        .route("/modules/:id/scaffold-preview", post(routes::preview_scaffold))
        .route("/modules/:id/lessons", get(routes::list_lessons).post(routes::create_lesson))
        .route("/lessons/:id", get(routes::get_lesson).put(routes::update_lesson).delete(routes::delete_lesson))
        .route("/lessons/:id/schedule", put(routes::update_lesson_schedule))
        .route("/problems", get(routes::list_problems).post(routes::create_problem))
        .route("/problems/upload", post(routes::upload_pdf))
        .route("/problems/:id", get(routes::get_problem).put(routes::update_problem).delete(routes::delete_problem))
        .route("/problems/:id/scaffold", post(routes::generate_scaffold))
        .route("/problems/:id/publish", post(routes::publish_problem))
        .route("/problems/:id/review", post(routes::review_problem))
        .route("/problems/:id/steps", post(routes::add_scaffold_step))
        .route("/problems/:id/steps/reorder", put(routes::reorder_scaffold_steps))
        .route("/problems/:id/steps/:step_id", put(routes::update_scaffold_step).delete(routes::delete_scaffold_step))
        .route("/assignments", get(routes::list_assignments).post(routes::create_assignment))
        .route("/analytics/class/:id", get(routes::get_class_analytics))
        .route("/analytics/student/:id", get(routes::get_student_analytics))
        // Teacher Style Learning routes
        .route("/teacher/style/upload", post(routes::upload_style_sample))
        .route("/teacher/style/profile", get(routes::get_style_profile).put(routes::update_style_profile))
        .route("/teacher/style/test", post(routes::test_style))
        .route("/teacher/style/samples", get(routes::list_style_samples))
        .route("/teacher/style/samples/:id", delete(routes::delete_style_sample))
        // AI Grading routes
        .route("/teacher/grading/queue", get(routes::get_grading_queue))
        .route("/teacher/grading/:id/ai-grade", post(routes::ai_grade_submission))
        .route("/teacher/grading/:id/approve", put(routes::approve_grading))
        .route("/teacher/grading/:id/reject", put(routes::reject_grading))
        .route("/teacher/grading/batch-approve", post(routes::batch_approve_grading))
        .layer(axum_middleware::from_fn_with_state(state.clone(), app_middleware::teacher_auth_middleware));

    // Build protected student routes
    let student_routes = Router::new()
        .route("/assignments", get(routes::get_student_assignments))
        .route("/problems/:id", get(routes::get_student_problem))
        .route("/problems/:id/attempt", post(routes::submit_step_attempt))
        .route("/progress", get(routes::get_student_progress))
        .route("/profile", get(routes::get_student_profile))
        .route("/avatar", put(routes::update_student_avatar))
        .route("/feedback/:assignment_id", get(routes::get_student_feedback))
        .layer(axum_middleware::from_fn_with_state(state.clone(), app_middleware::student_auth_middleware));

    // Build public auth routes
    let auth_routes = Router::new()
        .route("/teacher/register", post(routes::register_teacher))
        .route("/teacher/login", post(routes::login_teacher))
        .route("/teacher/forgot-password", post(routes::forgot_password))
        .route("/teacher/reset-password", post(routes::reset_password))
        .route("/student/join", post(routes::student_join));

    // Build curriculum routes (public - no auth required)
    let curriculum_routes = routes::curriculum_routes();

    // Build TTS routes (public - no auth required)
    let tts_routes = Router::new()
        .route("/synthesize", post(routes::synthesize_speech))
        .route("/status", get(routes::tts_status));

    // Build main router - auth routes first to avoid conflicts with nested routes
    let app = Router::new()
        .nest("/api/auth", auth_routes)
        .nest("/api/tts", tts_routes)
        .nest("/api", curriculum_routes)
        .nest("/api", teacher_routes)
        .nest("/api/student", student_routes)
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

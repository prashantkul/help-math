use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use rand::Rng;
use serde_json::json;
use uuid::Uuid;

use crate::{
    app_middleware::TeacherAuth,
    models::{AddCoTeacher, Class, ClassResponse, ClassSettings, ClassTeacher, CoTeacherResponse, CreateClass, CreateStudent, Student, TeacherStudentResponse, UpdateClassSettings},
    AppState,
};

fn generate_join_code() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

// Generate a friendly passcode like "bear-7823"
fn generate_passcode() -> String {
    const WORDS: &[&str] = &[
        "bear", "bird", "cat", "dog", "duck", "fish", "frog", "lion",
        "owl", "pig", "star", "sun", "moon", "tree", "rose", "boat",
        "kite", "ball", "bell", "book", "cake", "drum", "flag", "gift",
    ];
    let mut rng = rand::thread_rng();
    let word = WORDS[rng.gen_range(0..WORDS.len())];
    let num: u16 = rng.gen_range(1000..9999);
    format!("{}-{}", word, num)
}

pub async fn list_classes(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<Vec<ClassResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let classes: Vec<Class> = sqlx::query_as(
        "SELECT id, teacher_id, name, join_code, settings, created_at FROM classes WHERE teacher_id = ? ORDER BY created_at DESC"
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch classes"})),
        )
    })?;

    Ok(Json(classes.into_iter().map(ClassResponse::from).collect()))
}

pub async fn create_class(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<CreateClass>,
) -> Result<Json<ClassResponse>, (StatusCode, Json<serde_json::Value>)> {
    if payload.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Class name is required"})),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let join_code = generate_join_code();
    let settings = serde_json::to_string(&ClassSettings::default()).unwrap();

    sqlx::query(
        "INSERT INTO classes (id, teacher_id, name, join_code, settings) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&auth.teacher_id)
    .bind(&payload.name)
    .bind(&join_code)
    .bind(&settings)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create class"})),
        )
    })?;

    let class: Class = sqlx::query_as(
        "SELECT id, teacher_id, name, join_code, settings, created_at FROM classes WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create class"})),
        )
    })?;

    Ok(Json(ClassResponse::from(class)))
}

pub async fn get_class_students(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
) -> Result<Json<Vec<TeacherStudentResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    #[derive(sqlx::FromRow)]
    struct ClassExists {
        id: String,
    }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch students"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let students: Vec<Student> = sqlx::query_as(
        "SELECT id, name, class_id, external_id, passcode, avatar, total_points, created_at FROM students WHERE class_id = ? ORDER BY name"
    )
    .bind(&class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to fetch students"})),
        )
    })?;

    Ok(Json(students.into_iter().map(TeacherStudentResponse::from).collect()))
}

pub async fn create_student(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
    Json(payload): Json<CreateStudent>,
) -> Result<Json<TeacherStudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    if payload.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Student name is required"})),
        ));
    }

    // Verify teacher owns this class
    #[derive(sqlx::FromRow)]
    struct ClassExists {
        id: String,
    }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create student"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let passcode = generate_passcode();

    sqlx::query(
        "INSERT INTO students (id, name, class_id, external_id, passcode) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&class_id)
    .bind(&payload.external_id)
    .bind(&passcode)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create student"})),
        )
    })?;

    let student: Student = sqlx::query_as(
        "SELECT id, name, class_id, external_id, passcode, avatar, total_points, created_at FROM students WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to create student"})),
        )
    })?;

    Ok(Json(TeacherStudentResponse::from(student)))
}

pub async fn reset_student_passcode(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((class_id, student_id)): Path<(String, String)>,
) -> Result<Json<TeacherStudentResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    #[derive(sqlx::FromRow)]
    struct ClassExists {
        id: String,
    }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to reset passcode"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    let new_passcode = generate_passcode();

    sqlx::query("UPDATE students SET passcode = ? WHERE id = ? AND class_id = ?")
        .bind(&new_passcode)
        .bind(&student_id)
        .bind(&class_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to reset passcode"})),
            )
        })?;

    let student: Student = sqlx::query_as(
        "SELECT id, name, class_id, external_id, passcode, avatar, total_points, created_at FROM students WHERE id = ?"
    )
    .bind(&student_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to reset passcode"})),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Student not found"})),
        )
    })?;

    Ok(Json(TeacherStudentResponse::from(student)))
}

pub async fn remove_student(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((class_id, student_id)): Path<(String, String)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Verify teacher owns this class
    #[derive(sqlx::FromRow)]
    struct ClassExists {
        id: String,
    }

    let class_exists: Option<ClassExists> = sqlx::query_as(
        "SELECT id FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to remove student"})),
        )
    })?;

    if class_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    sqlx::query("DELETE FROM students WHERE id = ? AND class_id = ?")
        .bind(&student_id)
        .bind(&class_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to remove student"})),
            )
        })?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_class_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
    Json(payload): Json<UpdateClassSettings>,
) -> Result<Json<ClassResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Get current class
    let current: Option<Class> = sqlx::query_as(
        "SELECT id, teacher_id, name, join_code, settings, created_at FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update settings"})),
        )
    })?;

    let current = current.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        )
    })?;

    // Merge settings
    let mut settings = current.get_settings();
    if let Some(ell_level) = payload.ell_level {
        settings.ell_level = ell_level;
    }
    if let Some(show_emojis) = payload.show_emojis {
        settings.show_emojis = show_emojis;
    }
    if let Some(retry_limit) = payload.retry_limit {
        settings.retry_limit = retry_limit;
    }
    if let Some(point_multiplier) = payload.point_multiplier {
        settings.point_multiplier = point_multiplier;
    }

    let settings_json = serde_json::to_string(&settings).unwrap();

    sqlx::query("UPDATE classes SET settings = ? WHERE id = ? AND teacher_id = ?")
        .bind(&settings_json)
        .bind(&class_id)
        .bind(&auth.teacher_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to update settings"})),
            )
        })?;

    let class: Class = sqlx::query_as(
        "SELECT id, teacher_id, name, join_code, settings, created_at FROM classes WHERE id = ?"
    )
    .bind(&class_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to update settings"})),
        )
    })?;

    Ok(Json(ClassResponse::from(class)))
}

// Helper function to check if teacher can access a class (owner or co-teacher)
async fn can_access_class(
    db: &sqlx::SqlitePool,
    class_id: &str,
    teacher_id: &str,
) -> Result<bool, sqlx::Error> {
    // Check if owner
    let is_owner: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(class_id)
    .bind(teacher_id)
    .fetch_optional(db)
    .await?;

    if is_owner.is_some() {
        return Ok(true);
    }

    // Check if co-teacher
    let is_coteacher: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM class_teachers WHERE class_id = ? AND teacher_id = ?"
    )
    .bind(class_id)
    .bind(teacher_id)
    .fetch_optional(db)
    .await?;

    Ok(is_coteacher.is_some())
}

// Check if teacher is the owner of the class
async fn is_class_owner(
    db: &sqlx::SqlitePool,
    class_id: &str,
    teacher_id: &str,
) -> Result<bool, sqlx::Error> {
    let is_owner: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM classes WHERE id = ? AND teacher_id = ?"
    )
    .bind(class_id)
    .bind(teacher_id)
    .fetch_optional(db)
    .await?;

    Ok(is_owner.is_some())
}

// Add a co-teacher to a class (only class owner can do this)
pub async fn add_co_teacher(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
    Json(payload): Json<AddCoTeacher>,
) -> Result<Json<CoTeacherResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Only class owner can add co-teachers
    let is_owner = is_class_owner(&state.db, &class_id, &auth.teacher_id)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to add co-teacher"})),
            )
        })?;

    if !is_owner {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Only the class owner can add co-teachers"})),
        ));
    }

    // Find teacher by email
    #[derive(sqlx::FromRow)]
    struct TeacherInfo {
        id: String,
        email: String,
        name: String,
    }

    let teacher: Option<TeacherInfo> = sqlx::query_as(
        "SELECT id, email, name FROM teachers WHERE email = ?"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to add co-teacher"})),
        )
    })?;

    let teacher = teacher.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Teacher not found with that email"})),
        )
    })?;

    // Can't add yourself as co-teacher
    if teacher.id == auth.teacher_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "You cannot add yourself as a co-teacher"})),
        ));
    }

    // Check if already a co-teacher
    let already_exists: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM class_teachers WHERE class_id = ? AND teacher_id = ?"
    )
    .bind(&class_id)
    .bind(&teacher.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to add co-teacher"})),
        )
    })?;

    if already_exists.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({"error": "This teacher is already a co-teacher"})),
        ));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO class_teachers (id, class_id, teacher_id, added_by) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&class_id)
    .bind(&teacher.id)
    .bind(&auth.teacher_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to add co-teacher"})),
        )
    })?;

    let coteacher: ClassTeacher = sqlx::query_as(
        "SELECT id, class_id, teacher_id, added_by, created_at FROM class_teachers WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to add co-teacher"})),
        )
    })?;

    Ok(Json(CoTeacherResponse {
        id: coteacher.id,
        teacher_id: teacher.id,
        teacher_email: teacher.email,
        teacher_name: teacher.name,
        added_at: coteacher.created_at,
    }))
}

// Get all co-teachers for a class
pub async fn get_co_teachers(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(class_id): Path<String>,
) -> Result<Json<Vec<CoTeacherResponse>>, (StatusCode, Json<serde_json::Value>)> {
    // Teacher must be owner or co-teacher to see other co-teachers
    let can_access = can_access_class(&state.db, &class_id, &auth.teacher_id)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to get co-teachers"})),
            )
        })?;

    if !can_access {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Class not found"})),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct CoTeacherRow {
        id: String,
        teacher_id: String,
        email: String,
        name: String,
        created_at: String,
    }

    let coteachers: Vec<CoTeacherRow> = sqlx::query_as(
        r#"
        SELECT ct.id, ct.teacher_id, t.email, t.name, ct.created_at
        FROM class_teachers ct
        JOIN teachers t ON ct.teacher_id = t.id
        WHERE ct.class_id = ?
        ORDER BY ct.created_at
        "#
    )
    .bind(&class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to get co-teachers"})),
        )
    })?;

    Ok(Json(coteachers.into_iter().map(|ct| CoTeacherResponse {
        id: ct.id,
        teacher_id: ct.teacher_id,
        teacher_email: ct.email,
        teacher_name: ct.name,
        added_at: ct.created_at,
    }).collect()))
}

// Remove a co-teacher from a class (only class owner can do this)
pub async fn remove_co_teacher(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path((class_id, coteacher_id)): Path<(String, String)>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Only class owner can remove co-teachers
    let is_owner = is_class_owner(&state.db, &class_id, &auth.teacher_id)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to remove co-teacher"})),
            )
        })?;

    if !is_owner {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Only the class owner can remove co-teachers"})),
        ));
    }

    sqlx::query("DELETE FROM class_teachers WHERE id = ? AND class_id = ?")
        .bind(&coteacher_id)
        .bind(&class_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to remove co-teacher"})),
            )
        })?;

    Ok(StatusCode::NO_CONTENT)
}

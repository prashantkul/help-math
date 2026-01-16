use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    models::{
        CreateLesson, CreateModule, Lesson, LessonResponse, Module, ModuleResponse, Teacher,
        UpdateLesson, UpdateModule,
    },
    AppState,
};

// ============ Module Routes ============

pub async fn list_modules(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(class_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access to this class
    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let modules = sqlx::query_as::<_, Module>(
        "SELECT * FROM modules WHERE class_id = ? ORDER BY sort_order, created_at",
    )
    .bind(&class_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get lessons for each module
    let mut responses = Vec::new();
    for module in modules {
        let lessons = sqlx::query_as::<_, Lesson>(
            "SELECT * FROM lessons WHERE module_id = ? ORDER BY sort_order, created_at",
        )
        .bind(&module.id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        responses.push(ModuleResponse::from_module(module, Some(lessons)));
    }

    Ok(Json(responses))
}

pub async fn create_module(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(class_id): Path<String>,
    Json(payload): Json<CreateModule>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access to this class
    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    // Get the next sort order
    let max_order = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(sort_order) FROM modules WHERE class_id = ?",
    )
    .bind(&class_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .unwrap_or(0);

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO modules (id, class_id, name, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&class_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(max_order + 1)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(ModuleResponse::from_module(module, Some(vec![]))),
    ))
}

pub async fn update_module(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(module_id): Path<String>,
    Json(payload): Json<UpdateModule>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access
    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&module_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Module not found".to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    // Build update query dynamically
    let name = payload.name.unwrap_or(module.name);
    let description = payload.description.or(module.description);
    let sort_order = payload.sort_order.unwrap_or(module.sort_order);
    let is_published = payload
        .is_published
        .map(|p| if p { 1 } else { 0 })
        .unwrap_or(module.is_published);

    sqlx::query(
        r#"
        UPDATE modules
        SET name = ?, description = ?, sort_order = ?, is_published = ?
        WHERE id = ?
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(sort_order)
    .bind(is_published)
    .bind(&module_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&module_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let lessons = sqlx::query_as::<_, Lesson>(
        "SELECT * FROM lessons WHERE module_id = ? ORDER BY sort_order, created_at",
    )
    .bind(&module_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ModuleResponse::from_module(updated, Some(lessons))))
}

pub async fn delete_module(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(module_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access
    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&module_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Module not found".to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    sqlx::query("DELETE FROM modules WHERE id = ?")
        .bind(&module_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// ============ Lesson Routes ============

pub async fn list_lessons(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(module_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access via module -> class
    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&module_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Module not found".to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let lessons = sqlx::query_as::<_, Lesson>(
        "SELECT * FROM lessons WHERE module_id = ? ORDER BY sort_order, created_at",
    )
    .bind(&module_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get problem counts for each lesson
    let mut responses = Vec::new();
    for lesson in lessons {
        let count = sqlx::query_scalar::<_, i32>(
            "SELECT COUNT(*) FROM problems WHERE lesson_id = ?",
        )
        .bind(&lesson.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        responses.push(LessonResponse::from_lesson_with_count(lesson, count));
    }

    Ok(Json(responses))
}

pub async fn create_lesson(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(module_id): Path<String>,
    Json(payload): Json<CreateLesson>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access via module -> class
    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&module_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Module not found".to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    // Get the next sort order
    let max_order = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(sort_order) FROM lessons WHERE module_id = ?",
    )
    .bind(&module_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .unwrap_or(0);

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO lessons (id, module_id, name, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&module_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(max_order + 1)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        Json(LessonResponse::from_lesson_with_count(lesson, 0)),
    ))
}

pub async fn update_lesson(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(lesson_id): Path<String>,
    Json(payload): Json<UpdateLesson>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access via lesson -> module -> class
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = ?")
        .bind(&lesson_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Lesson not found".to_string()))?;

    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&lesson.module_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let name = payload.name.unwrap_or(lesson.name);
    let description = payload.description.or(lesson.description);
    let sort_order = payload.sort_order.unwrap_or(lesson.sort_order);
    let is_published = payload
        .is_published
        .map(|p| if p { 1 } else { 0 })
        .unwrap_or(lesson.is_published);

    sqlx::query(
        r#"
        UPDATE lessons
        SET name = ?, description = ?, sort_order = ?, is_published = ?
        WHERE id = ?
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(sort_order)
    .bind(is_published)
    .bind(&lesson_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = ?")
        .bind(&lesson_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let count = sqlx::query_scalar::<_, i32>(
        "SELECT COUNT(*) FROM problems WHERE lesson_id = ?",
    )
    .bind(&lesson_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(LessonResponse::from_lesson_with_count(updated, count)))
}

pub async fn delete_lesson(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(lesson_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Verify teacher has access via lesson -> module -> class
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = ?")
        .bind(&lesson_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Lesson not found".to_string()))?;

    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&lesson.module_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    sqlx::query("DELETE FROM lessons WHERE id = ?")
        .bind(&lesson_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

// Get a single lesson with its problems
pub async fn get_lesson(
    State(state): State<AppState>,
    Extension(teacher): Extension<Teacher>,
    Path(lesson_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let lesson = sqlx::query_as::<_, Lesson>("SELECT * FROM lessons WHERE id = ?")
        .bind(&lesson_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Lesson not found".to_string()))?;

    let module = sqlx::query_as::<_, Module>("SELECT * FROM modules WHERE id = ?")
        .bind(&lesson.module_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let has_access = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COUNT(*) FROM classes
        WHERE id = ? AND (teacher_id = ? OR id IN (
            SELECT class_id FROM class_teachers WHERE teacher_id = ?
        ))
        "#,
    )
    .bind(&module.class_id)
    .bind(&teacher.id)
    .bind(&teacher.id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if has_access == 0 {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let count = sqlx::query_scalar::<_, i32>(
        "SELECT COUNT(*) FROM problems WHERE lesson_id = ?",
    )
    .bind(&lesson_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(LessonResponse::from_lesson_with_count(lesson, count)))
}

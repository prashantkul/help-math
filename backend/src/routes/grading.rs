use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;

use crate::{
    app_middleware::{TeacherAuth, StudentAuth},
    models::{
        GradedSubmission, GradedSubmissionResponse, StyleProfile,
        ApproveGradingRequest, BatchApproveRequest, GradingQueueStats,
    },
    AppState,
};

/// GET /api/teacher/grading/queue - Get grading queue for teacher's classes
pub async fn get_grading_queue(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let submissions: Vec<GradedSubmission> = sqlx::query_as(
        r#"SELECT gs.id, gs.assignment_id, gs.student_id, gs.content::text, gs.scanned_file,
           gs.ai_feedback, gs.ai_score, gs.ai_skill_gaps, gs.teacher_approved,
           gs.teacher_edits, gs.final_feedback, gs.final_score, gs.status,
           gs.submitted_at, gs.graded_at, gs.returned_at
           FROM graded_submissions gs
           JOIN students s ON gs.student_id = s.id
           JOIN classes c ON s.class_id = c.id
           WHERE c.teacher_id = $1
           ORDER BY gs.submitted_at DESC"#
    )
    .bind(&auth.teacher_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch grading queue"})))
    })?;

    // Get student names for each submission
    let mut responses: Vec<GradedSubmissionResponse> = Vec::new();
    for sub in submissions {
        let student_name: Option<String> = sqlx::query_scalar(
            "SELECT name FROM students WHERE id = $1"
        )
        .bind(&sub.student_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        responses.push(sub.to_response(student_name));
    }

    // Calculate stats
    let stats = GradingQueueStats {
        total: responses.len() as i64,
        submitted: responses.iter().filter(|r| r.status == "submitted").count() as i64,
        ai_graded: responses.iter().filter(|r| r.status == "ai_graded").count() as i64,
        teacher_reviewed: responses.iter().filter(|r| r.status == "teacher_reviewed").count() as i64,
        returned: responses.iter().filter(|r| r.status == "returned").count() as i64,
    };

    Ok(Json(json!({
        "submissions": responses,
        "stats": stats,
    })))
}

/// POST /api/teacher/grading/:id/ai-grade - Trigger AI grading for a submission
pub async fn ai_grade_submission(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(submission_id): Path<String>,
) -> Result<Json<GradedSubmissionResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify access and get submission
    let submission: Option<GradedSubmission> = sqlx::query_as(
        r#"SELECT gs.id, gs.assignment_id, gs.student_id, gs.content::text, gs.scanned_file,
           gs.ai_feedback, gs.ai_score, gs.ai_skill_gaps, gs.teacher_approved,
           gs.teacher_edits, gs.final_feedback, gs.final_score, gs.status,
           gs.submitted_at, gs.graded_at, gs.returned_at
           FROM graded_submissions gs
           JOIN students s ON gs.student_id = s.id
           JOIN classes c ON s.class_id = c.id
           WHERE gs.id = $1 AND c.teacher_id = $2"#
    )
    .bind(&submission_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch submission"})))
    })?;

    let submission = submission.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Submission not found"})))
    })?;

    // Get teacher's style profile
    let style_str: Option<String> = sqlx::query_scalar(
        "SELECT style_profile::text FROM teachers WHERE id = $1"
    )
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let style_profile: StyleProfile = style_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Get student name and class info
    #[derive(sqlx::FromRow)]
    struct StudentInfo {
        name: String,
        class_id: String,
    }

    let student_info: StudentInfo = sqlx::query_as(
        "SELECT name, class_id FROM students WHERE id = $1"
    )
    .bind(&submission.student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch student info"})))
    })?;

    let grade_level: Option<i32> = sqlx::query_scalar(
        "SELECT grade FROM classes WHERE id = $1"
    )
    .bind(&student_info.class_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    // Get assignment title if available
    let assignment_title: String = if let Some(ref aid) = submission.assignment_id {
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

    // Call AI grading service
    let student_work = &submission.content;
    let grading_result = state.style_ai_service.grade_in_teacher_voice(
        &style_profile,
        &student_info.name,
        grade_level.unwrap_or(3),
        "math",
        &assignment_title,
        student_work,
    ).await;

    match grading_result {
        Ok(ai_response) => {
            let skill_gaps: Vec<String> = ai_response.skill_gaps;

            sqlx::query(
                r#"UPDATE graded_submissions
                   SET ai_feedback = $1, ai_score = $2, ai_skill_gaps = $3,
                       status = 'ai_graded', graded_at = NOW()
                   WHERE id = $4"#
            )
            .bind(&ai_response.feedback)
            .bind(ai_response.score)
            .bind(&skill_gaps)
            .bind(&submission_id)
            .execute(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save grading"})))
            })?;
        }
        Err(e) => {
            tracing::error!("AI grading failed: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("AI grading failed: {}", e)}))));
        }
    }

    // Fetch updated submission
    let updated: GradedSubmission = sqlx::query_as(
        r#"SELECT id, assignment_id, student_id, content::text, scanned_file,
           ai_feedback, ai_score, ai_skill_gaps, teacher_approved,
           teacher_edits, final_feedback, final_score, status,
           submitted_at, graded_at, returned_at
           FROM graded_submissions WHERE id = $1"#
    )
    .bind(&submission_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch updated submission"})))
    })?;

    Ok(Json(updated.to_response(Some(student_info.name))))
}

/// PUT /api/teacher/grading/:id/approve - Approve grading
pub async fn approve_grading(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(submission_id): Path<String>,
    Json(payload): Json<ApproveGradingRequest>,
) -> Result<Json<GradedSubmissionResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Verify access
    let submission: Option<GradedSubmission> = sqlx::query_as(
        r#"SELECT gs.id, gs.assignment_id, gs.student_id, gs.content::text, gs.scanned_file,
           gs.ai_feedback, gs.ai_score, gs.ai_skill_gaps, gs.teacher_approved,
           gs.teacher_edits, gs.final_feedback, gs.final_score, gs.status,
           gs.submitted_at, gs.graded_at, gs.returned_at
           FROM graded_submissions gs
           JOIN students s ON gs.student_id = s.id
           JOIN classes c ON s.class_id = c.id
           WHERE gs.id = $1 AND c.teacher_id = $2"#
    )
    .bind(&submission_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch submission"})))
    })?;

    let submission = submission.ok_or_else(|| {
        (StatusCode::NOT_FOUND, Json(json!({"error": "Submission not found"})))
    })?;

    let final_feedback = payload.edits.clone().or(submission.ai_feedback.clone());
    let final_score = payload.final_score.or(submission.ai_score);

    sqlx::query(
        r#"UPDATE graded_submissions
           SET teacher_approved = true, teacher_edits = $1,
               final_feedback = $2, final_score = $3,
               status = 'teacher_reviewed', returned_at = NOW()
           WHERE id = $4"#
    )
    .bind(&payload.edits)
    .bind(&final_feedback)
    .bind(final_score)
    .bind(&submission_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to approve grading"})))
    })?;

    let updated: GradedSubmission = sqlx::query_as(
        r#"SELECT id, assignment_id, student_id, content::text, scanned_file,
           ai_feedback, ai_score, ai_skill_gaps, teacher_approved,
           teacher_edits, final_feedback, final_score, status,
           submitted_at, graded_at, returned_at
           FROM graded_submissions WHERE id = $1"#
    )
    .bind(&submission_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch updated submission"})))
    })?;

    let student_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM students WHERE id = $1"
    )
    .bind(&updated.student_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    Ok(Json(updated.to_response(student_name)))
}

/// PUT /api/teacher/grading/:id/reject - Reject and regenerate grading
pub async fn reject_grading(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Path(submission_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Verify access
    let exists: Option<(String,)> = sqlx::query_as(
        r#"SELECT gs.id FROM graded_submissions gs
           JOIN students s ON gs.student_id = s.id
           JOIN classes c ON s.class_id = c.id
           WHERE gs.id = $1 AND c.teacher_id = $2"#
    )
    .bind(&submission_id)
    .bind(&auth.teacher_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to check submission"})))
    })?;

    if exists.is_none() {
        return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Submission not found"}))));
    }

    // Reset to submitted state
    sqlx::query(
        r#"UPDATE graded_submissions
           SET ai_feedback = NULL, ai_score = NULL, ai_skill_gaps = '{}',
               teacher_approved = false, status = 'submitted', graded_at = NULL
           WHERE id = $1"#
    )
    .bind(&submission_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to reject grading"})))
    })?;

    Ok(Json(json!({"message": "Grading rejected, ready for re-grading"})))
}

/// POST /api/teacher/grading/batch-approve - Batch approve submissions
pub async fn batch_approve_grading(
    State(state): State<AppState>,
    Extension(auth): Extension<TeacherAuth>,
    Json(payload): Json<BatchApproveRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut approved_count = 0;

    for submission_id in &payload.submission_ids {
        let result = sqlx::query(
            r#"UPDATE graded_submissions gs
               SET teacher_approved = true,
                   final_feedback = COALESCE(gs.ai_feedback, ''),
                   final_score = gs.ai_score,
                   status = 'teacher_reviewed',
                   returned_at = NOW()
               FROM students s
               JOIN classes c ON s.class_id = c.id
               WHERE gs.id = $1 AND gs.student_id = s.id AND c.teacher_id = $2
               AND gs.status = 'ai_graded'"#
        )
        .bind(submission_id)
        .bind(&auth.teacher_id)
        .execute(&state.db)
        .await;

        if let Ok(r) = result {
            approved_count += r.rows_affected();
        }
    }

    Ok(Json(json!({
        "approved_count": approved_count,
        "total_requested": payload.submission_ids.len(),
    })))
}

/// GET /api/student/feedback/:assignment_id - Get student's feedback for an assignment
pub async fn get_student_feedback(
    State(state): State<AppState>,
    Extension(auth): Extension<StudentAuth>,
    Path(assignment_id): Path<String>,
) -> Result<Json<Vec<GradedSubmissionResponse>>, (StatusCode, Json<serde_json::Value>)> {
    let submissions: Vec<GradedSubmission> = sqlx::query_as(
        r#"SELECT id, assignment_id, student_id, content::text, scanned_file,
           ai_feedback, ai_score, ai_skill_gaps, teacher_approved,
           teacher_edits, final_feedback, final_score, status,
           submitted_at, graded_at, returned_at
           FROM graded_submissions
           WHERE student_id = $1 AND assignment_id = $2
           AND status IN ('teacher_reviewed', 'returned')
           ORDER BY submitted_at DESC"#
    )
    .bind(&auth.student_id)
    .bind(&assignment_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to fetch feedback"})))
    })?;

    // For student view, only show final feedback (not AI feedback or reasoning)
    let responses: Vec<GradedSubmissionResponse> = submissions
        .into_iter()
        .map(|mut s| {
            // Students only see final feedback, not raw AI output
            s.ai_feedback = None;
            s.ai_score = None;
            s.teacher_edits = None;
            s.to_response(None)
        })
        .collect();

    Ok(Json(responses))
}

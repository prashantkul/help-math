use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// Database model for scan_batches
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScanBatch {
    pub id: String,
    pub teacher_id: String,
    pub mode: String,
    pub assignment_id: Option<String>,
    pub class_id: Option<String>,
    pub total_pages: i32,
    pub pages_processed: i32,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ScanBatchResponse {
    pub id: String,
    pub mode: String,
    pub assignment_id: Option<String>,
    pub class_id: Option<String>,
    pub total_pages: i32,
    pub pages_processed: i32,
    pub status: String,
    pub error_message: Option<String>,
    pub progress_percent: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}

impl From<ScanBatch> for ScanBatchResponse {
    fn from(b: ScanBatch) -> Self {
        let progress = if b.total_pages > 0 {
            ((b.pages_processed as f64 / b.total_pages as f64) * 100.0) as i32
        } else {
            0
        };
        Self {
            id: b.id,
            mode: b.mode,
            assignment_id: b.assignment_id,
            class_id: b.class_id,
            total_pages: b.total_pages,
            pages_processed: b.pages_processed,
            status: b.status,
            error_message: b.error_message,
            progress_percent: progress,
            created_at: b.created_at.to_rfc3339(),
            completed_at: b.completed_at.map(|d| d.to_rfc3339()),
        }
    }
}

// Database model for scan_pages
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScanPage {
    pub id: String,
    pub batch_id: String,
    pub page_number: i32,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub student_id: Option<String>,
    pub student_name_detected: Option<String>,
    pub student_match_confidence: Option<f64>,
    pub match_type: Option<String>,
    pub teacher_confirmed: bool,
    pub processing_status: String,
    pub result_id: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ScanPageResponse {
    pub page_id: String,
    pub page_number: i32,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub student_match: Option<StudentMatchInfo>,
    pub processing_status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StudentMatchInfo {
    pub detected_name: Option<String>,
    pub matched_student_id: Option<String>,
    pub matched_student_name: Option<String>,
    pub confidence: f64,
    pub match_type: String,
    pub status: String, // auto_matched, needs_confirmation, unmatched
}

impl ScanPage {
    pub fn to_response(self, student_name: Option<String>) -> ScanPageResponse {
        let student_match = if self.student_name_detected.is_some() || self.student_id.is_some() {
            let confidence = self.student_match_confidence.unwrap_or(0.0);
            let status = if confidence >= 0.90 {
                "auto_matched".to_string()
            } else if confidence >= 0.70 {
                "needs_confirmation".to_string()
            } else {
                "unmatched".to_string()
            };
            Some(StudentMatchInfo {
                detected_name: self.student_name_detected,
                matched_student_id: self.student_id,
                matched_student_name: student_name,
                confidence,
                match_type: self.match_type.unwrap_or_else(|| "none".to_string()),
                status,
            })
        } else {
            None
        };

        ScanPageResponse {
            page_id: self.id,
            page_number: self.page_number,
            file_path: self.file_path,
            thumbnail_path: self.thumbnail_path,
            student_match,
            processing_status: self.processing_status,
            error_message: self.error_message,
        }
    }
}

// Review response for a batch
#[derive(Debug, Serialize)]
pub struct BatchReviewResponse {
    pub batch_id: String,
    pub mode: String,
    pub status: String,
    pub assignment: Option<AssignmentInfo>,
    pub pages: Vec<ScanPageResponse>,
    pub summary: BatchSummary,
}

#[derive(Debug, Serialize)]
pub struct AssignmentInfo {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct BatchSummary {
    pub total: i32,
    pub auto_matched: i32,
    pub needs_confirmation: i32,
    pub unmatched: i32,
}

// Confirm matches request
#[derive(Debug, Deserialize)]
pub struct ConfirmMatchesRequest {
    #[serde(default)]
    pub corrections: Vec<PageCorrection>,
    #[serde(default)]
    pub confirm_all_auto: bool,
}

#[derive(Debug, Deserialize)]
pub struct PageCorrection {
    pub page_id: String,
    pub student_id: String,
}

// Upload response
#[derive(Debug, Serialize)]
pub struct ScanUploadResponse {
    pub batch_id: String,
    pub total_pages: i32,
    pub status: String,
    pub message: String,
}

// Name detection result from Claude
#[derive(Debug, Serialize, Deserialize)]
pub struct NameDetectionResult {
    #[serde(default)]
    pub name_found: bool,
    #[serde(default)]
    pub name_text: String,
    #[serde(default)]
    pub name_confidence: f64,
    #[serde(default)]
    pub name_location: String,
    #[serde(default)]
    pub notes: String,
}

// Fuzzy match result
#[derive(Debug, Clone)]
pub struct StudentMatch {
    pub student_id: String,
    pub student_name: String,
    pub confidence: f64,
    pub match_type: String,
}

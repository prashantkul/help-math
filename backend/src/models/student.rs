use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Student {
    pub id: String,
    pub name: String,
    pub class_id: String,
    pub external_id: Option<String>,  // Teacher's internal ID for roster correlation
    pub passcode: String,  // Unique passcode for joining
    pub avatar: String,
    pub total_points: i32,
    pub created_at: String,
}

// Student joins with class code + passcode
#[derive(Debug, Deserialize)]
pub struct JoinClass {
    pub class_code: String,
    pub passcode: String,
}

// Teacher creates a student
#[derive(Debug, Deserialize)]
pub struct CreateStudent {
    pub name: String,
    pub external_id: Option<String>,  // Optional roster ID
}

// Bulk create students
#[derive(Debug, Deserialize)]
pub struct BulkCreateStudents {
    pub students: Vec<CreateStudent>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStudentAvatar {
    pub avatar: String,
}

// Response for students (doesn't include passcode)
#[derive(Debug, Serialize)]
pub struct StudentResponse {
    pub id: String,
    pub name: String,
    pub class_id: String,
    pub external_id: Option<String>,
    pub avatar: String,
    pub total_points: i32,
    pub created_at: String,
}

impl From<Student> for StudentResponse {
    fn from(student: Student) -> Self {
        Self {
            id: student.id,
            name: student.name,
            class_id: student.class_id,
            external_id: student.external_id,
            avatar: student.avatar,
            total_points: student.total_points,
            created_at: student.created_at,
        }
    }
}

// Response for teachers (includes passcode)
#[derive(Debug, Serialize)]
pub struct TeacherStudentResponse {
    pub id: String,
    pub name: String,
    pub class_id: String,
    pub external_id: Option<String>,
    pub passcode: String,
    pub avatar: String,
    pub total_points: i32,
    pub created_at: String,
}

impl From<Student> for TeacherStudentResponse {
    fn from(student: Student) -> Self {
        Self {
            id: student.id,
            name: student.name,
            class_id: student.class_id,
            external_id: student.external_id,
            passcode: student.passcode,
            avatar: student.avatar,
            total_points: student.total_points,
            created_at: student.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StudentJoinResponse {
    pub student: StudentResponse,
    pub class_name: String,
    pub session_token: String,
}

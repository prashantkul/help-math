use anyhow::{anyhow, Result};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub role: String, // "teacher" or "student"
}

pub struct AuthService {
    secret: String,
}

impl AuthService {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    pub fn hash_password(&self, password: &str) -> Result<String> {
        hash(password, DEFAULT_COST).map_err(|e| anyhow!("Failed to hash password: {}", e))
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        verify(password, hash).map_err(|e| anyhow!("Failed to verify password: {}", e))
    }

    pub fn generate_teacher_token(&self, teacher_id: Uuid) -> Result<String> {
        self.generate_token(teacher_id, "teacher")
    }

    pub fn generate_student_token(&self, student_id: Uuid) -> Result<String> {
        self.generate_token(student_id, "student")
    }

    fn generate_token(&self, user_id: Uuid, role: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::days(30);

        let claims = Claims {
            sub: user_id.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            role: role.to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|e| anyhow!("Failed to generate token: {}", e))
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|e| anyhow!("Invalid token: {}", e))?;

        Ok(token_data.claims)
    }

    pub fn extract_teacher_id(&self, token: &str) -> Result<Uuid> {
        let claims = self.validate_token(token)?;
        if claims.role != "teacher" {
            return Err(anyhow!("Not a teacher token"));
        }
        Uuid::parse_str(&claims.sub).map_err(|e| anyhow!("Invalid UUID: {}", e))
    }

    pub fn extract_student_id(&self, token: &str) -> Result<Uuid> {
        let claims = self.validate_token(token)?;
        if claims.role != "student" {
            return Err(anyhow!("Not a student token"));
        }
        Uuid::parse_str(&claims.sub).map_err(|e| anyhow!("Invalid UUID: {}", e))
    }
}

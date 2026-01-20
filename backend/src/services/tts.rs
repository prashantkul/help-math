use anyhow::{anyhow, Result};
use reqwest::Client;

const ELEVENLABS_API_URL: &str = "https://api.elevenlabs.io/v1/text-to-speech";

pub struct TTSService {
    client: Client,
    api_key: String,
    voice_id: String,
}

impl TTSService {
    pub fn new(api_key: String, voice_id: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            voice_id,
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty() && !self.voice_id.is_empty()
    }

    pub async fn synthesize(&self, text: &str) -> Result<Vec<u8>> {
        if !self.is_configured() {
            return Err(anyhow!("TTS service not configured"));
        }

        let url = format!("{}/{}", ELEVENLABS_API_URL, self.voice_id);

        let response = self
            .client
            .post(&url)
            .header("Accept", "audio/mpeg")
            .header("Content-Type", "application/json")
            .header("xi-api-key", &self.api_key)
            .json(&serde_json::json!({
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": true
                }
            }))
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call ElevenLabs API: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("ElevenLabs API error ({}): {}", status, error_text));
        }

        let audio_bytes = response
            .bytes()
            .await
            .map_err(|e| anyhow!("Failed to read audio response: {}", e))?;

        Ok(audio_bytes.to_vec())
    }
}

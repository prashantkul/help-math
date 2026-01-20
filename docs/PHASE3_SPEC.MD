# Claude Code Instructions: Curriculum Import from Storage

## Goal
Load prebuilt curriculum JSON files from Railway Storage bucket. Teachers can browse and select problems from Eureka Math lessons.

---

## Storage Structure (Already Uploaded)

```
BUCKET_URL/curriculum/
├── index.json                    # Module list
└── g3-m5/
    ├── module.json               # Topics & lesson numbers  
    ├── vocabulary.json           # Terms with definitions
    └── lessons/
        └── lesson-XX.json        # Problems for each lesson
```

---

## Backend Changes

### 1. Add Environment Variable

In `.env`:
```
CURRICULUM_BUCKET_URL=https://your-railway-bucket.railway.app
```

### 2. Add Types

Create `backend/src/models/curriculum.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumIndex {
    pub modules: Vec<ModuleSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModuleSummary {
    pub id: String,
    pub name: String,
    pub title: String,
    pub grade: i32,
    pub lesson_count: i32,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Module {
    pub id: String,
    pub name: String,
    pub title: String,
    pub topics: Vec<Topic>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Topic {
    pub id: String,
    pub code: String,
    pub title: String,
    pub lessons: Vec<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Lesson {
    pub lesson_number: i32,
    pub topic: String,
    pub objective: String,
    pub problems: Vec<CurriculumProblem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurriculumProblem {
    pub id: String,
    pub number: String,
    pub text: String,
    #[serde(rename = "type")]
    pub problem_type: String,
    pub visual_model: Option<String>,
    pub answer: Option<serde_json::Value>,
    pub skills: Option<Vec<String>>,
}
```

Add to `backend/src/models/mod.rs`:
```rust
pub mod curriculum;
```

### 3. Add Routes

Create `backend/src/routes/curriculum.rs`:

```rust
use axum::{extract::Path, routing::get, Json, Router};
use reqwest::Client;
use std::env;

use crate::models::curriculum::*;

pub fn curriculum_routes() -> Router {
    Router::new()
        .route("/curriculum/modules", get(list_modules))
        .route("/curriculum/modules/:id", get(get_module))
        .route("/curriculum/modules/:module_id/lessons/:lesson_num", get(get_lesson))
}

async fn list_modules() -> Result<Json<CurriculumIndex>, (axum::http::StatusCode, String)> {
    let base_url = env::var("CURRICULUM_BUCKET_URL").unwrap_or_default();
    let url = format!("{}/curriculum/index.json", base_url);
    
    let client = Client::new();
    let resp = client.get(&url).send().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    let index: CurriculumIndex = resp.json().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    Ok(Json(index))
}

async fn get_module(Path(id): Path<String>) -> Result<Json<Module>, (axum::http::StatusCode, String)> {
    let base_url = env::var("CURRICULUM_BUCKET_URL").unwrap_or_default();
    let url = format!("{}/curriculum/{}/module.json", base_url, id);
    
    let client = Client::new();
    let resp = client.get(&url).send().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    let module: Module = resp.json().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    Ok(Json(module))
}

async fn get_lesson(
    Path((module_id, lesson_num)): Path<(String, i32)>
) -> Result<Json<Lesson>, (axum::http::StatusCode, String)> {
    let base_url = env::var("CURRICULUM_BUCKET_URL").unwrap_or_default();
    let url = format!(
        "{}/curriculum/{}/lessons/lesson-{:02}.json",
        base_url, module_id, lesson_num
    );
    
    let client = Client::new();
    let resp = client.get(&url).send().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    let lesson: Lesson = resp.json().await
        .map_err(|e| (axum::http::StatusCode::BAD_GATEWAY, e.to_string()))?;
    
    Ok(Json(lesson))
}
```

### 4. Register Routes

In `backend/src/main.rs`, add:

```rust
mod routes::curriculum;

// In your router setup:
.nest("/api", curriculum::curriculum_routes())
```

---

## Frontend Changes

### 1. Add Types

Create `frontend/src/types/curriculum.ts`:

```typescript
export interface ModuleSummary {
  id: string;
  name: string;
  title: string;
  grade: number;
  lesson_count: number;
}

export interface Topic {
  id: string;
  code: string;
  title: string;
  lessons: number[];
}

export interface Module {
  id: string;
  name: string;
  title: string;
  topics: Topic[];
}

export interface CurriculumProblem {
  id: string;
  number: string;
  text: string;
  type: string;
  visual_model?: string;
  skills?: string[];
}

export interface Lesson {
  lesson_number: number;
  topic: string;
  objective: string;
  problems: CurriculumProblem[];
}
```

### 2. Add API Client

Create `frontend/src/api/curriculumApi.ts`:

```typescript
import { api } from './client';
import type { ModuleSummary, Module, Lesson } from '../types/curriculum';

export const curriculumApi = {
  getModules: () => 
    api.get<{ modules: ModuleSummary[] }>('/curriculum/modules'),
  
  getModule: (id: string) => 
    api.get<Module>(`/curriculum/modules/${id}`),
  
  getLesson: (moduleId: string, lessonNum: number) =>
    api.get<Lesson>(`/curriculum/modules/${moduleId}/lessons/${lessonNum}`),
};
```

### 3. Add Simple Browser Component

Create `frontend/src/components/teacher/CurriculumBrowser.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { curriculumApi } from '../../api/curriculumApi';
import type { Module, Lesson, CurriculumProblem } from '../../types/curriculum';

interface Props {
  onSelectProblems: (problems: CurriculumProblem[]) => void;
}

export function CurriculumBrowser({ onSelectProblems }: Props) {
  const [module, setModule] = useState<Module | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());

  // Load module on mount
  useEffect(() => {
    curriculumApi.getModule('g3-m5').then(setModule);
  }, []);

  // Load lesson when selected
  const loadLesson = async (lessonNum: number) => {
    const data = await curriculumApi.getLesson('g3-m5', lessonNum);
    setLesson(data);
    setSelectedProblems(new Set());
  };

  const toggleProblem = (id: string) => {
    const next = new Set(selectedProblems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProblems(next);
  };

  const handleConfirm = () => {
    if (!lesson) return;
    const problems = lesson.problems.filter(p => selectedProblems.has(p.id));
    onSelectProblems(problems);
  };

  if (!module) return <div>Loading curriculum...</div>;

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-bold mb-4">📚 {module.title}</h3>

      {/* Topic selector */}
      <div className="mb-4">
        <label className="block font-medium mb-2">Select Topic:</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedTopic || ''}
          onChange={(e) => {
            setSelectedTopic(e.target.value);
            setLesson(null);
          }}
        >
          <option value="">-- Choose a topic --</option>
          {module.topics.map(t => (
            <option key={t.id} value={t.id}>
              Topic {t.code}: {t.title}
            </option>
          ))}
        </select>
      </div>

      {/* Lesson selector */}
      {selectedTopic && (
        <div className="mb-4">
          <label className="block font-medium mb-2">Select Lesson:</label>
          <div className="flex flex-wrap gap-2">
            {module.topics
              .find(t => t.id === selectedTopic)
              ?.lessons.map(num => (
                <button
                  key={num}
                  onClick={() => loadLesson(num)}
                  className={`px-3 py-1 rounded ${
                    lesson?.lesson_number === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Lesson {num}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Problem list */}
      {lesson && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{lesson.objective}</p>
          <div className="space-y-2">
            {lesson.problems.map(p => (
              <label
                key={p.id}
                className="flex items-start gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedProblems.has(p.id)}
                  onChange={() => toggleProblem(p.id)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">#{p.number}</span>{' '}
                  <span className="text-gray-700">{p.text.slice(0, 100)}...</span>
                  <div className="text-xs text-gray-500">
                    Type: {p.type} | Model: {p.visual_model || 'none'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Confirm button */}
      {selectedProblems.size > 0 && (
        <button
          onClick={handleConfirm}
          className="w-full py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
        >
          Add {selectedProblems.size} Problems to Assignment
        </button>
      )}
    </div>
  );
}
```

---

## Testing

1. Start backend: `cargo run`
2. Test endpoints:
   ```bash
   curl http://localhost:8080/api/curriculum/modules
   curl http://localhost:8080/api/curriculum/modules/g3-m5
   curl http://localhost:8080/api/curriculum/modules/g3-m5/lessons/1
   ```
3. Start frontend: `npm run dev`
4. Import `CurriculumBrowser` component where teachers create assignments

---

## Files to Create/Modify

```
backend/
├── .env                          # Add CURRICULUM_BUCKET_URL
├── src/
│   ├── main.rs                   # Register curriculum routes
│   ├── models/
│   │   ├── mod.rs                # Add: pub mod curriculum;
│   │   └── curriculum.rs         # NEW
│   └── routes/
│       ├── mod.rs                # Add: pub mod curriculum;
│       └── curriculum.rs         # NEW

frontend/
└── src/
    ├── types/
    │   └── curriculum.ts         # NEW
    ├── api/
    │   └── curriculumApi.ts      # NEW
    └── components/teacher/
        └── CurriculumBrowser.tsx # NEW
```

---

## That's It

- 2 new Rust files (models + routes)
- 3 new TypeScript files (types + api + component)
- 1 env variable
- No database changes
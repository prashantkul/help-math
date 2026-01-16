# Math Helper 🧮

A full-stack educational web application designed to help 3rd grade students who are proficient in math but struggle with reading comprehension and English language skills. The app scaffolds word problems into digestible steps, rewarding students for each correct micro-step rather than just final answers.

## Features

### For Students
- **Step-by-Step Problem Solving** - Word problems broken into 6 manageable steps
- **Read Aloud** - Every text element has a listen button (Web Speech API)
- **Kid-Friendly UI** - Large buttons, warm colors, fun avatars
- **Celebration Animations** - Confetti and stars for completed problems
- **Progress Tracking** - Points and stars earned for each step
- **Simple Login** - Just name + class code (no passwords)

### For Teachers
- **Class Management** - Create classes with unique join codes
- **PDF Upload** - Upload worksheets and extract problems automatically
- **AI Scaffolding** - Claude AI generates step-by-step breakdowns
- **Review & Edit** - Approve or modify scaffolds before publishing
- **Analytics Dashboard** - Track class and individual student progress
- **ELL Settings** - Adjust vocabulary level per class

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Vite
- **Backend:** Rust + Axum + SQLx + PostgreSQL
- **AI Integration:** Anthropic Claude API
- **PDF Processing:** Text extraction for teacher uploads

## Project Structure

```
├── backend/                    # Rust + Axum API server
│   ├── migrations/             # PostgreSQL schema
│   └── src/
│       ├── main.rs             # Server entry point
│       ├── middleware/         # Auth middleware
│       ├── models/             # Data models
│       ├── routes/             # API endpoints
│       └── services/           # Auth, AI, grading logic
│
└── frontend/                   # React + TypeScript app
    └── src/
        ├── api/                # API client
        ├── components/         # Reusable UI components
        ├── hooks/              # React hooks
        ├── pages/              # Page components
        └── types/              # TypeScript interfaces
```

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [PostgreSQL](https://www.postgresql.org/) (14+)

### Database Setup

```bash
# Create database
createdb math_scaffold

# The schema will auto-migrate on first run
```

### Backend Setup

```bash
cd backend

# Copy environment file and add your keys
cp .env.example .env

# Edit .env with your settings:
# DATABASE_URL=postgres://user:pass@localhost:5432/math_scaffold
# ANTHROPIC_API_KEY=sk-ant-...
# JWT_SECRET=your-secret-key

# Run the server
cargo run
```

The API will be available at `http://localhost:8080`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/auth/teacher/register` - Teacher registration
- `POST /api/auth/teacher/login` - Teacher login
- `POST /api/auth/student/join` - Student joins with name + class code

### Teacher Routes (require JWT)
- `GET/POST /api/classes` - List/create classes
- `GET /api/classes/:id/students` - List students
- `POST /api/problems/upload` - Upload PDF
- `POST /api/problems/:id/scaffold` - Generate AI scaffold
- `GET /api/analytics/class/:id` - Class analytics

### Student Routes (require session)
- `GET /api/student/assignments` - Get assignments
- `GET /api/student/problems/:id` - Get problem with steps
- `POST /api/student/problems/:id/attempt` - Submit answer

## Problem Solving Flow

1. **Meet the Problem** - See the word problem with read-aloud option
2. **Find Objects** - Identify who/what is in the problem
3. **Find Numbers** - Locate the important numbers
4. **Identify Operation** - Choose add, subtract, multiply, or divide
5. **Build Equation** - Construct the math sentence
6. **Solve** - Calculate the answer
7. **Comprehension Check** - Verify the answer makes sense

## Pedagogical Principles

- **Chunking/Scaffolding** - Break multi-step problems into single steps
- **Language Simplification** - ELL-friendly vocabulary (Lexile 400-600)
- **Visual Anchoring** - Emojis paired with text (🍎 for apples)
- **Key Information Extraction** - Highlight numbers and operation keywords
- **Distractor Removal** - Strip unnecessary narrative
- **Incremental Success** - Points for each step, not just final answer

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgres://user:pass@localhost:5432/math_scaffold
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key
BIND_ADDR=0.0.0.0:8080
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8080/api
```

## License

MIT

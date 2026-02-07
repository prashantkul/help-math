// Authentication types
export interface Teacher {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  class_id: string;
  external_id?: string;  // Teacher's internal ID for roster correlation
  avatar: string;
  total_points: number;
  created_at: string;
}

// Student with passcode (for teacher view)
export interface TeacherStudent extends Student {
  passcode: string;
  roster_id?: string;
  notes?: string;
}

// Co-teacher for a class
export interface CoTeacher {
  id: string;
  teacher_id: string;
  teacher_email: string;
  teacher_name: string;
  added_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  settings: ClassSettings;
  purpose?: string;
  description?: string;
  grade: number;
  created_at: string;
}

export interface ClassSettings {
  ell_level: 1 | 2 | 3;
  show_emojis: boolean;
  retry_limit?: number;
  point_multiplier?: number;
}

// Module and Lesson types
export interface Module {
  id: string;
  class_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_published: boolean;
  scaffold_prompt?: string;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  class_id?: string;
  name: string;
  description?: string;
  sort_order: number;
  is_published: boolean;
  release_type: 'immediate' | 'scheduled' | 'manual' | 'sequential';
  release_at?: string;
  release_after_lesson_id?: string;
  created_at: string;
  problem_count?: number;
}

// Problem types
export type ProblemState = 'draft' | 'scaffolded' | 'reviewed' | 'published';

export interface Problem {
  id: string;
  class_id: string;
  lesson_id?: string;
  original_text: string;
  simplified_text?: string;
  skill_tags: SkillTag[];
  difficulty: 1 | 2 | 3;
  is_published: boolean;
  state: ProblemState;
  week_number?: number;
  scene_emoji?: string;
  image_url?: string;
  created_at: string;
  steps?: ScaffoldStep[];
}

export type SkillTag = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'multi-step';

export interface ScaffoldStep {
  id: string;
  problem_id: string;
  step_order: number;
  step_type: StepType;
  prompt_text: string;
  simplified_text?: string;
  correct_answer: CorrectAnswer;
  answer_type: AnswerType;
  options?: StepOption[];
  hints: string[];
  points: number;
  emoji_hint?: string;
  image_url?: string;
}

// StepType is flexible - AI can generate any descriptive type based on curriculum
// Common types include: find_objects, find_numbers, identify_operation, build_equation, solve, comprehension_check
// But curriculum-specific types like identify_fractions, partition_whole, compare_fractions are also valid
export type StepType = string;

export type AnswerType =
  | 'multiple_choice'
  | 'number_input'
  | 'multi_select'
  | 'drag_drop'
  | 'equation_builder';

export type CorrectAnswer = string | number | string[] | number[] | EquationAnswer;

export interface EquationAnswer {
  left: number;
  operator: '+' | '-' | '×' | '÷';
  right: number;
}

export interface StepOption {
  value: string;
  label: string;
  emoji?: string;
}

// Assignment types
export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  week_start?: string;
  week_end?: string;
  problem_ids: string[];
  problems?: Problem[];
  created_at: string;
}

// Progress types
export interface StudentProgress {
  id: string;
  student_id: string;
  problem_id: string;
  current_step: number;
  is_complete: boolean;
  total_points_earned: number;
  stars_earned: number;
  started_at: string;
  completed_at?: string;
}

export interface StepAttempt {
  id: string;
  student_id: string;
  step_id: string;
  attempt_number: number;
  answer_given: unknown;
  is_correct: boolean;
  points_earned: number;
  time_spent_seconds?: number;
  created_at: string;
}

// Analytics types
export interface ClassAnalytics {
  class_id: string;
  total_students: number;
  total_problems: number;
  average_completion_rate: number;
  average_points_per_student: number;
  step_failure_rates: StepFailureRate[];
  weekly_progress: WeeklyProgress[];
}

export interface StepFailureRate {
  step_type: StepType;
  failure_rate: number;
  total_attempts: number;
}

export interface WeeklyProgress {
  week: string;
  problems_completed: number;
  average_stars: number;
}

export interface StudentAnalytics {
  student_id: string;
  student_name: string;
  total_problems_attempted: number;
  total_problems_completed: number;
  total_points: number;
  average_stars: number;
  strengths: SkillTag[];
  areas_for_improvement: SkillTag[];
  recent_activity: RecentActivity[];
}

export interface RecentActivity {
  problem_id: string;
  problem_text: string;
  completed_at: string;
  stars_earned: number;
  points_earned: number;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  token: string;
  teacher?: Teacher;
  student?: Student;
}

export interface StudentJoinResponse {
  student: Student;
  class_name: string;
  session_token: string;
}

// AI scaffolding types
export interface ScaffoldingRequest {
  problem_text: string;
  ell_level: 1 | 2 | 3;
}

export interface ScaffoldingResponse {
  simplified_problem: string;
  skill_tags: SkillTag[];
  difficulty: 1 | 2 | 3;
  scene_emoji: string;
  steps: Omit<ScaffoldStep, 'id' | 'problem_id'>[];
}

// PDF upload types
export interface PDFUploadResponse {
  extracted_problems: ExtractedProblem[];
}

export interface ExtractedProblem {
  text: string;
  page_number: number;
  confidence: number;
}

// Avatar options
export const AVATAR_OPTIONS = [
  { id: 'bear', emoji: '🐻', name: 'Bear' },
  { id: 'bunny', emoji: '🐰', name: 'Bunny' },
  { id: 'cat', emoji: '🐱', name: 'Cat' },
  { id: 'dog', emoji: '🐶', name: 'Dog' },
  { id: 'fox', emoji: '🦊', name: 'Fox' },
  { id: 'panda', emoji: '🐼', name: 'Panda' },
  { id: 'penguin', emoji: '🐧', name: 'Penguin' },
  { id: 'owl', emoji: '🦉', name: 'Owl' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn' },
  { id: 'star', emoji: '⭐', name: 'Star' },
] as const;

export type AvatarId = typeof AVATAR_OPTIONS[number]['id'];

// Phase 2 - Password reset types
export interface ForgotPasswordResponse {
  message: string;
  reset_link?: string;
}

// Phase 2 - Bulk student import types
export interface BulkStudentEntry {
  name: string;
  external_id?: string;
}

// Phase 2 - Roster mapping types
export interface UpdateStudentRoster {
  external_id?: string;
  roster_id?: string;
  notes?: string;
}

// Phase 2 - Lesson scheduling types
export interface UpdateLessonSchedule {
  release_type: 'immediate' | 'scheduled' | 'manual' | 'sequential';
  release_at?: string;
  release_after_lesson_id?: string;
}

// Phase 2 - Scaffold step editing types
export interface CreateScaffoldStep {
  step_type: StepType;
  prompt_text: string;
  simplified_text?: string;
  correct_answer: CorrectAnswer;
  answer_type: AnswerType;
  options?: StepOption[];
  hints: string[];
  points?: number;
  emoji_hint?: string;
}

export interface UpdateScaffoldStep {
  step_type?: StepType;
  prompt_text?: string;
  simplified_text?: string;
  correct_answer?: CorrectAnswer;
  answer_type?: AnswerType;
  options?: StepOption[];
  hints?: string[];
  points?: number;
  emoji_hint?: string;
}

// ====== Teacher Style Learning Types ======

export interface StyleStrictness {
  spelling: string;
  math_work_shown: string;
  neatness: string;
}

export interface StyleProfile {
  tone: string;
  praise_phrases: string[];
  correction_phrases: string[];
  correction_style: string;
  strictness: StyleStrictness;
  common_annotations: string[];
  visual_markers: string[];
  feedback_length: string;
  differentiation_notes: string;
  sample_count: number;
  confidence_score: number;
}

export interface StyleProfileResponse {
  profile: StyleProfile;
  confidence: number;
  sample_count: number;
}

export interface StyleSample {
  id: string;
  file_path: string;
  file_type: string;
  extracted_annotations: Record<string, unknown>;
  feedback_patterns: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

export interface UpdateStyleProfile {
  tone?: string;
  praise_phrases?: string[];
  correction_phrases?: string[];
  correction_style?: string;
  strictness?: StyleStrictness;
  common_annotations?: string[];
  visual_markers?: string[];
  feedback_length?: string;
  differentiation_notes?: string;
}

export interface TestStyleRequest {
  student_work: string;
  student_name?: string;
  grade_level?: number;
  subject?: string;
}

export interface TestStyleResponse {
  feedback: string;
  style_applied: boolean;
}

// ====== AI-Assisted Grading Types ======

export interface GradedSubmission {
  id: string;
  assignment_id?: string;
  student_id: string;
  student_name?: string;
  content: Record<string, unknown>;
  scanned_file?: string;
  ai_feedback?: string;
  ai_score?: number;
  ai_skill_gaps: string[];
  teacher_approved: boolean;
  teacher_edits?: string;
  final_feedback?: string;
  final_score?: number;
  status: 'submitted' | 'ai_graded' | 'teacher_reviewed' | 'returned';
  submitted_at: string;
  graded_at?: string;
  returned_at?: string;
}

export interface GradingQueueResponse {
  submissions: GradedSubmission[];
  stats: GradingQueueStats;
}

export interface GradingQueueStats {
  total: number;
  submitted: number;
  ai_graded: number;
  teacher_reviewed: number;
  returned: number;
}

export interface ApproveGradingRequest {
  edits?: string;
  final_score?: number;
}

export interface BatchApproveRequest {
  submission_ids: string[];
}

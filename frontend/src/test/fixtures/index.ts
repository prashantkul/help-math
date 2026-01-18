import type {
  Teacher,
  Student,
  TeacherStudent,
  Class,
  Module,
  Lesson,
  Problem,
  ScaffoldStep,
  Assignment,
  StudentProgress,
  ClassAnalytics,
  StudentAnalytics,
  ScaffoldingResponse,
} from '../../types';

// ============ TOKENS ============
export const tokens = {
  teacher: 'test-teacher-jwt-token-12345',
  student: 'test-student-session-token-67890',
};

// ============ TEACHERS ============
export const teachers: Record<string, Teacher> = {
  default: {
    id: 'teacher-uuid-001',
    email: 'teacher1@test.com',
    name: 'Sarah Johnson',
    created_at: '2025-01-01T00:00:00Z',
  },
  secondary: {
    id: 'teacher-uuid-002',
    email: 'teacher2@test.com',
    name: 'Michael Chen',
    created_at: '2025-01-02T00:00:00Z',
  },
};

// ============ CLASSES ============
export const classes: Record<string, Class> = {
  default: {
    id: 'class-uuid-001',
    teacher_id: 'teacher-uuid-001',
    name: '3rd Grade Math - Room 101',
    join_code: '96T2A2',
    settings: {
      ell_level: 2,
      show_emojis: true,
      retry_limit: 3,
      point_multiplier: 1,
    },
    created_at: '2025-01-01T00:00:00Z',
  },
  secondary: {
    id: 'class-uuid-002',
    teacher_id: 'teacher-uuid-002',
    name: '4th Grade Math - Room 205',
    join_code: '6Y78B7',
    settings: {
      ell_level: 3,
      show_emojis: false,
      retry_limit: 5,
      point_multiplier: 1.5,
    },
    created_at: '2025-01-02T00:00:00Z',
  },
};

// ============ STUDENTS ============
export const students: Record<string, Student> = {
  default: {
    id: 'student-uuid-001',
    name: 'Student A1',
    class_id: 'class-uuid-001',
    external_id: 'A1',
    avatar: 'bear',
    total_points: 150,
    created_at: '2025-01-03T00:00:00Z',
  },
  secondary: {
    id: 'student-uuid-002',
    name: 'Student A2',
    class_id: 'class-uuid-001',
    external_id: 'A2',
    avatar: 'bunny',
    total_points: 200,
    created_at: '2025-01-03T00:00:00Z',
  },
  beginner: {
    id: 'student-uuid-003',
    name: 'Student A3',
    class_id: 'class-uuid-001',
    external_id: 'A3',
    avatar: 'cat',
    total_points: 50,
    created_at: '2025-01-04T00:00:00Z',
  },
};

// Students with passcodes (for teacher view)
export const teacherStudents: Record<string, TeacherStudent> = {
  default: {
    ...students.default,
    passcode: '1111',
  },
  secondary: {
    ...students.secondary,
    passcode: '2222',
  },
  beginner: {
    ...students.beginner,
    passcode: '3333',
  },
};

export const studentList: TeacherStudent[] = [
  teacherStudents.default,
  teacherStudents.secondary,
  teacherStudents.beginner,
];

// ============ MODULES ============
export const modules: Record<string, Module> = {
  default: {
    id: 'module-uuid-001',
    class_id: 'class-uuid-001',
    name: 'Addition & Subtraction',
    description: 'Learn basic addition and subtraction with word problems',
    sort_order: 1,
    is_published: true,
    created_at: '2025-01-05T00:00:00Z',
  },
  multiplication: {
    id: 'module-uuid-002',
    class_id: 'class-uuid-001',
    name: 'Multiplication Basics',
    description: 'Introduction to multiplication concepts',
    sort_order: 2,
    is_published: false,
    created_at: '2025-01-06T00:00:00Z',
  },
};

// ============ LESSONS ============
export const lessons: Record<string, Lesson> = {
  default: {
    id: 'lesson-uuid-001',
    module_id: 'module-uuid-001',
    class_id: 'class-uuid-001',
    name: 'Single Digit Addition',
    description: 'Adding numbers from 1-9',
    sort_order: 1,
    is_published: true,
    release_type: 'immediate',
    problem_count: 5,
    created_at: '2025-01-07T00:00:00Z',
  },
  doubleDigit: {
    id: 'lesson-uuid-002',
    module_id: 'module-uuid-001',
    class_id: 'class-uuid-001',
    name: 'Double Digit Addition',
    description: 'Adding numbers from 10-99',
    sort_order: 2,
    is_published: false,
    release_type: 'immediate',
    problem_count: 3,
    created_at: '2025-01-08T00:00:00Z',
  },
};

// ============ SCAFFOLD STEPS ============
export const scaffoldSteps: ScaffoldStep[] = [
  {
    id: 'step-uuid-001',
    problem_id: 'problem-uuid-001',
    step_order: 1,
    step_type: 'find_objects',
    prompt_text: 'What is this problem about?',
    simplified_text: 'What thing is Maria counting?',
    correct_answer: 'apples',
    answer_type: 'multiple_choice',
    options: [
      { value: 'apples', label: 'Apples', emoji: '🍎' },
      { value: 'oranges', label: 'Oranges', emoji: '🍊' },
      { value: 'bananas', label: 'Bananas', emoji: '🍌' },
    ],
    hints: ['Look for the fruit mentioned in the problem', 'Maria has something red'],
    points: 10,
    emoji_hint: '🍎',
  },
  {
    id: 'step-uuid-002',
    problem_id: 'problem-uuid-001',
    step_order: 2,
    step_type: 'find_numbers',
    prompt_text: 'How many apples does Maria start with?',
    simplified_text: 'Find the first number',
    correct_answer: 5,
    answer_type: 'number_input',
    hints: ['Look at the beginning of the problem', 'Maria has some apples at first'],
    points: 10,
    emoji_hint: '5️⃣',
  },
  {
    id: 'step-uuid-003',
    problem_id: 'problem-uuid-001',
    step_order: 3,
    step_type: 'find_numbers',
    prompt_text: 'How many apples does Maria give away?',
    simplified_text: 'Find how many she gives',
    correct_answer: 2,
    answer_type: 'number_input',
    hints: ['Look for words like "gives" or "gives away"'],
    points: 10,
  },
  {
    id: 'step-uuid-004',
    problem_id: 'problem-uuid-001',
    step_order: 4,
    step_type: 'identify_operation',
    prompt_text: 'What operation should we use?',
    simplified_text: 'Add or subtract?',
    correct_answer: 'subtraction',
    answer_type: 'multiple_choice',
    options: [
      { value: 'addition', label: 'Addition (+)' },
      { value: 'subtraction', label: 'Subtraction (-)' },
    ],
    hints: ['When we give something away, do we have more or less?'],
    points: 15,
    emoji_hint: '➖',
  },
  {
    id: 'step-uuid-005',
    problem_id: 'problem-uuid-001',
    step_order: 5,
    step_type: 'solve',
    prompt_text: 'What is 5 - 2?',
    simplified_text: 'Calculate the answer',
    correct_answer: 3,
    answer_type: 'number_input',
    hints: ['Start with 5 and take away 2', 'Count backwards from 5'],
    points: 20,
    emoji_hint: '🧮',
  },
];

// ============ PROBLEMS ============
export const problems: Record<string, Problem> = {
  default: {
    id: 'problem-uuid-001',
    class_id: 'class-uuid-001',
    lesson_id: 'lesson-uuid-001',
    original_text: 'Maria has 5 apples. She gives 2 to her friend. How many apples does Maria have left?',
    simplified_text: 'Maria has 5 apples. She gives 2 away. How many left?',
    skill_tags: ['subtraction'],
    difficulty: 1,
    is_published: true,
    state: 'published',
    scene_emoji: '🍎',
    created_at: '2025-01-10T00:00:00Z',
    steps: scaffoldSteps,
  },
  withSteps: {
    id: 'problem-uuid-001',
    class_id: 'class-uuid-001',
    lesson_id: 'lesson-uuid-001',
    original_text: 'Maria has 5 apples. She gives 2 to her friend. How many apples does Maria have left?',
    simplified_text: 'Maria has 5 apples. She gives 2 away. How many left?',
    skill_tags: ['subtraction'],
    difficulty: 1,
    is_published: true,
    state: 'published',
    scene_emoji: '🍎',
    created_at: '2025-01-10T00:00:00Z',
    steps: scaffoldSteps,
  },
  unpublished: {
    id: 'problem-uuid-002',
    class_id: 'class-uuid-001',
    lesson_id: 'lesson-uuid-001',
    original_text: 'Tom has 3 cars. He gets 4 more cars. How many cars does Tom have now?',
    skill_tags: ['addition'],
    difficulty: 1,
    is_published: false,
    state: 'draft',
    created_at: '2025-01-11T00:00:00Z',
    steps: [],
  },
  multiStep: {
    id: 'problem-uuid-003',
    class_id: 'class-uuid-001',
    original_text: 'Sam has 10 stickers. He gives 3 to his sister and 2 to his brother. How many stickers does Sam have left?',
    skill_tags: ['subtraction', 'multi-step'],
    difficulty: 2,
    is_published: true,
    state: 'published',
    scene_emoji: '⭐',
    created_at: '2025-01-12T00:00:00Z',
    steps: [],
  },
};

// ============ ASSIGNMENTS ============
export const assignments: Record<string, Assignment> = {
  default: {
    id: 'assignment-uuid-001',
    class_id: 'class-uuid-001',
    title: 'Week 1: Addition Practice',
    week_start: '2025-01-13',
    week_end: '2025-01-19',
    problem_ids: ['problem-uuid-001', 'problem-uuid-002'],
    created_at: '2025-01-13T00:00:00Z',
  },
  withProblems: {
    id: 'assignment-uuid-001',
    class_id: 'class-uuid-001',
    title: 'Week 1: Addition Practice',
    week_start: '2025-01-13',
    week_end: '2025-01-19',
    problem_ids: ['problem-uuid-001'],
    problems: [problems.withSteps],
    created_at: '2025-01-13T00:00:00Z',
  },
};

// ============ PROGRESS ============
export const progress: Record<string, StudentProgress> = {
  default: {
    id: 'progress-uuid-001',
    student_id: 'student-uuid-001',
    problem_id: 'problem-uuid-001',
    current_step: 3,
    is_complete: false,
    total_points_earned: 30,
    stars_earned: 0,
    started_at: '2025-01-14T10:00:00Z',
  },
  completed: {
    id: 'progress-uuid-002',
    student_id: 'student-uuid-001',
    problem_id: 'problem-uuid-002',
    current_step: 5,
    is_complete: true,
    total_points_earned: 65,
    stars_earned: 3,
    started_at: '2025-01-14T09:00:00Z',
    completed_at: '2025-01-14T09:30:00Z',
  },
};

// ============ ANALYTICS ============
export const analytics: { class: ClassAnalytics; student: StudentAnalytics } = {
  class: {
    class_id: 'class-uuid-001',
    total_students: 3,
    total_problems: 5,
    average_completion_rate: 0.67,
    average_points_per_student: 133,
    step_failure_rates: [
      { step_type: 'find_objects', failure_rate: 0.1, total_attempts: 50 },
      { step_type: 'find_numbers', failure_rate: 0.15, total_attempts: 45 },
      { step_type: 'identify_operation', failure_rate: 0.25, total_attempts: 40 },
      { step_type: 'build_equation', failure_rate: 0.3, total_attempts: 35 },
      { step_type: 'solve', failure_rate: 0.2, total_attempts: 30 },
    ],
    weekly_progress: [
      { week: '2025-W02', problems_completed: 15, average_stars: 2.5 },
      { week: '2025-W03', problems_completed: 20, average_stars: 2.7 },
    ],
  },
  student: {
    student_id: 'student-uuid-001',
    student_name: 'Student A1',
    total_problems_attempted: 5,
    total_problems_completed: 4,
    total_points: 150,
    average_stars: 2.5,
    strengths: ['addition', 'subtraction'],
    areas_for_improvement: ['multi-step'],
    recent_activity: [
      {
        problem_id: 'problem-uuid-001',
        problem_text: 'Maria has 5 apples...',
        completed_at: '2025-01-14T09:30:00Z',
        stars_earned: 3,
        points_earned: 65,
      },
    ],
  },
};

// ============ SCAFFOLDING RESPONSE ============
export const scaffoldingResponse: ScaffoldingResponse = {
  simplified_problem: 'Maria has 5 apples. She gives 2 away. How many left?',
  skill_tags: ['subtraction'],
  difficulty: 1,
  scene_emoji: '🍎',
  steps: scaffoldSteps.map(({ id, problem_id, ...step }) => step),
};

// ============ EXPORT ALL FIXTURES ============
export const fixtures = {
  tokens,
  teachers,
  classes,
  students,
  teacherStudents,
  studentList,
  modules,
  lessons,
  scaffoldSteps,
  problems,
  assignments,
  progress,
  analytics,
  scaffoldingResponse,
};

export default fixtures;

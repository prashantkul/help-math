export interface ModuleSummary {
  id: string;
  name: string;
  title: string;
  grade: number;
  lesson_count: number;
  path: string;
}

export interface CurriculumIndex {
  modules: ModuleSummary[];
}

export interface Topic {
  id: string;
  code: string;
  title: string;
  lessons: number[];
}

export interface CurriculumModule {
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
  answer?: unknown;
  skills?: string[];
}

export interface CurriculumLesson {
  lesson_number: number;
  topic: string;
  objective: string;
  problems: CurriculumProblem[];
}

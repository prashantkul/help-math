import type { CurriculumIndex, CurriculumModule, CurriculumLesson } from '../types/curriculum';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const curriculumApi = {
  async getModules(): Promise<CurriculumIndex> {
    const response = await fetch(`${API_BASE}/curriculum/modules`);
    if (!response.ok) {
      throw new Error('Failed to fetch curriculum modules');
    }
    return response.json();
  },

  async getModule(id: string): Promise<CurriculumModule> {
    const response = await fetch(`${API_BASE}/curriculum/modules/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch module: ${id}`);
    }
    return response.json();
  },

  async getLesson(moduleId: string, lessonNum: number): Promise<CurriculumLesson> {
    const response = await fetch(`${API_BASE}/curriculum/modules/${moduleId}/lessons/${lessonNum}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lesson ${lessonNum} from module ${moduleId}`);
    }
    return response.json();
  },
};

import { useState, useEffect } from 'react';
import { curriculumApi } from '../../api/curriculumApi';
import type { ModuleSummary, CurriculumModule, CurriculumLesson, CurriculumProblem } from '../../types/curriculum';

interface Props {
  grade: number;
  onSelectProblems: (problems: CurriculumProblem[]) => void;
}

export function CurriculumBrowser({ grade, onSelectProblems }: Props) {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [module, setModule] = useState<CurriculumModule | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load modules list on mount or grade change
  useEffect(() => {
    loadModules();
  }, [grade]);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await curriculumApi.getModules();
      // Filter modules by grade
      const filtered = data.modules.filter((m) => m.grade === grade);
      setModules(filtered);
      // Reset selections
      setSelectedModuleId(null);
      setModule(null);
      setSelectedTopic(null);
      setLesson(null);
      setSelectedProblems(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const loadModule = async (moduleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await curriculumApi.getModule(moduleId);
      setModule(data);
      setSelectedModuleId(moduleId);
      setSelectedTopic(null);
      setLesson(null);
      setSelectedProblems(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load module');
    } finally {
      setLoading(false);
    }
  };

  const loadLesson = async (lessonNum: number) => {
    if (!selectedModuleId) return;
    try {
      setLoading(true);
      const data = await curriculumApi.getLesson(selectedModuleId, lessonNum);
      setLesson(data);
      setSelectedProblems(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const toggleProblem = (id: string) => {
    const next = new Set(selectedProblems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProblems(next);
  };

  const handleConfirm = () => {
    if (!lesson) return;
    const problems = lesson.problems.filter((p) => selectedProblems.has(p.id));
    onSelectProblems(problems);
  };

  if (loading && modules.length === 0) {
    return <div className="p-4 text-gray-500">Loading curriculum for Grade {grade}...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (modules.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-gray-500">No curriculum modules available for Grade {grade}.</p>
        <button
          onClick={loadModules}
          className="mt-2 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Grade {grade} Curriculum</h3>
        <button
          onClick={loadModules}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          title="Refresh curriculum from server"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Module selector */}
      <div className="mb-4">
        <label className="block font-medium mb-2">Select Module:</label>
        <select
          className="w-full p-2 border rounded"
          value={selectedModuleId || ''}
          onChange={(e) => {
            if (e.target.value) {
              loadModule(e.target.value);
            } else {
              setSelectedModuleId(null);
              setModule(null);
            }
          }}
        >
          <option value="">-- Choose a module --</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}: {m.title} ({m.lesson_count} lessons)
            </option>
          ))}
        </select>
      </div>

      {/* Topic selector */}
      {module && (
        <div className="mb-4">
          <label className="block font-medium mb-2">Select Topic:</label>
          <select
            className="w-full p-2 border rounded"
            value={selectedTopic || ''}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              setLesson(null);
              setSelectedProblems(new Set());
            }}
          >
            <option value="">-- Choose a topic --</option>
            {module.topics.map((t) => (
              <option key={t.id} value={t.id}>
                Topic {t.code}: {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lesson selector */}
      {selectedTopic && module && (
        <div className="mb-4">
          <label className="block font-medium mb-2">Select Lesson:</label>
          <div className="flex flex-wrap gap-2">
            {module.topics
              .find((t) => t.id === selectedTopic)
              ?.lessons.map((num) => (
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

      {/* Loading indicator for lesson */}
      {loading && selectedTopic && (
        <div className="mb-4 text-gray-500">Loading lesson...</div>
      )}

      {/* Problem list */}
      {lesson && !loading && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{lesson.objective}</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {lesson.problems.map((p) => (
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
                <div className="flex-1">
                  <span className="font-medium">#{p.number}</span>{' '}
                  <span className="text-gray-700">
                    {p.text.length > 100 ? `${p.text.slice(0, 100)}...` : p.text}
                  </span>
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
          Add {selectedProblems.size} Problem{selectedProblems.size > 1 ? 's' : ''} to Assignment
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronRight, FolderOpen, FileText, Trash2, Edit2, Check, X, Clock, Calendar, Download, Settings, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { curriculumApi } from '../../api/curriculumApi';
import { Button, Card, Loading, Modal } from '../../components/common';
import type { Module, Class, Lesson } from '../../types';
import type { ModuleSummary, CurriculumModule } from '../../types/curriculum';

export default function CurriculumManager() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [classData, setClassData] = useState<Class | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Modal states
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Curriculum import states
  const [curriculumModules, setCurriculumModules] = useState<ModuleSummary[]>([]);
  const [selectedCurriculumModule, setSelectedCurriculumModule] = useState<string>('');
  const [selectedCurriculumModuleData, setSelectedCurriculumModuleData] = useState<CurriculumModule | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');

  // Edit states
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Schedule states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled' | 'manual' | 'sequential'>('immediate');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleAfterLesson, setScheduleAfterLesson] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Scaffold prompt states
  const [showScaffoldPromptModal, setShowScaffoldPromptModal] = useState(false);
  const [selectedModuleForPrompt, setSelectedModuleForPrompt] = useState<Module | null>(null);
  const [scaffoldPrompt, setScaffoldPrompt] = useState('');
  const [newScaffoldPrompt, setNewScaffoldPrompt] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  useEffect(() => {
    if (classId && teacher) {
      fetchData();
    }
  }, [classId, teacher]);

  const fetchData = async () => {
    setIsLoading(true);

    const [classesResult, modulesResult] = await Promise.all([
      apiClient.getClasses(),
      apiClient.getModules(classId!),
    ]);

    if (classesResult.data) {
      const cls = classesResult.data.find((c) => c.id === classId);
      if (cls) setClassData(cls);
    }

    if (modulesResult.data) {
      setModules(modulesResult.data);
      // Expand first module by default
      if (modulesResult.data.length > 0 && !expandedModule) {
        setExpandedModule(modulesResult.data[0].id);
      }
    }

    setIsLoading(false);
  };

  const loadCurriculumModules = async () => {
    if (!classData) return;
    setLoadingCurriculum(true);
    try {
      const data = await curriculumApi.getModules();
      // Filter by class grade
      const filtered = data.modules.filter((m) => m.grade === classData.grade);
      setCurriculumModules(filtered);
    } catch (e) {
      console.error('Failed to load curriculum modules:', e);
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const handleOpenAddModuleModal = () => {
    setShowAddModuleModal(true);
    loadCurriculumModules();
  };

  const handleSelectCurriculumModule = async (moduleId: string) => {
    setSelectedCurriculumModule(moduleId);
    setSelectedCurriculumModuleData(null);
    const selected = curriculumModules.find((m) => m.id === moduleId);
    if (selected) {
      setNewName(selected.name);
      setNewDescription(selected.title);
      // Fetch full module details to get lesson list
      try {
        const fullModule = await curriculumApi.getModule(moduleId);
        setSelectedCurriculumModuleData(fullModule);
      } catch (e) {
        console.error('Failed to load curriculum module details:', e);
      }
    }
  };

  const handleAddModule = async () => {
    if (!classId || !newName.trim()) return;

    setIsCreating(true);
    setImportProgress('Creating module...');

    const result = await apiClient.createModule(classId, newName.trim(), newDescription.trim() || undefined, newScaffoldPrompt.trim() || undefined);
    if (result.data) {
      const newModule = result.data;

      // If a curriculum module was selected, import its lessons
      if (selectedCurriculumModuleData) {
        // Get all unique lesson numbers from topics
        const lessonNumbers = new Set<number>();
        selectedCurriculumModuleData.topics.forEach(topic => {
          topic.lessons.forEach(lessonNum => lessonNumbers.add(lessonNum));
        });

        const sortedLessonNumbers = Array.from(lessonNumbers).sort((a, b) => a - b);
        const createdLessons: Lesson[] = [];

        for (let i = 0; i < sortedLessonNumbers.length; i++) {
          const lessonNum = sortedLessonNumbers[i];
          setImportProgress(`Importing lesson ${i + 1} of ${sortedLessonNumbers.length}...`);
          try {
            // Fetch lesson details from curriculum
            const curriculumLesson = await curriculumApi.getLesson(selectedCurriculumModule, lessonNum);

            // Create the lesson in our system
            const lessonResult = await apiClient.createLesson(
              newModule.id,
              `Lesson ${lessonNum}: ${curriculumLesson.objective.slice(0, 50)}${curriculumLesson.objective.length > 50 ? '...' : ''}`,
              curriculumLesson.objective
            );

            if (lessonResult.data) {
              const createdLesson = lessonResult.data;

              // Import problems for this lesson
              if (curriculumLesson.problems && curriculumLesson.problems.length > 0) {
                let problemCount = 0;
                for (const problem of curriculumLesson.problems) {
                  problemCount++;
                  setImportProgress(`Lesson ${i + 1}/${sortedLessonNumbers.length}: Importing problem ${problemCount}/${curriculumLesson.problems.length}...`);
                  try {
                    await apiClient.createLessonProblem(createdLesson.id, problem.text);
                  } catch (e) {
                    console.error(`Failed to import problem ${problem.id}:`, e);
                  }
                }
                createdLesson.problem_count = problemCount;
              }

              createdLessons.push(createdLesson);
            }
          } catch (e) {
            console.error(`Failed to import lesson ${lessonNum}:`, e);
          }
        }

        // Update the module with the created lessons
        newModule.lessons = createdLessons;
      }

      setModules([...modules, newModule]);
      setExpandedModule(newModule.id);
    }

    setIsCreating(false);
    setImportProgress('');
    setShowAddModuleModal(false);
    setNewName('');
    setNewDescription('');
    setNewScaffoldPrompt('');
    setSelectedCurriculumModule('');
    setSelectedCurriculumModuleData(null);
  };

  const handleAddLesson = async () => {
    if (!selectedModuleId || !newName.trim()) return;

    setIsCreating(true);
    const result = await apiClient.createLesson(selectedModuleId, newName.trim(), newDescription.trim() || undefined);
    if (result.data) {
      setModules(modules.map(m =>
        m.id === selectedModuleId
          ? { ...m, lessons: [...(m.lessons || []), result.data!] }
          : m
      ));
    }
    setIsCreating(false);
    setShowAddLessonModal(false);
    setNewName('');
    setNewDescription('');
    setSelectedModuleId(null);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    await apiClient.deleteModule(moduleId);
    setModules(modules.filter(m => m.id !== moduleId));
  };

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm('Delete this lesson and all its problems?')) return;
    await apiClient.deleteLesson(lessonId);
    setModules(modules.map(m =>
      m.id === moduleId
        ? { ...m, lessons: (m.lessons || []).filter(l => l.id !== lessonId) }
        : m
    ));
  };

  const handleSaveModuleName = async (moduleId: string) => {
    if (!editName.trim()) return;
    await apiClient.updateModule(moduleId, { name: editName.trim() });
    setModules(modules.map(m =>
      m.id === moduleId ? { ...m, name: editName.trim() } : m
    ));
    setEditingModule(null);
    setEditName('');
  };

  const handleSaveLessonName = async (moduleId: string, lessonId: string) => {
    if (!editName.trim()) return;
    await apiClient.updateLesson(lessonId, { name: editName.trim() });
    setModules(modules.map(m =>
      m.id === moduleId
        ? {
            ...m,
            lessons: (m.lessons || []).map(l =>
              l.id === lessonId ? { ...l, name: editName.trim() } : l
            )
          }
        : m
    ));
    setEditingLesson(null);
    setEditName('');
  };

  const handleOpenScheduleModal = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setScheduleType(lesson.release_type || 'immediate');
    setScheduleDate(lesson.release_at || '');
    setScheduleAfterLesson(lesson.release_after_lesson_id || '');
    setShowScheduleModal(true);
  };

  const handleOpenScaffoldPromptModal = (module: Module) => {
    setSelectedModuleForPrompt(module);
    setScaffoldPrompt(module.scaffold_prompt || '');
    setShowScaffoldPromptModal(true);
  };

  const handleSaveScaffoldPrompt = async () => {
    if (!selectedModuleForPrompt) return;

    setIsSavingPrompt(true);
    const result = await apiClient.updateModule(selectedModuleForPrompt.id, {
      scaffold_prompt: scaffoldPrompt || undefined,
    });
    setIsSavingPrompt(false);

    if (result.data) {
      setModules(modules.map(m =>
        m.id === selectedModuleForPrompt.id ? { ...m, scaffold_prompt: scaffoldPrompt } : m
      ));
      setShowScaffoldPromptModal(false);
      setSelectedModuleForPrompt(null);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedLesson) return;

    setIsSavingSchedule(true);
    const result = await apiClient.updateLessonSchedule(selectedLesson.id, {
      release_type: scheduleType,
      release_at: scheduleType === 'scheduled' ? scheduleDate : undefined,
      release_after_lesson_id: scheduleType === 'sequential' ? scheduleAfterLesson : undefined,
    });
    setIsSavingSchedule(false);

    if (result.data) {
      setModules(modules.map(m => ({
        ...m,
        lessons: (m.lessons || []).map(l =>
          l.id === selectedLesson.id ? result.data! : l
        )
      })));
      setShowScheduleModal(false);
      setSelectedLesson(null);
    }
  };

  // Get all lessons for sequential selection
  const allLessons = modules.flatMap(m => m.lessons || []);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading curriculum..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/teacher/dashboard">
                <button className="flex items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Dashboard
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {classData?.name} - Curriculum
                </h1>
                <p className="text-sm text-white/80">
                  {modules.length} module{modules.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleOpenAddModuleModal}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {modules.length === 0 ? (
          <Card padding="lg" className="text-center">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">No modules yet</h3>
            <p className="text-gray-600 mb-4">
              Create modules to organize your lessons and problems.
            </p>
            <Button variant="primary" onClick={handleOpenAddModuleModal}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Module
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {modules.map((module, moduleIndex) => (
              <Card key={module.id} padding="none" className="overflow-hidden">
                {/* Module Header */}
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    expandedModule === module.id
                      ? 'bg-blue-50 border-b border-blue-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                      {moduleIndex + 1}
                    </div>
                    {editingModule === module.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 border rounded"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveModuleName(module.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingModule(null); setEditName(''); }}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-bold text-gray-800">{module.name}</h3>
                        {module.description && (
                          <p className="text-sm text-gray-500">{module.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {module.lessons?.length || 0} lesson{(module.lessons?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    {module.scaffold_prompt && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Prompt
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenScaffoldPromptModal(module);
                      }}
                      className={`p-1 rounded ${module.scaffold_prompt ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                      title="AI Scaffolding Settings"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingModule(module.id);
                        setEditName(module.name);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModule(module.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedModule === module.id ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Lessons List */}
                {expandedModule === module.id && (
                  <div className="bg-gray-50/50">
                    {(module.lessons || []).length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No lessons yet.{' '}
                        <button
                          onClick={() => {
                            setSelectedModuleId(module.id);
                            setShowAddLessonModal(true);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {module.lessons?.map((lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between p-4 pl-12 hover:bg-white transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-cyan-600" />
                              {editingLesson === lesson.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="px-2 py-1 border rounded"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveLessonName(module.id, lesson.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingLesson(null); setEditName(''); }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-gray-400 mr-2">{moduleIndex + 1}.{lessonIndex + 1}</span>
                                  <span className="font-medium text-gray-800">{lesson.name}</span>
                                  {lesson.problem_count !== undefined && lesson.problem_count > 0 && (
                                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                      {lesson.problem_count} problem{lesson.problem_count !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenScheduleModal(lesson)}
                                className={`p-1 rounded ${
                                  lesson.release_type === 'immediate'
                                    ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                    : 'text-blue-600 bg-blue-50'
                                }`}
                                title="Schedule release"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              <Link to={`/teacher/lessons/${lesson.id}/problems`}>
                                <Button variant="outline" size="sm">
                                  Manage Problems
                                </Button>
                              </Link>
                              <button
                                onClick={() => {
                                  setEditingLesson(lesson.id);
                                  setEditName(lesson.name);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add Lesson Button */}
                    <div className="p-3 pl-12 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setShowAddLessonModal(true);
                        }}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Lesson
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Module Modal */}
      <Modal
        isOpen={showAddModuleModal}
        onClose={() => {
          setShowAddModuleModal(false);
          setSelectedCurriculumModule('');
          setSelectedCurriculumModuleData(null);
          setNewName('');
          setNewDescription('');
          setNewScaffoldPrompt('');
          setImportProgress('');
        }}
        title="Add Module"
      >
        <div className="space-y-4">
          {/* Import from Curriculum */}
          {curriculumModules.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-blue-600" />
                <label className="text-sm font-medium text-blue-800">
                  Import from Grade {classData?.grade} Curriculum
                </label>
              </div>
              <select
                value={selectedCurriculumModule}
                onChange={(e) => handleSelectCurriculumModule(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-blue-200 focus:border-blue-500 focus:outline-none bg-white"
              >
                <option value="">-- Select a curriculum module --</option>
                {curriculumModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}: {m.title} ({m.lesson_count} lessons)
                  </option>
                ))}
              </select>
              {selectedCurriculumModuleData && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    Will import {(() => {
                      const lessonNumbers = new Set<number>();
                      selectedCurriculumModuleData.topics.forEach(topic => {
                        topic.lessons.forEach(lessonNum => lessonNumbers.add(lessonNum));
                      });
                      return lessonNumbers.size;
                    })()} lessons from this curriculum module
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Topics: {selectedCurriculumModuleData.topics.map(t => t.code).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
          {loadingCurriculum && (
            <p className="text-sm text-gray-500">Loading curriculum modules...</p>
          )}
          {!loadingCurriculum && curriculumModules.length === 0 && classData && (
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              No curriculum modules available for Grade {classData.grade}.
            </p>
          )}

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 mb-3">Or create a custom module:</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Module Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Unit 1: Addition & Subtraction"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description of this module..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none min-h-[80px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Scaffold Prompt (optional)
                </label>
                <textarea
                  value={newScaffoldPrompt}
                  onChange={(e) => setNewScaffoldPrompt(e.target.value)}
                  placeholder="e.g., Generate steps in Spanish, use visual models..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none min-h-[60px] text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Custom instructions for AI when generating scaffolding. You can also set this later.
                </p>
              </div>
            </div>
          </div>

          {importProgress && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">{importProgress}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddModuleModal(false);
                setSelectedCurriculumModule('');
                setSelectedCurriculumModuleData(null);
                setNewName('');
                setNewDescription('');
                setNewScaffoldPrompt('');
                setImportProgress('');
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAddModule}
              isLoading={isCreating}
              disabled={!newName.trim() || isCreating}
            >
              {selectedCurriculumModuleData ? 'Import Module & Lessons' : 'Add Module'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Lesson Modal */}
      <Modal
        isOpen={showAddLessonModal}
        onClose={() => { setShowAddLessonModal(false); setSelectedModuleId(null); }}
        title="Add Lesson"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lesson Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Adding Single Digits"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description of this lesson..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none min-h-[80px]"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowAddLessonModal(false); setSelectedModuleId(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAddLesson}
              isLoading={isCreating}
              disabled={!newName.trim() || isCreating}
            >
              Add Lesson
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Lesson Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedLesson(null);
        }}
        title="Schedule Lesson Release"
        size="lg"
      >
        <div className="space-y-4">
          {selectedLesson && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800">{selectedLesson.name}</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Release Type
                </label>

                <button
                  onClick={() => setScheduleType('immediate')}
                  className={`w-full p-4 rounded-xl border text-left transition-colors ${
                    scheduleType === 'immediate'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Check className={`w-5 h-5 ${scheduleType === 'immediate' ? 'text-blue-600' : 'text-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-800">Immediate</p>
                      <p className="text-sm text-gray-500">Students can access this lesson right away</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setScheduleType('scheduled')}
                  className={`w-full p-4 rounded-xl border text-left transition-colors ${
                    scheduleType === 'scheduled'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className={`w-5 h-5 ${scheduleType === 'scheduled' ? 'text-blue-600' : 'text-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-800">Scheduled</p>
                      <p className="text-sm text-gray-500">Release at a specific date and time</p>
                    </div>
                  </div>
                </button>

                {scheduleType === 'scheduled' && (
                  <div className="ml-8">
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <button
                  onClick={() => setScheduleType('manual')}
                  className={`w-full p-4 rounded-xl border text-left transition-colors ${
                    scheduleType === 'manual'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-5 h-5 ${scheduleType === 'manual' ? 'text-blue-600' : 'text-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-800">Manual</p>
                      <p className="text-sm text-gray-500">Hidden until you manually release it</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setScheduleType('sequential')}
                  className={`w-full p-4 rounded-xl border text-left transition-colors ${
                    scheduleType === 'sequential'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className={`w-5 h-5 ${scheduleType === 'sequential' ? 'text-blue-600' : 'text-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-800">Sequential</p>
                      <p className="text-sm text-gray-500">Release after another lesson is completed</p>
                    </div>
                  </div>
                </button>

                {scheduleType === 'sequential' && (
                  <div className="ml-8">
                    <select
                      value={scheduleAfterLesson}
                      onChange={(e) => setScheduleAfterLesson(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a lesson...</option>
                      {allLessons
                        .filter(l => l.id !== selectedLesson.id)
                        .map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setSelectedLesson(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveSchedule}
                  isLoading={isSavingSchedule}
                  disabled={
                    (scheduleType === 'scheduled' && !scheduleDate) ||
                    (scheduleType === 'sequential' && !scheduleAfterLesson)
                  }
                >
                  Save Schedule
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* AI Scaffold Prompt Modal */}
      <Modal
        isOpen={showScaffoldPromptModal}
        onClose={() => {
          setShowScaffoldPromptModal(false);
          setSelectedModuleForPrompt(null);
          setScaffoldPrompt('');
        }}
        title="AI Scaffolding Settings"
        size="lg"
      >
        <div className="space-y-4">
          {selectedModuleForPrompt && (
            <>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <p className="font-medium text-purple-800">{selectedModuleForPrompt.name}</p>
                </div>
                <p className="text-sm text-purple-600 mt-1">
                  Customize how AI generates scaffolding steps for problems in this module.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom AI Instructions
                </label>
                <textarea
                  value={scaffoldPrompt}
                  onChange={(e) => setScaffoldPrompt(e.target.value)}
                  placeholder="Enter custom instructions for the AI..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none min-h-[120px] font-mono text-sm"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm font-medium text-gray-700 mb-3">Example Prompts:</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setScaffoldPrompt('Generate all scaffolding steps in Spanish. Use simple Spanish vocabulary appropriate for 3rd graders.')}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">🇪🇸 Spanish Language</p>
                    <p className="text-xs text-gray-500 mt-1">Generate all scaffolding steps in Spanish...</p>
                  </button>
                  <button
                    onClick={() => setScaffoldPrompt('Use visual representations like number lines, arrays, and area models in the hints. Reference manipulatives students can use (counters, base-ten blocks).')}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">📐 Visual & Manipulatives</p>
                    <p className="text-xs text-gray-500 mt-1">Use visual representations like number lines, arrays...</p>
                  </button>
                  <button
                    onClick={() => setScaffoldPrompt('Focus on fraction concepts. Use pizza slices, chocolate bars, and other food items as visual examples. Emphasize equal parts and fair sharing.')}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">🍕 Fractions with Food</p>
                    <p className="text-xs text-gray-500 mt-1">Focus on fraction concepts with pizza, chocolate bars...</p>
                  </button>
                  <button
                    onClick={() => setScaffoldPrompt('Use very simple vocabulary (Lexile 200-300). Break down each step into smaller sub-steps. Provide 3-4 hints per step instead of 2.')}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">📖 Extra Support (Newcomer ELL)</p>
                    <p className="text-xs text-gray-500 mt-1">Use very simple vocabulary, break into smaller steps...</p>
                  </button>
                  <button
                    onClick={() => setScaffoldPrompt('Include real-world connections to money and shopping. Use prices, making change, and buying items as examples.')}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">💰 Money & Shopping Context</p>
                    <p className="text-xs text-gray-500 mt-1">Include real-world connections to money and shopping...</p>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowScaffoldPromptModal(false);
                    setSelectedModuleForPrompt(null);
                    setScaffoldPrompt('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setScaffoldPrompt('')}
                  disabled={!scaffoldPrompt}
                >
                  Clear
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveScaffoldPrompt}
                  isLoading={isSavingPrompt}
                >
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

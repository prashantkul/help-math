import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Wand2, Check, X, Eye, Trash2, Send, CheckCircle2, Circle, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal, ProgressBar } from '../../components/common';
import type { Problem, Class, ExtractedProblem, ProblemState } from '../../types';

// Helper function to get state badge styling
const getStateBadge = (state: ProblemState) => {
  switch (state) {
    case 'draft':
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' };
    case 'scaffolded':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Scaffolded' };
    case 'reviewed':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Reviewed' };
    case 'published':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unknown' };
  }
};

export default function ProblemManager() {
  const { classId, lessonId } = useParams<{ classId?: string; lessonId?: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if we're in lesson mode or class mode
  const isLessonMode = !!lessonId;

  const [classData, setClassData] = useState<Class | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [derivedClassId, setDerivedClassId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProblemText, setNewProblemText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractedProblems, setExtractedProblems] = useState<ExtractedProblem[]>([]);
  const [showExtractedModal, setShowExtractedModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Batch scaffold generation state
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentProblem: '' });
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  useEffect(() => {
    if ((classId || lessonId) && teacher) {
      const fetchData = async () => {
        setIsLoading(true);

        if (isLessonMode && lessonId) {
          // Fetch lesson info and problems for the lesson
          const [lessonResult, problemsResult] = await Promise.all([
            apiClient.getLesson(lessonId),
            apiClient.getLessonProblems(lessonId),
          ]);

          if (lessonResult.data) {
            setLessonName(lessonResult.data.name);
            if (lessonResult.data.class_id) {
              setDerivedClassId(lessonResult.data.class_id);
              // Also fetch class data to get ELL settings
              const classesResult = await apiClient.getClasses();
              if (classesResult.data) {
                const cls = classesResult.data.find((c) => c.id === lessonResult.data!.class_id);
                if (cls) setClassData(cls);
              }
            }
          }

          if (problemsResult.data) {
            setProblems(problemsResult.data);
          }
        } else if (classId) {
          // Fetch class info and problems for the class
          const [classesResult, problemsResult] = await Promise.all([
            apiClient.getClasses(),
            apiClient.getProblems(classId),
          ]);

          if (classesResult.data) {
            const cls = classesResult.data.find((c) => c.id === classId);
            if (cls) setClassData(cls);
          }

          if (problemsResult.data) {
            setProblems(problemsResult.data);
          }
        }

        setIsLoading(false);
      };
      fetchData();
    }
  }, [classId, lessonId, teacher, isLessonMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const effectiveClassId = classId || derivedClassId;
    if (!file || !effectiveClassId) return;

    setIsUploading(true);
    const result = await apiClient.uploadPDF(effectiveClassId, file);
    setIsUploading(false);

    if (result.data?.extracted_problems) {
      setExtractedProblems(result.data.extracted_problems);
      setShowExtractedModal(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddExtractedProblem = async (text: string) => {
    if (!classId && !lessonId) return;

    setIsCreating(true);
    const result = isLessonMode && lessonId
      ? await apiClient.createLessonProblem(lessonId, text)
      : await apiClient.createProblem(classId!, text);
    if (result.data) {
      setProblems([result.data, ...problems]);
    }
    setIsCreating(false);
    setExtractedProblems(extractedProblems.filter((p) => p.text !== text));
  };

  const handleAddProblem = async () => {
    if ((!classId && !lessonId) || !newProblemText.trim()) return;

    setIsCreating(true);
    const result = isLessonMode && lessonId
      ? await apiClient.createLessonProblem(lessonId, newProblemText.trim())
      : await apiClient.createProblem(classId!, newProblemText.trim());
    if (result.data) {
      setProblems([result.data, ...problems]);
      setShowAddModal(false);
      setNewProblemText('');
    }
    setIsCreating(false);
  };

  const handleGenerateScaffold = async (problemId: string) => {
    setIsGenerating(true);
    try {
      console.log('Generating scaffold for problem:', problemId);
      const result = await apiClient.generateScaffold(problemId, classData?.settings.ell_level || 2);
      console.log('Scaffold result:', result);

      if (result.error) {
        console.error('Scaffold generation error:', result.error);
        alert(`Failed to generate scaffold: ${result.error}`);
      } else if (result.data) {
        // Refresh problem to get the scaffold
        const problemResult = await apiClient.getProblem(problemId);
        if (problemResult.data) {
          setProblems(problems.map((p) => (p.id === problemId ? problemResult.data! : p)));
          setSelectedProblem(problemResult.data);
        }
      }
    } catch (error) {
      console.error('Scaffold generation exception:', error);
      alert(`Failed to generate scaffold: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get problems that need scaffolding (draft with no steps)
  const problemsNeedingScaffold = problems.filter(
    (p) => (p.state === 'draft' || !p.state) && (!p.steps || p.steps.length === 0)
  );

  const handleBatchGenerateScaffolds = async () => {
    if (problemsNeedingScaffold.length === 0) return;

    setIsBatchGenerating(true);
    setShowBatchModal(true);
    setBatchErrors([]);
    setBatchProgress({ current: 0, total: problemsNeedingScaffold.length, currentProblem: '' });

    const updatedProblems = [...problems];
    const errors: string[] = [];

    for (let i = 0; i < problemsNeedingScaffold.length; i++) {
      const problem = problemsNeedingScaffold[i];
      setBatchProgress({
        current: i + 1,
        total: problemsNeedingScaffold.length,
        currentProblem: problem.original_text.slice(0, 50) + (problem.original_text.length > 50 ? '...' : ''),
      });

      try {
        const result = await apiClient.generateScaffold(problem.id, classData?.settings.ell_level || 2);

        if (result.error) {
          errors.push(`Problem "${problem.original_text.slice(0, 30)}...": ${result.error}`);
        } else if (result.data) {
          // Fetch updated problem
          const problemResult = await apiClient.getProblem(problem.id);
          if (problemResult.data) {
            const idx = updatedProblems.findIndex((p) => p.id === problem.id);
            if (idx !== -1) {
              updatedProblems[idx] = problemResult.data;
            }
          }
        }
      } catch (error) {
        errors.push(`Problem "${problem.original_text.slice(0, 30)}...": ${error}`);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < problemsNeedingScaffold.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setProblems(updatedProblems);
    setBatchErrors(errors);
    setIsBatchGenerating(false);
  };

  const handleReview = async (problemId: string) => {
    setIsReviewing(true);
    const result = await apiClient.reviewProblem(problemId);
    setIsReviewing(false);

    if (result.data) {
      setProblems(problems.map((p) => (p.id === problemId ? result.data! : p)));
      if (selectedProblem?.id === problemId) {
        setSelectedProblem(result.data);
      }
    }
  };

  const handlePublish = async (problemId: string) => {
    const result = await apiClient.publishProblem(problemId);
    if (result.data) {
      setProblems(problems.map((p) => (p.id === problemId ? result.data! : p)));
      if (selectedProblem?.id === problemId) {
        setSelectedProblem(result.data);
      }
    }
  };

  const handleDelete = async (problemId: string) => {
    await apiClient.deleteProblem(problemId);
    setProblems(problems.filter((p) => p.id !== problemId));
    if (selectedProblem?.id === problemId) {
      setSelectedProblem(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading problems..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/teacher/classes/${isLessonMode ? derivedClassId : classId}/curriculum`}
                className="flex items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Curriculum
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {isLessonMode ? lessonName : classData?.name} - Problems
                </h1>
                <p className="text-sm text-white/80">
                  {problems.length} problems | {problems.filter((p) => p.is_published).length} published
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload PDF'}
              </button>
              {problemsNeedingScaffold.length > 0 && (
                <button
                  onClick={handleBatchGenerateScaffolds}
                  disabled={isBatchGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  Generate All ({problemsNeedingScaffold.length})
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Add Problem
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Problems List */}
          <div className="lg:col-span-2 space-y-4">
            {problems.length === 0 ? (
              <Card padding="lg" className="text-center">
                <span className="text-5xl block mb-4">📝</span>
                <h3 className="text-lg font-bold text-gray-800 mb-2">No problems yet</h3>
                <p className="text-gray-600 mb-4">
                  Add problems manually or upload a PDF worksheet.
                </p>
              </Card>
            ) : (
              problems.map((problem) => (
                <Card
                  key={problem.id}
                  padding="md"
                  hover
                  onClick={() => setSelectedProblem(problem)}
                  className={`cursor-pointer ${
                    selectedProblem?.id === problem.id ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {problem.image_url ? (
                          <img src={problem.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <span className="text-xl">{problem.scene_emoji || '📝'}</span>
                        )}
                        {(() => {
                          const badge = getStateBadge(problem.state || 'draft');
                          return (
                            <span className={`${badge.bg} ${badge.text} text-xs font-bold px-2 py-0.5 rounded`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                        {problem.steps && problem.steps.length > 0 && (
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                            {problem.steps.length} steps
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 line-clamp-2">
                        {problem.original_text}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {problem.skill_tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Problem Detail Panel */}
          <div className="lg:col-span-1">
            {selectedProblem ? (
              <Card padding="lg" className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Problem Details</h3>
                  <button
                    onClick={() => setSelectedProblem(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Problem Image */}
                  {selectedProblem.image_url && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Image</label>
                      <img
                        src={selectedProblem.image_url}
                        alt="Problem illustration"
                        className="mt-2 max-w-full max-h-40 rounded-lg border object-contain"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Original</label>
                    <p className="text-gray-800 mt-1">{selectedProblem.original_text}</p>
                  </div>

                  {selectedProblem.simplified_text && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Simplified</label>
                      <p className="text-gray-800 mt-1">{selectedProblem.simplified_text}</p>
                    </div>
                  )}

                  {/* Image URL Input */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 block mb-1">Image URL</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/image.png"
                        defaultValue={selectedProblem.image_url || ''}
                        onBlur={(e) => {
                          const url = e.target.value.trim();
                          if (url !== (selectedProblem.image_url || '')) {
                            apiClient.updateProblem(selectedProblem.id, { image_url: url || undefined });
                            setSelectedProblem({ ...selectedProblem, image_url: url || undefined });
                            setProblems(problems.map(p =>
                              p.id === selectedProblem.id ? { ...p, image_url: url || undefined } : p
                            ));
                          }
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Paste an image URL to show with the problem</p>
                  </div>

                  {selectedProblem.steps && selectedProblem.steps.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">
                        Scaffold Steps ({selectedProblem.steps.length})
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedProblem.steps.map((step, i) => (
                          <div
                            key={step.id}
                            className="bg-gray-50 p-2 rounded-lg text-sm"
                          >
                            <span className="font-medium">{i + 1}.</span>{' '}
                            {step.step_type.replace('_', ' ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* State Workflow Indicator */}
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium text-gray-500 mb-3 block">
                      Workflow
                    </label>
                    <div className="flex items-center justify-between text-xs mb-4">
                      <div className={`flex flex-col items-center ${(selectedProblem.state || 'draft') === 'draft' ? 'text-blue-600' : 'text-green-600'}`}>
                        <Circle className={`w-5 h-5 ${(selectedProblem.state || 'draft') !== 'draft' ? 'fill-green-600' : ''}`} />
                        <span className="mt-1">Draft</span>
                      </div>
                      <div className="flex-1 h-0.5 bg-gray-200 mx-1">
                        <div className={`h-full ${['scaffolded', 'reviewed', 'published'].includes(selectedProblem.state || 'draft') ? 'bg-green-500' : ''}`} />
                      </div>
                      <div className={`flex flex-col items-center ${selectedProblem.state === 'scaffolded' ? 'text-blue-600' : ['reviewed', 'published'].includes(selectedProblem.state || '') ? 'text-green-600' : 'text-gray-400'}`}>
                        <Circle className={`w-5 h-5 ${['reviewed', 'published'].includes(selectedProblem.state || '') ? 'fill-green-600' : ''}`} />
                        <span className="mt-1">Scaffold</span>
                      </div>
                      <div className="flex-1 h-0.5 bg-gray-200 mx-1">
                        <div className={`h-full ${['reviewed', 'published'].includes(selectedProblem.state || '') ? 'bg-green-500' : ''}`} />
                      </div>
                      <div className={`flex flex-col items-center ${selectedProblem.state === 'reviewed' ? 'text-blue-600' : selectedProblem.state === 'published' ? 'text-green-600' : 'text-gray-400'}`}>
                        <Circle className={`w-5 h-5 ${selectedProblem.state === 'published' ? 'fill-green-600' : ''}`} />
                        <span className="mt-1">Review</span>
                      </div>
                      <div className="flex-1 h-0.5 bg-gray-200 mx-1">
                        <div className={`h-full ${selectedProblem.state === 'published' ? 'bg-green-500' : ''}`} />
                      </div>
                      <div className={`flex flex-col items-center ${selectedProblem.state === 'published' ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle2 className={`w-5 h-5 ${selectedProblem.state === 'published' ? 'fill-green-600' : ''}`} />
                        <span className="mt-1">Publish</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    {/* Generate scaffold - only for draft state with no steps */}
                    {(selectedProblem.state === 'draft' || !selectedProblem.state) && (!selectedProblem.steps || selectedProblem.steps.length === 0) && (
                      <Button
                        variant="primary"
                        className="w-full"
                        onClick={() => handleGenerateScaffold(selectedProblem.id)}
                        isLoading={isGenerating}
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate Scaffold
                      </Button>
                    )}

                    {/* Regenerate scaffold - when steps already exist */}
                    {selectedProblem.steps && selectedProblem.steps.length > 0 && selectedProblem.state !== 'published' && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowRegenerateModal(true)}
                        isLoading={isGenerating}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate Scaffold
                      </Button>
                    )}

                    {/* Preview - available after scaffolding */}
                    {selectedProblem.steps && selectedProblem.steps.length > 0 && (
                      <Link to={`/teacher/problems/${selectedProblem.id}/preview`}>
                        <Button
                          variant="outline"
                          className="w-full"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview as Student
                        </Button>
                      </Link>
                    )}

                    {/* Mark as Reviewed - only for scaffolded state */}
                    {selectedProblem.state === 'scaffolded' && (
                      <Button
                        variant="primary"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleReview(selectedProblem.id)}
                        isLoading={isReviewing}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Mark as Reviewed
                      </Button>
                    )}

                    {/* Publish - only for reviewed state */}
                    {selectedProblem.state === 'reviewed' && (
                      <Button
                        variant="success"
                        className="w-full"
                        onClick={() => handlePublish(selectedProblem.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Publish
                      </Button>
                    )}

                    {/* Show warning if trying to publish without review */}
                    {selectedProblem.state === 'scaffolded' && (
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg flex items-start gap-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        Review the scaffold before publishing to students
                      </p>
                    )}

                    <Button
                      variant="outline"
                      className="w-full text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(selectedProblem.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card padding="lg" className="text-center text-gray-500">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select a problem to view details</p>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Add Problem Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Problem"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Problem Text
            </label>
            <textarea
              value={newProblemText}
              onChange={(e) => setNewProblemText(e.target.value)}
              placeholder="Enter the word problem..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none min-h-[120px]"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAddProblem}
              isLoading={isCreating}
              disabled={!newProblemText.trim() || isCreating}
            >
              Add Problem
            </Button>
          </div>
        </div>
      </Modal>

      {/* Extracted Problems Modal */}
      <Modal
        isOpen={showExtractedModal}
        onClose={() => setShowExtractedModal(false)}
        title="Extracted Problems"
        size="lg"
      >
        <div className="space-y-4">
          {extractedProblems.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              All problems have been added!
            </p>
          ) : (
            extractedProblems.map((problem, i) => (
              <Card key={i} padding="md" className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-gray-800">{problem.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Page {problem.page_number} | Confidence: {Math.round(problem.confidence * 100)}%
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAddExtractedProblem(problem.text)}
                  isLoading={isCreating}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </Card>
            ))
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowExtractedModal(false)}
          >
            Done
          </Button>
        </div>
      </Modal>

      {/* Regenerate Scaffold Confirmation Modal */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Regenerate Scaffold"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-800 font-medium">Are you sure?</p>
              <p className="text-sm text-gray-600 mt-1">
                This will replace the existing {selectedProblem?.steps?.length || 0} scaffold steps with new AI-generated steps.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRegenerateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                setShowRegenerateModal(false);
                if (selectedProblem) {
                  handleGenerateScaffold(selectedProblem.id);
                }
              }}
              isLoading={isGenerating}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Scaffold Generation Modal */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => !isBatchGenerating && setShowBatchModal(false)}
        title="Generating Scaffolds"
      >
        <div className="space-y-4">
          {isBatchGenerating ? (
            <>
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Wand2 className="w-6 h-6 text-amber-600 animate-pulse" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-800 mb-2">
                  Generating scaffold {batchProgress.current} of {batchProgress.total}
                </p>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {batchProgress.currentProblem}
                </p>
              </div>
              <ProgressBar
                current={batchProgress.current}
                total={batchProgress.total}
                showSteps={false}
              />
              <p className="text-xs text-center text-gray-500">
                Please wait while AI generates scaffolds for each problem...
              </p>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-gray-800 mb-2">
                  Batch Generation Complete!
                </p>
                <p className="text-sm text-gray-600">
                  Successfully generated scaffolds for {batchProgress.total - batchErrors.length} of {batchProgress.total} problems.
                </p>
              </div>

              {batchErrors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    {batchErrors.length} problem{batchErrors.length > 1 ? 's' : ''} failed:
                  </p>
                  <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {batchErrors.map((error, i) => (
                      <li key={i} className="line-clamp-2">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                onClick={() => setShowBatchModal(false)}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

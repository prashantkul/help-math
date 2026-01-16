import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Wand2, Check, X, Eye, Trash2, Send } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal } from '../../components/common';
import { Problem, Class, ExtractedProblem } from '../../types';

export default function ProblemManager() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classData, setClassData] = useState<Class | null>(null);
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

    const [classesResult, problemsResult] = await Promise.all([
      apiClient.getClasses(),
      apiClient.getProblems(classId!),
    ]);

    if (classesResult.data) {
      const cls = classesResult.data.find((c) => c.id === classId);
      if (cls) setClassData(cls);
    }

    if (problemsResult.data) {
      setProblems(problemsResult.data);
    }

    setIsLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !classId) return;

    setIsUploading(true);
    const result = await apiClient.uploadPDF(classId, file);
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
    if (!classId) return;

    setIsCreating(true);
    const result = await apiClient.createProblem(classId, text);
    if (result.data) {
      setProblems([result.data, ...problems]);
    }
    setIsCreating(false);
    setExtractedProblems(extractedProblems.filter((p) => p.text !== text));
  };

  const handleAddProblem = async () => {
    if (!classId || !newProblemText.trim()) return;

    setIsCreating(true);
    const result = await apiClient.createProblem(classId, newProblemText.trim());
    if (result.data) {
      setProblems([result.data, ...problems]);
      setShowAddModal(false);
      setNewProblemText('');
    }
    setIsCreating(false);
  };

  const handleGenerateScaffold = async (problemId: string) => {
    setIsGenerating(true);
    const result = await apiClient.generateScaffold(problemId, classData?.settings.ell_level || 2);

    if (result.data) {
      // Refresh problem to get the scaffold
      const problemResult = await apiClient.getProblem(problemId);
      if (problemResult.data) {
        setProblems(problems.map((p) => (p.id === problemId ? problemResult.data! : p)));
        setSelectedProblem(problemResult.data);
      }
    }
    setIsGenerating(false);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loading message="Loading problems..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/teacher/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {classData?.name} - Problems
                </h1>
                <p className="text-sm text-gray-500">
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
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                isLoading={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </Button>
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                Add Problem
              </Button>
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
                        <span className="text-xl">{problem.scene_emoji || '📝'}</span>
                        {problem.is_published ? (
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                            Published
                          </span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded">
                            Draft
                          </span>
                        )}
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
              <Card padding="lg" className="sticky top-24">
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

                  <div className="flex flex-col gap-2 pt-4 border-t">
                    {(!selectedProblem.steps || selectedProblem.steps.length === 0) && (
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

                    {selectedProblem.steps && selectedProblem.steps.length > 0 && !selectedProblem.is_published && (
                      <Button
                        variant="success"
                        className="w-full"
                        onClick={() => handlePublish(selectedProblem.id)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Publish
                      </Button>
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
    </div>
  );
}

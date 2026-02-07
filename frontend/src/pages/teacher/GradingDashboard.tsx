import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Zap, CheckCheck, Clock } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading } from '../../components/common';
import type { GradedSubmission, GradingQueueStats } from '../../types';

export default function GradingDashboard() {
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [submissions, setSubmissions] = useState<GradedSubmission[]>([]);
  const [stats, setStats] = useState<GradingQueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubmission, setActiveSubmission] = useState<GradedSubmission | null>(null);
  const [editFeedback, setEditFeedback] = useState('');
  const [editScore, setEditScore] = useState<number | undefined>();
  const [isGrading, setIsGrading] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isBatchApproving, setIsBatchApproving] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    const result = await apiClient.getGradingQueue();
    if (result.data) {
      setSubmissions(result.data.submissions);
      setStats(result.data.stats);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (teacher) fetchQueue();
  }, [teacher, fetchQueue]);

  const handleAIGrade = async (submissionId: string) => {
    setIsGrading(submissionId);
    const result = await apiClient.aiGradeSubmission(submissionId);
    if (result.data) {
      setSubmissions(prev => prev.map(s => s.id === submissionId ? result.data! : s));
      if (activeSubmission?.id === submissionId) {
        setActiveSubmission(result.data);
        setEditFeedback(result.data.ai_feedback || '');
        setEditScore(result.data.ai_score);
      }
    }
    setIsGrading(null);
  };

  const handleApprove = async () => {
    if (!activeSubmission) return;
    setIsApproving(true);
    const result = await apiClient.approveGrading(activeSubmission.id, {
      edits: editFeedback !== activeSubmission.ai_feedback ? editFeedback : undefined,
      final_score: editScore !== activeSubmission.ai_score ? editScore : undefined,
    });
    if (result.data) {
      setSubmissions(prev => prev.map(s => s.id === activeSubmission.id ? result.data! : s));
      setActiveSubmission(null);
    }
    setIsApproving(false);
  };

  const handleReject = async () => {
    if (!activeSubmission) return;
    const result = await apiClient.rejectGrading(activeSubmission.id);
    if (result.data) {
      setSubmissions(prev => prev.map(s =>
        s.id === activeSubmission.id ? { ...s, status: 'submitted' as const, ai_feedback: undefined, ai_score: undefined } : s
      ));
      setActiveSubmission(null);
    }
  };

  const handleBatchApprove = async () => {
    const gradedIds = submissions.filter(s => s.status === 'ai_graded').map(s => s.id);
    if (gradedIds.length === 0) return;
    setIsBatchApproving(true);
    const result = await apiClient.batchApproveGrading(gradedIds);
    if (result.data) {
      await fetchQueue();
    }
    setIsBatchApproving(false);
  };

  const openSubmission = (submission: GradedSubmission) => {
    setActiveSubmission(submission);
    setEditFeedback(submission.ai_feedback || '');
    setEditScore(submission.ai_score);
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    submitted: 'bg-yellow-100 text-yellow-700',
    ai_graded: 'bg-blue-100 text-blue-700',
    teacher_reviewed: 'bg-green-100 text-green-700',
    returned: 'bg-gray-100 text-gray-700',
  };

  const statusLabels: Record<string, string> = {
    submitted: 'Awaiting Grading',
    ai_graded: 'AI Graded',
    teacher_reviewed: 'Approved',
    returned: 'Returned',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/teacher/dashboard')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">AI Grading</h1>
              <p className="text-sm text-blue-200">Review and approve AI-generated feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <span className="text-white font-medium">{teacher.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <Loading message="Loading grading queue..." />
        ) : (
          <>
            {/* Stats Bar */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                <Card padding="md" className="bg-white text-center">
                  <p className="text-2xl font-bold text-yellow-600">{stats.submitted}</p>
                  <p className="text-sm text-gray-500">Awaiting</p>
                </Card>
                <Card padding="md" className="bg-white text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.ai_graded}</p>
                  <p className="text-sm text-gray-500">AI Graded</p>
                </Card>
                <Card padding="md" className="bg-white text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.teacher_reviewed}</p>
                  <p className="text-sm text-gray-500">Approved</p>
                </Card>
                <Card padding="md" className="bg-white text-center">
                  <p className="text-2xl font-bold text-gray-600">{stats.returned}</p>
                  <p className="text-sm text-gray-500">Returned</p>
                </Card>
              </div>
            )}

            {/* Batch Actions */}
            {submissions.filter(s => s.status === 'ai_graded').length > 0 && (
              <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-blue-700">
                  {submissions.filter(s => s.status === 'ai_graded').length} submissions ready for approval
                </p>
                <Button
                  variant="primary"
                  onClick={handleBatchApprove}
                  isLoading={isBatchApproving}
                  disabled={isBatchApproving}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Batch Approve All
                </Button>
              </div>
            )}

            {/* Submissions List */}
            {submissions.length === 0 ? (
              <Card padding="lg" className="text-center bg-white">
                <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">📝</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No submissions yet</h3>
                <p className="text-gray-600">
                  Student submissions will appear here when they complete assignments.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {submissions.map(submission => (
                  <div
                    key={submission.id}
                    className={`bg-white rounded-xl border p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition-all ${
                      activeSubmission?.id === submission.id ? 'border-blue-500 shadow-md' : 'border-gray-200'
                    }`}
                    onClick={() => openSubmission(submission)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-600">
                        {(submission.student_name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{submission.student_name || 'Student'}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {submission.ai_score !== undefined && submission.ai_score !== null && (
                        <span className="text-lg font-bold text-gray-800">{Math.round(submission.ai_score)}%</span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[submission.status]}`}>
                        {statusLabels[submission.status]}
                      </span>
                      {submission.status === 'submitted' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleAIGrade(submission.id); }}
                          isLoading={isGrading === submission.id}
                          disabled={isGrading !== null}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          AI Grade
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Submission Detail (Split View) */}
            {activeSubmission && activeSubmission.status !== 'submitted' && (
              <div className="mt-8 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">
                      {activeSubmission.student_name || 'Student'}'s Submission
                    </h3>
                    <button onClick={() => setActiveSubmission(null)} className="text-gray-400 hover:text-gray-600">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 divide-x divide-gray-200">
                  {/* Student Work */}
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Student Work</h4>
                    <div className="bg-gray-50 rounded-xl p-4 text-gray-800 whitespace-pre-wrap">
                      {typeof activeSubmission.content === 'string'
                        ? activeSubmission.content
                        : JSON.stringify(activeSubmission.content, null, 2)}
                    </div>
                    {activeSubmission.ai_skill_gaps.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Skill Gaps Identified</h4>
                        <div className="flex flex-wrap gap-2">
                          {activeSubmission.ai_skill_gaps.map((gap, i) => (
                            <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs border border-red-200">
                              {gap}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Feedback */}
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">AI Feedback (Edit Below)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Score</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editScore ?? ''}
                          onChange={e => setEditScore(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-24 px-3 py-2 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Feedback</label>
                        <textarea
                          value={editFeedback}
                          onChange={e => setEditFeedback(e.target.value)}
                          rows={6}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={handleApprove}
                          isLoading={isApproving}
                          disabled={isApproving}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleReject}
                        >
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

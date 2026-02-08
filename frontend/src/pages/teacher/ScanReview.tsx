import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, CheckCheck, Loader2 } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading } from '../../components/common';
import type { BatchReviewResponse, ScanPageResponse, TeacherStudent, ScanBatch } from '../../types';

export default function ScanReview() {
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [review, setReview] = useState<BatchReviewResponse | null>(null);
  const [batchStatus, setBatchStatus] = useState<ScanBatch | null>(null);
  const [roster, setRoster] = useState<TeacherStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  const fetchReview = useCallback(async () => {
    if (!batchId) return;
    setIsLoading(true);
    const result = await apiClient.reviewScanBatch(batchId);
    if (result.data) {
      setReview(result.data);

      // If batch has a class, fetch roster
      if (result.data.mode === 'grade') {
        // Try to get status for class_id
        const statusRes = await apiClient.getScanBatchStatus(batchId);
        if (statusRes.data) {
          setBatchStatus(statusRes.data);
          if (statusRes.data.class_id) {
            const rosterRes = await apiClient.getClassStudents(statusRes.data.class_id);
            if (rosterRes.data) setRoster(rosterRes.data);
          }
        }
      }

      // Check if processing
      if (result.data.status === 'processing') {
        setIsProcessing(true);
      }
    }
    setIsLoading(false);
  }, [batchId]);

  useEffect(() => {
    if (teacher && batchId) fetchReview();
  }, [teacher, batchId, fetchReview]);

  // Poll for status during processing
  useEffect(() => {
    if (!isProcessing || !batchId) return;

    const interval = setInterval(async () => {
      const result = await apiClient.getScanBatchStatus(batchId);
      if (result.data) {
        setBatchStatus(result.data);
        if (result.data.status === 'complete') {
          setIsProcessing(false);
          clearInterval(interval);
        } else if (result.data.status === 'error') {
          setIsProcessing(false);
          clearInterval(interval);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, batchId]);

  const handleConfirm = async () => {
    if (!batchId) return;
    setIsConfirming(true);

    const correctionsList = Object.entries(corrections).map(([pageId, studentId]) => ({
      page_id: pageId,
      student_id: studentId,
    }));

    const result = await apiClient.confirmScanBatch(batchId, {
      corrections: correctionsList,
      confirm_all_auto: true,
    });

    if (result.data) {
      setIsProcessing(true);
      // Refresh review
      await fetchReview();
    }
    setIsConfirming(false);
  };

  const setPageStudent = (pageId: string, studentId: string) => {
    setCorrections(prev => ({ ...prev, [pageId]: studentId }));
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  const getStatusIcon = (page: ScanPageResponse) => {
    if (!page.student_match) return <XCircle className="w-5 h-5 text-red-400" />;
    switch (page.student_match.status) {
      case 'auto_matched': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'needs_confirmation': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unmatched': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBg = (page: ScanPageResponse) => {
    if (!page.student_match) return 'bg-red-50 border-red-200';
    switch (page.student_match.status) {
      case 'auto_matched': return 'bg-green-50 border-green-200';
      case 'needs_confirmation': return 'bg-yellow-50 border-yellow-200';
      case 'unmatched': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  // Processing view
  if (isProcessing && batchStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 shadow-lg sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/teacher/scan')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Processing Batch</h1>
              <p className="text-sm text-indigo-200">
                {batchStatus.mode === 'style' ? 'Analyzing grading style...' : 'Grading submissions...'}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-12">
          <Card padding="lg" className="bg-white text-center">
            <Loader2 className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {batchStatus.mode === 'style' ? 'Analyzing Style' : 'Grading Papers'}
            </h2>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-blue-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${batchStatus.progress_percent}%` }}
              />
            </div>
            <p className="text-gray-600 mb-6">
              {batchStatus.pages_processed} / {batchStatus.total_pages} pages ({batchStatus.progress_percent}%)
            </p>

            {batchStatus.status === 'complete' && (
              <Button
                variant="primary"
                onClick={() => {
                  if (batchStatus.mode === 'style') navigate('/teacher/style');
                  else navigate('/teacher/grading');
                }}
              >
                {batchStatus.mode === 'style' ? 'View Style Profile' : 'Open Grading Queue'}
              </Button>
            )}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/teacher/scan')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Review Scan Batch</h1>
              {review?.assignment && (
                <p className="text-sm text-indigo-200">{review.assignment.title}</p>
              )}
            </div>
          </div>
          {review && (
            <div className="flex items-center gap-2 text-sm text-white">
              <span>{review.summary.total} pages</span>
              <span className="text-white/50">|</span>
              <span className="text-green-300">{review.summary.auto_matched} matched</span>
              <span className="text-white/50">|</span>
              <span className="text-yellow-300">{review.summary.needs_confirmation} review</span>
              <span className="text-white/50">|</span>
              <span className="text-red-300">{review.summary.unmatched} unmatched</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <Loading message="Loading scan batch..." />
        ) : !review ? (
          <Card padding="lg" className="bg-white text-center">
            <p className="text-gray-500">Batch not found or still uploading.</p>
          </Card>
        ) : review.status === 'identifying' || review.status === 'uploaded' ? (
          <Card padding="lg" className="bg-white text-center">
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Identifying Students...</h2>
            <p className="text-gray-600">Claude is reading student names from scanned pages. This may take a moment.</p>
            <Button variant="outline" className="mt-4" onClick={fetchReview}>
              Refresh
            </Button>
          </Card>
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-between mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-indigo-700">
                {review.mode === 'grade'
                  ? 'Review student matches below. Fix any misidentifications, then confirm to start grading.'
                  : 'Confirm to start analyzing your grading style from these papers.'}
              </p>
              <Button
                variant="primary"
                onClick={handleConfirm}
                isLoading={isConfirming}
                disabled={isConfirming}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Confirm & Process
              </Button>
            </div>

            {/* Pages List */}
            <div className="space-y-3">
              {review.pages.map(page => (
                <div
                  key={page.page_id}
                  className={`rounded-xl border p-4 flex items-center gap-4 ${getStatusBg(page)}`}
                >
                  {/* Page number */}
                  <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center font-bold text-gray-600 flex-shrink-0">
                    {page.page_number}
                  </div>

                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(page)}
                  </div>

                  {/* Name detection info */}
                  <div className="flex-1 min-w-0">
                    {page.student_match ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Detected:</span>
                          <span className="font-medium text-gray-800">
                            "{page.student_match.detected_name || 'No name found'}"
                          </span>
                        </div>
                        {page.student_match.matched_student_name && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-gray-500">Matched:</span>
                            <span className="font-semibold text-gray-800">
                              {page.student_match.matched_student_name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
                              {Math.round(page.student_match.confidence * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No name detected</span>
                    )}
                  </div>

                  {/* Student selection dropdown (for corrections) */}
                  {review.mode === 'grade' && roster.length > 0 && (
                    <select
                      value={corrections[page.page_id] || page.student_match?.matched_student_id || ''}
                      onChange={e => setPageStudent(page.page_id, e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Assign student...</option>
                      {roster.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

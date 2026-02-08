import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, ScanLine, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading } from '../../components/common';
import type { ScanBatch, Class, Assignment } from '../../types';

export default function ScanCenter() {
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'style' | 'grade'>('grade');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [batchRes, classRes] = await Promise.all([
      apiClient.getScanBatches(),
      apiClient.getClasses(),
    ]);
    if (batchRes.data) setBatches(batchRes.data);
    if (classRes.data) setClasses(classRes.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (teacher) fetchData();
  }, [teacher, fetchData]);

  // Fetch assignments when class changes
  useEffect(() => {
    if (selectedClassId) {
      apiClient.getAssignments(selectedClassId).then(res => {
        if (res.data) setAssignments(res.data);
      });
    } else {
      setAssignments([]);
    }
  }, [selectedClassId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const result = await apiClient.uploadScanBatch(
      Array.from(files),
      uploadMode,
      selectedClassId || undefined,
      uploadMode === 'grade' ? selectedAssignmentId || undefined : undefined,
    );

    if (result.data) {
      setShowUploadModal(false);
      navigate(`/teacher/scan/review/${result.data.batch_id}`);
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const openUpload = (mode: 'style' | 'grade') => {
    setUploadMode(mode);
    setShowUploadModal(true);
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  const statusIcons: Record<string, React.ReactNode> = {
    uploaded: <Clock className="w-4 h-4 text-yellow-500" />,
    identifying: <ScanLine className="w-4 h-4 text-blue-500 animate-pulse" />,
    identified: <AlertCircle className="w-4 h-4 text-orange-500" />,
    ready: <AlertCircle className="w-4 h-4 text-orange-500" />,
    processing: <ScanLine className="w-4 h-4 text-blue-500 animate-pulse" />,
    complete: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const statusLabels: Record<string, string> = {
    uploaded: 'Uploaded',
    identifying: 'Identifying Students...',
    identified: 'Ready for Review',
    ready: 'Ready for Review',
    processing: 'Processing...',
    complete: 'Complete',
    error: 'Error',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/teacher/dashboard')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Scan Center</h1>
              <p className="text-sm text-indigo-200">Upload scanned papers for style learning or grading</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <span className="text-white font-medium">{teacher.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <Loading message="Loading scan center..." />
        ) : (
          <>
            {/* Two Mode Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Style Scan Card */}
              <Card padding="lg" className="bg-white border-2 border-purple-100 hover:border-purple-300 transition-colors">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">&#x270D;&#xFE0F;</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Style Scan</h3>
                  <p className="text-gray-600 mb-6">
                    Upload papers you've <strong>already graded by hand</strong>.
                    Claude will learn your grading voice from your handwritten annotations.
                  </p>
                  <Button variant="primary" onClick={() => openUpload('style')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Graded Papers
                  </Button>
                </div>
              </Card>

              {/* Grade Scan Card */}
              <Card padding="lg" className="bg-white border-2 border-blue-100 hover:border-blue-300 transition-colors">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">&#x1F4DD;</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Grade Scan</h3>
                  <p className="text-gray-600 mb-6">
                    Upload <strong>ungraded student submissions</strong>.
                    Claude will identify students and grade each paper in your voice.
                  </p>
                  <Button variant="primary" onClick={() => openUpload('grade')}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Student Work
                  </Button>
                </div>
              </Card>
            </div>

            {/* Recent Batches */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Batches</h2>
              {batches.length === 0 ? (
                <Card padding="lg" className="text-center bg-white">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">No scan batches yet. Upload some papers to get started!</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {batches.map(batch => (
                    <div
                      key={batch.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        if (batch.status === 'identified' || batch.status === 'ready') {
                          navigate(`/teacher/scan/review/${batch.id}`);
                        } else if (batch.status === 'processing') {
                          navigate(`/teacher/scan/review/${batch.id}`);
                        } else if (batch.status === 'complete') {
                          if (batch.mode === 'style') navigate('/teacher/style');
                          else navigate('/teacher/grading');
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          batch.mode === 'style' ? 'bg-purple-100' : 'bg-blue-100'
                        }`}>
                          <span className="text-lg">{batch.mode === 'style' ? '\u270D\uFE0F' : '\uD83D\uDCDD'}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">
                              {batch.mode === 'style' ? 'Style Scan' : 'Grade Scan'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {batch.total_pages} pages
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(batch.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {batch.status === 'processing' && (
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${batch.progress_percent}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          {statusIcons[batch.status]}
                          <span className="text-sm text-gray-600">
                            {statusLabels[batch.status] || batch.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-800">
              {uploadMode === 'style' ? 'Upload Graded Papers' : 'Upload Student Submissions'}
            </h3>

            {uploadMode === 'grade' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select a class...</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assignment</label>
                  <select
                    value={selectedAssignmentId}
                    onChange={e => setSelectedAssignmentId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                    disabled={!selectedClassId}
                  >
                    <option value="">Select an assignment...</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {uploadMode === 'style' && classes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Any class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="block">
              <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                {isUploading ? (
                  <Loading message="Uploading and processing..." />
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-700">
                      Drop files here or click to upload
                    </p>
                    <p className="text-sm text-gray-500 mt-1">PDF, JPEG, PNG - multiple files supported</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

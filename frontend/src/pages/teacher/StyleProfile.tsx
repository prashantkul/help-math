import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Send, ArrowLeft, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading } from '../../components/common';
import type { StyleProfileResponse, StyleSample, UpdateStyleProfile } from '../../types';

export default function StyleProfile() {
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [profile, setProfile] = useState<StyleProfileResponse | null>(null);
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState<UpdateStyleProfile>({});
  const [expandedSample, setExpandedSample] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [profileResult, samplesResult] = await Promise.all([
      apiClient.getStyleProfile(),
      apiClient.getStyleSamples(),
    ]);
    if (profileResult.data) setProfile(profileResult.data);
    if (samplesResult.data) setSamples(samplesResult.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (teacher) fetchData();
  }, [teacher, fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    for (const file of Array.from(files)) {
      const result = await apiClient.uploadStyleSample(file);
      if (result.data) {
        setSamples(prev => [result.data!, ...prev]);
      }
    }
    // Refresh profile after upload
    const profileResult = await apiClient.getStyleProfile();
    if (profileResult.data) setProfile(profileResult.data);
    setIsUploading(false);
    e.target.value = '';
  };

  const handleDeleteSample = async (sampleId: string) => {
    const result = await apiClient.deleteStyleSample(sampleId);
    if (!result.error) {
      setSamples(prev => prev.filter(s => s.id !== sampleId));
    }
  };

  const handleTestStyle = async () => {
    if (!testInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    const result = await apiClient.testStyle(testInput, 'Student');
    if (result.data) {
      setTestResult(result.data.feedback);
    }
    setIsTesting(false);
  };

  const handleSaveProfile = async () => {
    const result = await apiClient.updateStyleProfile(editProfile);
    if (result.data) {
      setProfile(result.data);
      setEditMode(false);
      setEditProfile({});
    }
  };

  const startEditing = () => {
    if (profile) {
      setEditProfile({
        tone: profile.profile.tone,
        praise_phrases: [...profile.profile.praise_phrases],
        correction_phrases: [...profile.profile.correction_phrases],
        correction_style: profile.profile.correction_style,
        feedback_length: profile.profile.feedback_length,
      });
      setEditMode(true);
    }
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  const confidencePercent = profile ? Math.round(profile.confidence * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/teacher/dashboard')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">My Teaching Style</h1>
              <p className="text-sm text-purple-200">AI learns your grading voice</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <span className="text-white font-medium">{teacher.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <Loading message="Loading style profile..." />
        ) : (
          <>
            {/* Confidence Meter */}
            <Card padding="lg" className="bg-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Style Confidence</h2>
                <span className="text-sm text-gray-500">{profile?.sample_count || 0} samples analyzed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-violet-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Low confidence</span>
                <span className="font-semibold text-purple-600">{confidencePercent}%</span>
                <span>High confidence</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Upload 10-15 graded papers for best results. Each sample improves accuracy.
              </p>
            </Card>

            {/* Upload Zone */}
            <Card padding="lg" className="bg-white">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Graded Papers</h2>
              <p className="text-gray-600 mb-4">
                Upload photos of your hand-graded student papers. Claude will analyze your handwritten
                annotations, comments, and grading style.
              </p>
              <label className="block">
                <div className="border-2 border-dashed border-purple-300 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
                  {isUploading ? (
                    <Loading message="Analyzing your grading style..." />
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-gray-700">
                        Drop graded papers here or click to upload
                      </p>
                      <p className="text-sm text-gray-500 mt-1">JPEG, PNG, WebP, or PDF</p>
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
            </Card>

            {/* Style Profile Display/Edit */}
            {profile && profile.profile.sample_count > 0 && (
              <Card padding="lg" className="bg-white">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Your Teaching Voice</h2>
                  {!editMode && (
                    <Button variant="outline" onClick={startEditing}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <input
                        type="text"
                        value={editProfile.tone || ''}
                        onChange={e => setEditProfile({ ...editProfile, tone: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correction Style</label>
                      <input
                        type="text"
                        value={editProfile.correction_style || ''}
                        onChange={e => setEditProfile({ ...editProfile, correction_style: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Length</label>
                      <select
                        value={editProfile.feedback_length || ''}
                        onChange={e => setEditProfile({ ...editProfile, feedback_length: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none"
                      >
                        <option value="brief">Brief (1 sentence)</option>
                        <option value="moderate">Moderate (2-3 sentences)</option>
                        <option value="detailed">Detailed (4+ sentences)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Praise Phrases (one per line)
                      </label>
                      <textarea
                        value={(editProfile.praise_phrases || []).join('\n')}
                        onChange={e => setEditProfile({ ...editProfile, praise_phrases: e.target.value.split('\n').filter(Boolean) })}
                        rows={4}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correction Phrases (one per line)
                      </label>
                      <textarea
                        value={(editProfile.correction_phrases || []).join('\n')}
                        onChange={e => setEditProfile({ ...editProfile, correction_phrases: e.target.value.split('\n').filter(Boolean) })}
                        rows={4}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                      <Button variant="primary" className="flex-1" onClick={handleSaveProfile}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tone */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Tone</h3>
                      <p className="text-gray-800">{profile.profile.tone || 'Not yet detected'}</p>
                    </div>

                    {/* Praise Phrases */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Praise Phrases</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.profile.praise_phrases.length > 0 ? (
                          profile.profile.praise_phrases.map((phrase, i) => (
                            <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                              "{phrase}"
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic">Upload samples to detect</span>
                        )}
                      </div>
                    </div>

                    {/* Correction Phrases */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Correction Phrases</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.profile.correction_phrases.length > 0 ? (
                          profile.profile.correction_phrases.map((phrase, i) => (
                            <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm border border-amber-200">
                              "{phrase}"
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 italic">Upload samples to detect</span>
                        )}
                      </div>
                    </div>

                    {/* Correction Style */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Correction Style</h3>
                      <p className="text-gray-800">{profile.profile.correction_style || 'Not yet detected'}</p>
                    </div>

                    {/* Strictness */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Strictness</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-gray-500">Spelling</p>
                          <p className="font-semibold text-gray-800 capitalize">{profile.profile.strictness.spelling || 'N/A'}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-gray-500">Work Shown</p>
                          <p className="font-semibold text-gray-800 capitalize">{profile.profile.strictness.math_work_shown || 'N/A'}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-gray-500">Neatness</p>
                          <p className="font-semibold text-gray-800 capitalize">{profile.profile.strictness.neatness || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Visual Markers */}
                    {profile.profile.visual_markers.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Visual Markers</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.profile.visual_markers.map((marker, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm border border-purple-200">
                              {marker}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Test My Style */}
            <Card padding="lg" className="bg-white">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Test My Style</h2>
              <p className="text-gray-600 mb-4">
                Paste some sample student work below and see how the AI would give feedback
                in your voice.
              </p>
              <textarea
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                rows={4}
                placeholder="Paste sample student work here... e.g., '12 - 5 = 8. I subtracted 5 from 12.'"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none mb-4"
              />
              <Button
                variant="primary"
                onClick={handleTestStyle}
                disabled={!testInput.trim() || isTesting}
                isLoading={isTesting}
              >
                <Send className="w-4 h-4 mr-2" />
                Generate Feedback
              </Button>
              {testResult && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                  <h3 className="text-sm font-semibold text-purple-600 mb-2">AI Feedback (in your voice):</h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{testResult}</p>
                </div>
              )}
            </Card>

            {/* Uploaded Samples */}
            {samples.length > 0 && (
              <Card padding="lg" className="bg-white">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Uploaded Samples ({samples.length})
                </h2>
                <div className="space-y-3">
                  {samples.map(sample => (
                    <div key={sample.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedSample(expandedSample === sample.id ? null : sample.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${sample.processed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <span className="font-medium text-gray-800">{sample.file_path.split('/').pop()}</span>
                          <span className="text-xs text-gray-400">{sample.file_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sample.processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {sample.processed ? 'Analyzed' : 'Processing'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSample(sample.id); }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedSample === sample.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {expandedSample === sample.id && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                          <div className="grid md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Extracted Annotations</h4>
                              <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-auto max-h-40">
                                {JSON.stringify(sample.extracted_annotations, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Feedback Patterns</h4>
                              <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-auto max-h-40">
                                {JSON.stringify(sample.feedback_patterns, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

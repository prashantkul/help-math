import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Send, ArrowLeft, ChevronDown, ChevronUp, Pencil, Sparkles, RefreshCw, Shield, FlaskConical, Plus, X, AlertTriangle } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading } from '../../components/common';
import type {
  StyleProfileResponse,
  StyleSample,
  UpdateStyleProfile,
  UpdateStyleOverrides,
  StyleOverrides,
  GenerateTestResponse,
  TestRating,
  TestResultsResponse,
  SynthesisResponse,
} from '../../types';

type Tab = 'overview' | 'overrides' | 'test' | 'samples';

export default function StyleProfile() {
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  // Core state
  const [profile, setProfile] = useState<StyleProfileResponse | null>(null);
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Upload
  const [isUploading, setIsUploading] = useState(false);

  // Simple profile edit
  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState<UpdateStyleProfile>({});

  // Overrides
  const [overrides, setOverrides] = useState<StyleOverrides>({ always_say: [], never_say: [], grading_priorities: [] });
  const [newAlwaysSay, setNewAlwaysSay] = useState('');
  const [newNeverSay, setNewNeverSay] = useState('');
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);

  // Quick test
  const [isTesting, setIsTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Blind test
  const [blindTest, setBlindTest] = useState<GenerateTestResponse | null>(null);
  const [blindTestRatings, setBlindTestRatings] = useState<Map<number, TestRating>>(new Map());
  const [blindTestResults, setBlindTestResults] = useState<TestResultsResponse | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  // Synthesis
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResponse | null>(null);

  // Extraction
  const [isExtracting, setIsExtracting] = useState(false);

  // Samples
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
    if (profileResult.data) {
      setProfile(profileResult.data);
      setOverrides(profileResult.data.overrides);
    }
    if (samplesResult.data) setSamples(samplesResult.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (teacher) fetchData();
  }, [teacher, fetchData]);

  // Upload handler
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
    const profileResult = await apiClient.getStyleProfile();
    if (profileResult.data) {
      setProfile(profileResult.data);
      setOverrides(profileResult.data.overrides);
    }
    setIsUploading(false);
    e.target.value = '';
  };

  // Delete sample
  const handleDeleteSample = async (sampleId: string) => {
    const result = await apiClient.deleteStyleSample(sampleId);
    if (!result.error) {
      setSamples(prev => prev.filter(s => s.id !== sampleId));
    }
  };

  // Extract pending samples (Tier 1)
  const handleExtract = async () => {
    setIsExtracting(true);
    const result = await apiClient.extractStyleSamples();
    if (result.data) {
      await fetchData();
    }
    setIsExtracting(false);
  };

  // Synthesize style model (Tier 2)
  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setSynthesisResult(null);
    const result = await apiClient.synthesizeStyle();
    if (result.data) {
      setSynthesisResult(result.data);
      await fetchData();
    }
    setIsSynthesizing(false);
  };

  // Save overrides
  const handleSaveOverrides = async () => {
    setIsSavingOverrides(true);
    const result = await apiClient.updateStyleOverrides({
      always_say: overrides.always_say,
      never_say: overrides.never_say,
      feedback_length: overrides.feedback_length,
      grading_priorities: overrides.grading_priorities,
    } as UpdateStyleOverrides);
    if (result.data) {
      setOverrides(result.data);
    }
    setIsSavingOverrides(false);
  };

  // Quick test
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

  // Blind test - generate
  const handleGenerateBlindTest = async () => {
    setIsGeneratingTest(true);
    setBlindTest(null);
    setBlindTestResults(null);
    setBlindTestRatings(new Map());
    const result = await apiClient.generateStyleTest();
    if (result.data) {
      setBlindTest(result.data);
    }
    setIsGeneratingTest(false);
  };

  // Blind test - rate item
  const handleRateItem = (itemId: number, soundsLikeMe: boolean, whatIdChange?: string) => {
    setBlindTestRatings(prev => {
      const next = new Map(prev);
      next.set(itemId, { item_id: itemId, sounds_like_me: soundsLikeMe, what_id_change: whatIdChange });
      return next;
    });
  };

  // Blind test - submit
  const handleSubmitBlindTest = async () => {
    if (!blindTest) return;
    setIsSubmittingTest(true);
    const ratings = Array.from(blindTestRatings.values());
    const result = await apiClient.submitStyleTest(blindTest.test_id, ratings);
    if (result.data) {
      setBlindTestResults(result.data);
      await fetchData();
    }
    setIsSubmittingTest(false);
  };

  // Simple profile edit
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
  const confidenceColor = confidencePercent >= 70 ? 'from-green-500 to-emerald-500' :
    confidencePercent >= 40 ? 'from-yellow-500 to-amber-500' : 'from-red-500 to-orange-500';
  const confidenceLabel = confidencePercent >= 70 ? 'Strong' :
    confidencePercent >= 40 ? 'Building' : 'Learning';

  const pendingSamples = samples.filter(s => s.extraction_status === 'pending' || !s.extraction_status).length;

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
              <h1 className="text-xl font-bold text-white">Style Center</h1>
              <p className="text-sm text-purple-200">4-tier deep style learning</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <span className="text-white font-medium">{teacher.name}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            ['overview', 'Overview'],
            ['overrides', 'Overrides'],
            ['test', 'Test My Style'],
            ['samples', 'Samples'],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <Loading message="Loading style profile..." />
        ) : (
          <>
            {/* ==================== OVERVIEW TAB ==================== */}
            {activeTab === 'overview' && (
              <>
                {/* Confidence Meter */}
                <Card padding="lg" className="bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Style Confidence</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {profile?.annotation_count || 0} annotations from {profile?.sample_count || 0} samples
                      </p>
                    </div>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      confidencePercent >= 70 ? 'bg-green-100 text-green-700' :
                      confidencePercent >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {confidenceLabel}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <div
                      className={`bg-gradient-to-r ${confidenceColor} h-4 rounded-full transition-all duration-500`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>0%</span>
                    <span className="font-semibold text-purple-600">{confidencePercent}%</span>
                    <span>100%</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-4">
                    {pendingSamples > 0 && (
                      <Button variant="outline" onClick={handleExtract} disabled={isExtracting} isLoading={isExtracting}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Extract ({pendingSamples} pending)
                      </Button>
                    )}
                    {(profile?.annotation_count || 0) >= 5 && (
                      <Button variant="outline" onClick={handleSynthesize} disabled={isSynthesizing} isLoading={isSynthesizing}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {profile?.has_deep_model ? 'Re-synthesize' : 'Synthesize Model'}
                      </Button>
                    )}
                  </div>

                  {synthesisResult && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-sm text-green-800 font-medium">
                        Synthesis complete! Analyzed {synthesisResult.annotations_analyzed} annotations
                        across {synthesisResult.samples_analyzed} samples.
                        Confidence: {Math.round(synthesisResult.confidence * 100)}%.
                        {synthesisResult.conditional_responses_count} conditional patterns found.
                      </p>
                      {synthesisResult.gaps.length > 0 && (
                        <p className="text-sm text-amber-700 mt-1">
                          Gaps: {synthesisResult.gaps.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {profile?.correction_count != null && profile.correction_count > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        {profile.recent_corrections_summary}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Upload Zone */}
                <Card padding="lg" className="bg-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Graded Papers</h2>
                  <p className="text-gray-600 mb-4">
                    Upload photos of your hand-graded student papers. Claude will extract every annotation with full context.
                  </p>
                  <label className="block">
                    <div className="border-2 border-dashed border-purple-300 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
                      {isUploading ? (
                        <Loading message="Uploading and analyzing..." />
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

                {/* Deep Model Card */}
                {profile?.has_deep_model && profile.deep_model && (
                  <Card padding="lg" className="bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-800">Your Teaching Voice</h2>
                      {profile.deep_model.last_synthesized && (
                        <span className="text-xs text-gray-400">
                          Last updated: {new Date(profile.deep_model.last_synthesized).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                      &ldquo;{profile.deep_model.voice_description}&rdquo;
                    </p>

                    {/* Conditional Responses */}
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Conditional Patterns ({profile.deep_model.conditional_responses.length})
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3 mb-6">
                      {profile.deep_model.conditional_responses.map((cr, i) => (
                        <div key={i} className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-purple-600 uppercase">{cr.condition}</span>
                            <span className="text-xs text-gray-400">{cr.evidence_count} examples</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{cr.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {cr.example_phrases.slice(0, 3).map((phrase, j) => (
                              <span key={j} className="text-xs px-2 py-0.5 bg-white rounded-full text-purple-700 border border-purple-200">
                                &ldquo;{phrase}&rdquo;
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Gaps */}
                    {profile.deep_model.gaps.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <h3 className="text-sm font-semibold text-amber-700 mb-2">
                          Gaps (upload more examples for these scenarios)
                        </h3>
                        <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                          {profile.deep_model.gaps.map((gap, i) => (
                            <li key={i}>{gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                )}

                {/* Simple Profile (backward compat, shown if no deep model) */}
                {!profile?.has_deep_model && profile && profile.profile.sample_count > 0 && (
                  <Card padding="lg" className="bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-gray-800">Basic Style Profile</h2>
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
                          <input type="text" value={editProfile.tone || ''} onChange={e => setEditProfile({ ...editProfile, tone: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Correction Style</label>
                          <input type="text" value={editProfile.correction_style || ''} onChange={e => setEditProfile({ ...editProfile, correction_style: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Praise Phrases (one per line)</label>
                          <textarea value={(editProfile.praise_phrases || []).join('\n')} onChange={e => setEditProfile({ ...editProfile, praise_phrases: e.target.value.split('\n').filter(Boolean) })} rows={3} className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Correction Phrases (one per line)</label>
                          <textarea value={(editProfile.correction_phrases || []).join('\n')} onChange={e => setEditProfile({ ...editProfile, correction_phrases: e.target.value.split('\n').filter(Boolean) })} rows={3} className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>Cancel</Button>
                          <Button variant="primary" className="flex-1" onClick={handleSaveProfile}>Save Changes</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Tone</h3>
                          <p className="text-gray-800">{profile.profile.tone || 'Not yet detected'}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Praise Phrases</h3>
                          <div className="flex flex-wrap gap-2">
                            {profile.profile.praise_phrases.length > 0 ? profile.profile.praise_phrases.map((phrase, i) => (
                              <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">&ldquo;{phrase}&rdquo;</span>
                            )) : <span className="text-gray-400 italic">Upload samples to detect</span>}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Correction Phrases</h3>
                          <div className="flex flex-wrap gap-2">
                            {profile.profile.correction_phrases.length > 0 ? profile.profile.correction_phrases.map((phrase, i) => (
                              <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm border border-amber-200">&ldquo;{phrase}&rdquo;</span>
                            )) : <span className="text-gray-400 italic">Upload samples to detect</span>}
                          </div>
                        </div>
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
                    )}
                  </Card>
                )}
              </>
            )}

            {/* ==================== OVERRIDES TAB ==================== */}
            {activeTab === 'overrides' && (
              <Card padding="lg" className="bg-white">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h2 className="text-xl font-bold text-gray-800">Style Overrides</h2>
                </div>
                <p className="text-gray-600 mb-6">
                  Hard rules that override the AI model. These apply to ALL feedback generation.
                </p>

                {/* Always Say */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">Always Include</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {overrides.always_say.map((phrase, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                        &ldquo;{phrase}&rdquo;
                        <button onClick={() => setOverrides(prev => ({ ...prev, always_say: prev.always_say.filter((_, j) => j !== i) }))} className="text-green-400 hover:text-green-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAlwaysSay}
                      onChange={e => setNewAlwaysSay(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newAlwaysSay.trim()) {
                          setOverrides(prev => ({ ...prev, always_say: [...prev.always_say, newAlwaysSay.trim()] }));
                          setNewAlwaysSay('');
                        }
                      }}
                      placeholder="e.g., 'Great effort!' or 'Show your work'"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:border-green-500 focus:outline-none text-sm"
                    />
                    <Button variant="outline" onClick={() => {
                      if (newAlwaysSay.trim()) {
                        setOverrides(prev => ({ ...prev, always_say: [...prev.always_say, newAlwaysSay.trim()] }));
                        setNewAlwaysSay('');
                      }
                    }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Never Say */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-red-700 mb-2">Never Use</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {overrides.never_say.map((phrase, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm border border-red-200">
                        &ldquo;{phrase}&rdquo;
                        <button onClick={() => setOverrides(prev => ({ ...prev, never_say: prev.never_say.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNeverSay}
                      onChange={e => setNewNeverSay(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newNeverSay.trim()) {
                          setOverrides(prev => ({ ...prev, never_say: [...prev.never_say, newNeverSay.trim()] }));
                          setNewNeverSay('');
                        }
                      }}
                      placeholder="e.g., 'Wrong!' or 'You failed'"
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-300 focus:border-red-500 focus:outline-none text-sm"
                    />
                    <Button variant="outline" onClick={() => {
                      if (newNeverSay.trim()) {
                        setOverrides(prev => ({ ...prev, never_say: [...prev.never_say, newNeverSay.trim()] }));
                        setNewNeverSay('');
                      }
                    }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Feedback Length */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Feedback Length</h3>
                  <select
                    value={overrides.feedback_length || ''}
                    onChange={e => setOverrides(prev => ({ ...prev, feedback_length: e.target.value || undefined }))}
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none text-sm"
                  >
                    <option value="">Auto (from style model)</option>
                    <option value="brief">Brief (1 sentence)</option>
                    <option value="moderate">Moderate (2-3 sentences)</option>
                    <option value="detailed">Detailed (4+ sentences)</option>
                  </select>
                </div>

                <Button variant="primary" onClick={handleSaveOverrides} disabled={isSavingOverrides} isLoading={isSavingOverrides}>
                  Save Overrides
                </Button>
              </Card>
            )}

            {/* ==================== TEST TAB ==================== */}
            {activeTab === 'test' && (
              <>
                {/* Quick Test */}
                <Card padding="lg" className="bg-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Test</h2>
                  <p className="text-gray-600 mb-4">
                    Paste sample student work and see how the AI would give feedback in your voice.
                  </p>
                  <textarea
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    rows={3}
                    placeholder="e.g., '12 - 5 = 8. I subtracted 5 from 12.'"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:outline-none mb-4"
                  />
                  <Button variant="primary" onClick={handleTestStyle} disabled={!testInput.trim() || isTesting} isLoading={isTesting}>
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

                {/* Blind Test */}
                <Card padding="lg" className="bg-white">
                  <div className="flex items-center gap-2 mb-4">
                    <FlaskConical className="w-5 h-5 text-purple-600" />
                    <h2 className="text-xl font-bold text-gray-800">Blind Style Test</h2>
                  </div>
                  <p className="text-gray-600 mb-4">
                    We&apos;ll show you feedback items — some AI-generated, some from your real annotations.
                    Rate each one: does it sound like you? This validates and improves the model.
                  </p>

                  {!blindTest && !blindTestResults && (
                    <Button
                      variant="primary"
                      onClick={handleGenerateBlindTest}
                      disabled={isGeneratingTest || !profile?.has_deep_model}
                      isLoading={isGeneratingTest}
                    >
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Generate Blind Test
                    </Button>
                  )}

                  {!profile?.has_deep_model && !blindTest && (
                    <p className="text-sm text-gray-400 mt-2">
                      You need a synthesized style model to run a blind test. Upload samples and synthesize first.
                    </p>
                  )}

                  {/* Test Items */}
                  {blindTest && !blindTestResults && (
                    <div className="space-y-4">
                      {blindTest.items.map((item, idx) => {
                        const rating = blindTestRatings.get(item.item_id);
                        return (
                          <div key={item.item_id} className="p-4 border border-gray-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-gray-400">Item {idx + 1}</span>
                              <span className="text-xs text-gray-400">|</span>
                              <span className="text-xs text-gray-500">Student work: &ldquo;{item.student_work}&rdquo;</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg mb-3">
                              <p className="text-gray-800">{item.feedback}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleRateItem(item.item_id, true)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  rating?.sounds_like_me === true
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                                }`}
                              >
                                Sounds like me
                              </button>
                              <button
                                onClick={() => handleRateItem(item.item_id, false)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  rating?.sounds_like_me === false
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700'
                                }`}
                              >
                                Not my style
                              </button>
                              {rating?.sounds_like_me === false && (
                                <input
                                  type="text"
                                  placeholder="What would you change?"
                                  value={rating?.what_id_change || ''}
                                  onChange={e => handleRateItem(item.item_id, false, e.target.value)}
                                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-purple-500 focus:outline-none"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <Button
                        variant="primary"
                        onClick={handleSubmitBlindTest}
                        disabled={blindTestRatings.size < blindTest.items.length || isSubmittingTest}
                        isLoading={isSubmittingTest}
                      >
                        Submit Ratings ({blindTestRatings.size}/{blindTest.items.length})
                      </Button>
                    </div>
                  )}

                  {/* Test Results */}
                  {blindTestResults && (
                    <div className="space-y-4">
                      <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200">
                        <h3 className="text-lg font-bold text-purple-800 mb-3">Results</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">{Math.round(blindTestResults.results.pass_rate * 100)}%</p>
                            <p className="text-xs text-gray-500">Overall Match</p>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{blindTestResults.results.ai_items_approved}/{blindTestResults.results.ai_items_total}</p>
                            <p className="text-xs text-gray-500">AI Approved</p>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{blindTestResults.results.real_items_approved}/{blindTestResults.results.real_items_total}</p>
                            <p className="text-xs text-gray-500">Real Approved</p>
                          </div>
                          <div className="text-center p-3 bg-white rounded-lg">
                            <p className="text-sm font-medium text-gray-700">{blindTestResults.results.confidence_update}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700">{blindTestResults.results.insights}</p>
                      </div>

                      <Button variant="outline" onClick={() => { setBlindTest(null); setBlindTestResults(null); setBlindTestRatings(new Map()); }}>
                        Run Another Test
                      </Button>
                    </div>
                  )}
                </Card>
              </>
            )}

            {/* ==================== SAMPLES TAB ==================== */}
            {activeTab === 'samples' && (
              <>
                {/* Upload */}
                <Card padding="lg" className="bg-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Graded Papers</h2>
                  <label className="block">
                    <div className="border-2 border-dashed border-purple-300 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
                      {isUploading ? (
                        <Loading message="Uploading..." />
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                          <p className="font-semibold text-gray-700">Drop files or click to upload</p>
                          <p className="text-sm text-gray-500 mt-1">JPEG, PNG, WebP, or PDF</p>
                        </>
                      )}
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleUpload} className="hidden" disabled={isUploading} />
                  </label>
                </Card>

                {/* Sample List */}
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
                              <div className={`w-3 h-3 rounded-full ${
                                sample.extraction_status === 'completed' ? 'bg-green-500' :
                                sample.extraction_status === 'failed' ? 'bg-red-500' :
                                sample.extraction_status === 'extracting' ? 'bg-blue-500 animate-pulse' :
                                'bg-yellow-500'
                              }`} />
                              <span className="font-medium text-gray-800">{sample.file_path.split('/').pop()}</span>
                              <span className="text-xs text-gray-400">{sample.file_type}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                sample.extraction_status === 'completed' ? 'bg-green-100 text-green-700' :
                                sample.extraction_status === 'failed' ? 'bg-red-100 text-red-700' :
                                sample.extraction_status === 'extracting' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {sample.extraction_status || 'pending'}
                              </span>
                              {sample.annotation_count > 0 && (
                                <span className="text-xs text-purple-600 font-medium">
                                  {sample.annotation_count} annotations
                                </span>
                              )}
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
          </>
        )}
      </main>
    </div>
  );
}

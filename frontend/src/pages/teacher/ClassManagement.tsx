import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, UserX, Copy, Check, Settings, Plus, RefreshCw, Key, Users, X, Mail, Upload, Download, Edit2 } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal } from '../../components/common';
import type { TeacherStudent, Class, CoTeacher } from '../../types';

export default function ClassManagement() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [settings, setSettings] = useState<{
    ell_level: 1 | 2 | 3;
    show_emojis: boolean;
  }>({
    ell_level: 2,
    show_emojis: true,
  });
  const [studentToRemove, setStudentToRemove] = useState<TeacherStudent | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentExternalId, setNewStudentExternalId] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Co-teacher state
  const [coTeachers, setCoTeachers] = useState<CoTeacher[]>([]);
  const [newCoTeacherEmail, setNewCoTeacherEmail] = useState('');
  const [isAddingCoTeacher, setIsAddingCoTeacher] = useState(false);
  const [coTeacherError, setCoTeacherError] = useState('');

  // Bulk import state
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPrefix, setBulkPrefix] = useState('Student');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState<TeacherStudent[] | null>(null);

  // Roster mapping state
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudent | null>(null);
  const [rosterIdInput, setRosterIdInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSavingRoster, setIsSavingRoster] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  useEffect(() => {
    if (classId && teacher) {
      const fetchData = async () => {
        setIsLoading(true);

        const [classesResult, studentsResult, coTeachersResult] = await Promise.all([
          apiClient.getClasses(),
          apiClient.getClassStudents(classId),
          apiClient.getCoTeachers(classId),
        ]);

        if (classesResult.data) {
          const cls = classesResult.data.find((c) => c.id === classId);
          if (cls) {
            setClassData(cls);
            setSettings({
              ell_level: cls.settings.ell_level,
              show_emojis: cls.settings.show_emojis,
            });
          }
        }

        if (studentsResult.data) {
          setStudents(studentsResult.data);
        }

        if (coTeachersResult.data) {
          setCoTeachers(coTeachersResult.data);
        }

        setIsLoading(false);
      };
      fetchData();
    }
  }, [classId, teacher]);

  const handleCopyCode = () => {
    if (classData) {
      navigator.clipboard.writeText(classData.join_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyPasscode = (passcode: string) => {
    navigator.clipboard.writeText(passcode);
    setCopiedPasscode(passcode);
    setTimeout(() => setCopiedPasscode(null), 2000);
  };

  const handleAddStudent = async () => {
    if (!classId || !newStudentName.trim()) return;

    setIsAddingStudent(true);
    const result = await apiClient.createStudent(
      classId,
      newStudentName.trim(),
      newStudentExternalId.trim() || undefined
    );

    if (result.data) {
      setStudents([...students, result.data]);
      setNewStudentName('');
      setNewStudentExternalId('');
      setShowAddStudentModal(false);
    }
    setIsAddingStudent(false);
  };

  const handleResetPasscode = async (studentId: string) => {
    if (!classId) return;

    const result = await apiClient.resetStudentPasscode(classId, studentId);
    if (result.data) {
      setStudents(students.map((s) => (s.id === studentId ? result.data! : s)));
    }
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove || !classId) return;

    await apiClient.removeStudent(classId, studentToRemove.id);
    setStudents(students.filter((s) => s.id !== studentToRemove.id));
    setStudentToRemove(null);
  };

  const handleSaveSettings = async () => {
    if (!classId) return;

    await apiClient.updateClassSettings(classId, settings);
    setShowSettingsModal(false);
  };

  const handleAddCoTeacher = async () => {
    if (!classId || !newCoTeacherEmail.trim()) return;

    setIsAddingCoTeacher(true);
    setCoTeacherError('');

    const result = await apiClient.addCoTeacher(classId, newCoTeacherEmail.trim());

    if (result.data) {
      setCoTeachers([...coTeachers, result.data]);
      setNewCoTeacherEmail('');
    } else {
      setCoTeacherError(result.error || 'Failed to add co-teacher');
    }

    setIsAddingCoTeacher(false);
  };

  const handleRemoveCoTeacher = async (coteacherId: string) => {
    if (!classId) return;

    await apiClient.removeCoTeacher(classId, coteacherId);
    setCoTeachers(coTeachers.filter((ct) => ct.id !== coteacherId));
  };

  const handleBulkCreate = async () => {
    if (!classId || bulkCount < 1) return;

    setIsBulkCreating(true);
    const studentsToCreate = Array.from({ length: bulkCount }, (_, i) => ({
      name: `${bulkPrefix} ${i + 1}`,
    }));

    const result = await apiClient.bulkCreateStudents(classId, studentsToCreate);
    setIsBulkCreating(false);

    if (result.data) {
      setBulkResult(result.data);
      setStudents([...students, ...result.data]);
    }
  };

  const handleExportCredentials = async (format: 'csv' | 'json') => {
    if (!classId) return;

    setIsExporting(true);
    const result = await apiClient.exportStudents(classId, format);
    setIsExporting(false);

    if (result.data) {
      let blob: Blob;
      if (format === 'csv') {
        // For CSV, the API returns a Blob directly
        blob = result.data as unknown as Blob;
      } else {
        // For JSON, we need to stringify the array
        blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-${classData?.name || 'class'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenRosterModal = (student: TeacherStudent) => {
    setSelectedStudent(student);
    setRosterIdInput(student.roster_id || '');
    setNotesInput(student.notes || '');
    setShowRosterModal(true);
  };

  const handleSaveRoster = async () => {
    if (!classId || !selectedStudent) return;

    setIsSavingRoster(true);
    const result = await apiClient.updateStudentRoster(classId, selectedStudent.id, {
      roster_id: rosterIdInput.trim() || undefined,
      notes: notesInput.trim() || undefined,
    });
    setIsSavingRoster(false);

    if (result.data) {
      setStudents(students.map((s) => (s.id === selectedStudent.id ? result.data! : s)));
      setShowRosterModal(false);
      setSelectedStudent(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading class..." />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card padding="lg" className="text-center">
          <p className="text-gray-600 mb-4">Class not found</p>
          <Link to="/teacher/dashboard">
            <Button variant="primary">Back to Dashboard</Button>
          </Link>
        </Card>
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
                  Back
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">{classData.name}</h1>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors"
                >
                  <span>Join code: </span>
                  <span className="font-mono bg-white/20 px-2 py-0.5 rounded">
                    {classData.join_code}
                  </span>
                  {copiedCode ? (
                    <Check className="w-4 h-4 text-cyan-200" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-800">
            Students ({students.length})
          </h2>
          <div className="flex gap-2">
            {students.length > 0 && (
              <div className="relative group">
                <Button
                  variant="outline"
                  onClick={() => handleExportCredentials('csv')}
                  disabled={isExporting}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => setShowBulkImportModal(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Add
            </Button>
            <Button variant="primary" onClick={() => setShowAddStudentModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        </div>

        {students.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="text-5xl block mb-4">👋</span>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No students yet</h3>
            <p className="text-gray-600 mb-4">
              Add students to get started. Each student will receive a unique passcode.
            </p>
            <Button variant="primary" onClick={() => setShowAddStudentModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Student
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <Card key={student.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-2xl">
                      {student.avatar === 'bear' ? '🐻' :
                       student.avatar === 'bunny' ? '🐰' :
                       student.avatar === 'cat' ? '🐱' :
                       student.avatar === 'dog' ? '🐶' :
                       student.avatar === 'fox' ? '🦊' :
                       student.avatar === 'panda' ? '🐼' :
                       student.avatar === 'penguin' ? '🐧' :
                       student.avatar === 'owl' ? '🦉' :
                       student.avatar === 'unicorn' ? '🦄' :
                       student.avatar === 'star' ? '⭐' : '🐻'}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">{student.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {student.external_id && (
                          <span>ID: {student.external_id}</span>
                        )}
                        <span>{student.total_points} points</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Passcode */}
                    <button
                      onClick={() => handleCopyPasscode(student.passcode)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-mono text-sm"
                    >
                      <Key className="w-3 h-3" />
                      {student.passcode}
                      {copiedPasscode === student.passcode ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {/* Reset Passcode */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPasscode(student.id)}
                      title="Reset passcode"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    {/* Edit Roster */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenRosterModal(student)}
                      title="Edit roster info"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {/* View Progress */}
                    <Link to={`/teacher/analytics/${classId}?student=${student.id}`}>
                      <Button variant="ghost" size="sm">
                        View Progress
                      </Button>
                    </Link>
                    {/* Remove */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStudentToRemove(student)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        title="Add Student"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student Name *
            </label>
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student ID (Optional)
            </label>
            <input
              type="text"
              value={newStudentExternalId}
              onChange={(e) => setNewStudentExternalId(e.target.value)}
              placeholder="e.g., STU-12345"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use this to match students with your roster
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAddStudentModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAddStudent}
              disabled={!newStudentName.trim() || isAddingStudent}
              isLoading={isAddingStudent}
            >
              Add Student
            </Button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Class Settings"
      >
        <div className="space-y-6">
          {/* ELL Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ELL Level (Vocabulary Simplification)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setSettings({ ...settings, ell_level: level })}
                  className={`p-3 rounded-xl text-center ${
                    settings.ell_level === level
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="font-bold">Level {level}</div>
                  <div className="text-xs mt-1">
                    {level === 1 ? 'Basic' : level === 2 ? 'Simple' : 'Moderate'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Show Emojis */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.show_emojis}
                onChange={(e) =>
                  setSettings({ ...settings, show_emojis: e.target.checked })
                }
                className="w-5 h-5 rounded text-blue-500"
              />
              <div>
                <div className="font-medium text-gray-700">Show Emojis</div>
                <div className="text-sm text-gray-500">
                  Display visual hints with problems
                </div>
              </div>
            </label>
          </div>

          {/* Co-Teachers Section */}
          <div className="border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Co-Teachers
              </div>
            </label>

            {/* Current co-teachers */}
            {coTeachers.length > 0 && (
              <div className="space-y-2 mb-4">
                {coTeachers.map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {ct.teacher_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{ct.teacher_name}</div>
                        <div className="text-sm text-gray-500">{ct.teacher_email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveCoTeacher(ct.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add co-teacher form */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={newCoTeacherEmail}
                  onChange={(e) => setNewCoTeacherEmail(e.target.value)}
                  placeholder="Enter teacher's email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCoTeacher()}
                />
              </div>
              <Button
                variant="primary"
                onClick={handleAddCoTeacher}
                disabled={!newCoTeacherEmail.trim() || isAddingCoTeacher}
                isLoading={isAddingCoTeacher}
              >
                Add
              </Button>
            </div>

            {coTeacherError && (
              <p className="text-red-500 text-sm mt-2">{coTeacherError}</p>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Co-teachers can manage students, problems, and view analytics for this class.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowSettingsModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Student Modal */}
      <Modal
        isOpen={!!studentToRemove}
        onClose={() => setStudentToRemove(null)}
        title="Remove Student"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to remove <strong>{studentToRemove?.name}</strong> from
            this class? Their progress will be deleted.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStudentToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-red-500 hover:bg-red-600"
              onClick={handleRemoveStudent}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkImportModal}
        onClose={() => {
          setShowBulkImportModal(false);
          setBulkResult(null);
          setBulkCount(5);
          setBulkPrefix('Student');
        }}
        title="Bulk Add Students"
        size="lg"
      >
        <div className="space-y-4">
          {bulkResult ? (
            <>
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center">
                <Check className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Created {bulkResult.length} students!</p>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {bulkResult.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium">{student.name}</span>
                    <span className="font-mono text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      {student.passcode}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleExportCredentials('csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export All Credentials
              </Button>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                Quickly create multiple student accounts at once. Each student will receive a unique passcode.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Students
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name Prefix
                </label>
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  placeholder="e.g., Student"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Students will be named: {bulkPrefix} 1, {bulkPrefix} 2, etc.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleBulkCreate}
                  isLoading={isBulkCreating}
                  disabled={bulkCount < 1 || isBulkCreating}
                >
                  Create {bulkCount} Students
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Roster Mapping Modal */}
      <Modal
        isOpen={showRosterModal}
        onClose={() => {
          setShowRosterModal(false);
          setSelectedStudent(null);
        }}
        title="Edit Student Roster Info"
      >
        <div className="space-y-4">
          {selectedStudent && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800">{selectedStudent.name}</p>
                <p className="text-sm text-gray-500">External ID: {selectedStudent.external_id || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roster ID
                </label>
                <input
                  type="text"
                  value={rosterIdInput}
                  onChange={(e) => setRosterIdInput(e.target.value)}
                  placeholder="e.g., SIS-12345"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID from your student information system
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Add any notes about this student..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowRosterModal(false);
                    setSelectedStudent(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveRoster}
                  isLoading={isSavingRoster}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

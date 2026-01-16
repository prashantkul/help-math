import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, UserX, Copy, Check, Settings } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal } from '../../components/common';
import { Student, Class } from '../../types';

export default function ClassManagement() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    ell_level: 2,
    show_emojis: true,
  });
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);

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

    const [classesResult, studentsResult] = await Promise.all([
      apiClient.getClasses(),
      apiClient.getClassStudents(classId!),
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

    setIsLoading(false);
  };

  const handleCopyCode = () => {
    if (classData) {
      navigator.clipboard.writeText(classData.join_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/teacher/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{classData.name}</h1>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600"
                >
                  <span>Join code: </span>
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {classData.join_code}
                  </span>
                  {copiedCode ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-800">
            Students ({students.length})
          </h2>
        </div>

        {students.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="text-5xl block mb-4">👋</span>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No students yet</h3>
            <p className="text-gray-600 mb-4">
              Share the join code <strong>{classData.join_code}</strong> with your students.
            </p>
            <Button variant="primary" onClick={handleCopyCode}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Join Code
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <Card key={student.id} padding="md" className="flex items-center justify-between">
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
                    <p className="text-sm text-gray-500">
                      {student.total_points} points
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/teacher/analytics/${classId}?student=${student.id}`}>
                    <Button variant="ghost" size="sm">
                      View Progress
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStudentToRemove(student)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <UserX className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Class Settings"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ELL Level (Vocabulary Simplification)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => setSettings({ ...settings, ell_level: level })}
                  className={`p-3 rounded-xl text-center ${
                    settings.ell_level === level
                      ? 'bg-indigo-500 text-white'
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

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.show_emojis}
                onChange={(e) =>
                  setSettings({ ...settings, show_emojis: e.target.checked })
                }
                className="w-5 h-5 rounded text-indigo-500"
              />
              <div>
                <div className="font-medium text-gray-700">Show Emojis</div>
                <div className="text-sm text-gray-500">
                  Display visual hints with problems
                </div>
              </div>
            </label>
          </div>

          <div className="flex gap-3">
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
    </div>
  );
}

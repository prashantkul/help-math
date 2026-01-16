import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, BarChart3, LogOut, Copy, Check } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal } from '../../components/common';
import { Class } from '../../types';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { teacher, logout, isLoading: authLoading } = useTeacherAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  useEffect(() => {
    if (teacher) {
      fetchClasses();
    }
  }, [teacher]);

  const fetchClasses = async () => {
    setIsLoading(true);
    const result = await apiClient.getClasses();
    if (result.data) {
      setClasses(result.data);
    }
    setIsLoading(false);
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;

    setIsCreating(true);
    const result = await apiClient.createClass(newClassName.trim());
    if (result.data) {
      setClasses([result.data, ...classes]);
      setShowCreateModal(false);
      setNewClassName('');
    }
    setIsCreating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/teacher/login');
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧮</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Math Helper</h1>
              <p className="text-sm text-gray-500">Teacher Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-600">{teacher.name}</span>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Your Classes</h2>
            <p className="text-gray-600">Manage your classes and assignments</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            New Class
          </Button>
        </div>

        {/* Classes Grid */}
        {isLoading ? (
          <Loading message="Loading classes..." />
        ) : classes.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="text-6xl block mb-4">📚</span>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No classes yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first class to get started with Math Helper.
            </p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Create Class
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} padding="lg" hover>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{cls.name}</h3>
                    <button
                      onClick={() => handleCopyCode(cls.join_code)}
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 mt-1"
                    >
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {cls.join_code}
                      </span>
                      {copiedCode === cls.join_code ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <span className="text-2xl">📖</span>
                </div>

                <div className="space-y-2">
                  <Link to={`/teacher/classes/${cls.id}`}>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left">
                      <Users className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">Manage Students</span>
                    </button>
                  </Link>
                  <Link to={`/teacher/classes/${cls.id}/problems`}>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">Problems & Assignments</span>
                    </button>
                  </Link>
                  <Link to={`/teacher/analytics/${cls.id}`}>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left">
                      <BarChart3 className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">View Analytics</span>
                    </button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Class Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Class"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class Name
            </label>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g., 3rd Grade Math - Period 2"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleCreateClass}
              isLoading={isCreating}
              disabled={!newClassName.trim() || isCreating}
            >
              Create Class
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

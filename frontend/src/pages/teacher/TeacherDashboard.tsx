import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, BarChart3, LogOut, Copy, Check, FolderOpen, Trash2 } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, Modal } from '../../components/common';
import type { Class } from '../../types';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { teacher, logout, isLoading: authLoading } = useTeacherAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(3);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    const result = await apiClient.createClass(newClassName.trim(), undefined, undefined, newClassGrade);
    if (result.data) {
      setClasses([result.data, ...classes]);
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassGrade(3);
    }
    setIsCreating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;

    setIsDeleting(true);
    const result = await apiClient.deleteClass(classToDelete.id);
    if (result.data !== undefined || !result.error) {
      setClasses(classes.filter(c => c.id !== classToDelete.id));
      setClassToDelete(null);
    }
    setIsDeleting(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/teacher/login');
  };

  if (authLoading || !teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  // Array of color themes for class cards
  const cardColors = [
    { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50', icon: 'text-violet-500', hover: 'hover:bg-violet-50' },
    { bg: 'from-blue-500 to-cyan-500', light: 'bg-blue-50', icon: 'text-blue-500', hover: 'hover:bg-blue-50' },
    { bg: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50', icon: 'text-emerald-500', hover: 'hover:bg-emerald-50' },
    { bg: 'from-orange-500 to-amber-500', light: 'bg-orange-50', icon: 'text-orange-500', hover: 'hover:bg-orange-50' },
    { bg: 'from-pink-500 to-rose-500', light: 'bg-pink-50', icon: 'text-pink-500', hover: 'hover:bg-pink-50' },
    { bg: 'from-indigo-500 to-blue-600', light: 'bg-indigo-50', icon: 'text-indigo-500', hover: 'hover:bg-indigo-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🧮</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Math Helper</h1>
              <p className="text-sm text-indigo-200">Teacher Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-medium">
                {teacher.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-medium">{teacher.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Your Classes</h2>
            <p className="text-gray-500">Manage your classes and assignments</p>
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
          <Card padding="lg" className="text-center bg-gradient-to-br from-white to-indigo-50 border-2 border-dashed border-indigo-200">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📚</span>
            </div>
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
            {classes.map((cls, index) => {
              const colors = cardColors[index % cardColors.length];
              return (
                <div key={cls.id} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100">
                  {/* Colored Header */}
                  <div className={`bg-gradient-to-r ${colors.bg} p-4`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{cls.name}</h3>
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white">
                            Grade {cls.grade}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyCode(cls.join_code)}
                          className="flex items-center gap-1 text-sm text-white/80 hover:text-white mt-1 transition-colors"
                        >
                          <span className="font-mono bg-white/20 px-2 py-0.5 rounded">
                            {cls.join_code}
                          </span>
                          {copiedCode === cls.join_code ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setClassToDelete(cls)}
                          className="w-8 h-8 bg-white/10 hover:bg-red-500/80 rounded-lg flex items-center justify-center transition-colors"
                          title="Delete class"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <span className="text-xl">📖</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Links */}
                  <div className="p-3 space-y-1">
                    <Link to={`/teacher/classes/${cls.id}`}>
                      <button className={`w-full flex items-center gap-3 p-3 rounded-xl ${colors.hover} text-left transition-colors`}>
                        <div className={`w-8 h-8 ${colors.light} rounded-lg flex items-center justify-center`}>
                          <Users className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <span className="text-gray-700 font-medium">Manage Students</span>
                      </button>
                    </Link>
                    <Link to={`/teacher/classes/${cls.id}/curriculum`}>
                      <button className={`w-full flex items-center gap-3 p-3 rounded-xl ${colors.hover} text-left transition-colors`}>
                        <div className={`w-8 h-8 ${colors.light} rounded-lg flex items-center justify-center`}>
                          <FolderOpen className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <span className="text-gray-700 font-medium">Modules & Lessons</span>
                      </button>
                    </Link>
                    <Link to={`/teacher/classes/${cls.id}/problems`}>
                      <button className={`w-full flex items-center gap-3 p-3 rounded-xl ${colors.hover} text-left transition-colors`}>
                        <div className={`w-8 h-8 ${colors.light} rounded-lg flex items-center justify-center`}>
                          <BookOpen className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <span className="text-gray-700 font-medium">All Problems</span>
                      </button>
                    </Link>
                    <Link to={`/teacher/analytics/${cls.id}`}>
                      <button className={`w-full flex items-center gap-3 p-3 rounded-xl ${colors.hover} text-left transition-colors`}>
                        <div className={`w-8 h-8 ${colors.light} rounded-lg flex items-center justify-center`}>
                          <BarChart3 className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <span className="text-gray-700 font-medium">View Analytics</span>
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grade Level
            </label>
            <select
              value={newClassGrade}
              onChange={(e) => setNewClassGrade(parseInt(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value={3}>Grade 3</option>
              <option value={4}>Grade 4</option>
              <option value={5}>Grade 5</option>
            </select>
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

      {/* Delete Class Confirmation Modal */}
      <Modal
        isOpen={!!classToDelete}
        onClose={() => setClassToDelete(null)}
        title="Delete Class"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{classToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This class will be archived and can be recovered later if needed.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setClassToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 !bg-red-500 hover:!bg-red-600"
              onClick={handleDeleteClass}
              isLoading={isDeleting}
              disabled={isDeleting}
            >
              Delete Class
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

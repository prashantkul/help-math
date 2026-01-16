import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Star, Trophy } from 'lucide-react';
import { useStudentAuth } from '../../hooks/useAuth';
import { useStudentProgress } from '../../hooks/useStudentProgress';
import { Button, Card, Loading, Avatar } from '../../components/common';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { student, className, logout, isLoading: authLoading } = useStudentAuth();
  const { assignments, progress, totalPoints, isLoading, error, refreshProgress } = useStudentProgress();

  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [student, authLoading, navigate]);

  if (authLoading || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/student/login');
  };

  // Get all problems from all assignments
  const allProblems = assignments.flatMap((a) => a.problems || []);

  // Calculate progress stats
  const completedCount = Array.from(progress.values()).filter((p) => p.is_complete).length;
  const totalProblems = allProblems.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar avatarId={student.avatar} size="md" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">{student.name}</h1>
              <p className="text-sm text-gray-500">{className}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="font-bold text-yellow-700">{totalPoints}</span>
            </div>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Progress Summary */}
        <Card variant="warm" padding="lg" className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Great job, {student.name.split(' ')[0]}! 🌟
              </h2>
              <p className="text-gray-600">
                You've completed {completedCount} of {totalProblems} problems
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-orange-500">
                {totalProblems > 0 ? Math.round((completedCount / totalProblems) * 100) : 0}%
              </div>
              <p className="text-gray-500 text-sm">Complete</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-4 bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${totalProblems > 0 ? (completedCount / totalProblems) * 100 : 0}%` }}
            />
          </div>
        </Card>

        {/* Problems List */}
        <h3 className="text-xl font-bold text-gray-800 mb-4">Your Problems</h3>

        {isLoading ? (
          <Loading message="Loading problems..." />
        ) : error ? (
          <Card padding="lg" className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="primary" onClick={refreshProgress}>
              Try Again
            </Button>
          </Card>
        ) : allProblems.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="text-6xl block mb-4">📚</span>
            <h4 className="text-xl font-bold text-gray-800 mb-2">No problems yet!</h4>
            <p className="text-gray-600">
              Your teacher hasn't assigned any problems yet. Check back soon!
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {allProblems.map((problem) => {
              const problemProgress = progress.get(problem.id);
              const isComplete = problemProgress?.is_complete;
              const starsEarned = problemProgress?.stars_earned || 0;
              const isStarted = !!problemProgress;

              return (
                <Link key={problem.id} to={`/student/problem/${problem.id}`}>
                  <Card
                    variant="default"
                    padding="lg"
                    hover
                    className={`${isComplete ? 'border-2 border-green-200 bg-green-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{problem.scene_emoji || '📝'}</span>
                          {!isStarted && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                              NEW!
                            </span>
                          )}
                          {isComplete && (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                              DONE!
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 line-clamp-2">
                          {problem.simplified_text || problem.original_text}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {problem.skill_tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        {[1, 2, 3].map((star) => (
                          <Star
                            key={star}
                            className={`w-6 h-6 ${
                              star <= starsEarned
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {isStarted && !isComplete && (
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Step {(problemProgress?.current_step || 0) + 1} of {problem.steps?.length || '?'}
                        </span>
                        <span className="text-sm text-orange-600 font-medium">
                          Continue →
                        </span>
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

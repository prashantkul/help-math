import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Card, Loading } from '../../components/common';
import type { Class, ClassAnalytics, StudentAnalytics, Student } from '../../types';

export default function Analytics() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('student');
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [classData, setClassData] = useState<Class | null>(null);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalytics | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(studentId);

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

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentAnalytics(selectedStudentId);
    } else {
      setStudentAnalytics(null);
    }
  }, [selectedStudentId]);

  const fetchData = async () => {
    setIsLoading(true);

    const [classesResult, analyticsResult, studentsResult] = await Promise.all([
      apiClient.getClasses(),
      apiClient.getClassAnalytics(classId!),
      apiClient.getClassStudents(classId!),
    ]);

    if (classesResult.data) {
      const cls = classesResult.data.find((c) => c.id === classId);
      if (cls) setClassData(cls);
    }

    if (analyticsResult.data) {
      setClassAnalytics(analyticsResult.data);
    }

    if (studentsResult.data) {
      setStudents(studentsResult.data);
    }

    setIsLoading(false);
  };

  const fetchStudentAnalytics = async (studentId: string) => {
    const result = await apiClient.getStudentAnalytics(studentId);
    if (result.data) {
      setStudentAnalytics(result.data);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/teacher/dashboard">
              <button className="flex items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">
                {classData?.name} - Analytics
              </h1>
              <p className="text-sm text-white/80">
                Track student progress and identify areas for improvement
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Class Overview Cards */}
        {classAnalytics && !selectedStudentId && (
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Students</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {classAnalytics.total_students}
                    </p>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📝</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Problems</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {classAnalytics.total_problems}
                    </p>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Completion Rate</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.round(classAnalytics.average_completion_rate * 100)}%
                    </p>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Points</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.round(classAnalytics.average_points_per_student)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Step Failure Rates */}
            {classAnalytics.step_failure_rates.length > 0 && (
              <Card padding="lg" className="mb-8">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Areas Needing Attention
                </h3>
                <div className="space-y-3">
                  {classAnalytics.step_failure_rates
                    .filter((s) => s.failure_rate > 0.2)
                    .slice(0, 5)
                    .map((step) => (
                      <div key={step.step_type} className="flex items-center justify-between">
                        <span className="text-gray-700 capitalize">
                          {step.step_type.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{ width: `${step.failure_rate * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-12 text-right">
                            {Math.round(step.failure_rate * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Student Selector */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-800 mb-3">Student Progress</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStudentId(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                !selectedStudentId
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Class Overview
            </button>
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedStudentId === student.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {student.name}
              </button>
            ))}
          </div>
        </div>

        {/* Student Analytics */}
        {studentAnalytics && (
          <div className="space-y-6">
            {/* Student Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card padding="md">
                <p className="text-sm text-gray-500">Problems Completed</p>
                <p className="text-2xl font-bold text-gray-800">
                  {studentAnalytics.total_problems_completed}/{studentAnalytics.total_problems_attempted}
                </p>
              </Card>

              <Card padding="md">
                <p className="text-sm text-gray-500">Total Points</p>
                <p className="text-2xl font-bold text-gray-800">
                  {studentAnalytics.total_points}
                </p>
              </Card>

              <Card padding="md">
                <p className="text-sm text-gray-500">Average Stars</p>
                <p className="text-2xl font-bold text-gray-800 flex items-center gap-1">
                  {studentAnalytics.average_stars.toFixed(1)}
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </p>
              </Card>

              <Card padding="md">
                <p className="text-sm text-gray-500">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-800">
                  {studentAnalytics.total_problems_attempted > 0
                    ? Math.round(
                        (studentAnalytics.total_problems_completed /
                          studentAnalytics.total_problems_attempted) *
                          100
                      )
                    : 0}
                  %
                </p>
              </Card>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card padding="lg">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-green-500">💪</span> Strengths
                </h4>
                {studentAnalytics.strengths.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {studentAnalytics.strengths.map((skill) => (
                      <span
                        key={skill}
                        className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm capitalize"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">More data needed</p>
                )}
              </Card>

              <Card padding="lg">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-orange-500">📈</span> Areas to Practice
                </h4>
                {studentAnalytics.areas_for_improvement.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {studentAnalytics.areas_for_improvement.map((skill) => (
                      <span
                        key={skill}
                        className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm capitalize"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No areas identified</p>
                )}
              </Card>
            </div>

            {/* Recent Activity */}
            <Card padding="lg">
              <h4 className="font-bold text-gray-800 mb-4">Recent Activity</h4>
              {studentAnalytics.recent_activity.length > 0 ? (
                <div className="space-y-3">
                  {studentAnalytics.recent_activity.map((activity) => (
                    <div
                      key={activity.problem_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex-1">
                        <p className="text-gray-800 line-clamp-1">
                          {activity.problem_text}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(activity.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex">
                          {[1, 2, 3].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= activity.stars_earned
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-indigo-600">
                          +{activity.points_earned}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No activity yet</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useStudentAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Card, Loading } from '../../components/common';
import type { GradedSubmission } from '../../types';

export default function StudentFeedback() {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { student, isLoading: authLoading } = useStudentAuth();

  const [feedback, setFeedback] = useState<GradedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [student, authLoading, navigate]);

  useEffect(() => {
    if (student && assignmentId) {
      const fetchFeedback = async () => {
        setIsLoading(true);
        const result = await apiClient.getStudentFeedback(assignmentId);
        if (result.data) {
          setFeedback(result.data);
        }
        setIsLoading(false);
      };
      fetchFeedback();
    }
  }, [student, assignmentId]);

  if (authLoading || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/student/dashboard')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">My Feedback</h1>
            <p className="text-sm text-orange-100">From your teacher</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {isLoading ? (
          <Loading message="Loading feedback..." />
        ) : feedback.length === 0 ? (
          <Card padding="lg" className="text-center bg-white">
            <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📬</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No feedback yet!</h3>
            <p className="text-gray-600">
              Your teacher hasn't returned feedback on this assignment yet. Check back soon!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedback.map(item => (
              <Card key={item.id} padding="lg" className="bg-white">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Your Teacher's Feedback</h3>
                    <p className="text-sm text-gray-500">
                      {item.returned_at ? new Date(item.returned_at).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                </div>

                {item.final_score !== undefined && item.final_score !== null && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-amber-600">{Math.round(item.final_score)}%</span>
                      <span className="text-gray-600">
                        {item.final_score >= 90 ? 'Amazing work!' :
                         item.final_score >= 80 ? 'Great job!' :
                         item.final_score >= 70 ? 'Good effort!' :
                         'Keep practicing!'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-xl text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
                  {item.final_feedback || 'Great work on this assignment!'}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

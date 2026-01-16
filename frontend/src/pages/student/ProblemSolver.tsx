import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStudentAuth } from '../../hooks/useAuth';
import { useProblemSession } from '../../hooks/useStudentProgress';
import { Button, Card, Loading, ProgressBar, ReadAloudButton } from '../../components/common';
import { ScaffoldStep } from '../../types';

// Step components
import FindObjectsStep from '../../components/student/steps/FindObjectsStep';
import FindNumbersStep from '../../components/student/steps/FindNumbersStep';
import IdentifyOperationStep from '../../components/student/steps/IdentifyOperationStep';
import BuildEquationStep from '../../components/student/steps/BuildEquationStep';
import SolveStep from '../../components/student/steps/SolveStep';
import ComprehensionCheckStep from '../../components/student/steps/ComprehensionCheckStep';

export default function ProblemSolver() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const { student, isLoading: authLoading } = useStudentAuth();
  const {
    problem,
    currentStep,
    totalSteps,
    pointsEarned,
    attempts,
    isLoading,
    error,
    submitAnswer,
    nextStep,
    isComplete,
  } = useProblemSession(problemId || '');

  const [showIntro, setShowIntro] = useState(true);
  const [stepResult, setStepResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    hint?: string;
  } | null>(null);
  const [celebrationShown, setCelebrationShown] = useState(false);

  useEffect(() => {
    if (!authLoading && !student) {
      navigate('/student/login');
    }
  }, [student, authLoading, navigate]);

  // Show celebration when complete
  useEffect(() => {
    if (isComplete && !celebrationShown) {
      setCelebrationShown(true);
      // Fire confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
      }, 200);
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 400);
    }
  }, [isComplete, celebrationShown]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loading message="Loading problem..." />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
        <Card padding="lg" className="text-center max-w-md">
          <span className="text-6xl block mb-4">😕</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error || 'Problem not found'}</p>
          <Link to="/student/dashboard">
            <Button variant="primary">Go Back</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const currentStepData = problem.steps?.[currentStep];

  const handleSubmit = async (answer: unknown) => {
    if (!currentStepData) return;

    const result = await submitAnswer(currentStepData.id, answer);
    setStepResult(result);

    if (result.isCorrect) {
      // Brief delay before moving to next step
      setTimeout(() => {
        setStepResult(null);
        nextStep();
      }, 1500);
    }
  };

  const handleTryAgain = () => {
    setStepResult(null);
  };

  // Completion screen
  if (isComplete) {
    const totalPossible = problem.steps?.reduce((acc, s) => acc + s.points, 0) || 0;
    const stars = totalPossible > 0 ? Math.min(3, Math.ceil((pointsEarned / totalPossible) * 3)) : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-6">
        <Card variant="warm" padding="lg" className="text-center max-w-md">
          <div className="mb-6">
            <span className="text-8xl block mb-4">🎉</span>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Amazing Job!
            </h2>
            <p className="text-gray-600">You solved the problem!</p>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={`text-5xl transition-all duration-500 ${
                  star <= stars ? 'scale-110' : 'grayscale opacity-30'
                }`}
                style={{
                  animationDelay: `${star * 200}ms`,
                }}
              >
                ⭐
              </span>
            ))}
          </div>

          {/* Points */}
          <div className="bg-yellow-100 rounded-2xl p-4 mb-6">
            <p className="text-lg text-yellow-800">Points earned</p>
            <p className="text-4xl font-bold text-yellow-600">{pointsEarned}</p>
          </div>

          <Link to="/student/dashboard">
            <Button variant="secondary" size="xl" className="w-full">
              <Home className="w-5 h-5 mr-2" />
              Back to Problems
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col">
        {/* Header */}
        <header className="p-4">
          <Link to="/student/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <Card variant="warm" padding="lg" className="max-w-lg w-full text-center">
            <div className="mb-6">
              <span className="text-6xl block mb-4">{problem.scene_emoji || '📚'}</span>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Here's your problem!
              </h2>
            </div>

            {/* Problem Text */}
            <div className="speech-bubble mb-8 text-left">
              <div className="flex items-start justify-between">
                <p className="text-xl text-gray-800 leading-relaxed pr-4">
                  {problem.simplified_text || problem.original_text}
                </p>
                <ReadAloudButton
                  text={problem.simplified_text || problem.original_text}
                  size="lg"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              size="xl"
              className="w-full"
              onClick={() => setShowIntro(false)}
            >
              Let's solve this together! 🚀
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // Main solving flow
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col">
      {/* Header with Progress */}
      <header className="bg-white shadow-sm sticky top-0 z-10 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link to="/student/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Exit
              </Button>
            </Link>
            <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
              <span className="text-yellow-600">⭐</span>
              <span className="font-bold text-yellow-700">{pointsEarned}</span>
            </div>
          </div>
          <ProgressBar current={currentStep} total={totalSteps} animated />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          {currentStepData && (
            <StepRenderer
              step={currentStepData}
              onSubmit={handleSubmit}
              result={stepResult}
              onTryAgain={handleTryAgain}
              attempts={attempts}
            />
          )}
        </div>
      </main>
    </div>
  );
}

interface StepRendererProps {
  step: ScaffoldStep;
  onSubmit: (answer: unknown) => void;
  result: { isCorrect: boolean; pointsEarned: number; hint?: string } | null;
  onTryAgain: () => void;
  attempts: number;
}

function StepRenderer({ step, onSubmit, result, onTryAgain, attempts }: StepRendererProps) {
  const props = {
    step,
    onSubmit,
    result,
    onTryAgain,
    attempts,
  };

  switch (step.step_type) {
    case 'find_objects':
      return <FindObjectsStep {...props} />;
    case 'find_numbers':
      return <FindNumbersStep {...props} />;
    case 'identify_operation':
      return <IdentifyOperationStep {...props} />;
    case 'build_equation':
      return <BuildEquationStep {...props} />;
    case 'solve':
      return <SolveStep {...props} />;
    case 'comprehension_check':
      return <ComprehensionCheckStep {...props} />;
    default:
      return <SolveStep {...props} />;
  }
}

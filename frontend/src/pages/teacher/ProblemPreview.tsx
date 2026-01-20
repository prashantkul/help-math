import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useTeacherAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { Button, Card, Loading, ProgressBar, ReadAloudButton, AnnotatableText } from '../../components/common';
import type { Problem, ScaffoldStep } from '../../types';

// Import step components
import FindObjectsStep from '../../components/student/steps/FindObjectsStep';
import FindNumbersStep from '../../components/student/steps/FindNumbersStep';
import IdentifyOperationStep from '../../components/student/steps/IdentifyOperationStep';
import BuildEquationStep from '../../components/student/steps/BuildEquationStep';
import SolveStep from '../../components/student/steps/SolveStep';
import ComprehensionCheckStep from '../../components/student/steps/ComprehensionCheckStep';

export default function ProblemPreview() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const { teacher, isLoading: authLoading } = useTeacherAuth();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [stepResult, setStepResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    hint?: string;
  } | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!authLoading && !teacher) {
      navigate('/teacher/login');
    }
  }, [teacher, authLoading, navigate]);

  useEffect(() => {
    if (problemId && teacher) {
      fetchProblem();
    }
  }, [problemId, teacher]);

  const fetchProblem = async () => {
    setIsLoading(true);
    const result = await apiClient.getProblem(problemId!);
    if (result.data) {
      setProblem(result.data);
    }
    setIsLoading(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loading message="Loading preview..." />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
        <Card padding="lg" className="text-center max-w-md">
          <span className="text-6xl block mb-4">😕</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Problem Not Found</h2>
          <p className="text-gray-600 mb-6">This problem doesn't exist or hasn't been scaffolded yet.</p>
          <Link to="/teacher/dashboard">
            <Button variant="primary">Go Back</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!problem.steps || problem.steps.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
        <Card padding="lg" className="text-center max-w-md">
          <span className="text-6xl block mb-4">📝</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Scaffold Yet</h2>
          <p className="text-gray-600 mb-6">
            This problem needs scaffolding before it can be previewed.
          </p>
          <Link to={`/teacher/classes/${problem.class_id}/problems`}>
            <Button variant="primary">Generate Scaffold</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const currentStepData = problem.steps[currentStep];
  const totalSteps = problem.steps.length;

  // Check answer locally without API call
  const checkAnswer = (correctAnswer: unknown, givenAnswer: unknown, answerType: string): boolean => {
    if (answerType === 'number_input') {
      return Number(correctAnswer) === Number(givenAnswer);
    }
    if (answerType === 'multiple_choice') {
      return String(correctAnswer).toLowerCase() === String(givenAnswer).toLowerCase();
    }
    if (answerType === 'multi_select') {
      const correct = Array.isArray(correctAnswer) ? [...correctAnswer].sort() : [];
      const given = Array.isArray(givenAnswer) ? [...givenAnswer].sort() : [];
      return JSON.stringify(correct) === JSON.stringify(given);
    }
    if (answerType === 'equation_builder') {
      return JSON.stringify(correctAnswer) === JSON.stringify(givenAnswer);
    }
    return JSON.stringify(correctAnswer) === JSON.stringify(givenAnswer);
  };

  const handleSubmit = (answer: unknown) => {
    if (!currentStepData) return;

    setAttempts(prev => prev + 1);
    const isCorrect = checkAnswer(currentStepData.correct_answer, answer, currentStepData.answer_type);
    const hints = currentStepData.hints || [];
    const hint = !isCorrect && hints.length > 0 ? hints[Math.min(attempts, hints.length - 1)] : undefined;

    setStepResult({
      isCorrect,
      pointsEarned: isCorrect ? currentStepData.points : 0,
      hint,
    });

    if (isCorrect) {
      setTimeout(() => {
        setStepResult(null);
        setAttempts(0);
        if (currentStep < totalSteps - 1) {
          setCurrentStep(currentStep + 1);
        }
      }, 1500);
    }
  };

  const handleTryAgain = () => {
    setStepResult(null);
  };

  const renderStepComponent = (step: ScaffoldStep) => {
    const commonProps = {
      step,
      onSubmit: handleSubmit,
      result: stepResult,
      onTryAgain: handleTryAgain,
      attempts,
    };

    // Route by answer_type for flexibility - step_type is just a label
    // This allows the AI to create any step_type based on curriculum needs
    switch (step.answer_type) {
      case 'number_input':
        return <SolveStep {...commonProps} />;
      case 'multi_select':
        return <FindObjectsStep {...commonProps} />;
      case 'multiple_choice':
        // Use operation step if it looks like an operation choice, otherwise generic
        if (step.step_type === 'identify_operation' ||
            (step.options && step.options.some(o => ['+', '-', '×', '÷', 'add', 'subtract', 'multiply', 'divide'].includes(String(o.value).toLowerCase())))) {
          return <IdentifyOperationStep {...commonProps} />;
        }
        return <ComprehensionCheckStep {...commonProps} />;
      case 'equation_builder':
        return <BuildEquationStep {...commonProps} />;
      default:
        // Fallback to comprehension check for any other type
        return <ComprehensionCheckStep {...commonProps} />;
    }
  };

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Preview Badge */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="font-medium">Teacher Preview Mode</span>
          </div>
        </div>

        {/* Back Button */}
        <div className="fixed top-4 left-4 z-40">
          <Link to={`/teacher/classes/${problem.class_id}/problems`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-gray-700 rounded-xl shadow-md transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Exit Preview
            </button>
          </Link>
        </div>

        <div className="flex items-center justify-center min-h-screen p-6 pt-20">
          <Card variant="warm" padding="lg" className="max-w-lg text-center">
            {/* Problem Emoji */}
            {problem.scene_emoji && (
              <span className="text-7xl block mb-4">{problem.scene_emoji}</span>
            )}

            <div className="flex justify-end mb-2">
              <ReadAloudButton
                text={problem.simplified_text || problem.original_text}
                size="lg"
              />
            </div>

            <div className="text-left mb-6">
              <AnnotatableText
                text={problem.simplified_text || problem.original_text}
                showInstructions={true}
              />
            </div>

            <p className="text-gray-600 mb-6">
              This problem has {totalSteps} step{totalSteps !== 1 ? 's' : ''} to solve.
            </p>

            <Button
              variant="secondary"
              size="xl"
              onClick={() => setShowIntro(false)}
              className="w-full"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Preview
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Step view
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Preview Badge */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="font-medium">Teacher Preview Mode</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to={`/teacher/classes/${problem.class_id}/problems`}>
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Exit Preview
              </button>
            </Link>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>

            <div className="w-20" /> {/* Spacer */}
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <ProgressBar
              current={currentStep + 1}
              total={totalSteps}
              showSteps={false}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8 pt-20">
        {/* Problem Context */}
        <Card variant="warm" padding="md" className="mb-6">
          <div className="flex items-start gap-4">
            {problem.scene_emoji && (
              <span className="text-4xl">{problem.scene_emoji}</span>
            )}
            <div className="flex-1">
              <AnnotatableText
                text={problem.simplified_text || problem.original_text}
                showInstructions={false}
                className="text-lg"
              />
            </div>
            <ReadAloudButton
              text={problem.simplified_text || problem.original_text}
              size="sm"
            />
          </div>
        </Card>

        {/* Current Step */}
        <div className="mb-6">
          {renderStepComponent(currentStepData)}
        </div>

        {/* Step Info Card */}
        <Card padding="md" className="mb-6 bg-blue-50 border border-blue-200">
          <h4 className="font-bold text-blue-800 mb-2">Step Details (Teacher View)</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Type:</strong> {currentStepData.step_type}</p>
            <p><strong>Points:</strong> {currentStepData.points}</p>
            <p><strong>Correct Answer:</strong> {JSON.stringify(currentStepData.correct_answer)}</p>
            {currentStepData.hints && currentStepData.hints.length > 0 && (
              <p><strong>Hints:</strong> {currentStepData.hints.join(' | ')}</p>
            )}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}
            disabled={currentStep === totalSteps - 1}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>

        {/* Complete Preview */}
        {currentStep === totalSteps - 1 && (
          <div className="mt-6 text-center">
            <Link to={`/teacher/classes/${problem.class_id}/problems`}>
              <Button variant="secondary" size="lg">
                Finish Preview
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

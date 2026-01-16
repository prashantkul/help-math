import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { StudentProgress, Problem, Assignment } from '../types';

interface UseStudentProgressReturn {
  assignments: Assignment[];
  progress: Map<string, StudentProgress>;
  totalPoints: number;
  isLoading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
  getProblemProgress: (problemId: string) => StudentProgress | undefined;
}

export function useStudentProgress(): UseStudentProgressReturn {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Map<string, StudentProgress>>(new Map());
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [assignmentsResult, progressResult] = await Promise.all([
        apiClient.getStudentAssignments(),
        apiClient.getStudentProgress(),
      ]);

      if (assignmentsResult.error) {
        setError(assignmentsResult.error);
        return;
      }

      if (progressResult.error) {
        setError(progressResult.error);
        return;
      }

      setAssignments(assignmentsResult.data || []);
      setTotalPoints(progressResult.data?.total_points || 0);

      const progressMap = new Map<string, StudentProgress>();
      (progressResult.data?.progress || []).forEach((p) => {
        progressMap.set(p.problem_id, p);
      });
      setProgress(progressMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const getProblemProgress = useCallback(
    (problemId: string) => progress.get(problemId),
    [progress]
  );

  return {
    assignments,
    progress,
    totalPoints,
    isLoading,
    error,
    refreshProgress: fetchProgress,
    getProblemProgress,
  };
}

interface UseProblemSessionReturn {
  problem: Problem | null;
  currentStep: number;
  totalSteps: number;
  pointsEarned: number;
  attempts: number;
  isLoading: boolean;
  error: string | null;
  submitAnswer: (stepId: string, answer: unknown) => Promise<{
    isCorrect: boolean;
    pointsEarned: number;
    hint?: string;
  }>;
  nextStep: () => void;
  isComplete: boolean;
}

export function useProblemSession(problemId: string): UseProblemSessionReturn {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [stepStartTime, setStepStartTime] = useState<number>(Date.now());

  useEffect(() => {
    const fetchProblem = async () => {
      setIsLoading(true);
      setError(null);

      const result = await apiClient.getStudentProblem(problemId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setProblem(result.data);

        // Check existing progress
        const progressResult = await apiClient.getStudentProgress();
        if (progressResult.data?.progress) {
          const existingProgress = progressResult.data.progress.find(
            (p) => p.problem_id === problemId
          );
          if (existingProgress) {
            setCurrentStep(existingProgress.current_step);
            setPointsEarned(existingProgress.total_points_earned);
            setIsComplete(existingProgress.is_complete);
          }
        }
      }

      setIsLoading(false);
    };

    if (problemId) {
      fetchProblem();
    }
  }, [problemId]);

  useEffect(() => {
    setStepStartTime(Date.now());
  }, [currentStep]);

  const submitAnswer = useCallback(
    async (stepId: string, answer: unknown) => {
      const timeSpent = Math.floor((Date.now() - stepStartTime) / 1000);
      setAttempts((prev) => prev + 1);

      const result = await apiClient.submitStepAttempt(
        problemId,
        stepId,
        answer,
        timeSpent
      );

      if (result.error) {
        return { isCorrect: false, pointsEarned: 0, hint: result.error };
      }

      const { is_correct, points_earned, hint } = result.data!;

      if (is_correct) {
        setPointsEarned((prev) => prev + points_earned);
      }

      return { isCorrect: is_correct, pointsEarned: points_earned, hint };
    },
    [problemId, stepStartTime]
  );

  const nextStep = useCallback(() => {
    if (problem?.steps && currentStep < problem.steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setAttempts(0);
    } else {
      setIsComplete(true);
    }
  }, [problem, currentStep]);

  return {
    problem,
    currentStep,
    totalSteps: problem?.steps?.length || 0,
    pointsEarned,
    attempts,
    isLoading,
    error,
    submitAnswer,
    nextStep,
    isComplete,
  };
}

export default useStudentProgress;

import { useState } from 'react';
import { Delete } from 'lucide-react';
import { Button, Card, ReadAloudButton } from '../../common';
import { ScaffoldStep } from '../../../types';

interface StepProps {
  step: ScaffoldStep;
  onSubmit: (answer: unknown) => void;
  result: { isCorrect: boolean; pointsEarned: number; hint?: string } | null;
  onTryAgain: () => void;
  attempts: number;
}

export default function SolveStep({ step, onSubmit, result, onTryAgain, attempts }: StepProps) {
  const [answer, setAnswer] = useState('');

  const handleNumberClick = (num: string) => {
    if (result) return;
    if (answer.length < 6) {
      setAnswer((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    if (result) return;
    setAnswer((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    const numAnswer = parseInt(answer, 10);
    if (!isNaN(numAnswer)) {
      onSubmit(numAnswer);
    }
  };

  const handleTryAgain = () => {
    setAnswer('');
    onTryAgain();
  };

  return (
    <Card variant="warm" padding="lg" className="text-center">
      {/* Emoji */}
      <span className="text-5xl block mb-4">{step.emoji_hint || '🎯'}</span>

      {/* Prompt */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {step.prompt_text}
        </h2>
        <ReadAloudButton text={step.prompt_text} size="md" />
      </div>

      {/* Answer Display */}
      <div className="bg-white rounded-2xl p-6 mb-6">
        <div className="text-5xl font-bold text-indigo-600 min-h-[60px] flex items-center justify-center">
          {answer || (
            <span className="text-gray-300">?</span>
          )}
        </div>
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            disabled={!!result}
            className={`numpad-btn ${result ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handleNumberClick('0')}
          disabled={!!result}
          className={`numpad-btn col-start-2 ${result ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={!!result || answer.length === 0}
          className={`numpad-btn ${result || answer.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Result feedback */}
      {result && (
        <div
          className={`p-4 rounded-2xl mb-6 ${
            result.isCorrect
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {result.isCorrect ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🎉</span>
              <span className="font-bold">Great job! +{result.pointsEarned} points!</span>
            </div>
          ) : (
            <div>
              <p className="font-bold mb-1">Hmm, let's try again!</p>
              {result.hint && <p className="text-sm">{result.hint}</p>}
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {result && !result.isCorrect ? (
        <Button variant="secondary" size="xl" className="w-full" onClick={handleTryAgain}>
          Try Again
        </Button>
      ) : !result ? (
        <Button
          variant="secondary"
          size="xl"
          className="w-full"
          onClick={handleSubmit}
          disabled={answer.length === 0}
        >
          Check My Answer
        </Button>
      ) : null}
    </Card>
  );
}

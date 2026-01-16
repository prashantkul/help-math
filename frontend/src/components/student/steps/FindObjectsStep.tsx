import { useState } from 'react';
import { Button, Card, ReadAloudButton } from '../../common';
import { ScaffoldStep } from '../../../types';

interface StepProps {
  step: ScaffoldStep;
  onSubmit: (answer: unknown) => void;
  result: { isCorrect: boolean; pointsEarned: number; hint?: string } | null;
  onTryAgain: () => void;
  attempts: number;
}

export default function FindObjectsStep({ step, onSubmit, result, onTryAgain, attempts }: StepProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const options = step.options || [];

  const handleToggle = (value: string) => {
    if (result) return;
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = () => {
    if (selected.length > 0) {
      onSubmit(selected);
    }
  };

  const handleTryAgain = () => {
    setSelected([]);
    onTryAgain();
  };

  return (
    <Card variant="warm" padding="lg" className="text-center">
      {/* Emoji */}
      <span className="text-5xl block mb-4">{step.emoji_hint || '👀'}</span>

      {/* Prompt */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {step.prompt_text}
        </h2>
        <ReadAloudButton text={step.prompt_text} size="md" />
      </div>

      {/* Simplified text if available */}
      {step.simplified_text && (
        <p className="text-lg text-gray-600 mb-6 bg-white rounded-xl p-4">
          {step.simplified_text}
        </p>
      )}

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value || option.label;
          const label = typeof option === 'string' ? option : option.label || option.value;
          const isSelected = selected.includes(value);

          return (
            <button
              key={value}
              onClick={() => handleToggle(value)}
              disabled={!!result}
              className={`p-4 rounded-2xl text-lg font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-indigo-500 text-white ring-4 ring-indigo-200'
                  : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-200'
              } ${result ? 'cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          );
        })}
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
              <p className="font-bold mb-1">Let's try again!</p>
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
          disabled={selected.length === 0}
        >
          Check My Answer
        </Button>
      ) : null}
    </Card>
  );
}

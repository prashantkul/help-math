import { useState } from 'react';
import { Button, Card, ReadAloudButton, AnnotatableText } from '../../common';
import type { ScaffoldStep } from '../../../types';

interface StepProps {
  step: ScaffoldStep;
  onSubmit: (answer: unknown) => void;
  result: { isCorrect: boolean; pointsEarned: number; hint?: string } | null;
  onTryAgain: () => void;
  attempts?: number;
}

export default function FindObjectsStep({ step, onSubmit, result, onTryAgain }: StepProps) {
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
      {/* Prompt with annotation support */}
      <div className="mb-6">
        <div className="flex justify-end mb-2">
          <ReadAloudButton text={step.prompt_text} size="md" />
        </div>
        <AnnotatableText
          text={step.prompt_text}
          showInstructions={false}
          className="text-2xl font-bold text-gray-800"
        />
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {options.map((option) => {
          // Handle string, number, or object options
          const isPrimitive = typeof option === 'string' || typeof option === 'number';
          const value = isPrimitive ? String(option) : String(option.value ?? option.label ?? '');
          const label = isPrimitive ? String(option) : String(option.label ?? option.value ?? '');
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

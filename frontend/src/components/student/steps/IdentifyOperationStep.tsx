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

const operationEmojis: Record<string, string> = {
  add: '➕',
  subtract: '➖',
  multiply: '✖️',
  divide: '➗',
};

export default function IdentifyOperationStep({ step, onSubmit, result, onTryAgain }: StepProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = step.options || [];

  const handleSelect = (value: string) => {
    if (result) return;
    setSelected(value);
  };

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected);
    }
  };

  const handleTryAgain = () => {
    setSelected(null);
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
          className="text-xl font-bold text-gray-800"
        />
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const label = typeof option === 'string' ? option : option.label;
          const emoji = typeof option === 'object' && option.emoji
            ? option.emoji
            : operationEmojis[value] || '🔢';
          const isSelected = selected === value;

          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={!!result}
              className={`p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 ${
                isSelected
                  ? 'bg-indigo-500 text-white ring-4 ring-indigo-200'
                  : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-200'
              } ${result ? 'cursor-not-allowed' : ''}`}
            >
              <span className="text-3xl">{emoji}</span>
              <span className="text-lg font-medium text-left">{label}</span>
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
          disabled={!selected}
        >
          Check My Answer
        </Button>
      ) : null}
    </Card>
  );
}

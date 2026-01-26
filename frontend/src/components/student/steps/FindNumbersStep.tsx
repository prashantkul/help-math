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

// Check if an option represents "no numbers"
function isNoNumbersOption(opt: unknown): boolean {
  if (typeof opt === 'string') {
    const lower = opt.toLowerCase();
    return lower.includes('no number') || lower === 'none' || lower === '[]';
  }
  return false;
}

export default function FindNumbersStep({ step, onSubmit, result, onTryAgain }: StepProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [noNumbersSelected, setNoNumbersSelected] = useState(false);
  const rawOptions = step.options || [];

  // Separate number options from "no numbers" option
  const noNumbersOption = rawOptions.find(opt => isNoNumbersOption(typeof opt === 'object' && opt !== null ? (opt as { value?: unknown }).value || opt : opt));
  const numberOptions = rawOptions.filter(opt => !isNoNumbersOption(typeof opt === 'object' && opt !== null ? (opt as { value?: unknown }).value || opt : opt));

  const handleToggle = (value: number) => {
    if (result) return;
    // Deselect "no numbers" when selecting a number
    setNoNumbersSelected(false);
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleNoNumbers = () => {
    if (result) return;
    setNoNumbersSelected(!noNumbersSelected);
    setSelected([]); // Clear number selections
  };

  const handleSubmit = () => {
    if (noNumbersSelected) {
      // Submit empty array for "no numbers"
      onSubmit([]);
    } else if (selected.length > 0) {
      onSubmit(selected);
    }
  };

  const canSubmit = noNumbersSelected || selected.length > 0;

  const handleTryAgain = () => {
    setSelected([]);
    setNoNumbersSelected(false);
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

      {/* Options - Numbers */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {numberOptions.map((option) => {
          const value = typeof option === 'number' ? option : Number(typeof option === 'object' && option !== null ? (option as { value?: unknown }).value : option);
          const isSelected = selected.includes(value);

          return (
            <button
              key={value}
              onClick={() => handleToggle(value)}
              disabled={!!result}
              className={`w-16 h-16 rounded-2xl text-2xl font-bold transition-all duration-200 ${
                isSelected
                  ? 'bg-indigo-500 text-white ring-4 ring-indigo-200 scale-110'
                  : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-200'
              } ${result ? 'cursor-not-allowed' : ''}`}
            >
              {value}
            </button>
          );
        })}
      </div>

      {/* No Numbers option */}
      {noNumbersOption && (
        <div className="mb-6">
          <button
            onClick={handleNoNumbers}
            disabled={!!result}
            className={`px-6 py-3 rounded-2xl text-lg font-semibold transition-all duration-200 ${
              noNumbersSelected
                ? 'bg-indigo-500 text-white ring-4 ring-indigo-200 scale-105'
                : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-200'
            } ${result ? 'cursor-not-allowed' : ''}`}
          >
            No numbers shown
          </button>
        </div>
      )}

      {/* Selected numbers display */}
      {selected.length > 0 && (
        <div className="mb-6 p-4 bg-white rounded-2xl">
          <p className="text-gray-600 mb-2">You selected:</p>
          <div className="flex justify-center gap-2">
            {selected.map((num) => (
              <span
                key={num}
                className="bg-indigo-100 text-indigo-700 text-2xl font-bold px-4 py-2 rounded-xl"
              >
                {num}
              </span>
            ))}
          </div>
        </div>
      )}
      {noNumbersSelected && (
        <div className="mb-6 p-4 bg-white rounded-2xl">
          <p className="text-gray-600 mb-2">You selected:</p>
          <span className="bg-indigo-100 text-indigo-700 text-lg font-bold px-4 py-2 rounded-xl">
            No numbers shown
          </span>
        </div>
      )}

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
          disabled={!canSubmit}
        >
          Check My Answer
        </Button>
      ) : null}
    </Card>
  );
}

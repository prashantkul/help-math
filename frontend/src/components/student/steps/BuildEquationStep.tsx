import { useState } from 'react';
import { Button, Card, ReadAloudButton, AnnotatableText } from '../../common';
import type { ScaffoldStep } from '../../../types';

// Vertical equation preview for addition/subtraction
function VerticalEquationPreview({
  left,
  operator,
  right,
}: {
  left: number | null;
  operator: string | null;
  right: number | null;
}) {
  // Only show for + and -
  if (operator !== '+' && operator !== '-') {
    return null;
  }

  const maxDigits = Math.max(
    left?.toString().length || 1,
    right?.toString().length || 1
  );

  return (
    <div className="inline-flex flex-col items-end font-mono text-2xl text-gray-700 mb-4">
      {/* Top number */}
      <div className="pr-2 min-w-[2em] text-right">
        {left !== null ? left : <span className="text-gray-300">?</span>}
      </div>

      {/* Operator and bottom number */}
      <div className="flex items-center">
        <span className="text-indigo-600 mr-2">
          {operator || <span className="text-gray-300">○</span>}
        </span>
        <span className="min-w-[2em] text-right">
          {right !== null ? right : <span className="text-gray-300">?</span>}
        </span>
      </div>

      {/* Line */}
      <div
        className="border-b-4 border-indigo-600 w-full mt-1"
        style={{ minWidth: `${(maxDigits + 2) * 1.2}em` }}
      />
    </div>
  );
}

interface StepProps {
  step: ScaffoldStep;
  onSubmit: (answer: unknown) => void;
  result: { isCorrect: boolean; pointsEarned: number; hint?: string } | null;
  onTryAgain: () => void;
  attempts?: number;
}

const operators = [
  { value: '+', label: '+', name: 'plus' },
  { value: '-', label: '-', name: 'minus' },
  { value: '×', label: '×', name: 'times' },
  { value: '÷', label: '÷', name: 'divided by' },
];

export default function BuildEquationStep({ step, onSubmit, result, onTryAgain }: StepProps) {
  const [left, setLeft] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [right, setRight] = useState<number | null>(null);

  // Get available numbers from the correct answer or options
  const correctAnswer = step.correct_answer as { left: number; operator: string; right: number };
  const availableNumbers = [correctAnswer.left, correctAnswer.right].filter(
    (n, i, arr) => arr.indexOf(n) === i
  );

  // Add some distractors
  const numbers = [...new Set([
    ...availableNumbers,
    availableNumbers[0] + 2,
    availableNumbers[1] - 1,
  ])].sort((a, b) => a - b);

  const handleSubmit = () => {
    if (left !== null && operator !== null && right !== null) {
      onSubmit({ left, operator, right });
    }
  };

  const handleTryAgain = () => {
    setLeft(null);
    setOperator(null);
    setRight(null);
    onTryAgain();
  };

  const isComplete = left !== null && operator !== null && right !== null;

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

      {/* Vertical preview for addition/subtraction */}
      {(operator === '+' || operator === '-') && (
        <div className="flex justify-center">
          <VerticalEquationPreview left={left} operator={operator} right={right} />
        </div>
      )}

      {/* Equation Builder */}
      <div className="bg-white rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-center gap-4 text-4xl font-bold">
          {/* Left number */}
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center border-4 ${
              left !== null
                ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                : 'bg-gray-100 border-dashed border-gray-300 text-gray-400'
            }`}
          >
            {left !== null ? left : '?'}
          </div>

          {/* Operator */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
              operator !== null
                ? 'bg-orange-100 border-orange-400 text-orange-700'
                : 'bg-gray-100 border-dashed border-gray-300 text-gray-400'
            }`}
          >
            {operator !== null ? operator : '○'}
          </div>

          {/* Right number */}
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center border-4 ${
              right !== null
                ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                : 'bg-gray-100 border-dashed border-gray-300 text-gray-400'
            }`}
          >
            {right !== null ? right : '?'}
          </div>

          {/* Equals */}
          <span className="text-gray-400">=</span>

          {/* Result placeholder */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-yellow-100 border-4 border-yellow-400 text-yellow-700">
            ?
          </div>
        </div>
      </div>

      {/* Number selection */}
      <div className="mb-4">
        <p className="text-gray-600 mb-2">Pick numbers:</p>
        <div className="flex justify-center gap-2">
          {numbers.map((num) => (
            <button
              key={num}
              onClick={() => {
                if (result) return;
                if (left === null) setLeft(num);
                else if (right === null) setRight(num);
              }}
              disabled={!!result || (left !== null && right !== null)}
              className={`w-14 h-14 rounded-xl text-xl font-bold transition-all ${
                left === num || right === num
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white border-2 border-gray-200 hover:border-indigo-300'
              } ${result ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Operator selection */}
      <div className="mb-6">
        <p className="text-gray-600 mb-2">Pick an operation:</p>
        <div className="flex justify-center gap-2">
          {operators.map((op) => (
            <button
              key={op.value}
              onClick={() => !result && setOperator(op.value)}
              disabled={!!result}
              className={`w-14 h-14 rounded-xl text-2xl font-bold transition-all ${
                operator === op.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border-2 border-gray-200 hover:border-orange-300'
              } ${result ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear button */}
      {!result && (left !== null || operator !== null || right !== null) && (
        <button
          onClick={() => {
            setLeft(null);
            setOperator(null);
            setRight(null);
          }}
          className="text-gray-500 hover:text-gray-700 text-sm mb-4"
        >
          Clear and start over
        </button>
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
          disabled={!isComplete}
        >
          Check My Equation
        </Button>
      ) : null}
    </Card>
  );
}

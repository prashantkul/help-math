/**
 * AnnotatableText - Interactive text component for student annotations
 *
 * Allows students to:
 * - Circle numbers by tapping them
 * - Underline important words by tapping them
 *
 * This helps students identify key information in word problems
 */

import { useState, useCallback } from 'react';

interface AnnotatableTextProps {
  text: string;
  className?: string;
  onAnnotationChange?: (annotations: Annotations) => void;
  readOnly?: boolean;
  initialAnnotations?: Annotations;
  showInstructions?: boolean;
}

export interface Annotations {
  circledNumbers: Set<number>; // indices of circled number tokens
  underlinedWords: Set<number>; // indices of underlined word tokens
}

interface Token {
  text: string;
  type: 'number' | 'word' | 'punctuation' | 'space';
  index: number;
}

/**
 * Tokenizes text into words, numbers, punctuation, and spaces
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let currentIndex = 0;

  // Regex to match numbers, words, punctuation, or spaces
  const regex = /(\d+(?:,\d{3})*(?:\.\d+)?)|([a-zA-Z]+(?:'[a-zA-Z]+)?)|([^\s\w])|(\s+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, number, word, punct, space] = match;

    let type: Token['type'];
    if (number) type = 'number';
    else if (word) type = 'word';
    else if (punct) type = 'punctuation';
    else type = 'space';

    tokens.push({
      text: fullMatch,
      type,
      index: currentIndex++,
    });
  }

  return tokens;
}

export default function AnnotatableText({
  text,
  className = '',
  onAnnotationChange,
  readOnly = false,
  initialAnnotations,
  showInstructions = true,
}: AnnotatableTextProps) {
  const [annotations, setAnnotations] = useState<Annotations>(
    initialAnnotations || {
      circledNumbers: new Set<number>(),
      underlinedWords: new Set<number>(),
    }
  );

  const tokens = tokenize(text);

  const handleTokenClick = useCallback(
    (token: Token) => {
      if (readOnly) return;

      setAnnotations((prev) => {
        const newAnnotations = { ...prev };

        if (token.type === 'number') {
          // Toggle circle on numbers
          const newCircled = new Set(prev.circledNumbers);
          if (newCircled.has(token.index)) {
            newCircled.delete(token.index);
          } else {
            newCircled.add(token.index);
          }
          newAnnotations.circledNumbers = newCircled;
        } else if (token.type === 'word') {
          // Toggle underline on words
          const newUnderlined = new Set(prev.underlinedWords);
          if (newUnderlined.has(token.index)) {
            newUnderlined.delete(token.index);
          } else {
            newUnderlined.add(token.index);
          }
          newAnnotations.underlinedWords = newUnderlined;
        }

        onAnnotationChange?.(newAnnotations);
        return newAnnotations;
      });
    },
    [readOnly, onAnnotationChange]
  );

  const clearAnnotations = () => {
    const cleared = {
      circledNumbers: new Set<number>(),
      underlinedWords: new Set<number>(),
    };
    setAnnotations(cleared);
    onAnnotationChange?.(cleared);
  };

  const hasAnnotations =
    annotations.circledNumbers.size > 0 || annotations.underlinedWords.size > 0;

  return (
    <div className={className}>
      {/* Instructions */}
      {showInstructions && !readOnly && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            Tap <span className="font-semibold text-indigo-600">numbers</span> to circle them,{' '}
            <span className="font-semibold text-amber-600">words</span> to underline
          </p>
          {hasAnnotations && (
            <button
              onClick={clearAnnotations}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Annotatable text */}
      <div className="text-xl leading-relaxed">
        {tokens.map((token) => {
          const isCircled = annotations.circledNumbers.has(token.index);
          const isUnderlined = annotations.underlinedWords.has(token.index);
          const isInteractive = !readOnly && (token.type === 'number' || token.type === 'word');

          if (token.type === 'space') {
            return <span key={token.index}>{token.text}</span>;
          }

          if (token.type === 'punctuation') {
            return (
              <span key={token.index} className="text-gray-800">
                {token.text}
              </span>
            );
          }

          return (
            <span
              key={token.index}
              onClick={() => isInteractive && handleTokenClick(token)}
              className={`
                ${isInteractive ? 'cursor-pointer' : ''}
                ${token.type === 'number' && isInteractive ? 'hover:bg-indigo-100 rounded-full px-1 -mx-1' : ''}
                ${token.type === 'word' && isInteractive ? 'hover:underline hover:decoration-amber-400 hover:decoration-2' : ''}
                ${isCircled ? 'bg-indigo-100 border-2 border-indigo-500 rounded-full px-2 py-0.5 -mx-1 text-indigo-700 font-bold' : ''}
                ${isUnderlined ? 'underline decoration-amber-500 decoration-2 underline-offset-4 text-amber-700 font-semibold' : ''}
                transition-all duration-150
              `}
            >
              {token.text}
            </span>
          );
        })}
      </div>

      {/* Summary of annotations */}
      {!readOnly && hasAnnotations && (
        <div className="mt-4 flex flex-wrap gap-2">
          {annotations.circledNumbers.size > 0 && (
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm">
              Numbers: {Array.from(annotations.circledNumbers)
                .map((idx) => tokens[idx]?.text)
                .join(', ')}
            </div>
          )}
          {annotations.underlinedWords.size > 0 && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm">
              Keywords: {Array.from(annotations.underlinedWords)
                .map((idx) => tokens[idx]?.text)
                .join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { tokenize };
export type { Token };

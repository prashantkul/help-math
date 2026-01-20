/**
 * VerticalMath component - displays arithmetic problems vertically
 * Makes it easier for students to do mental math
 *
 * Example: "12 - 5 = ?" displays as:
 *    12
 *  -  5
 *  ----
 */

interface VerticalMathProps {
  expression: string;
  className?: string;
}

interface ParsedExpression {
  left: number;
  operator: string;
  right: number;
}

/**
 * Parses a math expression like "12 - 5 = ?" or "What is 12 - 5?"
 * Returns null if it can't be parsed
 */
function parseExpression(text: string): ParsedExpression | null {
  // Clean up the text - remove common phrases
  let cleanText = text
    .replace(/what is/gi, '')
    .replace(/\?/g, '')
    .replace(/=/g, '')
    .trim();

  // Try to match patterns like "12 - 5", "12 + 5", "12 × 5", "12 ÷ 5"
  // Also handle "12 * 5" and "12 / 5"
  const patterns = [
    /(\d+)\s*([+\-−])\s*(\d+)/, // + or - (including unicode minus)
    /(\d+)\s*([×x*])\s*(\d+)/i, // multiplication
    /(\d+)\s*([÷/])\s*(\d+)/, // division
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      let operator = match[2];
      // Normalize operators
      if (operator === '−') operator = '-';
      if (operator === '*' || operator.toLowerCase() === 'x') operator = '×';
      if (operator === '/') operator = '÷';

      return {
        left: parseInt(match[1], 10),
        operator,
        right: parseInt(match[3], 10),
      };
    }
  }

  return null;
}

/**
 * Checks if an expression is suitable for vertical display
 * - Only addition and subtraction benefit from vertical layout
 * - Both numbers should be reasonably sized (not too many digits)
 */
function shouldDisplayVertically(expr: ParsedExpression): boolean {
  if (expr.operator !== '+' && expr.operator !== '-') {
    return false;
  }
  // Only show vertically for numbers up to 4 digits
  return expr.left < 10000 && expr.right < 10000;
}

export default function VerticalMath({ expression, className = '' }: VerticalMathProps) {
  const parsed = parseExpression(expression);

  // If we can't parse or shouldn't display vertically, return null
  if (!parsed || !shouldDisplayVertically(parsed)) {
    return null;
  }

  const { left, operator, right } = parsed;

  // Calculate the width needed (based on largest number)
  const maxDigits = Math.max(
    left.toString().length,
    right.toString().length
  );

  return (
    <div className={`inline-flex flex-col items-end font-mono text-3xl ${className}`}>
      {/* Top number */}
      <div className="pr-2">
        {left}
      </div>

      {/* Operator and bottom number */}
      <div className="flex items-center">
        <span className="text-indigo-600 mr-2">{operator}</span>
        <span>{right}</span>
      </div>

      {/* Line */}
      <div
        className="border-b-4 border-indigo-600 w-full mt-1"
        style={{ minWidth: `${(maxDigits + 2) * 1.2}em` }}
      />
    </div>
  );
}

// Export the parsing function for use in other components if needed
export { parseExpression, shouldDisplayVertically };
export type { ParsedExpression };

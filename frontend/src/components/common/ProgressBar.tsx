interface ProgressBarProps {
  current: number;
  total: number;
  showSteps?: boolean;
  animated?: boolean;
  className?: string;
}

export default function ProgressBar({
  current,
  total,
  showSteps = true,
  animated = true,
  className = '',
}: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={`w-full ${className}`}>
      {showSteps && (
        <div className="flex justify-between mb-2 text-sm font-medium text-gray-600">
          <span>Step {Math.min(current + 1, total)} of {total}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out ${
            animated ? 'progress-animated' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showSteps && (
        <div className="flex justify-between mt-2">
          {Array.from({ length: total }).map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index < current
                  ? 'bg-green-500'
                  : index === current
                  ? 'bg-indigo-500 ring-4 ring-indigo-200'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

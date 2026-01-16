import { AVATAR_OPTIONS } from '../../types';
import type { AvatarId } from '../../types';

interface AvatarProps {
  avatarId: AvatarId | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

export default function Avatar({
  avatarId,
  size = 'md',
  className = '',
  showBorder = false,
}: AvatarProps) {
  const avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];

  const sizeStyles = {
    sm: 'w-10 h-10 text-2xl',
    md: 'w-14 h-14 text-3xl',
    lg: 'w-20 h-20 text-5xl',
    xl: 'w-28 h-28 text-6xl',
  };

  const borderStyles = showBorder
    ? 'ring-4 ring-indigo-200'
    : '';

  return (
    <div
      className={`${sizeStyles[size]} rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center ${borderStyles} ${className}`}
      role="img"
      aria-label={`${avatar.name} avatar`}
    >
      <span className="select-none">{avatar.emoji}</span>
    </div>
  );
}

interface AvatarSelectorProps {
  selectedId: AvatarId | string;
  onSelect: (id: AvatarId) => void;
}

export function AvatarSelector({ selectedId, onSelect }: AvatarSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {AVATAR_OPTIONS.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => onSelect(avatar.id)}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 ${
            selectedId === avatar.id
              ? 'bg-indigo-100 ring-4 ring-indigo-400 scale-110'
              : 'bg-gray-100 hover:bg-gray-200 hover:scale-105'
          }`}
          aria-label={`Select ${avatar.name}`}
          aria-pressed={selectedId === avatar.id}
        >
          {avatar.emoji}
        </button>
      ))}
    </div>
  );
}

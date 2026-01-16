import { Volume2, VolumeX } from 'lucide-react';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';

interface ReadAloudButtonProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ReadAloudButton({
  text,
  size = 'md',
  className = '',
}: ReadAloudButtonProps) {
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis();

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  const sizeStyles = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };

  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 26,
  };

  return (
    <button
      onClick={handleClick}
      className={`${sizeStyles[size]} rounded-full flex items-center justify-center transition-all duration-200 ${
        isSpeaking
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
      } focus:outline-none focus:ring-4 focus:ring-indigo-300 ${className}`}
      aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
      title={isSpeaking ? 'Stop' : 'Read aloud'}
    >
      {isSpeaking ? (
        <VolumeX size={iconSizes[size]} />
      ) : (
        <Volume2 size={iconSizes[size]} />
      )}
    </button>
  );
}

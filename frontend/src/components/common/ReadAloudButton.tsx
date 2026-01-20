import { Volume2, VolumeX, Loader2 } from 'lucide-react';
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
  const { speak, stop, isSpeaking, isSupported, isLoading } = useSpeechSynthesis();

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isSpeaking || isLoading) {
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
      disabled={isLoading}
      className={`${sizeStyles[size]} rounded-full flex items-center justify-center transition-all duration-200 ${
        isSpeaking
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : isLoading
          ? 'bg-amber-100 text-amber-600'
          : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
      } focus:outline-none focus:ring-4 focus:ring-blue-300 ${className}`}
      aria-label={isSpeaking ? 'Stop reading' : isLoading ? 'Loading...' : 'Read aloud'}
      title={isSpeaking ? 'Stop' : isLoading ? 'Loading...' : 'Read aloud'}
    >
      {isLoading ? (
        <Loader2 size={iconSizes[size]} className="animate-spin" />
      ) : isSpeaking ? (
        <VolumeX size={iconSizes[size]} />
      ) : (
        <Volume2 size={iconSizes[size]} />
      )}
    </button>
  );
}

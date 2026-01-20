import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  isLoading: boolean;
  voices: SpeechSynthesisVoice[];
}

// Simple in-memory cache for audio blobs
const audioCache = new Map<string, string>();

// IndexedDB for persistent caching
const DB_NAME = 'helpmath-tts-cache';
const STORE_NAME = 'audio';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getCachedAudio(text: string): Promise<string | null> {
  // Check memory cache first
  const cacheKey = text.slice(0, 100); // Use first 100 chars as key
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  // Check IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          audioCache.set(cacheKey, result); // Also cache in memory
        }
        resolve(result || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedAudio(text: string, audioUrl: string): Promise<void> {
  const cacheKey = text.slice(0, 100);
  audioCache.set(cacheKey, audioUrl);

  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(audioUrl, cacheKey);
  } catch {
    // Ignore cache errors
  }
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState<boolean | null>(null);
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if ElevenLabs is configured
  useEffect(() => {
    fetch('/api/tts/status')
      .then((res) => res.json())
      .then((data) => setElevenLabsAvailable(data.configured))
      .catch(() => setElevenLabsAvailable(false));
  }, []);

  // Load browser voices as fallback
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported]);

  // Speak using ElevenLabs API
  const speakWithElevenLabs = useCallback(async (text: string) => {
    setIsLoading(true);

    try {
      // Check cache first
      let audioUrl = await getCachedAudio(text);

      if (!audioUrl) {
        // Fetch from API
        const response = await fetch('/api/tts/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error('TTS API failed');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        await setCachedAudio(text, audioUrl);
      }

      // Play audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsLoading(false);
      };
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
      };

      await audio.play();
    } catch (error) {
      console.error('ElevenLabs TTS failed, falling back to browser:', error);
      setIsLoading(false);
      // Fall back to browser TTS
      speakWithBrowser(text);
    }
  }, []);

  // Speak using browser's built-in TTS
  const speakWithBrowser = useCallback((text: string) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const preferredVoice = voices.find(
      (voice) =>
        voice.lang.startsWith('en-US') &&
        (voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('alex') ||
          voice.name.toLowerCase().includes('female'))
    ) || voices.find((voice) => voice.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, voices]);

  // Main speak function - chooses best available method
  const speak = useCallback((text: string) => {
    if (elevenLabsAvailable) {
      speakWithElevenLabs(text);
    } else if (isSupported) {
      speakWithBrowser(text);
    }
  }, [elevenLabsAvailable, isSupported, speakWithElevenLabs, speakWithBrowser]);

  const stop = useCallback(() => {
    // Stop ElevenLabs audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Stop browser TTS
    if (isSupported) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported: isSupported || elevenLabsAvailable === true,
    isLoading,
    voices,
  };
}

export default useSpeechSynthesis;

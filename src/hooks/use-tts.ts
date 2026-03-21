import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Cleans markdown/emoji/symbols from text for natural TTS reading.
 * Splits into sentences for proper intonation and pauses.
 */
function cleanForSpeech(text: string): string {
  let clean = text;

  // Remove markdown headers
  clean = clean.replace(/#{1,6}\s*/g, "");

  // Remove bold/italic markers but keep content
  clean = clean.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  clean = clean.replace(/_([^_]+)_/g, "$1");

  // Remove code blocks and inline code
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // Remove links - keep text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove URLs
  clean = clean.replace(/https?:\/\/\S+/g, "");

  // Remove all emojis
  clean = clean.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu, "");

  // Remove table formatting (pipes, dashes in tables)
  clean = clean.replace(/\|/g, ",");
  clean = clean.replace(/[-]{3,}/g, "");

  // Remove bullet points and list markers
  clean = clean.replace(/^[-•*]\s*/gm, "");
  clean = clean.replace(/^\d+\.\s*/gm, "");

  // Remove blockquote markers
  clean = clean.replace(/^>\s*/gm, "");

  // Remove horizontal rules
  clean = clean.replace(/^---+$/gm, "");
  clean = clean.replace(/^\*\*\*+$/gm, "");

  // Replace special characters that get read literally
  clean = clean.replace(/\//g, " ");
  clean = clean.replace(/\\/g, " ");
  clean = clean.replace(/[<>{}[\]()]/g, "");
  clean = clean.replace(/&/g, " e ");
  clean = clean.replace(/@/g, " arroba ");
  clean = clean.replace(/#/g, "");

  // Clean up whitespace and punctuation
  clean = clean.replace(/\n+/g, ". ");
  clean = clean.replace(/,\s*,/g, ",");
  clean = clean.replace(/\.\s*\./g, ".");
  clean = clean.replace(/\s{2,}/g, " ");
  clean = clean.trim();

  // Remove leading/trailing punctuation artifacts
  clean = clean.replace(/^[.,;:\s]+/, "");
  clean = clean.replace(/[,;\s]+$/, "");

  return clean;
}

/**
 * Splits text into sentence chunks for better TTS intonation.
 * Each chunk should be a natural sentence or short phrase.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries
  const raw = text.split(/(?<=[.!?])\s+/);
  
  const sentences: string[] = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }
  
  return sentences.length > 0 ? sentences : [text];
}

export interface UseTTSOptions {
  enabled: boolean;
  rate?: number;
  lang?: string;
}

export function useTTS({ enabled, rate = 1.35, lang = "pt-BR" }: UseTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceIndexRef = useRef(0);
  const sentencesRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakNextSentence = useCallback(() => {
    if (cancelledRef.current) return;

    const idx = utteranceIndexRef.current;
    const sentences = sentencesRef.current;

    if (idx >= sentences.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentences[idx]);
    utterance.lang = lang;
    utterance.rate = rate;
    // Slightly lower pitch for more natural sound
    utterance.pitch = 0.95;
    
    // Try to find a good Portuguese voice
    const voices = window.speechSynthesis?.getVoices() || [];
    const ptVoice = voices.find(v => 
      v.lang.startsWith("pt") && (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Natural"))
    ) || voices.find(v => v.lang.startsWith("pt"));
    
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      if (cancelledRef.current) return;
      utteranceIndexRef.current = idx + 1;
      // Small delay between sentences for natural pauses
      setTimeout(() => speakNextSentence(), 200);
    };

    utterance.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [lang, rate]);

  const speak = useCallback((text: string) => {
    if (!enabled || !("speechSynthesis" in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    cancelledRef.current = false;

    const cleaned = cleanForSpeech(text);
    const sentences = splitIntoSentences(cleaned);
    
    sentencesRef.current = sentences;
    utteranceIndexRef.current = 0;

    // Ensure voices are loaded
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakNextSentence();
      };
    } else {
      speakNextSentence();
    }
  }, [enabled, speakNextSentence]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (!isSpeaking || isPaused) return;
    window.speechSynthesis?.pause();
    setIsPaused(true);
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    window.speechSynthesis?.resume();
    setIsPaused(false);
  }, [isPaused]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, pause, resume]);

  return {
    speak,
    stop,
    pause,
    resume,
    togglePause,
    isSpeaking,
    isPaused,
  };
}

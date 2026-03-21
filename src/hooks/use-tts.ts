import { useState, useCallback, useRef, useEffect } from "react";
import { cleanForSpeech, splitIntoSpeechChunks } from "@/lib/ttsSpeechFormat";

export interface UseTTSOptions {
  enabled: boolean;
  rate?: number;
  lang?: string;
}

export function useTTS({ enabled, rate = 1.22, lang = "pt-BR" }: UseTTSOptions) {
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
    utterance.pitch = 0.9;
    
    // Try to find a good Portuguese voice
    const voices = window.speechSynthesis?.getVoices() || [];
    // Prefer female Portuguese voices for EVA persona
    const femaleKeywords = ["female", "feminino", "Francisca", "Raquel", "Vitória", "Thalita", "Leila", "Fernanda", "Maria", "Ana"];
    const ptVoices = voices.filter(v => v.lang.startsWith("pt"));
    const femaleVoice = ptVoices.find(v => 
      femaleKeywords.some(k => v.name.toLowerCase().includes(k.toLowerCase()))
    ) || ptVoices.find(v => 
      (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Natural"))
    ) || ptVoices[0];
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      if (cancelledRef.current) return;
      utteranceIndexRef.current = idx + 1;
      const pauseMs = /[!?]$/.test(sentences[idx]) ? 420 : /,$/.test(sentences[idx]) ? 260 : 320;
      setTimeout(() => speakNextSentence(), pauseMs);
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
    const sentences = splitIntoSpeechChunks(cleaned);
    
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

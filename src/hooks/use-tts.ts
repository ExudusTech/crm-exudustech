import { useState, useCallback, useRef, useEffect } from "react";
import { cleanForSpeech, splitIntoSpeechChunks } from "@/lib/ttsSpeechFormat";
import { supabase } from "@/integrations/supabase/client";

export interface UseTTSOptions {
  enabled: boolean;
  lang?: string;
}

export function useTTS({ enabled, lang = "pt-BR" }: UseTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playbackTokenRef = useRef(0);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.onerror = null;
      audio.src = "";
    }

    audioRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const stopCurrentPlayback = useCallback(() => {
    playbackTokenRef.current += 1;
    cleanupAudio();
    resetState();
  }, [cleanupAudio, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentPlayback();
    };
  }, [stopCurrentPlayback]);

  useEffect(() => {
    if (!enabled) {
      stopCurrentPlayback();
    }
  }, [enabled, stopCurrentPlayback]);

  const speak = useCallback((text: string) => {
    if (!enabled) return;

    const cleaned = splitIntoSpeechChunks(cleanForSpeech(text)).join(" ").trim();
    if (!cleaned) return;

    stopCurrentPlayback();
    const currentToken = playbackTokenRef.current;

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-speak`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            text: cleaned,
            lang,
          }),
        });

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (currentToken !== playbackTokenRef.current) return;

        cleanupAudio();

        const audioUrl = URL.createObjectURL(audioBlob);
        objectUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audio.preload = "auto";

        audio.onplay = () => {
          setIsSpeaking(true);
          setIsPaused(false);
        };

        audio.onpause = () => {
          if (!audio.ended && audio.currentTime > 0) {
            setIsPaused(true);
          }
        };

        audio.onended = () => {
          cleanupAudio();
          resetState();
        };

        audio.onerror = () => {
          cleanupAudio();
          resetState();
        };

        audioRef.current = audio;
        await audio.play();
      } catch (error) {
        console.error("[useTTS] playback error", error);
        cleanupAudio();
        resetState();
      }
    })();
  }, [cleanupAudio, enabled, lang, resetState, stopCurrentPlayback]);

  const stop = useCallback(() => {
    stopCurrentPlayback();
  }, [stopCurrentPlayback]);

  const pause = useCallback(() => {
    if (!isSpeaking || isPaused) return;
    audioRef.current?.pause();
    setIsPaused(true);
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().then(() => {
      setIsPaused(false);
      setIsSpeaking(true);
    }).catch((error) => {
      console.error("[useTTS] resume error", error);
      cleanupAudio();
      resetState();
    });
  }, [cleanupAudio, isPaused, resetState]);

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

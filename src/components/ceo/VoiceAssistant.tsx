import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Mic,
  MicOff,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Square,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTTS } from "@/hooks/use-tts";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdEntities?: string[];
}

const sttCorrections: Record<string, string> = {
  senhor: "CEO",
  Senhor: "CEO",
  senhores: "CEO",
  ceo: "CEO",
  "c e o": "CEO",
  "c.e.o": "CEO",
};

function correctTranscript(text: string) {
  let corrected = text;
  for (const [wrong, right] of Object.entries(sttCorrections)) {
    corrected = corrected.replace(new RegExp(`\\b${wrong}\\b`, "gi"), right);
  }
  return corrected;
}

export function VoiceAssistant() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o assistente IA do Sistema CEO. Fale ou digite o que precisa:\n\n- 📝 **Cadastrar** iniciativas, organizações, stakeholders, tarefas, projetos\n- 🔗 **Vincular** entidades entre si\n- 📊 **Consultar** radar, agenda, finanças\n- 📧 **Emails** e 📁 **Drive**\n\nExemplo: *\"Criar projeto HMK IA com prioridade alta\"*",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [startingListening, setStartingListening] = useState(false);
  const [stoppingListening, setStoppingListening] = useState(false);
  const [transcribingAudio, setTranscribingAudio] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldTranscribeOnStopRef = useRef(true);
  const stopFallbackTimeoutRef = useRef<number | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth - 460 : 500,
    y: typeof window !== "undefined" ? window.innerHeight - 520 : 300,
  });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const tts = useTTS({ enabled: voiceEnabled });
  const stopRecognitionRef = useRef<(discardAudio?: boolean) => void>(() => undefined);
  const stopTtsRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearStopFallbackTimeout = useCallback(() => {
    if (stopFallbackTimeoutRef.current !== null) {
      window.clearTimeout(stopFallbackTimeoutRef.current);
      stopFallbackTimeoutRef.current = null;
    }
  }, []);

  const resetRecordingState = useCallback(() => {
    setListening(false);
    setStartingListening(false);
    setStoppingListening(false);
    mediaRecorderRef.current = null;
    clearStopFallbackTimeout();
  }, [clearStopFallbackTimeout]);

  const transcribeRecordedAudio = useCallback(
    async (audioBlob: Blob) => {
      setTranscribingAudio(true);

      try {
        console.info("[VoiceAssistant] Iniciando transcrição", {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        const base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onloadend = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            const encoded = result.split(",")[1];

            if (!encoded) {
              reject(new Error("Falha ao preparar o áudio para transcrição"));
              return;
            }

            resolve(encoded);
          };

          reader.onerror = () => reject(new Error("Falha ao ler o áudio gravado"));
          reader.readAsDataURL(audioBlob);
        });

        const { data, error } = await supabase.functions.invoke("transcribe-voice", {
          body: {
            audio: base64Audio,
            mimeType: audioBlob.type || "audio/webm",
            language: "pt",
          },
        });

        if (error) throw error;

        const transcript = correctTranscript(data?.text || "").trim();

        if (!transcript) {
          toast({
            title: "Não consegui entender o áudio",
            description: "Tente falar mais próximo do microfone.",
            variant: "destructive",
          });
          return;
        }

        setInput((prev) => [prev.trim(), transcript].filter(Boolean).join(prev.trim() ? " " : ""));
      } catch (err: any) {
        console.error("[VoiceAssistant] Falha na transcrição", err);
        toast({
          title: "Erro ao transcrever áudio",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setTranscribingAudio(false);
      }
    },
    [toast],
  );

  const stopRecognition = useCallback(
    (discardAudio = false) => {
      shouldTranscribeOnStopRef.current = !discardAudio;

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resetRecordingState();
        stopMediaStream();
        return;
      }

      setListening(false);
      setStartingListening(false);
      setStoppingListening(true);

      try {
        recorder.requestData?.();
        recorder.stop();
        clearStopFallbackTimeout();
        stopFallbackTimeoutRef.current = window.setTimeout(() => {
          console.warn("[VoiceAssistant] recorder.onstop não disparou a tempo, limpando estado manualmente");
          resetRecordingState();
          stopMediaStream();
        }, 2000);
      } catch {
        resetRecordingState();
        stopMediaStream();
      }
    },
    [clearStopFallbackTimeout, resetRecordingState, stopMediaStream],
  );

  useEffect(() => {
    stopRecognitionRef.current = stopRecognition;
  }, [stopRecognition]);

  useEffect(() => {
    stopTtsRef.current = tts.stop;
  }, [tts.stop]);

  useEffect(() => {
    return () => {
      stopRecognitionRef.current(true);
      stopTtsRef.current();
    };
  }, []);

  useEffect(() => {
    if (open && !maximized) {
      setPosition({
        x: window.innerWidth - 460,
        y: window.innerHeight - 520,
      });
    }
  }, [open, maximized]);

  useEffect(() => {
    if (maximized) setPosition({ x: 0, y: 0 });
  }, [maximized]);

  const onDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (maximized) return;
      e.preventDefault();
      e.stopPropagation();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
      setDragging(true);
    },
    [maximized],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const panelW = panelRef.current?.offsetWidth || 440;
      const panelH = panelRef.current?.offsetHeight || 500;
      const x = Math.max(0, Math.min(window.innerWidth - panelW, clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - panelH, clientY - dragOffset.current.y));
      setPosition({ x, y });
    };

    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);

  const handleMicClick = useCallback(() => {
    if (startingListening || listening || stoppingListening) {
      stopRecognition();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({ title: "Microfone indisponível neste navegador", variant: "destructive" });
      return;
    }

    setStartingListening(true);
    setStoppingListening(false);

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        console.info("[VoiceAssistant] Microfone autorizado");
        mediaStreamRef.current = stream;

        const supportedMimeType = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ].find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType));

        const recorder = supportedMimeType
          ? new MediaRecorder(stream, { mimeType: supportedMimeType })
          : new MediaRecorder(stream);

        audioChunksRef.current = [];
        shouldTranscribeOnStopRef.current = true;
        mediaRecorderRef.current = recorder;

        recorder.onstart = () => {
          console.info("[VoiceAssistant] Gravação iniciada", { mimeType: recorder.mimeType || supportedMimeType || "default" });
          setStartingListening(false);
          setListening(true);
        };

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }

          console.info("[VoiceAssistant] Chunk de áudio recebido", {
            size: event.data.size,
            type: event.data.type,
            totalChunks: audioChunksRef.current.length,
          });
        };

        recorder.onerror = (event) => {
          console.error("[VoiceAssistant] Erro do MediaRecorder", event);
          resetRecordingState();
          stopMediaStream();
          toast({ title: "Falha ao gravar áudio", variant: "destructive" });
        };

        recorder.onstop = async () => {
          clearStopFallbackTimeout();
          const shouldTranscribe = shouldTranscribeOnStopRef.current;
          const chunks = audioChunksRef.current;
          const mimeType = recorder.mimeType || supportedMimeType || "audio/webm";

          audioChunksRef.current = [];
          resetRecordingState();
          stopMediaStream();

          const audioBlob = new Blob(chunks, { type: mimeType });

          console.info("[VoiceAssistant] Gravação finalizada", {
            shouldTranscribe,
            chunks: chunks.length,
            size: audioBlob.size,
            type: mimeType,
          });

          if (!shouldTranscribe) return;
          if (!chunks.length || audioBlob.size === 0) {
            toast({ title: "Nenhum áudio capturado", variant: "destructive" });
            return;
          }

          await transcribeRecordedAudio(audioBlob);
        };

        recorder.start();
      })
      .catch((error: any) => {
        console.error("[VoiceAssistant] Falha ao acessar microfone", error);
        setStartingListening(false);
        setListening(false);
        setStoppingListening(false);
        stopMediaStream();

        const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
        const unavailable = error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";
        const busy = error?.name === "NotReadableError" || error?.name === "TrackStartError";
        toast({
          title: denied
            ? "Permissão do microfone negada"
            : unavailable
              ? "Nenhum microfone foi encontrado"
              : busy
                ? "O microfone já está em uso por outro aplicativo"
                : "Não foi possível acessar o microfone",
          variant: "destructive",
        });
      });
  }, [clearStopFallbackTimeout, listening, resetRecordingState, startingListening, stopMediaStream, stopRecognition, stoppingListening, toast, transcribeRecordedAudio]);

  const sendMessage = useCallback(
    async (text?: string) => {
      if (startingListening || listening || transcribingAudio) return;

      const msg = (text ?? input.trim()).trim();
      if (!msg || loading) return;

      const userMsg: Message = { role: "user", content: msg };
      const updatedMessages = [...messages, userMsg];

      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke("ceo-ai-assistant", {
          body: {
            messages: updatedMessages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role, content: m.content })),
            user_id: user?.id,
          },
        });

        if (error) throw error;

        const reply = data?.reply || "Desculpe, não consegui processar.";
        const createdEntities = data?.created_entities || [];

        if (createdEntities.length > 0) {
          toast({ title: `${createdEntities.length} entidade(s) criada(s)`, description: createdEntities.join(", ") });
        }

        setMessages((prev) => [...prev, { role: "assistant", content: reply, createdEntities }]);
        tts.speak(reply);
      } catch (err: any) {
        const errorMsg = err?.message?.includes("429")
          ? "Muitas requisições. Aguarde."
          : err?.message?.includes("402")
            ? "Créditos esgotados."
            : "Erro ao processar. Tente novamente.";

        setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      } finally {
        setLoading(false);
      }
    },
    [input, listening, loading, messages, startingListening, toast, transcribingAudio, tts, user?.id],
  );

  const isMicActive = listening || startingListening || stoppingListening;
  const canSend = !loading && !transcribingAudio && !isMicActive && !!input.trim();

  const handleSubmit = useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      void sendMessage();
    },
    [sendMessage],
  );

  const triggerButton = (
    <Button
      onClick={() => setOpen(true)}
      size="icon"
      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full h-9 w-9 shadow-lg"
      aria-label="Abrir assistente de voz"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );

  if (!open) return triggerButton;

  const panelStyle: React.CSSProperties = maximized
    ? { position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 9999 }
    : { position: "fixed", left: position.x, top: position.y, width: 440, height: 500, zIndex: 9999 };

  const panel = (
    <>
      {maximized && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" style={{ zIndex: 9998 }} onClick={() => setMaximized(false)} />
      )}
      <div
        ref={panelRef}
        style={panelStyle}
        className={`bg-background border border-border shadow-2xl flex flex-col overflow-hidden ${maximized ? "" : "rounded-xl"}`}
      >
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 select-none ${maximized ? "" : "cursor-grab active:cursor-grabbing"}`}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <div className="flex items-center gap-2">
            {!maximized && <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />}
            <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-destructive-foreground" />
            </div>
            <span className="font-semibold text-xs text-foreground">Assistente CEO</span>
          </div>
          <div className="flex items-center gap-1.5">
            {tts.isSpeaking && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-primary hover:text-primary"
                  onClick={tts.togglePause}
                  title={tts.isPaused ? "Continuar" : "Pausar"}
                >
                  {tts.isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={tts.stop}
                  title="Parar áudio"
                >
                  <Square className="h-3 w-3 fill-current" />
                </Button>
              </>
            )}
            {voiceEnabled ? <Volume2 className="h-3 w-3 text-primary" /> : <VolumeX className="h-3 w-3 text-muted-foreground" />}
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} className="scale-[0.65]" />
            <Label className="text-[9px] text-muted-foreground mr-1">TTS</Label>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMaximized(!maximized)}>
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                stopRecognition(true);
                setOpen(false);
                setMaximized(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3 w-3 text-destructive-foreground" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground shadow-sm"}`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none text-xs prose-p:my-1 prose-ul:my-0.5 prose-li:my-0 prose-h2:text-xs prose-h3:text-xs prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-[10px] prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {msg.createdEntities && msg.createdEntities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {msg.createdEntities.map((e, j) => (
                      <Badge key={j} variant="outline" className="text-[9px]">
                        {e}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {(loading || transcribingAudio) && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center shrink-0">
                <Bot className="h-3 w-3 text-destructive-foreground" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <form className="border-t border-border p-3 flex gap-2 items-end" onSubmit={handleSubmit}>
          <Button
            type="button"
            variant={isMicActive ? "destructive" : "outline"}
            size="icon"
            className={`shrink-0 h-9 w-9 ${isMicActive ? "animate-pulse" : ""}`}
            onClick={handleMicClick}
            disabled={loading || transcribingAudio}
            aria-label={isMicActive ? "Parar gravação" : "Iniciar gravação"}
          >
            {isMicActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            placeholder={
              startingListening
                ? "Ativando microfone..."
                : listening
                  ? "Gravando... clique no microfone para parar"
                  : stoppingListening
                    ? "Finalizando gravação..."
                  : transcribingAudio
                    ? "Transcrevendo áudio..."
                    : "Digite ou fale..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            className="resize-none min-h-[36px] max-h-[80px] text-xs"
            rows={1}
          />
          <Button
            type="submit"
            disabled={!canSend}
            size="icon"
            className="shrink-0 h-9 w-9"
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {triggerButton}
      {createPortal(panel, document.body)}
    </>
  );
}

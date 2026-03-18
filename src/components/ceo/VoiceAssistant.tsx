import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, X, Send, Bot, User, Loader2, Volume2, VolumeX, Maximize2, Minimize2, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdEntities?: string[];
}

// Post-processing corrections for common STT mistakes in pt-BR
const sttCorrections: Record<string, string> = {
  "senhor": "CEO",
  "Senhor": "CEO",
  "senhores": "CEO",
  "ceo": "CEO",
  "c e o": "CEO",
  "c.e.o": "CEO",
};

function correctTranscript(text: string): string {
  let corrected = text;
  for (const [wrong, right] of Object.entries(sttCorrections)) {
    const regex = new RegExp(`\\b${wrong}\\b`, "gi");
    corrected = corrected.replace(regex, right);
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
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (maximized) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    setDragging(true);
  }, [maximized]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const panelW = panelRef.current?.offsetWidth || 400;
      const panelH = panelRef.current?.offsetHeight || 500;
      const x = Math.max(0, Math.min(window.innerWidth - panelW, clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - panelH, clientY - dragOffset.current.y));
      setPosition({ x, y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);

  // Reset position when maximized
  useEffect(() => {
    if (maximized) setPosition(null);
  }, [maximized]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const clean = text.replace(/[#*_`\[\]]/g, "").replace(/\n+/g, ". ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "pt-BR";
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Navegador não suporta reconhecimento de voz", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const corrected = correctTranscript(transcript);
      setInput((prev) => (prev ? prev + " " + corrected : corrected));
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, toast]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
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
        toast({
          title: `${createdEntities.length} entidade(s) criada(s)`,
          description: createdEntities.join(", "),
        });
      }

      const assistantMsg: Message = { role: "assistant", content: reply, createdEntities };
      setMessages((prev) => [...prev, assistantMsg]);
      speak(reply);
    } catch (err: any) {
      const errorMsg = err?.message?.includes("429")
        ? "Muitas requisições. Aguarde um momento."
        : err?.message?.includes("402")
        ? "Créditos esgotados."
        : "Erro ao processar. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full h-9 w-9 shadow-lg"
        aria-label="Abrir assistente de voz"
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  const panelStyle: React.CSSProperties = maximized
    ? { position: "fixed", inset: 0, width: "100%", height: "100%", borderRadius: 0 }
    : position
    ? { position: "fixed", left: position.x, top: position.y, width: "28rem", maxWidth: "calc(100vw - 1rem)" }
    : { position: "fixed", bottom: "1rem", right: "1rem", width: "28rem", maxWidth: "calc(100vw - 1rem)" };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop only when maximized */}
      {maximized && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setMaximized(false)} />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={panelStyle}
        className={`z-10 bg-background border border-border shadow-2xl flex flex-col overflow-hidden pointer-events-auto ${
          maximized ? "" : "rounded-xl"
        } ${maximized ? "h-full" : "h-[70vh] max-h-[600px]"}`}
      >
        {/* Header - draggable */}
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 select-none ${
            maximized ? "" : "cursor-grab active:cursor-grabbing"
          }`}
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
            {voiceEnabled ? (
              <Volume2 className="h-3 w-3 text-primary" />
            ) : (
              <VolumeX className="h-3 w-3 text-muted-foreground" />
            )}
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} className="scale-[0.65]" />
            <Label className="text-[9px] text-muted-foreground mr-1">TTS</Label>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMaximized(!maximized)}>
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); setMaximized(false); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3 w-3 text-destructive-foreground" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none text-xs prose-table:w-full prose-table:text-[10px] prose-th:bg-primary/10 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border-b prose-td:border-border/50 prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-2 prose-h2:text-xs prose-h2:mt-2 prose-h2:mb-1 prose-h3:text-xs prose-h3:mt-2 prose-h3:mb-0.5 prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-[10px] prose-code:before:content-none prose-code:after:content-none prose-p:my-1 prose-ul:my-0.5 prose-li:my-0">
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
          {loading && (
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

        {/* Input area */}
        <div className="border-t border-border p-3 flex gap-2 items-end">
          <Button
            variant={listening ? "destructive" : "outline"}
            size="icon"
            className={`shrink-0 h-9 w-9 ${listening ? "animate-pulse" : ""}`}
            onClick={toggleListening}
            disabled={loading}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            placeholder={listening ? "Ouvindo..." : "Digite ou fale..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="resize-none min-h-[36px] max-h-[80px] text-xs"
            rows={1}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            size="icon"
            className="shrink-0 h-9 w-9"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

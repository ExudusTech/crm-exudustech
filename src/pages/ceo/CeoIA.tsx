import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Send, User, Loader2, Volume2, VolumeX, Plus, Calendar, DollarSign, ListTodo, Radar, Mail, HardDrive, MessageSquare, Square, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTTS } from "@/hooks/use-tts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdEntities?: string[];
}

const quickCommands = [
  { icon: Radar, label: "Radar completo", prompt: "Me dê um panorama completo do radar estratégico da ExudusTech agora." },
  { icon: ListTodo, label: "Tarefas atrasadas", prompt: "Quais tarefas estão atrasadas ou bloqueadas?" },
  { icon: Calendar, label: "Agenda da semana", prompt: "Me mostre minha agenda da semana do Google Calendar." },
  { icon: Mail, label: "Emails importantes", prompt: "Quais emails importantes recebi hoje no Gmail?" },
  { icon: HardDrive, label: "Arquivos recentes", prompt: "Liste os arquivos mais recentes do meu Google Drive." },
  { icon: DollarSign, label: "Como está o caixa", prompt: "Como está o caixa da empresa?" },
  { icon: Plus, label: "Cadastrar iniciativa", prompt: "Quero cadastrar uma nova iniciativa." },
  { icon: MessageSquare, label: "Enviar WhatsApp", prompt: "Quero enviar uma mensagem por WhatsApp." },
];

const CeoIA = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente IA do Sistema CEO. Posso ajudar com:\n\n- 📊 **Análises estratégicas** e resumos\n- 📝 **Cadastrar entidades** (iniciativas, organizações, stakeholders, tarefas)\n- 📅 **Consultar e gerenciar sua agenda** (Google Calendar)\n- 📧 **Ler e enviar emails** (Gmail)\n- 📁 **Acessar arquivos** (Google Drive)\n- 💬 **Enviar WhatsApp** via CRM\n- 🔗 **Vincular entidades** entre si\n- 💰 **Analisar finanças**\n\nDigite sua solicitação ou use os atalhos abaixo." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const tts = useTTS({ enabled: voiceEnabled });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // TTS is now handled by useTTS hook

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
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({ role: m.role, content: m.content })),
          user_id: user?.id,
        },
      });

      if (error) throw error;

      const reply = data?.reply || "Desculpe, não consegui processar.";
      const spokenReply = data?.spoken_reply || reply;
      const createdEntities = data?.created_entities || [];

      if (createdEntities.length > 0) {
        toast({
          title: `${createdEntities.length} entidade(s) criada(s)`,
          description: createdEntities.join(", "),
        });
      }

      const assistantMsg: Message = { role: "assistant", content: reply, createdEntities };
      setMessages(prev => [...prev, assistantMsg]);
      tts.speak(spokenReply);
    } catch (err: any) {
      const errorMsg = err?.message?.includes("429")
        ? "Muitas requisições. Aguarde um momento e tente novamente."
        : err?.message?.includes("402")
        ? "Créditos esgotados. Adicione créditos na configuração."
        : "Erro ao processar. Tente novamente.";
      setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">IA / Assistente CEO</h1>
          <p className="text-muted-foreground text-sm">Cadastro assistido, consultas e análises estratégicas</p>
        </div>
        <div className="flex items-center gap-2">
          {tts.isSpeaking && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={tts.togglePause} title={tts.isPaused ? "Continuar" : "Pausar"}>
                {tts.isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={tts.stop} title="Parar áudio">
                <Square className="h-4 w-4 fill-current" />
              </Button>
            </>
          )}
          {voiceEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          <Label className="text-xs text-muted-foreground">Voz</Label>
        </div>
      </div>

      {/* Quick commands */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quickCommands.map((cmd, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => sendMessage(cmd.prompt)}
            disabled={loading}
          >
            <cmd.icon className="h-3 w-3 mr-1" />
            {cmd.label}
          </Button>
        ))}
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground shadow-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-table:w-full prose-table:text-xs prose-th:bg-primary/10 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-td:px-3 prose-td:py-1.5 prose-td:border-b prose-td:border-border/50 prose-table:border prose-table:border-border/50 prose-table:rounded-lg prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1 prose-hr:border-border/50 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  {msg.createdEntities && msg.createdEntities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.createdEntities.map((e, j) => (
                        <Badge key={j} variant="outline" className="text-[10px]">{e}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-4 flex gap-2">
            <Textarea
              placeholder="Digite sua mensagem... (ex: 'Cadastrar iniciativa HMK IA com André como stakeholder')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              className="resize-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoIA;

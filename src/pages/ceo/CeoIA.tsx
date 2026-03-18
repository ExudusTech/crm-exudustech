import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CeoIA = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente IA do Sistema CEO. Posso ajudar com análises estratégicas, resumos de iniciativas, sugestões de próximos passos e mais. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Fetch context data for the AI
      const [initiatives, tasks, orgs] = await Promise.all([
        (supabase as any).from("initiatives").select("name, status, priority, next_action, main_risk").eq("status", "ativo").limit(10),
        (supabase as any).from("ceo_tasks").select("title, status, priority, deadline, responsible").in("status", ["todo", "doing", "bloqueado"]).limit(15),
        (supabase as any).from("organizations").select("name, type, status").eq("status", "ativo").limit(10),
      ]);

      const context = `
Contexto atual do CEO:
- Iniciativas ativas: ${JSON.stringify(initiatives.data || [])}
- Tarefas pendentes: ${JSON.stringify(tasks.data || [])}
- Organizações ativas: ${JSON.stringify(orgs.data || [])}
      `.trim();

      const { data, error } = await supabase.functions.invoke("generate-whatsapp-message", {
        body: {
          prompt: `Você é um assistente executivo de CEO de uma empresa de tecnologia chamada ExudusTech. 
Responda em português brasileiro, de forma objetiva e estratégica.

${context}

Histórico da conversa:
${updatedMessages.map((m) => `${m.role === "user" ? "CEO" : "Assistente"}: ${m.content}`).join("\n")}

Responda à última mensagem do CEO de forma útil e estratégica.`,
        },
      });

      const reply = data?.message || data?.reply || "Desculpe, não consegui processar sua solicitação no momento.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao processar. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">IA / Assistente CEO</h1>
        <p className="text-muted-foreground text-sm">Área conversacional do sistema</p>
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
                <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.content}
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
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              className="resize-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CeoIA;

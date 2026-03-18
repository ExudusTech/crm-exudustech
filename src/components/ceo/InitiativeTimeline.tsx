import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, MessageSquare, Brain, Zap, Lightbulb, BookOpen, AlertTriangle, Plus,
  ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from "lucide-react";

// Types for the timeline entries
type EntryType = "all" | "atualizacao" | "conversa" | "interpretacao" | "acao" | "decisao" | "licao" | "lacuna";

interface TimelineEntry {
  id: string;
  type: EntryType;
  created_at: string;
  title?: string;
  content: string;
  source?: string;
  author?: string;
  metadata?: Record<string, any>;
}

const filterLabels: Record<EntryType, string> = {
  all: "Tudo",
  atualizacao: "Atualizações",
  conversa: "Conversas",
  interpretacao: "Interpretações",
  acao: "Ações",
  decisao: "Decisões",
  licao: "Lições",
  lacuna: "Lacunas",
};

const typeConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  atualizacao: { icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Atualização" },
  reuniao: { icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Reunião" },
  marco: { icon: Clock, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", label: "Marco" },
  conversa: { icon: MessageSquare, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", label: "Conversa" },
  interpretacao: { icon: Brain, color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", label: "Interpretação IA" },
  acao: { icon: Zap, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Ação gerada" },
  decisao: { icon: Lightbulb, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Decisão" },
  licao: { icon: BookOpen, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", label: "Lição aprendida" },
  lacuna: { icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Lacuna detectada" },
};

const borderColors: Record<string, string> = {
  atualizacao: "border-l-blue-500",
  reuniao: "border-l-blue-500",
  marco: "border-l-purple-500",
  conversa: "border-l-indigo-500",
  interpretacao: "border-l-violet-500",
  acao: "border-l-green-500",
  decisao: "border-l-amber-500",
  licao: "border-l-teal-500",
  lacuna: "border-l-red-500",
};

interface Props {
  initiativeId: string;
  history: any[];
  decisions: any[];
  lessons: any[];
  conversations: any[];
  interpretations: any[];
  actions: any[];
  gaps: any[];
  onRefresh: () => void;
}

export default function InitiativeTimeline({
  initiativeId, history, decisions, lessons,
  conversations, interpretations, actions, gaps, onRefresh,
}: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<EntryType>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"atualizacao" | "conversa">("atualizacao");
  const [form, setForm] = useState({ title: "", content: "", entry_type: "atualizacao", source: "manual", author: "" });
  const [convForm, setConvForm] = useState({ content: "", raw_user_message: "", raw_ai_response: "", source: "chatgpt", author: "" });

  // Build unified timeline
  const entries: TimelineEntry[] = [];

  history.forEach(h => entries.push({
    id: `h-${h.id}`, type: ["atualizacao", "reuniao", "marco", "decisao"].includes(h.entry_type) ? h.entry_type : "atualizacao",
    created_at: h.created_at, title: h.title, content: h.content,
    source: h.source, author: h.author, metadata: h,
  }));

  decisions.forEach(d => entries.push({
    id: `d-${d.id}`, type: "decisao", created_at: d.decided_at || d.created_at,
    title: d.title, content: d.description || "",
    source: "manual", metadata: { impact: d.impact, decided_by: d.decided_by, ...d },
  }));

  lessons.forEach(l => entries.push({
    id: `l-${l.id}`, type: "licao", created_at: l.created_at,
    title: l.title, content: l.description || "",
    metadata: { category: l.category, ...l },
  }));

  conversations.forEach(c => entries.push({
    id: `c-${c.id}`, type: "conversa", created_at: c.created_at,
    title: `Conversa — ${c.source || "manual"}`, content: c.content,
    source: c.source, author: c.author,
    metadata: { raw_user_message: c.raw_user_message, raw_ai_response: c.raw_ai_response, mentioned_entities: c.mentioned_entities },
  }));

  interpretations.forEach(i => entries.push({
    id: `i-${i.id}`, type: "interpretacao", created_at: i.created_at,
    title: i.detected_intent || "Interpretação da IA",
    content: i.notes || "",
    metadata: { detected_entities: i.detected_entities, detected_themes: i.detected_themes, suggested_actions: i.suggested_actions, confidence: i.confidence },
  }));

  actions.forEach(a => entries.push({
    id: `a-${a.id}`, type: "acao", created_at: a.created_at,
    title: a.action_type === "outro" ? "Ação" : a.action_type,
    content: a.description,
    metadata: { action_type: a.action_type, status: a.status, result_entity_type: a.result_entity_type },
  }));

  gaps.forEach(g => entries.push({
    id: `g-${g.id}`, type: "lacuna", created_at: g.created_at,
    title: g.resolved ? "Lacuna resolvida" : "Lacuna pendente",
    content: g.description,
    metadata: { severity: g.severity, resolved: g.resolved },
  }));

  // Sort desc
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter
  const filtered = filter === "all" ? entries : entries.filter(e => e.type === filter);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openDialog = (type: "atualizacao" | "conversa") => {
    setDialogType(type);
    if (type === "atualizacao") setForm({ title: "", content: "", entry_type: "atualizacao", source: "manual", author: "" });
    else setConvForm({ content: "", raw_user_message: "", raw_ai_response: "", source: "chatgpt", author: "" });
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    if (dialogType === "atualizacao") {
      if (!form.content.trim()) return;
      const { error } = await (supabase as any).from("initiative_history").insert({
        initiative_id: initiativeId,
        title: form.title || null,
        content: form.content,
        entry_type: form.entry_type,
        source: form.source || "manual",
        author: form.author || null,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      if (!convForm.content.trim()) return;
      const { error } = await (supabase as any).from("initiative_conversations").insert({
        initiative_id: initiativeId,
        content: convForm.content,
        raw_user_message: convForm.raw_user_message || null,
        raw_ai_response: convForm.raw_ai_response || null,
        source: convForm.source || "manual",
        author: convForm.author || null,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Registrado com sucesso" });
    setDialogOpen(false);
    onRefresh();
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const renderMetadata = (entry: TimelineEntry) => {
    const meta = entry.metadata;
    if (!meta) return null;
    const items: JSX.Element[] = [];

    if (entry.type === "decisao") {
      if (meta.impact) items.push(<p key="impact" className="text-xs"><span className="font-semibold">Impacto:</span> {meta.impact}</p>);
      if (meta.decided_by) items.push(<p key="by" className="text-xs"><span className="font-semibold">Decidido por:</span> {meta.decided_by}</p>);
    }
    if (entry.type === "licao" && meta.category) {
      items.push(<Badge key="cat" variant="outline" className="text-xs">{meta.category}</Badge>);
    }
    if (entry.type === "conversa") {
      if (meta.raw_user_message) items.push(
        <div key="user" className="mt-2 bg-muted/50 rounded p-2 text-xs">
          <p className="font-semibold mb-1">👤 Usuário:</p>
          <p className="whitespace-pre-wrap">{meta.raw_user_message}</p>
        </div>
      );
      if (meta.raw_ai_response) items.push(
        <div key="ai" className="mt-1 bg-primary/5 rounded p-2 text-xs">
          <p className="font-semibold mb-1">🤖 IA:</p>
          <p className="whitespace-pre-wrap">{meta.raw_ai_response}</p>
        </div>
      );
      if (meta.mentioned_entities?.length > 0) items.push(
        <div key="ent" className="flex gap-1 flex-wrap mt-1">
          {(meta.mentioned_entities as string[]).map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}
        </div>
      );
    }
    if (entry.type === "interpretacao") {
      if (meta.detected_themes?.length > 0) items.push(
        <div key="themes" className="flex gap-1 flex-wrap">
          <span className="text-xs font-semibold mr-1">Temas:</span>
          {(meta.detected_themes as string[]).map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}
        </div>
      );
      if (meta.detected_entities?.length > 0) items.push(
        <div key="dent" className="flex gap-1 flex-wrap">
          <span className="text-xs font-semibold mr-1">Entidades:</span>
          {(meta.detected_entities as string[]).map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}
        </div>
      );
      if (meta.suggested_actions?.length > 0) items.push(
        <div key="sug" className="text-xs mt-1">
          <span className="font-semibold">Ações sugeridas:</span>
          <ul className="list-disc list-inside ml-2">
            {(meta.suggested_actions as string[]).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      );
      if (meta.confidence != null) items.push(
        <p key="conf" className="text-xs mt-1"><span className="font-semibold">Confiança:</span> {Math.round(meta.confidence * 100)}%</p>
      );
    }
    if (entry.type === "acao") {
      if (meta.action_type) items.push(<p key="at" className="text-xs"><span className="font-semibold">Tipo:</span> {meta.action_type}</p>);
      if (meta.status) items.push(
        <Badge key="st" variant="outline" className={`text-xs ${meta.status === "executada" ? "border-green-500 text-green-700" : ""}`}>
          {meta.status === "executada" ? "✅ Executada" : meta.status === "pendente" ? "⏳ Pendente" : meta.status}
        </Badge>
      );
    }
    if (entry.type === "lacuna") {
      const sev = meta.severity as string;
      const sevColors: Record<string, string> = { alta: "border-red-500 text-red-700", media: "border-amber-500 text-amber-700", baixa: "border-green-500 text-green-700" };
      const sevLabels: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
      items.push(<Badge key="sev" variant="outline" className={`text-xs ${sevColors[sev] || ""}`}>{sevLabels[sev] || sev}</Badge>);
      items.push(
        <Badge key="res" variant="outline" className={`text-xs ${meta.resolved ? "border-green-500 text-green-700" : "border-red-500 text-red-700"}`}>
          {meta.resolved ? <><CheckCircle2 className="h-3 w-3 mr-1 inline" /> Resolvida</> : <><XCircle className="h-3 w-3 mr-1 inline" /> Pendente</>}
        </Badge>
      );
    }

    return items.length > 0 ? <div className="space-y-1 mt-2">{items}</div> : null;
  };

  const totalCount = entries.length;
  const filterCounts: Partial<Record<EntryType, number>> = {};
  entries.forEach(e => { filterCounts[e.type] = (filterCounts[e.type] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => openDialog("conversa")}>
          <MessageSquare className="h-4 w-4 mr-1" /> Registrar Conversa
        </Button>
        <Button size="sm" variant="outline" onClick={() => openDialog("atualizacao")}>
          <Plus className="h-4 w-4 mr-1" /> Registrar Atualização
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as EntryType[]).map(key => {
          const count = key === "all" ? totalCount : (filterCounts[key] || 0);
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {filterLabels[key]} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado para este filtro.</p>
          ) : (
            <div className="space-y-0">
              {filtered.map((entry) => {
                const config = typeConfig[entry.type] || typeConfig.atualizacao;
                const Icon = config.icon;
                const isExpanded = expandedIds.has(entry.id);
                const hasDetails = entry.content?.length > 120 || entry.metadata;
                const borderColor = borderColors[entry.type] || "border-l-primary";

                return (
                  <div
                    key={entry.id}
                    className={`border-l-[3px] ${borderColor} pl-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer`}
                    onClick={() => hasDetails && toggleExpand(entry.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] px-1.5 py-0 ${config.color}`}>{config.label}</Badge>
                            <span className="text-[11px] text-muted-foreground">{formatDate(entry.created_at)}</span>
                            {entry.source && entry.source !== "manual" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.source}</Badge>
                            )}
                            {entry.author && (
                              <span className="text-[11px] text-muted-foreground">· {entry.author}</span>
                            )}
                          </div>
                          {entry.title && <p className="font-medium text-sm mt-0.5">{entry.title}</p>}
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {isExpanded ? entry.content : entry.content?.slice(0, 120) + (entry.content?.length > 120 ? "..." : "")}
                          </p>
                          {isExpanded && entry.content?.length > 120 && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{entry.content}</p>
                          )}
                          {isExpanded && renderMetadata(entry)}
                        </div>
                      </div>
                      {hasDetails && (
                        <button className="shrink-0 text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogType === "atualizacao" ? "Registrar Atualização" : "Registrar Conversa"}</DialogTitle>
          </DialogHeader>
          {dialogType === "atualizacao" ? (
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.entry_type} onValueChange={v => setForm({ ...form, entry_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atualizacao">Atualização</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="marco">Marco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Origem</Label><Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="manual" /></div>
                <div><Label>Autor</Label><Input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="Nome" /></div>
              </div>
              <div><Label>Título (opcional)</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Conteúdo *</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} /></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Origem</Label>
                  <Select value={convForm.source} onValueChange={v => setConvForm({ ...convForm, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chatgpt">ChatGPT</SelectItem>
                      <SelectItem value="sistema_ceo">Sistema CEO</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Autor</Label><Input value={convForm.author} onChange={e => setConvForm({ ...convForm, author: e.target.value })} placeholder="Nome" /></div>
              </div>
              <div><Label>Resumo da conversa *</Label><Textarea value={convForm.content} onChange={e => setConvForm({ ...convForm, content: e.target.value })} rows={3} placeholder="Resumo do que foi discutido..." /></div>
              <div><Label>Fala do usuário (opcional)</Label><Textarea value={convForm.raw_user_message} onChange={e => setConvForm({ ...convForm, raw_user_message: e.target.value })} rows={3} placeholder="Mensagem original do usuário..." /></div>
              <div><Label>Resposta da IA (opcional)</Label><Textarea value={convForm.raw_ai_response} onChange={e => setConvForm({ ...convForm, raw_ai_response: e.target.value })} rows={3} placeholder="Resposta original da IA..." /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEntry} disabled={dialogType === "atualizacao" ? !form.content.trim() : !convForm.content.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

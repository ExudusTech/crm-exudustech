import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Edit2, Plus, Trash2, Download, FileText, Copy, CheckSquare,
  Users, Server, DollarSign, Clock, Puzzle, BookOpen, Lightbulb,
} from "lucide-react";
import {
  CeoStatus, PriorityLevel, ceoStatusLabels, priorityLabels,
  priorityColors, statusColors, taskStatusLabels, taskStatusColors,
} from "@/types/ceo";

const fmt = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const CeoInitiativeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [initiative, setInitiative] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [infra, setInfra] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [relatedOrgs, setRelatedOrgs] = useState<{ main?: any; partner?: any; pilot?: any }>({});
  const [relatedProjects, setRelatedProjects] = useState<any[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [relatedAsset, setRelatedAsset] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  // History entry dialog
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyForm, setHistoryForm] = useState({ title: "", content: "", entry_type: "atualizacao" });

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [ini, t, sh, doc, inf, rev, exp, hist, dec, les, mod, projects] = await Promise.all([
      (supabase as any).from("initiatives").select("*").eq("id", id).single(),
      (supabase as any).from("ceo_tasks").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("initiative_stakeholders").select("*, stakeholders(*)").eq("initiative_id", id),
      (supabase as any).from("ceo_documents").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("infrastructures").select("*").eq("initiative_id", id),
      (supabase as any).from("revenues").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("expenses").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("initiative_history").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("decisions").select("*").eq("initiative_id", id).order("decided_at", { ascending: false }),
      (supabase as any).from("lessons_learned").select("*").eq("initiative_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("module_usages").select("*, modules(*)").eq("used_in_initiative_id", id),
      (supabase as any).from("projects").select("*, products(id, name, status)").eq("initiative_id", id),
    ]);
    if (ini.data) {
      setInitiative(ini.data);
      setForm(ini.data);
      // Fetch related orgs
      const orgs: any = {};
      if (ini.data.organization_id) {
        const { data: o } = await (supabase as any).from("organizations").select("*").eq("id", ini.data.organization_id).single();
        if (o) orgs.main = o;
      }
      if (ini.data.partner_organization_id) {
        const { data: o } = await (supabase as any).from("organizations").select("*").eq("id", ini.data.partner_organization_id).single();
        if (o) orgs.partner = o;
      }
      if (ini.data.pilot_organization_id) {
        const { data: o } = await (supabase as any).from("organizations").select("*").eq("id", ini.data.pilot_organization_id).single();
        if (o) orgs.pilot = o;
      }
      setRelatedOrgs(orgs);
      // Fetch strategic asset
      if (ini.data.strategic_asset_id) {
        const { data: a } = await (supabase as any).from("strategic_assets").select("*").eq("id", ini.data.strategic_asset_id).single();
        if (a) setRelatedAsset(a);
      } else {
        setRelatedAsset(null);
      }
    }
    setTasks(t.data || []);
    setStakeholders(sh.data || []);
    setDocuments(doc.data || []);
    setInfra(inf.data || []);
    setRevenues(rev.data || []);
    setExpenses(exp.data || []);
    setHistory(hist.data || []);
    setDecisions(dec.data || []);
    setLessons(les.data || []);
    setModules(mod.data || []);
    setRelatedProjects(projects.data || []);
    // Collect unique products from projects
    const prods = (projects.data || []).filter((p: any) => p.products).map((p: any) => p.products);
    const uniqueProds = prods.filter((p: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === p.id) === i);
    setRelatedProducts(uniqueProds);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveInitiative = async () => {
    const { id: _id, created_at, updated_at, ...rest } = form;
    const { error } = await (supabase as any).from("initiatives").update(rest).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvo" });
    setEditing(false);
    fetchAll();
  };

  const addHistoryEntry = async () => {
    if (!historyForm.content.trim()) return;
    const { error } = await (supabase as any).from("initiative_history").insert({
      initiative_id: id,
      ...historyForm,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Registrado" });
    setHistoryDialog(false);
    setHistoryForm({ title: "", content: "", entry_type: "atualizacao" });
    fetchAll();
  };

  const exportContext = (format: "json" | "markdown" | "txt") => {
    const ctx = {
      initiative,
      tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, deadline: t.deadline })),
      stakeholders: stakeholders.map(s => ({ name: s.stakeholders?.name, role: s.role })),
      documents: documents.map(d => ({ name: d.name, type: d.doc_type })),
      revenues: revenues.map(r => ({ description: r.description, expected: r.expected_amount, received: r.received_amount })),
      expenses: expenses.map(e => ({ description: e.description, amount: e.amount })),
      history: history.map(h => ({ date: h.created_at, type: h.entry_type, title: h.title, content: h.content })),
      decisions: decisions.map(d => ({ title: d.title, impact: d.impact, date: d.decided_at })),
      lessons: lessons.map(l => ({ title: l.title, description: l.description })),
    };

    let content = "";
    let ext = format;
    if (format === "json") {
      content = JSON.stringify(ctx, null, 2);
    } else if (format === "markdown") {
      ext = "md" as any;
      content = `# ${initiative?.name}\n\n`;
      content += `**Status:** ${ceoStatusLabels[initiative?.status as CeoStatus] || initiative?.status}\n`;
      content += `**Prioridade:** ${priorityLabels[initiative?.priority as PriorityLevel] || "—"}\n\n`;
      content += `## Descrição\n${initiative?.description || "—"}\n\n`;
      content += `## Tarefas (${tasks.length})\n${tasks.map(t => `- [${t.status}] ${t.title}`).join("\n") || "Nenhuma"}\n\n`;
      content += `## Decisões\n${decisions.map(d => `- ${d.title}: ${d.impact || ""}`).join("\n") || "Nenhuma"}\n\n`;
      content += `## Lições\n${lessons.map(l => `- ${l.title}: ${l.description || ""}`).join("\n") || "Nenhuma"}\n`;
    } else {
      content = `INICIATIVA: ${initiative?.name}\nStatus: ${initiative?.status}\nPrioridade: ${initiative?.priority || "—"}\nDescrição: ${initiative?.description || "—"}\n\n`;
      content += `TAREFAS:\n${tasks.map(t => `  - [${t.status}] ${t.title}`).join("\n") || "  Nenhuma"}\n`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${initiative?.name || "iniciativa"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exportado como .${ext}` });
  };

  if (loading) return <div className="p-6"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-[400px] w-full" /></div>;
  if (!initiative) return <div className="p-6 text-center text-muted-foreground">Iniciativa não encontrada.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ceo/iniciativas")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{initiative.name}</h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <Badge className={statusColors[initiative.status as CeoStatus]}>{ceoStatusLabels[initiative.status as CeoStatus]}</Badge>
            {initiative.priority && <Badge className={priorityColors[initiative.priority as PriorityLevel]}>{priorityLabels[initiative.priority as PriorityLevel]}</Badge>}
            {initiative.short_name && <Badge variant="outline">{initiative.short_name}</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}><Edit2 className="h-4 w-4 mr-1" /> {editing ? "Cancelar" : "Editar"}</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders ({stakeholders.length})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="infra">Infraestrutura ({infra.length})</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="history">Histórico ({history.length + decisions.length + lessons.length})</TabsTrigger>
          <TabsTrigger value="modules">Módulos ({modules.length})</TabsTrigger>
          <TabsTrigger value="export">Exportar</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6 space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Sigla</Label><Input value={form.short_name || ""} onChange={e => setForm({ ...form, short_name: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Prioridade</Label>
                      <Select value={form.priority || "media"} onValueChange={v => setForm({ ...form, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Descrição</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Potencial</Label><Input value={form.potential || ""} onChange={e => setForm({ ...form, potential: e.target.value })} /></div>
                    <div><Label>Risco Principal</Label><Input value={form.main_risk || ""} onChange={e => setForm({ ...form, main_risk: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Próxima Ação</Label><Input value={form.next_action || ""} onChange={e => setForm({ ...form, next_action: e.target.value })} /></div>
                    <div><Label>Prazo</Label><Input type="date" value={form.deadline || ""} onChange={e => setForm({ ...form, deadline: e.target.value || null })} /></div>
                  </div>
                  <div><Label>Notas Estratégicas</Label><Textarea value={form.strategic_notes || ""} onChange={e => setForm({ ...form, strategic_notes: e.target.value })} rows={2} /></div>
                  <Button onClick={saveInitiative}>Salvar</Button>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{initiative.description || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Potencial</p><p className="text-sm">{initiative.potential || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risco Principal</p><p className="text-sm">{initiative.main_risk || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Próxima Ação</p><p className="text-sm">{initiative.next_action || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Prazo</p><p className="text-sm">{initiative.deadline || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Notas Estratégicas</p><p className="text-sm">{initiative.strategic_notes || "—"}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAREFAS */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Tarefas</CardTitle>
              <Button size="sm" onClick={() => navigate("/ceo/tarefas")}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa vinculada.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead>Prazo</TableHead><TableHead>Responsável</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tasks.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell><Badge className={taskStatusColors[t.status as keyof typeof taskStatusColors]}>{taskStatusLabels[t.status as keyof typeof taskStatusLabels]}</Badge></TableCell>
                        <TableCell>{t.priority && <Badge className={priorityColors[t.priority as PriorityLevel]}>{priorityLabels[t.priority as PriorityLevel]}</Badge>}</TableCell>
                        <TableCell className="text-sm">{t.deadline || "—"}</TableCell>
                        <TableCell className="text-sm">{t.responsible || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAKEHOLDERS */}
        <TabsContent value="stakeholders">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Stakeholders</CardTitle></CardHeader>
            <CardContent>
              {stakeholders.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum stakeholder vinculado.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Papel</TableHead><TableHead>Cargo</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stakeholders.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.stakeholders?.name || "—"}</TableCell>
                        <TableCell>{s.role || "—"}</TableCell>
                        <TableCell>{s.stakeholders?.role_title || "—"}</TableCell>
                        <TableCell className="text-sm">{s.stakeholders?.email || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento vinculado.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {documents.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INFRAESTRUTURA */}
        <TabsContent value="infra">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Infraestrutura</CardTitle></CardHeader>
            <CardContent>
              {infra.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum ativo técnico vinculado.</p> : (
                <div className="space-y-3">
                  {infra.map(i => (
                    <div key={i.id} className="border rounded-md p-3">
                      <p className="font-medium">{i.name}</p>
                      {i.stack && <p className="text-sm text-muted-foreground">Stack: {i.stack}</p>}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {i.url_production && <Badge variant="outline" className="text-xs">Produção</Badge>}
                        {i.github_url && <Badge variant="outline" className="text-xs">GitHub</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCEIRO */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /> Receitas ({revenues.length})</CardTitle></CardHeader>
              <CardContent>
                {revenues.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma receita.</p> : revenues.map(r => (
                  <div key={r.id} className="flex justify-between border-b py-2 last:border-0">
                    <span className="text-sm">{r.description || "—"}</span>
                    <span className="text-sm font-medium">{fmt(r.expected_amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-destructive" /> Despesas ({expenses.length})</CardTitle></CardHeader>
              <CardContent>
                {expenses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma despesa.</p> : expenses.map(e => (
                  <div key={e.id} className="flex justify-between border-b py-2 last:border-0">
                    <span className="text-sm">{e.description || "—"}</span>
                    <span className="text-sm font-medium text-destructive">{fmt(e.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HISTÓRICO + DECISÕES + LIÇÕES */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setHistoryDialog(true)}><Plus className="h-4 w-4 mr-1" /> Registrar Atualização</Button>
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Atualizações</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atualização.</p> : (
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="border-l-2 border-primary pl-4 py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{h.entry_type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {h.title && <p className="font-medium text-sm">{h.title}</p>}
                      <p className="text-sm text-muted-foreground">{h.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decisions */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Decisões</CardTitle></CardHeader>
            <CardContent>
              {decisions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhuma decisão registrada.</p> : (
                <div className="space-y-2">
                  {decisions.map(d => (
                    <div key={d.id} className="border rounded-md p-3">
                      <p className="font-medium text-sm">{d.title}</p>
                      {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                      {d.impact && <p className="text-xs mt-1"><span className="font-medium">Impacto:</span> {d.impact}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(d.decided_at).toLocaleDateString("pt-BR")} · {d.decided_by || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lessons */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Lições Aprendidas</CardTitle></CardHeader>
            <CardContent>
              {lessons.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lição registrada.</p> : (
                <div className="space-y-2">
                  {lessons.map(l => (
                    <div key={l.id} className="border rounded-md p-3">
                      <p className="font-medium text-sm">{l.title}</p>
                      {l.description && <p className="text-sm text-muted-foreground">{l.description}</p>}
                      {l.category && <Badge variant="outline" className="text-xs mt-1">{l.category}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MÓDULOS */}
        <TabsContent value="modules">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Puzzle className="h-4 w-4" /> Módulos Relacionados</CardTitle></CardHeader>
            <CardContent>
              {modules.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum módulo vinculado.</p> : (
                <div className="space-y-2">
                  {modules.map(m => (
                    <div key={m.id} className="border rounded-md p-3">
                      <p className="font-medium text-sm">{m.modules?.name || "—"}</p>
                      {m.adaptation_notes && <p className="text-sm text-muted-foreground">{m.adaptation_notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPORTAR CONTEXTO */}
        <TabsContent value="export">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Contexto Exportável</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Exporte todo o contexto desta iniciativa em diferentes formatos.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => exportContext("json")}><Copy className="h-4 w-4 mr-2" /> JSON</Button>
                <Button variant="outline" onClick={() => exportContext("markdown")}><FileText className="h-4 w-4 mr-2" /> Markdown</Button>
                <Button variant="outline" onClick={() => exportContext("txt")}><FileText className="h-4 w-4 mr-2" /> TXT</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Entry Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Atualização</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <Select value={historyForm.entry_type} onValueChange={v => setHistoryForm({ ...historyForm, entry_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atualizacao">Atualização</SelectItem>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="decisao">Decisão</SelectItem>
                  <SelectItem value="marco">Marco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Título (opcional)</Label><Input value={historyForm.title} onChange={e => setHistoryForm({ ...historyForm, title: e.target.value })} /></div>
            <div><Label>Conteúdo *</Label><Textarea value={historyForm.content} onChange={e => setHistoryForm({ ...historyForm, content: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialog(false)}>Cancelar</Button>
            <Button onClick={addHistoryEntry} disabled={!historyForm.content.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CeoInitiativeDetail;

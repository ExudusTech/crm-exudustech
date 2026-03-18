import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { useToast } from "@/hooks/use-toast";
import { CeoStatus, PriorityLevel, ceoStatusLabels, priorityLabels, priorityColors, statusColors } from "@/types/ceo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Trash2, Target, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { EntitySelector, MultiEntitySelector } from "@/components/ceo/EntitySelector";

interface Initiative {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  status: CeoStatus;
  priority: PriorityLevel | null;
  potential: string | null;
  main_risk: string | null;
  next_action: string | null;
  deadline: string | null;
  strategic_notes: string | null;
  organization_id: string | null;
  partner_organization_id: string | null;
  pilot_organization_id: string | null;
  strategic_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

const organizationTypeOptions = [
  { value: "cliente", label: "Cliente" },
  { value: "parceiro", label: "Parceiro" },
  { value: "piloto", label: "Piloto" },
  { value: "instituicao", label: "Instituição" },
  { value: "organizacao_mae", label: "Org. Mãe" },
  { value: "unidade", label: "Unidade" },
  { value: "interno", label: "Interno" },
];

const stakeholderTypeOptions = [
  { value: "decisor", label: "Decisor" },
  { value: "operacional", label: "Operacional" },
  { value: "tecnico", label: "Técnico" },
  { value: "comercial", label: "Comercial" },
  { value: "aprovador", label: "Aprovador" },
  { value: "consultor", label: "Consultor" },
  { value: "outro", label: "Outro" },
];

const emptyItem: Partial<Initiative> = {
  name: "", short_name: "", description: "", status: "ativo", priority: "media",
  potential: "", main_risk: "", next_action: "", strategic_notes: "",
  organization_id: null, partner_organization_id: null, pilot_organization_id: null,
  strategic_asset_id: null,
};

const CeoIniciativas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, fetch: refetch, insert, update, remove } = useCeoTable<Initiative>("initiatives");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Initiative>>(emptyItem);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Relational state for creation
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  const [stakeholderRoles, setStakeholderRoles] = useState<Record<string, string>>({});
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);

  // Section visibility
  const [showOrgs, setShowOrgs] = useState(true);
  const [showStakeholders, setShowStakeholders] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const filtered = data.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const openCreate = () => {
    setEditing({ ...emptyItem });
    setSelectedStakeholders([]);
    setStakeholderRoles({});
    setLinkedProjectId(null);
    setLinkedProductId(null);
    setShowOrgs(true);
    setShowStakeholders(false);
    setShowProducts(false);
    setShowPreview(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;

    try {
      let initiativeId: string;

      if (editing.id) {
        // Update existing
        const { id, created_at, updated_at, ...rest } = editing as Initiative;
        await update(id, rest);
        initiativeId = id;
      } else {
        // Create new
        const { id, created_at, updated_at, ...rest } = editing as any;
        const { data: newIni, error } = await (supabase as any).from("initiatives").insert(rest).select("id").single();
        if (error) {
          toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
          return;
        }
        initiativeId = newIni.id;
      }

      // Create stakeholder links
      if (selectedStakeholders.length > 0 && !editing.id) {
        const links = selectedStakeholders.map(sid => ({
          initiative_id: initiativeId,
          stakeholder_id: sid,
          role: stakeholderRoles[sid] || null,
        }));
        await (supabase as any).from("initiative_stakeholders").insert(links);
      }

      // Link project to initiative
      if (linkedProjectId && !editing.id) {
        await (supabase as any).from("projects").update({ initiative_id: initiativeId }).eq("id", linkedProjectId);
      }

      // Link product via project or note
      if (linkedProductId && linkedProjectId && !editing.id) {
        await (supabase as any).from("projects").update({ product_id: linkedProductId }).eq("id", linkedProjectId);
      }

      toast({ title: editing.id ? "Atualizado com sucesso" : "Iniciativa criada com vínculos" });
      await refetch();
      setDialogOpen(false);

      // Navigate to detail if new
      if (!editing.id) {
        navigate(`/ceo/iniciativas/${initiativeId}`);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Names lookup for preview
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [stakeholderNames, setStakeholderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (supabase as any).from("organizations").select("id, name").then(({ data: d }: any) => {
      const map: Record<string, string> = {};
      (d || []).forEach((o: any) => { map[o.id] = o.name; });
      setOrgNames(map);
    });
    (supabase as any).from("stakeholders").select("id, name").then(({ data: d }: any) => {
      const map: Record<string, string> = {};
      (d || []).forEach((s: any) => { map[s.id] = s.name; });
      setStakeholderNames(map);
    });
  }, [dialogOpen]);

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

  const SectionToggle = ({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      {label}
    </button>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-6 w-6" /> Iniciativas</h1>
          <p className="text-muted-foreground text-sm">Guarda-chuvas executivos do que está sendo feito.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Iniciativa</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Próxima Ação</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma iniciativa encontrada.</TableCell></TableRow>
            ) : filtered.map(item => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/ceo/iniciativas/${item.id}`)}>
                <TableCell>
                  <p className="font-medium">{item.name}</p>
                  {item.short_name && <p className="text-xs text-muted-foreground">{item.short_name}</p>}
                </TableCell>
                <TableCell><Badge className={statusColors[item.status]}>{ceoStatusLabels[item.status]}</Badge></TableCell>
                <TableCell>{item.priority && <Badge className={priorityColors[item.priority]}>{priorityLabels[item.priority]}</Badge>}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{item.next_action || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.deadline || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => navigate(`/ceo/iniciativas/${item.id}`)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* RELATIONAL CREATION DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Iniciativa" : "Nova Iniciativa — Cadastro Relacional"}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              {/* BLOCO 1 — Dados principais */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Dados da Iniciativa</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label>Sigla</Label><Input value={editing.short_name || ""} onChange={e => setEditing(p => ({ ...p, short_name: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Status</Label>
                      <Select value={editing.status} onValueChange={v => setEditing(p => ({ ...p, status: v as CeoStatus }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Prioridade</Label>
                      <Select value={editing.priority || "media"} onValueChange={v => setEditing(p => ({ ...p, priority: v as PriorityLevel }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Prazo</Label><Input type="date" value={editing.deadline || ""} onChange={e => setEditing(p => ({ ...p, deadline: e.target.value || null }))} /></div>
                  <div><Label>Descrição</Label><Textarea value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Potencial</Label><Input value={editing.potential || ""} onChange={e => setEditing(p => ({ ...p, potential: e.target.value }))} /></div>
                    <div><Label>Risco Principal</Label><Input value={editing.main_risk || ""} onChange={e => setEditing(p => ({ ...p, main_risk: e.target.value }))} /></div>
                  </div>
                  <div><Label>Próxima Ação</Label><Input value={editing.next_action || ""} onChange={e => setEditing(p => ({ ...p, next_action: e.target.value }))} /></div>
                  <div><Label>Notas Estratégicas</Label><Textarea value={editing.strategic_notes || ""} onChange={e => setEditing(p => ({ ...p, strategic_notes: e.target.value }))} rows={2} /></div>
                </div>
              </div>

              <Separator />

              {/* BLOCO 2 — Organizações */}
              <div>
                <SectionToggle label="Organizações Relacionadas" open={showOrgs} onToggle={() => setShowOrgs(!showOrgs)} />
                {showOrgs && (
                  <div className="space-y-3 pl-1">
                    <EntitySelector
                      label="Organização Principal"
                      tableName="organizations"
                      value={editing.organization_id || null}
                      onChange={v => setEditing(p => ({ ...p, organization_id: v }))}
                      inlineFields={[{ key: "type", label: "Tipo", type: "select", options: organizationTypeOptions }]}
                    />
                    <EntitySelector
                      label="Parceiro"
                      tableName="organizations"
                      value={editing.partner_organization_id || null}
                      onChange={v => setEditing(p => ({ ...p, partner_organization_id: v }))}
                      inlineFields={[{ key: "type", label: "Tipo", type: "select", options: organizationTypeOptions }]}
                    />
                    <EntitySelector
                      label="Cliente Piloto"
                      tableName="organizations"
                      value={editing.pilot_organization_id || null}
                      onChange={v => setEditing(p => ({ ...p, pilot_organization_id: v }))}
                      inlineFields={[{ key: "type", label: "Tipo", type: "select", options: organizationTypeOptions }]}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* BLOCO 3 — Stakeholders */}
              <div>
                <SectionToggle label="Stakeholders" open={showStakeholders} onToggle={() => setShowStakeholders(!showStakeholders)} />
                {showStakeholders && (
                  <div className="pl-1">
                    <MultiEntitySelector
                      label="Stakeholders vinculados"
                      tableName="stakeholders"
                      selectedIds={selectedStakeholders}
                      onChange={setSelectedStakeholders}
                      inlineFields={[
                        { key: "role_title", label: "Cargo" },
                        { key: "email", label: "Email" },
                        { key: "phone", label: "Telefone" },
                        { key: "stakeholder_type", label: "Tipo", type: "select", options: stakeholderTypeOptions },
                      ]}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* BLOCO 4 — Produto / Projeto / Ativo */}
              <div>
                <SectionToggle label="Produto / Projeto / Ativo" open={showProducts} onToggle={() => setShowProducts(!showProducts)} />
                {showProducts && (
                  <div className="space-y-3 pl-1">
                    <EntitySelector
                      label="Ativo Estratégico"
                      tableName="strategic_assets"
                      value={editing.strategic_asset_id || null}
                      onChange={v => setEditing(p => ({ ...p, strategic_asset_id: v }))}
                      inlineFields={[{ key: "description", label: "Descrição" }]}
                    />
                    <EntitySelector
                      label="Projeto vinculado"
                      tableName="projects"
                      value={linkedProjectId}
                      onChange={setLinkedProjectId}
                      inlineFields={[{ key: "responsible", label: "Responsável" }]}
                    />
                    <EntitySelector
                      label="Produto vinculado"
                      tableName="products"
                      value={linkedProductId}
                      onChange={setLinkedProductId}
                      inlineFields={[{ key: "category", label: "Categoria" }]}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* BLOCO 5 — Preview */}
              <div>
                <SectionToggle label="Preview do cadastro" open={showPreview} onToggle={() => setShowPreview(!showPreview)} />
                {showPreview && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-4 text-sm space-y-2">
                      <p><strong>Iniciativa:</strong> {editing.name || "—"} {editing.short_name ? `(${editing.short_name})` : ""}</p>
                      <p><strong>Status:</strong> {ceoStatusLabels[editing.status as CeoStatus] || "—"} · <strong>Prioridade:</strong> {priorityLabels[editing.priority as PriorityLevel] || "—"}</p>
                      {editing.organization_id && <p><strong>Org. Principal:</strong> {orgNames[editing.organization_id] || editing.organization_id}</p>}
                      {editing.partner_organization_id && <p><strong>Parceiro:</strong> {orgNames[editing.partner_organization_id] || editing.partner_organization_id}</p>}
                      {editing.pilot_organization_id && <p><strong>Piloto:</strong> {orgNames[editing.pilot_organization_id] || editing.pilot_organization_id}</p>}
                      {selectedStakeholders.length > 0 && (
                        <p><strong>Stakeholders ({selectedStakeholders.length}):</strong> {selectedStakeholders.map(id => stakeholderNames[id] || id).join(", ")}</p>
                      )}
                      {linkedProjectId && <p><strong>Projeto vinculado:</strong> ✓</p>}
                      {linkedProductId && <p><strong>Produto vinculado:</strong> ✓</p>}
                      {editing.strategic_asset_id && <p><strong>Ativo estratégico:</strong> ✓</p>}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>
              {editing.id ? "Salvar" : "Criar Iniciativa com Vínculos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir iniciativa?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoIniciativas;

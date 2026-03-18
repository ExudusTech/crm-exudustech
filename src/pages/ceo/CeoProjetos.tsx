import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { CeoStatus, PriorityLevel, ceoStatusLabels, priorityLabels, priorityColors, statusColors } from "@/types/ceo";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Trash2, FolderKanban, Edit2 } from "lucide-react";
import { EntitySelector } from "@/components/ceo/EntitySelector";
import { RelatedEntities } from "@/components/ceo/RelatedEntities";

interface Project {
  id: string; name: string; initiative_id: string | null; product_id: string | null;
  responsible: string | null; status: CeoStatus; priority: PriorityLevel | null;
  start_date: string | null; end_date: string | null; scope_summary: string | null;
  main_risk: string | null; next_action: string | null; notes: string | null;
  created_at: string; updated_at: string;
}

const emptyItem: Partial<Project> = {
  name: "", status: "ativo", priority: "media", responsible: "", scope_summary: "",
  main_risk: "", next_action: "", notes: "", initiative_id: null, product_id: null,
};

const CeoProjetos = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Project>("projects");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Project>>(emptyItem);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  // Names for display
  const [iniNames, setIniNames] = useState<Record<string, string>>({});
  useEffect(() => {
    (supabase as any).from("initiatives").select("id, name").then(({ data: d }: any) => {
      const map: Record<string, string> = {};
      (d || []).forEach((i: any) => { map[i.id] = i.name; });
      setIniNames(map);
    });
  }, []);

  const filtered = data.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const openCreate = () => { setEditing({ ...emptyItem }); setDialogOpen(true); };
  const openEdit = (item: Project) => { setEditing({ ...item }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...rest } = editing as Project;
      await update(id, rest);
    } else {
      const { id, created_at, updated_at, ...rest } = editing as any;
      await insert(rest);
    }
    setDialogOpen(false);
  };

  const selectedProj = data.find(p => p.id === detailId);

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FolderKanban className="h-6 w-6" /> Projetos</h1>
          <p className="text-muted-foreground text-sm">Esforços operacionais delimitados no tempo.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Projeto</Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={detailId ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Iniciativa</TableHead><TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead><TableHead>Prioridade</TableHead><TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum projeto encontrado.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer hover:bg-accent/50 ${detailId === item.id ? "bg-muted/50" : ""}`}
                    onClick={() => setDetailId(detailId === item.id ? null : item.id)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.initiative_id ? iniNames[item.initiative_id] || "—" : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.responsible || "—"}</TableCell>
                    <TableCell><Badge className={statusColors[item.status]}>{ceoStatusLabels[item.status]}</Badge></TableCell>
                    <TableCell>{item.priority && <Badge className={priorityColors[item.priority]}>{priorityLabels[item.priority]}</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {detailId && selectedProj && (
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg">{selectedProj.name}</h3>
                <Badge className={`mt-1 ${statusColors[selectedProj.status]}`}>{ceoStatusLabels[selectedProj.status]}</Badge>
                {selectedProj.responsible && <p className="text-sm mt-2">Responsável: {selectedProj.responsible}</p>}
                {selectedProj.scope_summary && <p className="text-sm text-muted-foreground mt-2">{selectedProj.scope_summary}</p>}
                {selectedProj.start_date && <p className="text-sm mt-1">Início: {selectedProj.start_date}</p>}
                {selectedProj.end_date && <p className="text-sm">Fim: {selectedProj.end_date}</p>}
              </CardContent>
            </Card>
            <RelatedEntities entityType="project" entityId={detailId} />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Projeto" : "Novo Projeto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
            <EntitySelector label="Iniciativa vinculada" tableName="initiatives" value={editing.initiative_id || null} onChange={v => setEditing(p => ({ ...p, initiative_id: v }))} />
            <EntitySelector label="Produto vinculado" tableName="products" value={editing.product_id || null} onChange={v => setEditing(p => ({ ...p, product_id: v }))} />
            <div><Label>Responsável</Label><Input value={editing.responsible || ""} onChange={e => setEditing(p => ({ ...p, responsible: e.target.value }))} /></div>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Início</Label><Input type="date" value={editing.start_date || ""} onChange={e => setEditing(p => ({ ...p, start_date: e.target.value || null }))} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={editing.end_date || ""} onChange={e => setEditing(p => ({ ...p, end_date: e.target.value || null }))} /></div>
            </div>
            <div><Label>Escopo Resumido</Label><Textarea value={editing.scope_summary || ""} onChange={e => setEditing(p => ({ ...p, scope_summary: e.target.value }))} rows={2} /></div>
            <div><Label>Risco Principal</Label><Input value={editing.main_risk || ""} onChange={e => setEditing(p => ({ ...p, main_risk: e.target.value }))} /></div>
            <div><Label>Próxima Ação</Label><Input value={editing.next_action || ""} onChange={e => setEditing(p => ({ ...p, next_action: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir projeto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoProjetos;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, Edit2, Trash2, Target } from "lucide-react";

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

const emptyItem: Partial<Initiative> = {
  name: "", short_name: "", description: "", status: "ativo", priority: "media",
  potential: "", main_risk: "", next_action: "", strategic_notes: "",
};

const CeoIniciativas = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Initiative>("initiatives");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Initiative>>(emptyItem);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = data.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const openCreate = () => { setEditing({ ...emptyItem }); setDialogOpen(true); };
  const openEdit = (item: Initiative) => { setEditing({ ...item }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...rest } = editing as Initiative;
      await update(id, rest);
    } else {
      const { id, created_at, updated_at, ...rest } = editing as any;
      await insert(rest);
    }
    setDialogOpen(false);
  };

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

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
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma iniciativa encontrada.</TableCell></TableRow>
            ) : filtered.map(item => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openEdit(item)}>
                <TableCell>
                  <p className="font-medium">{item.name}</p>
                  {item.short_name && <p className="text-xs text-muted-foreground">{item.short_name}</p>}
                </TableCell>
                <TableCell><Badge className={statusColors[item.status]}>{ceoStatusLabels[item.status]}</Badge></TableCell>
                <TableCell>{item.priority && <Badge className={priorityColors[item.priority]}>{priorityLabels[item.priority]}</Badge>}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{item.next_action || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.deadline || "—"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Iniciativa" : "Nova Iniciativa"}</DialogTitle></DialogHeader>
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
            <div><Label>Potencial</Label><Input value={editing.potential || ""} onChange={e => setEditing(p => ({ ...p, potential: e.target.value }))} /></div>
            <div><Label>Risco Principal</Label><Input value={editing.main_risk || ""} onChange={e => setEditing(p => ({ ...p, main_risk: e.target.value }))} /></div>
            <div><Label>Próxima Ação</Label><Input value={editing.next_action || ""} onChange={e => setEditing(p => ({ ...p, next_action: e.target.value }))} /></div>
            <div><Label>Notas Estratégicas</Label><Textarea value={editing.strategic_notes || ""} onChange={e => setEditing(p => ({ ...p, strategic_notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>Salvar</Button>
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

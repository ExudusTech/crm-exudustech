import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
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
import { Plus, Search, Trash2, FileText, AlertTriangle } from "lucide-react";

type FinancialStatus = "pendente" | "pago" | "recebido" | "atrasado" | "cancelado" | "parcial";

interface FiscalObligation {
  id: string;
  obligation_type: string;
  competence: string | null;
  due_date: string | null;
  amount: number | null;
  status: FinancialStatus | null;
  receipt_storage_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<FinancialStatus, string> = {
  pendente: "Pendente", pago: "Pago", recebido: "Recebido", atrasado: "Atrasado", cancelado: "Cancelado", parcial: "Parcial",
};

const statusColors: Record<FinancialStatus, string> = {
  pendente: "bg-yellow-500 text-white",
  pago: "bg-green-600 text-white",
  recebido: "bg-green-600 text-white",
  atrasado: "bg-destructive text-destructive-foreground",
  cancelado: "bg-muted text-muted-foreground",
  parcial: "bg-orange-500 text-white",
};

const obligationTypes = ["DAS", "INSS", "IRPJ", "IRPF", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "Outro"];

const emptyItem: Partial<FiscalObligation> = {
  obligation_type: "DAS", competence: "", due_date: null, amount: null, status: "pendente", notes: "",
};

const CeoFiscal = () => {
  const { data, loading, insert, update, remove } = useCeoTable<FiscalObligation>("fiscal_obligations");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<FiscalObligation>>(emptyItem);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = data.filter(i => {
    if (search && !i.obligation_type.toLowerCase().includes(search.toLowerCase()) && !i.competence?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterType !== "all" && i.obligation_type !== filterType) return false;
    return true;
  }).sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });

  const pendentes = data.filter(i => i.status === "pendente" || i.status === "atrasado");
  const totalPendente = pendentes.reduce((s, i) => s + (i.amount || 0), 0);
  const vencidas = data.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status === "pendente");

  const openCreate = () => { setEditing({ ...emptyItem }); setDialogOpen(true); };
  const openEdit = (item: FiscalObligation) => { setEditing({ ...item }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.obligation_type?.trim()) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...rest } = editing as FiscalObligation;
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6" /> Fiscal</h1>
          <p className="text-muted-foreground text-sm">Gestão fiscal e contábil.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Obrigação</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Pendente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Obrigações Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{pendentes.length}</p></CardContent>
        </Card>
        <Card className={vencidas.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
            {vencidas.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />} Vencidas
          </CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${vencidas.length > 0 ? "text-destructive" : "text-foreground"}`}>{vencidas.length}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {obligationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma obrigação encontrada.</TableCell></TableRow>
            ) : filtered.map(item => {
              const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status === "pendente";
              return (
                <TableRow key={item.id} className={`cursor-pointer hover:bg-accent/50 ${isOverdue ? "bg-destructive/5" : ""}`} onClick={() => openEdit(item)}>
                  <TableCell className="font-medium">{item.obligation_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.competence || "—"}</TableCell>
                  <TableCell className={`text-sm ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{item.due_date || "—"}</TableCell>
                  <TableCell className="text-sm">R$ {(item.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge className={statusColors[item.status || "pendente"]}>{statusLabels[item.status || "pendente"]}</Badge></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Obrigação" : "Nova Obrigação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo *</Label>
                <Select value={editing.obligation_type || "DAS"} onValueChange={v => setEditing(p => ({ ...p, obligation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{obligationTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={editing.status || "pendente"} onValueChange={v => setEditing(p => ({ ...p, status: v as FinancialStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Competência</Label><Input value={editing.competence || ""} onChange={e => setEditing(p => ({ ...p, competence: e.target.value }))} placeholder="ex: 03/2026" /></div>
              <div><Label>Vencimento</Label><Input type="date" value={editing.due_date || ""} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} /></div>
            </div>
            <div><Label>Valor</Label><Input type="number" value={editing.amount ?? ""} onChange={e => setEditing(p => ({ ...p, amount: e.target.value ? Number(e.target.value) : null }))} /></div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.obligation_type?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir obrigação?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoFiscal;

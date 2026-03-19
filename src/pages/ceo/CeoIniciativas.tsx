import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { CeoStatus, PriorityLevel, ceoStatusLabels, priorityLabels, priorityColors, statusColors } from "@/types/ceo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Trash2, Target, Eye } from "lucide-react";

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

const CeoIniciativas = () => {
  const navigate = useNavigate();
  const { data, loading, remove } = useCeoTable<Initiative>("initiatives");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = data.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <div className="p-4 md:p-6 max-w-7xl mx-auto"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2"><Target className="h-5 w-5 sm:h-6 sm:w-6" /> Iniciativas</h1>
          <p className="text-muted-foreground text-sm">Guarda-chuvas executivos do que está sendo feito.</p>
        </div>
        <Button onClick={() => navigate("/ceo/iniciativas/nova")} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Nova Iniciativa</Button>
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

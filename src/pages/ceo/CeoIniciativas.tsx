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
import { Plus, Search, Trash2, Target, Eye, Calendar, ArrowRight, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const { data, loading, remove } = useCeoTable<Initiative>("initiatives");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = data.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  if (loading) return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 md:px-6 py-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" /> Iniciativas
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Guarda-chuvas executivos do que está sendo feito.</p>
          </div>
          <Button onClick={() => navigate("/ceo/iniciativas/nova")} className="w-full sm:w-auto" size={isMobile ? "sm" : "default"}>
            <Plus className="h-4 w-4 mr-2" /> Nova Iniciativa
          </Button>
        </div>

        <div className="flex gap-2 max-w-7xl mx-auto w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] sm:w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Nenhuma iniciativa encontrada.</div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-3">
              {filtered.map(item => (
                <Card
                  key={item.id}
                  className="relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-150 hover:shadow-md group"
                  onClick={() => navigate(`/ceo/iniciativas/${item.id}`)}
                >
                  {/* Priority accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    item.priority === 'critica' ? 'bg-destructive' :
                    item.priority === 'alta' ? 'bg-orange-500' :
                    item.priority === 'media' ? 'bg-primary' :
                    'bg-muted'
                  }`} />

                  <div className="pl-4 pr-3 py-3 space-y-2.5">
                    {/* Row 1: Name + delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight truncate">
                          {item.short_name || item.name}
                        </p>
                        {item.short_name && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.name}</p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Row 2: Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`${statusColors[item.status]} text-[10px] px-2 py-0.5`}>
                        {ceoStatusLabels[item.status]}
                      </Badge>
                      {item.priority && (
                        <Badge className={`${priorityColors[item.priority]} text-[10px] px-2 py-0.5`}>
                          {priorityLabels[item.priority]}
                        </Badge>
                      )}
                    </div>

                    {/* Row 3: Next action */}
                    {item.next_action && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                        <span className="line-clamp-2">{item.next_action}</span>
                      </div>
                    )}

                    {/* Row 4: Deadline + risk */}
                    <div className="flex items-center justify-between gap-2">
                      {item.deadline ? (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{item.deadline}</span>
                        </div>
                      ) : <span />}
                      {item.main_risk && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-500">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="truncate max-w-[140px]">{item.main_risk}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Desktop: Table layout */
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
                  {filtered.map(item => (
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
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir iniciativa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoIniciativas;

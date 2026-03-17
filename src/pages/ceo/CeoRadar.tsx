import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import {
  StrategicAsset, StrategicAssetType, CeoStatus, PriorityLevel,
  assetTypeLabels, ceoStatusLabels, priorityLabels, priorityColors, statusColors,
} from "@/types/ceo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Edit2, Trash2, Radar, LayoutGrid, List, Columns3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const emptyAsset: Partial<StrategicAsset> = {
  name: "", short_name: "", asset_type: "ideia", description: "",
  status: "em_analise", priority: "media", potential: "", main_risk: "",
  next_action: "", strategic_notes: "",
};

const CeoRadar = () => {
  const { data, loading, insert, update, remove } = useCeoTable<StrategicAsset>("strategic_assets");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<StrategicAsset>>(emptyAsset);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const filtered = data.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && a.asset_type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterPriority !== "all" && a.priority !== filterPriority) return false;
    return true;
  });

  const openCreate = () => { setEditing({ ...emptyAsset }); setDialogOpen(true); };
  const openEdit = (asset: StrategicAsset) => { setEditing({ ...asset }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    const isEdit = !!editing.id;
    const { id, created_at, updated_at, ...payload } = editing as any;
    const success = isEdit
      ? await update(editing.id!, payload)
      : await insert(payload);
    if (success) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await remove(deleteId);
      setDeleteId(null);
    }
  };

  const kanbanStatuses: CeoStatus[] = ["em_analise", "ativo", "pausado", "concluido", "cancelado", "arquivado"];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="h-6 w-6" /> Radar Estratégico
          </h1>
          <p className="text-muted-foreground text-sm">Visão executiva de todos os itens do ecossistema</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Item</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(assetTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Views */}
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table"><List className="h-4 w-4 mr-1" /> Tabela</TabsTrigger>
          <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4 mr-1" /> Cards</TabsTrigger>
          <TabsTrigger value="kanban"><Columns3 className="h-4 w-4 mr-1" /> Kanban</TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum item encontrado</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Próxima Ação</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((asset) => (
                    <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(asset)}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell><Badge variant="outline">{assetTypeLabels[asset.asset_type]}</Badge></TableCell>
                      <TableCell><Badge className={statusColors[asset.status]}>{ceoStatusLabels[asset.status]}</Badge></TableCell>
                      <TableCell>{asset.priority && <Badge className={priorityColors[asset.priority]}>{priorityLabels[asset.priority]}</Badge>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{asset.next_action || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(asset)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(asset.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Cards View */}
        <TabsContent value="cards">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum item encontrado</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((asset) => (
                <Card key={asset.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(asset)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold leading-tight">{asset.name}</CardTitle>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteId(asset.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{assetTypeLabels[asset.asset_type]}</Badge>
                      <Badge className={`text-xs ${statusColors[asset.status]}`}>{ceoStatusLabels[asset.status]}</Badge>
                      {asset.priority && <Badge className={`text-xs ${priorityColors[asset.priority]}`}>{priorityLabels[asset.priority]}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {asset.description && <p className="text-muted-foreground line-clamp-2">{asset.description}</p>}
                    {asset.next_action && (
                      <div>
                        <span className="text-xs font-medium text-foreground">Próxima ação: </span>
                        <span className="text-xs text-muted-foreground">{asset.next_action}</span>
                      </div>
                    )}
                    {asset.main_risk && (
                      <div>
                        <span className="text-xs font-medium text-foreground">Risco: </span>
                        <span className="text-xs text-muted-foreground">{asset.main_risk}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Kanban View */}
        <TabsContent value="kanban">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanStatuses.map((status) => {
              const items = filtered.filter((a) => a.status === status);
              return (
                <div key={status} className="min-w-[260px] w-[260px] shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <Badge className={statusColors[status]}>{ceoStatusLabels[status]}</Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((asset) => (
                      <Card key={asset.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(asset)}>
                        <CardContent className="p-3 space-y-1.5">
                          <p className="font-medium text-sm leading-tight">{asset.name}</p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{assetTypeLabels[asset.asset_type]}</Badge>
                            {asset.priority && <Badge className={`text-xs ${priorityColors[asset.priority]}`}>{priorityLabels[asset.priority]}</Badge>}
                          </div>
                          {asset.next_action && <p className="text-xs text-muted-foreground truncate">{asset.next_action}</p>}
                        </CardContent>
                      </Card>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-md">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar Item do Radar" : "Novo Item do Radar"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2">
                <Label>Nome Oficial *</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome do ativo estratégico" />
              </div>
              <div>
                <Label>Nome Curto / Sigla</Label>
                <Input value={editing.short_name || ""} onChange={(e) => setEditing({ ...editing, short_name: e.target.value })} />
              </div>
              <div>
                <Label>Tipo Principal</Label>
                <Select value={editing.asset_type || "ideia"} onValueChange={(v) => setEditing({ ...editing, asset_type: v as StrategicAssetType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(assetTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status || "em_analise"} onValueChange={(v) => setEditing({ ...editing, status: v as CeoStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={editing.priority || "media"} onValueChange={(v) => setEditing({ ...editing, priority: v as PriorityLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Descrição Executiva</Label>
                <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Potencial</Label>
                <Input value={editing.potential || ""} onChange={(e) => setEditing({ ...editing, potential: e.target.value })} />
              </div>
              <div>
                <Label>Risco Principal</Label>
                <Input value={editing.main_risk || ""} onChange={(e) => setEditing({ ...editing, main_risk: e.target.value })} />
              </div>
              <div>
                <Label>Próxima Ação</Label>
                <Input value={editing.next_action || ""} onChange={(e) => setEditing({ ...editing, next_action: e.target.value })} />
              </div>
              <div>
                <Label>Prazo / Data-chave</Label>
                <Input type="date" value={editing.deadline || ""} onChange={(e) => setEditing({ ...editing, deadline: e.target.value || null })} />
              </div>
              <div className="md:col-span-2">
                <Label>Observações Estratégicas</Label>
                <Textarea value={editing.strategic_notes || ""} onChange={(e) => setEditing({ ...editing, strategic_notes: e.target.value })} rows={2} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoRadar;

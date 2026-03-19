import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import {
  CeoTask, TaskStatus, PriorityLevel,
  taskStatusLabels, priorityLabels, priorityColors, taskStatusColors,
} from "@/types/ceo";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Edit2, Trash2, CheckSquare, List, Columns3, Calendar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const emptyTask: Partial<CeoTask> = {
  title: "", description: "", responsible: "", deadline: null,
  priority: "media", status: "todo", dependency: "", notes: "",
};

const CeoTasks = () => {
  const { data, loading, insert, update, remove } = useCeoTable<CeoTask>("ceo_tasks");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<CeoTask>>(emptyTask);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const filtered = data.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const openCreate = () => { setEditing({ ...emptyTask }); setDialogOpen(true); };
  const openEdit = (task: CeoTask) => { setEditing({ ...task }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.title?.trim()) return;
    const isEdit = !!editing.id;
    const { id, created_at, updated_at, initiative_id, project_id, ...payload } = editing as any;
    const success = isEdit
      ? await update(editing.id!, payload)
      : await insert(payload);
    if (success) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await remove(deleteId); setDeleteId(null); }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await update(taskId, { status: newStatus } as any);
  };

  const kanbanStatuses: TaskStatus[] = ["todo", "doing", "done", "bloqueado", "aguardando_terceiro", "pausado"];

  const isOverdue = (task: CeoTask) => {
    if (!task.deadline || task.status === "done") return false;
    return new Date(task.deadline) < new Date();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare className="h-5 w-5 sm:h-6 sm:w-6" /> Tarefas
          </h1>
          <p className="text-muted-foreground text-sm">Gestão operacional detalhada</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(taskStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban"><Columns3 className="h-4 w-4 mr-1" /> Kanban</TabsTrigger>
          <TabsTrigger value="table"><List className="h-4 w-4 mr-1" /> Tabela</TabsTrigger>
        </TabsList>

        {/* Kanban View */}
        <TabsContent value="kanban">
          {loading ? (
            <div className="flex gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-[260px]" />)}</div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanStatuses.map((status) => {
                const items = filtered.filter((t) => t.status === status);
                return (
                  <div key={status} className="min-w-[260px] w-[260px] shrink-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <Badge className={taskStatusColors[status]}>{taskStatusLabels[status]}</Badge>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((task) => (
                        <Card
                          key={task.id}
                          className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue(task) ? "border-destructive" : ""}`}
                          onClick={() => openEdit(task)}
                        >
                          <CardContent className="p-3 space-y-1.5">
                            <p className="font-medium text-sm leading-tight">{task.title}</p>
                            <div className="flex gap-1 flex-wrap">
                              {task.priority && <Badge className={`text-xs ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</Badge>}
                              {task.responsible && <Badge variant="outline" className="text-xs">{task.responsible}</Badge>}
                            </div>
                            {task.deadline && (
                              <div className={`flex items-center gap-1 text-xs ${isOverdue(task) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                <Calendar className="h-3 w-3" />
                                {new Date(task.deadline).toLocaleDateString("pt-BR")}
                              </div>
                            )}
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
          )}
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma tarefa encontrada</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((task) => (
                    <TableRow key={task.id} className={`cursor-pointer hover:bg-muted/50 ${isOverdue(task) ? "bg-destructive/5" : ""}`} onClick={() => openEdit(task)}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v as TaskStatus)}>
                            <SelectTrigger className="h-7 w-[140px]">
                              <Badge className={`text-xs ${taskStatusColors[task.status]}`}>{taskStatusLabels[task.status]}</Badge>
                            </SelectTrigger>
                            <SelectContent>{Object.entries(taskStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>{task.priority && <Badge className={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Badge>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{task.responsible || "—"}</TableCell>
                      <TableCell className={`text-sm ${isOverdue(task) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2">
              <Label>Título *</Label>
              <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={editing.responsible || ""} onChange={(e) => setEditing({ ...editing, responsible: e.target.value })} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={editing.deadline || ""} onChange={(e) => setEditing({ ...editing, deadline: e.target.value || null })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={editing.priority || "media"} onValueChange={(v) => setEditing({ ...editing, priority: v as PriorityLevel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editing.status || "todo"} onValueChange={(v) => setEditing({ ...editing, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taskStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Dependência</Label>
              <Input value={editing.dependency || ""} onChange={(e) => setEditing({ ...editing, dependency: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.title?.trim()}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
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

export default CeoTasks;

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Lightbulb, BookOpen, Search } from "lucide-react";

const CeoDecisionsLessons = () => {
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogType, setDialogType] = useState<"decision" | "lesson">("decision");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>({});
  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [d, l] = await Promise.all([
      (supabase as any).from("decisions").select("*").order("decided_at", { ascending: false }),
      (supabase as any).from("lessons_learned").select("*").order("created_at", { ascending: false }),
    ]);
    setDecisions(d.data || []);
    setLessons(l.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    const table = dialogType === "decision" ? "decisions" : "lessons_learned";
    const { id, created_at, ...rest } = editing;
    if (id) {
      const { error } = await (supabase as any).from(table).update(rest).eq("id", id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await (supabase as any).from(table).insert(rest);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Salvo" });
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await (supabase as any).from(deleteTarget.table).delete().eq("id", deleteTarget.id);
    toast({ title: "Excluído" });
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <div className="p-4 md:p-6"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

  const filteredDecisions = decisions.filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()));
  const filteredLessons = lessons.filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Memória Institucional</h1>
          <p className="text-muted-foreground text-sm">Decisões e lições aprendidas</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="decisions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="decisions"><Lightbulb className="h-4 w-4 mr-1" /> Decisões ({filteredDecisions.length})</TabsTrigger>
          <TabsTrigger value="lessons"><BookOpen className="h-4 w-4 mr-1" /> Lições ({filteredLessons.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="decisions" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setDialogType("decision"); setEditing({ title: "", description: "", impact: "", decided_by: "" }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Decisão
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Impacto</TableHead><TableHead>Decidido por</TableHead><TableHead>Data</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
              <TableBody>
                {filteredDecisions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma decisão registrada.</TableCell></TableRow>
                ) : filteredDecisions.map(d => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-accent/50" onClick={() => { setDialogType("decision"); setEditing({ ...d }); setDialogOpen(true); }}>
                    <TableCell>
                      <p className="font-medium">{d.title}</p>
                      {d.description && <p className="text-xs text-muted-foreground line-clamp-1">{d.description}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{d.impact || "—"}</TableCell>
                    <TableCell className="text-sm">{d.decided_by || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(d.decided_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeleteTarget({ table: "decisions", id: d.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="lessons" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setDialogType("lesson"); setEditing({ title: "", description: "", category: "" }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Lição
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Categoria</TableHead><TableHead>Data</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
              <TableBody>
                {filteredLessons.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma lição registrada.</TableCell></TableRow>
                ) : filteredLessons.map(l => (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-accent/50" onClick={() => { setDialogType("lesson"); setEditing({ ...l }); setDialogOpen(true); }}>
                    <TableCell>
                      <p className="font-medium">{l.title}</p>
                      {l.description && <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>}
                    </TableCell>
                    <TableCell>{l.category ? <Badge variant="outline">{l.category}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm">{l.lesson_date || new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeleteTarget({ table: "lessons_learned", id: l.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nova"} {dialogType === "decision" ? "Decisão" : "Lição"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} /></div>
            {dialogType === "decision" && (
              <>
                <div><Label>Impacto</Label><Input value={editing.impact || ""} onChange={e => setEditing({ ...editing, impact: e.target.value })} /></div>
                <div><Label>Decidido por</Label><Input value={editing.decided_by || ""} onChange={e => setEditing({ ...editing, decided_by: e.target.value })} /></div>
              </>
            )}
            {dialogType === "lesson" && (
              <div><Label>Categoria</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="Ex: técnica, comercial, gestão" /></div>
            )}
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.title?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoDecisionsLessons;

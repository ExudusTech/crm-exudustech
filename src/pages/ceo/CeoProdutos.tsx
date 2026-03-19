import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { CeoStatus, ceoStatusLabels, statusColors } from "@/types/ceo";
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
import { Plus, Search, Trash2, Package, Edit2 } from "lucide-react";
import { RelatedEntities } from "@/components/ceo/RelatedEntities";

interface Product {
  id: string; name: string; description: string | null; category: string | null;
  status: CeoStatus; price: number | null; commercial_model: string | null;
  value_message: string | null; benchmark: string | null; modularity_notes: string | null;
  notes: string | null; pilot_organization_id: string | null; created_at: string; updated_at: string;
}

const emptyItem: Partial<Product> = {
  name: "", description: "", category: "", status: "ativo", price: null,
  commercial_model: "", value_message: "", benchmark: "", modularity_notes: "", notes: "",
};

const CeoProdutos = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Product>("products");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Product>>(emptyItem);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = data.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const openCreate = () => { setEditing({ ...emptyItem }); setDialogOpen(true); };
  const openEdit = (item: Product) => { setEditing({ ...item }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    if (editing.id) {
      const { id, created_at, updated_at, ...rest } = editing as Product;
      await update(id, rest);
    } else {
      const { id, created_at, updated_at, ...rest } = editing as any;
      await insert(rest);
    }
    setDialogOpen(false);
  };

  const selectedProd = data.find(p => p.id === detailId);

  if (loading) return <div className="p-4 md:p-6 max-w-7xl mx-auto"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-[300px] w-full" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2"><Package className="h-5 w-5 sm:h-6 sm:w-6" /> Produtos</h1>
          <p className="text-muted-foreground text-sm">Ativos replicáveis, comercializáveis ou escaláveis.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={detailId ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead>
                  <TableHead>Modelo</TableHead><TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer hover:bg-accent/50 ${detailId === item.id ? "bg-muted/50" : ""}`}
                    onClick={() => setDetailId(detailId === item.id ? null : item.id)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.category || "—"}</TableCell>
                    <TableCell><Badge className={statusColors[item.status]}>{ceoStatusLabels[item.status]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.commercial_model || "—"}</TableCell>
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

        {detailId && selectedProd && (
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg">{selectedProd.name}</h3>
                <Badge className={`mt-1 ${statusColors[selectedProd.status]}`}>{ceoStatusLabels[selectedProd.status]}</Badge>
                {selectedProd.description && <p className="text-sm text-muted-foreground mt-2">{selectedProd.description}</p>}
                {selectedProd.value_message && <p className="text-sm mt-2"><strong>Valor:</strong> {selectedProd.value_message}</p>}
                {selectedProd.price && <p className="text-sm mt-1"><strong>Preço:</strong> R$ {selectedProd.price.toLocaleString("pt-BR")}</p>}
              </CardContent>
            </Card>
            <RelatedEntities entityType="product" entityId={detailId} />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={editing.category || ""} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))} /></div>
              <div><Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing(p => ({ ...p, status: v as CeoStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Preço</Label><Input type="number" value={editing.price ?? ""} onChange={e => setEditing(p => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))} /></div>
              <div><Label>Modelo Comercial</Label><Input value={editing.commercial_model || ""} onChange={e => setEditing(p => ({ ...p, commercial_model: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={editing.description || ""} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Mensagem de Valor</Label><Textarea value={editing.value_message || ""} onChange={e => setEditing(p => ({ ...p, value_message: e.target.value }))} rows={2} /></div>
            <div><Label>Benchmark</Label><Input value={editing.benchmark || ""} onChange={e => setEditing(p => ({ ...p, benchmark: e.target.value }))} /></div>
            <div><Label>Notas de Modularidade</Label><Textarea value={editing.modularity_notes || ""} onChange={e => setEditing(p => ({ ...p, modularity_notes: e.target.value }))} rows={2} /></div>
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
          <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoProdutos;

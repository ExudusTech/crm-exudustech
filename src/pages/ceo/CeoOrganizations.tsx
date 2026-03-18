import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import {
  Organization, OrganizationType, CeoStatus,
  organizationTypeLabels, ceoStatusLabels, statusColors,
} from "@/types/ceo";
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
import { Plus, Search, Edit2, Trash2, Building2, Globe } from "lucide-react";
import { RelatedEntities } from "@/components/ceo/RelatedEntities";

const emptyOrg: Partial<Organization> = {
  name: "", short_name: "", type: "cliente", segment: "",
  status: "ativo", website: "", notes: "",
};

const CeoOrganizations = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Organization>("organizations");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Organization>>(emptyOrg);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = data.filter((o) => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !o.short_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && o.type !== filterType) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    return true;
  });

  const openCreate = () => { setEditing({ ...emptyOrg }); setDialogOpen(true); };
  const openEdit = (org: Organization) => { setEditing({ ...org }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    const { id, created_at, updated_at, parent_organization_id, ...payload } = editing as any;
    const success = editing.id ? await update(editing.id!, payload) : await insert(payload);
    if (success) setDialogOpen(false);
  };

  const selectedOrg = data.find(o => o.id === detailId);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-6 w-6" /> Organizações</h1>
          <p className="text-muted-foreground text-sm">Clientes, parceiros, instituições e pilotos</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nova Organização</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(organizationTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className={detailId ? "lg:col-span-2" : "lg:col-span-3"}>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma organização encontrada</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((org) => (
                    <TableRow
                      key={org.id}
                      className={`cursor-pointer hover:bg-muted/50 ${detailId === org.id ? "bg-muted/50" : ""}`}
                      onClick={() => setDetailId(detailId === org.id ? null : org.id)}
                    >
                      <TableCell>
                        <p className="font-medium">{org.name}</p>
                        {org.short_name && <p className="text-xs text-muted-foreground">{org.short_name}</p>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{organizationTypeLabels[org.type]}</Badge></TableCell>
                      <TableCell><Badge className={statusColors[org.status]}>{ceoStatusLabels[org.status]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(org)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(org.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Detail panel with relationships */}
        {detailId && selectedOrg && (
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg">{selectedOrg.name}</h3>
                <Badge variant="outline" className="mt-1">{organizationTypeLabels[selectedOrg.type]}</Badge>
                {selectedOrg.segment && <p className="text-sm text-muted-foreground mt-2">Segmento: {selectedOrg.segment}</p>}
                {selectedOrg.website && (
                  <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" /> {selectedOrg.website}
                  </a>
                )}
                {selectedOrg.notes && <p className="text-sm text-muted-foreground mt-2">{selectedOrg.notes}</p>}
              </CardContent>
            </Card>
            <RelatedEntities entityType="organization" entityId={detailId} />
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar Organização" : "Nova Organização"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2"><Label>Nome Oficial *</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Nome Curto / Sigla</Label><Input value={editing.short_name || ""} onChange={(e) => setEditing({ ...editing, short_name: e.target.value })} /></div>
            <div><Label>Tipo</Label>
              <Select value={editing.type || "cliente"} onValueChange={(v) => setEditing({ ...editing, type: v as OrganizationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(organizationTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Segmento</Label><Input value={editing.segment || ""} onChange={(e) => setEditing({ ...editing, segment: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={editing.status || "ativo"} onValueChange={(v) => setEditing({ ...editing, status: v as CeoStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Site</Label><Input value={editing.website || ""} onChange={(e) => setEditing({ ...editing, website: e.target.value })} placeholder="https://" /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>{editing.id ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir organização?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoOrganizations;

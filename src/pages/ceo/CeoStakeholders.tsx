import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCeoTable } from "@/hooks/use-ceo-table";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit2, Trash2, Search, Users, Mail, Phone } from "lucide-react";
import { StakeholderType, Organization } from "@/types/ceo";
import { RelatedEntities } from "@/components/ceo/RelatedEntities";

const stakeholderTypeLabels: Record<StakeholderType, string> = {
  decisor: "Decisor", operacional: "Operacional", tecnico: "Técnico",
  comercial: "Comercial", aprovador: "Aprovador", consultor: "Consultor", outro: "Outro",
};
const stakeholderTypeColors: Record<StakeholderType, string> = {
  decisor: "bg-purple-600 text-white", operacional: "bg-blue-600 text-white", tecnico: "bg-green-600 text-white",
  comercial: "bg-orange-500 text-white", aprovador: "bg-destructive text-destructive-foreground",
  consultor: "bg-primary text-primary-foreground", outro: "bg-muted text-muted-foreground",
};

interface Stakeholder {
  id: string; name: string; role_title: string | null; organization_id: string | null;
  email: string | null; phone: string | null; stakeholder_type: StakeholderType;
  notes: string | null; created_at: string; updated_at: string;
}

const emptyStakeholder: Partial<Stakeholder> = {
  name: "", role_title: "", organization_id: null, email: "", phone: "", stakeholder_type: "outro", notes: "",
};

const CeoStakeholders = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Stakeholder>("stakeholders");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Stakeholder>>(emptyStakeholder);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any).from("organizations").select("id,name").order("name").then(({ data: d }: any) => setOrgs(d || []));
  }, []);

  const filtered = data.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.role_title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && s.stakeholder_type !== filterType) return false;
    return true;
  });

  const orgName = (id: string | null) => orgs.find(o => o.id === id)?.name || "—";
  const openCreate = () => { setEditing({ ...emptyStakeholder }); setDialogOpen(true); };
  const openEdit = (s: Stakeholder) => { setEditing({ ...s }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) return;
    const payload = { ...editing };
    if (!payload.organization_id) payload.organization_id = null;
    const ok = editing.id ? await update(editing.id, payload) : await insert(payload);
    if (ok) setDialogOpen(false);
  };

  const selectedStk = data.find(s => s.id === detailId);

  if (loading) return <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-6 w-6" /> Stakeholders</h1>
          <p className="text-muted-foreground text-sm">Pessoas relacionadas ao ecossistema</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Stakeholder</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(stakeholderTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={detailId ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <ScrollArea className="max-h-[65vh]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Organização</TableHead>
                  <TableHead>Tipo</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum stakeholder encontrado</TableCell></TableRow>}
                  {filtered.map(s => (
                    <TableRow
                      key={s.id}
                      className={`cursor-pointer hover:bg-muted/50 ${detailId === s.id ? "bg-muted/50" : ""}`}
                      onClick={() => setDetailId(detailId === s.id ? null : s.id)}
                    >
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.role_title || "—"}</TableCell>
                      <TableCell>{orgName(s.organization_id)}</TableCell>
                      <TableCell><Badge className={stakeholderTypeColors[s.stakeholder_type]}>{stakeholderTypeLabels[s.stakeholder_type]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>

        {detailId && selectedStk && (
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg">{selectedStk.name}</h3>
                <Badge className={`mt-1 ${stakeholderTypeColors[selectedStk.stakeholder_type]}`}>{stakeholderTypeLabels[selectedStk.stakeholder_type]}</Badge>
                {selectedStk.role_title && <p className="text-sm mt-2">{selectedStk.role_title}</p>}
                {selectedStk.email && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Mail className="h-3 w-3" /> {selectedStk.email}</p>}
                {selectedStk.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedStk.phone}</p>}
                {selectedStk.organization_id && <p className="text-sm mt-2">Org: {orgName(selectedStk.organization_id)}</p>}
                {selectedStk.notes && <p className="text-sm text-muted-foreground mt-2">{selectedStk.notes}</p>}
              </CardContent>
            </Card>
            <RelatedEntities entityType="stakeholder" entityId={detailId} />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Novo"} Stakeholder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Cargo / Papel</Label><Input value={editing.role_title || ""} onChange={e => setEditing({ ...editing, role_title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={editing.stakeholder_type || "outro"} onValueChange={v => setEditing({ ...editing, stakeholder_type: v as StakeholderType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(stakeholderTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Organização</Label>
                <Select value={editing.organization_id || "none"} onValueChange={v => setEditing({ ...editing, organization_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={editing.email || ""} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={editing.phone || ""} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing.name?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteId) { remove(deleteId); setDeleteId(null); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CeoStakeholders;

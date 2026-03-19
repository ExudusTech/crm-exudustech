import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";

const docTypeLabels: Record<string, string> = {
  contrato: "Contrato", proposta: "Proposta", apresentacao: "Apresentação",
  relatorio: "Relatório", parecer: "Parecer", nota_fiscal: "Nota Fiscal",
  documento_fiscal: "Doc. Fiscal", extrato: "Extrato", gravacao: "Gravação",
  material_marketing: "Marketing", print: "Print", anexo_tecnico: "Anexo Técnico", outro: "Outro",
};

interface CeoDocument {
  id: string;
  name: string;
  doc_type: string;
  storage_path: string | null;
  notes: string | null;
  organization_id: string | null;
  initiative_id: string | null;
  project_id: string | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
}

const emptyForm: Partial<CeoDocument> = { name: "", doc_type: "outro", storage_path: "", notes: "" };

const CeoDocumentos = () => {
  const { data, loading, insert, update, remove } = useCeoTable<CeoDocument>("ceo_documents");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CeoDocument | null>(null);
  const [form, setForm] = useState<Partial<CeoDocument>>(emptyForm);

  const filtered = data.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || d.doc_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleSave = async () => {
    const ok = editing ? await update(editing.id, form) : await insert(form);
    if (ok) { setOpen(false); setEditing(null); setForm(emptyForm); }
  };

  const openEdit = (item: CeoDocument) => { setEditing(item); setForm({ ...item }); setOpen(true); };
  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground text-sm">Repositório documental central</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Documento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar Documento" : "Novo Documento"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.doc_type || "outro"} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(docTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Caminho / URL</Label><Input value={form.storage_path || ""} onChange={(e) => setForm({ ...form, storage_path: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar"}</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(docTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum documento encontrado.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {doc.name}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{docTypeLabels[doc.doc_type] || doc.doc_type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(doc.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(doc)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(doc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default CeoDocumentos;

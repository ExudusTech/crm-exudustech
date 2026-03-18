import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Server, ExternalLink, Github } from "lucide-react";

interface Infrastructure {
  id: string;
  name: string;
  url_production: string | null;
  url_staging: string | null;
  github_url: string | null;
  technical_docs_url: string | null;
  functional_docs_url: string | null;
  stack: string | null;
  integrations: string | null;
  environments: string | null;
  linked_emails: string | null;
  linked_accounts: string | null;
  base_prompts: string | null;
  assets: string | null;
  reusable_modules: string | null;
  notes: string | null;
  initiative_id: string | null;
  project_id: string | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
}

const emptyForm: Partial<Infrastructure> = {
  name: "", url_production: "", url_staging: "", github_url: "",
  technical_docs_url: "", functional_docs_url: "", stack: "", integrations: "",
  environments: "", linked_emails: "", linked_accounts: "", base_prompts: "",
  assets: "", reusable_modules: "", notes: "",
};

const CeoInfraestrutura = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Infrastructure>("infrastructures");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Infrastructure | null>(null);
  const [form, setForm] = useState<Partial<Infrastructure>>(emptyForm);

  const filtered = data.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    const ok = editing ? await update(editing.id, form) : await insert(form);
    if (ok) { setOpen(false); setEditing(null); setForm(emptyForm); }
  };

  const openEdit = (item: Infrastructure) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const LinkBadge = ({ url, label }: { url: string | null; label: string }) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
          <ExternalLink className="h-3 w-3" /> {label}
        </Badge>
      </a>
    ) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Infraestrutura</h1>
          <p className="text-muted-foreground text-sm">Ativos técnicos e operacionais</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Ativo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Ativo" : "Novo Ativo"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>URL Produção</Label><Input value={form.url_production || ""} onChange={(e) => setForm({ ...form, url_production: e.target.value })} /></div>
                <div><Label>URL Staging</Label><Input value={form.url_staging || ""} onChange={(e) => setForm({ ...form, url_staging: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>GitHub URL</Label><Input value={form.github_url || ""} onChange={(e) => setForm({ ...form, github_url: e.target.value })} /></div>
                <div><Label>Stack</Label><Input value={form.stack || ""} onChange={(e) => setForm({ ...form, stack: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Doc Técnica URL</Label><Input value={form.technical_docs_url || ""} onChange={(e) => setForm({ ...form, technical_docs_url: e.target.value })} /></div>
                <div><Label>Doc Funcional URL</Label><Input value={form.functional_docs_url || ""} onChange={(e) => setForm({ ...form, functional_docs_url: e.target.value })} /></div>
              </div>
              <div><Label>Integrações</Label><Textarea value={form.integrations || ""} onChange={(e) => setForm({ ...form, integrations: e.target.value })} /></div>
              <div><Label>Ambientes</Label><Textarea value={form.environments || ""} onChange={(e) => setForm({ ...form, environments: e.target.value })} /></div>
              <div><Label>Emails vinculados</Label><Input value={form.linked_emails || ""} onChange={(e) => setForm({ ...form, linked_emails: e.target.value })} /></div>
              <div><Label>Contas vinculadas</Label><Input value={form.linked_accounts || ""} onChange={(e) => setForm({ ...form, linked_accounts: e.target.value })} /></div>
              <div><Label>Prompts base</Label><Textarea value={form.base_prompts || ""} onChange={(e) => setForm({ ...form, base_prompts: e.target.value })} /></div>
              <div><Label>Assets</Label><Textarea value={form.assets || ""} onChange={(e) => setForm({ ...form, assets: e.target.value })} /></div>
              <div><Label>Módulos reutilizáveis</Label><Textarea value={form.reusable_modules || ""} onChange={(e) => setForm({ ...form, reusable_modules: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar"}</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum ativo encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{item.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.stack && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Stack:</span> {item.stack}</p>}
                <div className="flex flex-wrap gap-2">
                  <LinkBadge url={item.url_production} label="Produção" />
                  <LinkBadge url={item.url_staging} label="Staging" />
                  {item.github_url && (
                    <a href={item.github_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent"><Github className="h-3 w-3" /> GitHub</Badge>
                    </a>
                  )}
                  <LinkBadge url={item.technical_docs_url} label="Doc Técnica" />
                  <LinkBadge url={item.functional_docs_url} label="Doc Funcional" />
                </div>
                {item.integrations && <p className="text-xs text-muted-foreground mt-1">{item.integrations}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CeoInfraestrutura;

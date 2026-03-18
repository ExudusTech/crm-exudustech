import { useState } from "react";
import { useCeoTable } from "@/hooks/use-ceo-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Puzzle, ExternalLink } from "lucide-react";

interface Module {
  id: string;
  name: string;
  description: string | null;
  documentation_url: string | null;
  pluggability_score: number | null;
  has_billing_layer: boolean | null;
  origin_product_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const emptyForm: Partial<Module> = {
  name: "", description: "", documentation_url: "", pluggability_score: 0,
  has_billing_layer: false, notes: "",
};

const CeoModulos = () => {
  const { data, loading, insert, update, remove } = useCeoTable<Module>("modules");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState<Partial<Module>>(emptyForm);

  const filtered = data.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    const ok = editing ? await update(editing.id, form) : await insert(form);
    if (ok) { setOpen(false); setEditing(null); setForm(emptyForm); }
  };

  const openEdit = (item: Module) => { setEditing(item); setForm({ ...item }); setOpen(true); };
  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const scoreColor = (score: number | null) => {
    if (!score) return "bg-muted text-muted-foreground";
    if (score >= 8) return "bg-green-600 text-white";
    if (score >= 5) return "bg-yellow-500 text-white";
    return "bg-orange-500 text-white";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Módulos ExudusTech</h1>
          <p className="text-muted-foreground text-sm">Mapeamento de modularidade e reaproveitamento</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Módulo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>URL Documentação</Label><Input value={form.documentation_url || ""} onChange={(e) => setForm({ ...form, documentation_url: e.target.value })} /></div>
              <div>
                <Label>Pluggability Score (0-10)</Label>
                <Input type="number" min={0} max={10} value={form.pluggability_score ?? 0} onChange={(e) => setForm({ ...form, pluggability_score: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.has_billing_layer ?? false} onCheckedChange={(v) => setForm({ ...form, has_billing_layer: v })} />
                <Label>Possui camada de billing</Label>
              </div>
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
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum módulo encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((mod) => (
            <Card key={mod.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{mod.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(mod)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(mod.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {mod.description && <p className="text-sm text-muted-foreground line-clamp-2">{mod.description}</p>}
                <div className="flex flex-wrap gap-2">
                  <Badge className={scoreColor(mod.pluggability_score)}>
                    Plug: {mod.pluggability_score ?? 0}/10
                  </Badge>
                  {mod.has_billing_layer && <Badge variant="outline">💳 Billing</Badge>}
                  {mod.documentation_url && (
                    <a href={mod.documentation_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
                        <ExternalLink className="h-3 w-3" /> Docs
                      </Badge>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CeoModulos;

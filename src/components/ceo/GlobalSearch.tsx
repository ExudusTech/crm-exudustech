import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Target, Building2, Users, CheckSquare, Package, FolderKanban, Radar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchResult {
  id: string;
  name: string;
  type: string;
  icon: any;
  path: string;
  meta?: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const like = `%${q}%`;
    const [initiatives, orgs, stakeholders, tasks, products, projects, assets] = await Promise.all([
      (supabase as any).from("initiatives").select("id, name, status").ilike("name", like).limit(5),
      (supabase as any).from("organizations").select("id, name, type").ilike("name", like).limit(5),
      (supabase as any).from("stakeholders").select("id, name, role_title").ilike("name", like).limit(5),
      (supabase as any).from("ceo_tasks").select("id, title, status").ilike("title", like).limit(5),
      (supabase as any).from("products").select("id, name, status").ilike("name", like).limit(5),
      (supabase as any).from("projects").select("id, name, status").ilike("name", like).limit(5),
      (supabase as any).from("strategic_assets").select("id, name, asset_type").ilike("name", like).limit(5),
    ]);

    const r: SearchResult[] = [
      ...(initiatives.data || []).map((i: any) => ({ id: i.id, name: i.name, type: "Iniciativa", icon: Target, path: `/ceo/iniciativas/${i.id}`, meta: i.status })),
      ...(orgs.data || []).map((o: any) => ({ id: o.id, name: o.name, type: "Organização", icon: Building2, path: "/ceo/organizacoes", meta: o.type })),
      ...(stakeholders.data || []).map((s: any) => ({ id: s.id, name: s.name, type: "Stakeholder", icon: Users, path: "/ceo/stakeholders", meta: s.role_title })),
      ...(tasks.data || []).map((t: any) => ({ id: t.id, name: t.title, type: "Tarefa", icon: CheckSquare, path: "/ceo/tarefas", meta: t.status })),
      ...(products.data || []).map((p: any) => ({ id: p.id, name: p.name, type: "Produto", icon: Package, path: "/ceo/produtos", meta: p.status })),
      ...(projects.data || []).map((p: any) => ({ id: p.id, name: p.name, type: "Projeto", icon: FolderKanban, path: "/ceo/projetos", meta: p.status })),
      ...(assets.data || []).map((a: any) => ({ id: a.id, name: a.name, type: "Ativo Estratégico", icon: Radar, path: "/ceo/radar", meta: a.asset_type })),
    ];
    setResults(r);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground mr-3 shrink-0" />
          <Input
            placeholder="Buscar iniciativas, tarefas, organizações..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[400px]">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map(r => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors"
                >
                  <r.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">{r.type}</span>
                      {r.meta && <Badge variant="outline" className="text-xs h-4">{r.meta}</Badge>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !searching ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado para "{query}"</p>
          ) : query.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Digite pelo menos 2 caracteres</p>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

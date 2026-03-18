import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, X, ChevronDown } from "lucide-react";

interface EntityOption {
  id: string;
  name: string;
  [key: string]: any;
}

interface InlineField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
}

interface EntitySelectorProps {
  label: string;
  tableName: string;
  value: string | null;
  onChange: (id: string | null) => void;
  onCreateInline?: (record: any) => Promise<string | null>;
  inlineFields?: InlineField[];
  nameField?: string;
  placeholder?: string;
}

export const EntitySelector = ({
  label,
  tableName,
  value,
  onChange,
  onCreateInline,
  inlineFields = [],
  nameField = "name",
  placeholder = "Selecionar...",
}: EntitySelectorProps) => {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [inlineData, setInlineData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from(tableName)
      .select(`id, ${nameField}`)
      .order(nameField)
      .then(({ data }: any) => setOptions(data || []));
  }, [tableName, nameField]);

  const handleCreateInline = async () => {
    if (!inlineData[nameField]?.trim()) return;
    setSaving(true);
    try {
      if (onCreateInline) {
        const newId = await onCreateInline(inlineData);
        if (newId) {
          onChange(newId);
          setOptions(prev => [...prev, { id: newId, [nameField]: inlineData[nameField], ...inlineData }]);
        }
      } else {
        const { data, error } = await (supabase as any).from(tableName).insert(inlineData).select("id").single();
        if (!error && data) {
          onChange(data.id);
          setOptions(prev => [...prev, { id: data.id, [nameField]: inlineData[nameField], ...inlineData }]);
        }
      }
      setCreating(false);
      setInlineData({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {!creating ? (
        <div className="flex gap-2">
          <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? null : v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {options.map(o => (
                <SelectItem key={o.id} value={o.id}>{o[nameField]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => setCreating(true)} title="Criar novo">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Criar novo</span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCreating(false); setInlineData({}); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Input
            placeholder={`Nome *`}
            value={inlineData[nameField] || ""}
            onChange={e => setInlineData(p => ({ ...p, [nameField]: e.target.value }))}
          />
          {inlineFields.map(f => (
            <div key={f.key}>
              {f.type === "select" && f.options ? (
                <Select value={inlineData[f.key] || ""} onValueChange={v => setInlineData(p => ({ ...p, [f.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder={f.label} /></SelectTrigger>
                  <SelectContent>
                    {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={f.label}
                  value={inlineData[f.key] || ""}
                  onChange={e => setInlineData(p => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <Button type="button" size="sm" onClick={handleCreateInline} disabled={saving || !inlineData[nameField]?.trim()}>
            {saving ? "Salvando..." : "Criar e Vincular"}
          </Button>
        </div>
      )}
    </div>
  );
};

// Multi-select version for stakeholders
interface MultiEntitySelectorProps {
  label: string;
  tableName: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateInline?: (record: any) => Promise<string | null>;
  inlineFields?: InlineField[];
  nameField?: string;
  displayField?: string;
}

export const MultiEntitySelector = ({
  label,
  tableName,
  selectedIds,
  onChange,
  onCreateInline,
  inlineFields = [],
  nameField = "name",
}: MultiEntitySelectorProps) => {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [inlineData, setInlineData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from(tableName)
      .select("*")
      .order(nameField)
      .then(({ data }: any) => setOptions(data || []));
  }, [tableName, nameField]);

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleCreateInline = async () => {
    if (!inlineData[nameField]?.trim()) return;
    setSaving(true);
    try {
      let newId: string | null = null;
      if (onCreateInline) {
        newId = await onCreateInline(inlineData);
      } else {
        const { data, error } = await (supabase as any).from(tableName).insert(inlineData).select("*").single();
        if (!error && data) {
          newId = data.id;
          setOptions(prev => [...prev, data]);
        }
      }
      if (newId) {
        onChange([...selectedIds, newId]);
      }
      setCreating(false);
      setInlineData({});
    } finally {
      setSaving(false);
    }
  };

  const selectedNames = options.filter(o => selectedIds.includes(o.id));
  const available = options.filter(o => !selectedIds.includes(o.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {/* Selected chips */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedNames.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
              {s[nameField]}
              <button type="button" onClick={() => toggleSelection(s.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Add existing */}
      <div className="flex gap-2">
        <Select value="" onValueChange={v => { if (v) toggleSelection(v); }}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Adicionar existente..." />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <SelectItem value="_empty" disabled>Nenhum disponível</SelectItem>
            ) : available.map(o => (
              <SelectItem key={o.id} value={o.id}>{o[nameField]}{o.role_title ? ` (${o.role_title})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {/* Inline create */}
      {creating && (
        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Criar novo</span>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCreating(false); setInlineData({}); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Input placeholder={`Nome *`} value={inlineData[nameField] || ""} onChange={e => setInlineData(p => ({ ...p, [nameField]: e.target.value }))} />
          {inlineFields.map(f => (
            <div key={f.key}>
              {f.type === "select" && f.options ? (
                <Select value={inlineData[f.key] || ""} onValueChange={v => setInlineData(p => ({ ...p, [f.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder={f.label} /></SelectTrigger>
                  <SelectContent>{f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder={f.label} value={inlineData[f.key] || ""} onChange={e => setInlineData(p => ({ ...p, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <Button type="button" size="sm" onClick={handleCreateInline} disabled={saving || !inlineData[nameField]?.trim()}>
            {saving ? "Salvando..." : "Criar e Vincular"}
          </Button>
        </div>
      )}
    </div>
  );
};

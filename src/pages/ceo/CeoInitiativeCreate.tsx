import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CeoStatus, PriorityLevel, ceoStatusLabels, priorityLabels, statusColors, priorityColors,
  organizationTypeLabels, assetTypeLabels, OrganizationType, StrategicAssetType,
} from "@/types/ceo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Building2, Users, Package, FolderKanban, Shield,
  DollarSign, Server, FileText, Megaphone, Eye, Save, Bot,
  ChevronDown, ChevronUp, Plus, X, Check, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types for inline entities ──
interface InlineOrg {
  _tempId: string;
  name: string;
  short_name: string;
  type: OrganizationType;
  segment: string;
  status: CeoStatus;
  notes: string;
}

interface InlineStakeholder {
  _tempId: string;
  name: string;
  role_title: string;
  organization_id: string | null;
  email: string;
  phone: string;
  stakeholder_type: string;
  notes: string;
  role_in_initiative: string;
}

interface InlineProduct {
  _tempId: string;
  name: string;
  category: string;
  status: CeoStatus;
  pilot_organization_id: string | null;
  description: string;
  notes: string;
}

interface InlineProject {
  _tempId: string;
  name: string;
  status: CeoStatus;
  priority: PriorityLevel;
  main_risk: string;
  next_action: string;
  scope_summary: string;
}

interface InlineAsset {
  _tempId: string;
  name: string;
  short_name: string;
  asset_type: StrategicAssetType;
  status: CeoStatus;
  priority: PriorityLevel;
  potential: string;
  main_risk: string;
  next_action: string;
  description: string;
}

// ── Helpers ──
const genId = () => `_temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const orgTypeOptions = Object.entries(organizationTypeLabels).map(([v, l]) => ({ value: v, label: l }));
const assetTypeOptions = Object.entries(assetTypeLabels).map(([v, l]) => ({ value: v, label: l }));
const stakeholderTypeOptions = [
  { value: "decisor", label: "Decisor" },
  { value: "operacional", label: "Operacional" },
  { value: "tecnico", label: "Técnico" },
  { value: "comercial", label: "Comercial" },
  { value: "aprovador", label: "Aprovador" },
  { value: "consultor", label: "Consultor" },
  { value: "outro", label: "Outro" },
];

// ── Section Toggle ──
const Section = ({ title, icon: Icon, open, onToggle, children, badge }: {
  title: string; icon: any; open: boolean; onToggle: () => void; children: React.ReactNode; badge?: string;
}) => (
  <Card className="border-border/60">
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors rounded-t-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <span className="font-semibold text-sm">{title}</span>
        {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
    {open && <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>}
  </Card>
);

// ── Existing entity select with inline create ──
const EntityPicker = ({ label, tableName, value, onChange, nameField = "name", inlineContent }: {
  label: string; tableName: string; value: string | null; onChange: (v: string | null) => void;
  nameField?: string; inlineContent?: React.ReactNode;
}) => {
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    (supabase as any).from(tableName).select(`id, ${nameField}`).order(nameField)
      .then(({ data }: any) => setOptions((data || []).map((d: any) => ({ id: d.id, name: d[nameField] }))));
  }, [tableName, nameField]);

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Select value={value || "_none"} onValueChange={v => onChange(v === "_none" ? null : v)}>
          <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nenhum</SelectItem>
            {options.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {inlineContent && (
          <Button type="button" variant="outline" size="sm" className="h-9 px-2" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
      {showCreate && inlineContent}
    </div>
  );
};

// ── Main Component ──
const CeoInitiativeCreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Mode: visual or conversational
  const [mode, setMode] = useState<"visual" | "ia">("visual");

  // Section 1 - Main data
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [status, setStatus] = useState<CeoStatus>("ativo");
  const [priority, setPriority] = useState<PriorityLevel>("media");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [potential, setPotential] = useState("");
  const [mainRisk, setMainRisk] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [strategicNotes, setStrategicNotes] = useState("");

  // Section 2 - Classification
  const [canBeProduct, setCanBeProduct] = useState("nao");
  const [isModular, setIsModular] = useState(false);

  // Section 3 - Organizations
  const [orgPrincipalId, setOrgPrincipalId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [newOrgs, setNewOrgs] = useState<InlineOrg[]>([]);

  // Section 4 - Stakeholders
  const [selectedStakeholderIds, setSelectedStakeholderIds] = useState<string[]>([]);
  const [newStakeholders, setNewStakeholders] = useState<InlineStakeholder[]>([]);

  // Section 5 - Products/Projects/Assets
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [newProducts, setNewProducts] = useState<InlineProduct[]>([]);
  const [newProjects, setNewProjects] = useState<InlineProject[]>([]);
  const [newAssets, setNewAssets] = useState<InlineAsset[]>([]);

  // Section 6 - Financial
  const [hasCommercialModel, setHasCommercialModel] = useState(false);
  const [setupEstimated, setSetupEstimated] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [estimatedRevenue, setEstimatedRevenue] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [financialNotes, setFinancialNotes] = useState("");

  // Section 6 - Infra
  const [urlProd, setUrlProd] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [stack, setStack] = useState("");
  const [hosting, setHosting] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [infraNotes, setInfraNotes] = useState("");

  // Section 6 - Docs
  const [docLinks, setDocLinks] = useState("");
  const [docNotes, setDocNotes] = useState("");

  // Section 6 - Commercial
  const [benchmark, setBenchmark] = useState("");
  const [positioning, setPositioning] = useState("");
  const [valueMessage, setValueMessage] = useState("");
  const [commercialNotes, setCommercialNotes] = useState("");

  // Sections open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true, classification: false, orgs: false, stakeholders: false,
    entities: false, financial: false, infra: false, docs: false, commercial: false, preview: false,
  });

  const toggleSection = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  // AI conversational mode state
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Existing entity names for preview
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [stakeholderNames, setStakeholderNames] = useState<Record<string, string>>({});
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});
  const [existingStakeholders, setExistingStakeholders] = useState<{ id: string; name: string; role_title: string }[]>([]);

  useEffect(() => {
    Promise.all([
      (supabase as any).from("organizations").select("id, name"),
      (supabase as any).from("stakeholders").select("id, name, role_title"),
      (supabase as any).from("products").select("id, name"),
      (supabase as any).from("projects").select("id, name"),
      (supabase as any).from("strategic_assets").select("id, name"),
    ]).then(([orgs, stkh, prods, projs, assets]) => {
      const toMap = (arr: any[]) => Object.fromEntries((arr || []).map((r: any) => [r.id, r.name]));
      setOrgNames(toMap(orgs.data));
      setStakeholderNames(toMap(stkh.data));
      setExistingStakeholders(stkh.data || []);
      setProductNames(toMap(prods.data));
      setProjectNames(toMap(projs.data));
      setAssetNames(toMap(assets.data));
    });
  }, []);

  // ── Saving ──
  const [saving, setSaving] = useState(false);

  const countNewEntities = () => {
    let count = 0;
    count += newOrgs.length;
    count += newStakeholders.length;
    count += newProducts.length;
    count += newProjects.length;
    count += newAssets.length;
    return count;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    setSaving(true);

    try {
      // 1. Create inline orgs
      const orgIdMap: Record<string, string> = {};
      for (const org of newOrgs) {
        const { _tempId, ...orgData } = org;
        const { data, error } = await (supabase as any).from("organizations").insert(orgData).select("id").single();
        if (error) throw new Error(`Erro ao criar organização "${org.name}": ${error.message}`);
        orgIdMap[_tempId] = data.id;
      }

      // Resolve org IDs (could be temp IDs from inline creates)
      const resolveOrgId = (id: string | null) => {
        if (!id) return null;
        return orgIdMap[id] || id;
      };

      // 2. Create initiative
      const { data: ini, error: iniError } = await (supabase as any).from("initiatives").insert({
        name, short_name: shortName || null, status, priority,
        deadline: deadline || null, description: description || null,
        potential: potential || null, main_risk: mainRisk || null,
        next_action: nextAction || null, strategic_notes: strategicNotes || null,
        organization_id: resolveOrgId(orgPrincipalId),
        partner_organization_id: resolveOrgId(partnerId),
        pilot_organization_id: resolveOrgId(pilotId),
        strategic_asset_id: selectedAssetId,
      }).select("id").single();

      if (iniError) throw new Error(`Erro ao criar iniciativa: ${iniError.message}`);
      const initiativeId = ini.id;

      // 3. Create inline stakeholders and link
      const stakeholderIdMap: Record<string, string> = {};
      for (const s of newStakeholders) {
        const { _tempId, role_in_initiative, ...sData } = s;
        const orgId = resolveOrgId(sData.organization_id);
        const { data, error } = await (supabase as any).from("stakeholders").insert({ ...sData, organization_id: orgId }).select("id").single();
        if (error) throw new Error(`Erro ao criar stakeholder "${s.name}": ${error.message}`);
        stakeholderIdMap[_tempId] = data.id;
        // Link to initiative
        await (supabase as any).from("initiative_stakeholders").insert({
          initiative_id: initiativeId, stakeholder_id: data.id, role: role_in_initiative || null,
        });
      }

      // Link existing stakeholders
      if (selectedStakeholderIds.length > 0) {
        const links = selectedStakeholderIds.map(sid => ({
          initiative_id: initiativeId, stakeholder_id: sid,
        }));
        await (supabase as any).from("initiative_stakeholders").insert(links);
      }

      // 4. Create inline products
      for (const p of newProducts) {
        const { _tempId, ...pData } = p;
        const pilotOrgId = resolveOrgId(pData.pilot_organization_id);
        await (supabase as any).from("products").insert({ ...pData, pilot_organization_id: pilotOrgId });
      }

      // Link existing product via project
      if (selectedProjectId) {
        await (supabase as any).from("projects").update({
          initiative_id: initiativeId,
          product_id: selectedProductId,
        }).eq("id", selectedProjectId);
      }

      // 5. Create inline projects
      for (const pr of newProjects) {
        const { _tempId, ...prData } = pr;
        await (supabase as any).from("projects").insert({ ...prData, initiative_id: initiativeId });
      }

      // 6. Create inline assets
      for (const a of newAssets) {
        const { _tempId, ...aData } = a;
        const { data } = await (supabase as any).from("strategic_assets").insert(aData).select("id").single();
        if (data && !selectedAssetId) {
          await (supabase as any).from("initiatives").update({ strategic_asset_id: data.id }).eq("id", initiativeId);
        }
      }

      // 7. Create infrastructure record if data provided
      if (urlProd || githubUrl || stack || hosting || integrations || infraNotes) {
        await (supabase as any).from("infrastructures").insert({
          name: `Infra - ${name}`,
          initiative_id: initiativeId,
          url_production: urlProd || null,
          github_url: githubUrl || null,
          stack: stack || null,
          environments: hosting || null,
          integrations: integrations || null,
          notes: infraNotes || null,
        });
      }

      // 8. Create initial history entry
      await (supabase as any).from("initiative_history").insert({
        initiative_id: initiativeId,
        entry_type: "atualizacao",
        title: "Iniciativa criada",
        content: `Iniciativa "${name}" criada via cadastro relacional guiado. ${countNewEntities()} entidades inline criadas. ${selectedStakeholderIds.length} stakeholders existentes vinculados.`,
        source: "cadastro_relacional",
        author: "Sistema",
      });

      toast({ title: "✅ Iniciativa criada com sucesso!", description: `${name} — ${countNewEntities() + selectedStakeholderIds.length} vínculos criados` });
      navigate(`/ceo/iniciativas/${initiativeId}`);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── AI conversational mode ──
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const updatedMessages = [...aiMessages, userMsg];
    setAiMessages(updatedMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ceo-ai-assistant", {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          mode: "initiative_creation",
        },
      });

      if (error) throw error;
      const reply = data?.reply || "Desculpe, não consegui processar.";
      setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // If entities were created, show toast
      if (data?.created_entities?.length > 0) {
        toast({
          title: `✅ ${data.created_entities.length} entidade(s) criada(s)`,
          description: data.created_entities.join(", "),
        });
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // ── Inline entity add helpers ──
  const addNewOrg = () => setNewOrgs(p => [...p, {
    _tempId: genId(), name: "", short_name: "", type: "cliente" as OrganizationType,
    segment: "", status: "ativo" as CeoStatus, notes: "",
  }]);

  const addNewStakeholder = () => setNewStakeholders(p => [...p, {
    _tempId: genId(), name: "", role_title: "", organization_id: null,
    email: "", phone: "", stakeholder_type: "outro", notes: "", role_in_initiative: "",
  }]);

  const addNewProduct = () => setNewProducts(p => [...p, {
    _tempId: genId(), name: "", category: "", status: "ativo" as CeoStatus,
    pilot_organization_id: null, description: "", notes: "",
  }]);

  const addNewProject = () => setNewProjects(p => [...p, {
    _tempId: genId(), name: "", status: "ativo" as CeoStatus, priority: "media" as PriorityLevel,
    main_risk: "", next_action: "", scope_summary: "",
  }]);

  const addNewAsset = () => setNewAssets(p => [...p, {
    _tempId: genId(), name: "", short_name: "", asset_type: "ideia" as StrategicAssetType,
    status: "em_analise" as CeoStatus, priority: "media" as PriorityLevel,
    potential: "", main_risk: "", next_action: "", description: "",
  }]);

  const removeNewOrg = (tempId: string) => setNewOrgs(p => p.filter(o => o._tempId !== tempId));
  const removeNewStakeholder = (tempId: string) => setNewStakeholders(p => p.filter(s => s._tempId !== tempId));
  const removeNewProduct = (tempId: string) => setNewProducts(p => p.filter(pr => pr._tempId !== tempId));
  const removeNewProject = (tempId: string) => setNewProjects(p => p.filter(pr => pr._tempId !== tempId));
  const removeNewAsset = (tempId: string) => setNewAssets(p => p.filter(a => a._tempId !== tempId));

  const updateNewOrg = (tempId: string, field: string, value: any) =>
    setNewOrgs(p => p.map(o => o._tempId === tempId ? { ...o, [field]: value } : o));
  const updateNewStakeholder = (tempId: string, field: string, value: any) =>
    setNewStakeholders(p => p.map(s => s._tempId === tempId ? { ...s, [field]: value } : s));
  const updateNewProduct = (tempId: string, field: string, value: any) =>
    setNewProducts(p => p.map(pr => pr._tempId === tempId ? { ...pr, [field]: value } : pr));
  const updateNewProject = (tempId: string, field: string, value: any) =>
    setNewProjects(p => p.map(pr => pr._tempId === tempId ? { ...pr, [field]: value } : pr));
  const updateNewAsset = (tempId: string, field: string, value: any) =>
    setNewAssets(p => p.map(a => a._tempId === tempId ? { ...a, [field]: value } : a));

  // ── Stakeholder multi-select ──
  const toggleExistingStakeholder = (id: string) => {
    setSelectedStakeholderIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ── Preview counts ──
  const previewStats = {
    orgs: (orgPrincipalId ? 1 : 0) + (partnerId ? 1 : 0) + (pilotId ? 1 : 0) + newOrgs.length,
    stakeholders: selectedStakeholderIds.length + newStakeholders.length,
    products: (selectedProductId ? 1 : 0) + newProducts.length,
    projects: (selectedProjectId ? 1 : 0) + newProjects.length,
    assets: (selectedAssetId ? 1 : 0) + newAssets.length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/ceo/iniciativas")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Nova Iniciativa — Cadastro Relacional</h1>
              <p className="text-xs text-muted-foreground">Cadastro guiado com vínculos completos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={mode} onValueChange={v => setMode(v as "visual" | "ia")}>
              <TabsList className="h-8">
                <TabsTrigger value="visual" className="text-xs px-3 h-7 gap-1">
                  <FolderKanban className="h-3 w-3" /> Visual
                </TabsTrigger>
                <TabsTrigger value="ia" className="text-xs px-3 h-7 gap-1">
                  <Bot className="h-3 w-3" /> IA Conversacional
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {mode === "visual" ? (
          /* ═══════════════════════════════════════════ VISUAL MODE ═══════════════════════════════════════════ */
          <div className="space-y-4">
            {/* SECTION 1 — Dados Principais */}
            <Section title="Dados Principais da Iniciativa" icon={Shield} open={openSections.main} onToggle={() => toggleSection("main")}>
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2"><Label className="text-xs">Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da iniciativa" /></div>
                  <div><Label className="text-xs">Sigla</Label><Input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="Ex: SGORJ" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label className="text-xs">Status</Label>
                    <Select value={status} onValueChange={v => setStatus(v as CeoStatus)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ceoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Prioridade</Label>
                    <Select value={priority} onValueChange={v => setPriority(v as PriorityLevel)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Prazo</Label><Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-9 text-sm" /></div>
                </div>
                <div><Label className="text-xs">Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descrição executiva da iniciativa" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Potencial</Label><Input value={potential} onChange={e => setPotential(e.target.value)} placeholder="Impacto esperado" /></div>
                  <div><Label className="text-xs">Risco Principal</Label><Input value={mainRisk} onChange={e => setMainRisk(e.target.value)} placeholder="Maior risco identificado" /></div>
                </div>
                <div><Label className="text-xs">Próxima Ação</Label><Input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="O que precisa ser feito agora" /></div>
                <div><Label className="text-xs">Notas Estratégicas</Label><Textarea value={strategicNotes} onChange={e => setStrategicNotes(e.target.value)} rows={2} placeholder="Contexto estratégico, premissas, observações" /></div>
              </div>
            </Section>

            {/* SECTION 2 — Classificação */}
            <Section title="Classificação" icon={Shield} open={openSections.classification} onToggle={() => toggleSection("classification")}>
              <div className="space-y-3 mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Pode virar produto?</Label>
                    <Select value={canBeProduct} onValueChange={setCanBeProduct}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="ja_e">Já é produto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <Switch checked={isModular} onCheckedChange={setIsModular} />
                    <Label className="text-xs">É modular / reaproveitável?</Label>
                  </div>
                </div>
                <EntityPicker label="Ativo Estratégico Relacionado" tableName="strategic_assets" value={selectedAssetId} onChange={setSelectedAssetId} />
                <EntityPicker label="Produto Relacionado" tableName="products" value={selectedProductId} onChange={setSelectedProductId} />
                <EntityPicker label="Projeto Relacionado" tableName="projects" value={selectedProjectId} onChange={setSelectedProjectId} />
              </div>
            </Section>

            {/* SECTION 3 — Organizações */}
            <Section title="Organizações Relacionadas" icon={Building2} open={openSections.orgs} onToggle={() => toggleSection("orgs")} badge={previewStats.orgs > 0 ? `${previewStats.orgs}` : undefined}>
              <div className="space-y-4 mt-3">
                <EntityPicker label="Organização Principal" tableName="organizations" value={orgPrincipalId} onChange={setOrgPrincipalId} />
                <EntityPicker label="Parceiro" tableName="organizations" value={partnerId} onChange={setPartnerId} />
                <EntityPicker label="Cliente Piloto" tableName="organizations" value={pilotId} onChange={setPilotId} />

                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Novas organizações ({newOrgs.length})</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNewOrg}><Plus className="h-3 w-3 mr-1" /> Criar organização</Button>
                </div>
                {newOrgs.map(org => (
                  <Card key={org._tempId} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">Nova organização</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewOrg(org._tempId)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome *" value={org.name} onChange={e => updateNewOrg(org._tempId, "name", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Nome curto" value={org.short_name} onChange={e => updateNewOrg(org._tempId, "short_name", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={org.type} onValueChange={v => updateNewOrg(org._tempId, "type", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>{orgTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Segmento" value={org.segment} onChange={e => updateNewOrg(org._tempId, "segment", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Textarea placeholder="Observações" value={org.notes} onChange={e => updateNewOrg(org._tempId, "notes", e.target.value)} rows={1} className="text-xs" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            {/* SECTION 4 — Stakeholders */}
            <Section title="Stakeholders" icon={Users} open={openSections.stakeholders} onToggle={() => toggleSection("stakeholders")} badge={previewStats.stakeholders > 0 ? `${previewStats.stakeholders}` : undefined}>
              <div className="space-y-4 mt-3">
                {/* Existing stakeholders */}
                <div>
                  <Label className="text-xs">Vincular stakeholders existentes</Label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {existingStakeholders.map(s => (
                      <button key={s.id} type="button" onClick={() => toggleExistingStakeholder(s.id)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selectedStakeholderIds.includes(s.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                        }`}>
                        {s.name}{s.role_title ? ` · ${s.role_title}` : ""}
                        {selectedStakeholderIds.includes(s.id) && <Check className="h-3 w-3 inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Novos stakeholders ({newStakeholders.length})</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNewStakeholder}><Plus className="h-3 w-3 mr-1" /> Criar stakeholder</Button>
                </div>
                {newStakeholders.map(s => (
                  <Card key={s._tempId} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">Novo stakeholder</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewStakeholder(s._tempId)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome *" value={s.name} onChange={e => updateNewStakeholder(s._tempId, "name", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Cargo/papel" value={s.role_title} onChange={e => updateNewStakeholder(s._tempId, "role_title", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Email" value={s.email} onChange={e => updateNewStakeholder(s._tempId, "email", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Telefone" value={s.phone} onChange={e => updateNewStakeholder(s._tempId, "phone", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={s.stakeholder_type} onValueChange={v => updateNewStakeholder(s._tempId, "stakeholder_type", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>{stakeholderTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Papel na iniciativa" value={s.role_in_initiative} onChange={e => updateNewStakeholder(s._tempId, "role_in_initiative", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Textarea placeholder="Observações" value={s.notes} onChange={e => updateNewStakeholder(s._tempId, "notes", e.target.value)} rows={1} className="text-xs" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            {/* SECTION 5 — Produtos, Projetos, Ativos */}
            <Section title="Produtos, Projetos e Ativos" icon={Package} open={openSections.entities} onToggle={() => toggleSection("entities")}
              badge={(previewStats.products + previewStats.projects + previewStats.assets) > 0 ? `${previewStats.products + previewStats.projects + previewStats.assets}` : undefined}>
              <div className="space-y-4 mt-3">
                {/* Products */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Produtos ({newProducts.length})</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNewProduct}><Plus className="h-3 w-3 mr-1" /> Criar produto</Button>
                </div>
                {newProducts.map(p => (
                  <Card key={p._tempId} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">Novo produto</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewProduct(p._tempId)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome *" value={p.name} onChange={e => updateNewProduct(p._tempId, "name", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Categoria" value={p.category} onChange={e => updateNewProduct(p._tempId, "category", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Textarea placeholder="Descrição" value={p.description} onChange={e => updateNewProduct(p._tempId, "description", e.target.value)} rows={1} className="text-xs" />
                    </CardContent>
                  </Card>
                ))}

                <Separator />

                {/* Projects */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Projetos ({newProjects.length})</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNewProject}><Plus className="h-3 w-3 mr-1" /> Criar projeto</Button>
                </div>
                {newProjects.map(pr => (
                  <Card key={pr._tempId} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">Novo projeto</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewProject(pr._tempId)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome *" value={pr.name} onChange={e => updateNewProject(pr._tempId, "name", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Risco principal" value={pr.main_risk} onChange={e => updateNewProject(pr._tempId, "main_risk", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Input placeholder="Próxima ação" value={pr.next_action} onChange={e => updateNewProject(pr._tempId, "next_action", e.target.value)} className="h-8 text-xs" />
                      <Textarea placeholder="Escopo resumido" value={pr.scope_summary} onChange={e => updateNewProject(pr._tempId, "scope_summary", e.target.value)} rows={1} className="text-xs" />
                    </CardContent>
                  </Card>
                ))}

                <Separator />

                {/* Strategic Assets */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Ativos estratégicos ({newAssets.length})</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addNewAsset}><Plus className="h-3 w-3 mr-1" /> Criar ativo</Button>
                </div>
                {newAssets.map(a => (
                  <Card key={a._tempId} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">Novo ativo estratégico</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewAsset(a._tempId)}><X className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome *" value={a.name} onChange={e => updateNewAsset(a._tempId, "name", e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Sigla" value={a.short_name} onChange={e => updateNewAsset(a._tempId, "short_name", e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={a.asset_type} onValueChange={v => updateNewAsset(a._tempId, "asset_type", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>{assetTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={a.priority} onValueChange={v => updateNewAsset(a._tempId, "priority", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                          <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Textarea placeholder="Descrição executiva" value={a.description} onChange={e => updateNewAsset(a._tempId, "description", e.target.value)} rows={1} className="text-xs" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>

            {/* SECTION 6 — Dados complementares (tabs) */}
            <Section title="Dados Complementares" icon={DollarSign} open={openSections.financial} onToggle={() => toggleSection("financial")}>
              <Tabs defaultValue="financeiro" className="mt-3">
                <TabsList className="h-8">
                  <TabsTrigger value="financeiro" className="text-xs h-7"><DollarSign className="h-3 w-3 mr-1" /> Financeiro</TabsTrigger>
                  <TabsTrigger value="infra" className="text-xs h-7"><Server className="h-3 w-3 mr-1" /> Infraestrutura</TabsTrigger>
                  <TabsTrigger value="docs" className="text-xs h-7"><FileText className="h-3 w-3 mr-1" /> Documentos</TabsTrigger>
                  <TabsTrigger value="comercial" className="text-xs h-7"><Megaphone className="h-3 w-3 mr-1" /> Comercial</TabsTrigger>
                </TabsList>

                <TabsContent value="financeiro" className="space-y-3 mt-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={hasCommercialModel} onCheckedChange={setHasCommercialModel} />
                    <Label className="text-xs">Possui modelo comercial definido?</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Setup previsto (R$)</Label><Input value={setupEstimated} onChange={e => setSetupEstimated(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Mensalidade prevista (R$)</Label><Input value={monthlyRevenue} onChange={e => setMonthlyRevenue(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Receita prevista (R$)</Label><Input value={estimatedRevenue} onChange={e => setEstimatedRevenue(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Custo estimado (R$)</Label><Input value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} placeholder="0,00" className="h-8 text-xs" /></div>
                  </div>
                  <div><Label className="text-xs">Observações financeiras</Label><Textarea value={financialNotes} onChange={e => setFinancialNotes(e.target.value)} rows={2} className="text-xs" /></div>
                </TabsContent>

                <TabsContent value="infra" className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">URL principal</Label><Input value={urlProd} onChange={e => setUrlProd(e.target.value)} placeholder="https://..." className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Repositório GitHub</Label><Input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Stack</Label><Input value={stack} onChange={e => setStack(e.target.value)} placeholder="React, Node, Supabase..." className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Hospedagem</Label><Input value={hosting} onChange={e => setHosting(e.target.value)} placeholder="Vercel, AWS, etc." className="h-8 text-xs" /></div>
                  </div>
                  <div><Label className="text-xs">Integrações relevantes</Label><Input value={integrations} onChange={e => setIntegrations(e.target.value)} placeholder="WhatsApp, Email, APIs..." className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Observações de infraestrutura</Label><Textarea value={infraNotes} onChange={e => setInfraNotes(e.target.value)} rows={2} className="text-xs" /></div>
                </TabsContent>

                <TabsContent value="docs" className="space-y-3 mt-3">
                  <div><Label className="text-xs">Links úteis</Label><Textarea value={docLinks} onChange={e => setDocLinks(e.target.value)} rows={2} placeholder="Um link por linha" className="text-xs" /></div>
                  <div><Label className="text-xs">Observações documentais</Label><Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} className="text-xs" /></div>
                </TabsContent>

                <TabsContent value="comercial" className="space-y-3 mt-3">
                  <div><Label className="text-xs">Benchmark</Label><Input value={benchmark} onChange={e => setBenchmark(e.target.value)} placeholder="Concorrentes / referências" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Posicionamento</Label><Input value={positioning} onChange={e => setPositioning(e.target.value)} placeholder="Como se posiciona no mercado" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Mensagem de valor</Label><Textarea value={valueMessage} onChange={e => setValueMessage(e.target.value)} rows={2} placeholder="Proposta de valor principal" className="text-xs" /></div>
                  <div><Label className="text-xs">Observações comerciais</Label><Textarea value={commercialNotes} onChange={e => setCommercialNotes(e.target.value)} rows={2} className="text-xs" /></div>
                </TabsContent>
              </Tabs>
            </Section>

            {/* SECTION 7 — Preview */}
            <Section title="Preview Relacional" icon={Eye} open={openSections.preview} onToggle={() => toggleSection("preview")}>
              <div className="mt-3 space-y-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Resumo do cadastro</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <p><strong>Nome:</strong> {name || "—"}</p>
                      <p><strong>Sigla:</strong> {shortName || "—"}</p>
                      <p><strong>Status:</strong> <Badge className={`${statusColors[status]} text-xs`}>{ceoStatusLabels[status]}</Badge></p>
                      <p><strong>Prioridade:</strong> <Badge className={`${priorityColors[priority]} text-xs`}>{priorityLabels[priority]}</Badge></p>
                    </div>

                    {(orgPrincipalId || partnerId || pilotId || newOrgs.length > 0) && (
                      <>
                        <Separator className="my-2" />
                        <p className="font-semibold text-xs text-muted-foreground">🏢 Organizações ({previewStats.orgs})</p>
                        {orgPrincipalId && <p className="text-xs">• Principal: {orgNames[orgPrincipalId] || orgPrincipalId}</p>}
                        {partnerId && <p className="text-xs">• Parceiro: {orgNames[partnerId] || partnerId}</p>}
                        {pilotId && <p className="text-xs">• Piloto: {orgNames[pilotId] || pilotId}</p>}
                        {newOrgs.map(o => <p key={o._tempId} className="text-xs text-primary">• 🆕 {o.name || "(sem nome)"} ({organizationTypeLabels[o.type]})</p>)}
                      </>
                    )}

                    {(selectedStakeholderIds.length > 0 || newStakeholders.length > 0) && (
                      <>
                        <Separator className="my-2" />
                        <p className="font-semibold text-xs text-muted-foreground">👥 Stakeholders ({previewStats.stakeholders})</p>
                        {selectedStakeholderIds.map(id => <p key={id} className="text-xs">• {stakeholderNames[id] || id}</p>)}
                        {newStakeholders.map(s => <p key={s._tempId} className="text-xs text-primary">• 🆕 {s.name || "(sem nome)"} — {s.role_title || "sem cargo"}</p>)}
                      </>
                    )}

                    {(newProducts.length > 0 || newProjects.length > 0 || newAssets.length > 0 || selectedProductId || selectedProjectId || selectedAssetId) && (
                      <>
                        <Separator className="my-2" />
                        <p className="font-semibold text-xs text-muted-foreground">📦 Entidades ({previewStats.products + previewStats.projects + previewStats.assets})</p>
                        {selectedProductId && <p className="text-xs">• Produto: {productNames[selectedProductId] || selectedProductId}</p>}
                        {selectedProjectId && <p className="text-xs">• Projeto: {projectNames[selectedProjectId] || selectedProjectId}</p>}
                        {selectedAssetId && <p className="text-xs">• Ativo: {assetNames[selectedAssetId] || selectedAssetId}</p>}
                        {newProducts.map(p => <p key={p._tempId} className="text-xs text-primary">• 🆕 Produto: {p.name || "(sem nome)"}</p>)}
                        {newProjects.map(p => <p key={p._tempId} className="text-xs text-primary">• 🆕 Projeto: {p.name || "(sem nome)"}</p>)}
                        {newAssets.map(a => <p key={a._tempId} className="text-xs text-primary">• 🆕 Ativo: {a.name || "(sem nome)"}</p>)}
                      </>
                    )}

                    {(urlProd || githubUrl || stack) && (
                      <>
                        <Separator className="my-2" />
                        <p className="font-semibold text-xs text-muted-foreground">🖥️ Infraestrutura</p>
                        {urlProd && <p className="text-xs">• URL: {urlProd}</p>}
                        {githubUrl && <p className="text-xs">• GitHub: {githubUrl}</p>}
                        {stack && <p className="text-xs">• Stack: {stack}</p>}
                      </>
                    )}

                    {hasCommercialModel && (
                      <>
                        <Separator className="my-2" />
                        <p className="font-semibold text-xs text-muted-foreground">💰 Financeiro</p>
                        {setupEstimated && <p className="text-xs">• Setup: R$ {setupEstimated}</p>}
                        {monthlyRevenue && <p className="text-xs">• Mensalidade: R$ {monthlyRevenue}</p>}
                        {estimatedRevenue && <p className="text-xs">• Receita prev.: R$ {estimatedRevenue}</p>}
                        {estimatedCost && <p className="text-xs">• Custo est.: R$ {estimatedCost}</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </Section>

            {/* SAVE BAR */}
            <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-4 -mx-6 px-6">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {name ? `"${name}"` : "Sem nome"} · {previewStats.orgs} orgs · {previewStats.stakeholders} stakeholders · {previewStats.products + previewStats.projects + previewStats.assets} entidades
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/ceo/iniciativas")}>Cancelar</Button>
                  <Button onClick={() => { setOpenSections(p => ({ ...p, preview: true })); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }} variant="secondary">
                    <Eye className="h-4 w-4 mr-2" /> Preview
                  </Button>
                  <Button onClick={handleSave} disabled={!name.trim() || saving} className="min-w-[180px]">
                    <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Criar Iniciativa com Vínculos"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════ AI MODE ═══════════════════════════════════════════ */
          <div className="flex flex-col h-[calc(100vh-140px)]">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-sm">Assistente de Cadastro</CardTitle>
                    <p className="text-xs text-muted-foreground">Descreva a iniciativa e eu cuido do resto</p>
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {aiMessages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-40" />
                      <p className="text-sm font-medium mb-2">Modo Conversacional</p>
                      <p className="text-xs max-w-md mx-auto">
                        Descreva a iniciativa de forma natural. Exemplo: <br />
                        <em>"Crie uma iniciativa para a SGORJ com o Ariel como stakeholder, parceria com a AEG, produto de sistema de gestão"</em>
                      </p>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none
                            prose-table:border prose-table:border-border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-border
                            prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-xl px-4 py-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="animate-pulse">●</div>
                          <div className="animate-pulse delay-150">●</div>
                          <div className="animate-pulse delay-300">●</div>
                          <span className="text-xs ml-1">Processando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                    placeholder="Descreva a iniciativa ou peça para a IA cadastrar..."
                    className="flex-1"
                    disabled={aiLoading}
                  />
                  <Button onClick={sendAiMessage} disabled={!aiInput.trim() || aiLoading}>
                    Enviar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CeoInitiativeCreate;


-- =============================================
-- SISTEMA CEO EXUDUSTECH - TABELAS CORE
-- =============================================

-- Enum types for CEO domain
CREATE TYPE public.organization_type AS ENUM ('cliente', 'parceiro', 'piloto', 'instituicao', 'organizacao_mae', 'unidade', 'interno');
CREATE TYPE public.strategic_asset_type AS ENUM ('ideia', 'oportunidade', 'sistema', 'agente', 'produto', 'framework', 'ativo_adquirido', 'ativo_conhecimento');
CREATE TYPE public.priority_level AS ENUM ('critica', 'alta', 'media', 'baixa');
CREATE TYPE public.ceo_status AS ENUM ('ativo', 'pausado', 'concluido', 'cancelado', 'em_analise', 'arquivado');
CREATE TYPE public.task_status AS ENUM ('todo', 'doing', 'done', 'bloqueado', 'aguardando_terceiro', 'pausado');
CREATE TYPE public.stakeholder_type AS ENUM ('decisor', 'operacional', 'tecnico', 'comercial', 'aprovador', 'consultor', 'outro');
CREATE TYPE public.financial_status AS ENUM ('pendente', 'pago', 'recebido', 'atrasado', 'cancelado', 'parcial');
CREATE TYPE public.recurrence_type AS ENUM ('mensal', 'trimestral', 'semestral', 'anual', 'avulso');
CREATE TYPE public.document_type AS ENUM ('contrato', 'proposta', 'apresentacao', 'relatorio', 'parecer', 'nota_fiscal', 'documento_fiscal', 'extrato', 'gravacao', 'material_marketing', 'print', 'anexo_tecnico', 'outro');

-- =============================================
-- 1. ORGANIZAÇÕES
-- =============================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  type organization_type NOT NULL DEFAULT 'cliente',
  segment TEXT,
  parent_organization_id UUID REFERENCES public.organizations(id),
  status ceo_status NOT NULL DEFAULT 'ativo',
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. STAKEHOLDERS
-- =============================================
CREATE TABLE public.stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_title TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  email TEXT,
  phone TEXT,
  stakeholder_type stakeholder_type NOT NULL DEFAULT 'outro',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. ATIVOS ESTRATÉGICOS
-- =============================================
CREATE TABLE public.strategic_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  asset_type strategic_asset_type NOT NULL DEFAULT 'ideia',
  description TEXT,
  status ceo_status NOT NULL DEFAULT 'em_analise',
  priority priority_level DEFAULT 'media',
  potential TEXT,
  main_risk TEXT,
  next_action TEXT,
  deadline DATE,
  organization_id UUID REFERENCES public.organizations(id),
  partner_organization_id UUID REFERENCES public.organizations(id),
  pilot_organization_id UUID REFERENCES public.organizations(id),
  strategic_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 4. INICIATIVAS
-- =============================================
CREATE TABLE public.initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  partner_organization_id UUID REFERENCES public.organizations(id),
  pilot_organization_id UUID REFERENCES public.organizations(id),
  strategic_asset_id UUID REFERENCES public.strategic_assets(id),
  status ceo_status NOT NULL DEFAULT 'ativo',
  priority priority_level DEFAULT 'media',
  potential TEXT,
  main_risk TEXT,
  next_action TEXT,
  deadline DATE,
  strategic_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. PRODUTOS
-- =============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status ceo_status NOT NULL DEFAULT 'em_analise',
  pilot_organization_id UUID REFERENCES public.organizations(id),
  benchmark TEXT,
  value_message TEXT,
  commercial_model TEXT,
  price NUMERIC,
  modularity_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 6. PROJETOS
-- =============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initiative_id UUID REFERENCES public.initiatives(id),
  product_id UUID REFERENCES public.products(id),
  responsible TEXT,
  status ceo_status NOT NULL DEFAULT 'ativo',
  priority priority_level DEFAULT 'media',
  start_date DATE,
  end_date DATE,
  scope_summary TEXT,
  main_risk TEXT,
  next_action TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 7. TAREFAS
-- =============================================
CREATE TABLE public.ceo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  responsible TEXT,
  deadline DATE,
  priority priority_level DEFAULT 'media',
  status task_status NOT NULL DEFAULT 'todo',
  dependency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 8. EVENTOS / AGENDA
-- =============================================
CREATE TABLE public.ceo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 9. DECISÕES
-- =============================================
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  initiative_id UUID REFERENCES public.initiatives(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by TEXT,
  impact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 10. LIÇÕES APRENDIDAS
-- =============================================
CREATE TABLE public.lessons_learned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  lesson_date DATE DEFAULT CURRENT_DATE,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 11. HISTÓRICO DE INICIATIVAS
-- =============================================
CREATE TABLE public.initiative_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID REFERENCES public.initiatives(id) NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'atualizacao',
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 12. DOCUMENTOS
-- =============================================
CREATE TABLE public.ceo_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  doc_type document_type NOT NULL DEFAULT 'outro',
  storage_path TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  product_id UUID REFERENCES public.products(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 13. INFRAESTRUTURA
-- =============================================
CREATE TABLE public.infrastructures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  product_id UUID REFERENCES public.products(id),
  url_production TEXT,
  url_staging TEXT,
  github_url TEXT,
  technical_docs_url TEXT,
  functional_docs_url TEXT,
  stack TEXT,
  integrations TEXT,
  environments TEXT,
  linked_emails TEXT,
  linked_accounts TEXT,
  base_prompts TEXT,
  assets TEXT,
  reusable_modules TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 14. CREDENCIAIS (referências seguras)
-- =============================================
CREATE TABLE public.credentials_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  infrastructure_id UUID REFERENCES public.infrastructures(id),
  credential_type TEXT DEFAULT 'api_key',
  reference_hint TEXT,
  vault_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 15. MÓDULOS
-- =============================================
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  origin_product_id UUID REFERENCES public.products(id),
  pluggability_score INTEGER DEFAULT 0,
  documentation_url TEXT,
  has_billing_layer BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.module_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) NOT NULL,
  used_in_initiative_id UUID REFERENCES public.initiatives(id),
  used_in_project_id UUID REFERENCES public.projects(id),
  adaptation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 16. FINANCEIRO
-- =============================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank TEXT,
  current_balance NUMERIC DEFAULT 0,
  committed_balance NUMERIC DEFAULT 0,
  status ceo_status DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  total_limit NUMERIC DEFAULT 0,
  used_limit NUMERIC DEFAULT 0,
  due_day INTEGER,
  status ceo_status DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  product_id UUID REFERENCES public.products(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  expected_amount NUMERIC DEFAULT 0,
  received_amount NUMERIC DEFAULT 0,
  due_date DATE,
  received_date DATE,
  payment_method TEXT,
  status financial_status DEFAULT 'pendente',
  invoice_number TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  category TEXT,
  initiative_id UUID REFERENCES public.initiatives(id),
  project_id UUID REFERENCES public.projects(id),
  product_id UUID REFERENCES public.products(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  amount NUMERIC DEFAULT 0,
  recurrence recurrence_type DEFAULT 'avulso',
  due_date DATE,
  paid_date DATE,
  payment_method TEXT,
  status financial_status DEFAULT 'pendente',
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  category TEXT,
  monthly_amount NUMERIC DEFAULT 0,
  annual_amount NUMERIC DEFAULT 0,
  billing_day INTEGER,
  payment_method TEXT,
  status ceo_status DEFAULT 'ativo',
  criticality priority_level DEFAULT 'media',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 17. FISCAL
-- =============================================
CREATE TABLE public.fiscal_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_type TEXT NOT NULL,
  competence TEXT,
  due_date DATE,
  amount NUMERIC DEFAULT 0,
  status financial_status DEFAULT 'pendente',
  receipt_storage_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 18. PONTE CEO <-> CRM (comunicação)
-- =============================================
CREATE TABLE public.communication_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module TEXT NOT NULL DEFAULT 'ceo',
  channel TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  target_name TEXT,
  target_phone TEXT,
  target_email TEXT,
  message_subject TEXT,
  message_body TEXT,
  requested_by TEXT,
  status TEXT DEFAULT 'pending',
  execution_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- =============================================
-- VINCULAÇÃO: stakeholders <-> iniciativas
-- =============================================
CREATE TABLE public.initiative_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID REFERENCES public.initiatives(id) NOT NULL,
  stakeholder_id UUID REFERENCES public.stakeholders(id) NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(initiative_id, stakeholder_id)
);

-- =============================================
-- RLS para todas as tabelas CEO
-- =============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons_learned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_stakeholders ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can CRUD all CEO tables
-- (same pattern as existing CRM tables)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'organizations', 'stakeholders', 'strategic_assets', 'initiatives',
    'products', 'projects', 'ceo_tasks', 'ceo_events', 'decisions',
    'lessons_learned', 'initiative_history', 'ceo_documents',
    'infrastructures', 'credentials_refs', 'modules', 'module_usages',
    'bank_accounts', 'credit_cards', 'cost_centers', 'revenues',
    'expenses', 'subscriptions', 'fiscal_obligations',
    'communication_requests', 'initiative_stakeholders'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "auth_select_%s" ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', tbl, tbl);
  END LOOP;
END;
$$;

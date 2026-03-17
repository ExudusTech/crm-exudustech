// CEO Domain Types - matching database enums and tables

export type OrganizationType = 'cliente' | 'parceiro' | 'piloto' | 'instituicao' | 'organizacao_mae' | 'unidade' | 'interno';
export type StrategicAssetType = 'ideia' | 'oportunidade' | 'sistema' | 'agente' | 'produto' | 'framework' | 'ativo_adquirido' | 'ativo_conhecimento';
export type PriorityLevel = 'critica' | 'alta' | 'media' | 'baixa';
export type CeoStatus = 'ativo' | 'pausado' | 'concluido' | 'cancelado' | 'em_analise' | 'arquivado';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'bloqueado' | 'aguardando_terceiro' | 'pausado';
export type StakeholderType = 'decisor' | 'operacional' | 'tecnico' | 'comercial' | 'aprovador' | 'consultor' | 'outro';
export type FinancialStatus = 'pendente' | 'pago' | 'recebido' | 'atrasado' | 'cancelado' | 'parcial';
export type RecurrenceType = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'avulso';
export type DocumentType = 'contrato' | 'proposta' | 'apresentacao' | 'relatorio' | 'parecer' | 'nota_fiscal' | 'documento_fiscal' | 'extrato' | 'gravacao' | 'material_marketing' | 'print' | 'anexo_tecnico' | 'outro';

export interface Organization {
  id: string;
  name: string;
  short_name: string | null;
  type: OrganizationType;
  segment: string | null;
  parent_organization_id: string | null;
  status: CeoStatus;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategicAsset {
  id: string;
  name: string;
  short_name: string | null;
  asset_type: StrategicAssetType;
  description: string | null;
  status: CeoStatus;
  priority: PriorityLevel | null;
  potential: string | null;
  main_risk: string | null;
  next_action: string | null;
  deadline: string | null;
  organization_id: string | null;
  partner_organization_id: string | null;
  pilot_organization_id: string | null;
  strategic_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CeoTask {
  id: string;
  title: string;
  description: string | null;
  initiative_id: string | null;
  project_id: string | null;
  responsible: string | null;
  deadline: string | null;
  priority: PriorityLevel | null;
  status: TaskStatus;
  dependency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Labels
export const organizationTypeLabels: Record<OrganizationType, string> = {
  cliente: 'Cliente',
  parceiro: 'Parceiro',
  piloto: 'Piloto',
  instituicao: 'Instituição',
  organizacao_mae: 'Org. Mãe',
  unidade: 'Unidade',
  interno: 'Interno',
};

export const assetTypeLabels: Record<StrategicAssetType, string> = {
  ideia: 'Ideia',
  oportunidade: 'Oportunidade',
  sistema: 'Sistema',
  agente: 'Agente',
  produto: 'Produto',
  framework: 'Framework',
  ativo_adquirido: 'Ativo Adquirido',
  ativo_conhecimento: 'Ativo de Conhecimento',
};

export const priorityLabels: Record<PriorityLevel, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const ceoStatusLabels: Record<CeoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  em_analise: 'Em Análise',
  arquivado: 'Arquivado',
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  doing: 'Fazendo',
  done: 'Concluído',
  bloqueado: 'Bloqueado',
  aguardando_terceiro: 'Aguardando',
  pausado: 'Pausado',
};

export const priorityColors: Record<PriorityLevel, string> = {
  critica: 'bg-destructive text-destructive-foreground',
  alta: 'bg-orange-500 text-white',
  media: 'bg-primary text-primary-foreground',
  baixa: 'bg-muted text-muted-foreground',
};

export const statusColors: Record<CeoStatus, string> = {
  ativo: 'bg-green-600 text-white',
  pausado: 'bg-yellow-500 text-white',
  concluido: 'bg-blue-600 text-white',
  cancelado: 'bg-muted text-muted-foreground',
  em_analise: 'bg-purple-600 text-white',
  arquivado: 'bg-muted text-muted-foreground',
};

export const taskStatusColors: Record<TaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground',
  doing: 'bg-blue-600 text-white',
  done: 'bg-green-600 text-white',
  bloqueado: 'bg-destructive text-destructive-foreground',
  aguardando_terceiro: 'bg-yellow-500 text-white',
  pausado: 'bg-muted text-muted-foreground',
};

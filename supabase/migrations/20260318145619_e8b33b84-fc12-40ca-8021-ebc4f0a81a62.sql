
-- Add new organization_type values
ALTER TYPE public.organization_type ADD VALUE IF NOT EXISTS 'loja';
ALTER TYPE public.organization_type ADD VALUE IF NOT EXISTS 'prestador_servico';

-- Add new ceo_status values
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'em_andamento';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'em_validacao';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'incubando';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'esfriado';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'aguardando_retorno';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'entregue';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'articulacao_estrategica';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'adquirido_nao_implantado';
ALTER TYPE public.ceo_status ADD VALUE IF NOT EXISTS 'bloqueado';

-- Criar tipo enum para status do lead
CREATE TYPE public.lead_status AS ENUM ('em_negociacao', 'aguardando_pagamento', 'ganho', 'perdido');

-- Adicionar coluna status à tabela leads
ALTER TABLE public.leads 
ADD COLUMN status public.lead_status DEFAULT 'em_negociacao';

-- Criar índice para melhorar performance de filtros
CREATE INDEX idx_leads_status ON public.leads(status);
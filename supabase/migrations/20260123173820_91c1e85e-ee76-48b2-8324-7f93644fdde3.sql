-- Adicionar novo status "produzido" ao enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'produzido';

-- Adicionar coluna produzido_at
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS produzido_at TIMESTAMP WITH TIME ZONE;

-- Atualizar oportunidades de publicidade que estão entregues para ter produzido_at = delivered_at
UPDATE public.leads 
SET produzido_at = delivered_at 
WHERE produto = 'Publicidade' 
  AND status = 'entregue' 
  AND delivered_at IS NOT NULL;
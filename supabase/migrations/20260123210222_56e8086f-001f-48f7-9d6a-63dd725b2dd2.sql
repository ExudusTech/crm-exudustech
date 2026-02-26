-- Adicionar campo para rastrear quando o lead entrou em negociação
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS negociacao_at timestamp with time zone DEFAULT NULL;

-- Atualizar leads existentes que estão em negociação (setar a data de updated_at como aproximação)
UPDATE public.leads 
SET negociacao_at = updated_at 
WHERE status = 'em_negociacao' AND negociacao_at IS NULL;

-- Para leads que já passaram por ganho mas não têm negociacao_at, deixar NULL
-- (indica que pularam direto de em_aberto para ganho)
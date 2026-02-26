-- Atualizar o valor padrão da coluna status para 'em_aberto'
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'em_aberto'::lead_status;

-- Atualizar todos os leads que estão em 'em_negociacao' para 'em_aberto'
UPDATE public.leads SET status = 'em_aberto' WHERE status = 'em_negociacao';
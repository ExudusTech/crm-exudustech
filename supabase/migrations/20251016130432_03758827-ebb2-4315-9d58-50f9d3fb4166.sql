-- Adicionar campo para rastrear se valor foi editado manualmente
ALTER TABLE public.leads 
ADD COLUMN valor_manually_edited boolean DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.leads.valor_manually_edited IS 'Indica se o valor foi editado manualmente pelo usuário. Quando true, a IA não deve sobrescrever este valor.';
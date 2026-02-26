-- Adicionar campo de data de atualização da descrição
ALTER TABLE public.leads ADD COLUMN description_updated_at TIMESTAMP WITH TIME ZONE;
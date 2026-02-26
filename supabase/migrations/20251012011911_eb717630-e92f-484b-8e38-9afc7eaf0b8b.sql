-- Adicionar campos valor e produto na tabela leads
ALTER TABLE public.leads 
ADD COLUMN valor NUMERIC,
ADD COLUMN produto TEXT CHECK (produto IN ('palestra', 'consultoria', 'mentoria', 'treinamento'));
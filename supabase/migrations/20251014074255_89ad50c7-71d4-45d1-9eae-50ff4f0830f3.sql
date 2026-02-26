-- Adicionar coluna de moeda na tabela leads
ALTER TABLE public.leads
ADD COLUMN moeda text DEFAULT 'BRL' CHECK (moeda IN ('BRL', 'USD', 'EUR'));
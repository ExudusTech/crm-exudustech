-- Criar tabela de leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  source TEXT DEFAULT 'cloudmailin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy para permitir inserção (necessário para o webhook funcionar)
CREATE POLICY "Permitir inserção de leads via webhook"
ON public.leads
FOR INSERT
WITH CHECK (true);

-- Policy para permitir leitura de todos os leads
CREATE POLICY "Permitir leitura de todos os leads"
ON public.leads
FOR SELECT
USING (true);
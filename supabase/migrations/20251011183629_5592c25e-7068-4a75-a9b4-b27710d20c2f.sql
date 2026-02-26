-- Criar tabela para armazenar mensagens de email
CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  subject text,
  message text,
  html_body text,
  direction text NOT NULL DEFAULT 'inbound',
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Criar política de leitura
CREATE POLICY "Permitir leitura de mensagens de email"
ON public.email_messages
FOR SELECT
USING (true);

-- Criar política de inserção
CREATE POLICY "Permitir inserção de mensagens de email"
ON public.email_messages
FOR INSERT
WITH CHECK (true);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_email_messages_lead_id ON public.email_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_timestamp ON public.email_messages(timestamp DESC);
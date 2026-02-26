-- Adicionar campo phone à tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone TEXT;

-- Criar índice para buscar por telefone
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- Criar tabela para mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  timestamp TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_messages
CREATE POLICY "Permitir leitura de mensagens WhatsApp"
ON public.whatsapp_messages
FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção de mensagens via webhook"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);
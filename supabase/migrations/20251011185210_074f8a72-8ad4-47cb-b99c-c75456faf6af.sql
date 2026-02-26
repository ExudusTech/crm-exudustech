-- Adicionar campo updated_at na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Criar índice para melhor performance nas queries
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads(updated_at DESC);

-- Função para atualizar updated_at do lead quando houver nova mensagem
CREATE OR REPLACE FUNCTION update_lead_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET updated_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar lead quando chegar mensagem de email
DROP TRIGGER IF EXISTS update_lead_on_email ON public.email_messages;
CREATE TRIGGER update_lead_on_email
  AFTER INSERT ON public.email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_timestamp();

-- Trigger para atualizar lead quando chegar mensagem de WhatsApp
DROP TRIGGER IF EXISTS update_lead_on_whatsapp ON public.whatsapp_messages;
CREATE TRIGGER update_lead_on_whatsapp
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_timestamp();
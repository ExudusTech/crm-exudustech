-- Adicionar colunas de contagem de mensagens na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email_inbound_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_outbound_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_inbound_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_outbound_count integer DEFAULT 0;

-- Função para atualizar contagens quando mensagem de email é inserida/deletada
CREATE OR REPLACE FUNCTION public.update_lead_email_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_id IS NOT NULL THEN
      IF NEW.direction = 'inbound' THEN
        UPDATE public.leads SET email_inbound_count = COALESCE(email_inbound_count, 0) + 1 WHERE id = NEW.lead_id;
      ELSIF NEW.direction = 'outbound' THEN
        UPDATE public.leads SET email_outbound_count = COALESCE(email_outbound_count, 0) + 1 WHERE id = NEW.lead_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.lead_id IS NOT NULL THEN
      IF OLD.direction = 'inbound' THEN
        UPDATE public.leads SET email_inbound_count = GREATEST(COALESCE(email_inbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
      ELSIF OLD.direction = 'outbound' THEN
        UPDATE public.leads SET email_outbound_count = GREATEST(COALESCE(email_outbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou de lead, atualizar contagens de ambos
    IF OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      IF OLD.lead_id IS NOT NULL THEN
        IF OLD.direction = 'inbound' THEN
          UPDATE public.leads SET email_inbound_count = GREATEST(COALESCE(email_inbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
        ELSIF OLD.direction = 'outbound' THEN
          UPDATE public.leads SET email_outbound_count = GREATEST(COALESCE(email_outbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
        END IF;
      END IF;
      IF NEW.lead_id IS NOT NULL THEN
        IF NEW.direction = 'inbound' THEN
          UPDATE public.leads SET email_inbound_count = COALESCE(email_inbound_count, 0) + 1 WHERE id = NEW.lead_id;
        ELSIF NEW.direction = 'outbound' THEN
          UPDATE public.leads SET email_outbound_count = COALESCE(email_outbound_count, 0) + 1 WHERE id = NEW.lead_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para atualizar contagens quando mensagem de WhatsApp é inserida/deletada
CREATE OR REPLACE FUNCTION public.update_lead_whatsapp_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_id IS NOT NULL THEN
      IF NEW.direction = 'inbound' THEN
        UPDATE public.leads SET whatsapp_inbound_count = COALESCE(whatsapp_inbound_count, 0) + 1 WHERE id = NEW.lead_id;
      ELSIF NEW.direction = 'outbound' THEN
        UPDATE public.leads SET whatsapp_outbound_count = COALESCE(whatsapp_outbound_count, 0) + 1 WHERE id = NEW.lead_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.lead_id IS NOT NULL THEN
      IF OLD.direction = 'inbound' THEN
        UPDATE public.leads SET whatsapp_inbound_count = GREATEST(COALESCE(whatsapp_inbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
      ELSIF OLD.direction = 'outbound' THEN
        UPDATE public.leads SET whatsapp_outbound_count = GREATEST(COALESCE(whatsapp_outbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se mudou de lead, atualizar contagens de ambos
    IF OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      IF OLD.lead_id IS NOT NULL THEN
        IF OLD.direction = 'inbound' THEN
          UPDATE public.leads SET whatsapp_inbound_count = GREATEST(COALESCE(whatsapp_inbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
        ELSIF OLD.direction = 'outbound' THEN
          UPDATE public.leads SET whatsapp_outbound_count = GREATEST(COALESCE(whatsapp_outbound_count, 0) - 1, 0) WHERE id = OLD.lead_id;
        END IF;
      END IF;
      IF NEW.lead_id IS NOT NULL THEN
        IF NEW.direction = 'inbound' THEN
          UPDATE public.leads SET whatsapp_inbound_count = COALESCE(whatsapp_inbound_count, 0) + 1 WHERE id = NEW.lead_id;
        ELSIF NEW.direction = 'outbound' THEN
          UPDATE public.leads SET whatsapp_outbound_count = COALESCE(whatsapp_outbound_count, 0) + 1 WHERE id = NEW.lead_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers para email_messages
DROP TRIGGER IF EXISTS update_lead_email_count_trigger ON public.email_messages;
CREATE TRIGGER update_lead_email_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_email_count();

-- Criar triggers para whatsapp_messages
DROP TRIGGER IF EXISTS update_lead_whatsapp_count_trigger ON public.whatsapp_messages;
CREATE TRIGGER update_lead_whatsapp_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_whatsapp_count();

-- Backfill: popular as contagens para leads existentes
UPDATE public.leads l SET
  email_inbound_count = COALESCE((
    SELECT COUNT(*) FROM public.email_messages em 
    WHERE em.lead_id = l.id AND em.direction = 'inbound'
  ), 0),
  email_outbound_count = COALESCE((
    SELECT COUNT(*) FROM public.email_messages em 
    WHERE em.lead_id = l.id AND em.direction = 'outbound'
  ), 0),
  whatsapp_inbound_count = COALESCE((
    SELECT COUNT(*) FROM public.whatsapp_messages wm 
    WHERE wm.lead_id = l.id AND wm.direction = 'inbound'
  ), 0),
  whatsapp_outbound_count = COALESCE((
    SELECT COUNT(*) FROM public.whatsapp_messages wm 
    WHERE wm.lead_id = l.id AND wm.direction = 'outbound'
  ), 0);
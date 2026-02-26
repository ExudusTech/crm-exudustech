-- Corrigir função para ter search_path seguro
CREATE OR REPLACE FUNCTION update_lead_timestamp()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.leads
  SET updated_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;
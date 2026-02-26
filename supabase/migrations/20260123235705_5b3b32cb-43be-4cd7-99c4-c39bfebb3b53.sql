-- Add columns to cache last messages for faster loading
ALTER TABLE public.leads 
ADD COLUMN last_inbound_message text,
ADD COLUMN last_inbound_message_at timestamp with time zone,
ADD COLUMN last_outbound_message text,
ADD COLUMN last_outbound_message_at timestamp with time zone;

-- Create function to update lead's last message cache
CREATE OR REPLACE FUNCTION public.update_lead_last_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE public.leads
    SET 
      last_inbound_message = NEW.message,
      last_inbound_message_at = COALESCE(NEW.timestamp, NEW.created_at)
    WHERE id = NEW.lead_id
    AND (last_inbound_message_at IS NULL OR last_inbound_message_at < COALESCE(NEW.timestamp, NEW.created_at));
  ELSIF NEW.direction = 'outbound' THEN
    UPDATE public.leads
    SET 
      last_outbound_message = NEW.message,
      last_outbound_message_at = COALESCE(NEW.timestamp, NEW.created_at)
    WHERE id = NEW.lead_id
    AND (last_outbound_message_at IS NULL OR last_outbound_message_at < COALESCE(NEW.timestamp, NEW.created_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for WhatsApp messages
CREATE TRIGGER update_lead_last_whatsapp_message
AFTER INSERT OR UPDATE ON public.whatsapp_messages
FOR EACH ROW
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION public.update_lead_last_message();

-- Create triggers for Email messages
CREATE TRIGGER update_lead_last_email_message
AFTER INSERT OR UPDATE ON public.email_messages
FOR EACH ROW
WHEN (NEW.lead_id IS NOT NULL)
EXECUTE FUNCTION public.update_lead_last_message();

-- Backfill existing data: last inbound messages
WITH latest_inbound AS (
  SELECT DISTINCT ON (lead_id) 
    lead_id,
    message,
    COALESCE(timestamp, created_at) as msg_time
  FROM (
    SELECT lead_id, message, timestamp, created_at FROM whatsapp_messages WHERE direction = 'inbound' AND lead_id IS NOT NULL
    UNION ALL
    SELECT lead_id, message, timestamp, created_at FROM email_messages WHERE direction = 'inbound' AND lead_id IS NOT NULL
  ) all_msgs
  ORDER BY lead_id, msg_time DESC
)
UPDATE public.leads l
SET 
  last_inbound_message = li.message,
  last_inbound_message_at = li.msg_time
FROM latest_inbound li
WHERE l.id = li.lead_id;

-- Backfill existing data: last outbound messages
WITH latest_outbound AS (
  SELECT DISTINCT ON (lead_id) 
    lead_id,
    message,
    COALESCE(timestamp, created_at) as msg_time
  FROM (
    SELECT lead_id, message, timestamp, created_at FROM whatsapp_messages WHERE direction = 'outbound' AND lead_id IS NOT NULL
    UNION ALL
    SELECT lead_id, message, timestamp, created_at FROM email_messages WHERE direction = 'outbound' AND lead_id IS NOT NULL
  ) all_msgs
  ORDER BY lead_id, msg_time DESC
)
UPDATE public.leads l
SET 
  last_outbound_message = lo.message,
  last_outbound_message_at = lo.msg_time
FROM latest_outbound lo
WHERE l.id = lo.lead_id;
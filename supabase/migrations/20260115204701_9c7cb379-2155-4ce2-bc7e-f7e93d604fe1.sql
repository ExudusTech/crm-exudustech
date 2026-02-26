-- Enable realtime for whatsapp_messages table
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Backfill: Update historical whatsapp_messages where phone contains @lid 
-- to use the lead's real phone number instead
UPDATE public.whatsapp_messages wm
SET phone = (
  SELECT l.phones[1]
  FROM public.leads l
  WHERE l.id = wm.lead_id
    AND l.phones IS NOT NULL
    AND array_length(l.phones, 1) > 0
    AND l.phones[1] NOT LIKE '%@%'
    AND length(l.phones[1]) >= 10
  LIMIT 1
)
WHERE wm.phone LIKE '%@lid%'
  OR (
    wm.phone ~ '^\d{15,}$' 
    AND wm.phone NOT LIKE '55%'
  )
  AND wm.lead_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = wm.lead_id
      AND l.phones IS NOT NULL
      AND array_length(l.phones, 1) > 0
      AND l.phones[1] NOT LIKE '%@%'
      AND length(l.phones[1]) >= 10
  );
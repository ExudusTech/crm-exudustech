-- Add whatsapp_chat_lids field to leads table for storing chat identifiers
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_chat_lids text[] DEFAULT '{}';

-- Create GIN index for fast lookups
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_chat_lids ON public.leads USING GIN (whatsapp_chat_lids);

-- Comment for documentation
COMMENT ON COLUMN public.leads.whatsapp_chat_lids IS 'Array of WhatsApp chat LID identifiers linked to this lead';
-- Add fields for recurring leads and delivery tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- Create index for faster queries on delivered leads
CREATE INDEX IF NOT EXISTS idx_leads_delivered_at ON public.leads(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email_delivered ON public.leads(email) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_delivered ON public.leads(phone) WHERE delivered_at IS NOT NULL;
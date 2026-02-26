-- Create a key-value settings table for system configuration
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all settings
CREATE POLICY "Authenticated users can read settings"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to upsert settings
CREATE POLICY "Authenticated users can upsert settings"
ON public.system_settings
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update settings"
ON public.system_settings
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Insert default values
INSERT INTO public.system_settings (key, value) VALUES
  ('susan_name', 'Susan Whitfield'),
  ('susan_email', 'susan@inventormiguel.link'),
  ('company_name', 'Miguel Fernandes'),
  ('company_email', 'miguel@inventormiguel.com'),
  ('media_kit_link', 'https://inventormiguel.link/kit'),
  ('proposal_template_path', 'proposal-templates/template.pdf'),
  ('proposal_total_slides', '32'),
  ('proposal_insert_slides', '30,31,32'),
  ('webhook_resend_url', ''),
  ('webhook_zapi_url', '')
ON CONFLICT (key) DO NOTHING;
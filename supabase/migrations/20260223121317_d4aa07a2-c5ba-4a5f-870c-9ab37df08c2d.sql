CREATE TABLE public.whatsapp_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  suggested_message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  susan_email_resend_id text,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.whatsapp_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read followup queue" ON public.whatsapp_followup_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert followup queue" ON public.whatsapp_followup_queue
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update followup queue" ON public.whatsapp_followup_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);
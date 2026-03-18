
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL,
  entity_id uuid NULL,
  action_type text NOT NULL DEFAULT 'create',
  source text NOT NULL DEFAULT 'manual',
  description text NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

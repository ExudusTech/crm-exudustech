
-- Google Connections table for OAuth tokens
CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamp with time zone,
  scopes text[] DEFAULT '{}'::text[],
  connected_at timestamp with time zone DEFAULT now(),
  last_sync_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_google_connections" ON public.google_connections FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_google_connections" ON public.google_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_google_connections" ON public.google_connections FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_google_connections" ON public.google_connections FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Google sync logs
CREATE TABLE public.google_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.google_connections(id) ON DELETE CASCADE,
  service text NOT NULL,
  action text NOT NULL,
  details text,
  status text DEFAULT 'success',
  initiative_id uuid REFERENCES public.initiatives(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.google_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_google_sync_logs" ON public.google_sync_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_google_sync_logs" ON public.google_sync_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Initiative Drive links
CREATE TABLE public.initiative_drive_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  drive_folder_id text,
  drive_folder_url text,
  drive_folder_name text,
  link_type text DEFAULT 'pasta_principal',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.initiative_drive_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_initiative_drive_links" ON public.initiative_drive_links FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_initiative_drive_links" ON public.initiative_drive_links FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_initiative_drive_links" ON public.initiative_drive_links FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_initiative_drive_links" ON public.initiative_drive_links FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- 1. Initiative conversations (raw conversations linked to initiatives)
CREATE TABLE public.initiative_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  author text,
  content text NOT NULL,
  raw_user_message text,
  raw_ai_response text,
  mentioned_entities jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Initiative interpretations (AI analysis of conversations)
CREATE TABLE public.initiative_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.initiative_conversations(id) ON DELETE SET NULL,
  detected_entities jsonb DEFAULT '[]',
  detected_intent text,
  detected_themes jsonb DEFAULT '[]',
  suggested_actions jsonb DEFAULT '[]',
  confidence numeric(3,2) DEFAULT 0.0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Initiative generated actions (actions derived from conversations/AI)
CREATE TABLE public.initiative_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.initiative_conversations(id) ON DELETE SET NULL,
  interpretation_id uuid REFERENCES public.initiative_interpretations(id) ON DELETE SET NULL,
  action_type text NOT NULL DEFAULT 'outro',
  description text NOT NULL,
  result_entity_id uuid,
  result_entity_type text,
  status text NOT NULL DEFAULT 'executada',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Initiative gaps (detected omissions/gaps)
CREATE TABLE public.initiative_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.initiative_conversations(id) ON DELETE SET NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'media',
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_action_id uuid REFERENCES public.initiative_actions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add origin/author columns to initiative_history
ALTER TABLE public.initiative_history ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE public.initiative_history ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE public.initiative_history ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.initiative_conversations(id) ON DELETE SET NULL;

-- RLS for all new tables
ALTER TABLE public.initiative_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_initiative_conversations" ON public.initiative_conversations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_initiative_conversations" ON public.initiative_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_initiative_conversations" ON public.initiative_conversations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_initiative_conversations" ON public.initiative_conversations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_select_initiative_interpretations" ON public.initiative_interpretations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_initiative_interpretations" ON public.initiative_interpretations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_initiative_interpretations" ON public.initiative_interpretations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_initiative_interpretations" ON public.initiative_interpretations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_select_initiative_actions" ON public.initiative_actions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_initiative_actions" ON public.initiative_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_initiative_actions" ON public.initiative_actions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_initiative_actions" ON public.initiative_actions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_select_initiative_gaps" ON public.initiative_gaps FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_initiative_gaps" ON public.initiative_gaps FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_initiative_gaps" ON public.initiative_gaps FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_initiative_gaps" ON public.initiative_gaps FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

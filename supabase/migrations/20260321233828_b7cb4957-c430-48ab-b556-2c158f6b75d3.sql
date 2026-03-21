CREATE TABLE public.ceo_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  images jsonb DEFAULT NULL,
  created_entities jsonb DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat messages" ON public.ceo_chat_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat messages" ON public.ceo_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat messages" ON public.ceo_chat_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_ceo_chat_messages_user_created ON public.ceo_chat_messages (user_id, created_at);
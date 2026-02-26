-- Add UPDATE policies to allow migrating messages during lead merge
-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Allow updating whatsapp_messages (e.g., to reassign lead_id during merges)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'whatsapp_messages' AND policyname = 'Permitir atualização de mensagens WhatsApp'
  ) THEN
    CREATE POLICY "Permitir atualização de mensagens WhatsApp"
    ON public.whatsapp_messages
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END$$;

-- Allow updating email_messages (e.g., to reassign lead_id during merges)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'email_messages' AND policyname = 'Permitir atualização de mensagens de email'
  ) THEN
    CREATE POLICY "Permitir atualização de mensagens de email"
    ON public.email_messages
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END$$;
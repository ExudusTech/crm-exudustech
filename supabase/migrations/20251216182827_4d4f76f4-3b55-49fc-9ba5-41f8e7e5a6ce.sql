-- Drop existing policies and create new ones that require authentication

-- LEADS TABLE
DROP POLICY IF EXISTS "Permitir leitura de todos os leads" ON public.leads;
DROP POLICY IF EXISTS "Permitir inserção de leads via webhook" ON public.leads;
DROP POLICY IF EXISTS "Permitir atualização de leads" ON public.leads;
DROP POLICY IF EXISTS "Permitir deleção de leads" ON public.leads;

CREATE POLICY "Usuários autenticados podem ler leads" 
ON public.leads FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir leads" 
ON public.leads FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar leads" 
ON public.leads FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar leads" 
ON public.leads FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- EMAIL_MESSAGES TABLE
DROP POLICY IF EXISTS "Permitir leitura de mensagens de email" ON public.email_messages;
DROP POLICY IF EXISTS "Permitir inserção de mensagens de email" ON public.email_messages;
DROP POLICY IF EXISTS "Permitir atualização de mensagens de email" ON public.email_messages;

CREATE POLICY "Usuários autenticados podem ler emails" 
ON public.email_messages FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir emails" 
ON public.email_messages FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar emails" 
ON public.email_messages FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- WHATSAPP_MESSAGES TABLE
DROP POLICY IF EXISTS "Permitir leitura de mensagens WhatsApp" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Permitir inserção de mensagens via webhook" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Permitir atualização de mensagens WhatsApp" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Permitir deleção de mensagens WhatsApp" ON public.whatsapp_messages;

CREATE POLICY "Usuários autenticados podem ler whatsapp" 
ON public.whatsapp_messages FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir whatsapp" 
ON public.whatsapp_messages FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar whatsapp" 
ON public.whatsapp_messages FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar whatsapp" 
ON public.whatsapp_messages FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- LEAD_NOTES TABLE
DROP POLICY IF EXISTS "Permitir leitura de notas" ON public.lead_notes;
DROP POLICY IF EXISTS "Permitir inserção de notas" ON public.lead_notes;
DROP POLICY IF EXISTS "Permitir atualização de notas" ON public.lead_notes;
DROP POLICY IF EXISTS "Permitir deleção de notas" ON public.lead_notes;

CREATE POLICY "Usuários autenticados podem ler notas" 
ON public.lead_notes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir notas" 
ON public.lead_notes FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar notas" 
ON public.lead_notes FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar notas" 
ON public.lead_notes FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- EMAIL_ATTACHMENTS TABLE
DROP POLICY IF EXISTS "Permitir leitura de anexos" ON public.email_attachments;
DROP POLICY IF EXISTS "Permitir inserção de anexos" ON public.email_attachments;
DROP POLICY IF EXISTS "Permitir atualização de anexos" ON public.email_attachments;
DROP POLICY IF EXISTS "Permitir deleção de anexos" ON public.email_attachments;

CREATE POLICY "Usuários autenticados podem ler anexos" 
ON public.email_attachments FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir anexos" 
ON public.email_attachments FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar anexos" 
ON public.email_attachments FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar anexos" 
ON public.email_attachments FOR DELETE 
USING (auth.uid() IS NOT NULL);
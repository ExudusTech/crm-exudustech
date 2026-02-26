-- Alterar estrutura da tabela leads para suportar múltiplos emails e telefones
ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS leads_email_key;

-- Criar novas colunas com arrays
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS emails text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phones text[] DEFAULT '{}';

-- Migrar dados existentes para as novas colunas de array
UPDATE public.leads 
SET 
  emails = ARRAY[email]::text[],
  phones = CASE WHEN phone IS NOT NULL THEN ARRAY[phone]::text[] ELSE '{}'::text[] END
WHERE emails = '{}';

-- Criar índice GIN para busca eficiente em arrays
CREATE INDEX IF NOT EXISTS idx_leads_emails_gin ON public.leads USING GIN(emails);
CREATE INDEX IF NOT EXISTS idx_leads_phones_gin ON public.leads USING GIN(phones);

-- Adicionar política RLS para permitir atualização (necessária para mesclagem)
DROP POLICY IF EXISTS "Permitir atualização de leads" ON public.leads;
CREATE POLICY "Permitir atualização de leads" 
ON public.leads 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Adicionar política RLS para permitir deleção (necessária para mesclagem)
DROP POLICY IF EXISTS "Permitir deleção de leads" ON public.leads;
CREATE POLICY "Permitir deleção de leads" 
ON public.leads 
FOR DELETE 
USING (true);
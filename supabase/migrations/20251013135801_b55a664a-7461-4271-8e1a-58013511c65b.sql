-- Primeiro, corrigir leads que têm números de telefone no campo email
UPDATE public.leads 
SET email = ''
WHERE email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
  AND email IS NOT NULL 
  AND email != '';

-- Remover a constraint de check do email para permitir emails opcionais
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_email_check;

-- Tornar a coluna email nullable
ALTER TABLE public.leads ALTER COLUMN email DROP NOT NULL;

-- Permitir emails vazios para leads que não têm email
ALTER TABLE public.leads ADD CONSTRAINT leads_email_valid 
  CHECK (email IS NULL OR email = '' OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
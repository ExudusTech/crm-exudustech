-- Migrar leads com status aguardando_pagamento para ganho
UPDATE public.leads 
SET status = 'ganho' 
WHERE status = 'aguardando_pagamento';

-- Remover o default temporariamente
ALTER TABLE public.leads 
ALTER COLUMN status DROP DEFAULT;

-- Criar novo tipo enum sem aguardando_pagamento
CREATE TYPE lead_status_new AS ENUM ('em_negociacao', 'ganho', 'perdido', 'entregue');

-- Atualizar a coluna para usar o novo tipo
ALTER TABLE public.leads 
ALTER COLUMN status TYPE lead_status_new 
USING status::text::lead_status_new;

-- Remover o tipo antigo
DROP TYPE lead_status;

-- Renomear o novo tipo
ALTER TYPE lead_status_new RENAME TO lead_status;

-- Restaurar o default
ALTER TABLE public.leads 
ALTER COLUMN status SET DEFAULT 'em_negociacao'::lead_status;
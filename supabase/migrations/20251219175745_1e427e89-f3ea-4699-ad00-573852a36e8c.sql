-- Adicionar novas colunas
ALTER TABLE leads ADD COLUMN ganho_at timestamp with time zone;
ALTER TABLE leads ADD COLUMN perdido_at timestamp with time zone;

-- Migrar dados existentes:

-- Para leads PERDIDOS: usar updated_at como perdido_at
UPDATE leads SET perdido_at = updated_at WHERE status = 'perdido';

-- Para leads GANHOS: usar updated_at como ganho_at
UPDATE leads SET ganho_at = updated_at WHERE status = 'ganho';

-- Para leads ENTREGUES: usar delivered_at como ganho_at (se não tiver, usar updated_at)
-- Porque para entregar, primeiro foi ganho
UPDATE leads SET ganho_at = COALESCE(delivered_at, updated_at) WHERE status = 'entregue';
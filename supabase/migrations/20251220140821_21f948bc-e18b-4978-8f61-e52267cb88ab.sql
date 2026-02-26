-- Adicionar colunas para rastreamento de propostas
ALTER TABLE leads ADD COLUMN proposal_url text;
ALTER TABLE leads ADD COLUMN proposal_sent_at timestamp with time zone;
ALTER TABLE leads ADD COLUMN proposal_view_count integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN proposal_last_viewed_at timestamp with time zone;
-- Adicionar novo valor 'em_aberto' ao enum lead_status
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'em_aberto';
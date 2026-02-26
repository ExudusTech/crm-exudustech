-- Adicionar campos de diagnóstico de leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT NULL,
ADD COLUMN IF NOT EXISTS ai_close_probability INTEGER NULL CHECK (ai_close_probability >= 0 AND ai_close_probability <= 100),
ADD COLUMN IF NOT EXISTS ai_next_step TEXT NULL,
ADD COLUMN IF NOT EXISTS ai_diagnosis_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS ai_diagnosis_updated_at TIMESTAMP WITH TIME ZONE NULL;
-- Add reopened_at column to track when a lead was reopened from perdido
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE;
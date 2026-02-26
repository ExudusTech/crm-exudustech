-- Add suggested_followup column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS suggested_followup TEXT;
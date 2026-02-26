-- Add archived column to leads table
ALTER TABLE public.leads 
ADD COLUMN archived BOOLEAN DEFAULT FALSE;
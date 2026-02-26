-- Add column to track paid amount on leads
ALTER TABLE public.leads 
ADD COLUMN valor_pago numeric DEFAULT 0;
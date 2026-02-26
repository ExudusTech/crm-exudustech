-- Add next payment date column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS data_proximo_pagamento DATE;
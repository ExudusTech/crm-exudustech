-- Add unclassified field to leads table
ALTER TABLE public.leads 
ADD COLUMN unclassified boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX idx_leads_unclassified ON public.leads(unclassified) WHERE unclassified = true;
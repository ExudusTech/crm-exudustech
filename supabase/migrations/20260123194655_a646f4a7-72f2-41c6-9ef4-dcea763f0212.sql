-- Add origem (origin) field to leads table for tracking lead source (Instagram, LinkedIn, email, referral, etc.)
ALTER TABLE public.leads 
ADD COLUMN origem text;
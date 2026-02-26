-- Create notes table for leads
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for notes
CREATE POLICY "Permitir leitura de notas"
ON public.lead_notes
FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção de notas"
ON public.lead_notes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização de notas"
ON public.lead_notes
FOR UPDATE
USING (true);

CREATE POLICY "Permitir deleção de notas"
ON public.lead_notes
FOR DELETE
USING (true);
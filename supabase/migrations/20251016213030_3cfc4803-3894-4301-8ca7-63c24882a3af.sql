-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('email-attachments', 'email-attachments', false);

-- Create email_attachments table
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Permitir leitura de anexos"
ON public.email_attachments
FOR SELECT
USING (true);

CREATE POLICY "Permitir inserção de anexos"
ON public.email_attachments
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualização de anexos"
ON public.email_attachments
FOR UPDATE
USING (true);

CREATE POLICY "Permitir deleção de anexos"
ON public.email_attachments
FOR DELETE
USING (true);

-- Storage policies for email-attachments bucket
CREATE POLICY "Permitir leitura de anexos de email"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-attachments');

CREATE POLICY "Permitir upload de anexos de email"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "Permitir atualização de anexos de email"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'email-attachments');

CREATE POLICY "Permitir deleção de anexos de email"
ON storage.objects
FOR DELETE
USING (bucket_id = 'email-attachments');
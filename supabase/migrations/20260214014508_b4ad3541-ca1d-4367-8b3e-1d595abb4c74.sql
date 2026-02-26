
-- Table to store user-customized prompt templates
CREATE TABLE public.prompt_templates (
  id TEXT PRIMARY KEY,
  custom_prompt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read prompt templates
CREATE POLICY "Authenticated users can read prompt templates"
ON public.prompt_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Any authenticated user can insert prompt templates
CREATE POLICY "Authenticated users can insert prompt templates"
ON public.prompt_templates FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Any authenticated user can update prompt templates
CREATE POLICY "Authenticated users can update prompt templates"
ON public.prompt_templates FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Any authenticated user can delete prompt templates
CREATE POLICY "Authenticated users can delete prompt templates"
ON public.prompt_templates FOR DELETE
USING (auth.uid() IS NOT NULL);

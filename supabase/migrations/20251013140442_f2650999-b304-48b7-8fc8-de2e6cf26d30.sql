-- Remover a constraint antiga de produto
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_produto_check;

-- Adicionar nova constraint que inclui publicidade
ALTER TABLE public.leads ADD CONSTRAINT leads_produto_check 
  CHECK (produto IS NULL OR produto IN ('palestra', 'consultoria', 'mentoria', 'treinamento', 'publicidade'));
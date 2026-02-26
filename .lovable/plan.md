
# Follow-up WhatsApp com Aprovacao do Miguel (v2 - Melhorias)

## Resumo

Criar o sistema automatizado de follow-up via WhatsApp com loop de aprovacao do Miguel. A cada hora, analisa leads em aberto/negociacao com historico WhatsApp, gera sugestao curta de follow-up, envia e-mail ao Miguel com detalhes enriquecidos (descricao do lead, contadores de mensagens), e permite 3 tipos de resposta: "sim" (envia), sugestao de alteracao (regenera e reenvia), ou ignorar.

## Fluxo Completo

```text
[Cron 1h] --> followup-whatsapp-suggestions
   |
   +--> Busca leads em_aberto/em_negociacao com WhatsApp
   +--> Gera mensagem curta via IA (6-7 palavras, prazo 2 dias uteis)
   +--> Salva na tabela whatsapp_followup_queue
   +--> Envia e-mail ao Miguel com:
        - Nome e descricao do lead
        - Contadores: emails enviados/recebidos, WhatsApp enviados/recebidos
        - Ultimas mensagens
        - Texto sugerido
   |
[Miguel responde e-mail]
   |
   +--> resend-inbound-webhook detecta resposta
   +--> Caso 1: "Sim" / "Pode mandar" --> Dispara WhatsApp via Z-API
   +--> Caso 2: Sugestao de alteracao --> IA regenera mensagem --> Novo e-mail ao Miguel
   +--> Caso 3: Rejeicao explicita --> Marca como rejected
```

## Etapas Tecnicas

### 1. Nova tabela: `whatsapp_followup_queue`

```sql
CREATE TABLE public.whatsapp_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  suggested_message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- pending | approved | sent | rejected | expired | revision_pending
  susan_email_resend_id text,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.whatsapp_followup_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies (auth required)
CREATE POLICY "Auth read followup queue" ON public.whatsapp_followup_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert followup queue" ON public.whatsapp_followup_queue
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update followup queue" ON public.whatsapp_followup_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);
```

Campos chave:
- `susan_email_resend_id`: ID do e-mail enviado ao Miguel via Resend, usado para match no webhook
- `revision_count`: quantas vezes o Miguel pediu alteracao (para evitar loops infinitos)
- `status`: controla o ciclo de vida da sugestao

### 2. Nova Edge Function: `followup-whatsapp-suggestions`

Logica principal:
- Buscar leads com `status IN ('em_aberto', 'em_negociacao')`, `archived = false`, que tenham pelo menos 1 mensagem WhatsApp
- Ignorar leads que ja tenham registro `pending` ou `revision_pending` na fila
- Ignorar leads com ultima mensagem outbound (WhatsApp ou e-mail) ha menos de 24h
- Para cada lead elegivel:
  - Buscar historico completo de WhatsApp
  - Calcular data de 2 dias uteis (pula sabado/domingo)
  - Chamar IA (Gemini 2.5 Flash) para gerar frase curta no idioma do cliente
  - Salvar na `whatsapp_followup_queue`
  - Enviar e-mail ao Miguel via Resend com formato enriquecido

Formato do e-mail ao Miguel:

```text
Assunto: Sugestao Follow-up WhatsApp - [Nome do Lead]

Miguel,

Sugiro enviar a seguinte mensagem para [Nome do Lead] via WhatsApp:

"[mensagem sugerida]"

---
Descricao: [descricao do lead]
Produto: [produto] | Status: [status]

Mensagens:
- WhatsApp: [X] recebidas / [Y] enviadas
- E-mail: [X] recebidas / [Y] enviadas

Ultimas mensagens WhatsApp:
[Cliente]: "ultima msg inbound"
[Voce]: "ultima msg outbound"
---

Responda SIM para enviar automaticamente.
Ou responda com instrucoes para ajustar a mensagem
(ex: "faz mais curto", "menciona o evento").

Susan
```

### 3. Modificacao no `resend-inbound-webhook`

Adicionar deteccao ANTES do fluxo normal de e-mails do Miguel:

1. Quando e-mail vem do Miguel, verificar se o `In-Reply-To` ou `References` do e-mail corresponde a algum `susan_email_resend_id` na tabela `whatsapp_followup_queue` com status `pending` ou `revision_pending`
2. Se encontrar match:
   - Analisar conteudo da resposta via IA com tool call (`analyze_followup_response`):
     - `action: "approve"` -- Miguel disse sim/pode mandar/envia/go
     - `action: "revise"` -- Miguel pediu alteracao, com `instructions` extraidas
     - `action: "reject"` -- Miguel disse nao/cancela
   - Se `approve`:
     - Buscar telefone do lead (`phone` ou primeiro de `phones`)
     - Chamar `send-whatsapp-message` via fetch interno
     - Atualizar fila: `status = 'sent'`, `resolved_at = now()`
   - Se `revise` (e `revision_count < 3`):
     - Buscar historico WhatsApp do lead novamente
     - Chamar IA para regenerar mensagem com as instrucoes do Miguel
     - Atualizar `suggested_message` e incrementar `revision_count`
     - Enviar novo e-mail ao Miguel com a mensagem revisada
     - Atualizar `susan_email_resend_id` com o novo ID
     - Manter status como `revision_pending`
   - Se `reject` ou `revision_count >= 3`:
     - Marcar como `rejected`, `resolved_at = now()`
   - Retornar resposta e nao continuar o fluxo normal do webhook

### 4. Cron Job (pg_cron)

```sql
SELECT cron.schedule(
  'followup-whatsapp-suggestions-hourly',
  '0 * * * *',
  $$ SELECT net.http_post(
    url:='https://tisdewbfpkrrtacppdwt.supabase.co/functions/v1/followup-whatsapp-suggestions',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id; $$
);
```

### 5. Config.toml

Adicionar:
```toml
[functions.followup-whatsapp-suggestions]
verify_jwt = false
```

### 6. Expirar sugestoes antigas

Dentro da funcao `followup-whatsapp-suggestions`, no inicio, marcar como `expired` qualquer registro `pending` ou `revision_pending` com mais de 48h.

## Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `whatsapp_followup_queue` |
| `supabase/functions/followup-whatsapp-suggestions/index.ts` | Nova funcao |
| `supabase/functions/resend-inbound-webhook/index.ts` | Adicionar deteccao de resposta a sugestao |
| `supabase/config.toml` | Adicionar entrada da nova funcao |
| SQL (insert) | Cron job via pg_cron |

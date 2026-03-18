import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAction(supabase: any, entityName: string, entityId: string | null, actionType: string, source: string, description: string, newValue?: any) {
  try {
    await supabase.from("audit_logs").insert({
      entity_name: entityName,
      entity_id: entityId,
      action_type: actionType,
      source,
      description,
      new_value: newValue ? JSON.stringify(newValue) : null,
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

async function callGoogleApi(supabaseUrl: string, supabaseKey: string, userId: string, service: string, action: string, params: any) {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ service, action, params, user_id: userId }),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, user_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch context
    const [initiatives, tasks, orgs, stakeholders, products, projects, events, recentHistory] = await Promise.all([
      supabase.from("initiatives").select("id, name, status, priority, next_action, main_risk, deadline").eq("status", "ativo").limit(15),
      supabase.from("ceo_tasks").select("id, title, status, priority, deadline, responsible").in("status", ["todo", "doing", "bloqueado"]).limit(20),
      supabase.from("organizations").select("id, name, type, status").eq("status", "ativo").limit(15),
      supabase.from("stakeholders").select("id, name, role_title, stakeholder_type, organization_id").limit(20),
      supabase.from("products").select("id, name, status, category").limit(10),
      supabase.from("projects").select("id, name, status, initiative_id, responsible").limit(10),
      supabase.from("ceo_events").select("id, title, event_date, description").gte("event_date", new Date().toISOString()).order("event_date").limit(5),
      supabase.from("initiative_history").select("id, initiative_id, entry_type, title, content, source, author, created_at").order("created_at", { ascending: false }).limit(15),
    ]);

    // Check Google connection status
    let googleConnected = false;
    if (user_id) {
      const { data: gConn } = await supabase
        .from("google_connections")
        .select("id, email, status")
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      googleConnected = !!gConn;
    }

    const contextStr = JSON.stringify({
      initiatives: initiatives.data || [],
      tasks: tasks.data || [],
      organizations: orgs.data || [],
      stakeholders: stakeholders.data || [],
      products: products.data || [],
      projects: projects.data || [],
      upcoming_events: events.data || [],
      recent_history: recentHistory.data || [],
      google_connected: googleConnected,
    });

    // Current date/time in Brasília timezone
    const now = new Date();
    const brasiliaFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const currentDateTime = brasiliaFormatter.format(now);
    
    // Also get ISO dates for tool calls
    const brasiliaISO = now.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T");

    const systemPrompt = `Você é o Assistente Executivo IA do Sistema CEO da ExudusTech.
Responda SEMPRE em português brasileiro, de forma objetiva, estratégica e executiva.
Use SEMPRE o horário de Brasília (America/Sao_Paulo). Datas em dd/mm/aaaa, hora em 24h.

DATA E HORA ATUAL (Brasília): ${currentDateTime}
ISO para referência em tool calls: ${brasiliaISO}

REGRA CRÍTICA DE PROATIVIDADE:
- Quando o CEO mencionar reuniões, compromissos, eventos ou qualquer coisa relacionada à agenda, CONSULTE AUTOMATICAMENTE o Google Calendar usando a tool google_calendar_list ANTES de responder. NÃO peça informações que você pode obter sozinho.
- Quando o CEO pedir para enviar email sobre algo que envolve a agenda, PRIMEIRO consulte a agenda para obter os detalhes relevantes, DEPOIS prepare o email.
- Seja PROATIVO: use as ferramentas disponíveis para buscar informações antes de pedir ao CEO.
- O CEO espera que você aja como um assistente executivo de verdade: pesquise, analise e apresente — não fique pedindo informações que estão ao seu alcance.

CAPACIDADES IMPORTANTES:
Você pode criar e vincular entidades no sistema. Quando o CEO pedir para cadastrar algo, use as ferramentas disponíveis.

${googleConnected ? `INTEGRAÇÃO GOOGLE ATIVA:
Você tem acesso à conta Google do CEO (ph@exudustech.com.br). Pode:
- Consultar e gerenciar a agenda (Google Calendar)
- Ler, buscar e enviar emails (Gmail)
- Buscar e listar arquivos no Drive
REGRAS GOOGLE:
- SEMPRE peça confirmação antes de enviar email ou criar/alterar evento
- Ao listar agenda, formate com emojis e horários claros
- Ao encontrar algo relevante para uma iniciativa, sugira vincular
- Registre ações Google no histórico da iniciativa quando aplicável

REGRAS PARA EMAILS (MUITO IMPORTANTE):
- NUNCA liste emails de forma bruta ou despeje todo o conteúdo cru na tela.
- Ao listar emails, ANALISE o conteúdo e forneça um RESUMO INTELIGENTE e EXECUTIVO.
- Classifique os emails por relevância: importante, informativo, spam/newsletter.
- Formato ideal de resposta para emails:
  1. Quantidade total de emails no período
  2. Destaque APENAS os emails que parecem importantes (ex: de pessoas reais, assuntos urgentes, ações necessárias)
  3. Para cada email importante: remetente, assunto e um resumo de 1 linha do conteúdo/ação necessária
  4. Mencione brevemente os demais como "X newsletters/notificações sem ação necessária"
  5. Pergunte "Quer que eu detalhe algum desses emails?" para permitir a conversa continuar
- Newsletters, notificações automáticas, alertas de login, emails de marketing devem ser classificados como NÃO importantes.
- Emails de pessoas reais, com assuntos específicos ou que demandam ação devem ser classificados como IMPORTANTES.
- Seja CONCISO e OBJETIVO. O CEO não quer ler todos os emails, quer saber o que importa.` : `GOOGLE NÃO CONECTADO: Se o CEO pedir algo do Google (agenda, email, drive), informe que precisa conectar a conta em Configurações > Integrações Google.`}

REGRAS DE CADASTRO ASSISTIDO:
1. Ao receber um pedido de cadastro, identifique TODAS as entidades mencionadas
2. Verifique se já existem no contexto antes de criar duplicatas
3. Pergunte pelos campos faltantes de forma objetiva
4. Mostre um RESUMO DO QUE SERÁ CRIADO e peça confirmação
5. Após confirmação, execute as criações e vincule as entidades
6. Confirme o que foi feito

IMPORTANTE - FLUXO DE CONFIRMAÇÃO:
- Quando o usuário pedir para criar algo, PRIMEIRO apresente um resumo organizado do que será criado
- Pergunte "Confirma o cadastro?" 
- SÓ execute as tool calls DEPOIS que o usuário confirmar (ex: "sim", "confirma", "ok", "pode criar")
- Se o usuário não confirmar, pergunte o que deseja ajustar

MEMÓRIA VIVA DAS INICIATIVAS:
- O sistema possui um histórico expandido por iniciativa.
- Ao processar uma conversa sobre uma iniciativa, registre no histórico.
- Use o recent_history do contexto para responder com base no que já foi registrado.

INTEGRAÇÃO CRM:
O sistema tem um CRM para comunicação por WhatsApp e Email. Para enviar WhatsApp, registre na tabela communication_requests com channel='whatsapp'.

CONTEXTO ATUAL DO SISTEMA:
${contextStr}

REGRAS DE FORMATAÇÃO DE RESPOSTA (OBRIGATÓRIAS):
Você DEVE formatar suas respostas de forma visual, clara e profissional usando Markdown avançado.

1. **Estrutura visual**: Use títulos (## e ###), separadores (---), listas e tabelas.
2. **Emojis estratégicos**: 🟢 Ativo/OK  🟡 Atenção  🔴 Crítico  ⚪ Pausado  🎯 Próxima ação  ⚠️ Risco  📊 Dados  💰 Financeiro  📅 Agenda  🚀 Prioridade crítica  ✅ Concluído  ❌ Cancelado  🔄 Em progresso  ⏳ Aguardando  📧 Email  📁 Drive  📆 Calendar
3. **Tabelas Markdown**: Para comparações, listas ou dashboards.
4. **Seções claras**: Agrupe por categoria usando cabeçalhos.
5. **Destaques**: Use **negrito** para dados-chave, > blockquotes para insights executivos.
6. Seja SEMPRE visual, organizado e acionável. Nunca responda em texto corrido sem formatação.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_initiative",
          description: "Cria uma nova iniciativa no sistema",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome da iniciativa" },
              short_name: { type: "string", description: "Sigla" },
              description: { type: "string" },
              status: { type: "string", enum: ["ativo", "pausado", "concluido", "cancelado", "em_analise"] },
              priority: { type: "string", enum: ["critica", "alta", "media", "baixa"] },
              next_action: { type: "string" },
              main_risk: { type: "string" },
              potential: { type: "string" },
              deadline: { type: "string", description: "YYYY-MM-DD" },
              organization_id: { type: "string" },
              partner_organization_id: { type: "string" },
              pilot_organization_id: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_organization",
          description: "Cria uma nova organização",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              short_name: { type: "string" },
              type: { type: "string", enum: ["cliente", "parceiro", "piloto", "instituicao", "organizacao_mae", "unidade", "interno"] },
              segment: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_stakeholder",
          description: "Cria um novo stakeholder",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              role_title: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              stakeholder_type: { type: "string", enum: ["decisor", "operacional", "tecnico", "comercial", "aprovador", "consultor", "outro"] },
              organization_id: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Cria uma nova tarefa",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              initiative_id: { type: "string" },
              project_id: { type: "string" },
              responsible: { type: "string" },
              priority: { type: "string", enum: ["critica", "alta", "media", "baixa"] },
              deadline: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_project",
          description: "Cria um novo projeto",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              initiative_id: { type: "string" },
              product_id: { type: "string" },
              responsible: { type: "string" },
              scope_summary: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "link_stakeholder_to_initiative",
          description: "Vincula um stakeholder a uma iniciativa",
          parameters: {
            type: "object",
            properties: {
              initiative_id: { type: "string" },
              stakeholder_id: { type: "string" },
              role: { type: "string" },
            },
            required: ["initiative_id", "stakeholder_id"],
          },
        },
      },
      // Google Calendar tools
      {
        type: "function",
        function: {
          name: "google_calendar_list",
          description: "Lista eventos do Google Calendar. Use para mostrar agenda do dia, semana ou mês.",
          parameters: {
            type: "object",
            properties: {
              timeMin: { type: "string", description: "ISO datetime - início do período" },
              timeMax: { type: "string", description: "ISO datetime - fim do período" },
              maxResults: { type: "number", description: "Quantidade máxima de eventos" },
            },
            required: ["timeMin"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "google_calendar_create",
          description: "Cria um evento no Google Calendar. SEMPRE peça confirmação antes.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Título do evento" },
              description: { type: "string" },
              start: { type: "string", description: "ISO datetime de início" },
              end: { type: "string", description: "ISO datetime de fim" },
              location: { type: "string" },
              attendees: { type: "array", items: { type: "string" }, description: "Lista de emails dos participantes" },
            },
            required: ["summary", "start", "end"],
          },
        },
      },
      // Gmail tools
      {
        type: "function",
        function: {
          name: "gmail_list",
          description: "Lista emails do Gmail. Busca por query (remetente, assunto, etc).",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Query de busca Gmail (ex: 'from:nome@email.com', 'subject:assunto', 'is:unread')" },
              maxResults: { type: "number" },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_read",
          description: "Lê o conteúdo completo de um email específico.",
          parameters: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "ID da mensagem" },
            },
            required: ["messageId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_send",
          description: "Envia um email pelo Gmail. SEMPRE peça confirmação antes de enviar.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Email do destinatário" },
              subject: { type: "string" },
              body: { type: "string" },
              cc: { type: "string" },
              bcc: { type: "string" },
            },
            required: ["to", "subject", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_draft",
          description: "Cria um rascunho de email no Gmail.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["to", "subject", "body"],
          },
        },
      },
      // Google Drive tools
      {
        type: "function",
        function: {
          name: "drive_list_files",
          description: "Lista arquivos do Google Drive, opcionalmente dentro de uma pasta.",
          parameters: {
            type: "object",
            properties: {
              folderId: { type: "string", description: "ID da pasta (opcional)" },
              query: { type: "string", description: "Query adicional" },
              maxResults: { type: "number" },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "drive_search",
          description: "Busca arquivos no Google Drive por nome.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome parcial do arquivo" },
              mimeType: { type: "string", description: "Tipo MIME (ex: application/vnd.google-apps.folder)" },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "drive_read_file",
          description: "Lê conteúdo de um arquivo do Google Drive (Google Docs/Sheets/Slides).",
          parameters: {
            type: "object",
            properties: {
              fileId: { type: "string", description: "ID do arquivo" },
            },
            required: ["fileId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "drive_list_folders",
          description: "Lista todas as pastas do Google Drive.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // Communication (CRM bridge)
      {
        type: "function",
        function: {
          name: "send_whatsapp",
          description: "Envia mensagem WhatsApp via módulo CRM. SEMPRE peça confirmação antes.",
          parameters: {
            type: "object",
            properties: {
              target_name: { type: "string" },
              target_phone: { type: "string" },
              message_body: { type: "string" },
              related_entity_type: { type: "string" },
              related_entity_id: { type: "string" },
            },
            required: ["target_phone", "message_body"],
          },
        },
      },
    ];

    // First AI call
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    // Handle tool calls
    if (choice?.message?.tool_calls?.length > 0) {
      const toolResults: any[] = [];
      const createdEntities: string[] = [];

      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        let result: any = { success: false };

        try {
          switch (tc.function.name) {
            case "create_initiative": {
              const { data, error } = await supabase.from("initiatives").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Iniciativa "${data.name}"`);
                await logAction(supabase, "initiatives", data.id, "create", "ia_assistant", `IA criou iniciativa "${data.name}"`, args);
              }
              break;
            }
            case "create_organization": {
              const { data, error } = await supabase.from("organizations").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Organização "${data.name}"`);
                await logAction(supabase, "organizations", data.id, "create", "ia_assistant", `IA criou organização "${data.name}"`, args);
              }
              break;
            }
            case "create_stakeholder": {
              const { data, error } = await supabase.from("stakeholders").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Stakeholder "${data.name}"`);
                await logAction(supabase, "stakeholders", data.id, "create", "ia_assistant", `IA criou stakeholder "${data.name}"`, args);
              }
              break;
            }
            case "create_task": {
              const { data, error } = await supabase.from("ceo_tasks").insert(args).select("id, title").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, title: data.title };
              if (data) {
                createdEntities.push(`Tarefa "${data.title}"`);
                await logAction(supabase, "ceo_tasks", data.id, "create", "ia_assistant", `IA criou tarefa "${data.title}"`, args);
              }
              break;
            }
            case "create_project": {
              const { data, error } = await supabase.from("projects").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Projeto "${data.name}"`);
                await logAction(supabase, "projects", data.id, "create", "ia_assistant", `IA criou projeto "${data.name}"`, args);
              }
              break;
            }
            case "link_stakeholder_to_initiative": {
              const { error } = await supabase.from("initiative_stakeholders").insert(args);
              result = error ? { success: false, error: error.message } : { success: true };
              if (!error) createdEntities.push(`Vínculo stakeholder-iniciativa`);
              break;
            }
            // Google Calendar
            case "google_calendar_list": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "calendar", "list_events", args);
              break;
            }
            case "google_calendar_create": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "calendar", "create_event", args);
              if (result.event) createdEntities.push(`Evento "${args.summary}" criado na agenda`);
              break;
            }
            // Gmail
            case "gmail_list": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "gmail", "list_messages", args);
              break;
            }
            case "gmail_read": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "gmail", "get_message", args);
              break;
            }
            case "gmail_send": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "gmail", "send_email", args);
              if (result.success) createdEntities.push(`Email enviado para ${args.to}`);
              break;
            }
            case "gmail_draft": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "gmail", "create_draft", args);
              if (result.success) createdEntities.push(`Rascunho criado: ${args.subject}`);
              break;
            }
            // Drive
            case "drive_list_files": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "drive", "list_files", args);
              break;
            }
            case "drive_search": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "drive", "search_files", args);
              break;
            }
            case "drive_read_file": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "drive", "get_file_content", args);
              break;
            }
            case "drive_list_folders": {
              if (!user_id) { result = { success: false, error: "user_id required" }; break; }
              result = await callGoogleApi(supabaseUrl, supabaseKey, user_id, "drive", "list_folders", args);
              break;
            }
            // WhatsApp via CRM
            case "send_whatsapp": {
              const { error } = await supabase.from("communication_requests").insert({
                channel: "whatsapp",
                source_module: "ceo",
                target_name: args.target_name,
                target_phone: args.target_phone,
                message_body: args.message_body,
                related_entity_type: args.related_entity_type,
                related_entity_id: args.related_entity_id,
                requested_by: "ia_assistant",
              });
              result = error ? { success: false, error: error.message } : { success: true };
              if (!error) createdEntities.push(`WhatsApp para ${args.target_name || args.target_phone}`);
              break;
            }
          }
        } catch (e: any) {
          result = { success: false, error: e.message };
        }

        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      // Second call with tool results
      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolResults,
          ],
        }),
      });

      const followUpData = await followUp.json();
      const reply = followUpData.choices?.[0]?.message?.content || "Operação executada.";

      return new Response(JSON.stringify({
        reply,
        created_entities: createdEntities,
        tool_calls_executed: choice.message.tool_calls.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // No tool calls - regular response
    return new Response(JSON.stringify({
      reply: choice?.message?.content || "Desculpe, não consegui processar.",
      created_entities: [],
      tool_calls_executed: 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("ceo-ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

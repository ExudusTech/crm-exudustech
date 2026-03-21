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

async function buildSpokenReply(
  lovableApiKey: string,
  visualReply: string,
  currentDateTime: string,
  brasiliaISO: string,
) {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você converte respostas visuais da EVA em fala natural para TTS.

Reescreva o conteúdo abaixo como se a EVA estivesse CONVERSANDO com PH, não lendo texto.

REGRAS OBRIGATÓRIAS:
- Saída em português do Brasil, sem markdown, sem listas, sem tabelas.
- Máximo de 70 palavras, salvo se faltar contexto essencial.
- Resuma, interprete e fale como secretária executiva premium, com espontaneidade.
- NUNCA leia datas/horários em formato bruto. Converta para fala natural, como "segunda, vinte e três de março, das oito e meia às dez".
- NUNCA leia pipes, barras, dois pontos técnicos, UUIDs, nomes de campos ou cabeçalhos de tabela.
- Se houver agenda/eventos, destaque só o que mais importa e diga que o restante está na tela.
- Soe como alguém que acabou de verificar a informação e está respondendo ao vivo, não como locutora lendo relatório.
- Use pausas naturais com vírgulas, reticências ocasionais e perguntas quando fizer sentido.
- Quando apropriado, comece com algo como "PH, deixa eu te resumir" ou "Olha, encontrei aqui".
- Se a resposta visual estiver técnica demais, transforme em conversa e destaque só 1 a 3 pontos principais.

Agora em Brasília: ${currentDateTime}
ISO de referência: ${brasiliaISO}`,
          },
          {
            role: "user",
            content: visualReply,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`spoken reply ai error: ${response.status}`);
    }

    const data = await response.json();
    const spokenReply = data.choices?.[0]?.message?.content?.trim();
    return spokenReply || visualReply;
  } catch (error) {
    console.error("Failed to build spoken reply:", error);
    return visualReply;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, user_id, images } = await req.json();
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

    const systemPrompt = `Você é o PH's Chief of Staff — o braço-direito executivo do CEO da ExudusTech. Seu nome é EVA (Executive Virtual Assistant).

PERSONALIDADE E TOM:
- Você é uma secretária executiva BRILHANTE, proativa e carismática. NÃO é um bot, NÃO é um leitor de texto.
- Fale como uma pessoa real falaria com seu chefe: natural, direto, com personalidade.
- Use primeira pessoa: "Deixa eu verificar...", "Olha, encontrei aqui...", "PH, atenção pra isso..."
- Seja CONCISA nas respostas faladas. O CEO não quer ouvir parágrafos enormes, quer o essencial.
- Demonstre inteligência: analise, priorize, destaque o que importa, ignore o que não importa.
- Quando apresentar dados, RESUMA e INTERPRETE — nunca despeje dados crus.

EXEMPLOS DE COMO RESPONDER (siga este estilo):
- Agenda: "PH, sua agenda de hoje tem 3 compromissos. O mais importante é a reunião com a Ambev às 14h — é aquela sobre a proposta comercial. De manhã está tranquilo, só um alinhamento interno às 10h."
- Emails: "Recebi 12 emails novos, mas só 2 precisam da sua atenção: o André respondeu sobre o contrato da HMK e tem um email da Receita Federal que pode ser urgente. O resto é newsletter e notificação."
- Tarefas: "Tem 3 tarefas atrasadas que me preocupam — duas são da iniciativa HMK IA e uma do projeto Fiscal. Quer que eu detalhe?"
- Geral: "Bom dia, PH! Vi que hoje é um dia cheio. Quer que eu comece pelo radar das iniciativas ou prefere ver a agenda primeiro?"

REGRAS DE COMUNICAÇÃO:
- NUNCA leia datas como "21/03/2026" — diga "hoje", "amanhã", "sexta-feira", "semana que vem".
- NUNCA liste IDs, UUIDs ou dados técnicos ao CEO.
- NUNCA diga "aqui estão os resultados" e despeje uma lista — CONVERSE sobre os resultados.
- Quando apresentar agenda, diga horários de forma natural: "às duas da tarde", "às dez da manhã".
- Use o nome "PH" ocasionalmente para personalizar.
- Quando não souber algo, diga: "Não tenho essa informação agora, mas posso verificar..."
- Sugira próximos passos: "Quer que eu envie um email pro André sobre isso?" ou "Posso criar uma tarefa pra acompanhar?"

DATA E HORA ATUAL (Brasília): ${currentDateTime}
ISO para referência em tool calls: ${brasiliaISO}

REGRA CRÍTICA DE PROATIVIDADE:
- Quando o CEO mencionar reuniões, compromissos, agenda — CONSULTE AUTOMATICAMENTE o Google Calendar ANTES de responder.
- Quando pedir email sobre algo da agenda — PRIMEIRO consulte a agenda, DEPOIS prepare o email.
- Quando o CEO pedir para enviar WhatsApp e mencionar apenas um NOME (sem telefone), use OBRIGATORIAMENTE a tool search_contacts para buscar o contato antes. Busque em leads, stakeholders e histórico de mensagens.
- Se search_contacts NÃO encontrar o contato, OFEREÇA PROATIVAMENTE cadastrá-lo como stakeholder: "Não encontrei o [nome] na base. Quer que eu cadastre? Me passa o telefone e eu já registro e envio a mensagem."
- Quando o CEO fornecer o telefone de alguém não cadastrado, use create_stakeholder para registrar ANTES de enviar a mensagem, garantindo que o contato fique salvo para próximas interações.
- Seja PROATIVA: use as ferramentas para buscar informações antes de perguntar ao CEO.
- O CEO espera que você aja como uma assistente de verdade: pesquise, analise e apresente.

${googleConnected ? `INTEGRAÇÃO GOOGLE ATIVA:
Acesso à conta ph@exudustech.com.br. Pode consultar Calendar, Gmail e Drive.
- SEMPRE peça confirmação antes de enviar email ou criar evento.
- Ao listar agenda, fale de forma natural e destaque o que é importante.
- Ao encontrar algo relevante para uma iniciativa, sugira vincular.

REGRAS PARA EMAILS:
- NUNCA despeje emails crus. Analise e faça triagem executiva.
- Classifique: importante vs informativo vs ignorável.
- Para importantes: remetente, resumo de 1 linha, ação necessária.
- Newsletters/notificações automáticas = "X notificações sem ação necessária".
- Pergunte "Quer que eu detalhe algum?" para continuar a conversa.` : `GOOGLE NÃO CONECTADO: Se o CEO pedir algo do Google, informe que precisa conectar em Configurações > Integrações.`}

CADASTRO ASSISTIDO:
1. Identifique TODAS as entidades mencionadas
2. Verifique duplicatas no contexto
3. Pergunte campos faltantes de forma objetiva
4. Mostre resumo e peça confirmação
5. Após "sim"/"ok"/"confirma", execute as tool calls
6. Confirme o que foi feito de forma natural

FORMATAÇÃO PARA TELA (Markdown):
- Use títulos (## ###), tabelas, listas e emojis estratégicos quando for ÚTIL.
- 🟢 OK  🟡 Atenção  🔴 Crítico  📅 Agenda  💰 Financeiro  🎯 Ação
- Mas NÃO exagere na formatação — prefira clareza a decoração.
- Respostas curtas podem ser texto simples, sem necessidade de cabeçalhos.

CONTEXTO ATUAL DO SISTEMA:
${contextStr}`;

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
      // Contact search across CRM and CEO modules
      {
        type: "function",
        function: {
          name: "search_contacts",
          description: "Busca contatos por nome em todas as bases: leads (CRM), stakeholders (CEO) e whatsapp_messages. Use SEMPRE antes de enviar WhatsApp quando não tiver o telefone.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome ou parte do nome do contato" },
            },
            required: ["name"],
          },
        },
      },
      // Communication (CRM bridge)
      {
        type: "function",
        function: {
          name: "send_whatsapp",
          description: "Envia mensagem WhatsApp via módulo CRM. SEMPRE peça confirmação antes. Se não tiver o telefone, use search_contacts primeiro.",
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
      {
        type: "function",
        function: {
          name: "read_whatsapp_messages",
          description: "Consulta mensagens de WhatsApp armazenadas no CRM. Pode buscar por telefone, nome do lead ou listar as mais recentes de um contato.",
          parameters: {
            type: "object",
            properties: {
              phone: { type: "string", description: "Telefone do contato (parcial ou completo)" },
              lead_name: { type: "string", description: "Nome do lead/contato para buscar" },
              limit: { type: "number", description: "Quantidade de mensagens (padrão 20)" },
              direction: { type: "string", enum: ["inbound", "outbound"], description: "Filtrar por direção (recebidas ou enviadas)" },
            },
            required: [],
          },
        },
      },
    ];

    // Build messages for AI, attaching images to the last user message if present
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // If this is the last user message and we have images, use multimodal content
      if (i === messages.length - 1 && msg.role === "user" && images?.length > 0) {
        const content: any[] = [{ type: "text", text: msg.content }];
        for (const img of images) {
          content.push({
            type: "image_url",
            image_url: { url: img },
          });
        }
        aiMessages.push({ role: msg.role, content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    console.log(`[ceo-ai-assistant] Sending ${aiMessages.length} messages to AI, images: ${images?.length || 0}`);

    // First AI call
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: aiMessages,
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
            // Search contacts across all modules
            case "search_contacts": {
              try {
                const searchName = args.name;
                const contacts: Array<{ name: string; phone: string | null; source: string; id: string }> = [];

                // Search in leads (CRM)
                const { data: leads } = await supabase
                  .from("leads")
                  .select("id, name, phone, phones, email")
                  .ilike("name", `%${searchName}%`)
                  .limit(10);

                if (leads) {
                  for (const l of leads) {
                    const phones = [l.phone, ...(l.phones || [])].filter(Boolean);
                    if (phones.length > 0) {
                      contacts.push({ name: l.name, phone: phones[0], source: "CRM (lead)", id: l.id });
                    } else {
                      contacts.push({ name: l.name, phone: null, source: "CRM (lead, sem telefone)", id: l.id });
                    }
                  }
                }

                // Search in stakeholders (CEO)
                const { data: stkh } = await supabase
                  .from("stakeholders")
                  .select("id, name, phone, email, role_title, organization_id")
                  .ilike("name", `%${searchName}%`)
                  .limit(10);

                if (stkh) {
                  for (const s of stkh) {
                    contacts.push({ name: s.name, phone: s.phone || null, source: "Stakeholder", id: s.id });
                  }
                }

                // Search in whatsapp_messages by distinct phones with matching lead names
                if (contacts.length === 0) {
                  const { data: waMsgs } = await supabase
                    .from("whatsapp_messages")
                    .select("phone, lead_id")
                    .not("phone", "is", null)
                    .limit(100);

                  if (waMsgs) {
                    const uniquePhones = [...new Set(waMsgs.map((m: any) => m.phone).filter(Boolean))];
                    contacts.push(...uniquePhones.slice(0, 5).map(p => ({
                      name: "Contato WhatsApp",
                      phone: p,
                      source: "WhatsApp (histórico)",
                      id: "",
                    })));
                  }
                }

                result = {
                  success: true,
                  contacts,
                  total: contacts.length,
                  note: contacts.length === 0
                    ? `Nenhum contato encontrado com nome "${searchName}". O CEO pode informar o telefone diretamente.`
                    : `Encontrados ${contacts.length} contatos. Use o telefone para enviar WhatsApp.`,
                };
              } catch (searchErr: any) {
                result = { success: false, error: searchErr.message };
              }
              break;
            }
            // WhatsApp via CRM - actually send the message
            case "send_whatsapp": {
              try {
                const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    phone: args.target_phone,
                    message: args.message_body,
                  }),
                });
                const sendData = await sendRes.json();
                
                if (!sendRes.ok || sendData.error) {
                  result = { success: false, error: sendData.error || `Erro HTTP ${sendRes.status}` };
                } else {
                  result = { success: true, message: "Mensagem enviada com sucesso" };
                  createdEntities.push(`WhatsApp enviado para ${args.target_name || args.target_phone}`);
                }

                await supabase.from("communication_requests").insert({
                  channel: "whatsapp",
                  source_module: "ceo",
                  target_name: args.target_name,
                  target_phone: args.target_phone,
                  message_body: args.message_body,
                  related_entity_type: args.related_entity_type,
                  related_entity_id: args.related_entity_id,
                  requested_by: "ia_assistant",
                  status: result.success ? "executed" : "failed",
                  executed_at: result.success ? new Date().toISOString() : null,
                  execution_result: JSON.stringify(sendData),
                });
              } catch (sendErr: any) {
                result = { success: false, error: sendErr.message };
                await supabase.from("communication_requests").insert({
                  channel: "whatsapp",
                  source_module: "ceo",
                  target_name: args.target_name,
                  target_phone: args.target_phone,
                  message_body: args.message_body,
                  requested_by: "ia_assistant",
                  status: "failed",
                  execution_result: sendErr.message,
                });
              }
              break;
            }
            // Read WhatsApp messages from CRM
            case "read_whatsapp_messages": {
              try {
                let query = supabase
                  .from("whatsapp_messages")
                  .select("id, lead_id, phone, message, direction, timestamp, created_at")
                  .order("created_at", { ascending: false })
                  .limit(args.limit || 20);

                if (args.direction) query = query.eq("direction", args.direction);

                // If lead_name provided, first find matching leads
                if (args.lead_name) {
                  const { data: leads } = await supabase
                    .from("leads")
                    .select("id, name, phone, phones")
                    .ilike("name", `%${args.lead_name}%`)
                    .limit(5);
                  
                  if (leads && leads.length > 0) {
                    const leadIds = leads.map((l: any) => l.id);
                    query = query.in("lead_id", leadIds);
                    result = { leads_found: leads.map((l: any) => ({ name: l.name, phone: l.phone })) };
                  } else {
                    result = { success: true, messages: [], note: `Nenhum lead encontrado com nome "${args.lead_name}"` };
                    break;
                  }
                }

                if (args.phone) {
                  const digits = args.phone.replace(/\D/g, "");
                  const suffix = digits.slice(-8);
                  query = query.ilike("phone", `%${suffix}%`);
                }

                const { data: msgs, error: msgErr } = await query;
                if (msgErr) {
                  result = { success: false, error: msgErr.message };
                } else {
                  // Enrich with lead names
                  const leadIds = [...new Set((msgs || []).map((m: any) => m.lead_id).filter(Boolean))];
                  let leadMap: Record<string, string> = {};
                  if (leadIds.length > 0) {
                    const { data: leadNames } = await supabase
                      .from("leads")
                      .select("id, name")
                      .in("id", leadIds);
                    if (leadNames) leadMap = Object.fromEntries(leadNames.map((l: any) => [l.id, l.name]));
                  }

                  result = {
                    success: true,
                    messages: (msgs || []).map((m: any) => ({
                      contact: leadMap[m.lead_id] || m.phone,
                      phone: m.phone,
                      message: m.message,
                      direction: m.direction === "inbound" ? "recebida" : "enviada",
                      timestamp: m.timestamp || m.created_at,
                    })),
                  };
                }
              } catch (readErr: any) {
                result = { success: false, error: readErr.message };
              }
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
      const spokenReply = await buildSpokenReply(LOVABLE_API_KEY, reply, currentDateTime, brasiliaISO);

      return new Response(JSON.stringify({
        reply,
        spoken_reply: spokenReply,
        created_entities: createdEntities,
        tool_calls_executed: choice.message.tool_calls.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // No tool calls - regular response
    const reply = choice?.message?.content || "Desculpe, não consegui processar.";
    const spokenReply = await buildSpokenReply(LOVABLE_API_KEY, reply, currentDateTime, brasiliaISO);

    return new Response(JSON.stringify({
      reply,
      spoken_reply: spokenReply,
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

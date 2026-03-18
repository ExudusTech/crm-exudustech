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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode } = await req.json();
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

    const contextStr = JSON.stringify({
      initiatives: initiatives.data || [],
      tasks: tasks.data || [],
      organizations: orgs.data || [],
      stakeholders: stakeholders.data || [],
      products: products.data || [],
      projects: projects.data || [],
      upcoming_events: events.data || [],
      recent_history: recentHistory.data || [],
    });

    const systemPrompt = `Você é o Assistente Executivo IA do Sistema CEO da ExudusTech.
Responda SEMPRE em português brasileiro, de forma objetiva, estratégica e executiva.

CAPACIDADES IMPORTANTES:
Você pode criar e vincular entidades no sistema. Quando o CEO pedir para cadastrar algo, use as ferramentas disponíveis.

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
- O sistema possui um histórico expandido por iniciativa com: atualizações, conversas, interpretações da IA, ações geradas, decisões, lições aprendidas e lacunas detectadas.
- Ao processar uma conversa sobre uma iniciativa, você deve:
  1. Registrar a conversa em initiative_conversations (com raw_user_message e raw_ai_response)
  2. Gerar uma interpretação em initiative_interpretations (entidades, intenção, temas, ações sugeridas, confiança)
  3. Se criar tarefas, decisões ou atualizar status, registrar em initiative_actions
  4. Se detectar algo mencionado que NÃO virou ação, registrar em initiative_gaps
- Use o recent_history do contexto para responder com base no que já foi registrado.
- Sempre que responder sobre uma iniciativa, considere o histórico completo dela.

CONTEXTO ATUAL DO SISTEMA:
${contextStr}

REGRAS DE FORMATAÇÃO DE RESPOSTA (OBRIGATÓRIAS):
Você DEVE formatar suas respostas de forma visual, clara e profissional usando Markdown avançado.

1. **Estrutura visual**: Use títulos (## e ###), separadores (---), listas e tabelas para organizar a informação.
2. **Emojis estratégicos**: Use emojis relevantes para facilitar a leitura rápida:
   - 🟢 Ativo/OK  🟡 Atenção/Em andamento  🔴 Crítico/Bloqueado  ⚪ Pausado/Esfriado
   - 🎯 Próxima ação  ⚠️ Risco  📊 Dados/Métricas  💰 Financeiro  📅 Agenda
   - 🚀 Prioridade crítica  ⭐ Alta  📌 Média  📎 Baixa
   - ✅ Concluído  ❌ Cancelado  🔄 Em progresso  ⏳ Aguardando
3. **Tabelas Markdown**: Para comparações, listas de entidades ou dashboards, use tabelas:
   | Iniciativa | Status | Prioridade | Próxima Ação |
   |---|---|---|---|
4. **Seções claras**: Agrupe por categoria usando cabeçalhos. Ex: "## 🚀 Iniciativas Críticas", "## 📊 Visão Geral"
5. **Destaques**: Use **negrito** para dados-chave, \`código\` para IDs ou termos técnicos, e > blockquotes para insights ou recomendações executivas.
6. **Indicadores visuais de status**: Sempre acompanhe status com o emoji de cor correspondente.
7. **Barras de progresso textuais**: Para métricas, use representações como: "████████░░ 80%"
8. **Cards de resumo**: Use blockquotes para destacar resumos executivos:
   > 📋 **Resumo**: X iniciativas ativas, Y tarefas pendentes, Z stakeholders envolvidos

EXEMPLOS DE FORMATAÇÃO:

Para um panorama estratégico:
## 📊 Radar Estratégico ExudusTech

### 🚀 Foco Crítico
| Iniciativa | Status | Risco | Próxima Ação |
|---|---|---|---|
| 🟢 SGORJ / Ariel | Ativo | ⚠️ Timing | 🎯 Integrações |

### 💡 Recomendação Executiva
> Priorizar SGORJ e NitsClean esta semana. Controller FG precisa de follow-up urgente.

Para cadastros:
### 📝 Preview do Cadastro
- **Nome**: [nome]
- **Status**: 🟢 Ativo
- **Prioridade**: 🚀 Crítica

Seja SEMPRE visual, organizado e acionável. Nunca responda em texto corrido sem formatação.`;

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
    ];

    // First AI call
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
                createdEntities.push(`Iniciativa "${data.name}" (${data.id})`);
                await logAction(supabase, "initiatives", data.id, "create", "ia_assistant", `IA criou iniciativa "${data.name}"`, args);
              }
              break;
            }
            case "create_organization": {
              const { data, error } = await supabase.from("organizations").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Organização "${data.name}" (${data.id})`);
                await logAction(supabase, "organizations", data.id, "create", "ia_assistant", `IA criou organização "${data.name}"`, args);
              }
              break;
            }
            case "create_stakeholder": {
              const { data, error } = await supabase.from("stakeholders").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Stakeholder "${data.name}" (${data.id})`);
                await logAction(supabase, "stakeholders", data.id, "create", "ia_assistant", `IA criou stakeholder "${data.name}"`, args);
              }
              break;
            }
            case "create_task": {
              const { data, error } = await supabase.from("ceo_tasks").insert(args).select("id, title").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, title: data.title };
              if (data) {
                createdEntities.push(`Tarefa "${data.title}" (${data.id})`);
                await logAction(supabase, "ceo_tasks", data.id, "create", "ia_assistant", `IA criou tarefa "${data.title}"`, args);
              }
              break;
            }
            case "create_project": {
              const { data, error } = await supabase.from("projects").insert(args).select("id, name").single();
              result = error ? { success: false, error: error.message } : { success: true, id: data.id, name: data.name };
              if (data) {
                createdEntities.push(`Projeto "${data.name}" (${data.id})`);
                await logAction(supabase, "projects", data.id, "create", "ia_assistant", `IA criou projeto "${data.name}"`, args);
              }
              break;
            }
            case "link_stakeholder_to_initiative": {
              const { error } = await supabase.from("initiative_stakeholders").insert(args);
              result = error ? { success: false, error: error.message } : { success: true };
              if (!error) {
                createdEntities.push(`Vínculo stakeholder-iniciativa criado`);
                await logAction(supabase, "initiative_stakeholders", null, "create", "ia_assistant", `IA vinculou stakeholder à iniciativa`, args);
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

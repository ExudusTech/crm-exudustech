import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPrompt } from "../_shared/get-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Lead {
  id: string;
  name: string;
  email: string;
  emails?: string[];
  phones?: string[];
  description?: string | null;
  valor?: number | null;
  moeda?: string | null;
  produto?: string | null;
  publicidade_subtipo?: string | null;
  status?: string | null;
  valor_manually_edited?: boolean | null;
  created_at: string;
  updated_at?: string;
  last_interaction?: string;
}

interface LeadNote {
  note: string;
  created_at: string;
}

interface WhatsAppMessage {
  message: string | null;
  direction: string;
  timestamp: string | null;
  created_at: string;
}

interface EmailMessage {
  subject?: string;
  message: string | null;
  direction: string;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if a specific leadId was provided
    let specificLeadId: string | null = null;
    let filter: { status?: string[]; produto?: string } | null = null;
    try {
      const body = await req.json();
      specificLeadId = body.leadId || null;
      filter = body.filter || null;
    } catch {
      // No body or invalid JSON - process all leads
    }

    let leads: Lead[] = [];

    if (specificLeadId) {
      console.log(`Diagnóstico individual para lead: ${specificLeadId}`);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", specificLeadId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar lead: ${error.message}`);
      }
      leads = data ? [data] : [];
    } else if (filter) {
      console.log(`Diagnóstico com filtro:`, filter);
      let query = supabase.from("leads").select("*");
      if (filter.status && filter.status.length > 0) {
        query = query.in("status", filter.status);
      }
      if (filter.produto) {
        query = query.eq("produto", filter.produto);
      }
      const { data, error: filterError } = await query;
      if (filterError) {
        throw new Error(`Erro ao buscar leads com filtro: ${filterError.message}`);
      }
      leads = data || [];
    } else {
      const { data, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .in("status", ["em_aberto", "em_negociacao"])
        .eq("archived", false)
        .eq("unclassified", false);

      if (leadsError) {
        throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
      }
      leads = data || [];
    }

    console.log(`Encontrados ${leads.length} leads para diagnóstico`);

    const results: Array<{ leadId: string; name: string; probability: number; success: boolean; error?: string }> = [];

    for (const lead of leads || []) {
      try {
        console.log(`Processando lead: ${lead.name} (${lead.id})`);

        const { data: notes } = await supabase
          .from("lead_notes")
          .select("note, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: true });

        const { data: whatsappMessages } = await supabase
          .from("whatsapp_messages")
          .select("message, direction, timestamp, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: true });

        const { data: emailMessages } = await supabase
          .from("email_messages")
          .select("subject, message, direction, timestamp")
          .eq("lead_id", lead.id)
          .order("timestamp", { ascending: true });

        const context = buildLeadContext(lead, notes || [], whatsappMessages || [], emailMessages || []);

        const diagnosis = await getDiagnosis(lovableApiKey, context);

        const updateData: any = {
          ai_diagnosis: diagnosis.diagnosis,
          ai_close_probability: diagnosis.probability,
          ai_next_step: diagnosis.nextStep,
          ai_diagnosis_reason: diagnosis.reason,
          ai_diagnosis_updated_at: new Date().toISOString(),
        };
        if (diagnosis.produto && !lead.produto) {
          updateData.produto = diagnosis.produto;
        }
        const effectiveProduto = updateData.produto || lead.produto;
        if (effectiveProduto === 'publicidade' && diagnosis.publicidade_subtipo && !lead.publicidade_subtipo) {
          updateData.publicidade_subtipo = diagnosis.publicidade_subtipo;
        }
        if (diagnosis.valor > 0 && !lead.valor_manually_edited) {
          updateData.valor = diagnosis.valor;
          if (diagnosis.moeda) {
            updateData.moeda = diagnosis.moeda;
          }
        }
        const { error: updateError } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", lead.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar lead: ${updateError.message}`);
        }

        results.push({
          leadId: lead.id,
          name: lead.name,
          probability: diagnosis.probability,
          success: true,
        });

        console.log(`Lead ${lead.name} diagnosticado: ${diagnosis.probability}% chance de fechar`);
      } catch (error: any) {
        console.error(`Erro ao processar lead ${lead.id}:`, error);
        results.push({
          leadId: lead.id,
          name: lead.name,
          probability: 0,
          success: false,
          error: error.message,
        });
      }
    }

    results.sort((a, b) => b.probability - a.probability);

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro no diagnóstico:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildLeadContext(
  lead: Lead,
  notes: LeadNote[],
  whatsappMessages: WhatsAppMessage[],
  emailMessages: EmailMessage[]
): string {
  let context = `# Lead: ${lead.name}\n\n`;

  context += `## Informações Básicas\n`;
  context += `- Email: ${lead.email || "Não informado"}\n`;
  context += `- Telefones: ${lead.phones?.join(", ") || "Não informado"}\n`;
  context += `- Produto de interesse: ${lead.produto || "Não identificado"}\n`;
  if (lead.produto === 'publicidade') {
    context += `- Subtipo publicidade: ${lead.publicidade_subtipo || "Não identificado"}\n`;
  }
  context += `- Valor estimado: ${lead.moeda || "BRL"} ${lead.valor?.toLocaleString("pt-BR") || "Não definido"}\n`;
  context += `- Status atual: ${lead.status || "Em aberto"}\n`;
  context += `- Criado em: ${new Date(lead.created_at).toLocaleDateString("pt-BR")}\n`;
  if (lead.description) {
    context += `- Descrição: ${lead.description}\n`;
  }
  context += "\n";

  if (notes.length > 0) {
    context += `## Notas (${notes.length})\n`;
    notes.forEach((note, i) => {
      const date = new Date(note.created_at).toLocaleDateString("pt-BR");
      context += `### Nota ${i + 1} (${date}):\n${note.note}\n\n`;
    });
  }

  if (whatsappMessages.length > 0) {
    context += `## Mensagens WhatsApp (${whatsappMessages.length})\n`;
    const recentMessages = whatsappMessages.slice(-30);
    recentMessages.forEach((msg) => {
      const date = msg.timestamp
        ? new Date(msg.timestamp).toLocaleString("pt-BR")
        : new Date(msg.created_at).toLocaleString("pt-BR");
      const sender = msg.direction === "inbound" ? "Lead" : "Nós";
      context += `[${date}] ${sender}: ${msg.message || "(sem texto)"}\n`;
    });
    context += "\n";
  }

  if (emailMessages.length > 0) {
    context += `## Emails (${emailMessages.length})\n`;
    const recentEmails = emailMessages.slice(-20);
    recentEmails.forEach((email) => {
      const date = new Date(email.timestamp).toLocaleString("pt-BR");
      const sender = email.direction === "inbound" ? "Lead" : "Nós";
      const subject = email.subject ? `[${email.subject}] ` : "";
      const messageContent = email.message || "(sem conteúdo)";
      context += `[${date}] ${sender}: ${subject}${messageContent}\n---\n`;
    });
    context += "\n";
  }

  return context;
}

async function getDiagnosis(
  apiKey: string,
  context: string
): Promise<{
  diagnosis: string;
  probability: number;
  nextStep: string;
  reason: string;
  produto: string;
  publicidade_subtipo: string;
  valor: number;
  moeda: string;
}> {
  const defaultPrompt = `Você é um especialista em vendas B2B com foco em palestras, consultorias, mentorias e treinamentos corporativos.

Sua tarefa é analisar todas as informações de um lead e fornecer:
1. Um diagnóstico geral da situação do lead
2. A probabilidade de fechamento (0-100%)
3. O próximo passo concreto para avançar a venda
4. A justificativa para a nota de probabilidade

Considere os seguintes fatores para avaliar a probabilidade:
- Interesse demonstrado (perguntas sobre preço, datas, disponibilidade = positivo)
- Engajamento nas conversas (respostas rápidas, perguntas detalhadas = positivo)
- Objeções levantadas (preço alto, timing ruim, precisa de aprovação = negativo)
- Tempo desde o primeiro contato (muito tempo sem avanço = negativo)
- Clareza sobre o que querem (sabem exatamente o que precisam = positivo)
- Poder de decisão (é o decisor ou precisa aprovar com outros = impacta probabilidade)
- Orçamento definido (tem verba aprovada = muito positivo)
- Urgência (precisa para data específica = positivo)

Seja realista e objetivo. Leads frios devem ter probabilidade baixa (0-20%).
Leads quentes com objeções resolvidas podem ter 60-80%.
Só dê 90%+ para leads praticamente fechados.`;

  const systemPrompt = await getPrompt("14", defaultPrompt);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analise este lead e forneça o diagnóstico:\n\n${context}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "provide_lead_diagnosis",
            description: "Fornecer diagnóstico completo do lead com probabilidade de fechamento",
            parameters: {
              type: "object",
              properties: {
                diagnosis: {
                  type: "string",
                  description: "Diagnóstico geral da situação do lead em 2-3 frases",
                },
                probability: {
                  type: "integer",
                  description: "Probabilidade de fechamento de 0 a 100",
                  minimum: 0,
                  maximum: 100,
                },
                nextStep: {
                  type: "string",
                  description: "Próximo passo concreto e acionável para avançar a venda",
                },
                reason: {
                  type: "string",
                  description: "Justificativa para a nota de probabilidade atribuída",
                },
                produto: {
                  type: "string",
                  enum: ["palestra", "consultoria", "mentoria", "treinamento", "publicidade", ""],
                  description: "Tipo de produto/serviço que o lead pretende contratar. Use apenas os valores permitidos: palestra, consultoria, mentoria, treinamento, publicidade. Se não souber, use string vazia.",
                },
                publicidade_subtipo: {
                  type: "string",
                  enum: ["instagram", "youtube", "youtube_instagram", ""],
                  description: "Apenas para leads de publicidade. Se não for publicidade, use string vazia.",
                },
                valor: {
                  type: "number",
                  description: "Valor monetário identificado na conversa. Apenas o número, sem símbolo de moeda. Se não mencionado, use 0.",
                },
                moeda: {
                  type: "string",
                  enum: ["BRL", "USD", "EUR", ""],
                  description: "Moeda do valor identificado. BRL para reais, USD para dólares, EUR para euros. Se não souber, use string vazia.",
                },
              },
              required: ["diagnosis", "probability", "nextStep", "reason", "produto", "publicidade_subtipo", "valor", "moeda"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "provide_lead_diagnosis" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API:", response.status, errorText);
    throw new Error(`Erro na API de IA: ${response.status}`);
  }

  const data = await response.json();
  console.log("finish_reason:", data.choices?.[0]?.finish_reason);

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  // Fallback: se não houver tool_call, tenta extrair JSON do conteúdo textual
  let args: any;
  if (toolCall) {
    args = JSON.parse(toolCall.function.arguments);
  } else {
    const textContent = data.choices?.[0]?.message?.content || "";
    console.warn("Tool call ausente. Conteúdo:", textContent.substring(0, 500));
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error("Resposta da IA não contém tool call nem JSON parseável");
    }
    try {
      args = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch {
      throw new Error("Resposta da IA não pôde ser parseada como JSON");
    }
  }

  const validProdutos = ['palestra', 'consultoria', 'mentoria', 'treinamento', 'publicidade'];
  const rawProduto = (args.produto || '').toLowerCase().trim();
  const produto = validProdutos.includes(rawProduto) ? rawProduto : '';

  const validSubtipos = ['instagram', 'youtube', 'youtube_instagram'];
  const rawSubtipo = (args.publicidade_subtipo || '').toLowerCase().trim();
  const publicidade_subtipo = validSubtipos.includes(rawSubtipo) ? rawSubtipo : '';

  const validMoedas = ['BRL', 'USD', 'EUR'];
  const rawMoeda = (args.moeda || '').toUpperCase().trim();
  const moeda = validMoedas.includes(rawMoeda) ? rawMoeda : '';
  const valor = typeof args.valor === 'number' && args.valor > 0 ? args.valor : 0;

  return {
    diagnosis: args.diagnosis || "Sem diagnóstico disponível",
    probability: Math.min(100, Math.max(0, parseInt(args.probability) || 0)),
    nextStep: args.nextStep || "Revisar manualmente",
    reason: args.reason || "Sem justificativa",
    produto,
    publicidade_subtipo,
    valor,
    moeda,
  };
}

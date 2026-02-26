import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getPrompt } from "../_shared/get-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    if (!leadId) {
      throw new Error('Lead ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar informações do lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    // Buscar mensagens de email
    const { data: emailMessages } = await supabase
      .from('email_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Buscar mensagens WhatsApp
    const { data: whatsappMessages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Preparar contexto para a IA
    const emailContext = emailMessages?.map(m => 
      `Email (${m.direction}): ${m.subject || 'Sem assunto'}\n${m.message || ''}`
    ).join('\n\n') || 'Nenhum email registrado';

    const whatsappContext = whatsappMessages?.map(m => 
      `WhatsApp (${m.direction}): ${m.message || ''}`
    ).join('\n\n') || 'Nenhuma mensagem WhatsApp registrada';

    const defaultPrompt = `Analise todas as informações deste lead e extraia:

1. Uma descrição profissional e concisa (máximo 2-3 frases) resumindo:
   - Quem é o lead (nome da empresa/organização se houver)
   - O que ele quer/precisa (tipo de serviço, tema, objetivo)
   - Prazos ou datas importantes mencionadas
   - Contexto relevante das interações
   
   REGRAS CRÍTICAS PARA A DESCRIÇÃO:
   - NUNCA mencione valores monetários, preços, orçamentos ou custos na descrição
   - NUNCA inclua números que representem dinheiro (ex: "R$ 5.000", "USD 10,000", etc.)
   - A descrição deve focar APENAS em: quem é o lead, o que precisa, e quando precisa
   - Se o lead mencionar valores nas mensagens, IGNORE completamente para a descrição

2. O valor estimado do negócio (apenas o número, sem símbolos ou pontuação). Se não houver valor mencionado, retorne null.

3. A moeda do valor. Identifique se está em:
   - "USD" (dólares americanos)
   - "EUR" (euros)
   - "BRL" (reais brasileiros)
   Se não puder determinar, assuma "BRL" por padrão.

4. O tipo de produto/serviço de interesse. Deve ser EXATAMENTE uma dessas opções:
   - "palestra"
   - "consultoria" 
   - "mentoria"
   - "treinamento"
   - "publicidade"
   Se não puder determinar com certeza, retorne null.

5. Uma sugestão de mensagem de follow-up para WhatsApp que:
   - Continue a conversa naturalmente a partir da última mensagem (como uma conversa de WhatsApp)
   - Seja OBJETIVA e CURTA (máximo 2-3 frases)
   - Foque em FECHAR O NEGÓCIO diretamente
   - EVITE ao máximo marcar reunião - sempre tente fechar sem reunião
   - NÃO use saudações genéricas como "oi fulano" ou "estou aqui"
   - Crie senso de urgência e escassez
   - Seja específico e personalizado baseado no contexto da última mensagem
   - Use técnicas de persuasão para aumentar chance de fechamento rápido

Informações do Lead:
- Nome: {leadName}
- Emails: {leadEmails}
- Telefones: {leadPhones}
- Fonte: {leadSource}

Últimas Interações por Email:
{emailContext}

Últimas Interações por WhatsApp:
{whatsappContext}`;

    const prompt = await getPrompt("13", defaultPrompt, {
      leadName: lead.name,
      leadEmails: lead.emails?.join(', ') || lead.email || '',
      leadPhones: lead.phones?.join(', ') || lead.phone || 'Não registrado',
      leadSource: lead.source || '',
      emailContext,
      whatsappContext,
    });

    // Chamar Lovable AI com tool calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em analisar leads e extrair informações estruturadas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_lead_info",
              description: "Atualizar informações do lead com descrição, valor, moeda e produto",
              parameters: {
                type: "object",
                properties: {
                  description: { 
                    type: "string",
                    description: "Descrição concisa do lead (2-3 frases)"
                  },
                  valor: { 
                    type: ["number", "null"],
                    description: "Valor estimado do negócio (apenas número, sem formatação ou símbolos de moeda)"
                  },
                  moeda: {
                    type: "string",
                    enum: ["BRL", "USD", "EUR"],
                    description: "Moeda do valor (BRL, USD ou EUR)"
                  },
                  produto: { 
                    type: ["string", "null"],
                    enum: ["palestra", "consultoria", "mentoria", "treinamento", "publicidade", null],
                    description: "Tipo de produto/serviço de interesse"
                  },
                  publicidade_subtipo: {
                    type: ["string", "null"],
                    enum: ["instagram", "youtube", "youtube_instagram", null],
                    description: "Apenas para publicidade: instagram = vídeo curto/reels, youtube = vídeo longo, youtube_instagram = ambos. Null se não for publicidade."
                  },
                  suggested_followup: {
                    type: "string",
                    description: "Sugestão de mensagem de follow-up para WhatsApp: objetiva, curta (2-3 frases), focada em fechar negócio sem reunião, continuando naturalmente a conversa"
                  }
                },
                required: ["description", "valor", "moeda", "produto", "publicidade_subtipo", "suggested_followup"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "update_lead_info" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Erro ao gerar descrição com IA');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('Não foi possível processar as informações do lead');
    }

    const leadInfo = JSON.parse(toolCall.function.arguments);
    console.log('Informações extraídas:', leadInfo);

    // Preparar objeto de atualização
    const updateData: any = {
      description: leadInfo.description,
      produto: leadInfo.produto,
      suggested_followup: leadInfo.suggested_followup,
      description_updated_at: new Date().toISOString()
    };

    // Atualizar subtipo de publicidade se aplicável
    if (leadInfo.produto === 'publicidade' && leadInfo.publicidade_subtipo) {
      updateData.publicidade_subtipo = leadInfo.publicidade_subtipo;
    }

    // Só atualizar valor e moeda se não foram editados manualmente
    if (!lead.valor_manually_edited) {
      updateData.valor = leadInfo.valor;
      updateData.moeda = leadInfo.moeda || 'BRL';
    }

    // Atualizar lead com as informações
    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        description: leadInfo.description,
        valor: leadInfo.valor,
        moeda: leadInfo.moeda || 'BRL',
        produto: leadInfo.produto,
        publicidade_subtipo: leadInfo.publicidade_subtipo || null,
        suggested_followup: leadInfo.suggested_followup
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating lead description:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
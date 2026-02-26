import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Texto é obrigatório');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const defaultPrompt = `Analise o seguinte texto e extraia todas as informações de um lead possíveis:

1. Nome da pessoa (se houver nome de empresa, use formato "Nome - Empresa")
2. Lista de emails encontrados
3. Lista de telefones encontrados (formato internacional se possível)
4. Descrição resumida do lead (máximo 200 caracteres)
5. Valor do negócio em reais (apenas número, sem R$ ou formatação). Se não encontrar, use null.
6. Tipo de produto/serviço. Opções: "palestra", "consultoria", "mentoria", "treinamento", "publicidade". 
   Se não conseguir determinar, use null.
7. Origem do lead. Opções: "instagram", "linkedin", "email", "whatsapp", "indicacao", "site", "evento", "outro".
   Determine baseado no contexto (ex: se menciona DM do Instagram, use "instagram"). Se não conseguir determinar, use null.

Texto:
{text}`;

    const prompt = await getPrompt("2", defaultPrompt, { text });

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
            content: 'Você é um assistente especializado em extrair informações estruturadas de leads.'
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
              name: "extract_lead_data",
              description: "Extrair dados estruturados do lead",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "Nome da pessoa ou Nome - Empresa"
                  },
                  emails: { 
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de emails encontrados"
                  },
                  phones: { 
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de telefones (formato internacional)"
                  },
                  description: { 
                    type: "string",
                    description: "Descrição resumida (máximo 200 caracteres)"
                  },
                  valor: {
                    type: ["number", "null"],
                    description: "Valor do negócio em reais (apenas número)"
                  },
                  produto: {
                    type: ["string", "null"],
                    enum: ["palestra", "consultoria", "mentoria", "treinamento", "publicidade", null],
                    description: "Tipo de produto"
                  },
                  origem: {
                    type: ["string", "null"],
                    enum: ["instagram", "linkedin", "email", "whatsapp", "indicacao", "site", "evento", "outro", null],
                    description: "Origem do lead"
                  }
                },
                required: ["name", "emails", "phones", "description", "valor", "produto", "origem"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_lead_data" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Erro ao processar texto com IA');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('Não foi possível extrair informações do texto');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Dados extraídos:', extractedData);

    // Validar e normalizar dados
    const result = {
      name: (extractedData.name || '').trim(),
      emails: Array.isArray(extractedData.emails) ? extractedData.emails.filter((e: string) => e && e.includes('@')) : [],
      phones: Array.isArray(extractedData.phones) ? extractedData.phones.filter((p: string) => p && p.length > 0) : [],
      description: (extractedData.description || '').trim().substring(0, 200),
      valor: extractedData.valor,
      produto: extractedData.produto,
      origem: extractedData.origem
    };

    // Validar que ao menos um campo foi extraído
    if (!result.name && result.emails.length === 0 && result.phones.length === 0) {
      throw new Error('Não foi possível extrair informações do texto fornecido');
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error extracting lead info:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPrompt } from "../_shared/get-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, leadName } = await req.json();
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log(`Gerando export para lead: ${leadName}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: await getPrompt("20", `Você é um assistente que gera resumos estruturados de oportunidades de negócio. Analise todas as informações fornecidas e extraia um JSON completo e organizado.

Retorne APENAS via tool call. Preencha todos os campos com base no contexto. Se não houver informação para um campo, use null.
IMPORTANTE: Os campos expected_payment_date e delivery_date devem ser preenchidos com as datas encontradas no contexto (formato YYYY-MM-DD). Procure por "expected_payment_date", "delivery_date", "data entregue", "data próximo pagamento" ou datas similares.`),
          },
          {
            role: "user",
            content: `Gere o resumo exportável desta oportunidade:\n\n${context}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "export_lead",
              description: "Exportar resumo completo da oportunidade",
              parameters: {
                type: "object",
                properties: {
                  nome_oportunidade: {
                    type: "string",
                    description: "Nome da oportunidade/lead",
                  },
                  nome_pessoa: {
                    type: "string",
                    description: "Nome da pessoa de contato (se identificável)",
                  },
                  nome_empresa: {
                    type: "string",
                    description: "Nome da empresa (se identificável)",
                  },
                  produto: {
                    type: "string",
                    description: "Tipo de produto/serviço contratado",
                  },
                  moeda: {
                    type: "string",
                    description: "Código da moeda (ex: BRL, USD, EUR)",
                  },
                  valor: {
                    type: "string",
                    description: "Valor numérico do negócio como string (ex: 5000)",
                  },
                  valor_pago: {
                    type: "string",
                    description: "Valor numérico já pago como string (ex: 0)",
                  },
                  expected_payment_date: {
                    type: "string",
                    description: "Data esperada para o próximo pagamento no formato YYYY-MM-DD",
                  },
                  delivery_date: {
                    type: "string",
                    description: "Data em que o projeto/serviço foi entregue ao cliente no formato YYYY-MM-DD",
                  },
                  invoice_url: {
                    type: "string",
                    description: "URL de pagamento/fatura se disponível",
                  },
                  emails: {
                    type: "array",
                    items: { type: "string" },
                    description: "Todos os emails relacionados à oportunidade",
                  },
                  telefones: {
                    type: "array",
                    items: { type: "string" },
                    description: "Todos os telefones relacionados",
                  },
                  origem: {
                    type: "string",
                    description: "Canal de origem do lead",
                  },
                  resumo: {
                    type: "string",
                    description: "Resumo executivo da oportunidade em 2-3 frases",
                  },
                  idioma: {
                    type: "string",
                    description: "Idioma predominante usado pelo cliente nas conversas (ex: português, inglês, espanhol, etc.)",
                  },
                },
                required: [
                  "nome_oportunidade",
                  "nome_pessoa",
                  "nome_empresa",
                  "produto",
                  "moeda",
                  "valor",
                  "emails",
                  "resumo",
                  "idioma",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "export_lead" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API:", response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("Resposta da IA não contém tool call");
    }

    const exportData = JSON.parse(toolCall.function.arguments);
    console.log("Export gerado (raw):", JSON.stringify(exportData));

    // Limpar dados: converter strings "null"/"undefined" para null real
    const invalidValues = ["null", "undefined", ""];
    for (const key in exportData) {
      if (Array.isArray(exportData[key])) {
        exportData[key] = exportData[key].filter(
          (v: any) => v && typeof v === "string" && !invalidValues.includes(v.toLowerCase().trim())
        );
      } else if (typeof exportData[key] === "string" && invalidValues.includes(exportData[key].toLowerCase().trim())) {
        exportData[key] = null;
      }
    }
    console.log("Export limpo:", JSON.stringify(exportData));

    // Enviar para o webhook client-intake diretamente do backend (evita CORS)
    const webhookUrl = "https://mnxukwxeulnxunrexhra.supabase.co/functions/v1/client-intake";
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      });

      if (!webhookResponse.ok) {
        const webhookError = await webhookResponse.text();
        console.error("Webhook error:", webhookResponse.status, webhookError);
        throw new Error(`Webhook retornou ${webhookResponse.status}: ${webhookError}`);
      }

      console.log("Webhook enviado com sucesso");
    } catch (webhookErr: any) {
      console.error("Erro ao enviar para webhook:", webhookErr);
      return new Response(
        JSON.stringify({ error: `Erro ao enviar para webhook: ${webhookErr.message}`, export: exportData }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, export: exportData }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao gerar export:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

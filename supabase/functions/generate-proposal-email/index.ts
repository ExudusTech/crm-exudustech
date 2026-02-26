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
    const { leadName, leadDescription, produto, valor, moeda, proposalUrl, emails } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não está configurada');
    }

    console.log('Gerando email de proposta para:', leadName);
    console.log('Produto:', produto);
    console.log('Valor:', valor, moeda);
    console.log('Proposal URL:', proposalUrl);

    // Extrair contexto da empresa/lead da descrição
    const empresaContext = leadDescription || 'empresa';

    const valorFormatado = valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(valor) : 'A definir';
    
    const defaultPrompt = `Você é Miguel Fernandes, palestrante especialista em Inteligência Artificial aplicada aos negócios.

Você precisa escrever um email enviando uma proposta comercial para uma palestra.

INFORMAÇÕES DO LEAD:
- Nome/Empresa: {leadName}
- Descrição/Contexto: {leadDescription}
- Produto: {produto}
- Valor: {valor formatado}
- Link da proposta: {proposalUrl}

INSTRUÇÕES PARA O EMAIL:
1. Comece expressando que está muito honrado em receber esse convite
2. Mencione que você gosta muito da temática de Inteligência Artificial aplicada
3. Faça referência ao nicho/área de atuação da empresa (baseado na descrição)
4. Diga que quer muito viabilizar essa palestra para estar com eles
5. IMPORTANTE: NÃO cole a URL da proposta diretamente no texto. Em vez disso, use o texto "Clique aqui para acessar a proposta" ou similar para indicar onde o link será inserido. O sistema irá transformar isso em um link clicável automaticamente.
6. Pergunte se podem responder até o início da próxima semana, pois sua agenda está super apertada mas você quer muito viabilizar
7. Seja cordial, profissional mas também pessoal e caloroso
8. Use português brasileiro

FORMATO DE RESPOSTA:
Retorne APENAS o email no seguinte formato:

Assunto: [assunto do email]

[corpo do email - NÃO inclua assinatura, ela será adicionada automaticamente. NÃO inclua a URL crua da proposta no texto.]`;

    const prompt = await getPrompt("1", defaultPrompt, {
      leadName,
      leadDescription: leadDescription || 'Não informado',
      produto: produto || 'Palestra',
      'valor formatado': valorFormatado,
      proposalUrl,
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro da Lovable AI: ${response.status}`);
    }

    const data = await response.json();
    const generatedEmail = data.choices[0].message.content;

    console.log('Email gerado com sucesso');

    // Separar assunto e corpo
    const lines = generatedEmail.split('\n');
    let subject = '';
    let body = '';
    
    if (lines[0].toLowerCase().startsWith('assunto:') || lines[0].toLowerCase().startsWith('subject:')) {
      subject = lines[0].replace(/^(assunto|subject):/i, '').trim();
      body = lines.slice(2).join('\n').trim();
    } else {
      subject = `Proposta de Palestra - ${leadName}`;
      body = generatedEmail.trim();
    }

    return new Response(
      JSON.stringify({ subject, body }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro em generate-proposal-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

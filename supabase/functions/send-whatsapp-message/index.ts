import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, leadId } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'phone e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Z-API não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone (remover caracteres especiais)
    // O número deve estar cadastrado com código de país incluso (ex: 5511999998888)
    let normalizedPhone = phone.replace(/\D/g, '');

    // Ao iniciar um chat (primeiro outbound), precisamos persistir o chatLid no lead
    // para que callbacks do webhook que chegam como "@lid" nunca mais virem órfãos.
    let resolvedChatLid: string | null = null;
    if (leadId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: lead } = await supabase
          .from('leads')
          .select('id, whatsapp_chat_lids')
          .eq('id', leadId)
          .maybeSingle();

        const existingChatLids: string[] = lead?.whatsapp_chat_lids || [];

        const phoneExistsUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/phone-exists/${normalizedPhone}`;
        const phoneExistsRes = await fetch(phoneExistsUrl, {
          method: 'GET',
          headers: {
            'Client-Token': ZAPI_CLIENT_TOKEN,
          },
        });

        if (!phoneExistsRes.ok) {
          const errTxt = await phoneExistsRes.text().catch(() => '');
          console.error(
            `Erro Z-API phone-exists para ${normalizedPhone}: ${phoneExistsRes.status}${errTxt ? ` - ${errTxt}` : ''}`
          );
        } else {
          const phoneExistsData = await phoneExistsRes.json();
          if (phoneExistsData?.exists && phoneExistsData?.lid) {
            const formatted = (phoneExistsData.lid as string).includes('@')
              ? (phoneExistsData.lid as string)
              : `${phoneExistsData.lid}@lid`;

            resolvedChatLid = formatted;

            if (!existingChatLids.includes(formatted)) {
              const { error: updateErr } = await supabase
                .from('leads')
                .update({ whatsapp_chat_lids: [...existingChatLids, formatted] })
                .eq('id', leadId);

              if (updateErr) {
                console.error('Erro ao salvar whatsapp_chat_lids no lead:', updateErr);
              } else {
                console.log('chatLid persistido no lead (início de chat):', formatted);
              }
            }

            // Se já existir algum callback órfão com @lid, tentar reconciliar imediatamente.
            const { error: reconcileErr } = await supabase
              .from('whatsapp_messages')
              .update({ lead_id: leadId })
              .is('lead_id', null)
              .or(`phone.eq.${formatted},raw_data->>chatLid.eq.${formatted}`);

            if (reconcileErr) {
              console.error('Erro ao reconciliar mensagens órfãs (pre-send):', reconcileErr);
            }
          }
        }
      } catch (e) {
        console.error('Falha ao resolver/persistir chatLid antes de enviar:', e);
      }
    }

    // Enviar mensagem via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    
    console.log('Enviando mensagem para:', normalizedPhone);
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: message,
      }),
    });

    const zapiData = await zapiResponse.json();
    console.log('Resposta Z-API:', zapiData);

    if (!zapiResponse.ok) {
      throw new Error(`Erro Z-API: ${JSON.stringify(zapiData)}`);
    }

    // Salvar mensagem no banco de dados
    if (leadId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('whatsapp_messages')
        .insert({
          lead_id: leadId,
          phone: normalizedPhone,
          message: message,
          direction: 'outbound',
          timestamp: new Date().toISOString(),
          raw_data: { ...zapiData, resolvedChatLid },
        });
    }

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

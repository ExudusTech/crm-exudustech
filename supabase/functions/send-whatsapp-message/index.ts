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

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'brotherhood';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Evolution API não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone && !normalizedPhone.startsWith('55')) {
      normalizedPhone = `55${normalizedPhone}`;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Before sending, check if number exists on WhatsApp and get LID
    let resolvedChatLid: string | null = null;
    if (leadId) {
      try {
        const { data: lead } = await supabase
          .from('leads')
          .select('id, whatsapp_chat_lids')
          .eq('id', leadId)
          .maybeSingle();

        const existingChatLids: string[] = lead?.whatsapp_chat_lids || [];

        // Check WhatsApp number via Evolution API
        const checkUrl = `${EVOLUTION_API_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`;
        const checkRes = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            numbers: [normalizedPhone]
          }),
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          console.log('Evolution whatsappNumbers response:', JSON.stringify(checkData));
          
          // Evolution returns array of results
          const result = Array.isArray(checkData) ? checkData[0] : checkData;
          if (result?.exists && result?.jid) {
            const jid = result.jid;
            // If it's a LID jid, persist it
            if (jid.includes('@lid')) {
              resolvedChatLid = jid;
              if (!existingChatLids.includes(jid)) {
                await supabase
                  .from('leads')
                  .update({ whatsapp_chat_lids: [...existingChatLids, jid] })
                  .eq('id', leadId);
                console.log('chatLid persistido no lead:', jid);
              }

              // Reconcile orphan messages
              await supabase
                .from('whatsapp_messages')
                .update({ lead_id: leadId })
                .is('lead_id', null)
                .or(`phone.eq.${jid},raw_data->>chatLid.eq.${jid}`);
            }
          }
        } else {
          const errTxt = await checkRes.text().catch(() => '');
          console.error(`Erro Evolution whatsappNumbers: ${checkRes.status} ${errTxt}`);
        }
      } catch (e) {
        console.error('Falha ao resolver chatLid antes de enviar:', e);
      }
    }

    // Send message via Evolution API
    const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;
    
    console.log('Enviando mensagem para:', normalizedPhone);
    
    const evolutionResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    const responseContentType = evolutionResponse.headers.get('content-type') || '';
    const rawResponseText = await evolutionResponse.text();

    let evolutionData: any = null;
    if (responseContentType.includes('application/json')) {
      try {
        evolutionData = rawResponseText ? JSON.parse(rawResponseText) : null;
      } catch (parseError) {
        console.error('Falha ao fazer parse do JSON da Evolution API:', parseError, rawResponseText);
      }
    }

    console.log('Resposta Evolution API status/content-type:', evolutionResponse.status, responseContentType);
    console.log('Resposta Evolution API body:', evolutionData ?? rawResponseText);

    if (!evolutionResponse.ok) {
      const errorPayload = evolutionData ?? rawResponseText?.slice(0, 500) ?? 'sem corpo';
      throw new Error(`Erro Evolution API [${evolutionResponse.status}]: ${typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload)}`);
    }

    if (!evolutionData) {
      evolutionData = {
        success: true,
        raw_response: rawResponseText,
      };
    }

    // Save message to database
    if (leadId) {
      await supabase
        .from('whatsapp_messages')
        .insert({
          lead_id: leadId,
          phone: normalizedPhone,
          message: message,
          direction: 'outbound',
          timestamp: new Date().toISOString(),
          raw_data: { ...evolutionData, resolvedChatLid },
        });
    }

    return new Response(
      JSON.stringify({ success: true, data: evolutionData }),
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

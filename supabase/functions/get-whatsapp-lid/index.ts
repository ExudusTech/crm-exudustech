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
    const { leadId, phone } = await req.json();
    
    if (!leadId) {
      return new Response(
        JSON.stringify({ error: 'leadId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`=== GET-WHATSAPP-LID para lead ${leadId} ===`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'brotherhood';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuração da Evolution API não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone, phones, whatsapp_chat_lids')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: 'Lead não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect phones to check
    const phonesToCheck: string[] = [];
    if (phone) {
      phonesToCheck.push(phone);
    } else {
      if (lead.phones && lead.phones.length > 0) phonesToCheck.push(...lead.phones);
      if (lead.phone && !phonesToCheck.includes(lead.phone)) phonesToCheck.push(lead.phone);
    }

    if (phonesToCheck.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Lead sem telefones', chatLidsAdded: [], messagesReconciled: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verificando ${phonesToCheck.length} telefones:`, phonesToCheck);

    const existingChatLids = lead.whatsapp_chat_lids || [];
    const newChatLids: string[] = [];

    // Normalize all phones and check via Evolution API in batch
    const normalizedNumbers = phonesToCheck.map(p => {
      const digits = p.replace(/\D/g, '');
      return digits.startsWith('55') ? digits : `55${digits}`;
    });

    try {
      const checkUrl = `${EVOLUTION_API_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`;
      const response = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ numbers: normalizedNumbers }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`Erro Evolution API: ${response.status} ${errorBody}`);
      } else {
        const results = await response.json();
        console.log('Evolution whatsappNumbers results:', JSON.stringify(results));

        const items = Array.isArray(results) ? results : [];
        for (const item of items) {
          if (item.exists && item.jid && item.jid.includes('@lid')) {
            const lid = item.jid;
            if (!existingChatLids.includes(lid) && !newChatLids.includes(lid)) {
              newChatLids.push(lid);
              console.log(`Novo chatLid encontrado: ${lid}`);
            }
          }
        }
      }
    } catch (apiError) {
      console.error('Erro ao consultar Evolution API:', apiError);
    }

    // Update lead with new chatLids
    let chatLidsAdded: string[] = [];
    if (newChatLids.length > 0) {
      const updatedChatLids = [...existingChatLids, ...newChatLids];
      const { error: updateError } = await supabase
        .from('leads')
        .update({ whatsapp_chat_lids: updatedChatLids })
        .eq('id', leadId);

      if (!updateError) {
        chatLidsAdded = newChatLids;
        console.log(`Lead atualizado com novos chatLids: ${newChatLids.join(', ')}`);
      }
    }

    // Reconcile orphan messages
    const allChatLids = [...existingChatLids, ...newChatLids];
    let messagesReconciled = 0;

    if (allChatLids.length > 0) {
      const lidPatterns = allChatLids.map(lid => {
        const cleanLid = lid.replace('@lid', '');
        return [`phone.eq.${lid}`, `phone.eq.${cleanLid}@lid`, `phone.ilike.%${cleanLid}%`];
      }).flat();

      const { data: orphanMessages } = await supabase
        .from('whatsapp_messages')
        .select('id, phone')
        .is('lead_id', null)
        .or(lidPatterns.join(','));

      if (orphanMessages && orphanMessages.length > 0) {
        const { error: reconError } = await supabase
          .from('whatsapp_messages')
          .update({ lead_id: leadId })
          .in('id', orphanMessages.map(m => m.id));

        if (!reconError) {
          messagesReconciled = orphanMessages.length;
        }
      }
    }

    // Also reconcile by phone number
    const phonePatterns: string[] = [];
    for (const rawPhone of phonesToCheck) {
      const digits = rawPhone.replace(/\D/g, '');
      const suffix8 = digits.slice(-8);
      if (suffix8.length >= 8) {
        phonePatterns.push(`phone.ilike.%${suffix8}%`);
      }
    }

    if (phonePatterns.length > 0) {
      const { data: phoneOrphans } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .is('lead_id', null)
        .or(phonePatterns.join(','));

      if (phoneOrphans && phoneOrphans.length > 0) {
        const { error: updateErr } = await supabase
          .from('whatsapp_messages')
          .update({ lead_id: leadId })
          .in('id', phoneOrphans.map(m => m.id));

        if (!updateErr) {
          messagesReconciled += phoneOrphans.length;
        }
      }
    }

    console.log(`=== RESULTADO: ${chatLidsAdded.length} chatLids, ${messagesReconciled} mensagens reconciliadas ===`);

    return new Response(
      JSON.stringify({
        success: true,
        chatLidsAdded,
        messagesReconciled,
        leadName: lead.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro no get-whatsapp-lid:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

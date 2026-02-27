import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    console.log("Evolution API webhook received");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Evolution payload:", JSON.stringify(payload, null, 2));

    // Evolution API sends events with "event" field
    const event = payload.event;
    
    // Only process message events
    if (event !== 'messages.upsert' && event !== 'send.message') {
      console.log('Evento ignorado:', event);
      return new Response(
        JSON.stringify({ success: true, message: `Evento ${event} ignorado` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 1: Extract data from Evolution API payload =====
    const data = payload.data;
    if (!data) {
      console.log('Payload sem campo data');
      return new Response(
        JSON.stringify({ success: true, message: 'Payload sem data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Evolution API message structure
    const key = data.key || {};
    const remoteJid = key.remoteJid || '';
    const fromMe = key.fromMe || false;
    const messageId = key.id || null;

    // Extract phone from remoteJid (format: 5511999998888@s.whatsapp.net or lid@lid)
    const rawPhone = remoteJid.replace(/@.*$/, '');
    const isLidEvent = remoteJid.includes('@lid');
    const chatLid = isLidEvent ? remoteJid : null;

    console.log('=== IDENTIFICADORES ===');
    console.log('remoteJid:', remoteJid);
    console.log('rawPhone:', rawPhone);
    console.log('chatLid:', chatLid);
    console.log('isLidEvent:', isLidEvent);
    console.log('fromMe:', fromMe);

    // Extract message content from Evolution API structure
    const messageData = data.message || {};
    let message = messageData.conversation 
      || messageData.extendedTextMessage?.text 
      || messageData.imageMessage?.caption
      || messageData.videoMessage?.caption
      || messageData.documentMessage?.caption
      || '';

    const direction = fromMe ? 'outbound' : 'inbound';
    
    // Timestamp - Evolution uses messageTimestamp (unix seconds)
    const rawTs = data.messageTimestamp ?? null;
    const tsMs = typeof rawTs === 'number' ? (rawTs > 1e12 ? rawTs : rawTs * 1000) : Date.now();
    const timestamp = new Date(tsMs);

    // Contact name (pushName) - only for inbound
    const rawContactName = data.pushName || null;
    const contactName = (direction === 'inbound' && rawContactName) ? rawContactName : null;
    if (contactName) {
      console.log('Nome do contato (inbound):', contactName);
    }

    // Audio detection
    let isAudio = false;
    const audioMessage = messageData.audioMessage;
    
    if (audioMessage && !message) {
      console.log('Áudio detectado');
      isAudio = true;

      // Evolution API stores media as base64 or URL depending on config
      // Try to get audio URL from messageData or use base64
      const audioUrl = data.media?.url || null;
      
      if (audioUrl) {
        try {
          const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audioUrl })
          });
          
          if (transcribeResponse.ok) {
            const { text } = await transcribeResponse.json();
            message = text || '[Áudio não transcrito]';
            console.log('Áudio transcrito:', message);
          } else {
            console.error('Erro ao transcrever áudio');
            message = '[Mensagem de áudio - erro na transcrição]';
          }
        } catch (error) {
          console.error('Erro ao processar áudio:', error);
          message = '[Mensagem de áudio - erro ao processar]';
        }
      } else {
        message = '[Mensagem de áudio]';
      }
    }

    // ===== STEP 2: Phone normalization (only non-LID) =====
    let normalizedPhone: string | null = null;
    let localPhone: string | null = null;
    let suffix11: string | null = null;
    let suffix10: string | null = null;
    let suffix8: string | null = null;

    if (!isLidEvent && rawPhone) {
      const onlyDigits = rawPhone.replace(/\D/g, '');
      
      const isInternational = onlyDigits.startsWith('351') || 
                             onlyDigits.startsWith('1') || 
                             onlyDigits.startsWith('44') ||
                             onlyDigits.startsWith('33') ||
                             onlyDigits.startsWith('34') ||
                             onlyDigits.startsWith('39') ||
                             onlyDigits.startsWith('49') ||
                             (onlyDigits.length > 10 && !onlyDigits.startsWith('55'));
      
      if (isInternational) {
        normalizedPhone = onlyDigits;
        localPhone = onlyDigits;
      } else {
        localPhone = onlyDigits.startsWith('55') ? onlyDigits.slice(2) : onlyDigits;
        normalizedPhone = '55' + localPhone;
      }
      
      suffix11 = localPhone && localPhone.length >= 11 ? localPhone.slice(-11) : null;
      suffix10 = localPhone && localPhone.length >= 10 ? localPhone.slice(-10) : null;
      suffix8 = localPhone && localPhone.length >= 8 ? localPhone.slice(-8) : null;
      
      console.log('Telefone normalizado:', normalizedPhone, 'local:', localPhone, 'suffix8:', suffix8);
    } else if (isLidEvent) {
      console.log('Evento @lid detectado - NÃO será tratado como telefone');
    }

    // ===== STEP 3: Check duplicate =====
    if (messageId) {
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('raw_data->>messageId', messageId)
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        console.log('Mensagem duplicada detectada (messageId):', messageId);
        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem duplicada ignorada', messageId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let leadId: string | null = null;
    let chosenLead: any = null;
    let duplicateLeadsCount = 0;
    let resolveMethod: string = 'none';

    // ===== STEP 4: Try to resolve lead by chatLid first =====
    if (chatLid) {
      console.log('=== RESOLUÇÃO POR CHAT_LID ===');
      
      const { data: leadsWithChatLid, error: chatLidError } = await supabase
        .from('leads')
        .select('id, phones, emails, email, phone, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
        .contains('whatsapp_chat_lids', [chatLid]);
      
      if (chatLidError) {
        console.error('Erro ao buscar leads por chatLid:', chatLidError);
      }
      
      if (leadsWithChatLid && leadsWithChatLid.length > 0) {
        console.log(`Encontrados ${leadsWithChatLid.length} leads com este chatLid`);
        duplicateLeadsCount = leadsWithChatLid.length;
        
        const activeLead = leadsWithChatLid.find((l: any) => 
          l.archived === false && 
          l.unclassified === false && 
          (l.status === 'em_aberto' || l.status === 'em_negociacao')
        );
        
        if (activeLead) {
          leadId = activeLead.id;
          chosenLead = activeLead;
          resolveMethod = 'chatLid_field_active';
          console.log('Lead ativo encontrado por whatsapp_chat_lids:', leadId);
        } else {
          const wonLead = leadsWithChatLid.find((l: any) => l.status === 'ganho' && l.archived === false);
          if (wonLead) {
            leadId = wonLead.id;
            chosenLead = wonLead;
            resolveMethod = 'chatLid_field_ganho';
          }
        }
      }
      
      // If not found by field, search in whatsapp_messages history
      if (!leadId) {
        console.log('Buscando leads por histórico de mensagens com chatLid...');
        
        const { data: messagesWithChatLid } = await supabase
          .from('whatsapp_messages')
          .select('lead_id')
          .eq('raw_data->>chatLid', chatLid)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (messagesWithChatLid && messagesWithChatLid.length > 0) {
          const uniqueLeadIds = [...new Set(messagesWithChatLid.map(m => m.lead_id).filter(Boolean))];
          
          if (uniqueLeadIds.length > 0) {
            const { data: candidateLeads } = await supabase
              .from('leads')
              .select('id, phones, emails, email, phone, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
              .in('id', uniqueLeadIds);
            
            if (candidateLeads && candidateLeads.length > 0) {
              duplicateLeadsCount = Math.max(duplicateLeadsCount, candidateLeads.length);
              
              const activeLead = candidateLeads.find((l: any) => 
                l.archived === false && 
                l.unclassified === false && 
                (l.status === 'em_aberto' || l.status === 'em_negociacao')
              );
              
              if (activeLead) {
                leadId = activeLead.id;
                chosenLead = activeLead;
                resolveMethod = 'chatLid_history_active';
              } else {
                const wonLead = candidateLeads.find((l: any) => l.status === 'ganho' && l.archived === false);
                if (wonLead) {
                  leadId = wonLead.id;
                  chosenLead = wonLead;
                  resolveMethod = 'chatLid_history_ganho';
                } else {
                  const deliveredLead = candidateLeads.find((l: any) => l.status === 'entregue');
                  if (deliveredLead) {
                    resolveMethod = 'chatLid_history_recurring';
                    
                    const { data: newLead, error: newLeadError } = await supabase
                      .from('leads')
                      .insert({
                        name: deliveredLead.name || 'Lead WhatsApp',
                        email: deliveredLead.email,
                        emails: deliveredLead.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                        phones: deliveredLead.phones || [],
                        message: message || '',
                        source: 'evolution',
                        is_recurring: true,
                        whatsapp_chat_lids: [chatLid]
                      })
                      .select()
                      .single();
                    
                    if (!newLeadError && newLead) {
                      leadId = newLead.id;
                      chosenLead = newLead;
                    }
                  } else {
                    const validLead = candidateLeads.find((l: any) => 
                      !l.unclassified || (l.phones && l.phones.length > 0 && !l.phones[0]?.includes('@'))
                    );
                    if (validLead) {
                      leadId = validLead.id;
                      chosenLead = validLead;
                      resolveMethod = 'chatLid_history_any';
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ===== STEP 5: Try phone resolution (non-LID only) =====
    if (!leadId && normalizedPhone && localPhone) {
      console.log('=== RESOLUÇÃO POR TELEFONE ===');
      
      const orConditions: string[] = [
        ...[normalizedPhone, localPhone].map(v => `phones.cs.{${v}}`),
        `phone.ilike.*${localPhone}*`,
      ];
      if (suffix11) orConditions.push(`phone.ilike.*${suffix11}*`);
      if (suffix10) orConditions.push(`phone.ilike.*${suffix10}*`);
      if (suffix8) orConditions.push(`phone.ilike.*${suffix8}*`);
      orConditions.push(`phone.eq.${normalizedPhone}`);
      orConditions.push(`phone.eq.${localPhone}`);

      const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select('id, phones, emails, email, phone, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
        .or(orConditions.join(','));

      if (leadError) {
        console.error('Erro ao buscar lead por telefone:', leadError);
      }

      if (leads && leads.length > 0) {
        duplicateLeadsCount = Math.max(duplicateLeadsCount, leads.length);
        
        const activeLead = leads.find((l: any) => 
          l.archived === false && 
          l.unclassified === false && 
          (l.status === 'em_aberto' || l.status === 'em_negociacao')
        );
        
        if (activeLead) {
          leadId = activeLead.id;
          chosenLead = activeLead;
          resolveMethod = 'phone_active';
        } else {
          const wonLead = leads.find((l: any) => l.status === 'ganho' && l.archived === false);
          
          if (wonLead) {
            leadId = wonLead.id;
            chosenLead = wonLead;
            resolveMethod = 'phone_ganho';
          } else {
            const deliveredLead = leads.find((l: any) => l.status === 'entregue');
            
            if (deliveredLead) {
              resolveMethod = 'phone_recurring';
              
              const { data: newLead, error: newLeadError } = await supabase
                .from('leads')
                .insert({
                  name: deliveredLead.name || 'Lead WhatsApp',
                  email: deliveredLead.email || `${normalizedPhone}@whatsapp.temp`,
                  emails: deliveredLead.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                  phones: [normalizedPhone],
                  message: message || '',
                  source: 'evolution',
                  is_recurring: true,
                  whatsapp_chat_lids: chatLid ? [chatLid] : []
                })
                .select()
                .single();
              
              if (!newLeadError && newLead) {
                leadId = newLead.id;
                chosenLead = newLead;
              }
            } else {
              // Score-based matching
              const normalize = (v: any) => (v ?? '').toString().replace(/\D/g, '');
              type Scored = { lead: any; score: number };
              const scored: Scored[] = leads.map((l: any) => {
                const candidatePhones = [l.phone, ...(l.phones || [])]
                  .map(normalize)
                  .filter(Boolean);
                let score = 0;
                if (candidatePhones.includes(normalizedPhone!) || candidatePhones.includes(localPhone!)) {
                  score = 3;
                } else if (candidatePhones.some((p: string) => p.endsWith(localPhone!))) {
                  score = 2;
                } else if (normalize(l.phone || '').endsWith(localPhone!)) {
                  score = 1;
                }
                if (!l.archived && !l.unclassified) score += 10;
                else if (!l.archived) score += 5;
                return { lead: l, score };
              });

              const maxScore = Math.max(...scored.map(s => s.score));
              const top = scored.filter(s => s.score === maxScore).map(s => s.lead);
              chosenLead = top.find((l: any) => l.emails && l.emails.some((e: string) => !e.endsWith('@whatsapp.temp'))) || top[0];
              leadId = chosenLead?.id || null;
              resolveMethod = 'phone_scored';
            }
          }
        }
      }
      
      // Fallback: search all leads with phones
      if (!leadId) {
        console.log('Fallback: buscando em todos os leads com phones...');
        
        const { data: leadsWithPhones } = await supabase
          .from('leads')
          .select('id, phones, phone, emails, email, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
          .not('phones', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1000);

        if (leadsWithPhones && leadsWithPhones.length > 0) {
          const onlyDigitsFn = (v: any) => (v ?? '').toString().replace(/\D/g, '');
          
          // Active leads first
          for (const l of leadsWithPhones) {
            const list = [l.phone, ...(l.phones || [])].map(onlyDigitsFn).filter(Boolean);
            const hasMatch = list.includes(normalizedPhone!) || 
                            list.includes(localPhone!) || 
                            list.some((p: string) => 
                              p.endsWith(localPhone!) || 
                              (suffix11 && p.endsWith(suffix11)) || 
                              (suffix10 && p.endsWith(suffix10))
                            );
            
            if (hasMatch && l.archived === false && l.unclassified === false && 
                (l.status === 'em_aberto' || l.status === 'em_negociacao')) {
              leadId = l.id;
              chosenLead = l;
              resolveMethod = 'phone_fallback_active';
              break;
            }
          }
          
          if (!leadId) {
            for (const l of leadsWithPhones) {
              const list = [l.phone, ...(l.phones || [])].map(onlyDigitsFn).filter(Boolean);
              const hasMatch = list.includes(normalizedPhone!) || 
                              list.includes(localPhone!) || 
                              list.some((p: string) => 
                                p.endsWith(localPhone!) || 
                                (suffix11 && p.endsWith(suffix11)) || 
                                (suffix10 && p.endsWith(suffix10))
                              );
              
              if (hasMatch && l.status === 'ganho' && l.archived === false) {
                leadId = l.id;
                chosenLead = l;
                resolveMethod = 'phone_fallback_ganho';
                break;
              }
            }
          }
          
          if (!leadId) {
            for (const l of leadsWithPhones) {
              const list = [l.phone, ...(l.phones || [])].map(onlyDigitsFn).filter(Boolean);
              const hasMatch = list.includes(normalizedPhone!) || 
                              list.includes(localPhone!) || 
                              list.some((p: string) => 
                                p.endsWith(localPhone!) || 
                                (suffix11 && p.endsWith(suffix11)) || 
                                (suffix10 && p.endsWith(suffix10))
                              );
              
              if (hasMatch && l.status === 'entregue') {
                resolveMethod = 'phone_fallback_recurring';
                const { data: newLead, error: newLeadError } = await supabase
                  .from('leads')
                  .insert({
                    name: l.name || 'Lead WhatsApp',
                    email: l.email || `${normalizedPhone}@whatsapp.temp`,
                    emails: l.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                    phones: [normalizedPhone],
                    message: message || '',
                    source: 'evolution',
                    is_recurring: true,
                    whatsapp_chat_lids: chatLid ? [chatLid] : []
                  })
                  .select()
                  .single();
                if (!newLeadError && newLead) {
                  leadId = newLead.id;
                  chosenLead = newLead;
                }
                break;
              }
            }
          }
          
          if (!leadId) {
            for (const l of leadsWithPhones) {
              const list = [l.phone, ...(l.phones || [])].map(onlyDigitsFn).filter(Boolean);
              const hasMatch = list.includes(normalizedPhone!) || 
                              list.includes(localPhone!) || 
                              list.some((p: string) => 
                                p.endsWith(localPhone!) || 
                                (suffix11 && p.endsWith(suffix11)) || 
                                (suffix10 && p.endsWith(suffix10))
                              );
              
              if (hasMatch) {
                chosenLead = l;
                leadId = l.id;
                resolveMethod = 'phone_fallback_any';
                break;
              }
            }
          }
        }
      }
    }

    // ===== STEP 6: LID event without lead - save orphan =====
    if (!leadId && isLidEvent) {
      console.log('⚠️ Evento @lid sem lead associável');
      
      const { error: insertError } = await supabase
        .from('whatsapp_messages')
        .insert({
          lead_id: null,
          phone: rawPhone,
          message,
          direction,
          timestamp,
          is_audio: isAudio,
          raw_data: { ...payload, messageId, chatLid }
        });

      if (insertError) {
        console.error('Erro ao inserir mensagem órfã:', insertError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mensagem salva sem associação (evento @lid)', 
          leadId: null,
          chatLid,
          direction,
          resolveMethod: 'lid_orphan'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 7: Create new lead for real phone events =====
    if (!leadId && normalizedPhone) {
      console.log('Lead não encontrado, criando novo unclassified');
      resolveMethod = 'create_new';
      
      const tempEmail = `${normalizedPhone}@whatsapp.temp`;
      const { data: newLead, error: newLeadError } = await supabase
        .from('leads')
        .insert({
          name: contactName || 'Lead WhatsApp',
          email: tempEmail,
          emails: [tempEmail],
          phones: [normalizedPhone],
          message: message || '',
          source: 'evolution',
          unclassified: true,
          whatsapp_chat_lids: chatLid ? [chatLid] : []
        })
        .select()
        .single();

      if (newLeadError) {
        console.error('Erro ao criar lead:', newLeadError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      leadId = newLead.id;
      chosenLead = newLead;
    }

    if (!leadId) {
      console.error('Não foi possível resolver ou criar lead');
      return new Response(
        JSON.stringify({ error: 'Não foi possível processar a mensagem' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 8: Persist chatLid =====
    if (chatLid && leadId) {
      try {
        let chatLidsToUse: string[] = chosenLead?.whatsapp_chat_lids || [];
        if (!chosenLead) {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('whatsapp_chat_lids')
            .eq('id', leadId)
            .maybeSingle();
          chatLidsToUse = leadRow?.whatsapp_chat_lids || [];
        }

        if (!chatLidsToUse.includes(chatLid)) {
          await supabase
            .from('leads')
            .update({ whatsapp_chat_lids: [...chatLidsToUse, chatLid] })
            .eq('id', leadId);
          console.log('chatLid adicionado ao lead:', chatLid);
        }
      } catch (e) {
        console.error('Erro ao persistir chatLid:', e);
      }
    }

    // ===== STEP 8.5: Update lead name if default =====
    if (contactName && leadId && chosenLead?.name === 'Lead WhatsApp') {
      const { error: nameError } = await supabase
        .from('leads')
        .update({ name: contactName })
        .eq('id', leadId);
      
      if (!nameError && chosenLead) chosenLead.name = contactName;
    }

    // ===== STEP 9: Insert message =====
    let phoneToStore = normalizedPhone || rawPhone;
    
    if (isLidEvent && chosenLead?.phones && chosenLead.phones.length > 0) {
      const realPhone = chosenLead.phones[0];
      if (realPhone && !realPhone.includes('@') && realPhone.length >= 10) {
        phoneToStore = realPhone;
      }
    }
    
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        lead_id: leadId,
        phone: phoneToStore,
        message,
        direction,
        timestamp,
        is_audio: isAudio,
        raw_data: { ...payload, messageId, chatLid }
      });

    if (insertError) {
      console.error('Erro ao inserir mensagem:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao inserir mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== RESULTADO ===');
    console.log('leadId:', leadId, 'direction:', direction, 'resolveMethod:', resolveMethod);

    // ===== STEP 10: Duplicate warning =====
    if (duplicateLeadsCount > 1) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingNotes } = await supabase
        .from('lead_notes')
        .select('id')
        .eq('lead_id', leadId)
        .ilike('content', '%[Sistema] Atenção: duplicidade detectada%')
        .gte('created_at', oneDayAgo)
        .limit(1);
      
      if (!existingNotes || existingNotes.length === 0) {
        await supabase
          .from('lead_notes')
          .insert({
            lead_id: leadId,
            content: `[Sistema] Atenção: duplicidade detectada - há ${duplicateLeadsCount} leads com o mesmo número de telefone ou conversa WhatsApp.`
          });
      }
    }

    // ===== STEP 11: Extract emails from message =====
    if (message && leadId && chosenLead) {
      const extractEmails = (text: string): string[] => {
        if (!text) return [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        return [...new Set((text.match(emailRegex) || []).map(e => e.toLowerCase()))];
      };

      const validEmails = extractEmails(message).filter(email => {
        const lower = email.toLowerCase();
        return !lower.includes('miguel') && !lower.includes('brotherhood') && !lower.endsWith('@whatsapp.temp');
      });

      if (validEmails.length > 0) {
        const currentEmails: string[] = chosenLead.emails || [];
        const newEmails = validEmails.filter(email =>
          !currentEmails.some((existing: string) => existing.toLowerCase() === email.toLowerCase())
        );

        if (newEmails.length > 0) {
          await supabase
            .from('leads')
            .update({ emails: [...currentEmails, ...newEmails] })
            .eq('id', leadId);
        }
      }
    }

    // ===== STEP 12: Fetch profile picture =====
    if (direction === 'inbound' && chosenLead && !chosenLead.profile_picture_url) {
      try {
        fetch(`${supabaseUrl}/functions/v1/fetch-profile-picture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: phoneToStore, leadId })
        }).catch(err => console.error('Erro ao buscar foto de perfil:', err));
      } catch (e) {
        console.error('Erro ao iniciar busca de foto:', e);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem processada com sucesso', 
        leadId,
        leadName: chosenLead?.name,
        direction,
        resolveMethod,
        chatLid: chatLid || null,
        duplicateLeadsCount: duplicateLeadsCount > 1 ? duplicateLeadsCount : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no Evolution webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

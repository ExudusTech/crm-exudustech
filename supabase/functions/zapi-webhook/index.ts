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
    console.log("Z-API webhook received");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Z-API payload:", JSON.stringify(payload, null, 2));

    // ===== STEP 1: Extract identifiers =====
    const rawPhone = payload.phone || payload.from || payload.remoteJid || '';
    const chatLid = payload.chatLid || (rawPhone.includes('@lid') ? rawPhone : null);
    
    // CRITICAL: Only consider it a LID event if the PHONE itself is @lid
    // chatLid almost always contains @lid, but we should still resolve by phone when available
    const isLidEvent = rawPhone.includes('@lid');
    
    console.log('=== IDENTIFICADORES ===');
    console.log('rawPhone:', rawPhone);
    console.log('chatLid:', chatLid);
    console.log('isLidEvent:', isLidEvent, '(só true quando rawPhone contém @lid)');

    let message = payload.text?.message 
      || payload.message 
      || payload.body 
      || payload.content
      || payload.text
      || '';
    
    const rawTs = payload.timestamp ?? payload.momment ?? null;
    const tsMs = typeof rawTs === 'number' ? (rawTs > 1e12 ? rawTs : rawTs * 1000) : Date.now();
    const timestamp = new Date(tsMs);
    const direction = payload.fromMe ? 'outbound' : 'inbound';
    
    // Extract contact name from Z-API payload - ONLY use for inbound messages (the client's name)
    const rawContactName = payload.senderName || payload.contactName || payload.name || payload.pushName || payload.notifyName || null;
    const contactName = (direction === 'inbound' && rawContactName) ? rawContactName : null;
    if (contactName) {
      console.log('Nome do contato (inbound) recebido:', contactName);
    }
    
    let isAudio = false;
    const audioUrl = payload.audio?.audioUrl || payload.audioUrl;
    
    if (audioUrl && !message) {
      console.log('Áudio detectado, URL:', audioUrl);
      isAudio = true;
      
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
    }

    // ===== STEP 2: Handle phone normalization (only if NOT a LID event) =====
    let normalizedPhone: string | null = null;
    let localPhone: string | null = null;
    let suffix11: string | null = null;
    let suffix10: string | null = null;
    let suffix8: string | null = null; // Last 8 digits for flexible matching

    if (!isLidEvent && rawPhone) {
      const onlyDigits = rawPhone.toString().replace(/@.*$/, '').replace(/\D/g, '');
      
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

    // ===== STEP 3: Check for duplicate message =====
    const messageId = payload.messageId ?? null;
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
      
      // First check if any lead has this chatLid in whatsapp_chat_lids array
      const { data: leadsWithChatLid, error: chatLidError } = await supabase
        .from('leads')
        .select('id, phones, emails, email, phone, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
        .contains('whatsapp_chat_lids', [chatLid]);
      
      if (chatLidError) {
        console.error('Erro ao buscar leads por chatLid:', chatLidError);
      }
      
      if (leadsWithChatLid && leadsWithChatLid.length > 0) {
        console.log(`Encontrados ${leadsWithChatLid.length} leads com este chatLid no campo whatsapp_chat_lids`);
        duplicateLeadsCount = leadsWithChatLid.length;
        
        // Prioritize by status
        const activeLead = leadsWithChatLid.find((l: any) => 
          l.archived === false && 
          l.unclassified === false && 
          (l.status === 'em_aberto' || l.status === 'em_negociacao')
        );
        
        if (activeLead) {
          leadId = activeLead.id;
          chosenLead = activeLead;
          resolveMethod = 'chatLid_field_active';
          console.log('Lead ativo encontrado por whatsapp_chat_lids:', leadId, 'name:', activeLead.name);
        } else {
          const wonLead = leadsWithChatLid.find((l: any) => l.status === 'ganho' && l.archived === false);
          if (wonLead) {
            leadId = wonLead.id;
            chosenLead = wonLead;
            resolveMethod = 'chatLid_field_ganho';
            console.log('Lead ganho encontrado por whatsapp_chat_lids:', leadId, 'name:', wonLead.name);
          }
        }
      }
      
      // If not found by field, search in whatsapp_messages history
      if (!leadId) {
        console.log('Buscando leads por histórico de mensagens com chatLid...');
        
        const { data: messagesWithChatLid, error: msgError } = await supabase
          .from('whatsapp_messages')
          .select('lead_id')
          .eq('raw_data->>chatLid', chatLid)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (msgError) {
          console.error('Erro ao buscar mensagens por chatLid:', msgError);
        }
        
        if (messagesWithChatLid && messagesWithChatLid.length > 0) {
          const uniqueLeadIds = [...new Set(messagesWithChatLid.map(m => m.lead_id).filter(Boolean))];
          console.log('Lead IDs encontrados via histórico de mensagens:', uniqueLeadIds);
          
          if (uniqueLeadIds.length > 0) {
            const { data: candidateLeads, error: candidateError } = await supabase
              .from('leads')
              .select('id, phones, emails, email, phone, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
              .in('id', uniqueLeadIds);
            
            if (candidateError) {
              console.error('Erro ao buscar leads candidatos:', candidateError);
            }
            
            if (candidateLeads && candidateLeads.length > 0) {
              duplicateLeadsCount = Math.max(duplicateLeadsCount, candidateLeads.length);
              
              // Prioritize active leads (em_aberto/em_negociacao)
              const activeLead = candidateLeads.find((l: any) => 
                l.archived === false && 
                l.unclassified === false && 
                (l.status === 'em_aberto' || l.status === 'em_negociacao')
              );
              
              if (activeLead) {
                leadId = activeLead.id;
                chosenLead = activeLead;
                resolveMethod = 'chatLid_history_active';
                console.log('Lead ativo encontrado por histórico chatLid:', leadId, 'name:', activeLead.name);
              } else {
                // Try ganho
                const wonLead = candidateLeads.find((l: any) => l.status === 'ganho' && l.archived === false);
                if (wonLead) {
                  leadId = wonLead.id;
                  chosenLead = wonLead;
                  resolveMethod = 'chatLid_history_ganho';
                  console.log('Lead ganho encontrado por histórico chatLid:', leadId, 'name:', wonLead.name);
                } else {
                  // Check for entregue - create new recurring
                  const deliveredLead = candidateLeads.find((l: any) => l.status === 'entregue');
                  if (deliveredLead) {
                    console.log('Lead entregue encontrado por chatLid, criando nova oportunidade recorrente');
                    resolveMethod = 'chatLid_history_recurring';
                    
                    const newLeadData = {
                      name: deliveredLead.name || 'Lead WhatsApp',
                      email: deliveredLead.email,
                      emails: deliveredLead.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                      phones: deliveredLead.phones || [],
                      message: message || '',
                      source: 'zapi',
                      is_recurring: true,
                      whatsapp_chat_lids: [chatLid]
                    };
                    
                    const { data: newLead, error: newLeadError } = await supabase
                      .from('leads')
                      .insert(newLeadData)
                      .select()
                      .single();
                    
                    if (!newLeadError && newLead) {
                      leadId = newLead.id;
                      chosenLead = newLead;
                      console.log('Nova oportunidade recorrente criada via chatLid:', leadId);
                    }
                  } else {
                    // Use any non-unclassified lead, avoid phantom leads
                    const validLead = candidateLeads.find((l: any) => 
                      !l.unclassified || (l.phones && l.phones.length > 0 && !l.phones[0]?.includes('@'))
                    );
                    if (validLead) {
                      leadId = validLead.id;
                      chosenLead = validLead;
                      resolveMethod = 'chatLid_history_any';
                      console.log('Lead encontrado por histórico chatLid:', leadId, 'name:', validLead.name);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ===== STEP 5: If not resolved by chatLid, try phone (only for non-LID events) =====
    if (!leadId && normalizedPhone && localPhone) {
      console.log('=== RESOLUÇÃO POR TELEFONE ===');
      
      // Build flexible matching conditions
      // suffix8 helps match phones with/without the 9 digit after DDD
      const orConditions: string[] = [
        ...[normalizedPhone, localPhone].map(v => `phones.cs.{${v}}`),
        `phone.ilike.*${localPhone}*`,
      ];
      if (suffix11) {
        orConditions.push(`phone.ilike.*${suffix11}*`);
      }
      if (suffix10) {
        orConditions.push(`phone.ilike.*${suffix10}*`);
      }
      // suffix8 is the most flexible - matches even with different DDD or 9 variations
      if (suffix8) {
        orConditions.push(`phone.ilike.*${suffix8}*`);
      }
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
        console.log(`Encontrados ${leads.length} leads com este número`);
        
        if (leads.length > 1) {
          console.log('⚠️ LEADS DUPLICADOS DETECTADOS:', leads.map(l => ({ id: l.id, name: l.name, status: l.status, archived: l.archived })));
        }
        
        // Priority: em_aberto/em_negociacao > ganho > entregue (create new) > others
        const activeLead = leads.find((l: any) => 
          l.archived === false && 
          l.unclassified === false && 
          (l.status === 'em_aberto' || l.status === 'em_negociacao')
        );
        
        if (activeLead) {
          leadId = activeLead.id;
          chosenLead = activeLead;
          resolveMethod = 'phone_active';
          console.log('Lead ativo encontrado por telefone:', leadId, 'name:', activeLead.name);
        } else {
          const wonLead = leads.find((l: any) => l.status === 'ganho' && l.archived === false);
          
          if (wonLead) {
            leadId = wonLead.id;
            chosenLead = wonLead;
            resolveMethod = 'phone_ganho';
            console.log('Lead ganho encontrado por telefone:', leadId, 'name:', wonLead.name);
          } else {
            const deliveredLead = leads.find((l: any) => l.status === 'entregue');
            
            if (deliveredLead) {
              console.log('Cliente com negócio entregue encontrado, criando nova oportunidade recorrente');
              resolveMethod = 'phone_recurring';
              
              const newLeadData = {
                name: deliveredLead.name || 'Lead WhatsApp',
                email: deliveredLead.email || `${normalizedPhone}@whatsapp.temp`,
                emails: deliveredLead.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                phones: [normalizedPhone],
                message: message || '',
                source: 'zapi',
                is_recurring: true,
                whatsapp_chat_lids: chatLid ? [chatLid] : []
              };
              
              const { data: newLead, error: newLeadError } = await supabase
                .from('leads')
                .insert(newLeadData)
                .select()
                .single();
              
              if (newLeadError) {
                console.error('Erro ao criar novo lead recorrente:', newLeadError);
              } else if (newLead) {
                leadId = newLead.id;
                chosenLead = newLead;
                console.log('Nova oportunidade recorrente criada:', leadId);
              }
            } else {
              // Use best match from remaining leads
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

              chosenLead = top.find((l: any) => l.emails && l.emails.some((e: string) => !e.endsWith('@whatsapp.temp')))
                || top[0];
              leadId = chosenLead?.id || null;
              resolveMethod = 'phone_scored';
              console.log('Lead encontrado por score:', leadId, 'name:', chosenLead?.name);
            }
          }
        }
      }
      
      // Fallback: search through all leads with phones array
      if (!leadId) {
        console.log('Fallback: buscando em todos os leads com phones...');
        
        const { data: leadsWithPhones, error: leadsWithPhonesError } = await supabase
          .from('leads')
          .select('id, phones, phone, emails, email, status, delivered_at, archived, unclassified, name, whatsapp_chat_lids')
          .not('phones', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1000);

        if (leadsWithPhonesError) {
          console.error('Erro no fallback de busca por phones:', leadsWithPhonesError);
        }

        if (leadsWithPhones && leadsWithPhones.length > 0) {
          const onlyDigitsFn = (v: any) => (v ?? '').toString().replace(/\D/g, '');
          
          // First pass: find active leads
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
              console.log('Lead ativo encontrado no fallback:', leadId, 'name:', l.name);
              break;
            }
          }
          
          // Second pass: find ganho
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
                console.log('Lead ganho encontrado no fallback:', leadId, 'name:', l.name);
                break;
              }
            }
          }
          
          // Third pass: entregue -> create new recurring
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
                console.log('Lead entregue encontrado no fallback, criando nova oportunidade recorrente');
                resolveMethod = 'phone_fallback_recurring';
                
                const newLeadData = {
                  name: l.name || 'Lead WhatsApp',
                  email: l.email || `${normalizedPhone}@whatsapp.temp`,
                  emails: l.emails?.filter((e: string) => !e.endsWith('@whatsapp.temp')) || [],
                  phones: [normalizedPhone],
                  message: message || '',
                  source: 'zapi',
                  is_recurring: true,
                  whatsapp_chat_lids: chatLid ? [chatLid] : []
                };
                
                const { data: newLead, error: newLeadError } = await supabase
                  .from('leads')
                  .insert(newLeadData)
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
          
          // Fourth pass: any matching
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
                console.log('Lead encontrado no fallback:', leadId, 'name:', l.name);
                break;
              }
            }
          }
        }
      }
    }

    // ===== STEP 6: If still not resolved and it's a LID event, do NOT create phantom lead =====
    if (!leadId && isLidEvent) {
      console.log('⚠️ Evento @lid sem lead associável - NÃO criando lead fantasma');
      console.log('chatLid:', chatLid);
      console.log('Esta mensagem não será associada a nenhum lead.');
      
      // Still save the message but without lead association for future reconciliation
      const { error: insertError } = await supabase
        .from('whatsapp_messages')
        .insert({
          lead_id: null,
          phone: rawPhone,
          message,
          direction,
          timestamp,
          is_audio: isAudio,
          raw_data: payload
        });

      if (insertError) {
        console.error('Erro ao inserir mensagem órfã:', insertError);
      } else {
        console.log('Mensagem órfã salva para reconciliação futura');
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mensagem salva sem associação (evento @lid sem lead encontrado)', 
          leadId: null,
          chatLid,
          direction,
          resolveMethod: 'lid_orphan'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 7: Create new lead only for real phone events =====
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
          source: 'zapi',
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
      console.log('Novo lead unclassified criado:', leadId);
    }

    // Final check - if we still don't have a lead, return error
    if (!leadId) {
      console.error('Não foi possível resolver ou criar lead');
      return new Response(
        JSON.stringify({ error: 'Não foi possível processar a mensagem' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STEP 8: Persist chatLid in lead if not already there =====
    if (chatLid && leadId) {
      try {
        const currentChatLids: string[] = chosenLead?.whatsapp_chat_lids || [];

        // Se por algum motivo não carregamos chosenLead (ou veio incompleto), buscamos do banco.
        let chatLidsToUse = currentChatLids;
        if (!chosenLead) {
          const { data: leadRow, error: leadRowErr } = await supabase
            .from('leads')
            .select('whatsapp_chat_lids')
            .eq('id', leadId)
            .maybeSingle();
          if (leadRowErr) throw leadRowErr;
          chatLidsToUse = leadRow?.whatsapp_chat_lids || [];
        }

        if (!chatLidsToUse.includes(chatLid)) {
          const updatedChatLids = [...chatLidsToUse, chatLid];
          const { error: updateChatLidError } = await supabase
            .from('leads')
            .update({ whatsapp_chat_lids: updatedChatLids })
            .eq('id', leadId);

          if (updateChatLidError) {
            console.error('Erro ao atualizar whatsapp_chat_lids:', updateChatLidError);
          } else {
            console.log('chatLid adicionado ao lead:', chatLid);
          }
        }
      } catch (e) {
        console.error('Erro ao persistir chatLid no lead:', e);
      }
    }

    // ===== STEP 8.5: Update lead name if still default =====
    if (contactName && leadId && chosenLead?.name === 'Lead WhatsApp') {
      const { error: nameError } = await supabase
        .from('leads')
        .update({ name: contactName })
        .eq('id', leadId);
      
      if (nameError) {
        console.error('Erro ao atualizar nome do lead:', nameError);
      } else {
        console.log('Nome do lead atualizado para:', contactName);
        if (chosenLead) chosenLead.name = contactName;
      }
    }

    // ===== STEP 9: Insert the message =====
    // Determine the phone to store - prefer lead's real phone over chatLid/raw phone
    let phoneToStore = normalizedPhone || rawPhone;
    
    // If this is a LID event and the lead has a real phone, use that instead
    if (isLidEvent && chosenLead?.phones && chosenLead.phones.length > 0) {
      const realPhone = chosenLead.phones[0];
      // Make sure it's a real phone (not a LID or temp)
      if (realPhone && !realPhone.includes('@') && realPhone.length >= 10) {
        phoneToStore = realPhone;
        console.log('Usando telefone real do lead ao invés do chatLid:', phoneToStore);
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
        raw_data: payload
      });

    if (insertError) {
      console.error('Erro ao inserir mensagem:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao inserir mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== RESULTADO ===');
    console.log('Mensagem WhatsApp salva com sucesso');
    console.log('leadId:', leadId);
    console.log('leadName:', chosenLead?.name);
    console.log('direction:', direction);
    console.log('resolveMethod:', resolveMethod);

    // ===== STEP 10: Add duplicate warning note if needed =====
    if (duplicateLeadsCount > 1) {
      console.log('⚠️ Duplicidade detectada, verificando se precisa adicionar nota...');
      
      // Check if there's already a recent duplicate warning note
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingNotes } = await supabase
        .from('lead_notes')
        .select('id')
        .eq('lead_id', leadId)
        .ilike('content', '%[Sistema] Atenção: duplicidade detectada%')
        .gte('created_at', oneDayAgo)
        .limit(1);
      
      if (!existingNotes || existingNotes.length === 0) {
        const noteContent = `[Sistema] Atenção: duplicidade detectada - há ${duplicateLeadsCount} leads com o mesmo número de telefone ou conversa WhatsApp. Verifique se não há registros duplicados.`;
        
        const { error: noteError } = await supabase
          .from('lead_notes')
          .insert({
            lead_id: leadId,
            content: noteContent
          });
        
        if (noteError) {
          console.error('Erro ao inserir nota de duplicidade:', noteError);
        } else {
          console.log('Nota de duplicidade adicionada ao lead');
        }
      }
    }

    // ===== STEP 11: Extract and add emails from message =====
    if (message && leadId && chosenLead) {
      const extractEmails = (text: string): string[] => {
        if (!text) return [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        const matches = text.match(emailRegex) || [];
        return [...new Set(matches.map(e => e.toLowerCase()))];
      };

      const filterValidEmails = (emails: string[]): string[] => {
        return emails.filter(email => {
          const lowerEmail = email.toLowerCase();
          if (lowerEmail.includes('miguel')) return false;
          if (lowerEmail.includes('brotherhood')) return false;
          if (lowerEmail.endsWith('@whatsapp.temp')) return false;
          return true;
        });
      };

      const extractedEmails = extractEmails(message);
      const validEmails = filterValidEmails(extractedEmails);

      if (validEmails.length > 0) {
        console.log('E-mails extraídos da mensagem:', validEmails);

        const currentEmails: string[] = chosenLead.emails || [];

        const newEmails = validEmails.filter(email =>
          !currentEmails.some((existing: string) =>
            existing.toLowerCase() === email.toLowerCase()
          )
        );

        if (newEmails.length > 0) {
          const updatedEmails = [...currentEmails, ...newEmails];

          const { error: updateError } = await supabase
            .from('leads')
            .update({ emails: updatedEmails })
            .eq('id', leadId);

          if (updateError) {
            console.error('Erro ao adicionar e-mails ao lead:', updateError);
          } else {
            console.log('E-mails adicionados ao lead:', newEmails);
          }
        }
      }
    }

    // ===== STEP 12: Fetch profile picture if needed =====
    if (direction === 'inbound' && chosenLead && !chosenLead.profile_picture_url) {
      console.log('Tentando buscar foto de perfil para o lead:', leadId);
      try {
        fetch(`${supabaseUrl}/functions/v1/fetch-profile-picture`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            phone: phoneToStore, 
            leadId 
          })
        }).catch(err => console.error('Erro ao buscar foto de perfil:', err));
      } catch (e) {
        console.error('Erro ao iniciar busca de foto de perfil:', e);
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
        isRecurring: chosenLead?.is_recurring || false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro no Z-API webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

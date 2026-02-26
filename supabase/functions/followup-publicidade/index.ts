import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getPrompt } from "../_shared/get-prompt.ts";
import { getSettings } from "../_shared/get-settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch sender settings
    const settings = await getSettings(['susan_name', 'susan_email', 'company_name', 'company_email']);
    const susanName = settings.susan_name;
    const susanEmail = settings.susan_email;
    const companyName = settings.company_name;
    const companyEmail = settings.company_email;

    console.log('=== FOLLOWUP PUBLICIDADE - INÍCIO ===');
    console.log(`Sender: ${susanName} <${susanEmail}>`);


    // 1. Buscar leads de publicidade em aberto com email válido
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('produto', 'publicidade')
      .eq('status', 'em_aberto')
      .not('email', 'is', null)
      .neq('email', '');

    if (leadsError) {
      console.error('Erro ao buscar leads:', leadsError);
      throw leadsError;
    }

    console.log(`Encontrados ${leads?.length || 0} leads de publicidade em aberto`);

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum lead de publicidade em aberto encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const lead of leads) {
      try {
        console.log(`\n--- Processando lead: ${lead.name} (${lead.id}) ---`);

        // 2. Buscar email_messages do lead ordenados por timestamp
        const { data: emails, error: emailsError } = await supabase
          .from('email_messages')
          .select('*')
          .eq('lead_id', lead.id)
          .order('timestamp', { ascending: true });

        if (emailsError) {
          console.error(`Erro ao buscar emails do lead ${lead.name}:`, emailsError);
          results.push({ lead: lead.name, status: 'error', error: emailsError.message });
          continue;
        }

        if (!emails || emails.length === 0) {
          console.log(`Lead ${lead.name}: sem histórico de emails, pulando`);
          results.push({ lead: lead.name, status: 'skipped', reason: 'no_emails' });
          continue;
        }

        // 3. Calcular unanswered_count e verificar timing
        let unansweredCount = 0;
        let lastOutboundTimestamp: string | null = null;

        // Percorrer do mais recente para o mais antigo
        for (let i = emails.length - 1; i >= 0; i--) {
          const email = emails[i];
          if (email.direction === 'outbound') {
            unansweredCount++;
            if (!lastOutboundTimestamp) {
              lastOutboundTimestamp = email.timestamp;
            }
          } else if (email.direction === 'inbound') {
            // Encontrou inbound, para de contar
            break;
          }
        }

        console.log(`Lead ${lead.name}: unanswered_count=${unansweredCount}, last_outbound=${lastOutboundTimestamp}`);

        // 4. Se já atingiu 5 follow-ups sem resposta, pular
        if (unansweredCount >= 5) {
          console.log(`Lead ${lead.name}: já atingiu 5 follow-ups sem resposta, pulando`);
          results.push({ lead: lead.name, status: 'skipped', reason: 'max_followups_reached' });
          continue;
        }

        // 5. Se último outbound foi há menos de 24h, pular
        if (lastOutboundTimestamp) {
          const lastOutboundDate = new Date(lastOutboundTimestamp);
          const now = new Date();
          const hoursSinceLastOutbound = (now.getTime() - lastOutboundDate.getTime()) / (1000 * 60 * 60);
          
          console.log(`Lead ${lead.name}: horas desde último outbound: ${hoursSinceLastOutbound.toFixed(1)}`);
          
          if (hoursSinceLastOutbound < 24) {
            console.log(`Lead ${lead.name}: último outbound há menos de 24h, pulando`);
            results.push({ lead: lead.name, status: 'skipped', reason: 'too_recent', hours: hoursSinceLastOutbound.toFixed(1) });
            continue;
          }
        }

        // 6. Determinar follow_up_number
        const followUpNumber = unansweredCount + 1;
        console.log(`Lead ${lead.name}: enviando follow-up #${followUpNumber}`);

        // 7. Construir histórico de emails para contexto da IA (últimos 10)
        const recentEmails = emails.slice(-10);
        const emailHistory = recentEmails.map(email => {
          const direction = email.direction === 'inbound' ? 'Received' : 'Sent';
          const subject = email.subject ? `Subject: ${email.subject}\n` : '';
          const content = email.message || email.html_body || '';
          return `[${direction} on ${new Date(email.timestamp).toLocaleString('en-US')}]\n${subject}${content}`;
        }).join('\n\n---\n\n');

        // Build thread quote HTML for email body
        const threadQuoteHtml = emails
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map((e: any) => {
            const from = e.direction === 'inbound' ? lead.name : susanName;
            const date = new Date(e.timestamp).toLocaleString();
            const subj = e.subject ? `<strong>Subject:</strong> ${e.subject}<br>` : '';
            const content = (e.html_body || e.message || '').replace(/\n/g, '<br>');
            return `<div style="margin-top: 20px; padding-left: 10px; border-left: 3px solid #ccc;">
              <p style="color: #666; font-size: 0.9em; margin-bottom: 5px;">On ${date}, ${from} wrote:</p>
              ${subj}<div>${content}</div>
            </div>`;
          }).join('');

        // 9. Build threading headers from resend_message_ids
        const messageIds = emails
          .map((e: any) => e.resend_message_id)
          .filter(Boolean);
        
        // Fallback to raw_data message-id
        const lastEmail = emails[emails.length - 1];
        const lastMessageId = lastEmail.raw_data && typeof lastEmail.raw_data === 'object'
          ? (lastEmail.raw_data as any)?.headers?.['message-id'] || (lastEmail.raw_data as any)?.messageId
          : null;
        if (lastMessageId && messageIds.length === 0) {
          messageIds.push(lastMessageId);
        }
        let prompt: string;

        if (followUpNumber <= 4) {
          const defaultPrompt = `You are ${susanName}, executive assistant to ${companyName}, a content creator and AI keynote speaker.

CRITICAL LANGUAGE RULE:
- Read the email history below carefully
- Identify the language the CLIENT (inbound/received messages) is using
- Write your ENTIRE reply (subject + body) in that SAME language
- If there are no inbound messages, default to English
- NEVER mix languages. If the client writes in English, reply 100% in English.
  If in French, reply 100% in French. If in Portuguese, reply 100% in Portuguese.

You are writing follow-up #{followUpNumber} to {leadName} about an advertising/sponsorship partnership.

Context - this is a brand that reached out to Miguel for a content partnership (publicidade). Susan is following up because they haven't responded.

INSTRUCTIONS:
- Write as Susan, Miguel's assistant, in first person
- Ask if they can give a response within 2 days
- Mention that Miguel's recording schedule is very tight right now
- Miguel really wants to make this partnership work
- Miguel's audience will love their product
- Be professional but show eagerness/urgency
- Keep it concise (4-6 lines max for the body)
- This is follow-up #{followUpNumber} - don't mention the exact number, just naturally follow up
- DO NOT include any signature, it will be added automatically
- MEDIA KIT RULE: ONLY include the link https://inventormiguel.link/kit if the client EXPLICITLY asked for Media Kit, press kit, kit de mídia, rate card, portfolio, pricing, or information about Miguel's numbers/reach in their messages. If the client did NOT explicitly request this information, do NOT include this link under any circumstances.

Email history for context:
{emailHistory}

Return ONLY in this format:
Subject: [subject line]

[body - just the new message, no signature, no previous thread]`;

          prompt = await getPrompt("10", defaultPrompt, {
            followUpNumber: String(followUpNumber),
            leadName: lead.name,
            emailHistory,
          });
        } else {
          // Follow-up 5 - último, tom decepcionado
          const defaultPrompt = `You are ${susanName}, executive assistant to ${companyName}, a content creator and AI keynote speaker.

CRITICAL LANGUAGE RULE:
- Read the email history below carefully
- Identify the language the CLIENT (inbound/received messages) is using
- Write your ENTIRE reply (subject + body) in that SAME language
- If there are no inbound messages, default to English
- NEVER mix languages. If the client writes in English, reply 100% in English.
  If in French, reply 100% in French. If in Portuguese, reply 100% in Portuguese.

You are writing the FINAL follow-up to {leadName} about an advertising/sponsorship partnership. This is the last attempt after multiple unanswered emails.

Context - this brand REACHED OUT TO MIGUEL first, proposing a content partnership. Then they simply stopped responding.

INSTRUCTIONS - DISAPPOINTED TONE:
- Write as Susan, Miguel's assistant
- Express that you've tried to reach them multiple times without any response
- Say that Miguel is personally disappointed - this brand reached out to HIM and then went silent
- If they're not interested, they could at least say so
- Miguel personally loves their product and was genuinely excited to create content about it
- This attitude is not compatible with such a great product
- This is the FINAL contact - after this, no more follow-ups
- Be direct but professional, showing genuine disappointment
- Keep it 6-8 lines
- DO NOT include any signature
- MEDIA KIT RULE: ONLY include the link https://inventormiguel.link/kit if the client EXPLICITLY asked for Media Kit, press kit, kit de mídia, rate card, portfolio, pricing, or information about Miguel's numbers/reach in their messages. If the client did NOT explicitly request this information, do NOT include this link under any circumstances.

Email history for context:
{emailHistory}

Return ONLY in this format:
Subject: [subject line]

[body - just the new message, no signature, no previous thread]`;

          prompt = await getPrompt("11", defaultPrompt, {
            leadName: lead.name,
            emailHistory,
          });
        }

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are ${susanName} writing professional follow-up emails. Detect the language the client uses in the conversation history and write 100% in that same language. Never mix languages.`
              },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`Erro da IA para lead ${lead.name}:`, aiResponse.status, errorText);
          results.push({ lead: lead.name, status: 'error', error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const generatedEmail = aiData.choices[0].message.content;

        // Separar assunto e corpo
        const lines = generatedEmail.split('\n');
        let newMessage = '';

        if (lines[0].startsWith('Assunto:') || lines[0].startsWith('Subject:')) {
          newMessage = lines.slice(2).join('\n').trim();
        } else {
          newMessage = generatedEmail.trim();
        }

        // Always reply on top of the last email in the thread
        const lastEmailInThread = emails[emails.length - 1];
        const lastSubject = lastEmailInThread?.subject || `Follow-up - ${lead.name}`;
        const subject = lastSubject.toLowerCase().startsWith('re:') ? lastSubject : `Re: ${lastSubject}`;

        // Formatar HTML com thread quote no corpo
        const newMessageHtml = newMessage.replace(/\n/g, '<br>');
        const fullBody = `
          <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
            ${newMessageHtml}
            <br><br>
            <p style="color: #666; font-size: 12px;">—<br>${susanName}<br>Executive Assistant to ${companyName}<br>${susanEmail}</p>
            ${threadQuoteHtml}
          </div>`;

        // 12. Enviar via Resend
        const recipientEmails = lead.emails && lead.emails.length > 0 
          ? lead.emails 
          : [lead.email];
        
        const uniqueRecipients = Array.from(new Set(recipientEmails.filter(Boolean)));

        const resendPayload: any = {
          from: `${susanName} <${susanEmail}>`,
          to: uniqueRecipients,
          cc: [companyEmail],
          subject: subject,
          html: fullBody,
        };

        if (messageIds.length > 0) {
          resendPayload.headers = {
            'In-Reply-To': messageIds[messageIds.length - 1],
            'References': messageIds.join(' '),
          };
        }

        console.log(`Enviando follow-up #${followUpNumber} para ${lead.name} (${uniqueRecipients.join(', ')})`);

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Erro Resend para lead ${lead.name}:`, errorText);
          results.push({ lead: lead.name, status: 'error', error: `Resend error: ${errorText}` });
          continue;
        }

        const emailData = await emailResponse.json();
        console.log(`✅ Follow-up #${followUpNumber} enviado para ${lead.name}:`, emailData);

        // 13. Salvar em email_messages como outbound com resend_message_id
        const followupResendMsgId = emailData.id || null;
        const { error: insertError } = await supabase
          .from('email_messages')
          .insert({
            lead_id: lead.id,
            direction: 'outbound',
            subject: subject,
            message: newMessage,
            html_body: fullBody,
            resend_message_id: followupResendMsgId,
          });

        if (insertError) {
          console.error(`Erro ao salvar email do lead ${lead.name}:`, insertError);
        } else {
          console.log(`✅ Email salvo no banco para ${lead.name}`);
        }

        results.push({ lead: lead.name, status: 'sent', followUpNumber });

      } catch (leadError: any) {
        console.error(`Erro processando lead ${lead.name}:`, leadError);
        results.push({ lead: lead.name, status: 'error', error: leadError.message });
      }
    }

    console.log('\n=== FOLLOWUP PUBLICIDADE - FIM ===');
    console.log('Resultados:', JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Erro geral em followup-publicidade:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getSettings } from "../_shared/get-settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: build email thread quote HTML from previous emails
function buildThreadQuoteHtml(emails: any[], leadName: string, senderName: string): string {
  if (!emails || emails.length === 0) return '';

  const sorted = [...emails].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Only include last 5 emails in quote to save memory
  const limited = sorted.slice(0, 5);

  const quoted = limited.map((email) => {
    const from = email.direction === 'inbound' ? leadName : senderName;
    const date = new Date(email.timestamp).toLocaleString('en-US');
    const subj = email.subject ? `<strong>Subject:</strong> ${email.subject}<br>` : '';
    // Truncate content to avoid memory issues
    let content = (email.html_body || email.message || '');
    if (content.length > 3000) content = content.substring(0, 3000) + '...';
    content = content.replace(/\n/g, '<br>');
    return `<div style="margin-top: 20px; padding-left: 10px; border-left: 3px solid #ccc;">
      <p style="color: #666; font-size: 0.9em; margin-bottom: 5px;">On ${date}, ${from} wrote:</p>
      ${subj}<div>${content}</div>
    </div>`;
  }).join('');

  return quoted;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, to, subject, body, threadQuote = true, fromOverride, attachments } = await req.json();

    console.log('=== SEND EMAIL REQUEST ===');
    console.log('leadId:', leadId);
    console.log('to:', to);
    console.log('subject:', subject);
    console.log('body length:', body?.length);
    console.log('threadQuote:', threadQuote);

    if (!to || !subject || !body) {
      console.error('ERRO: Campos obrigatórios faltando');
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando: to, subject, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Fetch sender identity from system settings
    const settings = await getSettings(['susan_name', 'susan_email', 'company_name', 'company_email']);
    const senderName = fromOverride?.name || settings.susan_name;
    const senderEmail = fromOverride?.email || settings.susan_email;
    const ccEmail = settings.company_email;

    // Handle both array and string formats for 'to'
    let emailList: string[] = [];
    if (Array.isArray(to)) {
      emailList = to.map((email: string) => email.trim()).filter((e: string) => !!e);
    } else if (typeof to === 'string') {
      emailList = to.split(',').map((email: string) => email.trim()).filter((e: string) => !!e);
    }
    const recipients = Array.from(new Set(emailList));

    console.log('Recipients processados:', recipients);

    // Initialize supabase for threading
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = (supabaseUrl && supabaseServiceRoleKey)
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : null;

    // Build threading headers and thread quote if leadId provided
    let replyHeaders: Record<string, string> = {};
    let threadHtml = '';
    let leadName = 'Client';

    if (leadId && supabase) {
      // Fetch lead name
      const { data: lead } = await supabase
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .maybeSingle();

      if (lead) leadName = lead.name;

      // Fetch previous emails for this lead (only fields needed for threading)
      const { data: previousEmails } = await supabase
        .from('email_messages')
        .select('resend_message_id, timestamp, direction, subject, message, html_body, raw_data')
        .eq('lead_id', leadId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (previousEmails && previousEmails.length > 0) {
        // Build In-Reply-To and References from resend_message_ids
        const messageIds = previousEmails
          .map((e: any) => e.resend_message_id)
          .filter(Boolean);

        if (messageIds.length > 0) {
          replyHeaders['In-Reply-To'] = messageIds[0]; // most recent
          replyHeaders['References'] = messageIds.join(' ');
          console.log('Threading headers set - In-Reply-To:', messageIds[0]);
        } else {
          // Fallback: try raw_data message-id
          const lastEmail = previousEmails[0];
          const rawMessageId = lastEmail.raw_data && typeof lastEmail.raw_data === 'object'
            ? (lastEmail.raw_data as any)?.headers?.['message-id'] || (lastEmail.raw_data as any)?.messageId
            : null;
          if (rawMessageId) {
            replyHeaders['In-Reply-To'] = rawMessageId;
            replyHeaders['References'] = rawMessageId;
            console.log('Threading headers set from raw_data:', rawMessageId);
          }
        }

        // Build thread quote HTML
        if (threadQuote) {
          threadHtml = buildThreadQuoteHtml(previousEmails, leadName, senderName);
          console.log('Thread quote built with', previousEmails.length, 'emails');
        }
      }
    }

    // Compose final HTML body with thread
    let finalBody = body;
    if (threadHtml) {
      finalBody = `${body}${threadHtml}`;
    }

    console.log('Enviando para Resend API...');

    const resendPayload: any = {
      from: `${senderName} <${senderEmail}>`,
      to: [...recipients, ccEmail],
      subject: subject,
      html: finalBody,
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      resendPayload.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content, // base64 string
        type: att.type || 'application/octet-stream',
      }));
      console.log('Attachments included:', attachments.map((a: any) => a.filename));
    }

    if (Object.keys(replyHeaders).length > 0) {
      resendPayload.headers = replyHeaders;
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    console.log('Resend API status:', emailResponse.status);

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('ERRO DO RESEND:', errorText);
      throw new Error(`Erro ao enviar email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    const resendMessageId = emailData.id || null;

    console.log('✅ Email enviado com SUCESSO via Resend!');
    console.log('Resend response:', emailData);
    console.log('Resend message ID:', resendMessageId);

    // Salvar na tabela email_messages se leadId foi fornecido
    if (leadId && supabase) {
      console.log('Salvando email no banco de dados...');
      const { error: insertError } = await supabase
        .from('email_messages')
        .insert({
          lead_id: leadId,
          direction: 'outbound',
          subject: subject,
          message: body,
          html_body: finalBody,
          resend_message_id: resendMessageId,
        });

      if (insertError) {
        console.error('❌ ERRO ao salvar email no banco:', insertError);
      } else {
        console.log('✅ Email salvo no banco com sucesso (resend_message_id:', resendMessageId, ')');
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: emailData }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erro em send-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);

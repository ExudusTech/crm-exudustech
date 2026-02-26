import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPrompt } from "../_shared/get-prompt.ts";
import { getSettings } from "../_shared/get-settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, leadName, leadDescription } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não está configurada');
    }

    if (!emails || !Array.isArray(emails)) {
      throw new Error('Nenhum email encontrado para gerar resposta');
    }

    const settings = await getSettings(['susan_name', 'company_name']);

    const recentEmails = emails
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    console.log('Generating email reply for', leadName, '- Total emails:', emails.length, '- Using:', recentEmails.length);

    const emailHistory = recentEmails.map((email: any) => {
      const direction = email.direction === 'inbound' ? 'Received' : 'Sent';
      const subject = email.subject ? `Subject: ${email.subject}\n` : '';
      const rawContent = email.message || (email.html_body ? stripHtml(email.html_body) : '');
      const content = rawContent.substring(0, 2000);
      return `[${direction} on ${new Date(email.timestamp).toISOString()}]\n${subject}${content}`;
    }).join('\n\n---\n\n');

    const defaultPrompt = `You are ${settings.susan_name} writing a professional follow-up email on behalf of ${settings.company_name}.

ABSOLUTE LANGUAGE REQUIREMENT - THIS IS THE MOST IMPORTANT RULE:
- Analyze the email history below carefully. Detect the language that the LEAD (inbound messages) is using.
- If there are no inbound messages, detect the language from the outbound messages.
- You MUST write the ENTIRE follow-up email in that SAME language (Portuguese, English, French, Spanish, German, Italian, or any other language detected).
- The subject line MUST also be in the detected language.
- DO NOT mix languages under any circumstances.
- DO NOT default to Portuguese. Match the conversation language exactly.

CRITICAL: Write in FIRST PERSON (I/we, not "${settings.susan_name}" or "he/she"). You ARE ${settings.susan_name} responding directly.

Lead: {leadName}
{leadDescriptionLine}

Email history:
{emailHistory}

Based on the history above, write a professional and contextual follow-up email AS ${settings.susan_name} in first person. The email should:
- Reference the last interaction naturally
- Be friendly and professional
- Have a clear call-to-action
- Provide an appropriate subject line in the detected language
- Be a NEW message that will be PREPENDED to the email thread

Return ONLY the new email message in this exact format:
Subject: [subject]

[body (do NOT include the previous email thread, just the new message)]`;

    const prompt = await getPrompt("9", defaultPrompt, {
      leadName,
      leadDescriptionLine: leadDescription ? `Lead description: ${leadDescription}` : '',
      emailHistory,
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
      throw new Error(`Erro da Lovable AI: ${response.status}`);
    }

    const data = await response.json();
    const generatedEmail = data.choices[0].message.content;

    const lines = generatedEmail.split('\n');
    let subject = '';
    let newMessage = '';
    
    if (lines[0].startsWith('Assunto:') || lines[0].startsWith('Subject:')) {
      subject = lines[0].replace(/^(Assunto|Subject):/, '').trim();
      newMessage = lines.slice(2).join('\n').trim();
    } else {
      subject = 'Follow-up';
      newMessage = generatedEmail.trim();
    }

    const newMessageHtml = newMessage.replace(/\n/g, '<br>');
    const body = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
        ${newMessageHtml}
      </div>`;

    return new Response(
      JSON.stringify({ subject, body }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro em generate-email-reply:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

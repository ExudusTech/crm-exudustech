import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getPrompt } from "../_shared/get-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedEmail {
  subject: string;
  message: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  sender_email: string;
  recipient_email: string;
}

// Helper function to extract JSON from AI response
function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.indexOf("[");
  const jsonEnd = cleaned.lastIndexOf("]");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON array found in response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    cleaned = cleaned
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(cleaned);
  }
}

// Helper function to extract emails from thread using AI
async function extractEmailsFromThread(
  content: string,
  subject: string,
  userName: string = 'Miguel'
): Promise<ExtractedEmail[]> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    console.log('LOVABLE_API_KEY not configured, skipping AI extraction');
    return [];
  }

  try {
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: await getPrompt("16", `Você é um assistente que analisa emails e extrai cada email INDIVIDUAL de threads.

O usuário se chama "{userName}". Seus emails são de domínios:
- @inventosdigitais.com.br
- @inventormiguel.com

IMPORTANTE:
1. Analise TODO o conteúdo fornecido e identifique CADA email individual, incluindo os que estão em citações/threads (como "On ... wrote:", "于...写道:", "Em ... escreveu:")
2. Para cada email encontrado, extraia:
   - subject: assunto do email (use o assunto principal se não especificado)
   - message: APENAS o corpo do email (sem citações de emails anteriores, sem assinaturas, sem rodapés)
   - direction: "outbound" se enviado por {userName}/@inventosdigitais.com.br/@inventormiguel.com, "inbound" se enviado por outros
   - timestamp: data/hora em formato ISO 8601 (se não encontrar data exata, use uma estimativa baseada no contexto)
   - sender_email: email do remetente
   - recipient_email: email do destinatário

3. REMOVA:
   - Citações de emails anteriores
   - Assinaturas de email
   - Disclaimers legais
   - Rodapés automáticos

4. Mantenha a ordem CRONOLÓGICA (mais antigo primeiro)
5. NÃO repita o mesmo email mais de uma vez

Retorne um array JSON com TODOS os emails encontrados.`, { userName })
          },
          {
            role: 'user',
            content: `Assunto: ${subject}\n\nConteúdo:\n${content}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_individual_emails",
              description: "Extrai emails individuais de threads",
              parameters: {
                type: "object",
                properties: {
                  emails: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        message: { type: "string" },
                        direction: { type: "string", enum: ["inbound", "outbound"] },
                        timestamp: { type: "string" },
                        sender_email: { type: "string" },
                        recipient_email: { type: "string" }
                      },
                      required: ["subject", "message", "direction", "timestamp", "sender_email", "recipient_email"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["emails"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_individual_emails" } }
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      return [];
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.log('No tool call in AI response');
      return [];
    }

    const parsedResult = JSON.parse(toolCall.function.arguments);
    console.log(`AI extracted ${parsedResult.emails.length} emails from thread`);
    return parsedResult.emails;
  } catch (error) {
    console.error('Error extracting emails with AI:', error);
    return [];
  }
}

// Helper function to check if email already exists
async function emailExists(
  supabase: any,
  leadId: string,
  email: ExtractedEmail
): Promise<boolean> {
  // Check by timestamp and direction (most reliable)
  const emailDate = new Date(email.timestamp);
  const startWindow = new Date(emailDate.getTime() - 60000); // 1 minute before
  const endWindow = new Date(emailDate.getTime() + 60000); // 1 minute after
  
  const { data: existing } = await supabase
    .from('email_messages')
    .select('id')
    .eq('lead_id', leadId)
    .eq('direction', email.direction)
    .gte('timestamp', startWindow.toISOString())
    .lte('timestamp', endWindow.toISOString())
    .limit(1);
  
  if (existing && existing.length > 0) {
    return true;
  }
  
  // Also check by message content similarity (first 100 chars)
  const messagePrefix = email.message.substring(0, 100).trim();
  if (messagePrefix) {
    const { data: byContent } = await supabase
      .from('email_messages')
      .select('id, message')
      .eq('lead_id', leadId)
      .eq('direction', email.direction);
    
    if (byContent) {
      for (const existing of byContent) {
        if (existing.message && existing.message.substring(0, 100).trim() === messagePrefix) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Helper function to process and save attachments
async function processAttachments(
  supabase: any,
  attachments: Array<{ file: File; fieldName: string }>,
  leadId: string,
  emailMessageId: string
) {
  for (const { file } of attachments) {
    try {
      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${leadId}/${timestamp}_${sanitizedFilename}`;
      
      console.log('Uploading attachment:', file.name, 'to:', storagePath);

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('email-attachments')
        .upload(storagePath, uint8Array, {
          contentType: file.type || 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading attachment:', uploadError);
        continue;
      }

      const { error: dbError } = await supabase
        .from('email_attachments')
        .insert({
          lead_id: leadId,
          email_message_id: emailMessageId,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          storage_path: storagePath
        });

      if (dbError) {
        console.error('Error saving attachment metadata:', dbError);
      } else {
        console.log('Attachment saved successfully:', file.name);
      }
    } catch (error) {
      console.error('Error processing attachment:', file.name, error);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("CloudMailin webhook received");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};

    let attachments: Array<{ file: File; fieldName: string }> = [];
    
    if (contentType.includes('multipart/form-data')) {
      // Parse Multipart Normalised from CloudMailin
      const form = await req.formData();
      const entries = Array.from(form.entries());
      // Flatten form-data into an object preserving repeated keys as arrays
      for (const [key, value] of entries) {
        if (value instanceof File) {
          // Store files separately
          attachments.push({ file: value, fieldName: key });
          console.log('Found attachment:', value.name, 'size:', value.size, 'type:', value.type);
        } else if (typeof value === 'string') {
          if (payload[key] === undefined) payload[key] = value;
          else if (Array.isArray(payload[key])) payload[key].push(value);
          else payload[key] = [payload[key], value];
        }
      }
      console.log('Parsed multipart form-data keys:', Object.keys(payload));
      console.log('Found attachments count:', attachments.length);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      payload = Object.fromEntries(params.entries());
      console.log('Parsed as URL-encoded form');
    } else if (contentType.includes('application/json')) {
      payload = await req.json();
      console.log('Parsed as JSON');
    } else {
      // Fallback: try text then JSON
      const bodyText = await req.text();
      try {
        payload = JSON.parse(bodyText);
        console.log('Parsed as JSON from text fallback');
      } catch {
        payload = { plain: bodyText };
        console.log('Using raw text as plain body');
      }
    }

    console.log("Final payload:", JSON.stringify(payload, null, 2));

    // Helpers para obter valores de chaves aninhadas ou com notação de colchetes
    const resolvePath = (obj: any, path: string) => {
      if (!obj) return undefined;
      // 1) tentativa direta (ex.: "headers[To]")
      if (path in obj) return obj[path];
      // 2) converter colchetes para dot (headers[To] -> headers.To)
      const dot = path.replace(/\[(.*?)\]/g, ".$1");
      return dot.split(".").reduce((acc: any, key: string) => (acc ? acc[key] : undefined), obj);
    };

    const getAny = (obj: any, candidates: string[], fallback: any = '') => {
      for (const c of candidates) {
        const v = resolvePath(obj, c);
        if (v !== undefined && v !== null && String(v).length > 0) return v;
      }
      return fallback;
    };

    // Coleta múltiplos valores string a partir de várias chaves
    const getAllStrings = (obj: any, candidates: string[]): string[] => {
      const out: string[] = [];
      for (const c of candidates) {
        const v = resolvePath(obj, c);
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          for (const item of v) if (typeof item === 'string' && item.trim()) out.push(item.trim());
        } else if (typeof v === 'string' && v.trim()) {
          out.push(v.trim());
        }
      }
      return out;
    };

    // Extrair campos FROM e TO (candidatos)
    const fromCandidates = [
      'envelope.from', 'envelope[from]',
      'headers.From', 'headers[From]', 'headers.from', 'headers[from]',
      'from', 'sender'
    ];

    const toCandidates = [
      'headers.To', 'headers[To]', 'headers.to', 'headers[to]',
      'envelope.to', 'envelope[to]', 'envelope.recipients', 'envelope[recipients][0]',
      'to'
    ];

    const fromValues = getAllStrings(payload, fromCandidates);
    const toValues = getAllStrings(payload, toCandidates);

    const subject = getAny(payload, [
      'headers.Subject', 'headers[Subject]', 'headers.subject', 'headers[subject]',
      'subject', 'headers.Subject[0]'
    ], '');

    const message = getAny(payload, [
      'plain', 'body-plain', 'text', 'html', 'body', 'stripped-text'
    ], '');

    // Util para extrair { name, email } de um token
    const parseAddress = (token: string) => {
      token = token.trim();
      const m = token.match(/^(.+?)\s*<(.+?)>$/);
      if (m) {
        return { name: m[1].trim().replace(/['"]/g, ''), email: m[2].trim() };
      }
      return { name: token.split('@')[0] || 'Lead', email: token };
    };

    // Juntar todos os endereços coletados
    const rawTokens = [...fromValues, ...toValues]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);


    const parsed = rawTokens.map(parseAddress);

    // Regras de exclusão
    const ignoredDomains = ['cloudmailin.net', 'inventosdigitais.com.br', 'inventormiguel.com'];
    const isIgnoredDomain = (e: string) => ignoredDomains.some((d) => e.toLowerCase().endsWith(`@${d}`));

    // Lead é sempre o email que NAO termina com @inventosdigitais.com.br e nao é @cloudmailin.net
    const leadAddr = parsed.find(({ email }) => !isIgnoredDomain(email));

    if (!leadAddr) {
      console.error('Nenhum endereço externo válido encontrado');
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum endereço externo válido encontrado',
          candidates: parsed
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Lead (externo) escolhido:', leadAddr);

    // Função helper para extrair e-mail limpo de strings como "Nome <email@domain.com>"
    const extractEmail = (emailString: string): string => {
      const match = emailString.match(/<(.+?)>/);
      return match ? match[1].toLowerCase().trim() : emailString.toLowerCase().trim();
    };

    // Determinar a direção do e-mail baseado no remetente
    const senderEmail = fromValues.length > 0 ? extractEmail(fromValues[0]) : '';
    const isOutbound = senderEmail.endsWith('@inventosdigitais.com.br') || 
                       senderEmail === 'miguel@inventormiguel.com';
    const direction = isOutbound ? 'outbound' : 'inbound';
    
    console.log('Direction determined:', direction, 'from sender:', senderEmail);

    // Verificar se já existe lead com este email no array
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, emails, phones, status, delivered_at, archived, unclassified')
      .contains('emails', [leadAddr.email]);

    let leadId: string | null = null;
    let openOpportunity: any = null;
    let closedLead: any = null;

    if (existingLeads && existingLeads.length > 0) {
      // Primeiro, verificar se existe lead entregue ou perdido (criar nova oportunidade recorrente)
      closedLead = existingLeads.find((l: any) => 
        l.status === 'entregue' || l.status === 'perdido'
      );
      
      // Verificar se existe um lead ganho ou produzido (manter na mesma oportunidade)
      const wonLead = existingLeads.find((l: any) => 
        l.status === 'ganho' || l.status === 'produzido'
      );
      
      // Verificar se existe uma oportunidade em aberto (em_aberto ou em_negociacao)
      openOpportunity = existingLeads.find((l: any) => 
        l.archived === false && 
        l.unclassified === false && 
        (l.status === 'em_aberto' || l.status === 'em_negociacao')
      );
      
      if (closedLead && !openOpportunity && !wonLead) {
        // Cliente com negócio entregue/perdido e SEM oportunidade aberta - criar nova oportunidade recorrente
        console.log('Cliente com negócio entregue/perdido encontrado, criando nova oportunidade recorrente');
        const newLeadData = {
          name: leadAddr.name || closedLead.name || 'Lead',
          email: leadAddr.email,
          emails: [leadAddr.email],
          phones: closedLead.phones || [],
          message: `Assunto: ${subject}\n\n${message}`.trim(),
          source: 'cloudmailin',
          is_recurring: true
        };
        
        const { data: newLead, error: newLeadError } = await supabase
          .from('leads')
          .insert(newLeadData)
          .select()
          .single();
        
        if (newLeadError) {
          console.error('Erro ao criar novo lead recorrente:', newLeadError);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar novo lead recorrente' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        leadId = newLead.id;
        console.log('Nova oportunidade recorrente criada:', leadId);
      } else if (wonLead) {
        // Lead ganho/produzido - associar mensagem à mesma oportunidade
        leadId = wonLead.id;
        console.log('Lead ganho/produzido encontrado, associando mensagem à mesma oportunidade:', leadId);
      } else if (openOpportunity) {
        // Cliente com oportunidade em aberto - associar mensagem à oportunidade existente
        leadId = openOpportunity.id;
        console.log('Oportunidade em aberto encontrada, associando mensagem:', leadId);
      } else {
        // Lead existe mas não tem status especial - usar o existente
        leadId = existingLeads[0].id;
        console.log('Lead existente encontrado, associando mensagem:', leadId);
      }
      
      // Salvar nova mensagem de email
      const { data: emailMessageData, error: msgError } = await supabase
        .from('email_messages')
        .insert({
          lead_id: leadId,
          subject,
          message,
          html_body: getAny(payload, ['html', 'body-html', 'html-body'], ''),
          direction,
          timestamp: new Date(),
          raw_data: payload
        })
        .select()
        .single();

      if (msgError) {
        console.error('Erro ao salvar mensagem:', msgError);
      }

      // Process attachments if any
      if (attachments.length > 0 && emailMessageData && leadId) {
        await processAttachments(supabase, attachments, leadId, emailMessageData.id);
      }

      // Extract and save missing emails from thread history
      let savedFromHistory = 0;
      if (leadId && message) {
        const htmlBody = getAny(payload, ['html', 'body-html', 'html-body'], '');
        const fullContent = htmlBody || message;
        
        console.log('Extracting emails from thread history...');
        const extractedEmails = await extractEmailsFromThread(fullContent, subject);
        
        for (const email of extractedEmails) {
          const exists = await emailExists(supabase, leadId, email);
          if (!exists) {
            console.log('Saving missing email from history:', email.subject, email.direction, email.timestamp);
            const { error: insertError } = await supabase
              .from('email_messages')
              .insert({
                lead_id: leadId,
                subject: email.subject || subject,
                message: email.message,
                html_body: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${email.message.replace(/\n/g, '<br>')}</div>`,
                direction: email.direction,
                timestamp: email.timestamp,
                raw_data: { extracted_from_thread: true, sender_email: email.sender_email, recipient_email: email.recipient_email }
              });
            
            if (insertError) {
              console.error('Error saving extracted email:', insertError);
            } else {
              savedFromHistory++;
            }
          } else {
            console.log('Email already exists, skipping:', email.subject, email.direction);
          }
        }
        console.log(`Saved ${savedFromHistory} emails from thread history`);
      }

      const responseMessage = closedLead && !openOpportunity 
        ? 'Nova oportunidade recorrente criada'
        : (wonLead ? 'Mensagem associada à oportunidade ganha/produzida' : (openOpportunity ? 'Mensagem associada à oportunidade em aberto' : 'Mensagem adicionada ao lead existente'));
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: responseMessage, 
          leadId,
          isRecurring: !!openOpportunity || !!closedLead || !!wonLead,
          savedFromHistory
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Criar lead a partir do endereço externo com arrays
    const leadsToInsert = [{
      name: leadAddr.name || 'Lead',
      email: leadAddr.email,
      emails: [leadAddr.email],
      phones: [],
      message: `Assunto: ${subject}\n\n${message}`.trim(),
      source: 'cloudmailin'
    }];

    // Validar que temos um email válido
    if (!leadsToInsert[0].email || !leadsToInsert[0].email.includes('@')) {
      console.error('Nenhum remetente válido encontrado');
      return new Response(
        JSON.stringify({ 
          error: 'Nenhum remetente válido encontrado',
          payload_received: payload 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Salvar leads no banco de dados
    const { data, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select();

    if (error) {
      console.error("Erro ao salvar lead:", error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("Lead salvo com sucesso:", data);
    leadId = data[0].id;

    // Salvar primeira mensagem de email
    const { data: emailMessageData } = await supabase
      .from('email_messages')
      .insert({
        lead_id: leadId,
        subject,
        message,
        html_body: getAny(payload, ['html', 'body-html', 'html-body'], ''),
        direction,
        timestamp: new Date(),
        raw_data: payload
      })
      .select()
      .single();

    // Process attachments if any
    if (attachments.length > 0 && emailMessageData && leadId) {
      await processAttachments(supabase, attachments, leadId, emailMessageData.id);
    }

    // Extract and save missing emails from thread history for new leads
    let savedFromHistory = 0;
    if (leadId && message) {
      const htmlBody = getAny(payload, ['html', 'body-html', 'html-body'], '');
      const fullContent = htmlBody || message;
      
      console.log('Extracting emails from thread history for new lead...');
      const extractedEmails = await extractEmailsFromThread(fullContent, subject);
      
      for (const email of extractedEmails) {
        const exists = await emailExists(supabase, leadId, email);
        if (!exists) {
          console.log('Saving missing email from history:', email.subject, email.direction, email.timestamp);
          const { error: insertError } = await supabase
            .from('email_messages')
            .insert({
              lead_id: leadId,
              subject: email.subject || subject,
              message: email.message,
              html_body: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${email.message.replace(/\n/g, '<br>')}</div>`,
              direction: email.direction,
              timestamp: email.timestamp,
              raw_data: { extracted_from_thread: true, sender_email: email.sender_email, recipient_email: email.recipient_email }
            });
          
          if (insertError) {
            console.error('Error saving extracted email:', insertError);
          } else {
            savedFromHistory++;
          }
        } else {
          console.log('Email already exists, skipping:', email.subject, email.direction);
        }
      }
      console.log(`Saved ${savedFromHistory} emails from thread history for new lead`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lead salvo com sucesso',
        lead: data,
        savedFromHistory
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Erro no webhook:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

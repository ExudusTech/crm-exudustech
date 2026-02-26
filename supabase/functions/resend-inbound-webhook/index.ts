import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getPrompt } from "../_shared/get-prompt.ts";
import { getSettings } from "../_shared/get-settings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// These will be overridden by system_settings at runtime
let SUSAN_EMAIL = 'susan@inventormiguel.link';
let SUSAN_NAME = 'Susan Whitfield';
let COMPANY_NAME = 'Miguel Fernandes';
let COMPANY_EMAIL = 'miguel@inventormiguel.com';
const MIGUEL_EMAILS = [
  'miguel@inventormiguel.com',
  'miguel@inventosdigitais.com.br',
];
const IGNORED_EMAILS = [SUSAN_EMAIL, ...MIGUEL_EMAILS];
const INTERNAL_DOMAINS = ['inventosdigitais.com.br', 'inventormiguel.com', 'inventormiguel.link'];
const isInternalDomain = (email: string) => INTERNAL_DOMAINS.some(d => email.toLowerCase().endsWith(`@${d}`));

async function associateCCEmailsToLeadSafe(supabase: any, leadId: string, candidateEmails: string[], currentEmails: string[]) {
  for (const email of candidateEmails) {
    const emailLower = email.toLowerCase();
    if (isInternalDomain(emailLower)) continue;
    if (currentEmails.includes(emailLower)) continue;

    // Verifica se já pertence a outro lead
    const { data: otherLead } = await supabase
      .from('leads')
      .select('id')
      .or(`email.eq.${emailLower},emails.cs.{${emailLower}}`)
      .neq('id', leadId)
      .maybeSingle();

    if (otherLead) {
      console.log(`CC ${emailLower} já pertence a outro lead (${otherLead.id}), ignorando`);
      continue;
    }

    const updated = [...currentEmails, emailLower];
    const { error } = await supabase.from('leads').update({ emails: updated }).eq('id', leadId);
    if (error) {
      console.error('Error associating CC email to lead:', error);
    } else {
      console.log('✅ Associated CC email to lead:', emailLower);
      currentEmails.push(emailLower);
    }
  }
}

const PROPOSAL_VALUE = 3000;
const PROPOSAL_CURRENCY = 'USD';

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

function formatDate(date: Date, lang: string): string {
  const locale = lang.toLowerCase().includes('portug') ? 'pt-BR' : 'en-US';
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function sanitizeStorageKey(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}

function extractCleanEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  const emailMatch = raw.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) return emailMatch[0].toLowerCase();
  return raw.trim().toLowerCase();
}

async function fetchEmailContent(emailId: string, resendApiKey: string): Promise<{ text: string; html: string }> {
  let text = '';
  let html = '';
  try {
    console.log('Fetching full email content from Resend API for email_id:', emailId);
    const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { 'Authorization': `Bearer ${resendApiKey}` },
    });
    if (resp.ok) {
      const fullEmail = await resp.json();
      text = fullEmail.text || '';
      html = fullEmail.html || '';
      console.log('Fetched email content - text length:', text.length, 'html length:', html.length);
    } else {
      console.error('Failed to fetch email content:', resp.status);
    }
  } catch (err) {
    console.error('Error fetching email content from Resend:', err);
  }
  return { text, html };
}

async function findExistingLead(supabase: any, emails: string[]): Promise<any | null> {
  for (const email of emails) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, emails')
      .or(`email.eq.${email},emails.cs.{${email}}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error searching for existing lead:', error);
      continue;
    }
    if (data) {
      console.log('Found existing lead:', data.id, data.name, 'for email:', email);
      return data;
    }
  }
  return null;
}

async function saveInboundEmail(supabase: any, leadId: string, subject: string, text: string, html: string, timestamp: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      lead_id: leadId,
      direction: 'inbound',
      subject: subject || null,
      message: text || null,
      html_body: html || null,
      timestamp: timestamp || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving inbound email:', error);
    return null;
  }
  console.log('✅ Inbound email saved to lead:', leadId, 'message id:', data?.id);
  return data?.id || null;
}

async function saveOutboundEmail(supabase: any, leadId: string, subject: string, text: string, html: string, timestamp: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      lead_id: leadId,
      direction: 'outbound',
      subject: subject || null,
      message: text || null,
      html_body: html || null,
      timestamp: timestamp || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving outbound email:', error);
    return null;
  }
  console.log('✅ Outbound email saved to lead:', leadId, 'message id:', data?.id);
  return data?.id || null;
}

// --- Process and save email attachments ---
async function processEmailAttachments(supabase: any, resendApiKey: string, resendEmailId: string, leadId: string, emailMessageId: string | null) {
  try {
    console.log('Checking for attachments on email:', resendEmailId);
    
    // List attachments via Resend API
    const listResp = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}/attachments`, {
      headers: { 'Authorization': `Bearer ${resendApiKey}` },
    });
    
    if (!listResp.ok) {
      console.log('No attachments or error listing:', listResp.status);
      return;
    }
    
    const attachmentsList = await listResp.json();
    const attachments = attachmentsList.data || attachmentsList || [];
    
    if (!Array.isArray(attachments) || attachments.length === 0) {
      console.log('No attachments found for this email');
      return;
    }
    
    console.log(`Found ${attachments.length} attachment(s), processing...`);
    
    for (const att of attachments) {
      try {
        // Get attachment details with download_url
        const detailResp = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}/attachments/${att.id}`, {
          headers: { 'Authorization': `Bearer ${resendApiKey}` },
        });
        
        if (!detailResp.ok) {
          console.error('Error fetching attachment detail:', att.id, detailResp.status);
          continue;
        }
        
        const attDetail = await detailResp.json();
        const downloadUrl = attDetail.download_url;
        
        if (!downloadUrl) {
          console.error('No download_url for attachment:', att.id);
          continue;
        }
        
        // Download the file
        const fileResp = await fetch(downloadUrl);
        if (!fileResp.ok) {
          console.error('Error downloading attachment:', att.filename, fileResp.status);
          continue;
        }
        
        const fileBlob = await fileResp.blob();
        const fileBuffer = await fileBlob.arrayBuffer();

        // --- Deduplication: compute SHA-256 hash ---
        const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Check if this file (even if deleted) was already processed for this lead
        const { data: existing } = await supabase
          .from('email_attachments')
          .select('id, deleted_at')
          .eq('lead_id', leadId)
          .eq('content_hash', contentHash)
          .limit(1)
          .maybeSingle();

        if (existing) {
          console.log(`⏭️ Skipping duplicate attachment "${att.filename}" (hash already exists, deleted: ${!!existing.deleted_at})`);
          continue;
        }

        // Upload to Supabase Storage
        const safeFilename = sanitizeStorageKey(att.filename || 'attachment');
        const storagePath = `${leadId}/${Date.now()}_${safeFilename}`;
        const { error: uploadError } = await supabase.storage
          .from('email-attachments')
          .upload(storagePath, new Uint8Array(fileBuffer), {
            contentType: att.content_type || 'application/octet-stream',
            upsert: false,
          });
        
        if (uploadError) {
          console.error('Error uploading attachment to storage:', uploadError);
          continue;
        }
        
        // Save record in email_attachments table with content hash
        const { error: insertError } = await supabase
          .from('email_attachments')
          .insert({
            email_message_id: emailMessageId,
            lead_id: leadId,
            filename: att.filename || 'attachment',
            content_type: att.content_type || null,
            size_bytes: att.size || null,
            storage_path: storagePath,
            content_hash: contentHash,
          });
        
        if (insertError) {
          console.error('Error saving attachment record:', insertError);
        } else {
          console.log('✅ Attachment saved:', att.filename, storagePath);
        }
      } catch (attErr) {
        console.error('Error processing attachment:', att.filename, attErr);
      }
    }
  } catch (err) {
    console.error('Error in processEmailAttachments (non-fatal):', err);
  }
}

// --- Intent analysis: does Miguel want Susan to send a proposal? ---
async function analyzeIntent(
  emailContent: string, emailSubject: string, LOVABLE_API_KEY: string
): Promise<boolean> {
  console.log('Analyzing Miguel intent...');
  const defaultIntentPrompt = `Analyze this email from Miguel Fernandes to his assistant Susan.
Is Miguel asking Susan to send a proposal, quote, price, budget, or commercial offer to the client?
Consider both explicit and implicit instructions (e.g. "manda pra ele", "envia a proposta", "faz o contato comercial", "segue com a proposta").

Subject: {emailSubject}

Content:
{emailContent}`;

  const prompt = await getPrompt("3", defaultIntentPrompt, {
    emailSubject,
    emailContent: emailContent.substring(0, 3000) || '(empty)',
  });

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You analyze emails to determine intent. Always respond using the tool provided.' },
        { role: 'user', content: prompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'analyze_intent',
          description: 'Determine if Miguel is asking to send a proposal',
          parameters: {
            type: 'object',
            properties: {
              should_send_proposal: { type: 'boolean', description: 'True if Miguel wants Susan to send a proposal/quote/price to the client' },
            },
            required: ['should_send_proposal'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'analyze_intent' } },
    }),
  });

  if (!resp.ok) {
    console.error('Intent analysis failed:', resp.status);
    return false;
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.log('No tool call returned for intent, defaulting to false');
    return false;
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log('Intent analysis result:', result.should_send_proposal);
  return result.should_send_proposal === true;
}

// --- Media Kit request analysis ---
async function analyzeMediaKitRequest(
  emailContent: string, emailHistory: string, LOVABLE_API_KEY: string
): Promise<boolean> {
  console.log('Analyzing if client is requesting Media Kit...');
  const defaultMediaKitPrompt = `Analyze this email from a client responding to a partnership/advertising proposal.

Is the client asking for any of the following:
- Media Kit / Press Kit
- Demographics / audience data
- Reach numbers / engagement metrics
- Portfolio / case studies / previous work
- Rate card / pricing table / media table
- Information about Miguel's audience, followers, or content performance

This is specifically about the client REQUESTING information/data, not about declining or accepting a proposal.

Latest client email:
{emailContent}

Conversation history for context:
{emailHistory}`;

  const prompt = await getPrompt("23", defaultMediaKitPrompt, {
    emailContent: emailContent.substring(0, 3000),
    emailHistory: emailHistory.substring(0, 5000),
  });

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'detect_media_kit_request',
          description: 'Determine if the client is requesting Media Kit, demographics, or similar data',
          parameters: {
            type: 'object',
            properties: {
              is_media_kit_request: { type: 'boolean', description: 'True if the client is asking for Media Kit, demographics, reach numbers, portfolio, rate card, or similar information' },
            },
            required: ['is_media_kit_request'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'detect_media_kit_request' } },
    }),
  });

  if (!resp.ok) {
    console.error('Media Kit request analysis failed:', resp.status);
    return false;
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.log('No tool call returned for Media Kit request, defaulting to false');
    return false;
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log('Media Kit request analysis result:', result.is_media_kit_request);
  return result.is_media_kit_request === true;
}

// --- Generate Media Kit reply ---
async function generateMediaKitReply(
  lead: any, emailHistory: string, mediaKitLink: string, LOVABLE_API_KEY: string
): Promise<{ subject: string; body: string }> {
  console.log('Generating Media Kit reply for lead:', lead.name);

  const defaultMediaKitReplyPrompt = `You are ${SUSAN_NAME}, executive assistant to ${COMPANY_NAME}, a content creator and AI keynote speaker.

A client has asked for demographics, Media Kit, reach numbers, portfolio, or similar information. You need to reply sending the Media Kit link.

CRITICAL LANGUAGE RULE: Analyze the ENTIRE email history below. Identify the language the CLIENT uses in their messages. Write your ENTIRE reply in that SAME language.

INSTRUCTIONS:
- Write as ${SUSAN_NAME}, ${COMPANY_NAME}'s assistant, in first person
- Show enthusiasm - say that ${COMPANY_NAME} would love this partnership
- Share the Media Kit link: {mediaKitLink}
- Say the link contains all the information they need (demographics, reach, audience data, previous partnerships, etc.)
- Invite them to reach out with any questions
- Be professional, warm and concise - maximum 6-8 lines for the body
- DO NOT include any signature, it will be added automatically
- DO NOT include "Subject:" or "Assunto:" prefix

Lead name: {leadName}

Full email history (use this to determine the client's language):
{emailHistory}

Return ONLY in this format:
Subject: [subject line in the client's language]

[body - just the new message, no signature]`;

  const prompt = await getPrompt("24", defaultMediaKitReplyPrompt, {
    susanName: SUSAN_NAME,
    companyName: COMPANY_NAME,
    leadName: lead.name,
    emailHistory,
    mediaKitLink,
  });

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Media Kit reply generation failed:', resp.status, errText);
    throw new Error(`Media Kit reply generation failed: ${resp.status}`);
  }

  const data = await resp.json();
  const generatedEmail = data.choices[0].message.content;

  const lines = generatedEmail.split('\n');
  let subject = '';
  let body = '';

  if (lines[0].toLowerCase().startsWith('assunto:') || lines[0].toLowerCase().startsWith('subject:')) {
    subject = lines[0].replace(/^(Assunto|Subject):\s*/i, '').trim();
    body = lines.slice(2).join('\n').trim();
  } else {
    subject = `Re: ${lead.name}`;
    body = generatedEmail.trim();
  }

  return { subject, body };
}

// --- Budget rejection analysis ---
async function analyzeBudgetRejection(
  emailContent: string, emailHistory: string, LOVABLE_API_KEY: string
): Promise<boolean> {
  console.log('Analyzing if client email is a budget rejection...');
  const defaultBudgetPrompt = `Analyze this email from a client responding to a partnership/advertising proposal.

Is the client declining or rejecting the proposal specifically because of BUDGET constraints, limited funds, or cost issues, WITHOUT offering an alternative budget amount?

Examples of budget rejections: "budget constraints", "unable to move forward", "limited budget", "we don't have the budget", "não temos verba", "pas de budget pour le moment", "limited creator slots for this campaign".

This does NOT include: rejections for timing, fit, relevance, or other non-financial reasons.

Latest client email:
{emailContent}

Conversation history for context:
{emailHistory}`;

  const prompt = await getPrompt("4", defaultBudgetPrompt, {
    emailContent: emailContent.substring(0, 3000),
    emailHistory: emailHistory.substring(0, 5000),
  });

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You analyze client emails to detect budget-related rejections. Always respond using the tool provided.' },
        { role: 'user', content: prompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'detect_budget_rejection',
          description: 'Determine if the client is rejecting due to budget constraints',
          parameters: {
            type: 'object',
            properties: {
              is_budget_rejection: { type: 'boolean', description: 'True if the client is declining specifically due to budget/cost without offering an alternative amount' },
            },
            required: ['is_budget_rejection'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'detect_budget_rejection' } },
    }),
  });

  if (!resp.ok) {
    console.error('Budget rejection analysis failed:', resp.status);
    return false;
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.log('No tool call returned for budget rejection, defaulting to false');
    return false;
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log('Budget rejection analysis result:', result.is_budget_rejection);
  return result.is_budget_rejection === true;
}

// --- Generate rejection counter-reply ---
async function generateRejectionReply(
  lead: any, emailHistory: string, LOVABLE_API_KEY: string
): Promise<{ subject: string; body: string }> {
  console.log('Generating rejection counter-reply for lead:', lead.name);

  const defaultRejectionPrompt = `You are ${SUSAN_NAME}, executive assistant to ${COMPANY_NAME}, a content creator and AI keynote speaker.

A client has just declined a partnership proposal citing budget constraints. You need to write a persuasive counter-reply.

CRITICAL LANGUAGE RULE: Analyze the ENTIRE email history below. Identify the language the CLIENT uses in their messages. Write your ENTIRE reply in that SAME language. Do NOT write in a different language than the client.

INSTRUCTIONS:
- Write as Susan, Miguel's assistant, in first person
- Say that Miguel genuinely loved their product and wants to bring it to his audience
- Express confidence that this partnership would be a success for both sides
- Ask: what budget DO they have available to make this first partnership viable?
- Say you want to bring a tailored proposal to Miguel so you can make this happen
- Be persuasive but respectful - not aggressive
- Maximum 8-10 lines for the body
- DO NOT include any signature, it will be added automatically
- DO NOT include "Subject:" or "Assunto:" prefix

Lead name: {leadName}

Full email history (use this to determine the client's language):
{emailHistory}

Return ONLY in this format:
Subject: [subject line in the client's language]

[body - just the new message, no signature]`;

  const prompt = await getPrompt("5", defaultRejectionPrompt, {
    leadName: lead.name,
    emailHistory,
  });

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: `You are ${SUSAN_NAME} writing professional emails. You MUST write in the same language the client uses in the conversation history.` },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Rejection reply generation failed:', resp.status, errText);
    throw new Error(`Rejection reply generation failed: ${resp.status}`);
  }

  const data = await resp.json();
  const generatedEmail = data.choices[0].message.content;

  const lines = generatedEmail.split('\n');
  let subject = '';
  let body = '';

  if (lines[0].toLowerCase().startsWith('assunto:') || lines[0].toLowerCase().startsWith('subject:')) {
    subject = lines[0].replace(/^(Assunto|Subject):\s*/i, '').trim();
    body = lines.slice(2).join('\n').trim();
  } else {
    subject = `Re: ${lead.name}`;
    body = generatedEmail.trim();
  }

  return { subject, body };
}

// --- Generate and send proposal (reusable for new and existing leads) ---
interface ProposalParams {
  supabase: any;
  resendApiKey: string;
  LOVABLE_API_KEY: string;
  leadId: string | null; // null = create new lead
  clientEmails: string[];
  emailSubject: string;
  emailText: string;
  emailHtml: string;
  fromRaw: string;
  toAddresses: string[];
  ccAddresses: string[];
  data: any; // original payload for threading
}

async function generateAndSendProposal(params: ProposalParams): Promise<{
  success: boolean;
  lead_id: string;
  lead_name: string;
  email_sent: boolean;
}> {
  const {
    supabase, resendApiKey, LOVABLE_API_KEY, leadId,
    clientEmails, emailSubject, emailText, emailHtml,
    fromRaw, toAddresses, ccAddresses, data,
  } = params;

  const emailContent = emailText || emailHtml;

  // 1. Extract client info via AI
  const defaultExtractionPrompt = `Analyze the following email thread. This is an email forwarded by Miguel Fernandes to his assistant Susan.
Miguel is forwarding a client's email asking Susan to generate a proposal.

From: {from}
To: {to}
CC: {cc}
Subject: {subject}

Email content:
{emailContent}

Extract the following information:
1. The client's first name (just the first name, e.g. "John" not "John Smith") - this is the person who originally sent the email to Miguel, NOT Miguel Fernandes himself. Look for names in the email signature, greeting, or CC field. If the body is empty, try to find the name from the CC email address or Subject.
2. The client's full name for formal records. If you cannot determine a real name, use the company name or a clean version of the email handle (e.g. "parcerias@company.com" -> use the company name).
3. The company/organization name if mentioned (check email domain, subject, or body)
4. What the client is requesting (the scope/details of what they want - infer from subject if body is empty)
5. The predominant language of the email thread, considering the subject line and the overall conversation context`;

  const extractionPrompt = await getPrompt("6", defaultExtractionPrompt, {
    from: fromRaw,
    to: toAddresses.join(', '),
    cc: ccAddresses.join(', '),
    subject: emailSubject,
    emailContent: emailContent.substring(0, 5000) || '(empty body)',
  });

  console.log('Calling AI for extraction...');
  const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You extract structured information from emails. Always respond using the tool provided.' },
        { role: 'user', content: extractionPrompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'extract_client_info',
          description: 'Extract client information from the email',
          parameters: {
            type: 'object',
            properties: {
              client_name: { type: 'string', description: 'Full name of the client/contact person for records' },
              client_first_name: { type: 'string', description: 'Just the first name of the client, e.g. "John"' },
              company_name: { type: 'string', description: 'Company or organization name, or empty if not found' },
              scope: { type: 'string', description: 'What the client is requesting' },
              language: { type: 'string', description: 'The language the client wrote in, e.g. English, Portuguese, Spanish' },
            },
            required: ['client_name', 'client_first_name', 'company_name', 'scope', 'language'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'extract_client_info' } },
    }),
  });

  if (!extractResponse.ok) {
    const errText = await extractResponse.text();
    console.error('AI extraction error:', extractResponse.status, errText);
    throw new Error(`AI extraction failed: ${extractResponse.status}`);
  }

  const extractData = await extractResponse.json();
  const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('AI did not return tool call for extraction');

  const clientInfo = JSON.parse(toolCall.function.arguments);
  console.log('Extracted client info:', JSON.stringify(clientInfo));

  const clientName = clientInfo.client_name || 'Client';
  const clientFirstName = clientInfo.client_first_name || clientName.split(' ')[0] || 'Client';
  const companyName = clientInfo.company_name || '';
  const scope = clientInfo.scope || '';
  const clientLanguage = clientInfo.language || 'English';

  const leadName = companyName ? `${clientName} - ${companyName}` : clientName;

  // 2. Create lead if needed
  let finalLeadId = leadId;
  let finalLeadName = leadName;

  if (!finalLeadId) {
    console.log('Creating lead:', leadName);
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: leadName,
        emails: clientEmails,
        email: clientEmails[0],
        valor: PROPOSAL_VALUE,
        moeda: PROPOSAL_CURRENCY,
        status: 'em_aberto',
        origem: 'email',
        source: 'susan-webhook',
        description: `${companyName ? companyName + ' - ' : ''}${scope}`,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error creating lead:', leadError);
      throw new Error(`Failed to create lead: ${leadError.message}`);
    }

    finalLeadId = lead.id;
    console.log('Lead created:', finalLeadId);

    // Save inbound email for new leads
    await saveInboundEmail(supabase, finalLeadId, emailSubject, emailText, emailHtml, data.created_at || new Date().toISOString());
  }

  // 3. Generate proposal email
  const emailDate = data.created_at ? new Date(data.created_at) : new Date();
  const deadline = addBusinessDays(emailDate, 2);
  const deadlineFormatted = formatDate(deadline, clientLanguage);

  const isPortuguese = clientLanguage.toLowerCase().includes('portug');
  const langInstruction = isPortuguese
    ? 'Escreva TODO o email em portugues brasileiro.'
    : `Escreva o email em ${clientLanguage}.`;

  const defaultProposalPrompt = `Voce e Susan, assistente executiva de Miguel Fernandes, palestrante e especialista em IA.

Escreva um email para o cliente enviando a proposta de parceria.

DADOS:
- Nome do cliente (usar para cumprimentar): {clientFirstName}
- Empresa: {companyName}
- Escopo solicitado: {scope}
- Valor: US$ 3.000 (tres mil dolares)
- Prazo para resposta: {deadline}

REGRAS:
1. {langInstruction}
2. Cumprimente o cliente pelo primeiro nome: "{clientFirstName}"
3. Diga que Miguel ADOROU o produto/projeto e viu muito fit com o publico dele
4. Diga que Miguel quer muito viabilizar essa parceria
5. Apresente o valor de US$ 3.000 (tres mil dolares) para o escopo solicitado. NAO escreva "dolares americanos", apenas "dolares"
6. Pergunte como podemos fazer para viabilizar, estimulando o cliente a propor algo mesmo que o valor pareca alto
7. Peca resposta ate {deadline} pois a agenda de gravacoes esta apertada
8. Assine como "Susan" - Assistente Executiva de Miguel Fernandes
9. NAO inclua prefixo "Subject:" ou "Assunto:" - apenas o corpo
10. Seja profissional, objetiva e persuasiva - maximo 10 linhas no corpo
11. REGRA DO MEDIA KIT: SOMENTE inclua o link https://inventormiguel.link/kit se o cliente EXPLICITAMENTE pediu Media Kit, press kit, kit de midia, tabela de precos, numeros do Miguel, portfolio, ou informacoes sobre o alcance do Miguel nas mensagens dele. Se o cliente NAO pediu explicitamente essas informacoes, NAO inclua este link de forma alguma.

Formato:
Subject: [assunto]

[corpo]`;

  const proposalPrompt = await getPrompt("7", defaultProposalPrompt, {
    clientFirstName,
    companyName: companyName || 'nao especificada',
    scope,
    deadline: deadlineFormatted,
    langInstruction,
  });

  console.log('Generating proposal email...');
  const proposalResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: `Voce e Susan, assistente executiva de Miguel Fernandes. Escreva emails curtos e objetivos. ${langInstruction}` },
        { role: 'user', content: proposalPrompt },
      ],
    }),
  });

  if (!proposalResponse.ok) {
    const errText = await proposalResponse.text();
    console.error('AI proposal error:', proposalResponse.status, errText);
    throw new Error(`AI proposal generation failed: ${proposalResponse.status}`);
  }

  const proposalData = await proposalResponse.json();
  const generatedEmail = proposalData.choices[0].message.content;

  // Parse subject and body
  const lines = generatedEmail.split('\n');
  let emailBody = '';

  if (lines[0].toLowerCase().startsWith('assunto:') || lines[0].toLowerCase().startsWith('subject:')) {
    emailBody = lines.slice(2).join('\n').trim();
  } else {
    emailBody = generatedEmail.trim();
  }

  // Build reply subject
  const replySubject = emailSubject.toLowerCase().startsWith('re:')
    ? emailSubject
    : `Re: ${emailSubject}`;

  // Build quoted thread from ALL emails of this lead (not just the original)
  let emailThreadHtml = '';
  if (finalLeadId) {
    const { data: allLeadEmails } = await supabase
      .from('email_messages')
      .select('*')
      .eq('lead_id', finalLeadId)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (allLeadEmails && allLeadEmails.length > 0) {
      emailThreadHtml = allLeadEmails.map((e: any) => {
        const from = e.direction === 'inbound' ? (clientName || 'Client') : SUSAN_NAME;
        const date = new Date(e.timestamp).toLocaleString();
        const subj = e.subject ? `<strong>Subject:</strong> ${e.subject}<br>` : '';
        const content = (e.html_body || e.message || '').replace(/\n/g, '<br>');
        return `<div style="margin-top: 20px; padding-left: 10px; border-left: 3px solid #ccc;">
          <p style="color: #666; font-size: 0.9em; margin-bottom: 5px;">On ${date}, ${from} wrote:</p>
          ${subj}<div>${content}</div>
        </div>`;
      }).join('');
    }
  }

  // Fallback: if no thread from DB, quote the original email
  if (!emailThreadHtml) {
    const originalDate = data.created_at ? new Date(data.created_at).toLocaleString() : '';
    const quotedOriginal = emailHtml
      ? emailHtml
      : `<pre style="white-space: pre-wrap;">${emailText}</pre>`;
    emailThreadHtml = `<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-top: 16px; color: #555;">
      <p style="font-size: 12px; color: #999;">On ${originalDate}, ${fromRaw} wrote:</p>
      ${quotedOriginal}
    </div>`;
  }

  const emailBodyHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
${emailBody.replace(/\n/g, '<br>')}
</div>
<br>
${emailThreadHtml}`;

  // 4. Send via Resend
  console.log('Sending proposal email via Resend to:', clientEmails);
  const replyHeaders: Record<string, string> = {};
  const messageId = data.message_id || data.messageId;

  // Build complete References chain from all resend_message_ids
  if (finalLeadId) {
    const { data: allMsgIds } = await supabase
      .from('email_messages')
      .select('resend_message_id')
      .eq('lead_id', finalLeadId)
      .not('resend_message_id', 'is', null)
      .order('timestamp', { ascending: true });

    const ids = (allMsgIds || []).map((e: any) => e.resend_message_id).filter(Boolean);
    if (messageId) ids.push(messageId);
    
    if (ids.length > 0) {
      replyHeaders['In-Reply-To'] = ids[ids.length - 1];
      replyHeaders['References'] = ids.join(' ');
    }
  } else if (messageId) {
    replyHeaders['In-Reply-To'] = messageId;
    replyHeaders['References'] = messageId;
  }

  const sendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${SUSAN_NAME} - ${COMPANY_NAME} <${SUSAN_EMAIL}>`,
      to: clientEmails,
      cc: [COMPANY_EMAIL],
      subject: replySubject,
      html: emailBodyHtml,
      ...(Object.keys(replyHeaders).length > 0 && { headers: replyHeaders }),
    }),
  });

  if (!sendResponse.ok) {
    const sendErr = await sendResponse.text();
    console.error('Resend send error:', sendResponse.status, sendErr);
    throw new Error(`Failed to send email: ${sendErr}`);
  }

  const sendData = await sendResponse.json();
  console.log('✅ Proposal email sent:', sendData);

  // 5. Save outbound email with resend_message_id
  const proposalResendMessageId = sendData.id || null;
  const { error: saveOutboundError } = await supabase
    .from('email_messages')
    .insert({
      lead_id: finalLeadId,
      direction: 'outbound',
      subject: replySubject,
      message: emailBody,
      html_body: emailBodyHtml,
      timestamp: new Date().toISOString(),
      resend_message_id: proposalResendMessageId,
    });

  if (saveOutboundError) {
    console.error('Error saving outbound email:', saveOutboundError);
  } else {
    console.log('✅ Outbound email saved');
  }

  return {
    success: true,
    lead_id: finalLeadId!,
    lead_name: finalLeadName,
    email_sent: true,
  };
}



function stripHtmlSimple(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// === MAIN HANDLER ===
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Load dynamic settings
    const settings = await getSettings(['susan_name', 'susan_email', 'company_name', 'company_email']);
    SUSAN_NAME = settings.susan_name;
    SUSAN_EMAIL = settings.susan_email;
    COMPANY_NAME = settings.company_name;
    COMPANY_EMAIL = settings.company_email;

    const payload = await req.json();
    console.log('=== RESEND INBOUND WEBHOOK ===');
    console.log(`Sender identity: ${SUSAN_NAME} <${SUSAN_EMAIL}>`);
    console.log('Event type:', payload.type);

    if (payload.type !== 'email.received') {
      console.log('Ignoring event type:', payload.type);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = payload.data;

    console.log('Raw From:', JSON.stringify(data.from));
    console.log('Raw To:', JSON.stringify(data.to));
    console.log('Raw CC:', JSON.stringify(data.cc));

    const toAddresses: string[] = (data.to || []).map((e: string) => e.toLowerCase());
    const ccAddresses: string[] = (data.cc || []).map((e: string) => e.toLowerCase());
    const fromRaw: string = data.from || '';
    const allRecipients = [...toAddresses, ...ccAddresses];

    // 1. Check if email is for Susan
    const isSusanEmail = allRecipients.some(addr => addr.includes(SUSAN_EMAIL));
    if (!isSusanEmail) {
      console.log('Email not addressed to Susan, ignoring.');
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'not_for_susan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Initialize Supabase and keys
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // 3. Get email content
    let emailText = data.text || data.body || '';
    let emailHtml = data.html || '';
    const emailId = data.email_id;

    if (emailId && (!emailText && !emailHtml)) {
      const fetched = await fetchEmailContent(emailId, resendApiKey);
      emailText = fetched.text;
      emailHtml = fetched.html;
    }

    const emailSubject = data.subject || '';
    const emailTimestamp = data.created_at || new Date().toISOString();

    console.log('Subject:', emailSubject);
    console.log('Email text length:', emailText.length, 'HTML length:', emailHtml.length);

    // 4. Determine if from Miguel
    const fromEmailClean = extractCleanEmail(fromRaw);
    const isFromMiguel = MIGUEL_EMAILS.some(me => fromEmailClean.includes(me));



    if (!isFromMiguel) {
      // === FLOW: Email from client (not Miguel) ===
      console.log('Email from external sender:', fromEmailClean);
      const existingLead = await findExistingLead(supabase, [fromEmailClean]);

      if (!existingLead) {
        console.log('No existing lead found for sender, ignoring.');
        return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'no_lead_for_sender' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const savedEmailId = await saveInboundEmail(supabase, existingLead.id, emailSubject, emailText, emailHtml, emailTimestamp);

      // Process attachments if email has an email_id from Resend
      if (emailId) {
        await processEmailAttachments(supabase, resendApiKey, emailId, existingLead.id, savedEmailId);
      }

      // Associate CC emails to lead
      const externalCCEmails = allRecipients.map(addr => extractCleanEmail(addr));
      await associateCCEmailsToLeadSafe(supabase, existingLead.id, [fromEmailClean, ...externalCCEmails], existingLead.emails || []);

      // Analyze if this is a budget rejection and auto-reply
      try {
        const emailContent = emailText || emailHtml || '';
        
        // Fetch full email history for this lead
        const { data: allEmails, error: historyError } = await supabase
          .from('email_messages')
          .select('*')
          .eq('lead_id', existingLead.id)
          .order('timestamp', { ascending: true });

        if (historyError) {
          console.error('Error fetching email history:', historyError);
        }

        const emails = allEmails || [];
        const emailHistoryText = emails.map((e: any) => {
          const dir = e.direction === 'inbound' ? 'Client' : 'Susan';
          const content = (e.message || e.html_body || '').substring(0, 2000);
          return `[${dir} - ${new Date(e.timestamp).toLocaleString()}]\n${e.subject ? 'Subject: ' + e.subject + '\n' : ''}${content}`;
        }).join('\n\n---\n\n');

        const isBudgetRejection = await analyzeBudgetRejection(emailContent, emailHistoryText, LOVABLE_API_KEY!);

        if (isBudgetRejection) {
          console.log('Budget rejection detected! Generating counter-reply...');
          
          const { subject, body } = await generateRejectionReply(existingLead, emailHistoryText, LOVABLE_API_KEY!);

          // Build HTML with signature and thread
          const bodyHtml = body.replace(/\n/g, '<br>');
          const emailThread = emails
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((e: any) => {
              const from = e.direction === 'inbound' ? existingLead.name : SUSAN_NAME;
              const date = new Date(e.timestamp).toLocaleString();
              const subj = e.subject ? `<strong>Subject:</strong> ${e.subject}<br>` : '';
              const content = (e.html_body || e.message || '').replace(/\n/g, '<br>');
              return `<div style="margin-top: 20px; padding-left: 10px; border-left: 3px solid #ccc;">
                <p style="color: #666; font-size: 0.9em; margin-bottom: 5px;">On ${date}, ${from} wrote:</p>
                ${subj}<div>${content}</div>
              </div>`;
            }).join('');

          const fullBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
            ${bodyHtml}
            <br><br>
            <p style="color: #666; font-size: 12px;">—<br>${SUSAN_NAME}<br>Executive Assistant to ${COMPANY_NAME}<br>${SUSAN_EMAIL}</p>
            ${emailThread}
          </div>`;

          // Get recipient emails
          const recipientEmails = existingLead.emails && existingLead.emails.length > 0
            ? existingLead.emails
            : [existingLead.email];
          const uniqueRecipients = Array.from(new Set(recipientEmails.filter(Boolean))) as string[];

          // Build reply subject
          const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${emailSubject || subject}`;

          // Threading headers - build complete References chain
          const replyHeaders: Record<string, string> = {};
          const messageId = data.message_id || data.messageId;
          
          const allMsgIds = emails
            .map((e: any) => e.resend_message_id)
            .filter(Boolean);
          if (messageId) allMsgIds.push(messageId);
          
          if (allMsgIds.length > 0) {
            replyHeaders['In-Reply-To'] = allMsgIds[allMsgIds.length - 1];
            replyHeaders['References'] = allMsgIds.join(' ');
          }

          // Send via Resend
          const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
          const sendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${SUSAN_NAME} - ${COMPANY_NAME} <${SUSAN_EMAIL}>`,
              to: uniqueRecipients,
              cc: [COMPANY_EMAIL],
              subject: replySubject,
              html: fullBody,
              ...(Object.keys(replyHeaders).length > 0 && { headers: replyHeaders }),
            }),
          });

          if (!sendResponse.ok) {
            const sendErr = await sendResponse.text();
            console.error('Error sending rejection reply:', sendErr);
          } else {
            const sendData = await sendResponse.json();
            console.log('✅ Rejection counter-reply sent:', sendData);

            // Save outbound email with resend_message_id
            const rejectionResendMsgId = sendData.id || null;
            await supabase
              .from('email_messages')
              .insert({
                lead_id: existingLead.id,
                direction: 'outbound',
                subject: replySubject,
                message: body,
                html_body: fullBody,
                timestamp: new Date().toISOString(),
                resend_message_id: rejectionResendMsgId,
              });
            console.log('✅ Outbound rejection reply saved');
          }

          return new Response(
            JSON.stringify({ success: true, associated: true, lead_id: existingLead.id, lead_name: existingLead.name, rejection_reply_sent: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (rejectionError) {
        console.error('Error in rejection analysis (non-fatal):', rejectionError);
      }

      // Analyze if this is a Media Kit / demographics request and auto-reply
      try {
        const mediaKitEmailContent = emailText || emailHtml || '';

        // Reuse email history if available, otherwise fetch
        let mediaKitEmailHistory = '';
        const { data: mkEmails, error: mkHistoryError } = await supabase
          .from('email_messages')
          .select('*')
          .eq('lead_id', existingLead.id)
          .order('timestamp', { ascending: true });

        if (mkHistoryError) {
          console.error('Error fetching email history for Media Kit analysis:', mkHistoryError);
        }

        const mkEmailsList = mkEmails || [];
        mediaKitEmailHistory = mkEmailsList.map((e: any) => {
          const dir = e.direction === 'inbound' ? 'Client' : 'Susan';
          const content = (e.message || e.html_body || '').substring(0, 2000);
          return `[${dir} - ${new Date(e.timestamp).toLocaleString()}]\n${e.subject ? 'Subject: ' + e.subject + '\n' : ''}${content}`;
        }).join('\n\n---\n\n');

        const isMediaKitRequest = await analyzeMediaKitRequest(mediaKitEmailContent, mediaKitEmailHistory, LOVABLE_API_KEY!);

        if (isMediaKitRequest) {
          console.log('Media Kit request detected! Generating reply with link...');

          // Fetch media_kit_link from settings
          const mkSettings = await getSettings(['media_kit_link']);
          const mediaKitLink = mkSettings.media_kit_link || 'https://inventormiguel.link/kit';

          const { subject, body } = await generateMediaKitReply(existingLead, mediaKitEmailHistory, mediaKitLink, LOVABLE_API_KEY!);

          // Build HTML with signature and thread
          const bodyHtml = body.replace(/\n/g, '<br>');
          const emailThread = mkEmailsList
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((e: any) => {
              const from = e.direction === 'inbound' ? existingLead.name : SUSAN_NAME;
              const date = new Date(e.timestamp).toLocaleString();
              const subj = e.subject ? `<strong>Subject:</strong> ${e.subject}<br>` : '';
              const content = (e.html_body || e.message || '').replace(/\n/g, '<br>');
              return `<div style="margin-top: 20px; padding-left: 10px; border-left: 3px solid #ccc;">
                <p style="color: #666; font-size: 0.9em; margin-bottom: 5px;">On ${date}, ${from} wrote:</p>
                ${subj}<div>${content}</div>
              </div>`;
            }).join('');

          const fullBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
            ${bodyHtml}
            <br><br>
            <p style="color: #666; font-size: 12px;">—<br>${SUSAN_NAME}<br>Executive Assistant to ${COMPANY_NAME}<br>${SUSAN_EMAIL}</p>
            ${emailThread}
          </div>`;

          // Get recipient emails
          const recipientEmails = existingLead.emails && existingLead.emails.length > 0
            ? existingLead.emails
            : [existingLead.email];
          const uniqueRecipients = Array.from(new Set(recipientEmails.filter(Boolean))) as string[];

          // Build reply subject
          const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${emailSubject || subject}`;

          // Threading headers
          const replyHeaders: Record<string, string> = {};
          const messageId = data.message_id || data.messageId;
          
          const allMsgIds = mkEmailsList
            .map((e: any) => e.resend_message_id)
            .filter(Boolean);
          if (messageId) allMsgIds.push(messageId);
          
          if (allMsgIds.length > 0) {
            replyHeaders['In-Reply-To'] = allMsgIds[allMsgIds.length - 1];
            replyHeaders['References'] = allMsgIds.join(' ');
          }

          // Send via Resend
          const mkResendApiKey = Deno.env.get('RESEND_API_KEY')!;
          const sendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mkResendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${SUSAN_NAME} - ${COMPANY_NAME} <${SUSAN_EMAIL}>`,
              to: uniqueRecipients,
              cc: [COMPANY_EMAIL],
              subject: replySubject,
              html: fullBody,
              ...(Object.keys(replyHeaders).length > 0 && { headers: replyHeaders }),
            }),
          });

          if (!sendResponse.ok) {
            const sendErr = await sendResponse.text();
            console.error('Error sending Media Kit reply:', sendErr);
          } else {
            const sendData = await sendResponse.json();
            console.log('✅ Media Kit reply sent:', sendData);

            // Save outbound email with resend_message_id
            const mkResendMsgId = sendData.id || null;
            await supabase
              .from('email_messages')
              .insert({
                lead_id: existingLead.id,
                direction: 'outbound',
                subject: replySubject,
                message: body,
                html_body: fullBody,
                timestamp: new Date().toISOString(),
                resend_message_id: mkResendMsgId,
              });
            console.log('✅ Outbound Media Kit reply saved');
          }

          return new Response(
            JSON.stringify({ success: true, associated: true, lead_id: existingLead.id, lead_name: existingLead.name, media_kit_reply_sent: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (mediaKitError) {
        console.error('Error in Media Kit analysis (non-fatal):', mediaKitError);
      }

      return new Response(
        JSON.stringify({ success: true, associated: true, lead_id: existingLead.id, lead_name: existingLead.name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === FLOW: Email from Miguel ===
    console.log('Email from Miguel, extracting client emails...');

    const clientEmails = allRecipients.filter(addr => {
      const clean = addr.replace(/<|>/g, '').trim().toLowerCase();
      return !IGNORED_EMAILS.some(ignored => clean.includes(ignored));
    }).map(addr => extractCleanEmail(addr));

    // Fallback: extract emails from body
    if (clientEmails.length === 0) {
      const bodyToScan = emailText || emailHtml || '';
      const bodyEmails = bodyToScan.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
      const uniqueBodyEmails = [...new Set(bodyEmails.map((e: string) => e.toLowerCase()))];
      for (const be of uniqueBodyEmails) {
        if (!IGNORED_EMAILS.some(ig => be.includes(ig))) {
          clientEmails.push(be);
        }
      }
      if (clientEmails.length > 0) {
        console.log('Client emails extracted from body:', clientEmails);
      }
    }

    console.log('Client emails found:', clientEmails);

    if (clientEmails.length === 0) {
      console.log('No client emails found, ignoring.');
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'no_client_emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Check if lead already exists
    const existingLead = await findExistingLead(supabase, clientEmails);

    if (existingLead) {
      // Lead exists — save email first
      console.log('Lead already exists, saving email and analyzing intent...');
      const savedEmailId = await saveOutboundEmail(supabase, existingLead.id, emailSubject, emailText, emailHtml, emailTimestamp);

      // Process attachments if email has an email_id from Resend
      if (emailId) {
        await processEmailAttachments(supabase, resendApiKey, emailId, existingLead.id, savedEmailId);
      }

      // Associate CC emails to lead
      await associateCCEmailsToLeadSafe(supabase, existingLead.id, clientEmails, existingLead.emails || []);

      // Analyze if Miguel wants to send a proposal
      const emailContent = emailText || emailHtml || '';
      const shouldSend = await analyzeIntent(emailContent, emailSubject, LOVABLE_API_KEY);

      if (!shouldSend) {
        console.log('Intent: NO proposal requested. Only saved email.');
        return new Response(
          JSON.stringify({ success: true, associated: true, lead_id: existingLead.id, lead_name: existingLead.name, email_sent: false, intent: 'no_proposal' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Intent: send proposal for existing lead
      console.log('Intent: PROPOSAL requested for existing lead!');
      const proposalResult = await generateAndSendProposal({
        supabase, resendApiKey, LOVABLE_API_KEY,
        leadId: existingLead.id,
        clientEmails: existingLead.emails || clientEmails,
        emailSubject, emailText, emailHtml,
        fromRaw, toAddresses, ccAddresses, data,
      });

      return new Response(
        JSON.stringify({ ...proposalResult, intent: 'proposal_sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Lead does NOT exist — create lead + send proposal
    console.log('No existing lead found, creating lead and sending proposal...');
    const proposalResult = await generateAndSendProposal({
      supabase, resendApiKey, LOVABLE_API_KEY,
      leadId: null,
      clientEmails, emailSubject, emailText, emailHtml,
      fromRaw, toAddresses, ccAddresses, data,
    });

    return new Response(
      JSON.stringify({ ...proposalResult, client_emails: clientEmails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in resend-inbound-webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

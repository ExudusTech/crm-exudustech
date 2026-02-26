import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPrompt } from "../_shared/get-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "leadId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead info
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("name, description, produto")
      .eq("id", leadId)
      .single();

    if (leadError) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead notes
    const { data: leadNotes, error: notesError } = await supabase
      .from("lead_notes")
      .select("note, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (notesError) {
      console.error("Error fetching lead notes:", notesError);
    }

    // Fetch WhatsApp messages
    const { data: whatsappMessages, error: whatsappError } = await supabase
      .from("whatsapp_messages")
      .select("message, direction, timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });

    if (whatsappError) {
      console.error("Error fetching WhatsApp messages:", whatsappError);
    }

    // Fetch email messages
    const { data: emailMessages, error: emailError } = await supabase
      .from("email_messages")
      .select("message, subject, direction, timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });

    if (emailError) {
      console.error("Error fetching email messages:", emailError);
    }

    // Build conversation history
    let conversationText = `Cliente: ${lead.name}\n`;
    if (lead.description) {
      conversationText += `Descrição do lead: ${lead.description}\n`;
    }

    // Add lead notes (especially important for import text with event details)
    if (leadNotes && leadNotes.length > 0) {
      conversationText += "\n--- NOTAS DO LEAD ---\n";
      for (const note of leadNotes) {
        conversationText += `${note.note}\n\n`;
      }
    }

    conversationText += "\n--- HISTÓRICO DE CONVERSAS ---\n\n";

    // Add WhatsApp messages
    if (whatsappMessages && whatsappMessages.length > 0) {
      conversationText += "=== MENSAGENS WHATSAPP ===\n";
      for (const msg of whatsappMessages) {
        const sender = msg.direction === "inbound" ? lead.name : "Eu";
        conversationText += `[${sender}]: ${msg.message || "(sem texto)"}\n`;
      }
      conversationText += "\n";
    }

    // Add email messages
    if (emailMessages && emailMessages.length > 0) {
      conversationText += "=== EMAILS ===\n";
      for (const email of emailMessages) {
        const sender = email.direction === "inbound" ? lead.name : "Eu";
        conversationText += `[${sender}] Assunto: ${email.subject || "(sem assunto)"}\n`;
        conversationText += `${email.message || "(sem conteúdo)"}\n\n`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI to extract event details and generate agenda
    const defaultSystemPrompt = `Você é um assistente especializado em extrair informações de conversas sobre palestras e eventos corporativos.

Analise o histórico de conversas fornecido e extraia:

1. DETALHES DO EVENTO (para o slide de capa da proposta):
   - Nome da empresa cliente
   - Título da palestra (geralmente é "O Futuro da Inteligência" ou similar, extraia do contexto)
   - Público-alvo (executivos, líderes, etc)
   - Local da palestra (cidade, estado, nome do local/venue se mencionado. Se for online/remoto, coloque "Remoto". Se não houver informação, coloque "A definir")
   - Data do evento (se não houver data específica, coloque "A confirmar")
   - Horário (se não houver horário específico, coloque "A combinar")
   - Duração (se não mencionada, use "1h30min")

2. AGENDA DA PALESTRA (tópicos a serem abordados):
   Baseado no tema e contexto da conversa, sugira 5-7 tópicos relevantes para a palestra, adaptados ao perfil do cliente.

Responda APENAS em formato JSON válido com esta estrutura:
{
  "eventDetails": {
    "companyName": "nome da empresa",
    "lectureTitle": "título da palestra (ex: O Futuro da Inteligência)",
    "audience": "perfil do público-alvo",
    "location": "local da palestra (cidade/estado ou Remoto ou A definir)",
    "date": "data do evento ou A confirmar",
    "time": "horário ou A combinar", 
    "duration": "duração ou 1h30min"
  },
  "suggestedTopics": [
    "Tópico 1",
    "Tópico 2"
  ]
}`;

    const systemPrompt = await getPrompt("12", defaultSystemPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: conversationText },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", aiContent);

    // Parse AI response
    let parsedContent;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, aiContent];
      const jsonStr = jsonMatch[1] || aiContent;
      parsedContent = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Return default content if parsing fails
      parsedContent = {
        eventDetails: {
          companyName: lead.name,
          lectureTitle: "O Futuro da Inteligência",
          audience: "Executivos e líderes",
          location: "A definir",
          date: "A confirmar",
          time: "A combinar",
          duration: "1h30min",
        },
        suggestedTopics: [
          "Introdução à Inteligência Artificial e seu impacto no mundo corporativo",
          "Casos práticos de aplicação de IA em diferentes setores",
          "Demonstrações ao vivo de ferramentas de IA generativa",
          "Como implementar IA de forma estratégica na sua empresa",
          "Tendências e o futuro da IA nos próximos anos",
          "Sessão de perguntas e respostas",
        ],
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        leadName: lead.name,
        eventDetails: parsedContent.eventDetails,
        suggestedTopics: parsedContent.suggestedTopics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-proposal-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getValidToken(supabase: any, userId: string): Promise<{ token: string; connectionId: string } | null> {
  const { data: conn } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) return null;

  // Check if token is expired (with 5min buffer)
  const expiresAt = new Date(conn.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000 && conn.refresh_token) {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.error) {
      const newExpires = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
      await supabase.from("google_connections").update({
        access_token: tokenData.access_token,
        token_expires_at: newExpires,
        updated_at: new Date().toISOString(),
      }).eq("id", conn.id);
      return { token: tokenData.access_token, connectionId: conn.id };
    }
  }

  return { token: conn.access_token, connectionId: conn.id };
}

async function logSync(supabase: any, connectionId: string, service: string, action: string, details: string, status = "success", initiativeId?: string) {
  await supabase.from("google_sync_logs").insert({
    connection_id: connectionId,
    service,
    action,
    details,
    status,
    initiative_id: initiativeId || null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { service, action, params, user_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const auth = await getValidToken(supabase, user_id);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Google não conectado. Conecte sua conta Google nas Configurações." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, connectionId } = auth;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // ===== GOOGLE CALENDAR =====
    if (service === "calendar") {
      if (action === "list_events") {
        const { timeMin, timeMax, maxResults = 50 } = params || {};
        const now = new Date().toISOString();
        const effectiveTimeMin = timeMin || now;

        // First, list all calendars the user has access to
        const calListRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers });
        const calListData = await calListRes.json();
        const calendars = calListData.items || [];
        console.log(`[google-api] Found ${calendars.length} calendars:`, calendars.map((c: any) => `${c.summary} (${c.id})`));

        // Query events from all calendars in parallel
        const allEvents: any[] = [];
        const calendarFetches = calendars.map(async (cal: any) => {
          let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
            `timeMin=${effectiveTimeMin}&maxResults=${maxResults}` +
            `&singleEvents=true&orderBy=startTime&timeZone=America/Sao_Paulo`;
          if (timeMax) url += `&timeMax=${timeMax}`;

          try {
            const res = await fetch(url, { headers });
            const data = await res.json();
            const items = (data.items || []).map((ev: any) => ({
              ...ev,
              calendarName: cal.summary || cal.id,
            }));
            console.log(`[google-api] Calendar "${cal.summary}": ${items.length} events`);
            return items;
          } catch (e: any) {
            console.error(`[google-api] Error fetching calendar ${cal.id}:`, e.message);
            return [];
          }
        });

        const results = await Promise.all(calendarFetches);
        for (const items of results) allEvents.push(...items);

        // Sort by start time
        allEvents.sort((a, b) => {
          const aStart = a.start?.dateTime || a.start?.date || "";
          const bStart = b.start?.dateTime || b.start?.date || "";
          return aStart.localeCompare(bStart);
        });

        await logSync(supabase, connectionId, "calendar", "list_events", `Listou ${allEvents.length} eventos de ${calendars.length} calendários`);
        await supabase.from("google_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connectionId);

        console.log(`[google-api] Total events returned: ${allEvents.length}`);

        return new Response(JSON.stringify({ events: allEvents }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "create_event") {
        const { summary, description, start, end, location, attendees } = params;
        const eventBody: any = {
          summary,
          description,
          start: { dateTime: start, timeZone: "America/Sao_Paulo" },
          end: { dateTime: end, timeZone: "America/Sao_Paulo" },
        };
        if (location) eventBody.location = location;
        if (attendees) eventBody.attendees = attendees.map((e: string) => ({ email: e }));

        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers, body: JSON.stringify(eventBody),
        });
        const data = await res.json();
        await logSync(supabase, connectionId, "calendar", "create_event", `Criou evento "${summary}"`);

        return new Response(JSON.stringify({ event: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "update_event") {
        const { eventId, ...updates } = params;
        if (updates.start) updates.start = { dateTime: updates.start, timeZone: "America/Sao_Paulo" };
        if (updates.end) updates.end = { dateTime: updates.end, timeZone: "America/Sao_Paulo" };

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: "PATCH", headers, body: JSON.stringify(updates),
        });
        const data = await res.json();
        await logSync(supabase, connectionId, "calendar", "update_event", `Atualizou evento ${eventId}`);

        return new Response(JSON.stringify({ event: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "delete_event") {
        const { eventId } = params;
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: "DELETE", headers,
        });
        await logSync(supabase, connectionId, "calendar", "delete_event", `Excluiu evento ${eventId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== GMAIL =====
    if (service === "gmail") {
      if (action === "list_messages") {
        const { query = "", maxResults = 10 } = params || {};
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
        const res = await fetch(url, { headers });
        const data = await res.json();

        if (!data.messages?.length) {
          return new Response(JSON.stringify({ messages: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch details for each message
        const details = await Promise.all(
          data.messages.slice(0, maxResults).map(async (m: any) => {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers });
            return msgRes.json();
          })
        );

        const formatted = details.map((msg: any) => {
          const getHeader = (name: string) => msg.payload?.headers?.find((h: any) => h.name === name)?.value || "";
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: msg.snippet,
            labelIds: msg.labelIds,
          };
        });

        await logSync(supabase, connectionId, "gmail", "list_messages", `Listou ${formatted.length} emails`);

        return new Response(JSON.stringify({ messages: formatted }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "get_message") {
        const { messageId } = params;
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, { headers });
        const data = await res.json();

        const getHeader = (name: string) => data.payload?.headers?.find((h: any) => h.name === name)?.value || "";

        // Extract body
        let body = "";
        if (data.payload?.body?.data) {
          body = atob(data.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        } else if (data.payload?.parts) {
          const textPart = data.payload.parts.find((p: any) => p.mimeType === "text/plain");
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          }
        }

        return new Response(JSON.stringify({
          id: data.id,
          from: getHeader("From"),
          to: getHeader("To"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          body,
          snippet: data.snippet,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "send_email") {
        const { to, subject, body, cc, bcc } = params;
        let raw = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n`;
        if (cc) raw += `Cc: ${cc}\r\n`;
        if (bcc) raw += `Bcc: ${bcc}\r\n`;
        raw += `\r\n${body}`;

        const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST", headers, body: JSON.stringify({ raw: encoded }),
        });
        const data = await res.json();
        await logSync(supabase, connectionId, "gmail", "send_email", `Email enviado para ${to}: ${subject}`);

        return new Response(JSON.stringify({ success: true, messageId: data.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "create_draft") {
        const { to, subject, body } = params;
        let raw = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
        const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
          method: "POST", headers, body: JSON.stringify({ message: { raw: encoded } }),
        });
        const data = await res.json();
        await logSync(supabase, connectionId, "gmail", "create_draft", `Rascunho criado: ${subject}`);

        return new Response(JSON.stringify({ success: true, draftId: data.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== GOOGLE DRIVE =====
    if (service === "drive") {
      if (action === "list_files") {
        const { folderId, query = "", maxResults = 20 } = params || {};
        let q = query;
        if (folderId) q = `'${folderId}' in parents${q ? ` and ${q}` : ""}`;
        if (!q) q = "trashed=false";

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${maxResults}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents,size)&orderBy=modifiedTime desc`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        await logSync(supabase, connectionId, "drive", "list_files", `Listou ${data.files?.length || 0} arquivos`);

        return new Response(JSON.stringify({ files: data.files || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "search_files") {
        const { name, mimeType } = params || {};
        let q = "trashed=false";
        if (name) q += ` and name contains '${name}'`;
        if (mimeType) q += ` and mimeType='${mimeType}'`;

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=20&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents,size)&orderBy=modifiedTime desc`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        await logSync(supabase, connectionId, "drive", "search_files", `Busca: ${name || mimeType}`);

        return new Response(JSON.stringify({ files: data.files || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "get_file_content") {
        const { fileId } = params;
        // Get metadata first
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,webViewLink`, { headers });
        const meta = await metaRes.json();

        // For Google Docs/Sheets/Slides, export as text
        let content = "";
        if (meta.mimeType?.startsWith("application/vnd.google-apps.")) {
          const exportMime = meta.mimeType.includes("document") ? "text/plain" :
            meta.mimeType.includes("spreadsheet") ? "text/csv" : "text/plain";
          const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`, { headers });
          content = await exportRes.text();
        }

        return new Response(JSON.stringify({ file: meta, content: content.substring(0, 5000) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "list_folders") {
        const q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=50&fields=files(id,name,modifiedTime,webViewLink,parents)&orderBy=name`;
        const res = await fetch(url, { headers });
        const data = await res.json();

        return new Response(JSON.stringify({ folders: data.files || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: `Serviço ou ação desconhecida: ${service}/${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("google-api error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

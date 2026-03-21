import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64ToUint8Array(base64String: string) {
  const cleanedBase64 = base64String.replace(/^data:.*;base64,/, '');
  const binary = atob(cleanedBase64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, mimeType, language } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Transcribing audio...');

    const binaryAudio = base64ToUint8Array(audio);

    const formData = new FormData();
    const resolvedMimeType = typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm';
    const normalizedLanguage = typeof language === 'string' && language ? language : 'pt';
    const extension = resolvedMimeType.includes('ogg') ? 'ogg' : resolvedMimeType.includes('mp4') ? 'mp4' : resolvedMimeType.includes('mpeg') ? 'mp3' : 'webm';
    const blob = new Blob([binaryAudio], { type: resolvedMimeType });
    formData.append('file', blob, `audio.${extension}`);
    formData.append('model', 'gpt-4o-mini-transcribe');
    formData.append('language', normalizedLanguage);
    formData.append('prompt', 'O áudio está em português do Brasil. Transcreva literalmente e com alta fidelidade, preservando perguntas, nomes próprios e contexto executivo do Sistema CEO, incluindo termos como agenda, reunião, email, WhatsApp, iniciativa, stakeholder, projeto, financeiro e ExudusTech.');
    formData.append('temperature', '0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Transcription successful:', {
      mimeType: resolvedMimeType,
      language: normalizedLanguage,
      text: result.text,
    });

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

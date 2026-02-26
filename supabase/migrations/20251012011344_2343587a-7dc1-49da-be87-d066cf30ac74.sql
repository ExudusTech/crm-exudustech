-- Permitir deleção de mensagens WhatsApp
CREATE POLICY "Permitir deleção de mensagens WhatsApp" 
ON public.whatsapp_messages 
FOR DELETE 
USING (true);
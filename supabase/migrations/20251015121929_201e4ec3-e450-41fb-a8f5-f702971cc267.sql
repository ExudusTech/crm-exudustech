-- Add column to track if message was audio
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS is_audio boolean DEFAULT false;
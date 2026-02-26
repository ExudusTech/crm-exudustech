-- Add content_hash for deduplication and deleted_at for soft delete to email_attachments
ALTER TABLE public.email_attachments 
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for fast deduplication lookup (lead_id + content_hash)
CREATE INDEX IF NOT EXISTS idx_email_attachments_lead_hash 
  ON public.email_attachments (lead_id, content_hash)
  WHERE content_hash IS NOT NULL;
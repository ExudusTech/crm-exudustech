-- Create bucket for proposal PDF templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-templates', 'proposal-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to read templates
CREATE POLICY "Allow authenticated users to read templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'proposal-templates');

-- Create policy for service role to upload templates
CREATE POLICY "Allow service role to manage templates"
ON storage.objects
FOR ALL
USING (bucket_id = 'proposal-templates')
WITH CHECK (bucket_id = 'proposal-templates');
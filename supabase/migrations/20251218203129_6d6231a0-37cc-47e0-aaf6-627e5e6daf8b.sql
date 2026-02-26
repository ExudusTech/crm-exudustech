-- Make bucket public for edge function access
UPDATE storage.buckets SET public = true WHERE id = 'proposal-templates';

-- Create policy to allow public read access to templates
CREATE POLICY "Allow public read access to proposal templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-templates');

-- Allow service role to upload templates
CREATE POLICY "Allow service role to manage proposal templates"
ON storage.objects FOR ALL
USING (bucket_id = 'proposal-templates');
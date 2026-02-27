-- Add attachment columns to complaints table
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create storage bucket for complaint attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-attachments', 'complaint-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for complaint attachments
CREATE POLICY "Authenticated users can upload complaint attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'complaint-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view complaint attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'complaint-attachments');

CREATE POLICY "Users can delete their own complaint attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'complaint-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
); 
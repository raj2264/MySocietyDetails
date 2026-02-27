-- Create storage bucket for poll attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-attachments', 'poll-attachments', true);

-- Allow authenticated users to upload attachments
CREATE POLICY "Authenticated users can upload poll attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poll-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM polls
    WHERE society_id IN (
      SELECT society_id FROM society_admins
      WHERE user_id = auth.uid()
    )
  )
);

-- Allow public access to view attachments
CREATE POLICY "Public can view poll attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'poll-attachments');

-- Allow society admins to delete their attachments
CREATE POLICY "Society admins can delete their poll attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'poll-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM polls
    WHERE society_id IN (
      SELECT society_id FROM society_admins
      WHERE user_id = auth.uid()
    )
  )
); 
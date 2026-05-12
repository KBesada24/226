-- Create the storage bucket for club assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-assets', 'club-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the club-assets bucket

-- Allow public read access to all files in the bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'club-assets' );

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'club-assets' AND owner_id = auth.uid()::text );

-- Allow users to update their own files (optional, good for editing)
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'club-assets' AND auth.uid()::text = owner_id )
WITH CHECK ( bucket_id = 'club-assets' AND auth.uid()::text = owner_id );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'club-assets' AND auth.uid()::text = owner_id );

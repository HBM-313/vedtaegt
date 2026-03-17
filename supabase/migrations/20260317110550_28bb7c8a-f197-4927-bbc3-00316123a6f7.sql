
-- Fix overly permissive storage UPDATE policy — restrict to org members
DROP POLICY IF EXISTS "Members can update own documents" ON storage.objects;

CREATE POLICY "Members can update own documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM public.members WHERE user_id = auth.uid()
  )
);

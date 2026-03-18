CREATE POLICY "Medlemmer kan opdatere egne filer"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE public.user_is_org_member(id)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE public.user_is_org_member(id)
  )
);
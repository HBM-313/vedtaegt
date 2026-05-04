-- 1) Remove duplicate UPDATE policy on storage.objects for documents bucket.
-- Keep "Medlemmer kan opdatere egne filer" (authenticated-scoped), drop the public one.
DROP POLICY IF EXISTS "Members can update own documents" ON storage.objects;

-- 2) Tighten foreningsmedlemmer write access to require kan_administrere_medlemsregister.
DROP POLICY IF EXISTS "Org-medlemmer kan oprette foreningsmedlemmer" ON public.foreningsmedlemmer;
DROP POLICY IF EXISTS "Org-medlemmer kan opdatere foreningsmedlemmer" ON public.foreningsmedlemmer;
DROP POLICY IF EXISTS "Org-medlemmer kan slette foreningsmedlemmer" ON public.foreningsmedlemmer;

CREATE POLICY "Berettigede kan oprette foreningsmedlemmer"
ON public.foreningsmedlemmer
FOR INSERT
WITH CHECK (
  public.user_is_org_member(org_id)
  AND public.caller_has_permission(org_id, 'kan_administrere_medlemsregister')
);

CREATE POLICY "Berettigede kan opdatere foreningsmedlemmer"
ON public.foreningsmedlemmer
FOR UPDATE
USING (
  public.user_is_org_member(org_id)
  AND public.caller_has_permission(org_id, 'kan_administrere_medlemsregister')
)
WITH CHECK (
  public.user_is_org_member(org_id)
  AND public.caller_has_permission(org_id, 'kan_administrere_medlemsregister')
);

CREATE POLICY "Berettigede kan slette foreningsmedlemmer"
ON public.foreningsmedlemmer
FOR DELETE
USING (
  public.user_is_org_member(org_id)
  AND public.caller_has_permission(org_id, 'kan_administrere_medlemsregister')
);

-- 1. APPROVALS: hide token + ip_address from clients (use RPCs for token retrieval)
REVOKE SELECT (token, ip_address) ON public.approvals FROM authenticated, anon;

-- 2. MEMBERS: hide sensitive personal columns from clients (own data via get_my_member_profile RPC)
REVOKE SELECT (adresse, postnummer, by, telefon, foedselsdato, invitation_token, invitation_token_expires_at, marketing_consent, marketing_consent_at)
  ON public.members FROM authenticated, anon;

-- 3. OWNERSHIP_TRANSFERS: hide token column (recipient uses get_ownership_transfer_by_token RPC)
REVOKE SELECT (token) ON public.ownership_transfers FROM authenticated, anon;

-- 4. MEMBERS: tighten DELETE policy + block self-deletion
DROP POLICY IF EXISTS "Medlemmer kan slette org medlemmer" ON public.members;
CREATE POLICY "Berettigede kan slette org medlemmer"
  ON public.members FOR DELETE
  USING (
    user_is_org_member(org_id)
    AND public.caller_has_permission(org_id, 'kan_fjerne_medlemmer')
    AND user_id IS DISTINCT FROM auth.uid()
  );

-- 5. STORAGE: enforce upload/delete permissions on documents bucket
DROP POLICY IF EXISTS "Upload dokumenter via org" ON storage.objects;
CREATE POLICY "Upload dokumenter via org"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
    AND public.caller_has_permission(
      ((storage.foldername(name))[1])::uuid, 'kan_uploade_dokumenter'
    )
  );

DROP POLICY IF EXISTS "Slet dokumenter via org" ON storage.objects;
CREATE POLICY "Slet dokumenter via org"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT org_id FROM public.members WHERE user_id = auth.uid()
    )
    AND public.caller_has_permission(
      ((storage.foldername(name))[1])::uuid, 'kan_slette_dokumenter'
    )
  );

-- 6. AFSTEMNINGER: require kan_redigere_moeder for writes
DROP POLICY IF EXISTS "Medlemmer kan oprette org afstemninger" ON public.afstemninger;
CREATE POLICY "Berettigede kan oprette org afstemninger"
  ON public.afstemninger FOR INSERT
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

DROP POLICY IF EXISTS "Medlemmer kan opdatere org afstemninger" ON public.afstemninger;
CREATE POLICY "Berettigede kan opdatere org afstemninger"
  ON public.afstemninger FOR UPDATE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'))
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

DROP POLICY IF EXISTS "Medlemmer kan slette org afstemninger" ON public.afstemninger;
CREATE POLICY "Berettigede kan slette org afstemninger"
  ON public.afstemninger FOR DELETE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

-- 7. DOCUMENT_CATEGORIES: require kan_redigere_forening for writes
DROP POLICY IF EXISTS "Medlemmer kan oprette org kategorier" ON public.document_categories;
CREATE POLICY "Berettigede kan oprette org kategorier"
  ON public.document_categories FOR INSERT
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

DROP POLICY IF EXISTS "Medlemmer kan opdatere org kategorier" ON public.document_categories;
CREATE POLICY "Berettigede kan opdatere org kategorier"
  ON public.document_categories FOR UPDATE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'))
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

DROP POLICY IF EXISTS "Medlemmer kan slette org kategorier" ON public.document_categories;
CREATE POLICY "Berettigede kan slette org kategorier"
  ON public.document_categories FOR DELETE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

-- 8. MINUTES: require kan_redigere_moeder for writes
DROP POLICY IF EXISTS "Medlemmer kan oprette org referater" ON public.minutes;
CREATE POLICY "Berettigede kan oprette org referater"
  ON public.minutes FOR INSERT
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

DROP POLICY IF EXISTS "Medlemmer kan opdatere org referater" ON public.minutes;
CREATE POLICY "Berettigede kan opdatere org referater"
  ON public.minutes FOR UPDATE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'))
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

DROP POLICY IF EXISTS "Medlemmer kan slette org referater" ON public.minutes;
CREATE POLICY "Berettigede kan slette org referater"
  ON public.minutes FOR DELETE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_moeder'));

-- 9. VEDTAEGT_VERSIONER: require kan_redigere_forening for writes
DROP POLICY IF EXISTS "Medlemmer kan oprette org vedtaegt_versioner" ON public.vedtaegt_versioner;
DROP POLICY IF EXISTS "Medlemmer kan opdatere org vedtaegt_versioner" ON public.vedtaegt_versioner;
DROP POLICY IF EXISTS "Medlemmer kan slette org vedtaegt_versioner" ON public.vedtaegt_versioner;

CREATE POLICY "Berettigede kan oprette org vedtaegt_versioner"
  ON public.vedtaegt_versioner FOR INSERT
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

CREATE POLICY "Berettigede kan opdatere org vedtaegt_versioner"
  ON public.vedtaegt_versioner FOR UPDATE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'))
  WITH CHECK (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

CREATE POLICY "Berettigede kan slette org vedtaegt_versioner"
  ON public.vedtaegt_versioner FOR DELETE
  USING (user_is_org_member(org_id) AND public.caller_has_permission(org_id, 'kan_redigere_forening'));

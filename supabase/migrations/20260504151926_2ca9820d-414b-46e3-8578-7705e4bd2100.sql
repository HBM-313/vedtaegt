
-- ============ approvals ============
DROP POLICY IF EXISTS "Medlemmer kan oprette org godkendelser" ON public.approvals;
CREATE POLICY "Berettigede kan oprette godkendelser"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_org_member(org_id) AND (
      public.caller_has_permission(org_id, 'kan_oprette_moeder') OR
      public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
    )
  );

DROP POLICY IF EXISTS "Medlemmer kan slette org godkendelser" ON public.approvals;
CREATE POLICY "Berettigede kan slette godkendelser"
  ON public.approvals FOR DELETE TO authenticated
  USING (
    public.user_is_org_member(org_id) AND
    public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
  );

-- ============ meetings ============
DROP POLICY IF EXISTS "Medlemmer kan oprette org møder" ON public.meetings;
CREATE POLICY "Berettigede kan oprette møder"
  ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_org_member(org_id) AND
    public.caller_has_permission(org_id, 'kan_oprette_moeder')
  );

DROP POLICY IF EXISTS "Medlemmer kan slette org møder" ON public.meetings;
CREATE POLICY "Berettigede kan slette møder"
  ON public.meetings FOR DELETE TO authenticated
  USING (
    public.user_is_org_member(org_id) AND
    public.caller_has_permission(org_id, 'kan_redigere_moeder')
  );

-- ============ documents ============
DROP POLICY IF EXISTS "Medlemmer kan slette org dokumenter" ON public.documents;
CREATE POLICY "Berettigede kan slette dokumenter"
  ON public.documents FOR DELETE TO authenticated
  USING (
    public.user_is_org_member(org_id) AND
    public.caller_has_permission(org_id, 'kan_slette_dokumenter')
  );

-- ============ foreningsmedlemmer ============
REVOKE SELECT (email, telefon, adresse, foedselsdato, postnummer, by, kontingent_status, kontingent_beloeb, noter)
  ON public.foreningsmedlemmer FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.list_foreningsmedlemmer(_org_id uuid)
RETURNS SETOF public.foreningsmedlemmer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.user_is_org_member(_org_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.caller_has_permission(_org_id, 'kan_administrere_medlemsregister') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT * FROM public.foreningsmedlemmer
    WHERE org_id = _org_id
    ORDER BY navn;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_foreningsmedlem_emails(_org_id uuid)
RETURNS TABLE(navn text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.user_is_org_member(_org_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.caller_has_permission(_org_id, 'kan_oprette_moeder') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT f.navn, f.email
    FROM public.foreningsmedlemmer f
    WHERE f.org_id = _org_id
      AND f.email IS NOT NULL;
END;
$$;

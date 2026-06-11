
-- =========================================================
-- 1) APPROVALS: tighten UPDATE policy
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan opdatere org godkendelser" ON public.approvals;
CREATE POLICY "Berettigede kan opdatere godkendelser"
  ON public.approvals
  FOR UPDATE
  USING (
    user_is_org_member(org_id)
    AND (
      member_id IN (SELECT id FROM public.members WHERE org_id = approvals.org_id AND user_id = auth.uid())
      OR public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
    )
  )
  WITH CHECK (
    user_is_org_member(org_id)
    AND (
      member_id IN (SELECT id FROM public.members WHERE org_id = approvals.org_id AND user_id = auth.uid())
      OR public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
    )
  );

-- =========================================================
-- 2) MEETINGS: tighten UPDATE policy
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan opdatere org møder" ON public.meetings;
CREATE POLICY "Berettigede kan opdatere møder"
  ON public.meetings
  FOR UPDATE
  USING (
    user_is_org_member(org_id)
    AND (
      public.caller_has_permission(org_id, 'kan_redigere_moeder')
      OR public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
    )
  )
  WITH CHECK (
    user_is_org_member(org_id)
    AND (
      public.caller_has_permission(org_id, 'kan_redigere_moeder')
      OR public.caller_has_permission(org_id, 'kan_sende_til_godkendelse')
    )
  );

-- =========================================================
-- 3) MEMBERS: tighten UPDATE policy (own row OR role-change permission)
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan opdatere org medlemmer" ON public.members;
CREATE POLICY "Berettigede kan opdatere medlemmer"
  ON public.members
  FOR UPDATE
  USING (
    user_is_org_member(org_id)
    AND (
      user_id = auth.uid()
      OR public.caller_has_permission(org_id, 'kan_aendre_roller')
      OR public.caller_has_permission(org_id, 'kan_fjerne_medlemmer')
      OR public.caller_has_permission(org_id, 'kan_invitere_medlemmer')
    )
  )
  WITH CHECK (
    user_is_org_member(org_id)
    AND (
      user_id = auth.uid()
      OR public.caller_has_permission(org_id, 'kan_aendre_roller')
      OR public.caller_has_permission(org_id, 'kan_fjerne_medlemmer')
      OR public.caller_has_permission(org_id, 'kan_invitere_medlemmer')
    )
  );

-- =========================================================
-- 4) ORGANIZATIONS: tighten UPDATE policy
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan opdatere egne organisationer" ON public.organizations;
CREATE POLICY "Berettigede kan opdatere forening"
  ON public.organizations
  FOR UPDATE
  USING (
    user_is_org_member(id)
    AND public.caller_has_permission(id, 'kan_redigere_forening')
  )
  WITH CHECK (
    user_is_org_member(id)
    AND public.caller_has_permission(id, 'kan_redigere_forening')
  );

-- =========================================================
-- 5) DOCUMENTS: require upload permission on INSERT/UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan oprette org dokumenter" ON public.documents;
CREATE POLICY "Berettigede kan oprette dokumenter"
  ON public.documents
  FOR INSERT
  WITH CHECK (
    user_is_org_member(org_id)
    AND public.caller_has_permission(org_id, 'kan_uploade_dokumenter')
  );

DROP POLICY IF EXISTS "Medlemmer kan opdatere org dokumenter" ON public.documents;
CREATE POLICY "Berettigede kan opdatere dokumenter"
  ON public.documents
  FOR UPDATE
  USING (
    user_is_org_member(org_id)
    AND public.caller_has_permission(org_id, 'kan_uploade_dokumenter')
  )
  WITH CHECK (
    user_is_org_member(org_id)
    AND public.caller_has_permission(org_id, 'kan_uploade_dokumenter')
  );

-- =========================================================
-- 6) FORENINGSMEDLEMMER: restrict SELECT to admins
-- =========================================================
DROP POLICY IF EXISTS "Org-medlemmer kan se foreningsmedlemmer" ON public.foreningsmedlemmer;
CREATE POLICY "Berettigede kan se foreningsmedlemmer"
  ON public.foreningsmedlemmer
  FOR SELECT
  USING (
    user_is_org_member(org_id)
    AND public.caller_has_permission(org_id, 'kan_administrere_medlemsregister')
  );

-- =========================================================
-- 7) OWNERSHIP_TRANSFERS: only formand may create/update
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan oprette org overdragelser" ON public.ownership_transfers;
CREATE POLICY "Kun formand kan oprette overdragelser"
  ON public.ownership_transfers
  FOR INSERT
  WITH CHECK (
    user_is_org_member(org_id)
    AND public.is_org_formand(org_id)
  );

DROP POLICY IF EXISTS "Medlemmer kan opdatere org overdragelser" ON public.ownership_transfers;
CREATE POLICY "Kun formand kan opdatere overdragelser"
  ON public.ownership_transfers
  FOR UPDATE
  USING (
    user_is_org_member(org_id)
    AND public.is_org_formand(org_id)
  )
  WITH CHECK (
    user_is_org_member(org_id)
    AND public.is_org_formand(org_id)
  );

-- =========================================================
-- 8) ROLE_PERMISSIONS: explicit formand-only DELETE policy
-- =========================================================
DROP POLICY IF EXISTS "Kun formand kan slette org tilladelser" ON public.role_permissions;
CREATE POLICY "Kun formand kan slette org tilladelser"
  ON public.role_permissions
  FOR DELETE
  USING (public.is_org_formand(org_id));

-- =========================================================
-- 9) RPC: finalize meeting when all approved
-- =========================================================
CREATE OR REPLACE FUNCTION public.finalize_meeting_if_all_approved(_meeting_id uuid)
RETURNS TABLE(finalized boolean, approvals jsonb, org_id uuid, meeting_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_title text;
  v_all_done boolean;
  v_now timestamptz := now();
  v_approvals jsonb;
BEGIN
  SELECT m.org_id, m.title INTO v_org_id, v_title FROM meetings m WHERE m.id = _meeting_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT bool_and(a.status = 'godkendt') INTO v_all_done
    FROM approvals a WHERE a.meeting_id = _meeting_id;

  IF v_all_done THEN
    UPDATE meetings SET status = 'approved', approved_at = v_now WHERE id = _meeting_id;

    SELECT jsonb_agg(jsonb_build_object(
      'name', mem.name, 'role', mem.role, 'approved_at', a.approved_at
    ))
    INTO v_approvals
    FROM approvals a JOIN members mem ON mem.id = a.member_id
    WHERE a.meeting_id = _meeting_id;

    INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (v_org_id, auth.uid(), 'meeting.fully_approved', 'meeting', _meeting_id, '{}'::jsonb);
  END IF;

  RETURN QUERY SELECT COALESCE(v_all_done, false), v_approvals, v_org_id, v_title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_meeting_if_all_approved(uuid) TO authenticated, anon;

-- =========================================================
-- 10) RPC: token-based approve / reject
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_meeting_with_token(_token text, _ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval approvals%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT * INTO v_approval FROM approvals WHERE token = _token LIMIT 1;
  IF v_approval.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_approval.status IN ('godkendt','afvist') THEN
    RETURN jsonb_build_object('error', 'already_handled', 'status', v_approval.status);
  END IF;
  IF v_approval.token_expires_at IS NOT NULL AND v_approval.token_expires_at < v_now THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE approvals SET
    status = 'godkendt',
    approved_at = v_now,
    ip_address = COALESCE(_ip, 'web-client'),
    token = NULL
  WHERE id = v_approval.id;

  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_approval.org_id, NULL, 'meeting.referat_godkendt', 'meeting', v_approval.meeting_id,
          jsonb_build_object('member_id', v_approval.member_id, 'kilde', 'token'));

  RETURN jsonb_build_object('ok', true, 'meeting_id', v_approval.meeting_id, 'org_id', v_approval.org_id, 'approved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_meeting_with_token(text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.reject_meeting_with_token(_token text, _kommentar text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval approvals%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF _kommentar IS NULL OR length(trim(_kommentar)) < 10 THEN
    RETURN jsonb_build_object('error', 'kommentar_required');
  END IF;

  SELECT * INTO v_approval FROM approvals WHERE token = _token LIMIT 1;
  IF v_approval.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_approval.status IN ('godkendt','afvist') THEN
    RETURN jsonb_build_object('error', 'already_handled', 'status', v_approval.status);
  END IF;
  IF v_approval.token_expires_at IS NOT NULL AND v_approval.token_expires_at < v_now THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE approvals SET
    status = 'afvist',
    afvist_kommentar = _kommentar,
    token = NULL
  WHERE id = v_approval.id;

  UPDATE meetings SET
    status = 'active',
    afvist_af = v_approval.member_id,
    afvist_at = v_now,
    afvist_kommentar = _kommentar
  WHERE id = v_approval.meeting_id;

  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_approval.org_id, NULL, 'meeting.referat_afvist', 'meeting', v_approval.meeting_id,
          jsonb_build_object('member_id', v_approval.member_id, 'kilde', 'token'));

  RETURN jsonb_build_object('ok', true, 'meeting_id', v_approval.meeting_id, 'org_id', v_approval.org_id, 'member_id', v_approval.member_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_meeting_with_token(text, text) TO authenticated, anon;

-- =========================================================
-- 11) RPC: in-platform approve / reject
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_meeting_in_platform(_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_member_id uuid;
  v_approval_id uuid;
  v_now timestamptz := now();
  v_runde integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT org_id, godkendelse_runde INTO v_org_id, v_runde FROM meetings WHERE id = _meeting_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Mødet findes ikke.'; END IF;

  SELECT id INTO v_member_id FROM members WHERE org_id = v_org_id AND user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'Du er ikke medlem.'; END IF;

  SELECT id INTO v_approval_id FROM approvals
    WHERE meeting_id = _meeting_id AND member_id = v_member_id LIMIT 1;
  IF v_approval_id IS NULL THEN RAISE EXCEPTION 'Ingen godkendelsesrække fundet.'; END IF;

  UPDATE approvals SET status = 'godkendt', approved_at = v_now WHERE id = v_approval_id;

  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, auth.uid(), 'meeting.referat_godkendt', 'meeting', _meeting_id,
          jsonb_build_object('member_id', v_member_id, 'kilde', 'platform', 'runde', COALESCE(v_runde, 1)));

  RETURN jsonb_build_object('ok', true, 'org_id', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_meeting_in_platform(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_meeting_in_platform(_meeting_id uuid, _kommentar text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_member_id uuid;
  v_approval_id uuid;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _kommentar IS NULL OR length(trim(_kommentar)) < 10 THEN
    RAISE EXCEPTION 'Kommentar mangler.';
  END IF;

  SELECT org_id INTO v_org_id FROM meetings WHERE id = _meeting_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Mødet findes ikke.'; END IF;

  SELECT id INTO v_member_id FROM members WHERE org_id = v_org_id AND user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'Du er ikke medlem.'; END IF;

  SELECT id INTO v_approval_id FROM approvals
    WHERE meeting_id = _meeting_id AND member_id = v_member_id LIMIT 1;
  IF v_approval_id IS NULL THEN RAISE EXCEPTION 'Ingen godkendelsesrække fundet.'; END IF;

  UPDATE approvals SET status = 'afvist', afvist_kommentar = _kommentar WHERE id = v_approval_id;

  UPDATE meetings SET
    status = 'active',
    afvist_af = v_member_id,
    afvist_at = v_now,
    afvist_kommentar = _kommentar
  WHERE id = _meeting_id;

  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, auth.uid(), 'meeting.referat_afvist', 'meeting', _meeting_id,
          jsonb_build_object('member_id', v_member_id, 'kilde', 'platform'));

  RETURN jsonb_build_object('ok', true, 'org_id', v_org_id, 'member_id', v_member_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_meeting_in_platform(uuid, text) TO authenticated;

-- =========================================================
-- 12) RPC: accept ownership transfer
-- =========================================================
CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer ownership_transfers%ROWTYPE;
  v_user_email text;
  v_to_member_id uuid;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _token IS NULL OR length(_token) < 16 THEN RAISE EXCEPTION 'Ugyldigt token.'; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_transfer FROM ownership_transfers WHERE token = _token LIMIT 1;
  IF v_transfer.id IS NULL THEN RAISE EXCEPTION 'Overdragelsen findes ikke.'; END IF;
  IF v_transfer.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Allerede accepteret.'; END IF;
  IF v_transfer.expires_at IS NOT NULL AND v_transfer.expires_at < v_now THEN
    RAISE EXCEPTION 'Linket er udløbet.';
  END IF;
  IF lower(v_transfer.to_email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Linket tilhører ikke din konto.';
  END IF;

  SELECT id INTO v_to_member_id FROM members
   WHERE org_id = v_transfer.org_id AND user_id = auth.uid() LIMIT 1;
  IF v_to_member_id IS NULL THEN RAISE EXCEPTION 'Du er ikke medlem af foreningen.'; END IF;

  UPDATE members SET role = 'bestyrelsesmedlem' WHERE id = v_transfer.from_member_id;
  UPDATE members SET role = 'formand' WHERE id = v_to_member_id;
  UPDATE ownership_transfers SET accepted_at = v_now WHERE id = v_transfer.id;

  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_transfer.org_id, auth.uid(), 'org.ownership_transferred', 'ownership_transfer', v_transfer.id,
          jsonb_build_object('from_member_id', v_transfer.from_member_id, 'to_member_id', v_to_member_id));

  RETURN jsonb_build_object('ok', true, 'org_id', v_transfer.org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(text) TO authenticated;

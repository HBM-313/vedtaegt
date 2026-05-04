
-- =========================================================
-- 1. Approval send: server-side RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.start_meeting_approval(
  _meeting_id uuid,
  _frist_dage integer
)
RETURNS TABLE (
  approval_id uuid,
  member_id uuid,
  member_name text,
  member_email text,
  token text,
  is_sender boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_status text;
  v_runde integer;
  v_afvist_at timestamptz;
  v_caller_member_id uuid;
  v_actual_runde integer;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _frist_dage IS NULL OR _frist_dage < 1 OR _frist_dage > 60 THEN
    RAISE EXCEPTION 'Ugyldig frist.';
  END IF;

  SELECT org_id, status, godkendelse_runde, afvist_at
    INTO v_org_id, v_status, v_runde, v_afvist_at
  FROM meetings WHERE id = _meeting_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Mødet findes ikke.';
  END IF;
  IF NOT public.user_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.caller_has_permission(v_org_id, 'kan_sende_til_godkendelse') THEN
    RAISE EXCEPTION 'Du har ikke tilladelse til at sende referatet til godkendelse.';
  END IF;

  SELECT id INTO v_caller_member_id
    FROM members WHERE org_id = v_org_id AND user_id = auth.uid()
    LIMIT 1;

  v_actual_runde := COALESCE(v_runde, 1)
    + (CASE WHEN v_status = 'active' AND v_afvist_at IS NOT NULL THEN 1 ELSE 0 END);
  IF v_afvist_at IS NULL THEN
    v_actual_runde := COALESCE(v_runde, 1);
  END IF;

  v_expires_at := now() + interval '30 days';

  -- Update meeting
  UPDATE meetings SET
    status = 'pending_approval',
    godkendelse_frist_dage = _frist_dage,
    godkendelse_runde = v_actual_runde,
    afvist_af = NULL,
    afvist_at = NULL,
    afvist_kommentar = NULL,
    sendt_af = v_caller_member_id
  WHERE id = _meeting_id;

  -- Replace pending approvals
  DELETE FROM approvals
   WHERE meeting_id = _meeting_id AND status = 'afventer';

  INSERT INTO approvals
    (meeting_id, org_id, member_id, status, token, token_expires_at,
     sendt_at, paamindelse_efter_dage, approved_at)
  SELECT _meeting_id, v_org_id, m.id,
         CASE WHEN m.id = v_caller_member_id THEN 'godkendt' ELSE 'afventer' END,
         gen_random_uuid()::text,
         v_expires_at, now(), _frist_dage,
         CASE WHEN m.id = v_caller_member_id THEN now() ELSE NULL END
  FROM members m
  WHERE m.org_id = v_org_id
    AND m.user_id IS NOT NULL
    AND m.email_bekraeftet = true;

  -- Audit
  INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (v_org_id, auth.uid(), 'meeting.sent_for_approval', 'meeting', _meeting_id,
          jsonb_build_object('runde', v_actual_runde, 'frist_dage', _frist_dage));

  IF v_caller_member_id IS NOT NULL THEN
    INSERT INTO audit_events (org_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (v_org_id, auth.uid(), 'meeting.referat_godkendt', 'meeting', _meeting_id,
            jsonb_build_object('member_id', v_caller_member_id, 'kilde', 'auto_afsender', 'runde', v_actual_runde));
  END IF;

  -- Return rows for the client to dispatch emails
  RETURN QUERY
  SELECT a.id, a.member_id, m.name, m.email, a.token,
         (a.member_id = v_caller_member_id)
    FROM approvals a
    JOIN members m ON m.id = a.member_id
   WHERE a.meeting_id = _meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_meeting_approval(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_meeting_approval(uuid, integer) TO authenticated;

-- =========================================================
-- 2. Stripe IDs: revoke column SELECT
-- =========================================================
REVOKE SELECT (stripe_customer_id, stripe_subscription_id)
  ON public.organizations FROM authenticated, anon;

-- =========================================================
-- 3. audit_events: tighten INSERT to require user_id = auth.uid()
-- =========================================================
DROP POLICY IF EXISTS "Medlemmer kan oprette org hændelser" ON public.audit_events;

CREATE POLICY "Medlemmer kan oprette egne org hændelser"
  ON public.audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_is_org_member(org_id)
  );

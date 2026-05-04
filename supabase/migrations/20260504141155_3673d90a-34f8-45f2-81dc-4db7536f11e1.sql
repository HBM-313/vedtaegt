
-- =========================================================
-- 1. MEMBERS: revoke sensitive column SELECT from authenticated/anon
-- =========================================================
REVOKE SELECT (
  invitation_token,
  invitation_token_expires_at,
  foedselsdato,
  adresse,
  telefon,
  marketing_consent,
  marketing_consent_at
) ON public.members FROM authenticated, anon;

-- Allow users to read THEIR OWN sensitive member data via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_my_member_profile(_org_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  name text,
  email text,
  role text,
  telefon text,
  adresse text,
  postnummer text,
  by text,
  foedselsdato date,
  marketing_consent boolean,
  marketing_consent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.org_id, m.name, m.email, m.role,
         m.telefon, m.adresse, m.postnummer, m.by,
         m.foedselsdato, m.marketing_consent, m.marketing_consent_at
  FROM members m
  WHERE m.org_id = _org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_member_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_member_profile(uuid) TO authenticated;

-- =========================================================
-- 2. APPROVALS: revoke token + ip_address column SELECT
-- =========================================================
REVOKE SELECT (token, ip_address) ON public.approvals FROM authenticated, anon;

-- Server-side reminder helper: returns pending approvals with tokens for an
-- authorized caller (must be org member with kan_sende_til_godkendelse).
-- Excludes the meeting sender from the result.
CREATE OR REPLACE FUNCTION public.get_pending_approval_tokens(_meeting_id uuid)
RETURNS TABLE (
  approval_id uuid,
  token text,
  member_id uuid,
  member_name text,
  member_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_sender uuid;
BEGIN
  SELECT org_id, sendt_af INTO v_org_id, v_sender
    FROM meetings WHERE id = _meeting_id;
  IF v_org_id IS NULL THEN RETURN; END IF;

  IF NOT public.user_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.caller_has_permission(v_org_id, 'kan_sende_til_godkendelse') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT a.id, a.token, a.member_id, m.name, m.email
    FROM approvals a
    JOIN members m ON m.id = a.member_id
   WHERE a.meeting_id = _meeting_id
     AND a.status = 'afventer'
     AND (v_sender IS NULL OR a.member_id <> v_sender);
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_approval_tokens(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pending_approval_tokens(uuid) TO authenticated;

-- =========================================================
-- 3. OWNERSHIP_TRANSFERS: revoke token column SELECT
-- =========================================================
REVOKE SELECT (token) ON public.ownership_transfers FROM authenticated, anon;

-- Recipient lookup: authenticated user fetches their own transfer by token.
-- Verifies the caller's email matches to_email.
CREATE OR REPLACE FUNCTION public.get_ownership_transfer_by_token(_token text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  from_member_id uuid,
  to_email text,
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _token IS NULL OR length(_token) < 16 THEN RETURN; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  RETURN QUERY
  SELECT t.id, t.org_id, t.from_member_id, t.to_email, t.expires_at, t.accepted_at
    FROM ownership_transfers t
   WHERE t.token = _token
     AND lower(t.to_email) = lower(v_user_email)
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ownership_transfer_by_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ownership_transfer_by_token(text) TO authenticated;

-- =========================================================
-- 4. REALTIME: restrict channel subscriptions
-- Topic convention used by client: "approvals-<meeting_id>"
-- Only members of the meeting's org may subscribe.
-- =========================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive approvals topic for own org"
  ON realtime.messages;

CREATE POLICY "Authenticated can receive approvals topic for own org"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'approvals-%' THEN
        EXISTS (
          SELECT 1
          FROM public.meetings m
          WHERE m.id::text = substring(realtime.topic() from 11)
            AND public.user_is_org_member(m.org_id)
        )
      ELSE false
    END
  );

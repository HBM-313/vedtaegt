-- 1. Helper: is current user formand of given org?
CREATE OR REPLACE FUNCTION public.is_org_formand(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE members.org_id = _org_id
      AND members.user_id = auth.uid()
      AND members.role = 'formand'
  );
$$;

-- 2. Restrict role_permissions write access to formand only
DROP POLICY IF EXISTS "medlemmer kan opdatere egne org tilladelser" ON public.role_permissions;
DROP POLICY IF EXISTS "medlemmer kan oprette org tilladelser" ON public.role_permissions;

CREATE POLICY "Kun formand kan oprette org tilladelser"
ON public.role_permissions
FOR INSERT
WITH CHECK (public.is_org_formand(org_id));

CREATE POLICY "Kun formand kan opdatere org tilladelser"
ON public.role_permissions
FOR UPDATE
USING (public.is_org_formand(org_id))
WITH CHECK (public.is_org_formand(org_id));

-- 3. Drop overly permissive anon policies on members
DROP POLICY IF EXISTS "Anyone can read member by invitation_token" ON public.members;
DROP POLICY IF EXISTS "Anon can update member by invitation_token" ON public.members;

-- 4. Secure RPC: lookup invitation by token (returns minimal fields)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  member_id uuid,
  email text,
  role text,
  org_id uuid,
  org_name text,
  formand_name text,
  expired boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;

  SELECT id, email, role, org_id, invitation_token_expires_at
    INTO m
    FROM members
    WHERE invitation_token = _token
    LIMIT 1;

  IF m.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.email,
    m.role,
    m.org_id,
    (SELECT name FROM organizations WHERE id = m.org_id),
    (SELECT name FROM members WHERE org_id = m.org_id AND role = 'formand' LIMIT 1),
    (m.invitation_token_expires_at IS NOT NULL AND m.invitation_token_expires_at < now());
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 5. Secure RPC: accept invitation (token-validated update)
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _token text,
  _user_id uuid,
  _name text,
  _telefon text DEFAULT NULL,
  _foedselsdato date DEFAULT NULL,
  _adresse text DEFAULT NULL,
  _postnummer text DEFAULT NULL,
  _by text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN false;
  END IF;

  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE members
  SET
    user_id = _user_id,
    name = COALESCE(NULLIF(trim(_name), ''), name),
    telefon = NULLIF(trim(_telefon), ''),
    foedselsdato = _foedselsdato,
    adresse = NULLIF(trim(_adresse), ''),
    postnummer = NULLIF(trim(_postnummer), ''),
    by = NULLIF(trim(_by), ''),
    joined_at = now(),
    invitation_token = NULL,
    invitation_token_expires_at = NULL,
    email_bekraeftet = false
  WHERE invitation_token = _token
    AND (invitation_token_expires_at IS NULL OR invitation_token_expires_at > now());

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text, uuid, text, text, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid, text, text, date, text, text, text) TO anon, authenticated;
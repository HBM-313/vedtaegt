-- Helper: get the effective role for caller in a given org, taking
-- naestformand-vikariat into account (inherits formand permissions when
-- formand is absent and arver_formand_ved_fravaer is true).
CREATE OR REPLACE FUNCTION public.caller_effective_role(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_role text;
  inherits boolean;
  formand_absent boolean;
BEGIN
  SELECT role INTO base_role
    FROM members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
    LIMIT 1;

  IF base_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF base_role = 'naestformand' THEN
    SELECT arver_formand_ved_fravaer INTO inherits
      FROM role_permissions
      WHERE org_id = _org_id AND role = 'naestformand'
      LIMIT 1;
    IF inherits THEN
      SELECT er_fravaerende INTO formand_absent
        FROM members
        WHERE org_id = _org_id AND role = 'formand'
        LIMIT 1;
      IF formand_absent THEN
        RETURN 'formand';
      END IF;
    END IF;
  END IF;

  RETURN base_role;
END;
$$;

-- Helper: does the caller have a specific permission flag in this org?
CREATE OR REPLACE FUNCTION public.caller_has_permission(_org_id uuid, _flag text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eff_role text;
  result boolean;
BEGIN
  eff_role := public.caller_effective_role(_org_id);
  IF eff_role IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT %I FROM role_permissions WHERE org_id = $1 AND role = $2 LIMIT 1',
    _flag
  ) INTO result USING _org_id, eff_role;

  RETURN COALESCE(result, false);
END;
$$;

-- Trigger: enforce kan_aendre_roller on members.role updates,
-- and prevent self-promotion via direct API.
CREATE OR REPLACE FUNCTION public.enforce_role_change_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow when role is unchanged (regular profile updates)
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow service-role / superuser (no auth.uid()) — used by trusted
  -- edge functions (e.g. ownership transfer, invitations).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block self-promotion regardless of permission
  IF NEW.user_id = auth.uid() OR OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Du kan ikke ændre din egen rolle.';
  END IF;

  -- Caller must have kan_aendre_roller in this org
  IF NOT public.caller_has_permission(NEW.org_id, 'kan_aendre_roller') THEN
    RAISE EXCEPTION 'Du har ikke tilladelse til at ændre roller i denne forening.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_change_permission ON public.members;
CREATE TRIGGER enforce_role_change_permission
  BEFORE UPDATE OF role ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_change_permission();

-- Trigger: enforce kan_slette_dokumenter on document deletions
CREATE OR REPLACE FUNCTION public.enforce_document_delete_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role / superuser (no auth.uid())
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  IF NOT public.caller_has_permission(OLD.org_id, 'kan_slette_dokumenter') THEN
    RAISE EXCEPTION 'Du har ikke tilladelse til at slette dokumenter i denne forening.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_document_delete_permission ON public.documents;
CREATE TRIGGER enforce_document_delete_permission
  BEFORE DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_delete_permission();
-- Stop returning share_pin_hash to anonymous callers; expose only a boolean flag.
DROP FUNCTION IF EXISTS public.get_meeting_by_share_token(uuid);

CREATE OR REPLACE FUNCTION public.get_meeting_by_share_token(_token uuid)
RETURNS TABLE(
  id uuid,
  org_id uuid,
  title text,
  meeting_date timestamp with time zone,
  location text,
  status text,
  meeting_type text,
  pin_required boolean,
  approved_at timestamp with time zone,
  godkendelse_runde integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    m.id, m.org_id, m.title, m.meeting_date,
    m.location, m.status, m.meeting_type,
    (m.share_pin_hash IS NOT NULL) AS pin_required,
    m.approved_at, m.godkendelse_runde
  FROM meetings m
  WHERE m.share_token = _token
    AND m.share_aktiv = true;
$function$;

-- Server-side PIN verification: replace get_shared_meeting_content with a version
-- that requires the correct PIN when one is configured.
DROP FUNCTION IF EXISTS public.get_shared_meeting_content(uuid);

CREATE OR REPLACE FUNCTION public.get_shared_meeting_content(_token uuid, _pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting_id uuid;
  v_pin_hash text;
  v_provided_hash text;
  v_result jsonb;
BEGIN
  SELECT id, share_pin_hash
    INTO v_meeting_id, v_pin_hash
  FROM meetings
  WHERE share_token = _token AND share_aktiv = true;

  IF v_meeting_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- If a PIN is set on the meeting, require & verify it server-side.
  IF v_pin_hash IS NOT NULL THEN
    IF _pin IS NULL OR length(_pin) = 0 THEN
      RETURN jsonb_build_object('error', 'pin_required');
    END IF;

    v_provided_hash := encode(digest(_pin, 'sha256'), 'hex');

    -- Constant-time-ish comparison via fixed-length text equality.
    IF v_provided_hash IS DISTINCT FROM v_pin_hash THEN
      RETURN jsonb_build_object('error', 'invalid_pin');
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'agenda_items', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ai.id, 'title', ai.title,
        'description', ai.description, 'sort_order', ai.sort_order
      ) ORDER BY ai.sort_order)
      FROM agenda_items ai WHERE ai.meeting_id = v_meeting_id
    ),
    'minutes_content', (
      SELECT content FROM minutes WHERE meeting_id = v_meeting_id LIMIT 1
    ),
    'afstemninger', (
      SELECT jsonb_agg(jsonb_build_object(
        'agenda_item_id', a.agenda_item_id,
        'spoergsmaal', a.spoergsmaal,
        'ja_antal', a.ja_antal,
        'nej_antal', a.nej_antal,
        'undladt_antal', a.undladt_antal,
        'er_hemmelig', a.er_hemmelig,
        'noter', a.noter
      ))
      FROM afstemninger a WHERE a.meeting_id = v_meeting_id
    ),
    'fremmoedte_antal', (
      SELECT COUNT(*) FROM approvals
      WHERE meeting_id = v_meeting_id AND fremmoedt = true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- pgcrypto provides digest(); ensure the extension is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
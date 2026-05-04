-- Migration 1: action_items beskrivelse + statusnote
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS beskrivelse text,
  ADD COLUMN IF NOT EXISTS statusnote text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS action_items_set_updated_at ON public.action_items;
CREATE TRIGGER action_items_set_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migration 2: fremmoedt på approvals
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS fremmoedt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fremmoedt_registreret_at timestamptz;

-- Migration 3: foreningsmedlemmer + delelink + quorum + tilladelse
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS kan_administrere_medlemsregister boolean DEFAULT false;

UPDATE public.role_permissions
  SET kan_administrere_medlemsregister = true
  WHERE role IN ('formand', 'kasserer');

CREATE OR REPLACE FUNCTION public.prevent_locked_formand_changes()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'formand' AND (
    NEW.kan_aendre_roller = false OR
    NEW.kan_redigere_forening = false OR
    NEW.kan_slette_dokumenter = false OR
    NEW.kan_invitere_medlemmer = false OR
    NEW.kan_fjerne_medlemmer = false OR
    NEW.kan_se_indstillinger = false OR
    NEW.kan_administrere_medlemsregister = false
  ) THEN
    RAISE EXCEPTION 'Låste formandstilladelser kan ikke deaktiveres.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.foreningsmedlemmer (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  navn                  text NOT NULL,
  email                 text,
  telefon               text,
  adresse               text,
  postnummer            text,
  by                    text,
  foedselsdato          date,
  tilmeldingsdato       date NOT NULL DEFAULT CURRENT_DATE,
  stemmeberettiget      boolean NOT NULL DEFAULT true,
  kontingent_status     text NOT NULL DEFAULT 'ikke_betalt'
    CHECK (kontingent_status IN ('betalt', 'ikke_betalt', 'fritaget')),
  kontingent_beloeb     integer,
  kontingentaar         integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  noter                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.foreningsmedlemmer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org-medlemmer kan se foreningsmedlemmer" ON public.foreningsmedlemmer;
CREATE POLICY "Org-medlemmer kan se foreningsmedlemmer"
  ON public.foreningsmedlemmer FOR SELECT
  USING (public.user_is_org_member(org_id));

DROP POLICY IF EXISTS "Org-medlemmer kan oprette foreningsmedlemmer" ON public.foreningsmedlemmer;
CREATE POLICY "Org-medlemmer kan oprette foreningsmedlemmer"
  ON public.foreningsmedlemmer FOR INSERT
  WITH CHECK (public.user_is_org_member(org_id));

DROP POLICY IF EXISTS "Org-medlemmer kan opdatere foreningsmedlemmer" ON public.foreningsmedlemmer;
CREATE POLICY "Org-medlemmer kan opdatere foreningsmedlemmer"
  ON public.foreningsmedlemmer FOR UPDATE
  USING (public.user_is_org_member(org_id));

DROP POLICY IF EXISTS "Org-medlemmer kan slette foreningsmedlemmer" ON public.foreningsmedlemmer;
CREATE POLICY "Org-medlemmer kan slette foreningsmedlemmer"
  ON public.foreningsmedlemmer FOR DELETE
  USING (public.user_is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_foreningsmedlemmer_org_id
  ON public.foreningsmedlemmer(org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_foreningsmedlemmer_email_per_org
  ON public.foreningsmedlemmer(org_id, email)
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS foreningsmedlemmer_set_updated_at ON public.foreningsmedlemmer;
CREATE TRIGGER foreningsmedlemmer_set_updated_at
  BEFORE UPDATE ON public.foreningsmedlemmer
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS quorum_naevner integer NOT NULL DEFAULT 4
    CHECK (quorum_naevner > 0);

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS share_pin_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS share_aktiv boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_meeting_by_share_token(_token uuid)
RETURNS TABLE (
  id uuid, org_id uuid, title text, meeting_date timestamptz,
  location text, status text, meeting_type text, share_pin_hash text,
  approved_at timestamptz, godkendelse_runde integer
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.org_id, m.title, m.meeting_date,
    m.location, m.status, m.meeting_type, m.share_pin_hash,
    m.approved_at, m.godkendelse_runde
  FROM meetings m
  WHERE m.share_token = _token
    AND m.share_aktiv = true;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_meeting_content(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_meeting_id
  FROM meetings
  WHERE share_token = _token AND share_aktiv = true;

  IF v_meeting_id IS NULL THEN
    RETURN NULL;
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
$$;

CREATE OR REPLACE FUNCTION public.insert_default_permissions(p_org_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = 'public'
AS $$
  INSERT INTO role_permissions
    (org_id, role,
     kan_oprette_moeder, kan_redigere_moeder, kan_sende_til_godkendelse,
     kan_godkende_referat, kan_se_dokumenter, kan_uploade_dokumenter, kan_slette_dokumenter,
     kan_lukke_andres_handlingspunkter, kan_invitere_medlemmer,
     kan_fjerne_medlemmer, kan_aendre_roller, kan_se_indstillinger,
     kan_redigere_forening, arver_formand_ved_fravaer,
     kan_administrere_medlemsregister)
  VALUES
  (p_org_id, 'formand',
   true,true,true,true,true,true,true,true,true,true,true,true,true,false,true),
  (p_org_id, 'naestformand',
   true,true,true,true,true,true,false,true,true,false,false,true,false,true,false),
  (p_org_id, 'kasserer',
   true,true,false,true,true,true,false,false,false,false,false,true,false,false,true),
  (p_org_id, 'bestyrelsesmedlem',
   false,false,false,true,false,false,false,false,false,false,false,false,false,false,false),
  (p_org_id, 'suppleant',
   false,false,false,true,false,false,false,false,false,false,false,false,false,false,false)
  ON CONFLICT (org_id, role) DO UPDATE SET
    kan_oprette_moeder = EXCLUDED.kan_oprette_moeder,
    kan_redigere_moeder = EXCLUDED.kan_redigere_moeder,
    kan_sende_til_godkendelse = EXCLUDED.kan_sende_til_godkendelse,
    kan_godkende_referat = EXCLUDED.kan_godkende_referat,
    kan_se_dokumenter = EXCLUDED.kan_se_dokumenter,
    kan_uploade_dokumenter = EXCLUDED.kan_uploade_dokumenter,
    kan_slette_dokumenter = EXCLUDED.kan_slette_dokumenter,
    kan_lukke_andres_handlingspunkter = EXCLUDED.kan_lukke_andres_handlingspunkter,
    kan_invitere_medlemmer = EXCLUDED.kan_invitere_medlemmer,
    kan_fjerne_medlemmer = EXCLUDED.kan_fjerne_medlemmer,
    kan_aendre_roller = EXCLUDED.kan_aendre_roller,
    kan_se_indstillinger = EXCLUDED.kan_se_indstillinger,
    kan_redigere_forening = EXCLUDED.kan_redigere_forening,
    arver_formand_ved_fravaer = EXCLUDED.arver_formand_ved_fravaer,
    kan_administrere_medlemsregister = EXCLUDED.kan_administrere_medlemsregister,
    updated_at = now();
$$;
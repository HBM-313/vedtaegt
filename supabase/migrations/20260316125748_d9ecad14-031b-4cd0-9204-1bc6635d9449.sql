
-- TRIN 1: Opret role_permissions tabel
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'formand','naestformand','kasserer','bestyrelsesmedlem','suppleant'
  )),
  kan_oprette_moeder boolean DEFAULT false,
  kan_redigere_moeder boolean DEFAULT false,
  kan_sende_til_godkendelse boolean DEFAULT false,
  kan_godkende_referat boolean DEFAULT true,
  kan_uploade_dokumenter boolean DEFAULT false,
  kan_slette_dokumenter boolean DEFAULT false,
  kan_lukke_andres_handlingspunkter boolean DEFAULT false,
  kan_invitere_medlemmer boolean DEFAULT false,
  kan_fjerne_medlemmer boolean DEFAULT false,
  kan_aendre_roller boolean DEFAULT false,
  kan_se_indstillinger boolean DEFAULT false,
  kan_redigere_forening boolean DEFAULT false,
  arver_formand_ved_fravaer boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, role)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medlemmer kan se egne org tilladelser"
ON role_permissions FOR SELECT
USING (user_is_org_member(org_id));

CREATE POLICY "medlemmer kan opdatere egne org tilladelser"
ON role_permissions FOR UPDATE
USING (user_is_org_member(org_id));

CREATE POLICY "medlemmer kan oprette org tilladelser"
ON role_permissions FOR INSERT
WITH CHECK (user_is_org_member(org_id));

-- TRIN 2: Tilføj kolonner
ALTER TABLE members
ADD COLUMN IF NOT EXISTS er_fravaerende boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fravaerende_siden timestamptz;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS permission_version integer DEFAULT 1;

-- TRIN 3: Standard-tilladelser funktion
CREATE OR REPLACE FUNCTION insert_default_permissions(p_org_id uuid)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO role_permissions
    (org_id, role,
     kan_oprette_moeder, kan_redigere_moeder, kan_sende_til_godkendelse,
     kan_godkende_referat, kan_uploade_dokumenter, kan_slette_dokumenter,
     kan_lukke_andres_handlingspunkter, kan_invitere_medlemmer,
     kan_fjerne_medlemmer, kan_aendre_roller, kan_se_indstillinger,
     kan_redigere_forening, arver_formand_ved_fravaer)
  VALUES
  (p_org_id, 'formand',
   true,true,true,true,true,true,true,true,true,true,true,true,false),
  (p_org_id, 'naestformand',
   true,true,true,true,true,false,true,true,false,false,true,false,true),
  (p_org_id, 'kasserer',
   true,true,false,true,true,false,false,false,false,false,true,false,false),
  (p_org_id, 'bestyrelsesmedlem',
   false,false,false,true,false,false,false,false,false,false,false,false,false),
  (p_org_id, 'suppleant',
   false,false,false,true,false,false,false,false,false,false,false,false,false)
  ON CONFLICT (org_id, role) DO UPDATE SET
    kan_oprette_moeder = EXCLUDED.kan_oprette_moeder,
    kan_redigere_moeder = EXCLUDED.kan_redigere_moeder,
    kan_sende_til_godkendelse = EXCLUDED.kan_sende_til_godkendelse,
    kan_godkende_referat = EXCLUDED.kan_godkende_referat,
    kan_uploade_dokumenter = EXCLUDED.kan_uploade_dokumenter,
    kan_slette_dokumenter = EXCLUDED.kan_slette_dokumenter,
    kan_lukke_andres_handlingspunkter = EXCLUDED.kan_lukke_andres_handlingspunkter,
    kan_invitere_medlemmer = EXCLUDED.kan_invitere_medlemmer,
    kan_fjerne_medlemmer = EXCLUDED.kan_fjerne_medlemmer,
    kan_aendre_roller = EXCLUDED.kan_aendre_roller,
    kan_se_indstillinger = EXCLUDED.kan_se_indstillinger,
    kan_redigere_forening = EXCLUDED.kan_redigere_forening,
    arver_formand_ved_fravaer = EXCLUDED.arver_formand_ved_fravaer,
    updated_at = now();
$$;

-- TRIN 4: Trigger der låser formandstilladelser
CREATE OR REPLACE FUNCTION prevent_locked_formand_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'formand' AND (
    NEW.kan_aendre_roller = false OR
    NEW.kan_redigere_forening = false OR
    NEW.kan_slette_dokumenter = false OR
    NEW.kan_invitere_medlemmer = false OR
    NEW.kan_fjerne_medlemmer = false OR
    NEW.kan_se_indstillinger = false
  ) THEN
    RAISE EXCEPTION 'Låste formandstilladelser kan ikke deaktiveres.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_formand_permissions
BEFORE UPDATE ON role_permissions
FOR EACH ROW EXECUTE FUNCTION prevent_locked_formand_changes();

-- Seed default permissions for existing orgs
INSERT INTO role_permissions (org_id, role,
  kan_oprette_moeder, kan_redigere_moeder, kan_sende_til_godkendelse,
  kan_godkende_referat, kan_uploade_dokumenter, kan_slette_dokumenter,
  kan_lukke_andres_handlingspunkter, kan_invitere_medlemmer,
  kan_fjerne_medlemmer, kan_aendre_roller, kan_se_indstillinger,
  kan_redigere_forening, arver_formand_ved_fravaer)
SELECT o.id, r.role,
  r.kan_oprette_moeder, r.kan_redigere_moeder, r.kan_sende_til_godkendelse,
  r.kan_godkende_referat, r.kan_uploade_dokumenter, r.kan_slette_dokumenter,
  r.kan_lukke_andres_handlingspunkter, r.kan_invitere_medlemmer,
  r.kan_fjerne_medlemmer, r.kan_aendre_roller, r.kan_se_indstillinger,
  r.kan_redigere_forening, r.arver_formand_ved_fravaer
FROM organizations o
CROSS JOIN (VALUES
  ('formand', true,true,true,true,true,true,true,true,true,true,true,true,false),
  ('naestformand', true,true,true,true,true,false,true,true,false,false,true,false,true),
  ('kasserer', true,true,false,true,true,false,false,false,false,false,true,false,false),
  ('bestyrelsesmedlem', false,false,false,true,false,false,false,false,false,false,false,false,false),
  ('suppleant', false,false,false,true,false,false,false,false,false,false,false,false,false)
) AS r(role, kan_oprette_moeder, kan_redigere_moeder, kan_sende_til_godkendelse,
  kan_godkende_referat, kan_uploade_dokumenter, kan_slette_dokumenter,
  kan_lukke_andres_handlingspunkter, kan_invitere_medlemmer,
  kan_fjerne_medlemmer, kan_aendre_roller, kan_se_indstillinger,
  kan_redigere_forening, arver_formand_ved_fravaer)
ON CONFLICT (org_id, role) DO NOTHING;

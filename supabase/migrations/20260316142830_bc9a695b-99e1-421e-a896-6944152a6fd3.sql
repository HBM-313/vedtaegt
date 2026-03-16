
-- Add kan_se_dokumenter to role_permissions
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS kan_se_dokumenter boolean DEFAULT true;

-- Create document_categories table
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  retention_years integer DEFAULT 3,
  color text DEFAULT 'bg-muted text-muted-foreground border-border',
  er_aktiv boolean DEFAULT true,
  er_laast boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medlemmer kan se org kategorier" ON document_categories FOR SELECT USING (user_is_org_member(org_id));
CREATE POLICY "Medlemmer kan oprette org kategorier" ON document_categories FOR INSERT WITH CHECK (user_is_org_member(org_id));
CREATE POLICY "Medlemmer kan opdatere org kategorier" ON document_categories FOR UPDATE USING (user_is_org_member(org_id));
CREATE POLICY "Medlemmer kan slette org kategorier" ON document_categories FOR DELETE USING (user_is_org_member(org_id));

-- Add meeting_id, agenda_item_id, kilde to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agenda_item_id uuid REFERENCES agenda_items(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS kilde text DEFAULT 'upload';

-- Update insert_default_permissions to include kan_se_dokumenter
CREATE OR REPLACE FUNCTION public.insert_default_permissions(p_org_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  INSERT INTO role_permissions
    (org_id, role,
     kan_oprette_moeder, kan_redigere_moeder, kan_sende_til_godkendelse,
     kan_godkende_referat, kan_se_dokumenter, kan_uploade_dokumenter, kan_slette_dokumenter,
     kan_lukke_andres_handlingspunkter, kan_invitere_medlemmer,
     kan_fjerne_medlemmer, kan_aendre_roller, kan_se_indstillinger,
     kan_redigere_forening, arver_formand_ved_fravaer)
  VALUES
  (p_org_id, 'formand',
   true,true,true,true,true,true,true,true,true,true,true,true,true,false),
  (p_org_id, 'naestformand',
   true,true,true,true,true,true,false,true,true,false,false,true,false,true),
  (p_org_id, 'kasserer',
   true,true,false,true,true,true,false,false,false,false,false,true,false,false),
  (p_org_id, 'bestyrelsesmedlem',
   false,false,false,true,false,false,false,false,false,false,false,false,false,false),
  (p_org_id, 'suppleant',
   false,false,false,true,false,false,false,false,false,false,false,false,false,false)
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
    updated_at = now();
$function$;

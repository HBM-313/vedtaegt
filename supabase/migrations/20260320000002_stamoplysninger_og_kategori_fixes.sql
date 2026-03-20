-- ══════════════════════════════════════════════════════════════
-- Fix 1: Tilføj "Fra møder" som standard låst kategori
-- Denne manglede i listen af standardkategorier
-- ══════════════════════════════════════════════════════════════
INSERT INTO document_categories (org_id, name, label, sort_order, er_aktiv, er_laast, retention_years, color)
SELECT o.id, 'fra_moeder', 'Fra møder', 5, true, true, 10, 'bg-blue-50 text-blue-700 border-blue-100'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM document_categories d
  WHERE d.org_id = o.id AND d.name = 'fra_moeder'
);

-- ══════════════════════════════════════════════════════════════
-- Fix 2: Opdater insert_default_permissions til at inkludere
-- "Fra møder" som standard låst kategori
-- ══════════════════════════════════════════════════════════════
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

  INSERT INTO document_categories (org_id, name, label, sort_order, er_aktiv, er_laast, retention_years, color)
  VALUES
    (p_org_id, 'referat',    'Referat',    0, true, true, 10, 'bg-blue-100 text-blue-800 border-blue-200'),
    (p_org_id, 'regnskab',   'Regnskab',   1, true, true,  5, 'bg-orange-100 text-orange-800 border-orange-200'),
    (p_org_id, 'vedtaegt',   'Vedtægt',    2, true, true, 10, 'bg-purple-100 text-purple-800 border-purple-200'),
    (p_org_id, 'forsikring', 'Forsikring', 3, true, true, 10, 'bg-green-100 text-green-800 border-green-200'),
    (p_org_id, 'other',      'Øvrige',     4, true, true,  3, 'bg-muted text-muted-foreground border-border'),
    (p_org_id, 'fra_moeder', 'Fra møder',  5, true, true, 10, 'bg-blue-50 text-blue-700 border-blue-100')
  ON CONFLICT (org_id, name) DO NOTHING;
$$;

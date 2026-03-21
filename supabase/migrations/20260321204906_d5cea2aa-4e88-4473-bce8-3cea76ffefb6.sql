
-- 1. Møde-type på meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_type text
    NOT NULL DEFAULT 'bestyrelsesoede'
    CHECK (meeting_type IN (
      'bestyrelsesoede',
      'ordinaer_generalforsamling',
      'ekstraordinaer_generalforsamling'
    ));

-- 2. Afstemninger
CREATE TABLE IF NOT EXISTS public.afstemninger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id       uuid NOT NULL REFERENCES public.meetings(id)     ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agenda_item_id   uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  spoergsmaal      text NOT NULL,
  ja_antal         integer NOT NULL DEFAULT 0 CHECK (ja_antal >= 0),
  nej_antal        integer NOT NULL DEFAULT 0 CHECK (nej_antal >= 0),
  undladt_antal    integer NOT NULL DEFAULT 0 CHECK (undladt_antal >= 0),
  er_hemmelig      boolean NOT NULL DEFAULT false,
  noter            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.afstemninger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'afstemninger' AND policyname = 'Medlemmer kan se org afstemninger') THEN
    CREATE POLICY "Medlemmer kan se org afstemninger" ON public.afstemninger FOR SELECT USING (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'afstemninger' AND policyname = 'Medlemmer kan oprette org afstemninger') THEN
    CREATE POLICY "Medlemmer kan oprette org afstemninger" ON public.afstemninger FOR INSERT WITH CHECK (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'afstemninger' AND policyname = 'Medlemmer kan opdatere org afstemninger') THEN
    CREATE POLICY "Medlemmer kan opdatere org afstemninger" ON public.afstemninger FOR UPDATE USING (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'afstemninger' AND policyname = 'Medlemmer kan slette org afstemninger') THEN
    CREATE POLICY "Medlemmer kan slette org afstemninger" ON public.afstemninger FOR DELETE USING (public.user_is_org_member(org_id));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_afstemninger_meeting_id ON public.afstemninger(meeting_id);
CREATE INDEX IF NOT EXISTS idx_afstemninger_agenda_item_id ON public.afstemninger(agenda_item_id);

-- 3. Vedtægtsversioner
CREATE TABLE IF NOT EXISTS public.vedtaegt_versioner (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id    uuid          REFERENCES public.documents(id)     ON DELETE SET NULL,
  version_label  text NOT NULL,
  er_gaeldende   boolean NOT NULL DEFAULT false,
  godkendt_dato  date,
  moede_id       uuid          REFERENCES public.meetings(id)      ON DELETE SET NULL,
  noter          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vedtaegt_versioner ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vedtaegt_versioner' AND policyname = 'Medlemmer kan se org vedtægtsversioner') THEN
    CREATE POLICY "Medlemmer kan se org vedtægtsversioner" ON public.vedtaegt_versioner FOR SELECT USING (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vedtaegt_versioner' AND policyname = 'Medlemmer kan oprette org vedtægtsversioner') THEN
    CREATE POLICY "Medlemmer kan oprette org vedtægtsversioner" ON public.vedtaegt_versioner FOR INSERT WITH CHECK (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vedtaegt_versioner' AND policyname = 'Medlemmer kan opdatere org vedtægtsversioner') THEN
    CREATE POLICY "Medlemmer kan opdatere org vedtægtsversioner" ON public.vedtaegt_versioner FOR UPDATE USING (public.user_is_org_member(org_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vedtaegt_versioner' AND policyname = 'Medlemmer kan slette org vedtægtsversioner') THEN
    CREATE POLICY "Medlemmer kan slette org vedtægtsversioner" ON public.vedtaegt_versioner FOR DELETE USING (public.user_is_org_member(org_id));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vedtaegt_gaeldende_per_org ON public.vedtaegt_versioner(org_id) WHERE er_gaeldende = true;
CREATE INDEX IF NOT EXISTS idx_vedtaegt_versioner_org_id ON public.vedtaegt_versioner(org_id);

-- 4. Trigger: updated_at på afstemninger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS afstemninger_set_updated_at ON public.afstemninger;
CREATE TRIGGER afstemninger_set_updated_at
  BEFORE UPDATE ON public.afstemninger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. oprettet_af på vedtaegt_versioner
ALTER TABLE public.vedtaegt_versioner
  ADD COLUMN IF NOT EXISTS oprettet_af uuid
    REFERENCES public.members(id) ON DELETE SET NULL;

-- 6. Opdater insert_default_permissions med "Fra møder" kategori
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

-- 7. Unique constraint på document_categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_categories_org_name
  ON public.document_categories(org_id, name);

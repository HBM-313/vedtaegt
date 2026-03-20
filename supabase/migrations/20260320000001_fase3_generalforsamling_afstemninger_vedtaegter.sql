-- ══════════════════════════════════════════════════════════
-- FASE 3: Generalforsamling, Afstemninger, Vedtægtsversioner
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. Møde-type på meetings
--    Backward compatible: existing rows får 'bestyrelsesoede'
-- ─────────────────────────────────────────────
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_type text
    NOT NULL DEFAULT 'bestyrelsesoede'
    CHECK (meeting_type IN (
      'bestyrelsesoede',
      'ordinaer_generalforsamling',
      'ekstraordinaer_generalforsamling'
    ));

-- ─────────────────────────────────────────────
-- 2. Afstemninger
--    GDPR-design: kun aggregerede tal gemmes.
--    Ingen individuel stemme-tracking.
--    Kræver ingen persondata udover hvad der
--    allerede er i møde-konteksten.
-- ─────────────────────────────────────────────
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

CREATE POLICY "Medlemmer kan se org afstemninger"
  ON public.afstemninger FOR SELECT
  USING (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan oprette org afstemninger"
  ON public.afstemninger FOR INSERT
  WITH CHECK (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan opdatere org afstemninger"
  ON public.afstemninger FOR UPDATE
  USING (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan slette org afstemninger"
  ON public.afstemninger FOR DELETE
  USING (public.user_is_org_member(org_id));

-- Index for hurtig opslag per møde
CREATE INDEX IF NOT EXISTS idx_afstemninger_meeting_id
  ON public.afstemninger(meeting_id);

CREATE INDEX IF NOT EXISTS idx_afstemninger_agenda_item_id
  ON public.afstemninger(agenda_item_id);

-- ─────────────────────────────────────────────
-- 3. Vedtægtsversioner
--    Kobler til eksisterende documents-tabel.
--    Én gældende version pr. org ad gangen.
-- ─────────────────────────────────────────────
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

CREATE POLICY "Medlemmer kan se org vedtægtsversioner"
  ON public.vedtaegt_versioner FOR SELECT
  USING (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan oprette org vedtægtsversioner"
  ON public.vedtaegt_versioner FOR INSERT
  WITH CHECK (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan opdatere org vedtægtsversioner"
  ON public.vedtaegt_versioner FOR UPDATE
  USING (public.user_is_org_member(org_id));

CREATE POLICY "Medlemmer kan slette org vedtægtsversioner"
  ON public.vedtaegt_versioner FOR DELETE
  USING (public.user_is_org_member(org_id));

-- Kun én gældende version pr. org
CREATE UNIQUE INDEX IF NOT EXISTS idx_vedtaegt_gaeldende_per_org
  ON public.vedtaegt_versioner(org_id)
  WHERE er_gaeldende = true;

-- Index for hurtig opslag per org
CREATE INDEX IF NOT EXISTS idx_vedtaegt_versioner_org_id
  ON public.vedtaegt_versioner(org_id);

-- ─────────────────────────────────────────────
-- 4. Trigger: sæt updated_at på afstemninger
-- ─────────────────────────────────────────────
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

CREATE TRIGGER afstemninger_set_updated_at
  BEFORE UPDATE ON public.afstemninger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

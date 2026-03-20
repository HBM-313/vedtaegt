-- Tilføj oprettet_af til vedtaegt_versioner så vi kan vise
-- hvem der uploadede og hvornår (med tid, ikke kun dato)
ALTER TABLE public.vedtaegt_versioner
  ADD COLUMN IF NOT EXISTS oprettet_af uuid
    REFERENCES public.members(id) ON DELETE SET NULL;

-- Opdater kilde på eksisterende vedtægtsdokumenter
-- (dem der er tilknyttet en vedtaegt_version)
UPDATE public.documents d
SET kilde = 'vedtaegt'
WHERE d.category = 'vedtaegt'
  AND EXISTS (
    SELECT 1 FROM public.vedtaegt_versioner v
    WHERE v.document_id = d.id
  );

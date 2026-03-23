-- Tilføj beskrivelse og statusnotat til handlingspunkter
ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS beskrivelse text,
  ADD COLUMN IF NOT EXISTS statusnote text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger for updated_at (genbrug set_updated_at fra fase 3)
CREATE TRIGGER action_items_set_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

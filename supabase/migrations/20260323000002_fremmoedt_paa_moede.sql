-- Tilføj fremmøde-felt på approvals
-- Separat fra godkendelse: man kan møde op uden at godkende referatet,
-- og man kan godkende referatet uden at have mødt op (fjerngodkendelse).
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS fremmoedt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fremmoedt_registreret_at timestamptz;

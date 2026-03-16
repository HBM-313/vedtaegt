
-- Add columns to approvals
ALTER TABLE approvals
ADD COLUMN IF NOT EXISTS status text DEFAULT 'afventer',
ADD COLUMN IF NOT EXISTS afvist_kommentar text,
ADD COLUMN IF NOT EXISTS paamindelse_efter_dage integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS paamindelse_sendt_at timestamptz,
ADD COLUMN IF NOT EXISTS sendt_at timestamptz;

-- Add columns to meetings
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS godkendelse_frist_dage integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS afvist_af uuid REFERENCES members(id),
ADD COLUMN IF NOT EXISTS afvist_at timestamptz,
ADD COLUMN IF NOT EXISTS afvist_kommentar text,
ADD COLUMN IF NOT EXISTS godkendelse_runde integer DEFAULT 1;

-- Create view for approval status overview
CREATE OR REPLACE VIEW meeting_approval_status AS
SELECT
  m.id AS meeting_id,
  m.org_id,
  m.title,
  m.status,
  m.godkendelse_runde,
  COUNT(a.id) AS total_inviterede,
  COUNT(CASE WHEN a.status = 'godkendt' THEN 1 END) AS antal_godkendt,
  COUNT(CASE WHEN a.status = 'afvist' THEN 1 END) AS antal_afvist,
  COUNT(CASE WHEN a.status = 'afventer' THEN 1 END) AS antal_afventer
FROM meetings m
LEFT JOIN approvals a ON a.meeting_id = m.id
GROUP BY m.id, m.org_id, m.title, m.status, m.godkendelse_runde;

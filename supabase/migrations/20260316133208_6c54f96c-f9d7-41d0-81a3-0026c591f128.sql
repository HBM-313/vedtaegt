
-- Fix the security definer view by making it use invoker security
DROP VIEW IF EXISTS meeting_approval_status;
CREATE VIEW meeting_approval_status WITH (security_invoker = true) AS
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

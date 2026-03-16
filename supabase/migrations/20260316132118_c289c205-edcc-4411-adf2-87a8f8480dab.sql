
-- Lock team permissions OFF for roles other than formand and næstformand
UPDATE role_permissions
SET kan_invitere_medlemmer = false, kan_fjerne_medlemmer = false
WHERE role IN ('kasserer', 'bestyrelsesmedlem', 'suppleant');

-- Trigger to prevent future changes
CREATE OR REPLACE FUNCTION prevent_team_permissions_for_other_roles()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IN ('kasserer', 'bestyrelsesmedlem', 'suppleant') AND (
    NEW.kan_invitere_medlemmer = true OR
    NEW.kan_fjerne_medlemmer = true
  ) THEN
    RAISE EXCEPTION 'Invitere og fjerne medlemmer kan kun tildeles næstformanden.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_team_permissions_for_other_roles
BEFORE INSERT OR UPDATE ON role_permissions
FOR EACH ROW EXECUTE FUNCTION prevent_team_permissions_for_other_roles();


-- Fix search_path on the new function
ALTER FUNCTION prevent_team_permissions_for_other_roles() SET search_path = 'public';

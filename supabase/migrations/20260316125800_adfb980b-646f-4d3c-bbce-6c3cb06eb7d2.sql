
-- Fix search_path on new functions
ALTER FUNCTION insert_default_permissions(uuid) SET search_path = public;
ALTER FUNCTION prevent_locked_formand_changes() SET search_path = public;

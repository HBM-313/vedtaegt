import { useOrg } from "@/components/AppLayout";
import { getRolePermissions, type RolePermissions } from "@/lib/roles";

export function usePermissions(): RolePermissions & { role: string | null } {
  const { memberRole } = useOrg();
  const perms = getRolePermissions(memberRole);
  return { ...perms, role: memberRole };
}

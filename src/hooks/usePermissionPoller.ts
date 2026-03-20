import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchPermissions, fetchMembers } from "@/hooks/useOrgLoader";
import type { RolePermission, OrgMember } from "@/context/OrgContext";
import type { Database } from "@/integrations/supabase/types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

interface PollerOptions {
  orgId: string | null;
  onUpdate: (rolePerms: Record<string, RolePermission> | null, members: OrgMember[]) => void;
  intervalMs?: number;
}

// Poller permission_version på organizations-tabellen hvert 60s.
// Når versionen ændrer sig genindlæses permissions + members.
export function usePermissionPoller({ orgId, onUpdate, intervalMs = 60_000 }: PollerOptions) {
  const permVersionRef = useRef<number | null>(null);

  // Hent initial version når orgId er klar
  useEffect(() => {
    if (!orgId) return;

    supabase
      .from("organizations")
      .select("permission_version")
      .eq("id", orgId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("usePermissionPoller: kunne ikke hente initial version:", error.message);
          return;
        }
        permVersionRef.current = (data as Pick<OrganizationRow, "permission_version">)
          ?.permission_version ?? 1;
      });
  }, [orgId]);

  // Poll hvert intervalMs
  useEffect(() => {
    if (!orgId) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("permission_version")
        .eq("id", orgId)
        .single();

      if (error) {
        console.error("usePermissionPoller: fejl ved polling:", error.message);
        return;
      }

      const newVersion =
        (data as Pick<OrganizationRow, "permission_version">)?.permission_version ?? 1;

      if (permVersionRef.current !== null && newVersion !== permVersionRef.current) {
        permVersionRef.current = newVersion;

        const [rolePerms, orgMembers] = await Promise.all([
          fetchPermissions(orgId),
          fetchMembers(orgId),
        ]);

        onUpdate(rolePerms, orgMembers);
        toast.info("Dine tilladelser er blevet opdateret af formanden.");
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [orgId, onUpdate, intervalMs]);
}

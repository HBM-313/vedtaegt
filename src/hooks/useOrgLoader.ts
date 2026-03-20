import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RolePermission, OrgMember, OrgContextType } from "@/context/OrgContext";

type OrgState = Omit<OrgContextType, "refetchPermissions">;

const EMPTY_STATE: OrgState = {
  orgId: null,
  orgName: null,
  memberId: null,
  memberName: null,
  memberRole: null,
  userId: null,
  rolePermissions: null,
  members: null,
};

// Henter tilladelser for alle roller i en organisation
async function fetchPermissions(orgId: string): Promise<Record<string, RolePermission> | null> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    console.error("useOrgLoader: fejl ved hentning af tilladelser:", error.message);
    return null;
  }
  if (!data) return null;

  const map: Record<string, RolePermission> = {};
  data.forEach((row: any) => {
    map[row.role] = {
      kan_oprette_moeder: row.kan_oprette_moeder,
      kan_redigere_moeder: row.kan_redigere_moeder,
      kan_sende_til_godkendelse: row.kan_sende_til_godkendelse,
      kan_godkende_referat: row.kan_godkende_referat,
      kan_se_dokumenter: row.kan_se_dokumenter,
      kan_uploade_dokumenter: row.kan_uploade_dokumenter,
      kan_slette_dokumenter: row.kan_slette_dokumenter,
      kan_lukke_andres_handlingspunkter: row.kan_lukke_andres_handlingspunkter,
      kan_invitere_medlemmer: row.kan_invitere_medlemmer,
      kan_fjerne_medlemmer: row.kan_fjerne_medlemmer,
      kan_aendre_roller: row.kan_aendre_roller,
      kan_se_indstillinger: row.kan_se_indstillinger,
      kan_redigere_forening: row.kan_redigere_forening,
      arver_formand_ved_fravaer: row.arver_formand_ved_fravaer,
    };
  });
  return map;
}

// Henter alle aktive medlemmer i en organisation
async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("members")
    .select("id, role, name, er_fravaerende")
    .eq("org_id", orgId);

  if (error) {
    console.error("useOrgLoader: fejl ved hentning af medlemmer:", error.message);
    return [];
  }
  return (data as OrgMember[]) || [];
}

// Fuldfører en pending signup: opretter organisation og formand-member i DB
async function completePendingSignup(user: any, pendingData: any): Promise<boolean> {
  try {
    // Idempotent: tjek om member allerede findes
    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      // Allerede oprettet — ryd op og fortsæt
      localStorage.removeItem("vedtaegt_pending_signup");
      await supabase.auth.updateUser({ data: { pending_signup: null } });
      return true;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: pendingData.orgName,
        cvr: pendingData.cvr,
        plan: "free",
        dpa_accepted_at: new Date().toISOString(),
        dpa_version: "1.0",
        adresse: pendingData.orgAdresse || null,
        postnummer: pendingData.orgPostnummer || null,
        by: pendingData.orgBy || null,
        telefon: pendingData.orgTelefon || null,
        kontakt_email: pendingData.orgEmail || null,
      } as any)
      .select()
      .single();

    if (orgError) {
      console.error("useOrgLoader: fejl ved oprettelse af organisation:", orgError.message);
      return false;
    }

    if (org) {
      const { error: rpcError } = await supabase.rpc("insert_default_permissions", {
        p_org_id: org.id,
      });
      if (rpcError) {
        console.error("useOrgLoader: fejl ved insert_default_permissions:", rpcError.message);
      }

      const now = new Date().toISOString();
      const { error: memberError } = await supabase.from("members").insert({
        org_id: org.id,
        user_id: user.id,
        role: "formand",
        name: pendingData.name,
        email: pendingData.email || user.email,
        joined_at: now,
        marketing_consent: pendingData.marketingConsent || false,
        marketing_consent_at: pendingData.marketingConsent ? now : null,
        telefon: pendingData.telefon || null,
        adresse: pendingData.adresse || null,
        postnummer: pendingData.postnummer || null,
        by: pendingData.by || null,
        foedselsdato: pendingData.foedselsdato || null,
        email_bekraeftet: true,
      } as any);

      if (memberError) {
        console.error("useOrgLoader: fejl ved oprettelse af formand-member:", memberError.message);
        // Ikke fatal — member kan muligvis allerede eksistere (race condition)
      }
    }

    localStorage.removeItem("vedtaegt_pending_signup");
    await supabase.auth.updateUser({ data: { pending_signup: null } });
    return true;
  } catch (err: any) {
    console.error("useOrgLoader: uventet fejl i completePendingSignup:", err.message ?? err);
    localStorage.removeItem("vedtaegt_pending_signup");
    return false;
  }
}

// ─────────────────────────────────────────────
// Hoved-hook
// ─────────────────────────────────────────────
export function useOrgLoader() {
  const [orgState, setOrgState] = useState<OrgState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Eksponeres til AppLayout så permission_poller kan opdatere state
  const updatePermissionsAndMembers = useCallback(
    async (orgId: string) => {
      const [rolePerms, orgMembers] = await Promise.all([
        fetchPermissions(orgId),
        fetchMembers(orgId),
      ]);
      setOrgState((prev) => ({ ...prev, rolePermissions: rolePerms, members: orgMembers }));
    },
    []
  );

  // Fuldfører refetchPermissions kaldt fra context
  const refetchForOrg = useCallback(
    async (orgId: string) => {
      await updatePermissionsAndMembers(orgId);
    },
    [updatePermissionsAndMembers]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("useOrgLoader: kunne ikke hente bruger:", userError.message);
      setError("Kunne ikke verificere din session. Prøv at logge ud og ind igen.");
      setLoading(false);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }

    // ── Pending signup ──────────────────────────────────
    let pendingData: any = null;
    const pendingRaw = localStorage.getItem("vedtaegt_pending_signup");
    if (pendingRaw) {
      try {
        const parsed = JSON.parse(pendingRaw);
        if (parsed.userId === user.id || parsed.email === user.email) {
          pendingData = parsed;
        }
      } catch {
        localStorage.removeItem("vedtaegt_pending_signup");
      }
    }
    if (!pendingData && user.user_metadata?.pending_signup) {
      pendingData = user.user_metadata.pending_signup;
    }

    if (pendingData) {
      const ok = await completePendingSignup(user, pendingData);
      if (!ok) {
        setError(
          "Der opstod en fejl under oprettelsen af din forening. Prøv at logge ud og ind igen."
        );
        setLoading(false);
        return;
      }
    }

    // ── Hent member + org ───────────────────────────────
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, org_id, name, role, organizations(name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("useOrgLoader: fejl ved hentning af member:", memberError.message);
      setError("Din brugerprofil kunne ikke hentes. Prøv at logge ud og ind igen.");
      setLoading(false);
      return;
    }

    if (!member) {
      setError("Din brugerprofil kunne ikke findes. Prøv at logge ud og ind igen.");
      setLoading(false);
      return;
    }

    const org = member.organizations as unknown as { name: string } | null;
    const orgId = member.org_id!;

    const [rolePerms, orgMembers] = await Promise.all([
      fetchPermissions(orgId),
      fetchMembers(orgId),
    ]);

    setOrgState({
      orgId,
      orgName: org?.name ?? null,
      memberId: member.id,
      memberName: member.name,
      memberRole: member.role,
      userId: user.id,
      rolePermissions: rolePerms,
      members: orgMembers,
    });

    setLoading(false);
  }, []);

  return {
    orgState,
    loading,
    error,
    load,
    updatePermissionsAndMembers,
    refetchForOrg,
    setOrgState,
  };
}

// Re-eksportér hjælpefunktioner til brug i usePermissionPoller
export { fetchPermissions, fetchMembers };

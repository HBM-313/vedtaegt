import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RolePermission, OrgMember, OrgContextType } from "@/context/OrgContext";
import type { Database } from "@/integrations/supabase/types";

type OrgState = Omit<OrgContextType, "refetchPermissions">;

type RolePermissionRow = Database["public"]["Tables"]["role_permissions"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

// Pending signup-data gemt i localStorage / user_metadata
interface PendingSignupData {
  userId?: string;
  email?: string;
  name: string;
  orgName: string;
  cvr?: string | null;
  orgAdresse?: string | null;
  orgPostnummer?: string | null;
  orgBy?: string | null;
  orgTelefon?: string | null;
  orgEmail?: string | null;
  marketingConsent?: boolean;
  telefon?: string | null;
  adresse?: string | null;
  postnummer?: string | null;
  by?: string | null;
  foedselsdato?: string | null;
}

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
export async function fetchPermissions(
  orgId: string
): Promise<Record<string, RolePermission> | null> {
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
  (data as RolePermissionRow[]).forEach((row) => {
    map[row.role] = {
      kan_oprette_moeder: row.kan_oprette_moeder ?? false,
      kan_redigere_moeder: row.kan_redigere_moeder ?? false,
      kan_sende_til_godkendelse: row.kan_sende_til_godkendelse ?? false,
      kan_godkende_referat: row.kan_godkende_referat ?? true,
      kan_se_dokumenter: row.kan_se_dokumenter ?? false,
      kan_uploade_dokumenter: row.kan_uploade_dokumenter ?? false,
      kan_slette_dokumenter: row.kan_slette_dokumenter ?? false,
      kan_lukke_andres_handlingspunkter: row.kan_lukke_andres_handlingspunkter ?? false,
      kan_invitere_medlemmer: row.kan_invitere_medlemmer ?? false,
      kan_fjerne_medlemmer: row.kan_fjerne_medlemmer ?? false,
      kan_aendre_roller: row.kan_aendre_roller ?? false,
      kan_se_indstillinger: row.kan_se_indstillinger ?? false,
      kan_redigere_forening: row.kan_redigere_forening ?? false,
      arver_formand_ved_fravaer: row.arver_formand_ved_fravaer ?? false,
    };
  });
  return map;
}

// Henter alle aktive medlemmer i en organisation
export async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("members")
    .select("id, role, name, er_fravaerende")
    .eq("org_id", orgId);

  if (error) {
    console.error("useOrgLoader: fejl ved hentning af medlemmer:", error.message);
    return [];
  }

  return (data as Pick<MemberRow, "id" | "role" | "name" | "er_fravaerende">[]).map((m) => ({
    id: m.id,
    role: m.role,
    name: m.name,
    er_fravaerende: m.er_fravaerende ?? false,
  }));
}

// Fuldfører en pending signup: opretter organisation og formand-member i DB
async function completePendingSignup(
  userId: string,
  userEmail: string | undefined,
  pendingData: PendingSignupData
): Promise<boolean> {
  try {
    // Idempotent: tjek om member allerede findes
    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember) {
      localStorage.removeItem("vedtaegt_pending_signup");
      await supabase.auth.updateUser({ data: { pending_signup: null } });
      return true;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: pendingData.orgName,
        cvr: pendingData.cvr ?? null,
        plan: "free",
        dpa_accepted_at: new Date().toISOString(),
        dpa_version: "1.0",
        adresse: pendingData.orgAdresse ?? null,
        postnummer: pendingData.orgPostnummer ?? null,
        by: pendingData.orgBy ?? null,
        telefon: pendingData.orgTelefon ?? null,
        kontakt_email: pendingData.orgEmail ?? null,
      })
      .select()
      .single();

    if (orgError) {
      console.error("useOrgLoader: fejl ved oprettelse af organisation:", orgError.message);
      return false;
    }

    if (org) {
      const { error: rpcError } = await supabase.rpc("insert_default_permissions", {
        p_org_id: (org as OrganizationRow).id,
      });
      if (rpcError) {
        console.error("useOrgLoader: fejl ved insert_default_permissions:", rpcError.message);
      }

      const now = new Date().toISOString();
      const { error: memberError } = await supabase.from("members").insert({
        org_id: (org as OrganizationRow).id,
        user_id: userId,
        role: "formand",
        name: pendingData.name,
        email: pendingData.email ?? userEmail ?? "",
        joined_at: now,
        marketing_consent: pendingData.marketingConsent ?? false,
        marketing_consent_at: pendingData.marketingConsent ? now : null,
        telefon: pendingData.telefon ?? null,
        adresse: pendingData.adresse ?? null,
        postnummer: pendingData.postnummer ?? null,
        by: pendingData.by ?? null,
        foedselsdato: pendingData.foedselsdato ?? null,
        email_bekraeftet: true,
      });

      if (memberError) {
        console.error("useOrgLoader: fejl ved oprettelse af formand-member:", memberError.message);
      }
    }

    localStorage.removeItem("vedtaegt_pending_signup");
    await supabase.auth.updateUser({ data: { pending_signup: null } });
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("useOrgLoader: uventet fejl i completePendingSignup:", msg);
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

  const refetchForOrg = useCallback(async (orgId: string) => {
    const [rolePerms, orgMembers] = await Promise.all([
      fetchPermissions(orgId),
      fetchMembers(orgId),
    ]);
    setOrgState((prev) => ({ ...prev, rolePermissions: rolePerms, members: orgMembers }));
  }, []);

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
    let pendingData: PendingSignupData | null = null;

    const pendingRaw = localStorage.getItem("vedtaegt_pending_signup");
    if (pendingRaw) {
      try {
        const parsed: PendingSignupData = JSON.parse(pendingRaw);
        if (parsed.userId === user.id || parsed.email === user.email) {
          pendingData = parsed;
        }
      } catch {
        localStorage.removeItem("vedtaegt_pending_signup");
      }
    }

    if (!pendingData && user.user_metadata?.pending_signup) {
      pendingData = user.user_metadata.pending_signup as PendingSignupData;
    }

    if (pendingData) {
      const ok = await completePendingSignup(user.id, user.email, pendingData);
      if (!ok) {
        setError("Der opstod en fejl under oprettelsen af din forening. Prøv at logge ud og ind igen.");
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

    const orgName = (member.organizations as { name: string } | null)?.name ?? null;
    const orgId = member.org_id!;

    const [rolePerms, orgMembers] = await Promise.all([
      fetchPermissions(orgId),
      fetchMembers(orgId),
    ]);

    setOrgState({
      orgId,
      orgName,
      memberId: member.id,
      memberName: member.name,
      memberRole: member.role,
      userId: user.id,
      rolePermissions: rolePerms,
      members: orgMembers,
    });

    setLoading(false);
  }, []);

  return { orgState, loading, error, load, refetchForOrg, setOrgState };
}

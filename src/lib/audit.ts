import { supabase } from "@/integrations/supabase/client";

// Logger en audit-hændelse.
// Hvis orgId sendes med (anbefalet), undgås et ekstra DB-kald.
// Kaldere der har orgId fra OrgContext bør altid sende det med.
export async function logAuditEvent(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean | null> = {},
  orgId?: string
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return;

  let resolvedOrgId = orgId ?? null;

  // Fallback: hent org_id fra members-tabellen hvis ikke sendt med
  if (!resolvedOrgId) {
    const { data: member } = await supabase
      .from("members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) return;
    resolvedOrgId = member.org_id;
  }

  const { error } = await supabase.from("audit_events").insert([
    {
      org_id: resolvedOrgId,
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: metadata as unknown as import("@/integrations/supabase/types").Json,
      ip_address: "client-side",
    },
  ]);

  if (error) {
    console.error("logAuditEvent: fejl ved logning:", error.message);
  }
}

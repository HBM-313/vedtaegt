import { supabase } from "@/integrations/supabase/client";

export async function logAuditEvent(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get org_id from user's membership
  const { data: member } = await supabase
    .from("members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member) return;

  await supabase.from("audit_events").insert([{
    org_id: member.org_id,
    user_id: user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: metadata as Record<string, unknown>,
    ip_address: "client-side",
  }]);
}

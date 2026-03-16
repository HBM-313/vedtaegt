import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meeting_id } = await req.json();
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get meeting
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, org_id, title")
      .eq("id", meeting_id)
      .single();

    if (!meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all members in org
    const { data: members } = await supabase
      .from("members")
      .select("id, name, email")
      .eq("org_id", meeting.org_id);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: "No members found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate approval tokens for each member
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

    const approvals = members.map((member) => ({
      meeting_id: meeting.id,
      org_id: meeting.org_id,
      member_id: member.id,
      token: crypto.randomUUID(),
      token_expires_at: expiresAt.toISOString(),
      approved_at: null,
    }));

    // Delete existing unapproved approvals for this meeting
    await supabase
      .from("approvals")
      .delete()
      .eq("meeting_id", meeting_id)
      .is("approved_at", null);

    // Insert new approvals
    const { error: insertError } = await supabase
      .from("approvals")
      .insert(approvals);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log audit event
    await supabase.from("audit_events").insert({
      org_id: meeting.org_id,
      user_id: user.id,
      action: "meeting.sent_for_approval",
      resource_type: "meeting",
      resource_id: meeting_id,
      metadata: { members_count: members.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        approvals_created: approvals.length,
        message: `Godkendelseslinks oprettet for ${approvals.length} medlemmer.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

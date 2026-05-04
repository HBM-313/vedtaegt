import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Use getUser instead of getClaims
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { meeting_id } = await req.json();
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side permission check: caller must be a member of the meeting's org
    // and have kan_sende_til_godkendelse=true. Honor naestformand-vikariat
    // (inherits formand permissions when formand is absent).
    const { data: meetingForAuth } = await supabase
      .from("meetings")
      .select("org_id")
      .eq("id", meeting_id)
      .single();
    if (!meetingForAuth) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgIdForAuth = meetingForAuth.org_id;

    const { data: callerMember } = await supabase
      .from("members")
      .select("role")
      .eq("org_id", orgIdForAuth)
      .eq("user_id", userId)
      .maybeSingle();
    if (!callerMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let effectiveRole: string = callerMember.role;
    if (effectiveRole === "naestformand") {
      const { data: perm } = await supabase
        .from("role_permissions")
        .select("arver_formand_ved_fravaer")
        .eq("org_id", orgIdForAuth)
        .eq("role", "naestformand")
        .maybeSingle();
      if (perm?.arver_formand_ved_fravaer) {
        const { data: formand } = await supabase
          .from("members")
          .select("er_fravaerende")
          .eq("org_id", orgIdForAuth)
          .eq("role", "formand")
          .maybeSingle();
        if (formand?.er_fravaerende) effectiveRole = "formand";
      }
    }

    const { data: rolePerm } = await supabase
      .from("role_permissions")
      .select("kan_sende_til_godkendelse")
      .eq("org_id", orgIdForAuth)
      .eq("role", effectiveRole)
      .maybeSingle();
    if (!rolePerm?.kan_sende_til_godkendelse) {
      return new Response(JSON.stringify({ error: "Forbidden: du har ikke tilladelse til at sende referatet til godkendelse." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get meeting
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, org_id, title, meeting_date")
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
    expiresAt.setDate(expiresAt.getDate() + 14);

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
      user_id: userId,
      action: "meeting.sent_for_approval",
      resource_type: "meeting",
      resource_id: meeting_id,
      metadata: { members_count: members.length },
    });

    // Send approval request emails to each member
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
    const INTERNAL_TOKEN_FOR_SEND_EMAIL = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const meetingDate = meeting.meeting_date
      ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(meeting.meeting_date))
      : "ukendt dato";

    for (const approval of approvals) {
      const member = members.find((m) => m.id === approval.member_id);
      if (!member) continue;

      await fetch(sendEmailUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": INTERNAL_TOKEN_FOR_SEND_EMAIL },
        body: JSON.stringify({
          to: member.email,
          templateName: "approval_request",
          templateData: {
            meetingTitle: meeting.title,
            meetingDate,
            token: approval.token,
          },
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        approvals_created: approvals.length,
        emails_sent: approvals.length,
        message: `Godkendelseslinks oprettet og mails sendt til ${approvals.length} medlemmer.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

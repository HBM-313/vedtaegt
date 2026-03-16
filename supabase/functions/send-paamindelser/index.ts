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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find approvals that need a reminder:
    // status = 'afventer' AND
    // (paamindelse_sendt_at IS NULL AND sendt_at + paamindelse_efter_dage <= now())
    // OR (paamindelse_sendt_at IS NOT NULL AND paamindelse_sendt_at + paamindelse_efter_dage <= now())
    const { data: pendingApprovals, error: queryError } = await supabase
      .from("approvals")
      .select("id, token, meeting_id, member_id, paamindelse_efter_dage, sendt_at, paamindelse_sendt_at, members!approvals_member_id_fkey(name, email), meetings!approvals_meeting_id_fkey(title, sendt_af)")
      .eq("status", "afventer")
      .not("token", "is", null);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingApprovals || pendingApprovals.length === 0) {
      return new Response(JSON.stringify({ success: true, reminders_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let remindersSent = 0;
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;

    for (const approval of pendingApprovals) {
      const dage = approval.paamindelse_efter_dage || 3;
      const referenceDate = approval.paamindelse_sendt_at || approval.sendt_at;
      if (!referenceDate) continue;

      const ref = new Date(referenceDate);
      ref.setDate(ref.getDate() + dage);

      if (ref > now) continue; // Not yet time

      // Skip sender (they auto-approved)
      const meetingData = approval.meetings as any;
      if (meetingData?.sendt_af && approval.member_id === meetingData.sendt_af) continue;

      const member = approval.members as any;
      if (!member?.email || !approval.token || !meetingData?.title) continue;

      // Get approval counts for this meeting
      const { data: allApprovals } = await supabase
        .from("approvals")
        .select("id, status")
        .eq("meeting_id", approval.meeting_id!);

      const total = allApprovals?.length || 0;
      const done = allApprovals?.filter((a: any) => a.status === "godkendt").length || 0;

      await fetch(sendEmailUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: member.email,
          templateName: "approval_reminder",
          templateData: {
          meetingTitle: meetingData.title,
            token: approval.token,
            recipientName: member.name,
            approvedCount: done,
            totalCount: total,
          },
        }),
      });

      await supabase.from("approvals").update({
        paamindelse_sendt_at: now.toISOString(),
      }).eq("id", approval.id);

      remindersSent++;
    }

    // Log audit events if any reminders sent
    if (remindersSent > 0) {
      // Get unique meeting IDs
      const meetingIds = [...new Set(pendingApprovals
        .filter(a => a.meeting_id)
        .map(a => a.meeting_id))];

      for (const meetingId of meetingIds) {
        const approval = pendingApprovals.find(a => a.meeting_id === meetingId);
        if (!approval) continue;

        const { data: meeting } = await supabase.from("meetings").select("org_id").eq("id", meetingId!).single();
        if (meeting) {
          await supabase.from("audit_events").insert({
            org_id: meeting.org_id,
            action: "meeting.auto_paamindelse_sendt",
            resource_type: "meeting",
            resource_id: meetingId,
            metadata: { antal: remindersSent },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: remindersSent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-paamindelser error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

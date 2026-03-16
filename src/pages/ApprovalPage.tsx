import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface ApprovalData {
  id: string;
  approved_at: string | null;
  token_expires_at: string | null;
  meeting_id: string;
  org_id: string;
  meeting: {
    title: string;
    meeting_date: string | null;
    org_name: string;
  };
  minutes_content: Record<string, string>;
  agenda_items: { title: string; sort_order: number | null }[];
}

const ApprovalPage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Ugyldigt link.");
        setLoading(false);
        return;
      }

      // Fetch approval by token
      const { data: approval, error: approvalError } = await supabase
        .from("approvals")
        .select("id, approved_at, token_expires_at, meeting_id, meetings(title, meeting_date, org_id, organizations(name))")
        .eq("token", token)
        .maybeSingle();

      if (approvalError || !approval) {
        setError("Godkendelseslinket er ugyldigt eller udløbet.");
        setLoading(false);
        return;
      }

      if (approval.approved_at) {
        setConfirmed(true);
        setConfirmedAt(approval.approved_at);
        setLoading(false);
        return;
      }

      if (approval.token_expires_at && new Date(approval.token_expires_at) < new Date()) {
        setError("Godkendelseslinket er udløbet. Kontakt mødelederen for et nyt link.");
        setLoading(false);
        return;
      }

      // Load minutes + agenda
      const meetingData = approval.meetings as any;
      const meetingId = approval.meeting_id;

      const [minutesRes, agendaRes] = await Promise.all([
        supabase.from("minutes").select("content").eq("meeting_id", meetingId!).maybeSingle(),
        supabase.from("agenda_items").select("title, sort_order").eq("meeting_id", meetingId!).order("sort_order", { ascending: true }),
      ]);

      let mc: Record<string, string> = {};
      if (minutesRes.data?.content) {
        try { mc = JSON.parse(minutesRes.data.content); } catch {}
      }

      setData({
        id: approval.id,
        approved_at: approval.approved_at,
        token_expires_at: approval.token_expires_at,
        meeting_id: approval.meeting_id!,
        org_id: (meetingData as any)?.org_id || "",
        meeting: {
          title: meetingData?.title || "",
          meeting_date: meetingData?.meeting_date || null,
          org_name: meetingData?.organizations?.name || "",
        },
        minutes_content: mc,
        agenda_items: (agendaRes.data || []) as any,
      });

      setLoading(false);
    };
    load();
  }, [token]);

  const handleApprove = async () => {
    if (!data || !token) return;
    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("approvals")
        .update({
          approved_at: now,
          ip_address: "web-client",
          token: null, // invalidate token
        })
        .eq("id", data.id);

      if (error) throw error;

      setConfirmed(true);
      setConfirmedAt(now);
      toast.success("Din godkendelse er registreret.");

      // Check if all approvals are done → send "all approved" email to owner
      const { data: approvalRows } = await supabase
        .from("approvals")
        .select("id, approved_at, member_id, members(name)")
        .eq("meeting_id", data.meeting_id);

      if (approvalRows) {
        const allDone = approvalRows.every((a) => a.approved_at !== null);
        if (allDone) {
          // Auto-approve meeting
          await supabase.from("meetings").update({
            status: "approved",
            approved_at: now,
          }).eq("id", data.meeting_id);

          // Find owner email
          const { data: ownerMember } = await supabase
            .from("members")
            .select("email")
            .eq("org_id", data.org_id)
            .eq("role", "owner")
            .limit(1)
            .single();

          if (ownerMember) {
            await supabase.functions.invoke("send-email", {
              body: {
                to: ownerMember.email,
                templateName: "all_approved",
                templateData: {
                  meetingTitle: data.meeting.title,
                  meetingId: data.meeting_id,
                  approvalCount: approvalRows.length,
                  approvals: approvalRows.map((a) => ({
                    name: (a.members as any)?.name || "Ukendt",
                    date: a.approved_at ? new Intl.DateTimeFormat("da-DK", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    }).format(new Date(a.approved_at)) : "",
                  })),
                },
              },
            });
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke registrere godkendelse.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Ugyldigt link</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    const d = confirmedAt ? new Date(confirmedAt) : new Date();
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm p-8 text-center">
          <CheckCircle className="h-8 w-8 text-primary mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Tak!</h1>
          <p className="text-sm text-muted-foreground">
            Din godkendelse er registreret den{" "}
            {formatDate(d)} kl.{" "}
            {d.getHours().toString().padStart(2, "0")}:{d.getMinutes().toString().padStart(2, "0")}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-display">Vedtægt</span>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
          {data!.meeting.org_name}
        </p>
        <h1 className="text-2xl font-semibold tracking-display mb-1">
          {data!.meeting.title}
        </h1>
        {data!.meeting.meeting_date && (
          <p className="text-sm text-muted-foreground mb-6">
            {formatDate(data!.meeting.meeting_date)}
          </p>
        )}

        {/* Minutes read-only */}
        <div className="space-y-4 mb-8">
          {data!.agenda_items.map((item, i) => {
            const content = data!.minutes_content[Object.keys(data!.minutes_content)[i]] || "";
            return (
              <div key={i} className="ring-1 ring-border rounded-sm">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold">{i + 1}. {item.title}</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {content || "Intet referat for dette punkt."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Approve button */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full press-effect"
            onClick={handleApprove}
            disabled={submitting}
          >
            {submitting ? "Registrerer..." : "Godkend referat"}
          </Button>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Din godkendelse registrerer at du har gennemlæst og accepteret referatets indhold.
            Det er ikke en juridisk bindende underskrift.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ApprovalPage;

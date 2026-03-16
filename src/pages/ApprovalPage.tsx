import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getRoleLabel } from "@/lib/roles";
import { toast } from "sonner";

interface ApprovalData {
  id: string;
  status: string | null;
  approved_at: string | null;
  token_expires_at: string | null;
  meeting_id: string;
  org_id: string;
  member_id: string;
  member_name: string;
  meeting: {
    title: string;
    meeting_date: string | null;
    org_name: string;
    godkendelse_runde: number;
  };
  sender: { name: string; role: string };
  minutes_content: Record<string, string>;
  agenda_items: { id: string; title: string; sort_order: number | null }[];
}

const ApprovalPage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultState, setResultState] = useState<"godkendt" | "afvist" | null>(null);
  const [resultTime, setResultTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!token) { setError("Ugyldigt link."); setLoading(false); return; }

      const { data: approval, error: approvalError } = await supabase
        .from("approvals")
        .select("id, status, approved_at, token_expires_at, meeting_id, org_id, member_id, members!approvals_member_id_fkey(name)")
        .eq("token", token)
        .maybeSingle();

      if (approvalError || !approval) {
        setError("Godkendelseslinket er ugyldigt eller udløbet.");
        setLoading(false);
        return;
      }

      // Already handled
      if (approval.status === "godkendt") {
        setResultState("godkendt");
        setResultTime(approval.approved_at);
        setLoading(false);
        return;
      }
      if (approval.status === "afvist") {
        setResultState("afvist");
        setLoading(false);
        return;
      }

      if (approval.token_expires_at && new Date(approval.token_expires_at) < new Date()) {
        setError("Dette godkendelseslink er udløbet. Kontakt foreningens formand for at få sendt et nyt.");
        setLoading(false);
        return;
      }

      // Load meeting, minutes, agenda, sender
      const meetingId = approval.meeting_id!;
      const [meetingRes, minutesRes, agendaRes, senderRes] = await Promise.all([
        supabase.from("meetings").select("title, meeting_date, org_id, godkendelse_runde, organizations!meetings_org_id_fkey(name)").eq("id", meetingId).single(),
        supabase.from("minutes").select("content").eq("meeting_id", meetingId).maybeSingle(),
        supabase.from("agenda_items").select("id, title, sort_order").eq("meeting_id", meetingId).order("sort_order", { ascending: true }),
        supabase.from("members").select("name, role").eq("org_id", approval.org_id!).eq("role", "formand").limit(1).maybeSingle(),
      ]);

      const meetingData = meetingRes.data as any;
      let mc: Record<string, string> = {};
      if (minutesRes.data?.content) {
        try { mc = JSON.parse(minutesRes.data.content); } catch {}
      }

      setData({
        id: approval.id,
        status: approval.status,
        approved_at: approval.approved_at,
        token_expires_at: approval.token_expires_at,
        meeting_id: meetingId,
        org_id: approval.org_id!,
        member_id: approval.member_id!,
        member_name: (approval.members as any)?.name || "Ukendt",
        meeting: {
          title: meetingData?.title || "",
          meeting_date: meetingData?.meeting_date || null,
          org_name: (meetingData?.organizations as any)?.name || "",
          godkendelse_runde: meetingData?.godkendelse_runde || 1,
        },
        sender: {
          name: senderRes.data?.name || "Formanden",
          role: senderRes.data?.role || "formand",
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
      const { error } = await supabase.from("approvals").update({
        status: "godkendt",
        approved_at: now,
        ip_address: "web-client",
        token: null,
      }).eq("id", data.id);
      if (error) throw error;

      // Check if all approved
      const { data: allApprovals } = await supabase
        .from("approvals")
        .select("id, status, approved_at, member_id, members!approvals_member_id_fkey(name, role)")
        .eq("meeting_id", data.meeting_id);

      if (allApprovals) {
        const allDone = allApprovals.every((a) => a.status === "godkendt");
        if (allDone) {
          await supabase.from("meetings").update({ status: "approved", approved_at: now }).eq("id", data.meeting_id);

          // Send all_approved email to formand/næstformand
          const leaders = await supabase.from("members")
            .select("email, name").eq("org_id", data.org_id)
            .in("role", ["formand", "naestformand"]);

          if (leaders.data) {
            for (const leader of leaders.data) {
              await supabase.functions.invoke("send-email", {
                body: {
                  to: leader.email,
                  templateName: "all_approved",
                  templateData: {
                    meetingTitle: data.meeting.title,
                    meetingId: data.meeting_id,
                    approvalCount: allApprovals.length,
                    approvals: allApprovals.map((a) => ({
                      name: (a.members as any)?.name || "Ukendt",
                      role: getRoleLabel((a.members as any)?.role || ""),
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
      }

      setResultState("godkendt");
      setResultTime(now);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke registrere godkendelse.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!data || !token || rejectComment.length < 10) return;
    setSubmitting(true);
    try {
      // 1. Update this approval
      await supabase.from("approvals").update({
        status: "afvist",
        afvist_kommentar: rejectComment,
        token: null,
      }).eq("id", data.id);

      // 2. Set meeting back to active
      await supabase.from("meetings").update({
        status: "active",
        afvist_af: data.member_id,
        afvist_at: new Date().toISOString(),
        afvist_kommentar: rejectComment,
      }).eq("id", data.meeting_id);

      // 3. Send rejection notification to formand/næstformand
      const leaders = await supabase.from("members")
        .select("email, name").eq("org_id", data.org_id)
        .in("role", ["formand", "naestformand"]);

      if (leaders.data) {
        for (const leader of leaders.data) {
          await supabase.functions.invoke("send-email", {
            body: {
              to: leader.email,
              templateName: "referat_rejected",
              templateData: {
                meetingTitle: data.meeting.title,
                meetingId: data.meeting_id,
                rejectorName: data.member_name,
                rejectorRole: "Medlem",
                comment: rejectComment,
                recipientName: leader.name,
              },
            },
          });
        }
      }

      setShowReject(false);
      setResultState("afvist");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke registrere afvisning.");
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

  if (resultState === "godkendt") {
    const d = resultTime ? new Date(resultTime) : new Date();
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm p-8 text-center">
          <CheckCircle className="h-8 w-8 text-primary mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Tak, {data?.member_name || ""}!</h1>
          <p className="text-sm text-muted-foreground">
            Du har godkendt referatet fra <strong>{data?.meeting.title}</strong>.
            <br />
            Godkendt: {formatDate(d)} kl. {d.getHours().toString().padStart(2, "0")}:{d.getMinutes().toString().padStart(2, "0")}
          </p>
        </div>
      </div>
    );
  }

  if (resultState === "afvist") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm p-8 text-center">
          <XCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Afvisning registreret</h1>
          <p className="text-sm text-muted-foreground">
            Din afvisning er registreret og formanden er notificeret.
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
        {/* Meeting info box */}
        <div className="rounded-md border border-border bg-muted/30 p-5 mb-6 space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Referat til godkendelse</p>
          <h1 className="text-xl font-semibold">{data!.meeting.title}</h1>
          <p className="text-sm text-muted-foreground">Forening: {data!.meeting.org_name}</p>
          {data!.meeting.meeting_date && (
            <p className="text-sm text-muted-foreground">Dato: {formatDate(data!.meeting.meeting_date)}</p>
          )}
          <p className="text-sm text-muted-foreground">Sendt af: {data!.sender.name} ({getRoleLabel(data!.sender.role)})</p>
          {data!.meeting.godkendelse_runde > 1 && (
            <p className="text-sm text-muted-foreground">Runde: {data!.meeting.godkendelse_runde}</p>
          )}
        </div>

        {/* Minutes read-only */}
        <div className="space-y-4 mb-8">
          {data!.agenda_items.map((item, i) => {
            const content = data!.minutes_content[item.id] || data!.minutes_content[Object.keys(data!.minutes_content)[i]] || "";
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

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Button size="lg" className="flex-1 press-effect" onClick={handleApprove} disabled={submitting}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {submitting ? "Registrerer..." : "Godkend referat"}
          </Button>
          <Button size="lg" variant="outline" className="flex-1 press-effect" onClick={() => setShowReject(true)} disabled={submitting}>
            <XCircle className="h-4 w-4 mr-2" />
            Afvis med kommentar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Din godkendelse registrerer at du har gennemlæst og accepteret referatets indhold.
          Det er ikke en juridisk bindende underskrift.
        </p>
      </main>

      {/* Rejection dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Afvis referat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">Beskriv hvad der er forkert eller mangler:</p>
          <Textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Skriv mindst 10 tegn..."
            className="min-h-[100px]"
          />
          {rejectComment.length > 0 && rejectComment.length < 10 && (
            <p className="text-xs text-destructive">Mindst 10 tegn påkrævet ({rejectComment.length}/10)</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Annullér</Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting || rejectComment.length < 10}>
              {submitting ? "Sender..." : "Send afvisning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalPage;

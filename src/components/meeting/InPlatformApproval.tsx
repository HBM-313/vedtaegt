import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, XCircle, ClipboardCheck } from "lucide-react";
import { logAuditEvent } from "@/lib/audit";
import { getRoleLabel } from "@/lib/roles";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  orgId: string;
  orgName: string;
  meetingTitle: string;
  godkendelseRunde: number | null;
  currentMemberId: string | null;
  approvals: {
    id: string;
    member_id: string | null;
    status: string | null;
    approved_at: string | null;
    afvist_kommentar?: string | null;
  }[];
  onUpdate: () => void;
}

const InPlatformApproval = ({
  meetingId, orgId, orgName, meetingTitle, godkendelseRunde,
  currentMemberId, approvals, onUpdate,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  if (!currentMemberId) return null;

  const myApproval = approvals.find(a => a.member_id === currentMemberId);
  if (!myApproval) return null;

  // Already approved
  if (myApproval.status === "godkendt") {
    const d = myApproval.approved_at ? new Date(myApproval.approved_at) : null;
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">Du godkendte dette referat</p>
            {d && (
              <p className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Already rejected
  if (myApproval.status === "afvist") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 mb-6">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold">Du afviste dette referat</p>
            {myApproval.afvist_kommentar && (
              <p className="text-xs text-muted-foreground mt-1">Kommentar: "{myApproval.afvist_kommentar}"</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pending — show action box
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("approvals").update({
        status: "godkendt",
        approved_at: now,
      }).eq("id", myApproval.id);

      await logAuditEvent("meeting.referat_godkendt", "meeting", meetingId, {
        member_id: currentMemberId,
        kilde: "platform",
        runde: godkendelseRunde || 1,
      });

      // Check if all approved
      const { data: allApprovals } = await supabase
        .from("approvals")
        .select("id, status, approved_at, member_id, members!approvals_member_id_fkey(name, role)")
        .eq("meeting_id", meetingId);

      if (allApprovals?.every(a => a.status === "godkendt")) {
        await supabase.from("meetings").update({ status: "approved", approved_at: now }).eq("id", meetingId);

        const leaders = await supabase.from("members")
          .select("email, name").eq("org_id", orgId).in("role", ["formand", "naestformand"]);

        if (leaders.data) {
          for (const leader of leaders.data) {
            await supabase.functions.invoke("send-email", {
              body: {
                to: leader.email,
                templateName: "all_approved",
                templateData: {
                  meetingTitle,
                  meetingId,
                  approvalCount: allApprovals.length,
                  approvals: allApprovals.map(a => ({
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

        await logAuditEvent("meeting.fully_approved", "meeting", meetingId, {});
      }

      toast.success("Du har godkendt referatet.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke registrere godkendelse.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (rejectComment.length < 10) return;
    setSubmitting(true);
    try {
      await supabase.from("approvals").update({
        status: "afvist",
        afvist_kommentar: rejectComment,
      }).eq("id", myApproval.id);

      await supabase.from("meetings").update({
        status: "active",
        afvist_af: currentMemberId,
        afvist_at: new Date().toISOString(),
        afvist_kommentar: rejectComment,
      }).eq("id", meetingId);

      // Notify formand/næstformand
      const leaders = await supabase.from("members")
        .select("email, name").eq("org_id", orgId).in("role", ["formand", "naestformand"]);

      const { data: myMember } = await supabase.from("members").select("name, role").eq("id", currentMemberId).single();

      if (leaders.data) {
        for (const leader of leaders.data) {
          await supabase.functions.invoke("send-email", {
            body: {
              to: leader.email,
              templateName: "referat_rejected",
              templateData: {
                meetingTitle,
                meetingId,
                rejectorName: myMember?.name || "Ukendt",
                rejectorRole: getRoleLabel(myMember?.role || ""),
                comment: rejectComment,
                recipientName: leader.name,
              },
            },
          });
        }
      }

      await logAuditEvent("meeting.referat_afvist", "meeting", meetingId, {
        afvist_af_navn: myMember?.name,
        kommentar: rejectComment,
        kilde: "platform",
        runde: godkendelseRunde || 1,
      });

      toast.success("Referatet er afvist. Formanden er notificeret.");
      setShowReject(false);
      setRejectComment("");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke registrere afvisning.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-5 mb-6">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold">Dit referat afventer din godkendelse</p>
              <p className="text-sm text-muted-foreground">Læs referatet herunder og godkend eller afvis.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" className="press-effect" onClick={handleApprove} disabled={submitting}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {submitting ? "Registrerer..." : "Godkend referat"}
              </Button>
              <Button size="sm" variant="outline" className="press-effect" onClick={() => setShowReject(true)} disabled={submitting}>
                <XCircle className="h-4 w-4 mr-1" />
                Afvis med kommentar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Din godkendelse registrerer at du har gennemlæst og accepteret referatets indhold.
              Det er ikke en juridisk bindende underskrift.
            </p>
          </div>
        </div>
      </div>

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
    </>
  );
};

export default InPlatformApproval;

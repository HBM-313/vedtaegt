import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatShortDate } from "@/lib/format";
import { getRoleLabel } from "@/lib/roles";
import { logAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { Play, SendHorizontal, CheckCircle, Download, Clock, AlertTriangle, Bell } from "lucide-react";
import AgendaMinutesTab from "@/components/meeting/AgendaMinutesTab";
import ActionItemsTab from "@/components/meeting/ActionItemsTab";
import ParticipantsTab from "@/components/meeting/ParticipantsTab";
import MeetingDocumentsTab from "@/components/meeting/MeetingDocumentsTab";
import MeetingPdf from "@/components/meeting/MeetingPdf";
import InPlatformApproval from "@/components/meeting/InPlatformApproval";

interface Meeting {
  id: string; title: string; meeting_date: string | null;
  location: string | null; status: string | null; approved_at: string | null; org_id: string | null;
  godkendelse_frist_dage: number | null; afvist_af: string | null; afvist_at: string | null;
  afvist_kommentar: string | null; godkendelse_runde: number | null; sendt_af: string | null;
}

interface ApprovalRow {
  id: string; member_id: string | null; status: string | null;
  approved_at: string | null; paamindelse_sendt_at: string | null;
  afvist_kommentar: string | null;
  members: { name: string; role: string } | null;
}

const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId, orgName, memberId } = useOrg();
  const perms = usePermissions();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [fristDage, setFristDage] = useState(3);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; email: string }[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [rejector, setRejector] = useState<{ name: string; role: string } | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [agendaItems, setAgendaItems] = useState<{ id: string; title: string }[]>([]);

  const loadMeeting = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("meetings").select("*").eq("id", id).single();
    setMeeting(data as Meeting | null);
    setLoading(false);
  }, [id]);

  const loadApprovals = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("approvals")
      .select("id, member_id, status, approved_at, paamindelse_sendt_at, afvist_kommentar, members!approvals_member_id_fkey(name, role)")
      .eq("meeting_id", id);
    setApprovals((data || []) as unknown as ApprovalRow[]);
  }, [id]);

  const loadAgendaItems = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("agenda_items")
      .select("id, title")
      .eq("meeting_id", id)
      .order("sort_order", { ascending: true });
    setAgendaItems((data || []) as { id: string; title: string }[]);
  }, [id]);

  useEffect(() => { loadMeeting(); loadApprovals(); loadAgendaItems(); }, [loadMeeting, loadApprovals, loadAgendaItems]);

  // Load rejector info
  useEffect(() => {
    if (!meeting?.afvist_af) { setRejector(null); return; }
    supabase.from("members").select("name, role").eq("id", meeting.afvist_af).single()
      .then(({ data }) => setRejector(data ? { name: data.name, role: data.role } : null));
  }, [meeting?.afvist_af]);

  // Realtime approvals
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`approvals-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `meeting_id=eq.${id}` }, () => {
        loadApprovals();
        loadMeeting();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadApprovals, loadMeeting]);

  const loadMembers = async () => {
    if (!orgId) return;
    const { data } = await supabase.from("members")
      .select("id, name, role, email")
      .eq("org_id", orgId)
      .not("user_id", "is", null)
      .eq("email_bekraeftet", true);
    setMembers(data || []);
  };

  const openSendModal = async () => {
    await loadMembers();
    setFristDage(meeting?.godkendelse_frist_dage || 3);
    setShowSendModal(true);
  };

  const handleSendForApproval = async () => {
    if (!meeting || !id) return;
    setStatusLoading(true);
    try {
      const runde = (meeting.godkendelse_runde || 1) + (meeting.status === "active" && meeting.afvist_at ? 1 : 0);
      const actualRunde = meeting.afvist_at ? runde : (meeting.godkendelse_runde || 1);

      await supabase.from("meetings").update({
        status: "pending_approval",
        godkendelse_frist_dage: fristDage,
        godkendelse_runde: actualRunde,
        afvist_af: null,
        afvist_at: null,
        afvist_kommentar: null,
        sendt_af: memberId,
      }).eq("id", id);

      await supabase.from("approvals").delete().eq("meeting_id", id).eq("status", "afventer");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const newApprovals = members.map((m) => ({
        meeting_id: id,
        org_id: orgId,
        member_id: m.id,
        status: "afventer",
        token: crypto.randomUUID(),
        token_expires_at: expiresAt.toISOString(),
        sendt_at: new Date().toISOString(),
        paamindelse_efter_dage: fristDage,
      }));

      await supabase.from("approvals").insert(newApprovals);

      if (memberId) {
        const senderApproval = newApprovals.find(a => a.member_id === memberId);
        if (senderApproval) {
          await supabase.from("approvals").update({
            status: "godkendt",
            approved_at: new Date().toISOString(),
          }).eq("meeting_id", id).eq("member_id", memberId).eq("status", "afventer");

          await logAuditEvent("meeting.referat_godkendt", "meeting", id, {
            member_id: memberId,
            kilde: "auto_afsender",
            runde: actualRunde,
          });
        }
      }

      const meetingDate = meeting.meeting_date
        ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(new Date(meeting.meeting_date))
        : "ukendt dato";

      const { data: senderMember } = await supabase.from("members")
        .select("name, email").eq("org_id", orgId!).eq("role", "formand").limit(1).single();

      let emailWarningShown = false;
      for (const approval of newApprovals) {
        const member = members.find((m) => m.id === approval.member_id);
        if (!member || member.id === memberId) continue;
        const { data: emailResult } = await supabase.functions.invoke("send-email", {
          body: {
            to: member.email,
            templateName: "approval_request",
            templateData: {
              meetingTitle: meeting.title,
              meetingDate,
              token: approval.token,
              recipientName: member.name,
              senderName: senderMember?.name || "Formanden",
              senderEmail: senderMember?.email || "",
              orgName: orgName || "",
              runde: actualRunde,
            },
          },
        });
        if (emailResult?.is_test_domain_restriction && !emailWarningShown) {
          toast.warning("E-mails kunne ikke sendes: Resend testdomæne kan kun sende til ejeren af API-nøglen. Medlemmerne kan godkende via linket i appen.", { duration: 8000 });
          emailWarningShown = true;
        }
      }

      await logAuditEvent("meeting.sent_for_approval", "meeting", id, {
        antal_modtagere: members.length,
        frist_dage: fristDage,
        runde: actualRunde,
      });

      toast.success(`Sendt til godkendelse hos ${members.length} medlemmer.`);
      setShowSendModal(false);
      await loadMeeting();
      await loadApprovals();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende til godkendelse.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStartMeeting = async () => {
    if (!meeting || !id || !perms.kanRedigereMoeder) return;
    setStatusLoading(true);
    try {
      await supabase.from("meetings").update({ status: "active" }).eq("id", id);
      await logAuditEvent("meeting.status_changed", "meeting", id, { from: "draft", to: "active" });
      toast.success("Mødet er startet.");
      await loadMeeting();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke starte mødet.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSendReminder = async () => {
    setReminderLoading(true);
    try {
      const { data: pendingWithTokens } = await supabase.from("approvals")
        .select("id, token, member_id, members!approvals_member_id_fkey(name, email)")
        .eq("meeting_id", id!)
        .eq("status", "afventer")
        .neq("member_id", meeting?.sendt_af || "");

      if (!pendingWithTokens) throw new Error("Ingen afventende godkendelser.");

      const total = approvals.length;
      const done = approvals.filter((a) => a.status === "godkendt").length;

      for (const a of pendingWithTokens) {
        const member = a.members as any;
        if (!member?.email || !a.token) continue;
        await supabase.functions.invoke("send-email", {
          body: {
            to: member.email,
            templateName: "approval_reminder",
            templateData: {
              meetingTitle: meeting!.title,
              token: a.token,
              recipientName: member.name,
              approvedCount: done,
              totalCount: total,
            },
          },
        });
        await supabase.from("approvals").update({ paamindelse_sendt_at: new Date().toISOString() }).eq("id", a.id);
      }

      await logAuditEvent("meeting.paamindelse_sendt", "meeting", id!, { antal: pendingWithTokens.length });
      toast.success(`Påmindelse sendt til ${pendingWithTokens.length} medlemmer.`);
      await loadApprovals();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende påmindelse.");
    } finally {
      setReminderLoading(false);
    }
  };

  const lastReminder = approvals.reduce<Date | null>((latest, a) => {
    if (!a.paamindelse_sendt_at) return latest;
    const d = new Date(a.paamindelse_sendt_at);
    return !latest || d > latest ? d : latest;
  }, null);
  const reminderCooldown = lastReminder && (Date.now() - lastReminder.getTime()) < 24 * 60 * 60 * 1000;
  const hoursUntilReminder = lastReminder ? Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - lastReminder.getTime())) / (60 * 60 * 1000)) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-48" /><Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!meeting) return <p className="text-sm text-muted-foreground">Møde ikke fundet.</p>;

  const approvedCount = approvals.filter((a) => a.status === "godkendt").length;
  const totalCount = approvals.length;
  const realPending = approvals.filter((a) => a.status === "afventer" && a.member_id !== meeting.sendt_af);
  const pendingCount = realPending.length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-display">{meeting.title}</h1>
            <StatusBadge status={meeting.status || "draft"} />
          </div>
          <p className="text-sm text-muted-foreground">
            {meeting.meeting_date ? formatDate(meeting.meeting_date) : "Dato ikke fastsat"}
            {meeting.location && ` · ${meeting.location}`}
          </p>
          {meeting.status === "approved" && meeting.approved_at && (
            <p className="text-xs text-muted-foreground mt-1">Godkendt {formatShortDate(meeting.approved_at)}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {perms.kanRedigereMoeder && meeting.status === "draft" && (
            <Button size="sm" className="press-effect" onClick={handleStartMeeting} disabled={statusLoading}>
              <Play className="h-4 w-4 mr-1" /> Start møde
            </Button>
          )}
          {perms.kanSendeTilGodkendelse && meeting.status === "active" && (
            <Button size="sm" className="press-effect" onClick={openSendModal} disabled={statusLoading}>
              <SendHorizontal className="h-4 w-4 mr-1" /> Send til godkendelse
            </Button>
          )}
          {meeting.status === "approved" && (
            <Button size="sm" variant="outline" className="press-effect" onClick={() => setShowPdf(true)}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* In-platform approval box */}
      {meeting.status === "pending_approval" && (
        <InPlatformApproval
          meetingId={meeting.id}
          orgId={meeting.org_id!}
          orgName={orgName || ""}
          meetingTitle={meeting.title}
          godkendelseRunde={meeting.godkendelse_runde}
          currentMemberId={memberId}
          approvals={approvals}
          onUpdate={() => { loadMeeting(); loadApprovals(); }}
        />
      )}

      {/* Rejection banner */}
      {meeting.status === "active" && meeting.afvist_at && meeting.afvist_kommentar && rejector && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Referatet blev afvist</p>
              <p className="text-sm text-muted-foreground">
                Afvist af: {rejector.name} ({getRoleLabel(rejector.role)})
                <br />
                Dato: {meeting.afvist_at ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(meeting.afvist_at)) : ""}
              </p>
              <div className="mt-2 rounded bg-muted p-3">
                <p className="text-sm italic">"{meeting.afvist_kommentar}"</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ret referatet og send til godkendelse igen.</p>
            </div>
          </div>
        </div>
      )}

      {/* Approval progress section */}
      {meeting.status === "pending_approval" && approvals.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              Godkendelsesstatus — Runde {meeting.godkendelse_runde || 1}
            </p>
            <span className="text-sm text-muted-foreground">{approvedCount}/{totalCount} ✓</span>
          </div>

          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2 mb-4">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {a.status === "godkendt" ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{a.members?.name || "Ukendt"} ({getRoleLabel(a.members?.role || "")})</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {a.status === "godkendt" && a.approved_at
                    ? a.member_id === meeting.sendt_af
                      ? "Godkendt automatisk (afsender)"
                      : `Godkendt ${formatShortDate(a.approved_at)}`
                    : "Afventer"}
                </span>
              </div>
            ))}
          </div>

          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendReminder}
              disabled={reminderLoading || !!reminderCooldown}
            >
              <Bell className="h-4 w-4 mr-1" />
              {reminderCooldown
                ? `Påmindelse sendt. Kan sendes igen om ${hoursUntilReminder}t.`
                : `Send påmindelse til ${pendingCount} afventende`}
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="agenda">
        <TabsList className="mb-4">
          <TabsTrigger value="agenda" className="text-xs">Dagsorden & referat</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">Handlingspunkter</TabsTrigger>
          <TabsTrigger value="participants" className="text-xs">Deltagere</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Dokumenter</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda"><AgendaMinutesTab meetingId={meeting.id} orgId={meeting.org_id!} /></TabsContent>
        <TabsContent value="actions"><ActionItemsTab meetingId={meeting.id} orgId={meeting.org_id!} /></TabsContent>
        <TabsContent value="participants"><ParticipantsTab meetingId={meeting.id} orgId={meeting.org_id!} /></TabsContent>
        <TabsContent value="documents">
          <MeetingDocumentsTab meetingId={meeting.id} orgId={meeting.org_id!} agendaItems={agendaItems} />
        </TabsContent>
      </Tabs>

      {showPdf && <MeetingPdf meeting={meeting} orgName={orgName || ""} onClose={() => setShowPdf(false)} />}

      {/* Send for approval modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send referat til godkendelse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Følgende medlemmer modtager referatet:</p>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span>{m.name} ({getRoleLabel(m.role)})</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Påmindelse hvis ikke godkendt inden:</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={fristDage}
                  onChange={(e) => setFristDage(Math.min(14, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">dage</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendModal(false)}>Annullér</Button>
            <Button onClick={handleSendForApproval} disabled={statusLoading || members.length === 0}>
              <SendHorizontal className="h-4 w-4 mr-1" />
              {statusLoading ? "Sender..." : "Send til godkendelse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingDetail;

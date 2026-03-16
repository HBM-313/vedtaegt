import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatShortDate } from "@/lib/format";
import { logAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { Play, SendHorizontal, CheckCircle, Download } from "lucide-react";
import AgendaMinutesTab from "@/components/meeting/AgendaMinutesTab";
import ActionItemsTab from "@/components/meeting/ActionItemsTab";
import ParticipantsTab from "@/components/meeting/ParticipantsTab";
import MeetingPdf from "@/components/meeting/MeetingPdf";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string | null;
  location: string | null;
  status: string | null;
  approved_at: string | null;
  org_id: string | null;
}

const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId, memberRole, orgName } = useOrg();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  const isOwnerOrAdmin = memberRole === "owner" || memberRole === "admin";

  const loadMeeting = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();
    setMeeting(data as Meeting | null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  const updateStatus = async (newStatus: string) => {
    if (!meeting || !id) return;
    setStatusLoading(true);

    try {
      if (newStatus === "pending_approval") {
        // Generate tokens and send emails via edge function
        const { error } = await supabase.functions.invoke("send-approval-emails", {
          body: { meeting_id: id },
        });
        if (error) throw error;
      }

      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "approved") {
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("meetings")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      await logAuditEvent(
        `meeting.status_changed`,
        "meeting",
        id,
        { from: meeting.status, to: newStatus }
      );

      toast.success(
        newStatus === "active"
          ? "Mødet er startet."
          : newStatus === "pending_approval"
          ? "Sendt til godkendelse."
          : newStatus === "approved"
          ? "Mødet er godkendt."
          : "Status opdateret."
      );

      await loadMeeting();
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke opdatere status.");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!meeting) {
    return <p className="text-sm text-muted-foreground">Møde ikke fundet.</p>;
  }

  return (
    <div>
      {/* Header */}
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
            <p className="text-xs text-muted-foreground mt-1">
              Godkendt {formatShortDate(meeting.approved_at)}
            </p>
          )}
        </div>

        {/* Status flow buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwnerOrAdmin && meeting.status === "draft" && (
            <Button
              size="sm"
              className="press-effect"
              onClick={() => updateStatus("active")}
              disabled={statusLoading}
            >
              <Play className="h-4 w-4 mr-1" />
              Start møde
            </Button>
          )}
          {isOwnerOrAdmin && meeting.status === "active" && (
            <Button
              size="sm"
              className="press-effect"
              onClick={() => updateStatus("pending_approval")}
              disabled={statusLoading}
            >
              <SendHorizontal className="h-4 w-4 mr-1" />
              Send til godkendelse
            </Button>
          )}
          {meeting.status === "pending_approval" && (
            <ApprovalProgress meetingId={meeting.id} onAllApproved={() => updateStatus("approved")} />
          )}
          {meeting.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="press-effect"
              onClick={() => setShowPdf(true)}
            >
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="agenda">
        <TabsList className="mb-4">
          <TabsTrigger value="agenda" className="text-xs">Dagsorden & referat</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">Handlingspunkter</TabsTrigger>
          <TabsTrigger value="participants" className="text-xs">Deltagere</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <AgendaMinutesTab meetingId={meeting.id} orgId={meeting.org_id!} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionItemsTab meetingId={meeting.id} orgId={meeting.org_id!} />
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsTab meetingId={meeting.id} orgId={meeting.org_id!} />
        </TabsContent>
      </Tabs>

      {/* PDF modal */}
      {showPdf && (
        <MeetingPdf
          meeting={meeting}
          orgName={orgName || ""}
          onClose={() => setShowPdf(false)}
        />
      )}
    </div>
  );
};

function ApprovalProgress({
  meetingId,
  onAllApproved,
}: {
  meetingId: string;
  onAllApproved: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [approved, setApproved] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("approvals")
        .select("id, approved_at")
        .eq("meeting_id", meetingId);

      if (data) {
        setTotal(data.length);
        const done = data.filter((a) => a.approved_at).length;
        setApproved(done);
        if (data.length > 0 && done === data.length) {
          onAllApproved();
        }
      }
    };
    load();

    const channel = supabase
      .channel(`approvals-${meetingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `meeting_id=eq.${meetingId}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetingId, onAllApproved]);

  return (
    <div className="flex items-center gap-2">
      <CheckCircle className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        Afventer godkendelse fra {approved}/{total} deltagere
      </span>
    </div>
  );
}

export default MeetingDetail;

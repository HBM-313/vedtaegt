import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { getRoleLabel } from "@/lib/roles";

interface Approval {
  id: string;
  approved_at: string | null;
  member: { name: string; role: string } | null;
}

interface Props {
  meetingId: string;
  orgId: string;
}

const ParticipantsTab = ({ meetingId, orgId }: Props) => {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("approvals")
        .select("id, approved_at, members!approvals_member_id_fkey(name, role)")
        .eq("meeting_id", meetingId);

      const mapped = (data || []).map((a: any) => ({
        ...a,
        member: a.members,
      }));
      setApprovals(mapped);
      setLoading(false);
    };
    load();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen deltagere inviteret endnu. Send mødet til godkendelse for at generere invitationer.
      </p>
    );
  }

  return (
    <div className="ring-1 ring-border rounded-sm divide-y divide-border">
      {approvals.map((a) => (
        <div key={a.id} className="flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-medium">{a.member?.name || "Ukendt"}</p>
            <p className="text-xs text-muted-foreground capitalize">{a.member?.role || ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {a.approved_at ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">
                  Godkendt {formatShortDate(a.approved_at)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Afventer</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ParticipantsTab;

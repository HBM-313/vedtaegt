import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserCheck, UserX } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { getRoleLabel } from "@/lib/roles";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Approval {
  id: string;
  approved_at: string | null;
  status: string | null;
  fremmoedt: boolean | null;
  member: { name: string; role: string } | null;
}

interface Props {
  meetingId: string;
  orgId: string;
  meetingStatus: string;
}

const ParticipantsTab = ({ meetingId, orgId, meetingStatus }: Props) => {
  const perms = usePermissions();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Fremmøde kan kun registreres af dem med kanRedigereMoeder
  // og kun mens mødet er aktivt eller under godkendelse
  const kanRegistrere = perms.kanRedigereMoeder &&
    (meetingStatus === "active" || meetingStatus === "pending_approval" || meetingStatus === "approved");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("approvals")
      .select("id, approved_at, status, fremmoedt, members!approvals_member_id_fkey(name, role)")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    setApprovals(
      (data || []).map((a) => ({
        id: a.id,
        approved_at: a.approved_at,
        status: a.status,
        fremmoedt: a.fremmoedt,
        member: (a.members as { name: string; role: string } | null),
      }))
    );
    setLoading(false);
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const toggleFremmoedt = async (approval: Approval) => {
    if (!kanRegistrere) return;
    setSaving(approval.id);
    const nyVaerdi = !approval.fremmoedt;
    const { error } = await supabase
      .from("approvals")
      .update({
        fremmoedt: nyVaerdi,
        fremmoedt_registreret_at: nyVaerdi ? new Date().toISOString() : null,
      })
      .eq("id", approval.id);

    if (error) {
      toast.error("Kunne ikke opdatere fremmøde.");
    } else {
      setApprovals((prev) =>
        prev.map((a) => a.id === approval.id ? { ...a, fremmoedt: nyVaerdi } : a)
      );
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
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

  const fremmoedte = approvals.filter((a) => a.fremmoedt).length;
  const total = approvals.length;

  return (
    <div className="space-y-4">
      {/* Opsummering */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-green-600" />
          <span className="font-medium">{fremmoedte}</span>
          <span className="text-muted-foreground">fremmødt</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1.5">
          <UserX className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{total - fremmoedte}</span>
          <span className="text-muted-foreground">fraværende</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{total} inviteret</span>
      </div>

      <div className="ring-1 ring-border rounded-sm divide-y divide-border">
        {approvals.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.member?.name || "Ukendt"}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-muted-foreground">{getRoleLabel(a.member?.role || "")}</p>
                {/* Godkendelses-status */}
                {a.status === "godkendt" && (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-0.5" /> Godkendt {a.approved_at ? formatShortDate(a.approved_at) : ""}
                  </Badge>
                )}
                {a.status === "afvist" && (
                  <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-transparent dark:bg-red-900/30 dark:text-red-400">
                    <X className="h-3 w-3 mr-0.5" /> Afvist
                  </Badge>
                )}
                {a.status === "afventer" && (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-transparent">
                    Afventer godkendelse
                  </Badge>
                )}
              </div>
            </div>

            {/* Fremmøde-toggle */}
            <div className="shrink-0">
              {kanRegistrere ? (
                <button
                  onClick={() => toggleFremmoedt(a)}
                  disabled={saving === a.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${
                    a.fremmoedt
                      ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-50 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  }`}
                >
                  {a.fremmoedt
                    ? <><UserCheck className="h-3.5 w-3.5" /> Mødt</>
                    : <><UserX className="h-3.5 w-3.5" /> Fraværende</>
                  }
                </button>
              ) : (
                <span className={`text-xs ${a.fremmoedt ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  {a.fremmoedt ? "Mødt op" : "Fraværende"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {kanRegistrere && (
        <p className="text-xs text-muted-foreground">
          Klik på en deltager for at registrere fremmøde. Fremmøde vises i PDF-referatet.
        </p>
      )}
    </div>
  );
};

export default ParticipantsTab;

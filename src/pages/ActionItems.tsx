import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { logAuditEvent } from "@/lib/audit";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  meeting_id: string | null;
  assigned_to: string | null;
  meeting_title?: string;
  assignee_name?: string;
}

const ActionItems = () => {
  const { orgId, memberId } = useOrg();
  const navigate = useNavigate();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMine, setShowMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");

  const fetchItems = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("action_items")
      .select("id, title, status, due_date, meeting_id, assigned_to")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const meetingIds = [...new Set(data.map((d) => d.meeting_id).filter(Boolean))] as string[];
      const memberIds = [...new Set(data.map((d) => d.assigned_to).filter(Boolean))] as string[];

      const [meetingsRes, membersRes] = await Promise.all([
        meetingIds.length > 0
          ? supabase.from("meetings").select("id, title").in("id", meetingIds)
          : Promise.resolve({ data: [] }),
        memberIds.length > 0
          ? supabase.from("members").select("id, name").in("id", memberIds)
          : Promise.resolve({ data: [] }),
      ]);

      const meetingMap: Record<string, string> = {};
      meetingsRes.data?.forEach((m) => { meetingMap[m.id] = m.title; });
      const memberMap: Record<string, string> = {};
      membersRes.data?.forEach((m) => { memberMap[m.id] = m.name; });

      setItems(data.map((d) => ({
        ...d,
        meeting_title: d.meeting_id ? meetingMap[d.meeting_id] : undefined,
        assignee_name: d.assigned_to ? memberMap[d.assigned_to] : undefined,
      })));
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    let result = items;
    if (showMine && memberId) result = result.filter((i) => i.assigned_to === memberId);
    if (statusFilter === "open") result = result.filter((i) => i.status !== "done");
    if (statusFilter === "done") result = result.filter((i) => i.status === "done");
    return result;
  }, [items, showMine, memberId, statusFilter]);

  const toggleStatus = async (item: ActionItem) => {
    const newStatus = item.status === "done" ? "open" : "done";
    await supabase.from("action_items").update({ status: newStatus }).eq("id", item.id);

    if (newStatus === "done") {
      await logAuditEvent("action_item.completed", "action_item", item.id, { title: item.title });
      toast.success("Handlingspunkt markeret som afsluttet");
    } else {
      toast.success("Handlingspunkt genåbnet");
    }

    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: newStatus } : i));
  };

  const isOverdue = (item: ActionItem) =>
    item.status !== "done" && item.due_date && new Date(item.due_date) < new Date();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Handlingspunkter</h1>

      <div className="flex flex-wrap gap-2">
        <Button variant={statusFilter === "all" && !showMine ? "default" : "outline"} size="sm"
          onClick={() => { setStatusFilter("all"); setShowMine(false); }}>Alle</Button>
        <Button variant={showMine ? "default" : "outline"} size="sm"
          onClick={() => setShowMine(!showMine)}>Mine</Button>
        <Button variant={statusFilter === "open" ? "default" : "outline"} size="sm"
          onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}>Åbne</Button>
        <Button variant={statusFilter === "done" ? "default" : "outline"} size="sm"
          onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}>Afsluttede</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Ingen handlingspunkter</p>
          <p className="text-sm mt-1">De oprettes under hvert mødes dagsordenspunkter.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opgave</TableHead>
                <TableHead className="hidden md:table-cell">Møde</TableHead>
                <TableHead className="hidden sm:table-cell">Ansvarlig</TableHead>
                <TableHead className="hidden sm:table-cell">Deadline</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <button
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => item.meeting_id && navigate(`/moeder/${item.meeting_id}`)}
                    >
                      {item.title}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.meeting_title || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {item.assignee_name || "—"}
                  </TableCell>
                  <TableCell className={`hidden sm:table-cell tabular-nums ${isOverdue(item) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {item.due_date ? formatShortDate(item.due_date) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={item.status === "done" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleStatus(item)}
                    >
                      {item.status === "done" ? "Afsluttet" : "Åben"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ActionItems;

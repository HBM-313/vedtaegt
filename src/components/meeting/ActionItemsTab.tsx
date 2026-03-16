import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import { logAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import AddActionItemDialog from "./AddActionItemDialog";

interface ActionItem {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
  assignee?: { name: string } | null;
}

interface Props {
  meetingId: string;
  orgId: string;
}

const ActionItemsTab = ({ meetingId, orgId }: Props) => {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("action_items")
      .select("id, title, status, due_date, assigned_to, members!action_items_assigned_to_fkey(name)")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    const mapped = (data || []).map((item: any) => ({
      ...item,
      assignee: item.members,
    }));
    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, [meetingId]);

  const toggleStatus = async (item: ActionItem) => {
    const newStatus = item.status === "done" ? "open" : "done";
    await supabase
      .from("action_items")
      .update({ status: newStatus })
      .eq("id", item.id);

    if (newStatus === "done") {
      await logAuditEvent("action_item.completed", "action_item", item.id, {
        title: item.title,
      });
    }

    toast.success(newStatus === "done" ? "Markeret som udført." : "Genåbnet.");
    load();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ingen handlingspunkter endnu. Tilføj det første.
        </p>
      ) : (
        <div className="ring-1 ring-border rounded-sm divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              <button
                onClick={() => toggleStatus(item)}
                className={`shrink-0 h-5 w-5 rounded-sm border flex items-center justify-center transition-colors ${
                  item.status === "done"
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input hover:border-primary"
                }`}
              >
                {item.status === "done" && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.assignee?.name || "Ikke tildelt"}
                  {item.due_date && ` · Frist: ${formatShortDate(item.due_date)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Tilføj handlingspunkt
      </Button>

      {showDialog && (
        <AddActionItemDialog
          meetingId={meetingId}
          orgId={orgId}
          onClose={() => {
            setShowDialog(false);
            load();
          }}
        />
      )}
    </div>
  );
};

export default ActionItemsTab;

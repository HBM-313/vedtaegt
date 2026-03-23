import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import { logAuditEvent } from "@/lib/audit";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrg } from "@/context/OrgContext";
import { toast } from "sonner";
import { Plus, Check, ChevronDown, ChevronUp } from "lucide-react";
import AddActionItemDialog from "./AddActionItemDialog";

interface ActionItem {
  id: string;
  title: string;
  beskrivelse: string | null;
  statusnote: string | null;
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
  const { memberId } = useOrg();
  const perms = usePermissions();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingNote, setEditingNote] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("action_items")
      .select("id, title, beskrivelse, statusnote, status, due_date, assigned_to, members!action_items_assigned_to_fkey(name)")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    const mapped = (data || []).map((item: any) => ({
      ...item,
      assignee: item.members,
    }));
    setItems(mapped);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (item: ActionItem) => {
    const isOwn = item.assigned_to === memberId;
    if (!isOwn && !perms.kanLukkeAndresHandlingspunkter) {
      toast.error("Du har ikke tilladelse til at ændre andres handlingspunkter.");
      return;
    }
    const newStatus = item.status === "done" ? "open" : "done";
    await supabase.from("action_items").update({ status: newStatus }).eq("id", item.id);
    if (newStatus === "done") {
      await logAuditEvent("action_item.completed", "action_item", item.id, { title: item.title });
    }
    toast.success(newStatus === "done" ? "Markeret som udført." : "Genåbnet.");
    load();
  };

  const saveNote = async (item: ActionItem) => {
    setSavingNote(item.id);
    const note = editingNote[item.id] ?? item.statusnote ?? "";
    await supabase.from("action_items").update({ statusnote: note.trim() || null }).eq("id", item.id);
    setSavingNote(null);
    toast.success("Note gemt.");
    load();
  };

  const toggleExpand = (id: string, item: ActionItem) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!expanded[id] && editingNote[id] === undefined) {
      setEditingNote((prev) => ({ ...prev, [id]: item.statusnote ?? "" }));
    }
  };

  const canToggle = (item: ActionItem) =>
    item.assigned_to === memberId || perms.kanLukkeAndresHandlingspunkter;

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
            <div key={item.id}>
              <div className="flex items-center gap-3 p-3">
                {/* Afkrydsningsboks */}
                <button
                  onClick={() => toggleStatus(item)}
                  disabled={!canToggle(item)}
                  title={!canToggle(item) ? "Du har ikke tilladelse til at ændre andres handlingspunkter" : ""}
                  className={`shrink-0 h-5 w-5 rounded-sm border flex items-center justify-center transition-colors ${
                    item.status === "done"
                      ? "bg-primary border-primary text-primary-foreground"
                      : canToggle(item)
                      ? "border-input hover:border-primary"
                      : "border-input opacity-40 cursor-not-allowed"
                  }`}
                >
                  {item.status === "done" && <Check className="h-3 w-3" />}
                </button>

                {/* Indhold */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.assignee?.name || "Ikke tildelt"}
                    {item.due_date && ` · Frist: ${formatShortDate(item.due_date)}`}
                    {item.statusnote && ` · Note: ${item.statusnote.slice(0, 40)}${item.statusnote.length > 40 ? "…" : ""}`}
                  </p>
                </div>

                {/* Udvid-knap */}
                <button
                  onClick={() => toggleExpand(item.id, item)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expanded[item.id]
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Udvidet detaljevisning */}
              {expanded[item.id] && (
                <div className="px-4 pb-4 space-y-3 bg-muted/20 border-t border-border">
                  {item.beskrivelse && (
                    <div className="pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Beskrivelse</p>
                      <p className="text-sm whitespace-pre-wrap">{item.beskrivelse}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Statusnote <span className="font-normal">(synlig for alle)</span>
                    </p>
                    <Textarea
                      value={editingNote[item.id] ?? item.statusnote ?? ""}
                      onChange={(e) =>
                        setEditingNote((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Skriv en statusopdatering..."
                      className="min-h-[70px] text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={savingNote === item.id}
                      onClick={() => saveNote(item)}
                    >
                      {savingNote === item.id ? "Gemmer..." : "Gem note"}
                    </Button>
                  </div>
                </div>
              )}
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
          onClose={() => { setShowDialog(false); load(); }}
        />
      )}
    </div>
  );
};

export default ActionItemsTab;

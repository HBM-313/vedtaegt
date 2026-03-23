import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Vote, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AddActionItemDialog from "./AddActionItemDialog";
import AfstemningDialog from "./AfstemningDialog";

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
}

interface Afstemning {
  id: string;
  agenda_item_id: string;
  spoergsmaal: string;
  ja_antal: number;
  nej_antal: number;
  undladt_antal: number;
  er_hemmelig: boolean;
  noter: string | null;
}

interface Props {
  meetingId: string;
  orgId: string;
  meetingStatus: string;
}

const AgendaMinutesTab = ({ meetingId, orgId, meetingStatus }: Props) => {
  const { memberId } = useOrg();
  const perms = usePermissions();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [minutesContent, setMinutesContent] = useState<Record<string, string>>({});
  const [minutesId, setMinutesId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [addingForItem, setAddingForItem] = useState<string | null>(null);
  const [afstemningForItem, setAfstemningForItem] = useState<string | null>(null);
  const [afstemninger, setAfstemninger] = useState<Record<string, Afstemning>>({});
  const contentRef = useRef(minutesContent);
  contentRef.current = minutesContent;

  // Agenda editing state
  const [editingAgenda, setEditingAgenda] = useState(false);
  const [editItems, setEditItems] = useState<AgendaItem[]>([]);
  const [savingAgenda, setSavingAgenda] = useState(false);

  const isLocked = meetingStatus === "pending_approval" || meetingStatus === "approved";

  const load = useCallback(async () => {
    const [agendaRes, minutesRes, afstemningRes] = await Promise.all([
      supabase
        .from("agenda_items")
        .select("id, title, description, sort_order")
        .eq("meeting_id", meetingId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("minutes")
        .select("id, content")
        .eq("meeting_id", meetingId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("afstemninger")
        .select("id, agenda_item_id, spoergsmaal, ja_antal, nej_antal, undladt_antal, er_hemmelig, noter")
        .eq("meeting_id", meetingId),
    ]);

    setItems((agendaRes.data as AgendaItem[]) || []);

    if (minutesRes.data) {
      setMinutesId(minutesRes.data.id);
      try {
        const parsed = JSON.parse(minutesRes.data.content);
        setMinutesContent(parsed);
      } catch {
        setMinutesContent({});
      }
    }

    if (afstemningRes.data) {
      const map: Record<string, Afstemning> = {};
      (afstemningRes.data as Afstemning[]).forEach((a) => {
        map[a.agenda_item_id] = a;
      });
      setAfstemninger(map);
    }

    setLoading(false);
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const saveMinutes = useCallback(async () => {
    const content = JSON.stringify(contentRef.current);
    setSaveStatus("Gemmer...");

    try {
      if (minutesId) {
        await supabase
          .from("minutes")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", minutesId);
      } else {
        const { data } = await supabase
          .from("minutes")
          .insert({
            meeting_id: meetingId,
            org_id: orgId,
            content,
            created_by: memberId,
          })
          .select()
          .single();
        if (data) setMinutesId(data.id);
      }

      const now = new Date();
      setSaveStatus(`Gemt kl. ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    } catch {
      setSaveStatus("Fejl ved gem");
    }
  }, [minutesId, meetingId, orgId, memberId]);

  // Auto-save every 30 seconds (disabled when locked)
  useEffect(() => {
    if (isLocked) return;
    const interval = setInterval(() => {
      if (Object.keys(contentRef.current).length > 0) {
        saveMinutes();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [saveMinutes, isLocked]);

  const updateContent = (itemId: string, value: string) => {
    setMinutesContent((prev) => ({ ...prev, [itemId]: value }));
  };

  // Agenda editing handlers
  const handleSaveAgenda = async () => {
    const filtered = editItems.filter((ei) => ei.title.trim());
    if (filtered.length === 0) {
      toast.error("Dagsordenen skal have mindst ét punkt.");
      return;
    }
    setSavingAgenda(true);
    try {
      // Find removed items
      const editIds = new Set(filtered.map((ei) => ei.id));
      const removed = items.filter((orig) => !editIds.has(orig.id));

      // Delete removed
      for (const r of removed) {
        await supabase.from("agenda_items").delete().eq("id", r.id);
      }

      // Upsert existing / insert new
      for (let idx = 0; idx < filtered.length; idx++) {
        const ei = filtered[idx];
        if (items.some((orig) => orig.id === ei.id)) {
          // Existing item — update
          await supabase
            .from("agenda_items")
            .update({ title: ei.title.trim(), sort_order: idx })
            .eq("id", ei.id);
        } else {
          // New item — insert
          await supabase.from("agenda_items").insert({
            meeting_id: meetingId,
            org_id: orgId,
            title: ei.title.trim(),
            sort_order: idx,
          });
        }
      }

      toast.success("Dagsorden opdateret.");
      setEditingAgenda(false);
      await load();
    } catch {
      toast.error("Kunne ikke gemme dagsorden.");
    } finally {
      setSavingAgenda(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen dagsordenspunkter. Tilføj punkter under "Opret møde".
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {saveStatus && !isLocked && (
        <p className="text-xs text-muted-foreground text-right">{saveStatus}</p>
      )}

      {isLocked && (
        <p className="text-xs text-muted-foreground">
          {meetingStatus === "pending_approval"
            ? "Referatet er sendt til godkendelse og kan ikke redigeres. Træk det tilbage for at foretage ændringer."
            : "Referatet er godkendt og kan ikke ændres."}
        </p>
      )}

      {!isLocked && perms.kanRedigereMoeder && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditingAgenda(true); setEditItems([...items]); }}
          >
            <Pencil className="h-4 w-4 mr-1" /> Rediger dagsorden
          </Button>
        </div>
      )}

      {items.map((item, i) => (
        <div key={item.id} className="ring-1 ring-border rounded-sm">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">
              {i + 1}. {item.title}
            </h3>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>
          <div className="p-4 space-y-3">
            <Textarea
              value={minutesContent[item.id] || ""}
              onChange={(e) => !isLocked && updateContent(item.id, e.target.value)}
              placeholder={isLocked ? "Referatet er låst og kan ikke redigeres." : "Skriv referat for dette punkt..."}
              readOnly={isLocked}
              className={`min-h-[100px] text-sm ${isLocked ? "bg-muted cursor-not-allowed" : ""}`}
            />
            {!isLocked && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingForItem(item.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tilføj handlingspunkt
                </Button>
                {perms.kanRedigereMoeder && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAfstemningForItem(item.id)}
                  >
                    <Vote className="h-4 w-4 mr-1" />
                    {afstemninger[item.id] ? "Rediger afstemning" : "Registrér afstemning"}
                  </Button>
                )}
              </div>
            )}

            {/* Vis eksisterende afstemning */}
            {afstemninger[item.id] && (() => {
              const a = afstemninger[item.id];
              const total = a.ja_antal + a.nej_antal + a.undladt_antal;
              return (
                <div className="rounded-sm bg-muted/40 border border-border p-3 text-sm space-y-1">
                  <p className="font-medium text-xs">{a.er_hemmelig ? "Hemmelig afstemning" : "Afstemning"}: {a.spoergsmaal}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-700 dark:text-green-400">Ja: {a.ja_antal}</span>
                    <span className="text-red-700 dark:text-red-400">Nej: {a.nej_antal}</span>
                    <span className="text-muted-foreground">Undladt: {a.undladt_antal}</span>
                    <span className="text-muted-foreground">I alt: {total}</span>
                  </div>
                  {a.noter && <p className="text-xs text-muted-foreground italic">{a.noter}</p>}
                </div>
              );
            })()}
          </div>
        </div>
      ))}

      {!isLocked && (
        <Button variant="outline" size="sm" onClick={saveMinutes}>
          Gem referat nu
        </Button>
      )}

      {addingForItem && (
        <AddActionItemDialog
          meetingId={meetingId}
          orgId={orgId}
          agendaItemId={addingForItem}
          onClose={() => setAddingForItem(null)}
        />
      )}

      {afstemningForItem && (() => {
        const currentItem = items.find((i) => i.id === afstemningForItem);
        return (
          <AfstemningDialog
            meetingId={meetingId}
            orgId={orgId}
            agendaItemId={afstemningForItem}
            agendaItemTitle={currentItem?.title ?? ""}
            existing={afstemninger[afstemningForItem] ?? null}
            onClose={() => setAfstemningForItem(null)}
            onSaved={(saved) => {
              setAfstemninger((prev) => ({ ...prev, [afstemningForItem]: saved }));
              setAfstemningForItem(null);
            }}
          />
        );
      })()}

      {/* Rediger dagsorden dialog */}
      <Dialog open={editingAgenda} onOpenChange={(open) => { if (!open) setEditingAgenda(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Rediger dagsorden</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {editItems.map((ei, idx) => (
              <div key={ei.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{idx + 1}.</span>
                <Input
                  value={ei.title}
                  onChange={(e) => {
                    const updated = [...editItems];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    setEditItems(updated);
                  }}
                  placeholder="Punktets titel..."
                  className="text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  disabled={editItems.length <= 1}
                  onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditItems([
                  ...editItems,
                  { id: `new-${crypto.randomUUID()}`, title: "", description: null, sort_order: editItems.length },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Tilføj punkt
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAgenda(false)}>Annullér</Button>
            <Button onClick={handleSaveAgenda} disabled={savingAgenda}>
              {savingAgenda ? "Gemmer..." : "Gem dagsorden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgendaMinutesTab;

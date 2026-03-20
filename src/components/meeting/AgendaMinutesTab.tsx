import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrg } from "@/context/OrgContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Vote } from "lucide-react";
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
}

const AgendaMinutesTab = ({ meetingId, orgId }: Props) => {
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

  useEffect(() => {
    const load = async () => {
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
    };
    load();
  }, [meetingId]);

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

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(contentRef.current).length > 0) {
        saveMinutes();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [saveMinutes]);

  const updateContent = (itemId: string, value: string) => {
    setMinutesContent((prev) => ({ ...prev, [itemId]: value }));
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
      {saveStatus && (
        <p className="text-xs text-muted-foreground text-right">{saveStatus}</p>
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
              onChange={(e) => updateContent(item.id, e.target.value)}
              placeholder="Skriv referat for dette punkt..."
              className="min-h-[100px] text-sm"
            />
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

      <Button variant="outline" size="sm" onClick={saveMinutes}>
        Gem referat nu
      </Button>

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
    </div>
  );
};

export default AgendaMinutesTab;

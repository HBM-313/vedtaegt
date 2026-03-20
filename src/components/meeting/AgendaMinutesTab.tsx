import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrg } from "@/context/OrgContext";
import { Plus } from "lucide-react";
import AddActionItemDialog from "./AddActionItemDialog";

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
}

interface Props {
  meetingId: string;
  orgId: string;
}

const AgendaMinutesTab = ({ meetingId, orgId }: Props) => {
  const { memberId } = useOrg();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [minutesContent, setMinutesContent] = useState<Record<string, string>>({});
  const [minutesId, setMinutesId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [addingForItem, setAddingForItem] = useState<string | null>(null);
  const contentRef = useRef(minutesContent);
  contentRef.current = minutesContent;

  useEffect(() => {
    const load = async () => {
      const [agendaRes, minutesRes] = await Promise.all([
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingForItem(item.id)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Tilføj handlingspunkt
            </Button>
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
    </div>
  );
};

export default AgendaMinutesTab;

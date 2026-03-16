import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrg } from "@/components/AppLayout";
import { logAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  CalendarIcon,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AgendaItem {
  id: string;
  title: string;
  description: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
}

function SortableAgendaItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: AgendaItem;
  onUpdate: (id: string, field: "title" | "description", value: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 ring-1 ring-border rounded-sm p-3 bg-background"
    >
      <button
        type="button"
        className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 space-y-2">
        <Input
          value={item.title}
          onChange={(e) => onUpdate(item.id, "title", e.target.value)}
          placeholder="Titel på dagsordenspunkt"
          className="text-sm"
        />
        <Textarea
          value={item.description}
          onChange={(e) => onUpdate(item.id, "description", e.target.value)}
          placeholder="Beskrivelse (valgfrit)"
          className="text-sm min-h-[60px]"
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="mt-2 text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

const CreateMeeting = () => {
  const navigate = useNavigate();
  const { orgId, memberId } = useOrg();
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("");

  // Agenda items
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Members
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("members")
      .select("id, name, role, email")
      .eq("org_id", orgId)
      .then(({ data }) => {
        if (data) setOrgMembers(data);
      });
  }, [orgId]);

  const addAgendaItem = () => {
    setAgendaItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", description: "" },
    ]);
  };

  const updateAgendaItem = (id: string, field: "title" | "description", value: string) => {
    setAgendaItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeAgendaItem = (id: string) => {
    setAgendaItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAgendaItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleSubmit — orgId:", orgId, "memberId:", memberId);
    if (!title.trim()) {
      toast.error("Mødets titel er påkrævet.");
      return;
    }
    if (!orgId) {
      console.error("orgId mangler — tjek OrganizationContext");
      toast.error("Organisationsdata mangler — prøv at genindlæse siden.");
      return;
    }
    if (!memberId) {
      console.error("memberId mangler — member ikke fundet for denne bruger");
      toast.error("Brugerdata mangler — prøv at genindlæse siden.");
      return;
    }

    setLoading(true);
    try {
      // Build meeting_date
      let meetingDate: string | null = null;
      if (date) {
        const [hours, minutes] = time.split(":").map(Number);
        const d = new Date(date);
        d.setHours(hours, minutes, 0, 0);
        meetingDate = d.toISOString();
      }

      // Insert meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          org_id: orgId,
          title: title.trim(),
          meeting_date: meetingDate,
          location: location.trim() || null,
          status: "draft",
          created_by: memberId,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Insert agenda items
      const validItems = agendaItems.filter((a) => a.title.trim());
      if (validItems.length > 0) {
        const { error: agendaError } = await supabase.from("agenda_items").insert(
          validItems.map((item, i) => ({
            meeting_id: meeting.id,
            org_id: orgId,
            title: item.title.trim(),
            description: item.description.trim() || null,
            sort_order: i,
          }))
        );
        if (agendaError) throw agendaError;
      }

      // Save selected participants as approvals (pending)
      if (selectedMembers.length > 0) {
        const { error: partError } = await supabase.from("approvals").insert(
          selectedMembers.map((mid) => ({
            meeting_id: meeting.id,
            org_id: orgId,
            member_id: mid,
            approved_at: null,
            token: null,
            token_expires_at: null,
          }))
        );
        if (partError) console.error("Could not save participants:", partError);
      }

      // Audit log
      await logAuditEvent("meeting.created", "meeting", meeting.id, {
        title: title.trim(),
        agenda_items_count: validItems.length,
        participants_count: selectedMembers.length,
      });

      toast.success("Mødet er oprettet.");
      navigate(`/moeder/${meeting.id}`);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke oprette mødet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-display mb-6">Opret møde</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-xs">
            Mødets titel
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="F.eks. Ordinær generalforsamling 2025"
            required
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Dato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {date ? format(date, "d. MMMM yyyy", { locale: da }) : "Vælg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={da}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="text-xs">
              Tidspunkt
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-xs">
            Sted / lokation <span className="text-muted-foreground">(valgfrit)</span>
          </Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="F.eks. Kulturhuset, Mødelokale 2"
          />
        </div>

        {/* Agenda items */}
        <div className="space-y-3">
          <Label className="text-xs">Dagsordenpunkter</Label>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={agendaItems.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {agendaItems.map((item) => (
                  <SortableAgendaItem
                    key={item.id}
                    item={item}
                    onUpdate={updateAgendaItem}
                    onRemove={removeAgendaItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
            <Plus className="h-4 w-4 mr-1" />
            Tilføj punkt
          </Button>
        </div>

        {/* Invite members */}
        {orgMembers.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs">Invitér til mødet</Label>
            <div className="ring-1 ring-border rounded-sm divide-y divide-border">
              {orgMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selectedMembers.includes(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(member.role)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="sm" className="press-effect" disabled={loading || !orgId || !memberId}>
            {loading ? "Opretter..." : !orgId || !memberId ? "Henter data..." : "Opret møde"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/moeder")}
          >
            Annullér
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateMeeting;

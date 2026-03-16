import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
}

interface Props {
  meetingId: string;
  orgId: string;
  agendaItemId?: string;
  onClose: () => void;
}

const AddActionItemDialog = ({ meetingId, orgId, agendaItemId, onClose }: Props) => {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("members")
      .select("id, name")
      .eq("org_id", orgId)
      .then(({ data }) => {
        if (data) setMembers(data);
      });
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Titel er påkrævet.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("action_items").insert({
      meeting_id: meetingId,
      org_id: orgId,
      agenda_item_id: agendaItemId || null,
      title: title.trim(),
      assigned_to: assignedTo || null,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      status: "open",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Handlingspunkt tilføjet.");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Tilføj handlingspunkt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Titel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Beskriv opgaven"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Ansvarlig</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg ansvarlig" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Frist</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dueDate ? format(dueDate, "d. MMMM yyyy", { locale: da }) : "Vælg frist"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  locale={da}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annullér
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Tilføjer..." : "Tilføj"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddActionItemDialog;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
  agendaItemId: string;
  agendaItemTitle: string;
  existing: Afstemning | null;
  onClose: () => void;
  onSaved: (afstemning: Afstemning) => void;
}

const AfstemningDialog = ({
  meetingId, orgId, agendaItemId, agendaItemTitle,
  existing, onClose, onSaved,
}: Props) => {
  const [spoergsmaal, setSpoergsmaal] = useState(existing?.spoergsmaal ?? "");
  const [jaAntal, setJaAntal] = useState(existing?.ja_antal ?? 0);
  const [nejAntal, setNejAntal] = useState(existing?.nej_antal ?? 0);
  const [undladtAntal, setUndladtAntal] = useState(existing?.undladt_antal ?? 0);
  const [erHemmelig, setErHemmelig] = useState(existing?.er_hemmelig ?? false);
  const [noter, setNoter] = useState(existing?.noter ?? "");
  const [saving, setSaving] = useState(false);

  const total = jaAntal + nejAntal + undladtAntal;

  const handleSave = async () => {
    if (!spoergsmaal.trim()) {
      toast.error("Spørgsmål er påkrævet.");
      return;
    }
    if (total === 0) {
      toast.error("Angiv mindst ét stemme-tal.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        meeting_id: meetingId,
        org_id: orgId,
        agenda_item_id: agendaItemId,
        spoergsmaal: spoergsmaal.trim(),
        ja_antal: jaAntal,
        nej_antal: nejAntal,
        undladt_antal: undladtAntal,
        er_hemmelig: erHemmelig,
        noter: noter.trim() || null,
      };

      if (existing) {
        const { data, error } = await supabase
          .from("afstemninger")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        toast.success("Afstemning opdateret.");
        onSaved(data as Afstemning);
      } else {
        const { data, error } = await supabase
          .from("afstemninger")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        toast.success("Afstemning gemt.");
        onSaved(data as Afstemning);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kunne ikke gemme afstemning.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const numInput = (
    val: number,
    setter: (n: number) => void,
    label: string,
    colorClass: string
  ) => (
    <div className="space-y-1">
      <Label className={`text-xs font-medium ${colorClass}`}>{label}</Label>
      <Input
        type="number"
        min={0}
        max={999}
        value={val}
        onChange={(e) => setter(Math.max(0, parseInt(e.target.value) || 0))}
        className="text-center"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {existing ? "Rediger afstemning" : "Registrér afstemning"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Tilknyttet: <span className="font-medium text-foreground">{agendaItemTitle}</span>
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spoergsmaal" className="text-xs">Spørgsmål / emne</Label>
            <Input
              id="spoergsmaal"
              value={spoergsmaal}
              onChange={(e) => setSpoergsmaal(e.target.value)}
              placeholder="F.eks. Godkendelse af regnskab 2024"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {numInput(jaAntal, setJaAntal, "Ja", "text-green-700 dark:text-green-400")}
            {numInput(nejAntal, setNejAntal, "Nej", "text-red-700 dark:text-red-400")}
            {numInput(undladtAntal, setUndladtAntal, "Undladt", "text-muted-foreground")}
          </div>

          {total > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              I alt: {total} stemmer · {jaAntal} ja · {nejAntal} nej · {undladtAntal} undladt
            </p>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="hemmelig"
              checked={erHemmelig}
              onCheckedChange={(v) => setErHemmelig(v === true)}
            />
            <Label htmlFor="hemmelig" className="text-xs cursor-pointer">
              Hemmelig afstemning
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="noter" className="text-xs">
              Noter <span className="text-muted-foreground">(valgfrit)</span>
            </Label>
            <Textarea
              id="noter"
              value={noter}
              onChange={(e) => setNoter(e.target.value)}
              placeholder="Eventuelle bemærkninger til afstemningen..."
              className="min-h-[60px] text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Gemmer..." : existing ? "Opdatér" : "Gem afstemning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AfstemningDialog;

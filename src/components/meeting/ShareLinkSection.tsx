import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

interface Props {
  meetingId: string;
  shareToken: string | null;
  shareAktiv: boolean;
  sharePinHash: string | null;
  onUpdate: (token: string | null, aktiv: boolean, pinHash: string | null) => void;
}

const BASE_URL = window.location.origin;

const sha256hex = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const ShareLinkSection = ({ meetingId, shareToken, shareAktiv, sharePinHash, onUpdate }: Props) => {
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [aktiv, setAktiv] = useState(shareAktiv);

  const url = shareToken ? `${BASE_URL}/referat/${shareToken}` : null;

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const newToken = crypto.randomUUID();
      let pinHash: string | null = null;
      if (pin.length >= 4) {
        pinHash = await sha256hex(pin);
      }
      const { error } = await supabase
        .from("meetings")
        .update({ share_token: newToken, share_aktiv: true, share_pin_hash: pinHash })
        .eq("id", meetingId);
      if (error) throw error;
      setAktiv(true);
      onUpdate(newToken, true, pinHash);
      toast.success("Delelink oprettet.");
    } catch {
      toast.error("Kunne ikke oprette delelink.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("meetings")
      .update({ share_aktiv: checked })
      .eq("id", meetingId);
    if (!error) {
      setAktiv(checked);
      onUpdate(shareToken, checked, sharePinHash);
      toast.success(checked ? "Delelink aktiveret." : "Delelink deaktiveret.");
    }
    setSaving(false);
  };

  const handleCopy = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("Link kopieret.");
  }, [url]);

  const handleUpdatePin = async () => {
    setSaving(true);
    try {
      let pinHash: string | null = null;
      if (pin.length >= 4) {
        pinHash = await sha256hex(pin);
      }
      const { error } = await supabase
        .from("meetings")
        .update({ share_pin_hash: pinHash })
        .eq("id", meetingId);
      if (error) throw error;
      onUpdate(shareToken, aktiv, pinHash);
      setPin("");
      toast.success(pinHash ? "PIN-kode opdateret." : "PIN-kode fjernet.");
    } catch {
      toast.error("Kunne ikke opdatere PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ring-1 ring-border rounded-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Del referat</h3>
      </div>

      {!shareToken ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Opret et delelink så foreningsmedlemmer kan læse referatet uden login.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">
              PIN-kode <span className="text-muted-foreground">(valgfrit — min. 4 cifre)</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="F.eks. 1234"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button size="sm" onClick={handleGenerate} disabled={saving}>
            <Link className="h-4 w-4 mr-1" /> Opret delelink
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Aktiv toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Link er {aktiv ? "aktivt" : "deaktiveret"}</p>
              <p className="text-xs text-muted-foreground">
                {aktiv ? "Alle med linket kan se referatet." : "Ingen kan tilgå referatet via link."}
              </p>
            </div>
            <Switch checked={aktiv} onCheckedChange={handleToggle} disabled={saving} />
          </div>

          {/* URL */}
          {aktiv && (
            <div className="flex gap-2">
              <Input value={url || ""} readOnly className="text-xs font-mono bg-muted" />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* PIN-opdatering */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium">
              {sharePinHash ? "Skift eller fjern PIN-kode" : "Tilføj PIN-kode"}
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder={sharePinHash ? "Ny PIN (tom = fjern)" : "F.eks. 1234"}
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={handleUpdatePin} disabled={saving}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {sharePinHash ? "Opdatér" : "Tilføj PIN"}
              </Button>
            </div>
            {sharePinHash && !pin && (
              <p className="text-xs text-muted-foreground">Lad feltet stå tomt og klik Opdatér for at fjerne PIN.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareLinkSection;

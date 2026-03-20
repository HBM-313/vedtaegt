import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/components/AppLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { logAuditEvent } from "@/lib/audit";
import { getRoleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { toast } from "sonner";
import { useDawaPostnummer } from "@/hooks/useDawaPostnummer";

const ROLE_BADGE_STYLES: Record<string, string> = {
  formand: "bg-blue-900 text-blue-50 border-blue-800",
  naestformand: "bg-blue-100 text-blue-800 border-blue-200",
  kasserer: "bg-green-100 text-green-800 border-green-200",
  bestyrelsesmedlem: "bg-muted text-muted-foreground border-border",
  suppleant: "bg-muted/50 text-muted-foreground/70 border-border",
};

const Profile = () => {
  const { memberId } = useOrg();
  const perms = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { lookup: dawaLookup } = useDawaPostnummer();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adresse, setAdresse] = useState("");
  const [postnummer, setPostnummer] = useState("");
  const [by_, setBy] = useState("");
  const [foedselsdato, setFoedselsdato] = useState("");
  const [role, setRole] = useState("");

  const fetchProfile = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("name, email, role, telefon, adresse, postnummer, by, foedselsdato")
      .eq("id", memberId)
      .single();

    if (data) {
      const d = data as any;
      setName(d.name || "");
      setEmail(d.email || "");
      setTelefon(d.telefon || "");
      setAdresse(d.adresse || "");
      setPostnummer(d.postnummer || "");
      setBy(d.by || "");
      setFoedselsdato(d.foedselsdato || "");
      setRole(d.role || "");
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Auto-udfyld by fra postnummer via DAWA
  useEffect(() => {
    if (postnummer.length === 4) {
      dawaLookup(postnummer).then((navn) => {
        if (navn) setBy(navn);
      });
    }
  }, [postnummer, dawaLookup]);

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({
        name: name.trim(),
        telefon: telefon.trim() || null,
        adresse: adresse.trim() || null,
        postnummer: postnummer.trim() || null,
        by: by_.trim() || null,
        foedselsdato: foedselsdato || null,
      } as any)
      .eq("id", memberId);

    if (error) {
      toast.error("Kunne ikke gemme ændringer.");
    } else {
      await logAuditEvent("member.profile_updated", "member", memberId);
      toast.success("Dine oplysninger er gemt.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground">Min profil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" /> Personoplysninger
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            Din rolle:{" "}
            <Badge variant="outline" className={ROLE_BADGE_STYLES[role] || ""}>
              {getRoleLabel(role)}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name" className="text-xs">Fulde navn</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-email" className="text-xs">E-mailadresse</Label>
            <Input id="p-email" value={email} readOnly className="bg-muted" />
            <p className="text-xs text-muted-foreground">Kontakt formanden for at ændre e-mail</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-telefon" className="text-xs">Telefonnummer</Label>
            <Input id="p-telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-foedselsdato" className="text-xs">Fødselsdato</Label>
            <Input id="p-foedselsdato" type="date" value={foedselsdato} onChange={(e) => setFoedselsdato(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-1">
              <Label htmlFor="p-adresse" className="text-xs">Adresse</Label>
              <Input id="p-adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-postnr" className="text-xs">Postnr.</Label>
              <Input id="p-postnr" value={postnummer} onChange={(e) => setPostnummer(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-by" className="text-xs">By</Label>
              <Input id="p-by" value={by_} onChange={(e) => setBy(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

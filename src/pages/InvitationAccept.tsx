import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getRoleLabel } from "@/lib/roles";
import { Shield, AlertTriangle, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ROLE_BADGE_STYLES: Record<string, string> = {
  formand: "bg-blue-900 text-blue-50 border-blue-800",
  naestformand: "bg-blue-100 text-blue-800 border-blue-200",
  kasserer: "bg-green-100 text-green-800 border-green-200",
  bestyrelsesmedlem: "bg-muted text-muted-foreground border-border",
  suppleant: "bg-muted/50 text-muted-foreground/70 border-border",
};

interface InvitationData {
  memberId: string;
  email: string;
  role: string;
  orgName: string;
  formandName: string;
}

const InvitationAccept = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [telefon, setTelefon] = useState("");
  const [foedselsdato, setFoedselsdato] = useState("");
  const [adresse, setAdresse] = useState("");
  const [postnummer, setPostnummer] = useState("");
  const [by_, setBy] = useState("");
  const [dpaAccepted, setDpaAccepted] = useState(false);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) { setExpired(true); setLoading(false); return; }

      // Find member by invitation_token
      const { data: member, error } = await supabase
        .from("members")
        .select("id, email, role, org_id, invitation_token_expires_at")
        .eq("invitation_token", token)
        .maybeSingle();

      if (error || !member) { setExpired(true); setLoading(false); return; }

      // Check expiration
      if (member.invitation_token_expires_at && new Date(member.invitation_token_expires_at) < new Date()) {
        setExpired(true); setLoading(false); return;
      }

      // Get org name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", member.org_id!)
        .single();

      // Get formand name
      const { data: formand } = await supabase
        .from("members")
        .select("name")
        .eq("org_id", member.org_id!)
        .eq("role", "formand")
        .maybeSingle();

      setInvitation({
        memberId: member.id,
        email: member.email,
        role: member.role,
        orgName: org?.name || "Ukendt forening",
        formandName: formand?.name || "Formanden",
      });
      setLoading(false);
    };

    loadInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    if (password.length < 8) { toast.error("Adgangskoden skal være mindst 8 tegn."); return; }
    if (password !== confirmPassword) { toast.error("Adgangskoderne matcher ikke."); return; }
    if (!dpaAccepted) { toast.error("Du skal acceptere Databehandleraftalen."); return; }

    setSubmitting(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Bruger blev ikke oprettet.");

      if (authData.user.identities?.length === 0) {
        toast.error("En bruger med denne e-mail eksisterer allerede. Prøv at logge ind i stedet.");
        setSubmitting(false); return;
      }

      // 2. Update the member record — use the service through an edge function
      // Since we might not have a session yet (email unconfirmed), we update via the anon policy
      const { error: updateError } = await supabase
        .from("members")
        .update({
          user_id: authData.user.id,
          name: name.trim(),
          telefon: telefon.trim(),
          foedselsdato: foedselsdato || null,
          adresse: adresse.trim() || null,
          postnummer: postnummer.trim() || null,
          by: by_.trim() || null,
          joined_at: new Date().toISOString(),
          invitation_token: null,
          invitation_token_expires_at: null,
          email_bekraeftet: false,
        } as any)
        .eq("invitation_token", token);

      if (updateError) throw updateError;

      // Store email for resend
      localStorage.setItem("vedtaegt_invitation_email", invitation.email);

      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Noget gik galt. Prøv igen.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    const emailAddr = invitation?.email || localStorage.getItem("vedtaegt_invitation_email") || "";
    const { error } = await supabase.auth.resend({ type: "signup", email: emailAddr });
    if (error) toast.error("Kunne ikke sende bekræftelsesmail igen.");
    else toast.success("Bekræftelsesmail sendt igen.");
    setResending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md p-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Invitation udløbet eller ugyldig</h1>
          <p className="text-sm text-muted-foreground">
            Denne invitation er udløbet eller ugyldig. Bed foreningens formand om at sende en ny invitation.
          </p>
          <Link to="/login">
            <Button variant="outline" size="sm">Gå til login</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-sm p-8 text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-2">Tjek din indbakke</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vi har sendt en bekræftelsesmail til <strong className="text-foreground">{invitation?.email}</strong>.
              Klik på linket i mailen for at aktivere din konto og få adgang til <strong className="text-foreground">{invitation?.orgName}</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={resending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Sender..." : "Send bekræftelsesmail igen"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-display">Vedtægt</span>
        </div>

        {/* Welcome box */}
        <div className="rounded-lg border border-border bg-muted/30 p-5 mb-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Du er inviteret som</p>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${ROLE_BADGE_STYLES[invitation!.role] || ""}`}>
            {getRoleLabel(invitation!.role)}
          </Badge>
          <div className="text-sm text-muted-foreground">
            <p>af Formand: <strong className="text-foreground">{invitation!.formandName}</strong></p>
            <p>til foreningen: <strong className="text-foreground">{invitation!.orgName}</strong></p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">Opret din profil</h2>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Fulde navn</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dit fulde navn" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-email" className="text-xs">E-mailadresse</Label>
            <Input id="inv-email" value={invitation!.email} readOnly className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-password" className="text-xs">Adgangskode</Label>
            <Input id="inv-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindst 8 tegn" required minLength={8} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-confirm" className="text-xs">Bekræft adgangskode</Label>
            <Input id="inv-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Gentag adgangskode" required minLength={8} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-telefon" className="text-xs">Telefonnummer</Label>
            <Input id="inv-telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="+45 12 34 56 78" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-foedselsdato" className="text-xs">Fødselsdato</Label>
            <Input id="inv-foedselsdato" type="date" value={foedselsdato} onChange={(e) => setFoedselsdato(e.target.value)} required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-1">
              <Label htmlFor="inv-adresse" className="text-xs">Adresse <span className="text-muted-foreground">(valgfrit)</span></Label>
              <Input id="inv-adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-postnr" className="text-xs">Postnr.</Label>
              <Input id="inv-postnr" value={postnummer} onChange={(e) => setPostnummer(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-by" className="text-xs">By</Label>
              <Input id="inv-by" value={by_} onChange={(e) => setBy(e.target.value)} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-sm bg-muted p-3">
            <p className="text-xs text-muted-foreground">Din rolle: <strong>{getRoleLabel(invitation!.role)}</strong> — rollen kan ikke ændres</p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox id="inv-dpa" checked={dpaAccepted} onCheckedChange={(c) => setDpaAccepted(c === true)} />
            <Label htmlFor="inv-dpa" className="text-sm leading-relaxed cursor-pointer">
              Jeg accepterer{" "}
              <a href="/dpa" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Databehandleraftalen</a>{" "}
              <span className="text-muted-foreground">(påkrævet)</span>
            </Label>
          </div>

          <Button type="submit" className="w-full" size="sm" disabled={submitting || !dpaAccepted}>
            {submitting ? "Opretter..." : "Opret konto og tilslut forening"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default InvitationAccept;

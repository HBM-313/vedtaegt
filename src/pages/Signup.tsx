import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, ArrowLeft, Info, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";

const POSTNUMMER_MAP: Record<string, string> = {
  "1000": "København K", "1500": "København V", "2000": "Frederiksberg",
  "2100": "København Ø", "2200": "København N", "2300": "København S",
  "2400": "København NV", "2500": "Valby", "2600": "Glostrup",
  "2700": "Brønshøj", "2800": "Kongens Lyngby", "2900": "Hellerup",
  "3000": "Helsingør", "3400": "Hillerød", "3600": "Frederikssund",
  "4000": "Roskilde", "4200": "Slagelse", "4600": "Køge",
  "5000": "Odense C", "5200": "Odense V", "5700": "Svendborg",
  "6000": "Kolding", "6400": "Sønderborg", "6700": "Esbjerg",
  "7000": "Fredericia", "7100": "Vejle", "7400": "Herning",
  "8000": "Aarhus C", "8200": "Aarhus N", "8600": "Silkeborg",
  "8700": "Horsens", "9000": "Aalborg", "9200": "Aalborg SV",
  "9400": "Nørresundby", "9800": "Hjørring",
};

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Step 1 — Forening
  const [orgName, setOrgName] = useState("");
  const [orgAdresse, setOrgAdresse] = useState("");
  const [orgPostnummer, setOrgPostnummer] = useState("");
  const [orgBy, setOrgBy] = useState("");
  const [orgTelefon, setOrgTelefon] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [cvr, setCvr] = useState("");

  // Step 2 — Formand
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adresse, setAdresse] = useState("");
  const [postnummer, setPostnummer] = useState("");
  const [by_, setBy] = useState("");
  const [foedselsdato, setFoedselsdato] = useState("");

  // Step 3 — Samtykke
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Auto-fill by from postnummer
  useEffect(() => {
    if (orgPostnummer.length === 4 && POSTNUMMER_MAP[orgPostnummer]) {
      setOrgBy(POSTNUMMER_MAP[orgPostnummer]);
    }
  }, [orgPostnummer]);

  useEffect(() => {
    if (postnummer.length === 4 && POSTNUMMER_MAP[postnummer]) {
      setBy(POSTNUMMER_MAP[postnummer]);
    }
  }, [postnummer]);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(orgPostnummer)) {
      toast.error("Postnummer skal være 4 cifre."); return;
    }
    if (cvr && !/^\d{8}$/.test(cvr)) {
      toast.error("CVR-nummer skal være præcis 8 cifre."); return;
    }
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Adgangskoden skal være mindst 8 tegn."); return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpaAccepted) {
      toast.error("Du skal acceptere Databehandleraftalen."); return;
    }

    setLoading(true);
    try {
      // Build signup data to store in both localStorage AND user_metadata
      const signupData = {
        name: name.trim(),
        email,
        orgName: orgName.trim(),
        orgAdresse: orgAdresse.trim(),
        orgPostnummer: orgPostnummer.trim(),
        orgBy: orgBy.trim(),
        orgTelefon: orgTelefon.trim(),
        orgEmail: orgEmail.trim(),
        cvr: cvr || null,
        telefon: telefon.trim(),
        adresse: adresse.trim() || null,
        postnummer: postnummer.trim() || null,
        by: by_.trim() || null,
        foedselsdato: foedselsdato || null,
        marketingConsent,
      };

      // 1. Create auth user — store signup data in user_metadata for cross-browser recovery
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: name,
            pending_signup: signupData,
          },
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Bruger blev ikke oprettet.");

      if (authData.user.identities?.length === 0) {
        toast.error("En bruger med denne e-mail eksisterer allerede.");
        setLoading(false); return;
      }

      // Also store in localStorage as fast-path for same-browser
      localStorage.setItem("vedtaegt_pending_signup", JSON.stringify({
        ...signupData,
        userId: authData.user.id,
      }));

      if (authData.session) {
        // Auto-confirmed: process immediately
        await processSignup(authData.user.id, signupData);
        navigate("/dashboard");
      } else {
        // Need email confirmation
        setStep(4);
      }
    } catch (err: any) {
      toast.error(err.message || "Noget gik galt. Prøv igen.");
    } finally {
      setLoading(false);
    }
  };

  const processSignup = async (userId: string, p: any) => {
    // Check idempotency: if member already exists, skip
    const { data: existingMember } = await supabase
      .from("members").select("id").eq("user_id", userId).maybeSingle();
    if (existingMember) {
      localStorage.removeItem("vedtaegt_pending_signup");
      return;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: p.orgName,
        cvr: p.cvr,
        plan: "free",
        dpa_accepted_at: new Date().toISOString(),
        dpa_version: "1.0",
        adresse: p.orgAdresse,
        postnummer: p.orgPostnummer,
        by: p.orgBy,
        telefon: p.orgTelefon,
        kontakt_email: p.orgEmail,
      } as any)
      .select()
      .single();

    if (orgError) throw orgError;

    await supabase.rpc("insert_default_permissions", { p_org_id: org.id });

    const now = new Date().toISOString();
    await supabase.from("members").insert({
      org_id: org.id,
      user_id: userId,
      role: "formand",
      name: p.name,
      email: p.email,
      joined_at: now,
      marketing_consent: p.marketingConsent || false,
      marketing_consent_at: p.marketingConsent ? now : null,
      telefon: p.telefon,
      adresse: p.adresse,
      postnummer: p.postnummer,
      by: p.by,
      foedselsdato: p.foedselsdato,
      email_bekraeftet: false,
    } as any);

    // Audit logs
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("audit_events").insert([
        { org_id: org.id, user_id: user.id, action: "org.created", resource_type: "organization", resource_id: org.id, metadata: { org_name: p.orgName } },
        { org_id: org.id, user_id: user.id, action: "dpa.accepted", resource_type: "organization", resource_id: org.id, metadata: { version: "1.0" } },
      ]);
    }

    localStorage.removeItem("vedtaegt_pending_signup");
    toast.success(`Velkommen til Vedtægt, ${p.name}! Din forening er klar.`);
  };

  const handleResendEmail = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) toast.error("Kunne ikke sende bekræftelsesmail igen.");
    else toast.success("Bekræftelsesmail sendt igen. Tjek din indbakke.");
    setResending(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-display">Vedtægt</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* Step 1 — Forening */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-display mb-1">Fortæl os om din forening</h1>
              <p className="text-sm text-muted-foreground">Trin 1 af 4 — Din forening</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-xs">Foreningens navn</Label>
              <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="F.eks. Grundejerforeningen Solbakken" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgAdresse" className="text-xs">Foreningens adresse</Label>
              <Input id="orgAdresse" value={orgAdresse} onChange={(e) => setOrgAdresse(e.target.value)} placeholder="Gadenavn 123" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="orgPostnummer" className="text-xs">Postnummer</Label>
                <Input id="orgPostnummer" value={orgPostnummer} onChange={(e) => setOrgPostnummer(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="8000" required maxLength={4} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgBy" className="text-xs">By</Label>
                <Input id="orgBy" value={orgBy} onChange={(e) => setOrgBy(e.target.value)} placeholder="Aarhus C" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgTelefon" className="text-xs">Foreningens telefonnummer</Label>
              <Input id="orgTelefon" value={orgTelefon} onChange={(e) => setOrgTelefon(e.target.value)} placeholder="+45 12 34 56 78" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgEmail" className="text-xs">Foreningens e-mailadresse</Label>
              <Input id="orgEmail" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="bestyrelse@forening.dk" required />
              <p className="text-xs text-muted-foreground">Den officielle kontaktmail for foreningen — ikke din personlige e-mail</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvr" className="text-xs">CVR-nummer <span className="text-muted-foreground">(valgfrit)</span></Label>
              <Input id="cvr" value={cvr} onChange={(e) => setCvr(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="12345678" maxLength={8} inputMode="numeric" />
            </div>

            <Button type="submit" className="w-full" size="sm">Fortsæt</Button>
            <p className="text-xs text-muted-foreground text-center">
              Har du allerede en konto?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-2">Log ind</Link>
            </p>
          </form>
        )}

        {/* Step 2 — Formand */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <div>
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Tilbage
              </button>
              <h1 className="text-xl font-semibold tracking-display mb-1">Opret din profil som formand</h1>
              <p className="text-sm text-muted-foreground">Trin 2 af 4 — Dine oplysninger</p>
            </div>

            <div className="flex items-start gap-2 rounded-sm bg-primary/5 border border-primary/20 p-3">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">Du oprettes automatisk som formand for <strong>{orgName}</strong></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">Fulde navn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dit fulde navn" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">Din e-mailadresse</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dig@mail.dk" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">Adgangskode</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindst 8 tegn" required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefon" className="text-xs">Telefonnummer</Label>
              <Input id="telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="+45 12 34 56 78" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="adresse" className="text-xs">Adresse <span className="text-muted-foreground">(valgfrit)</span></Label>
                <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postnummer" className="text-xs">Postnummer <span className="text-muted-foreground">(valgfrit)</span></Label>
                <Input id="postnummer" value={postnummer} onChange={(e) => setPostnummer(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="by" className="text-xs">By <span className="text-muted-foreground">(valgfrit)</span></Label>
                <Input id="by" value={by_} onChange={(e) => setBy(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="foedselsdato" className="text-xs">Fødselsdato <span className="text-muted-foreground">(valgfrit)</span></Label>
                <Input id="foedselsdato" type="date" value={foedselsdato} onChange={(e) => setFoedselsdato(e.target.value)} />
              </div>
            </div>

            <Button type="submit" className="w-full" size="sm">Fortsæt</Button>
          </form>
        )}

        {/* Step 3 — Samtykke */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Tilbage
              </button>
              <h1 className="text-xl font-semibold tracking-display mb-1">Inden du opretter din forening</h1>
              <p className="text-sm text-muted-foreground">Trin 3 af 4 — Samtykke</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox id="dpa" checked={dpaAccepted} onCheckedChange={(c) => setDpaAccepted(c === true)} />
                <Label htmlFor="dpa" className="text-sm leading-relaxed cursor-pointer">
                  Jeg accepterer{" "}
                  <a href="/dpa" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Databehandleraftalen</a>{" "}
                  <span className="text-muted-foreground">(påkrævet)</span>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="marketing" checked={marketingConsent} onCheckedChange={(c) => setMarketingConsent(c === true)} />
                <Label htmlFor="marketing" className="text-sm leading-relaxed cursor-pointer">
                  Jeg ønsker at modtage nyheder og tips om Vedtægt <span className="text-muted-foreground">(valgfri)</span>
                </Label>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-sm bg-muted p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vi opbevarer dine data på EU-servere (Frankfurt) i overensstemmelse med GDPR.
              </p>
            </div>

            <Button type="submit" className="w-full" size="sm" disabled={loading || !dpaAccepted}>
              {loading ? "Opretter..." : "Opret forening"}
            </Button>
          </form>
        )}

        {/* Step 4 — Bekræft e-mail */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-display mb-2">Tjek din indbakke</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vi har sendt en bekræftelsesmail til <strong className="text-foreground">{email}</strong>.
                Klik på linket i mailen for at aktivere din konto.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={resending} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sender..." : "Send bekræftelsesmail igen"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Har du allerede bekræftet?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-2">Log ind her</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;

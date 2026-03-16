import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { logAuditEvent } from "@/lib/audit";

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [orgName, setOrgName] = useState("");
  const [cvr, setCvr] = useState("");

  // Step 3
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Adgangskoden skal være mindst 8 tegn.");
      return;
    }
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Foreningens navn er påkrævet.");
      return;
    }
    if (cvr && (!/^\d{8}$/.test(cvr))) {
      toast.error("CVR-nummer skal være præcis 8 cifre.");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpaAccepted) {
      toast.error("Du skal acceptere Databehandleraftalen.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Bruger blev ikke oprettet.");

      // Check if email confirmation is needed
      if (authData.user.identities?.length === 0) {
        toast.error("En bruger med denne e-mail eksisterer allerede.");
        setLoading(false);
        return;
      }

      // If session exists, user is auto-confirmed — proceed
      // If not, user needs to verify email first
      if (!authData.session) {
        toast.success("Bekræftelsesmail sendt! Tjek din indbakke for at aktivere din konto.");
        setLoading(false);
        return;
      }

      // 2. Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName.trim(),
          cvr: cvr || null,
          plan: "free",
          dpa_accepted_at: new Date().toISOString(),
          dpa_version: "1.0",
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 3. Create member with role 'owner'
      const now = new Date().toISOString();
      const { error: memberError } = await supabase
        .from("members")
        .insert({
          org_id: org.id,
          user_id: authData.user.id,
          role: "owner",
          name: name.trim(),
          email,
          joined_at: now,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? now : null,
        });

      if (memberError) throw memberError;

      // 4. Audit logs
      await logAuditEvent("org.created", "organization", org.id, {
        org_name: orgName.trim(),
      });

      await logAuditEvent("dpa.accepted", "organization", org.id, {
        version: "1.0",
      });

      toast.success("Din forening er oprettet!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Noget gik galt. Prøv igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-display">Vedtægt</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-display mb-1">Opret konto</h1>
              <p className="text-sm text-muted-foreground">Trin 1 af 3 — Personlige oplysninger</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">Fulde navn</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dit fulde navn"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">E-mailadresse</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navn@forening.dk"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">Adgangskode</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindst 8 tegn"
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full press-effect" size="sm">
              Fortsæt
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Har du allerede en konto?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-2">
                Log ind
              </Link>
            </p>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Tilbage
              </button>
              <h1 className="text-xl font-semibold tracking-display mb-1">Din forening</h1>
              <p className="text-sm text-muted-foreground">Trin 2 af 3 — Foreningens oplysninger</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgName" className="text-xs">Foreningens navn</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="F.eks. Grundejerforeningen Solbakken"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvr" className="text-xs">
                CVR-nummer <span className="text-muted-foreground">(valgfrit)</span>
              </Label>
              <Input
                id="cvr"
                value={cvr}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setCvr(val);
                }}
                placeholder="12345678"
                maxLength={8}
                inputMode="numeric"
              />
            </div>

            <Button type="submit" className="w-full press-effect" size="sm">
              Fortsæt
            </Button>
          </form>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Tilbage
              </button>
              <h1 className="text-xl font-semibold tracking-display mb-1">
                Inden du opretter din forening
              </h1>
              <p className="text-sm text-muted-foreground">Trin 3 af 3 — Samtykke</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="dpa"
                  checked={dpaAccepted}
                  onCheckedChange={(checked) => setDpaAccepted(checked === true)}
                />
                <Label htmlFor="dpa" className="text-sm leading-relaxed cursor-pointer">
                  Jeg accepterer{" "}
                  <a
                    href="/dpa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Databehandleraftalen
                  </a>{" "}
                  <span className="text-muted-foreground">(påkrævet)</span>
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="marketing"
                  checked={marketingConsent}
                  onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                />
                <Label htmlFor="marketing" className="text-sm leading-relaxed cursor-pointer">
                  Jeg ønsker at modtage nyheder og tips om Vedtægt{" "}
                  <span className="text-muted-foreground">(valgfri)</span>
                </Label>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-sm bg-muted p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vi opbevarer dine data på EU-servere (Frankfurt) i overensstemmelse med GDPR.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full press-effect"
              size="sm"
              disabled={loading || !dpaAccepted}
            >
              {loading ? "Opretter..." : "Opret forening"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Signup;

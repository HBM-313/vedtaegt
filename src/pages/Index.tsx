import {
  Shield, FileText, CheckCircle2, FolderOpen, ArrowRight,
  Users, Lock, Vote, ScrollText, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, Link } from "react-router-dom";
import PageSeo from "@/components/PageSeo";

const features = [
  {
    icon: FileText,
    title: "Strukturerede møder",
    description: "Dagsorden, referat og handlingspunkter samlet ét sted. Aldrig mere spredte Word-dokumenter og tabte e-mails.",
  },
  {
    icon: CheckCircle2,
    title: "Digital godkendelse",
    description: "Send referater til godkendelse med ét klik. Hvert bestyrelsesmedlem godkender via et personligt link — fra telefonen, hvis de vil.",
  },
  {
    icon: FolderOpen,
    title: "Sikkert dokumentarkiv",
    description: "Vedtægter, forsikringer og referater altid tilgængeligt. Automatisk opbevaringsstyring jf. dansk lovgivning.",
  },
  {
    icon: Vote,
    title: "Afstemninger",
    description: "Registrér afstemningsresultater direkte på dagsordenspunktet. GDPR-korrekt: kun aggregerede tal gemmes.",
  },
  {
    icon: ScrollText,
    title: "Vedtægtsversioner",
    description: "Hold styr på alle versioner af foreningens vedtægt. Upload, sammenlign og sæt den gældende version.",
  },
  {
    icon: Calendar,
    title: "Generalforsamling",
    description: "Send lovpligtig indkaldelse til alle medlemmer med dagsorden. Registrér fremmøde og afhold afstemninger.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Opret din forening",
    description: "Udfyld CVR-nummer og systemet henter automatisk foreningsoplysninger. Klar på under 2 minutter.",
  },
  {
    step: "2",
    title: "Invitér bestyrelsen",
    description: "Send invitationer til hvert bestyrelsesmedlem. De modtager en e-mail og opretter en konto.",
  },
  {
    step: "3",
    title: "Opret jeres første møde",
    description: "Tilføj dagsordenpunkter, indkald deltagere og skriv referat undervejs. Send til godkendelse med ét klik.",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "0",
    description: "Til nye foreninger",
    features: [
      "Op til 3 møder om året",
      "5 bestyrelsesmedlemmer",
      "100 MB lagerplads",
      "Grundlæggende referat og godkendelse",
    ],
    recommended: false,
    cta: "Kom i gang gratis",
  },
  {
    name: "Forening",
    price: "99",
    description: "Til aktive bestyrelser",
    features: [
      "Ubegrænsede møder",
      "Op til 30 medlemmer",
      "1 GB lagerplads",
      "Digital godkendelse og afstemninger",
      "Vedtægtsversioner",
      "Kalendereksport og PDF-referater",
      "GDPR-eksport",
    ],
    recommended: true,
    cta: "Start med Forening",
  },
  {
    name: "Paraply",
    price: "499",
    description: "Til paraplyorganisationer",
    features: [
      "Alt i Forening",
      "Op til 200 medlemmer",
      "5 GB lagerplads",
      "Op til 25 underforeninger",
      "Samlet overblik på tværs",
      "Prioriteret support",
    ],
    recommended: false,
    cta: "Kontakt os",
  },
];

const trustBadges = [
  { label: "GDPR-compliant", sub: "Data opbevares i EU" },
  { label: "Dansk support", sub: "Svar inden for én dag" },
  { label: "Ingen binding", sub: "Annullér når som helst" },
  { label: "Sikker login", sub: "MFA tilgængeligt" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Vedtægt — Digitalt bestyrelsesrum til danske foreninger"
        description="Professionelt bestyrelsesværktøj til danske foreninger. Møder, referater, afstemninger og dokumenter samlet ét sted. GDPR-korrekt fra dag ét."
        path="/"
      />
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold">Vedtægt</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Log ind
            </Button>
            <Button size="sm" onClick={() => navigate("/opret-konto")}>
              Opret konto
            </Button>
          </div>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="container py-20 md:py-32 text-center">
          <Badge variant="outline" className="mb-6">Bygget til danske foreninger</Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-2xl mx-auto leading-tight text-foreground">
            Professionelt bestyrelsesværktøj til danske foreninger
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
            Erstat Word-referater og e-mails med et samlet system til møder,
            referater, afstemninger og dokumenter. GDPR-korrekt fra dag ét.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/opret-konto")} className="press-effect">
              Opret gratis forening
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="press-effect"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              Sådan virker det
            </Button>
          </div>
          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-6">
            {trustBadges.map((b) => (
              <div key={b.label} className="text-center">
                <p className="text-sm font-medium text-foreground">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-border bg-muted/30">
        <div className="container py-20">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-4">
            Klar på under 5 minutter
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-md mx-auto">
            Ingen IT-afdeling nødvendig. Ingen installation. Bare log ind og gå i gang.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {howItWorks.map((step) => (
              <div key={step.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="container py-20">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-4">
            Alt hvad din bestyrelse har brug for
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-md mx-auto">
            Fra dagsorden til godkendt referat. Fra vedtægt til generalforsamling.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-5 border border-border rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security highlight */}
      <section className="border-b border-border bg-muted/30">
        <div className="container py-16">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <Lock className="h-8 w-8 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">
              Sikkerhed og compliance i centrum
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vedtægt er bygget med GDPR som udgangspunkt — ikke som eftertanke.
              Alle data opbevares på servere i EU. Persondata minimeres.
              Databehandleraftale medfølger automatisk. Audit-log på alle handlinger.
              Foreningens data tilhører foreningen — altid.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              {["Databehandleraftale", "EU-servere", "Krypteret lagring", "Audit-log"].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="priser" className="border-b border-border">
        <div className="container py-20">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-4">
            Enkel og fair prissætning
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Ingen skjulte gebyrer. Ingen binding. Betal månedligt.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-lg border p-6 flex flex-col ${
                  plan.recommended
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Mest populær</Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-semibold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground"> kr/md</span>
                  </div>
                </div>
                <ul className="space-y-2 text-sm flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.recommended ? "default" : "outline"}
                  onClick={() => navigate(plan.name === "Paraply" ? "#kontakt" : "/opret-konto")}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">
            Betalingsintegration er under opsætning. Kontakt os på{" "}
            <a href="mailto:kontakt@vedtaegt.dk" className="text-primary hover:underline">
              kontakt@vedtaegt.dk
            </a>{" "}
            for at komme i gang med en betalt plan.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border">
        <div className="container py-20 text-center">
          <Users className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Klar til at modernisere jeres bestyrelse?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Start gratis i dag. Ingen kreditkort krævet.
            Opgrader når I er klar.
          </p>
          <Button size="lg" onClick={() => navigate("/opret-konto")} className="press-effect">
            Opret gratis forening
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </section>
      </main>



      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Vedtægt</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              GDPR-compliant · Data opbevares i EU · Dansk support
              · <a href="mailto:kontakt@vedtaegt.dk" className="hover:text-foreground">kontakt@vedtaegt.dk</a>
            </p>
            <div className="flex gap-4">
              <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground">Databehandleraftale</Link>
              <Link to="/privatlivspolitik" className="text-xs text-muted-foreground hover:text-foreground">Privatlivspolitik</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

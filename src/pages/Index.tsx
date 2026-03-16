import { Shield, FileText, CheckCircle2, FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";

const features = [
  {
    icon: FileText,
    title: "Strukturerede møder",
    description: "Dagsorden, referat og handlingspunkter samlet ét sted. Slut med spredte Word-dokumenter.",
  },
  {
    icon: CheckCircle2,
    title: "Digital godkendelse",
    description: "Send referater til godkendelse med ét klik. Hvert medlem godkender via et personligt link.",
  },
  {
    icon: FolderOpen,
    title: "Sikkert dokumentarkiv",
    description: "Vedtægter, forsikringer og referater altid tilgængeligt — med automatisk opbevaringsstyring.",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "0",
    description: "Til nye foreninger",
    features: ["Op til 3 møder/år", "5 medlemmer", "100 MB storage", "Grundlæggende referat"],
    recommended: false,
  },
  {
    name: "Forening",
    price: "99",
    description: "Til aktive bestyrelser",
    features: ["Ubegrænset møder", "Ubegrænset medlemmer", "5 GB storage", "Digital godkendelse", "Dokumentarkiv", "GDPR-eksport"],
    recommended: true,
  },
  {
    name: "Paraply",
    price: "499",
    description: "Til paraplyorganisationer",
    features: ["Alt i Forening", "Op til 25 underforeninger", "Samlet overblik", "Prioriteret support", "API-adgang"],
    recommended: false,
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
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

      {/* Hero */}
      <section className="border-b border-border">
        <div className="container py-24 md:py-32 text-center">
          <Badge variant="outline" className="mb-6">Bygget til danske foreninger</Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-2xl mx-auto leading-tight text-foreground">
            Professionelt bestyrelsesværktøj til danske foreninger
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
            Erstat Word-referater og e-mails med et samlet system til møder, referater og dokumenter.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/opret-konto")} className="press-effect">
              Opret gratis forening
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="outline" size="lg" className="press-effect" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Se hvordan det virker
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="container py-20">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-12">Alt hvad din bestyrelse har brug for</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border">
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-border">
        <div className="container py-20">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-4">Enkel og fair prissætning</h2>
          <p className="text-center text-muted-foreground mb-12">Ingen skjulte gebyrer. Annullér når som helst.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={`relative ${plan.recommended ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Anbefalet</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-semibold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground"> kr/md</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mb-6">
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
                    onClick={() => navigate("/opret-konto")}
                  >
                    {plan.price === "0" ? "Kom i gang gratis" : "Start prøveperiode"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

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

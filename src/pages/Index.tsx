import { Shield, FileText, Users, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: FileText,
    title: "Referater",
    description: "Skriv, godkend og arkivér mødereferater med fuld sporbarhed.",
  },
  {
    icon: Users,
    title: "Medlemmer",
    description: "Administrer bestyrelsesmedlemmer, roller og adgangskontrol.",
  },
  {
    icon: ClipboardCheck,
    title: "Handlingspunkter",
    description: "Tildel opgaver med deadlines og følg op på beslutninger.",
  },
  {
    icon: Shield,
    title: "Revisionsspor",
    description: "Komplet audit log over alle handlinger i organisationen.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-display">Vedtægt</span>
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
        <div className="container py-24">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
            Governance-platform for foreninger
          </p>
          <h1 className="text-4xl font-semibold tracking-display max-w-xl leading-tight">
            Administrer vedtægter, referater og beslutninger — med fuld kontrol.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-lg">
            Vedtægt giver bestyrelser et sikkert digitalt arkiv til mødeledelse, 
            dokumenthåndtering og revisionsspor. Bygget til danske foreninger.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="sm" onClick={() => navigate("/auth")} className="press-effect">
              Kom i gang gratis
            </Button>
            <Button variant="outline" size="sm" className="press-effect">
              Se hvordan det virker
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="container py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`p-6 ${i < features.length - 1 ? "sm:border-r border-b sm:border-b-0 border-border" : ""}`}
              >
                <feature.icon className="h-5 w-5 text-foreground mb-3" />
                <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-b border-border">
        <div className="container py-8 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            © 2025 Vedtægt. Alle rettigheder forbeholdes.
          </p>
          <p className="text-xs text-muted-foreground">
            Bygget til danske foreninger og bestyrelser.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

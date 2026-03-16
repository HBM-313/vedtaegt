import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const PrivacyPage = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="container flex h-14 items-center">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Bestyrelsesrum</span>
        </Link>
      </div>
    </header>

    <main className="container max-w-3xl py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Privatlivspolitik</h1>
        <p className="text-sm text-muted-foreground mt-2">Senest opdateret: 1. januar 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Hvem er vi?</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>Bestyrelsesrum ApS er dataansvarlig for behandlingen af de personoplysninger, som vi modtager om dig.</p>
          <p><strong className="text-foreground">Kontakt:</strong> privatliv@bestyrelsesrum.dk</p>
          <p><strong className="text-foreground">Adresse:</strong> Nørregade 12, 1165 København K</p>
          <p><strong className="text-foreground">CVR:</strong> 12345678</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Hvilke data indsamler vi?</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-foreground">Datatype</th>
                <th className="text-left p-3 font-medium text-foreground">Formål</th>
                <th className="text-left p-3 font-medium text-foreground">Hjemmel</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="p-3">Navn og e-mail</td>
                <td className="p-3">Brugeradministration og login</td>
                <td className="p-3">Art. 6(1)(b) — kontraktopfyldelse</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">IP-adresse</td>
                <td className="p-3">Sikkerhed og audit-logning</td>
                <td className="p-3">Art. 6(1)(f) — legitim interesse</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">Betalingsoplysninger</td>
                <td className="p-3">Abonnementshåndtering via Stripe</td>
                <td className="p-3">Art. 6(1)(b) — kontraktopfyldelse</td>
              </tr>
              <tr>
                <td className="p-3">Dokumentindhold</td>
                <td className="p-3">Opbevaring og tilgængeliggørelse</td>
                <td className="p-3">Art. 6(1)(b) — kontraktopfyldelse</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Cookies</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Vi bruger ingen tracking-cookies. Vi anvender udelukkende teknisk nødvendige cookies til session-håndtering.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Dine rettigheder</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          I henhold til GDPR har du følgende rettigheder:
        </p>
        <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Indsigt</strong> — ret til at se hvilke data vi behandler om dig</li>
          <li><strong className="text-foreground">Berigtigelse</strong> — ret til at få rettet urigtige oplysninger</li>
          <li><strong className="text-foreground">Sletning</strong> — ret til at få slettet dine data (med forbehold for lovpligtige opbevaringskrav)</li>
          <li><strong className="text-foreground">Dataportabilitet</strong> — ret til at modtage dine data i et maskinlæsbart format</li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Kontakt os på <a href="mailto:privatliv@bestyrelsesrum.dk" className="text-primary hover:underline">privatliv@bestyrelsesrum.dk</a> for at udøve dine rettigheder.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Klage</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Du har ret til at klage til Datatilsynet, hvis du er utilfreds med vores behandling af dine personoplysninger.
        </p>
        <p className="text-sm text-muted-foreground">
          <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.datatilsynet.dk</a>
        </p>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="container py-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">© 2026 Bestyrelsesrum ApS</p>
        <div className="flex gap-4">
          <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground">Databehandleraftale</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default PrivacyPage;

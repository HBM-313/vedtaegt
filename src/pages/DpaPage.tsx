import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const DpaPage = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="container flex h-14 items-center">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Vedtægt</span>
        </Link>
      </div>
    </header>

    <main className="container max-w-3xl py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Databehandleraftale — version 1.0</h1>
        <p className="text-sm text-muted-foreground mt-2">Gældende fra 1. januar 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">1. Parter</h2>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p><strong className="text-foreground">Databehandler:</strong> Vedtægt ApS, Nørregade 12, 1165 København K, CVR: 12345678 ("Leverandøren")</p>
          <p><strong className="text-foreground">Dataansvarlig:</strong> Foreningens navn som opgivet ved oprettelse ("Kunden")</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">2. Formål og omfang</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Leverandøren behandler personoplysninger på vegne af Kunden med det ene formål at levere Vedtægt-platformen, herunder opbevaring af mødereferater, bestyrelsesoplysninger og dokumenter.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">3. Typer af personoplysninger</h2>
        <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
          <li>Navne og e-mailadresser på bestyrelsesmedlemmer</li>
          <li>IP-adresser ved referatgodkendelse (audit-formål)</li>
          <li>Dokumentindhold uploadet af Kunden</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">4. Opbevaringsperioder</h2>
        <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
          <li>Bestyrelsesmedlemmers data: slettes 30 dage efter opsigelse</li>
          <li>Referater og mødedata: 10 år</li>
          <li>Regnskabsdokumenter: 5 år (Bogføringsloven §3)</li>
          <li>Audit logs: 3 år</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">5. Underdatabehandlere (sub-processorer)</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-foreground">Virksomhed</th>
                <th className="text-left p-3 font-medium text-foreground">Formål</th>
                <th className="text-left p-3 font-medium text-foreground">Placering</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="p-3">Supabase Inc.</td>
                <td className="p-3">Database og filstorage</td>
                <td className="p-3">EU-region Frankfurt, Tyskland</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">Stripe Inc.</td>
                <td className="p-3">Betalingsprocessering</td>
                <td className="p-3">USA (Standard Contractual Clauses)</td>
              </tr>
              <tr>
                <td className="p-3">Resend Inc.</td>
                <td className="p-3">Transaktionsmails</td>
                <td className="p-3">EU-servere</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">6. Sikkerhedsforanstaltninger</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Leverandøren anvender kryptering i transit (TLS) og i hvile, rollebaseret adgangskontrol og løbende sikkerhedsovervågning.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">7. Databrud</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Leverandøren underretter Kunden uden unødig forsinkelse og senest inden 72 timer efter at et databrud er konstateret.
        </p>
        <p className="text-sm text-muted-foreground">
          Kontakt ved databrud: <a href="mailto:sikkerhed@bestyrelsesrum.dk" className="text-primary hover:underline">sikkerhed@bestyrelsesrum.dk</a>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">8. Den registreredes rettigheder</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Kunden er ansvarlig for at håndtere anmodninger fra registrerede. Leverandøren bistår efter behov.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">9. Afslutning</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ved opsigelse sletter Leverandøren alle Kundens data inden 30 dage, med undtagelse af data underlagt lovpligtige opbevaringskrav.
        </p>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="container py-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">© 2026 Bestyrelsesrum ApS</p>
        <div className="flex gap-4">
          <Link to="/privatlivspolitik" className="text-xs text-muted-foreground hover:text-foreground">Privatlivspolitik</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default DpaPage;

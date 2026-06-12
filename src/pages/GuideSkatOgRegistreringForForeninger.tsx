import { Link } from "react-router-dom";
import { Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSeo from "@/components/PageSeo";

const trin = [
  {
    titel: "1. Stift foreningen formelt",
    indhold:
      "Afhold stiftende generalforsamling, vedtag vedtægter og vælg en bestyrelse. Skriv et stiftelsesreferat — det er det dokument, banken og Erhvervsstyrelsen vil bede om senere.",
  },
  {
    titel: "2. Få et CVR-nummer på Virk.dk",
    indhold:
      "På virk.dk registreres foreningen som 'Frivillig forening' eller 'Almindelig forening'. Når registreringen er godkendt, får foreningen et CVR-nummer — det fungerer i praksis som foreningens TIN-nummer (Tax Identification Number) i Danmark.",
  },
  {
    titel: "3. Tilmeld foreningen til NemKonto",
    indhold:
      "En NemKonto er nødvendig, hvis foreningen skal modtage udbetalinger fra det offentlige, fx tilskud fra kommunen. NemKonto knyttes til CVR-nummeret via foreningens bank.",
  },
  {
    titel: "4. Vurder om foreningen er skatte- eller momspligtig",
    indhold:
      "De fleste mindre, almennyttige foreninger er hverken skatte- eller momspligtige af deres normale aktiviteter. Driver foreningen erhvervsmæssig virksomhed — fx caféudsalg, sponsoraftaler eller salg af reklameplads — kan der opstå moms- og skattepligt. Er du i tvivl, så kontakt Skattestyrelsen eller en revisor.",
  },
  {
    titel: "5. Indberet til Skattestyrelsen ved behov",
    indhold:
      "Foreninger der udbetaler honorar, løn eller skattepligtige godtgørelser, skal være registreret som arbejdsgiver på Virk.dk og indberette via eIndkomst. Vær særligt opmærksom på reglerne for skattefri godtgørelse til frivillige.",
  },
];

const begreber = [
  {
    titel: "Hvad er et TIN-nummer?",
    indhold:
      "TIN står for Tax Identification Number og er en international betegnelse for skatteidentifikation. For danske foreninger er CVR-nummeret det officielle TIN. Du finder det altid på Virk.dk eller cvr.dk.",
  },
  {
    titel: "Hvad er Virk.dk?",
    indhold:
      "Virk.dk er Erhvervsstyrelsens portal for virksomheder og foreninger i Danmark. Her registreres CVR-nummer, ændringer i bestyrelsen, regnskaber og forhold der vedrører arbejdsgiveransvar.",
  },
  {
    titel: "Skal alle foreninger have CVR-nummer?",
    indhold:
      "Nej. Helt små foreninger uden bankkonto eller offentlige tilskud kan undvære det. Men i praksis kræver de fleste banker, kommuner og samarbejdspartnere et CVR-nummer, så det er som regel en god idé at få et — også af hensyn til ansvarsforhold.",
  },
];

const tips = [
  "Opbevar stiftelsesreferat og vedtægter sammen med CVR-bekræftelsen — det skal banken bruge.",
  "Opdater bestyrelsens sammensætning på Virk.dk efter hver generalforsamling.",
  "Hold regnskabet i 5 år — også selvom foreningen ikke er regnskabspligtig.",
  "Brug en separat foreningskonto, aldrig en privat konto, til foreningens midler.",
  "Tjek altid med Skattestyrelsen eller en revisor, hvis I starter erhvervslignende aktiviteter.",
];

const GuideSkatOgRegistreringForForeninger = () => {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Skat og registrering for danske foreninger — TIN, CVR og Virk.dk",
      description:
        "Komplet guide til hvordan danske foreninger registreres på Virk.dk, hvad et TIN-nummer er, og hvornår foreningen er skatte- eller momspligtig.",
      author: { "@type": "Organization", name: "Vedtægt" },
      publisher: { "@type": "Organization", name: "Vedtægt" },
      mainEntityOfPage:
        "https://vedtaegt.lovable.app/guide/skat-og-registrering-for-foreninger",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Forside", item: "https://vedtaegt.lovable.app/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "Guide: Skat og registrering for foreninger",
          item: "https://vedtaegt.lovable.app/guide/skat-og-registrering-for-foreninger",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Skat og registrering for foreninger — TIN, CVR og Virk.dk | Vedtægt"
        description="Sådan registrerer du din forening på Virk.dk, får et CVR/TIN-nummer og forholder dig korrekt til skat og moms. Praktisk guide til danske bestyrelser."
        path="/guide/skat-og-registrering-for-foreninger"
        ogType="article"
        jsonLd={jsonLd}
      />

      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold">Vedtægt</span>
          </Link>
          <Link to="/opret-konto">
            <Button size="sm">Opret gratis forening</Button>
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-12 space-y-10">
        <article className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Guide
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              Skat og registrering for danske foreninger
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              Sådan får jeres forening et CVR-nummer (TIN), registreres på Virk.dk
              og overholder de skattemæssige krav — uden at drukne i jura.
            </p>
          </div>

          <section className="space-y-3">
            <p className="text-base text-foreground leading-relaxed">
              For mange nye bestyrelser er det svært at finde rundt i hvad der
              egentlig kræves, når en forening skal registreres officielt. Hvad er
              et TIN-nummer? Skal vi have et CVR? Er vi momspligtige? Denne guide
              samler det vigtigste, så I kan komme rigtigt fra start.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bemærk: guiden er en generel introduktion og erstatter ikke
              rådgivning fra en revisor eller Skattestyrelsen.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Begreber I bør kende
            </h2>
            <div className="space-y-4">
              {begreber.map((b) => (
                <div key={b.titel} className="border border-border rounded-lg p-4">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {b.titel}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {b.indhold}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Sådan registrerer I foreningen — trin for trin
            </h2>
            <ol className="space-y-4">
              {trin.map((s) => (
                <li key={s.titel} className="border border-border rounded-lg p-4">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {s.titel}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {s.indhold}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Praktiske tips
            </h2>
            <ul className="space-y-2">
              {tips.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4 border-t border-border pt-8">
            <h2 className="text-xl font-semibold text-foreground">
              Hold styr på dokumenterne med Vedtægt
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vedtægt er bygget til danske foreninger og hjælper jer med at
              opbevare CVR-bekræftelse, vedtægter, regnskaber og referater samlet
              ét sted — sikkert og GDPR-korrekt. Så er det altid let at finde
              papirerne, når banken, kommunen eller Skattestyrelsen spørger.
            </p>
            <div>
              <Link to="/opret-konto">
                <Button size="lg" className="press-effect">
                  Opret gratis forening
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-border">
        <div className="container py-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">© 2026 Vedtægt ApS</p>
          <div className="flex gap-4">
            <Link to="/dpa" className="text-xs text-muted-foreground hover:text-foreground">
              Databehandleraftale
            </Link>
            <Link to="/privatlivspolitik" className="text-xs text-muted-foreground hover:text-foreground">
              Privatlivspolitik
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GuideSkatOgRegistreringForForeninger;

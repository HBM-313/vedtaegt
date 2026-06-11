import { Link } from "react-router-dom";
import { Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSeo from "@/components/PageSeo";

const sektioner = [
  {
    titel: "1. Godkendelse af referat fra sidste møde",
    indhold:
      "Start altid med at få referatet fra sidste bestyrelsesmøde formelt godkendt. Det skaber kontinuitet, sikrer at trufne beslutninger står ved magt, og giver mulighed for at rette eventuelle misforståelser, før der bygges videre på dem.",
  },
  {
    titel: "2. Status på handlingspunkter",
    indhold:
      "Gå strukturet gennem åbne handlingspunkter fra tidligere møder. Hvem er ansvarlig, hvad er status, og er punktet stadig relevant? Dette holder bestyrelsen ansvarlig og forhindrer at opgaver falder mellem to stole.",
  },
  {
    titel: "3. Økonomi",
    indhold:
      "Kassereren orienterer om foreningens økonomi: aktuel saldo, væsentlige indtægter og udgifter siden sidst, samt status på budget og kontingent. Større dispositioner skal besluttes af bestyrelsen, ikke af kassereren alene.",
  },
  {
    titel: "4. Beslutningspunkter",
    indhold:
      "Her behandles emner, der kræver en formel bestyrelsesbeslutning. Hvert punkt bør introduceres med et kort oplæg, eventuelle alternativer, og en klar indstilling. Det er her, dagsordenen for alvor giver værdi som beslutningsværktøj.",
  },
  {
    titel: "5. Orienteringspunkter",
    indhold:
      "Punkter der ikke kræver beslutning, men hvor bestyrelsen skal være informeret: korrespondance, henvendelser fra medlemmer, status på frivillige, samarbejder med kommunen mv.",
  },
  {
    titel: "6. Eventuelt",
    indhold:
      "Korte punkter uden forberedelse. Større emner, der opstår under 'Eventuelt', bør sættes på dagsordenen til næste møde i stedet for at blive afgjort på stedet.",
  },
];

const tips = [
  "Send dagsordenen ud senest 7 dage før mødet — gerne sammen med relevante bilag.",
  "Marker tydeligt hvilke punkter der er til beslutning, og hvilke der kun er til orientering.",
  "Sæt cirkatid på hvert punkt, så mødet ikke skrider.",
  "Vedlæg de bilag, der skal læses inden mødet — fx regnskab, tilbud eller udkast til vedtægter.",
  "Aftal hvem der skriver referat, før mødet starter.",
];

const GuideDagsordenBestyrelsesmoede = () => {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Sådan laver du en god dagsorden til bestyrelsesmødet",
      description:
        "Praktisk guide til en velstruktureret dagsorden for bestyrelsesmøder i danske foreninger. Skabelon, eksempler og tips.",
      author: { "@type": "Organization", name: "Vedtægt" },
      publisher: { "@type": "Organization", name: "Vedtægt" },
      mainEntityOfPage:
        "https://vedtaegt.lovable.app/guide/dagsorden-bestyrelsesmoede",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Forside", item: "https://vedtaegt.lovable.app/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "Guide: Dagsorden til bestyrelsesmøde",
          item: "https://vedtaegt.lovable.app/guide/dagsorden-bestyrelsesmoede",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Dagsorden til bestyrelsesmøde — skabelon og guide | Vedtægt"
        description="Sådan laver du en god dagsorden til bestyrelsesmødet i din forening. Skabelon, faste punkter, eksempler og praktiske tips fra Vedtægt."
        path="/guide/dagsorden-bestyrelsesmoede"
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
              Sådan laver du en god dagsorden til bestyrelsesmødet
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              En praktisk skabelon til danske foreninger — fra idrætsklubber til ejerforeninger.
            </p>
          </div>

          <section className="space-y-3">
            <p className="text-base text-foreground leading-relaxed">
              En velforberedt dagsorden er forskellen mellem et bestyrelsesmøde,
              hvor I træffer reelle beslutninger, og et møde, hvor I bruger to timer på
              at finde ud af, hvad I overhovedet skal tale om. I denne guide gennemgår
              vi, hvordan du strukturerer en dagsorden, så jeres møde bliver effektivt,
              gennemskueligt og let at skrive referat fra bagefter.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              Skabelonen herunder passer til langt de fleste foreninger og kan
              tilpasses jeres vedtægter og forretningsorden.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Skabelon: De faste punkter
            </h2>
            <ol className="space-y-4">
              {sektioner.map((s) => (
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
              5 praktiske tips
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
              Lad Vedtægt automatisere processen
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Med Vedtægt opretter du dagsordenen direkte i systemet, sender den
              automatisk til bestyrelsen, skriver referat undervejs og sender det til
              digital godkendelse med ét klik. Handlingspunkter føres automatisk videre
              til næste møde, så ingen opgaver glemmes.
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

export default GuideDagsordenBestyrelsesmoede;

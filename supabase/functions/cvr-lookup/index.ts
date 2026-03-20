// Edge Function: cvr-lookup
// Bruger Erhvervsstyrelsens officielle åbne CVR ElasticSearch API
// Dokumentation: https://data.virk.dk/datakatalog/erhvervsstyrelsen/system-til-system-adgang-til-cvr-data
// Kræver ingen API-nøgle. Virker fra Supabase/Deno Deploy (modsat cvrapi.dk der blokerer cloud IPs)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIRK_CVR_URL =
  "https://distribution.virk.dk/cvr-permanent/virksomhed/_search";

// Udtræk første match fra et array af kontaktoplysninger
function findKontakt(liste: Array<{ kontaktoplysning: string; hemmelig?: boolean }> | undefined, type: string): string | null {
  if (!Array.isArray(liste)) return null;
  const match = liste.find(
    (k) => !k.hemmelig && k.kontaktoplysning && k.kontaktoplysning.startsWith(type)
  );
  if (!match) return null;
  // Fjern prefix som "Telefon: " eller "Email: "
  const parts = match.kontaktoplysning.split(": ");
  return parts.length > 1 ? parts.slice(1).join(": ").trim() : match.kontaktoplysning.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvr } = await req.json();

    if (!cvr || !/^\d{8}$/.test(String(cvr))) {
      return new Response(
        JSON.stringify({ error: "Ugyldigt CVR-nummer. Skal være 8 cifre." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(VIRK_CVR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: {
          term: { "Vrvirksomhed.cvrNummer": parseInt(cvr, 10) },
        },
        _source: [
          "Vrvirksomhed.cvrNummer",
          "Vrvirksomhed.virksomhedMetadata.nyesteNavn",
          "Vrvirksomhed.virksomhedMetadata.nyesteBeliggenhedsadresse",
          "Vrvirksomhed.virksomhedMetadata.nyesteKontaktoplysninger",
        ],
        size: 1,
      }),
    });

    if (!res.ok) {
      console.error(`CVR API HTTP ${res.status}: ${await res.text()}`);
      return new Response(
        JSON.stringify({ error: "CVR-opslag fejlede midlertidigt. Prøv igen." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await res.json();
    const hit = json?.hits?.hits?.[0]?._source?.Vrvirksomhed;

    if (!hit) {
      return new Response(
        JSON.stringify({ error: "CVR-nummeret blev ikke fundet." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meta = hit.virksomhedMetadata ?? {};
    const navn = meta.nyesteNavn?.navn ?? null;
    const adresse = meta.nyesteBeliggenhedsadresse ?? null;
    const kontakt: Array<{ kontaktoplysning: string; hemmelig?: boolean }> =
      meta.nyesteKontaktoplysninger ?? [];

    // Byg gadenavn + husnummer
    let vejnavn: string | null = null;
    if (adresse?.vejnavn) {
      vejnavn = adresse.vejnavn;
      if (adresse.husnummerFra) vejnavn += ` ${adresse.husnummerFra}`;
      if (adresse.bogstavFra) vejnavn += adresse.bogstavFra;
      if (adresse.etage) vejnavn += `, ${adresse.etage}`;
      if (adresse.sidedoer) vejnavn += `. ${adresse.sidedoer}`;
    }

    const telefon = findKontakt(kontakt, "Telefon");
    const email = findKontakt(kontakt, "Email");

    return new Response(
      JSON.stringify({
        navn: navn ?? "",
        adresse: vejnavn,
        postnummer: adresse?.postnummer ? String(adresse.postnummer) : null,
        by: adresse?.postdistrikt ?? null,
        telefon,
        email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cvr-lookup uventet fejl:", msg);
    return new Response(
      JSON.stringify({ error: "Intern fejl ved CVR-opslag." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

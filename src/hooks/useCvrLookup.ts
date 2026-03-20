import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CvrData {
  navn: string;
  adresse: string | null;
  postnummer: string | null;
  by: string | null;
  telefon: string | null;
  email: string | null;
}

// ─────────────────────────────────────────────
// Primær: Supabase Edge Function
// ─────────────────────────────────────────────
async function lookupViaEdgeFunction(cvr: string): Promise<CvrData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("cvr-lookup", {
      body: { cvr },
    });
    if (error || !data || data.error) return null;
    return data as CvrData;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Fallback: Erhvervsstyrelsens åbne CVR API
// Tilgængeligt direkte fra browser (CORS tilladt)
// Kræver ingen nøgle
// ─────────────────────────────────────────────
async function lookupViaVirk(cvr: string): Promise<CvrData | null> {
  try {
    const res = await fetch(
      "https://distribution.virk.dk/cvr-permanent/virksomhed/_search",
      {
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
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    const hit = json?.hits?.hits?.[0]?._source?.Vrvirksomhed;
    if (!hit) return null;

    const meta = hit.virksomhedMetadata ?? {};
    const navn: string | null = meta.nyesteNavn?.navn ?? null;
    const adr = meta.nyesteBeliggenhedsadresse ?? null;
    const kontakt: Array<{ kontaktoplysning: string; hemmelig?: boolean }> =
      meta.nyesteKontaktoplysninger ?? [];

    // Byg gadenavn + husnummer + etage
    let vejnavn: string | null = null;
    if (adr?.vejnavn) {
      vejnavn = adr.vejnavn;
      if (adr.husnummerFra) vejnavn += ` ${adr.husnummerFra}`;
      if (adr.bogstavFra) vejnavn += adr.bogstavFra;
      if (adr.etage) vejnavn += `, ${adr.etage}`;
      if (adr.sidedoer) vejnavn += `. ${adr.sidedoer}`;
    }

    // Udtræk telefon og email fra kontaktliste
    const findKontakt = (prefix: string): string | null => {
      const match = kontakt.find(
        (k) => !k.hemmelig && k.kontaktoplysning?.startsWith(prefix)
      );
      if (!match) return null;
      const parts = match.kontaktoplysning.split(": ");
      return parts.length > 1 ? parts.slice(1).join(": ").trim() : match.kontaktoplysning.trim();
    };

    return {
      navn: navn ?? "",
      adresse: vejnavn,
      postnummer: adr?.postnummer ? String(adr.postnummer) : null,
      by: adr?.postdistrikt ?? null,
      telefon: findKontakt("Telefon"),
      email: findKontakt("Email"),
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Hook — edge function primær, Virk.dk fallback
// ─────────────────────────────────────────────
export function useCvrLookup() {
  const lookup = useCallback(async (cvr: string): Promise<CvrData | null> => {
    if (!/^\d{8}$/.test(cvr)) return null;

    // Forsøg edge function først
    const edgeResult = await lookupViaEdgeFunction(cvr);
    if (edgeResult) return edgeResult;

    // Edge function fejlede — brug direkte API som fallback
    console.warn("useCvrLookup: edge function utilgængelig, falder tilbage til Virk.dk API");
    return lookupViaVirk(cvr);
  }, []);

  return { lookup };
}

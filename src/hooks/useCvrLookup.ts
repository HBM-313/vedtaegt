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
// Primær: Supabase Edge Function (server-side)
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
// Fallback: cvrapi.dk direkte fra browser
// cvrapi.dk blokerer cloud/server IP-ranges men tillader browser-kald.
// Browseren sætter automatisk User-Agent — ingen ekstra header nødvendig.
// ─────────────────────────────────────────────
async function lookupViaCvrApi(cvr: string): Promise<CvrData | null> {
  try {
    const res = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.error) return null;

    return {
      navn: data.name ?? "",
      adresse: data.address ?? null,
      postnummer: data.zipcode ? String(data.zipcode) : null,
      by: data.city ?? null,
      telefon: data.phone ?? null,
      email: data.email ?? null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Hook — edge function primær, cvrapi.dk fallback
// ─────────────────────────────────────────────
export function useCvrLookup() {
  const lookup = useCallback(async (cvr: string): Promise<CvrData | null> => {
    if (!/^\d{8}$/.test(cvr)) return null;

    // Forsøg edge function først
    const edgeResult = await lookupViaEdgeFunction(cvr);
    if (edgeResult) return edgeResult;

    // Edge function utilgængelig — brug cvrapi.dk direkte fra browser
    console.warn("useCvrLookup: edge function utilgængelig, falder tilbage til cvrapi.dk");
    return lookupViaCvrApi(cvr);
  }, []);

  return { lookup };
}

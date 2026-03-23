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
// Primær: cvrapi.dk direkte fra browser
// (stabilt i preview og kræver ingen backend-hop)
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
// Fallback: Supabase Edge Function (server-side)
// ─────────────────────────────────────────────
async function lookupViaEdgeFunction(cvr: string): Promise<CvrData | null> {
  try {
    const result = await Promise.race([
      supabase.functions.invoke("cvr-lookup", { body: { cvr } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      ),
    ]);

    const { data, error } = result as { data: unknown; error: unknown };
    if (error || !data || (data as { error?: unknown }).error) return null;
    return data as CvrData;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Hook — cvrapi.dk primær, edge function fallback
// ─────────────────────────────────────────────
export function useCvrLookup() {
  const lookup = useCallback(async (cvr: string): Promise<CvrData | null> => {
    if (!/^\d{8}$/.test(cvr)) return null;

    const directResult = await lookupViaCvrApi(cvr);
    if (directResult) return directResult;

    return lookupViaEdgeFunction(cvr);
  }, []);

  return { lookup };
}

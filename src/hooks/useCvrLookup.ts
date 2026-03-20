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

// CVR-opslag via Supabase Edge Function (server-side) for at undgå
// CORS og browser User-Agent begrænsninger ved direkte kald til cvrapi.dk
export function useCvrLookup() {
  const lookup = useCallback(async (cvr: string): Promise<CvrData | null> => {
    if (!/^\d{8}$/.test(cvr)) return null;

    try {
      const { data, error } = await supabase.functions.invoke("cvr-lookup", {
        body: { cvr },
      });

      if (error || !data || data.error) return null;

      return data as CvrData;
    } catch {
      return null;
    }
  }, []);

  return { lookup };
}

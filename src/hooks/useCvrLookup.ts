import { useCallback } from "react";

export interface CvrData {
  navn: string;
  adresse: string | null;
  postnummer: string | null;
  by: string | null;
  telefon: string | null;
  email: string | null;
}

// cvrapi.dk — gratis CVR-opslag, ingen nøgle krævet til basisdata
const CVR_URL = "https://cvrapi.dk/api";

export function useCvrLookup() {
  const lookup = useCallback(async (cvr: string): Promise<CvrData | null> => {
    if (!/^\d{8}$/.test(cvr)) return null;

    try {
      const res = await fetch(
        `${CVR_URL}?search=${cvr}&country=dk`,
        {
          headers: {
            // cvrapi.dk kræver en User-Agent
            "User-Agent": "Vedtaegt/1.0 (vedtaegt.lovable.app)",
          },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();

      if (data.error) return null;

      return {
        navn: data.name || "",
        adresse: data.address || null,
        postnummer: data.zipcode ? String(data.zipcode) : null,
        by: data.city || null,
        telefon: data.phone || null,
        email: data.email || null,
      };
    } catch {
      return null;
    }
  }, []);

  return { lookup };
}

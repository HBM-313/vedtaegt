import { useCallback, useRef } from "react";

interface DawaPostnummer {
  nr: string;
  navn: string;
}

// Danmarks Adressers Web API — gratis, officielt, 600+ postnumre
const DAWA_URL = "https://api.dataforsyningen.dk/postnumre";

export function useDawaPostnummer() {
  const cacheRef = useRef<Record<string, string>>({});

  const lookup = useCallback(async (postnummer: string): Promise<string | null> => {
    if (!/^\d{4}$/.test(postnummer)) return null;

    // Return fra cache hvis vi allerede har slået det op
    if (cacheRef.current[postnummer]) {
      return cacheRef.current[postnummer];
    }

    try {
      const res = await fetch(`${DAWA_URL}/${postnummer}`);
      if (!res.ok) return null;
      const data: DawaPostnummer = await res.json();
      cacheRef.current[postnummer] = data.navn;
      return data.navn;
    } catch {
      return null;
    }
  }, []);

  return { lookup };
}

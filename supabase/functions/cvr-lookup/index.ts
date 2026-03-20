// Edge Function: cvr-lookup
// Server-side CVR-opslag via cvrapi.dk — undgår CORS og User-Agent browser-begrænsning

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvr } = await req.json();

    if (!cvr || !/^\d{8}$/.test(cvr)) {
      return new Response(
        JSON.stringify({ error: "Ugyldigt CVR-nummer. Skal være 8 cifre." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`, {
      headers: {
        "User-Agent": "Vedtaegt/1.0 (vedtaegt.lovable.app)",
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "CVR-nummeret blev ikke fundet." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: "CVR-nummeret blev ikke fundet." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        navn: data.name || "",
        adresse: data.address || null,
        postnummer: data.zipcode ? String(data.zipcode) : null,
        by: data.city || null,
        telefon: data.phone || null,
        email: data.email || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Intern fejl ved CVR-opslag." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

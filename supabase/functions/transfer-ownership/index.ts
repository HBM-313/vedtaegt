import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use getUser instead of getClaims
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { to_email, org_id } = await req.json();
    if (!to_email || !org_id) {
      return new Response(JSON.stringify({ error: "to_email, org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner
    const { data: callerMember } = await supabase
      .from("members")
      .select("id, role")
      .eq("org_id", org_id)
      .eq("user_id", userId)
      .single();

    if (!callerMember || callerMember.role !== "formand") {
      return new Response(JSON.stringify({ error: "Kun formanden kan overdrage formandsposten." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target is member of org
    const { data: targetMember } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", org_id)
      .eq("email", to_email)
      .not("user_id", "is", null)
      .single();

    if (!targetMember) {
      return new Response(JSON.stringify({ error: "Modtageren er ikke et aktivt medlem." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const transferToken = crypto.randomUUID();

    const { data: transfer, error: insertError } = await supabase
      .from("ownership_transfers")
      .insert({
        org_id,
        from_member_id: callerMember.id,
        to_email,
        token: transferToken,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org name and caller name for email
    const { data: orgData } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const { data: callerData } = await supabase.from("members").select("name").eq("id", callerMember.id).single();

    // Log audit
    await supabase.from("audit_events").insert({
      org_id,
      user_id: userId,
      action: "org.ownership_transfer_initiated",
      resource_type: "ownership_transfer",
      resource_id: transfer.id,
      metadata: { to_email },
    });

    // Send ownership transfer email
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
    await fetch(sendEmailUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to_email,
        templateName: "ownership_transfer",
        templateData: {
          orgName: orgData?.name || "din forening",
          fromName: callerData?.name || "Den nuværende ejer",
          token: transferToken,
        },
      }),
    });

    return new Response(
      JSON.stringify({ success: true, transfer_id: transfer.id, token: transferToken }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

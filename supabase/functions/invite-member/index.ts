import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { email, role, org_id } = await req.json();
    if (!email || !role || !org_id) {
      return new Response(JSON.stringify({ error: "email, role, org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is member of org
    const { data: callerMember } = await supabase
      .from("members")
      .select("id, role")
      .eq("org_id", org_id)
      .eq("user_id", userId)
      .single();

    if (!callerMember || !["owner", "admin"].includes(callerMember.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists in org
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", org_id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Medlemmet er allerede inviteret." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert pending member
    const { data: newMember, error: insertError } = await supabase
      .from("members")
      .insert({
        org_id,
        email,
        name: email.split("@")[0],
        role: role === "admin" ? "admin" : "member",
        invited_at: new Date().toISOString(),
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
      action: "member.invited",
      resource_type: "member",
      resource_id: newMember.id,
      metadata: { email, role },
    });

    // Send invitation email
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
    await fetch(sendEmailUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        templateName: "invitation",
        templateData: {
          orgName: orgData?.name || "din forening",
          orgId: org_id,
          senderName: callerData?.name || "En administrator",
        },
      }),
    });

    return new Response(
      JSON.stringify({ success: true, member_id: newMember.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

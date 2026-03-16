import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Temporary sender until bestyrelsesrum.dk domain is verified in Resend
const FROM_EMAIL = "Bestyrelsesrum <onboarding@resend.dev>";
// When domain is ready, switch to:
// const FROM_EMAIL = "Bestyrelsesrum <service@bestyrelsesrum.dk>";

const BASE_URL = "https://id-preview--9fc10c4b-e8ee-4087-b0a5-eeb410a0f69e.lovable.app";

interface TemplateData {
  [key: string]: unknown;
}

function renderTemplate(templateName: string, data: TemplateData): { subject: string; html: string } {
  switch (templateName) {
    case "invitation":
      return {
        subject: `Du er inviteret til ${data.orgName}s bestyrelse`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Du er inviteret til ${data.orgName}</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    ${data.senderName} har inviteret dig til at deltage i ${data.orgName}s bestyrelse på Bestyrelsesrum.
  </p>
  <a href="${BASE_URL}/opret-konto?org=${data.orgId}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Acceptér invitation
  </a>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
    Kender du ikke til denne invitation? Se bort fra denne e-mail.
  </p>
</div>
</body></html>`,
      };

    case "approval_request":
      return {
        subject: `Referat fra ${data.meetingTitle} afventer din godkendelse`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Referat afventer godkendelse</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    Referatet fra <strong>${data.meetingTitle}</strong> den ${data.meetingDate} er klar til din godkendelse.
  </p>
  <a href="${BASE_URL}/godkend/${data.token}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Godkend referat
  </a>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px;line-height:1.5;">
    Linket er personligt og må ikke deles. Det udløber om 30 dage.
  </p>
  <p style="font-size:11px;color:#94a3b8;margin-top:16px;line-height:1.5;border-top:1px solid #e5e7eb;padding-top:16px;">
    Din godkendelse registrerer at du har gennemlæst og accepteret referatets indhold. Det er ikke en juridisk bindende underskrift.
  </p>
</div>
</body></html>`,
      };

    case "all_approved":
      return {
        subject: `Alle har godkendt referatet fra ${data.meetingTitle}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Referat fuldt godkendt ✓</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 16px;">
    Alle ${data.approvalCount} bestyrelsesmedlemmer har nu godkendt referatet fra <strong>${data.meetingTitle}</strong>.
  </p>
  ${data.approvals ? `
  <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
    <tr style="border-bottom:1px solid #e5e7eb;">
      <th style="text-align:left;padding:8px 0;font-size:12px;color:#64748b;">Navn</th>
      <th style="text-align:left;padding:8px 0;font-size:12px;color:#64748b;">Tidspunkt</th>
    </tr>
    ${(data.approvals as Array<{name: string; date: string}>).map((a: {name: string; date: string}) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 0;font-size:13px;color:#0f172a;">${a.name}</td>
      <td style="padding:8px 0;font-size:13px;color:#64748b;">${a.date}</td>
    </tr>`).join("")}
  </table>` : ""}
  <a href="${BASE_URL}/moeder/${data.meetingId}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Download PDF
  </a>
</div>
</body></html>`,
      };

    case "ownership_transfer":
      return {
        subject: `Du er inviteret til at overtage ejerskabet af ${data.orgName}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Ejerskabsoverdragelse</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    ${data.fromName} ønsker at overdrage ejerskabet af <strong>${data.orgName}</strong> til dig.
  </p>
  <a href="${BASE_URL}/overdrag-ejerskab/${data.token}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Acceptér ejerskab
  </a>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
    Dette link udløber om 48 timer.
  </p>
</div>
</body></html>`,
      };

    case "deletion_confirmation":
      return {
        subject: "Din forening slettes om 30 dage",
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Sletningsbekræftelse</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 12px;">
    Vi har modtaget din anmodning om sletning af <strong>${data.orgName}</strong>.
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 12px;">
    Alle data slettes permanent den <strong>${data.deletionDate}</strong>.
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 12px;">
    Regnskabsdokumenter opbevares dog i 5 år jf. Bogføringsloven.
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 0;">
    Fortrød du? Kontakt os på <a href="mailto:support@bestyrelsesrum.dk" style="color:#1e40af;">support@bestyrelsesrum.dk</a> inden ${data.deletionDate}.
  </p>
</div>
</body></html>`,
      };

    default:
      throw new Error(`Unknown template: ${templateName}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Allow both authenticated and service-role calls
    const { to, templateName, templateData } = await req.json();

    if (!to || !templateName) {
      return new Response(JSON.stringify({ error: "to and templateName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = renderTemplate(templateName, templateData || {});

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({ error: resendData.message || "Email send failed" }), {
        status: resendRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

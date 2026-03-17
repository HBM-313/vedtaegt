import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getFromEmail(): string {
  return Deno.env.get("RESEND_FROM_EMAIL") || "Vedtægt <onboarding@resend.dev>";
}

function getBaseUrl(): string {
  return "https://vedtaegt.lovable.app";
}

interface TemplateData {
  [key: string]: unknown;
}

function getRoleLabelDa(role: string): string {
  const map: Record<string, string> = {
    formand: "Formand",
    naestformand: "Næstformand",
    kasserer: "Kasserer",
    bestyrelsesmedlem: "Bestyrelsesmedlem",
    suppleant: "Suppleant",
  };
  return map[role] || role;
}

function renderTemplate(templateName: string, data: TemplateData): { subject: string; html: string } {
  const BASE_URL = getBaseUrl();

  switch (templateName) {
    case "invitation": {
      const roleName = getRoleLabelDa(data.role as string);
      const expiresDate = data.expiresAt ? new Date(data.expiresAt as string).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }) : "14 dage";
      return {
        subject: `Du er inviteret som ${roleName} i ${data.orgName}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Du er inviteret til ${data.orgName}</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    ${data.senderName} har inviteret dig til at deltage i <strong>${data.orgName}</strong> som <strong>${roleName}</strong>.
  </p>
  <a href="${BASE_URL}/invitation/${data.invitationToken}" style="display:inline-block;background:#1e40af;color:#fff;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Acceptér invitation og opret konto
  </a>
  <p style="font-size:13px;color:#64748b;margin-top:24px;line-height:1.5;">
    Invitationen udløber om 14 dage (${expiresDate}).
  </p>
  <p style="font-size:12px;color:#94a3b8;margin-top:16px;">
    Kender du ikke til denne invitation? Se bort fra denne e-mail.
  </p>
</div>
</body></html>`,
      };
    }

    case "approval_request": {
      const runde = (data.runde as number) || 1;
      return {
        subject: `Referat fra ${data.meetingTitle} afventer din godkendelse`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Referat afventer godkendelse</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 8px;">
    Hej ${data.recipientName || ""},
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 8px;">
    ${data.senderName || "Formanden"} har sendt referatet fra <strong>${data.meetingTitle}</strong> til din godkendelse.
  </p>
  <table style="width:100%;margin:16px 0 24px;font-size:13px;color:#64748b;">
    <tr><td style="padding:4px 0;">Mødedato:</td><td style="padding:4px 0;"><strong>${data.meetingDate}</strong></td></tr>
    <tr><td style="padding:4px 0;">Forening:</td><td style="padding:4px 0;"><strong>${data.orgName || ""}</strong></td></tr>
    ${runde > 1 ? `<tr><td style="padding:4px 0;">Godkendelsesrunde:</td><td style="padding:4px 0;"><strong>${runde}</strong></td></tr>` : ""}
  </table>
  <a href="${BASE_URL}/godkend/${data.token}" style="display:inline-block;background:#1e40af;color:#fff;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Læs og godkend referat
  </a>
  <p style="font-size:13px;color:#64748b;margin-top:24px;line-height:1.5;">
    Du kan både godkende og afvise referatet via linket. Linket udløber om 30 dage.
  </p>
  ${data.senderEmail ? `<p style="font-size:12px;color:#94a3b8;margin-top:12px;">Har du spørgsmål? Kontakt ${data.senderName} på ${data.senderEmail}.</p>` : ""}
</div>
</body></html>`,
      };
    }

    case "approval_reminder":
      return {
        subject: `Påmindelse: Referat fra ${data.meetingTitle} afventer stadig din godkendelse`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Påmindelse om godkendelse</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 8px;">
    Hej ${data.recipientName || ""},
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    Vi vil blot minde dig om at referatet fra <strong>${data.meetingTitle}</strong> stadig afventer din godkendelse.
    ${data.approvedCount !== undefined ? `<br/>${data.approvedCount} af ${data.totalCount} bestyrelsesmedlemmer har godkendt.` : ""}
  </p>
  <a href="${BASE_URL}/godkend/${data.token}" style="display:inline-block;background:#1e40af;color:#fff;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Godkend referat nu
  </a>
</div>
</body></html>`,
      };

    case "referat_rejected":
      return {
        subject: `⚠ Referatet fra ${data.meetingTitle} blev afvist`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">⚠ Referat afvist</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 8px;">
    Hej ${data.recipientName || ""},
  </p>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 16px;">
    ${data.rejectorName} (${data.rejectorRole}) har afvist referatet fra <strong>${data.meetingTitle}</strong>.
  </p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:0 0 24px;">
    <p style="font-size:13px;color:#991b1b;margin:0;font-style:italic;">"${data.comment}"</p>
  </div>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    Log ind og ret referatet, og send det til godkendelse igen.
  </p>
  <a href="${BASE_URL}/moeder/${data.meetingId}" style="display:inline-block;background:#1e40af;color:#fff;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Gå til mødet
  </a>
</div>
</body></html>`,
      };

    case "all_approved":
      return {
        subject: `✓ Referatet fra ${data.meetingTitle} er endeligt godkendt`,
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
      <th style="text-align:left;padding:8px 0;font-size:12px;color:#64748b;">Rolle</th>
      <th style="text-align:left;padding:8px 0;font-size:12px;color:#64748b;">Tidspunkt</th>
    </tr>
    ${(data.approvals as Array<{name: string; role: string; date: string}>).map((a) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 0;font-size:13px;color:#0f172a;">${a.name}</td>
      <td style="padding:8px 0;font-size:13px;color:#64748b;">${a.role}</td>
      <td style="padding:8px 0;font-size:13px;color:#64748b;">${a.date}</td>
    </tr>`).join("")}
  </table>` : ""}
  <a href="${BASE_URL}/moeder/${data.meetingId}" style="display:inline-block;background:#1e40af;color:#fff;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Download PDF
  </a>
</div>
</body></html>`,
      };

    case "ownership_transfer":
      return {
        subject: `Du er inviteret til at overtage formandsposten i ${data.orgName}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
  <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px;">Overdragelse af formandsposten</h1>
  <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
    ${data.fromName} ønsker at overdrage formandsposten i <strong>${data.orgName}</strong> til dig.
  </p>
  <a href="${BASE_URL}/overdrag-ejerskab/${data.token}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
    Acceptér formandsposten
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
  <p style="font-size:14px;color:#64748b;line-height:1.6;">
    Regnskabsdokumenter opbevares dog i 5 år jf. Bogføringsloven.
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

    const { to, templateName, templateData } = await req.json();

    if (!to || !templateName) {
      return new Response(JSON.stringify({ error: "to and templateName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = renderTemplate(templateName, templateData || {});
    const fromEmail = getFromEmail();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", JSON.stringify(resendData));

      // Detect test-domain restriction
      const isTestDomainError =
        resendData?.name === "validation_error" ||
        (resendData?.message && (
          resendData.message.includes("can only send testing emails to your own email") ||
          resendData.message.includes("verify") ||
          resendData.message.includes("domain")
        ));

      const errorMessage = isTestDomainError
        ? `E-mail kunne ikke sendes: Resend testdomæne (onboarding@resend.dev) kan kun sende til ejeren af API-nøglen. Tilføj et verificeret domæne for at sende til alle.`
        : resendData.message || "Email send failed";

      return new Response(JSON.stringify({
        error: errorMessage,
        resend_error: resendData?.name || null,
        is_test_domain_restriction: isTestDomainError,
      }), {
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
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

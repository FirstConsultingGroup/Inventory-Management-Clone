import { serve } from "https://deno.land/std/http/server.ts";
import nodemailer from "npm:nodemailer";
import { google } from "npm:googleapis";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// JSON logger
const log = (level: string, msg: string, extra?: unknown) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, extra }));

// Common CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Response helper
const makeRes = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return makeRes({ ok: true });

  if (req.method !== "POST") {
    return makeRes({ success: false, message: "Method not allowed" }, 405);
  }

  // Parse body
  let payload: {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    company_id?: string;
    company_name?: string;
  };
  try {
    payload = await req.json();
  } catch (e) {
    log("error", "Invalid JSON body", String(e));
    return makeRes({ success: false, message: "Invalid JSON body" }, 400);
  }

  const { from, to, subject, text, html, company_id, company_name } = payload;

  if (!from || !company_id) {
    return makeRes(
      { success: false, message: "Missing required fields: from, company_id" },
      400
    );
  }

  // Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get refresh token from DB
  const { data, error: dbError } = await supabase
    .from("system_settings")
    .select("id, system_config_value")
    .eq("company_email", from)
    .eq("company_id", company_id)
    .eq("system_config_key", "EMAIL_REFRESH_TOKEN")
    .single();

  if (dbError || !data) {
    log("warn", "Refresh token not found", { dbError });
    return makeRes(
      { success: false, message: "Email not authenticated or token not found" },
      403
    );
  }

  const refreshToken = data.system_config_value;
  const dbRecordId = data.id;

  // Remove invalid refresh token
  const removeRefreshToken = async () => {
    try {
      await supabase.from("system_settings").delete().eq("id", dbRecordId);
      log("info", "Removed invalid refresh token", { id: dbRecordId, email: from });
    } catch (err) {
      log("error", "Failed to remove refresh token", String(err));
    }
  };

  // OAuth2 client
  const oAuth2Client = new google.auth.OAuth2(
    Deno.env.get("CLIENT_ID"),
    Deno.env.get("CLIENT_SECRET"),
    Deno.env.get("REDIRECT_URL")
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  // Safe access token fetcher
  const getAccessTokenSafe = async () => {
    try {
      const tokenRes = await oAuth2Client.getAccessToken();
      if (!tokenRes?.token) throw new Error("No access token returned");
      return tokenRes.token;
    } catch (err: any) {
      if (String(err?.message ?? "").includes("invalid_grant")) {
        await removeRefreshToken();
        throw new Error("invalid_grant");
      }
      throw err;
    }
  };

  // Function to send email
  const sendEmail = async (accessToken: string) => {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: from,
        clientId: Deno.env.get("CLIENT_ID"),
        clientSecret: Deno.env.get("CLIENT_SECRET"),
        refreshToken,
        accessToken,
      },
    });

    const mailOptions = {
      from: `${company_name ?? ""} <${from}>`,
      to,
      subject,
      text,
      html,
    };

    return transporter.sendMail(mailOptions);
  };

  try {
    let accessToken = await getAccessTokenSafe();

    // First attempt
    try {
      const info = await sendEmail(accessToken);
      log("info", "Email sent successfully", { messageId: info.messageId });
      return makeRes({ success: true, message: "Email sent", id: info.messageId });
    } catch (err: any) {
      const msg = String(err?.message ?? "").toLowerCase();
      const isAuthError =
        msg.includes("invalid login") ||
        msg.includes("535-5.7.8") ||
        msg.includes("authentication") ||
        msg.includes("invalid_grant");

      if (!isAuthError) throw err;

      // Retry once with refreshed token
      log("info", "Retrying email send with refreshed token");
      accessToken = await getAccessTokenSafe();
      const info2 = await sendEmail(accessToken);
      log("info", "Email sent successfully on retry", { messageId: info2.messageId });

      return makeRes({ success: true, message: "Email sent after retry", id: info2.messageId });
    }
  } catch (topErr: any) {
    if (String(topErr?.message ?? "") === "invalid_grant") {
      return makeRes(
        {
          success: false,
          error: "invalid_grant",
          message: "Refresh token invalid or revoked. Please reconnect your Gmail account.",
        },
        401
      );
    }

    log("error", "Send-email error", topErr);
    return makeRes(
      { success: false, message: "Email failed", error: String(topErr?.message ?? topErr) },
      500
    );
  }
});

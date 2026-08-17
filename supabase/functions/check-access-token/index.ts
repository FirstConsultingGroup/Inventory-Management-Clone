import { serve } from "https://deno.land/std/http/server.ts";
import { google } from "npm:googleapis";

// Utility to respond with JSON
const makeRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return makeRes({ success: false, message: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return makeRes({ success: false, message: "Invalid JSON body" }, 400);
  }

  const { refresh_token, email } = body ?? {};
  if (!refresh_token || !email) {
    return makeRes(
      { success: false, message: "Missing required fields: refresh_token, email" },
      400,
    );
  }

  try {
    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      Deno.env.get("CLIENT_ID"),
      Deno.env.get("CLIENT_SECRET"),
      Deno.env.get("REDIRECT_URL"),
    );

    oAuth2Client.setCredentials({ refresh_token });

    // Try to get access token
    const tokenRes = await oAuth2Client.getAccessToken();
    if (!tokenRes?.token) {
      return makeRes({ success: false, message: "No access token returned" }, 400);
    }

    // Fetch logged-in user details using the access token
    const oauth2 = google.oauth2({ auth: oAuth2Client, version: "v2" });
    const userInfo = await oauth2.userinfo.get();

    const actualEmail = userInfo?.data?.email || null;

    return makeRes({
      success: true,
      email_passed: email,    // Email that frontend passed
      email_verified: actualEmail, // Email verified from refresh token
      matches: actualEmail === email,
      access_token: tokenRes.token,
      token_expiry: oAuth2Client.credentials.expiry_date
        ? new Date(oAuth2Client.credentials.expiry_date).toISOString()
        : null,
    });
  } catch (err: any) {
    return makeRes({
      success: false,
      message: "Failed to get access token",
      error: String(err?.message ?? err),
    }, 500);
  }
});

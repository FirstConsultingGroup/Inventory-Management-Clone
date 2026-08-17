// supabase/functions/auth-email/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { google } from "npm:googleapis@130.0.0";
// Supabase client
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
// Google OAuth2 setup
const clientId = Deno.env.get("CLIENT_ID");
const clientSecret = Deno.env.get("CLIENT_SECRET");
const redirectUrl = Deno.env.get("REDIRECT_URL");
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
// Common CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const { searchParams } = new URL(req.url);
    const company_id = searchParams.get("company_id");
    const user_id = searchParams.get("user_id");
    const redirect_url = searchParams.get("redirect_url");
    // Generate OAuth2 URL
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile" // optional profile info
      ],
      state: JSON.stringify({
        company_id,
        user_id,
        redirect_url
      })
    });
    return new Response(JSON.stringify({
      url
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Auth-email error:", err);
    return new Response(JSON.stringify({
      error: "Internal Server Error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

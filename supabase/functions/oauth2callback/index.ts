import { createClient } from "npm:@supabase/supabase-js@2";
import { google } from "npm:googleapis@130.0.0";
// Supabase client
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
// Google OAuth2 setup
const clientId = Deno.env.get("CLIENT_ID");
const clientSecret = Deno.env.get("CLIENT_SECRET");
const redirectUrl = Deno.env.get("REDIRECT_URL");
const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
Deno.serve(async (req)=>{
  let redirect_url = null;
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      console.error("Missing code/state in callback");
      return new Response("Missing code or state", {
        status: 400
      });
    }
    let company_id = null;
    let user_id = null;
    try {
      const parsed = JSON.parse(state);
      company_id = parsed.company_id;
      user_id = parsed.user_id;
      redirect_url = parsed.redirect_url;
    } catch (e) {
      console.error("Invalid state JSON:", state);
      return new Response("Invalid state parameter", {
        status: 400
      });
    }
    if (!company_id || !user_id || !redirect_url) {
      return new Response("Missing company_id, user_id or redirect_url in state", {
        status: 400
      });
    }
    // authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    if (!tokens.refresh_token) {
      console.error("No refresh_token received. Try removing app permissions in Google.");
      return new Response("No refresh_token received. Try reconnecting with 'consent' prompt.", {
        status: 400
      });
    }
    // Get authenticated email from Google
    const oauth2 = google.oauth2({
      auth: oAuth2Client,
      version: "v2"
    });
    const { data: userInfo } = await oauth2.userinfo.get();
    if (!userInfo.email) {
      console.error("Failed to fetch authenticated email");
      return new Response("Failed to fetch authenticated email", {
        status: 400
      });
    }
    // Insert into Supabase
    const { error } = await supabase.from("system_settings").insert([
      {
        company_email: userInfo.email,
        system_config_key: "EMAIL_REFRESH_TOKEN",
        system_config_value: tokens.refresh_token,
        description: "Authentication token value for emails",
        company_id: company_id
      }
    ]);
    if (error) {
      console.error("Supabase insert error:", error);
      return new Response("Database insert failed", {
        status: 500
      });
    }
    // Creating system log
    const systemLogs = {
      company_id: company_id,
      transaction_date: new Date().toISOString(),
      module: 'System Settings',
      scope: 'Add',
      key: `${userInfo.email}`,
      log: `Company Email ${userInfo.email} authenticated.`,
      action_by: user_id,
      created_at: new Date().toISOString()
    };
    const { error: systemLogError } = await supabase.from('system_log').insert(systemLogs);
    if (systemLogError) {
      console.error("System log insert error:", systemLogError);
      return new Response("System log insert failed", {
        status: 500
      });
    }
    // Redirect back to frontend with success query param
    return Response.redirect(redirect_url, 302);
  } catch (err) {
    console.error("OAuth Error:", err);
    // Redirect back to frontend with error info
    return Response.redirect(redirect_url, 302);
  }
});

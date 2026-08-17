import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

serve(async (req) => {
  // Pre-flight
  if (req.method === "OPTIONS") return corsResponse({}, 200);

  try {
    const { id, email, password } = await req.json();

    if (!id || !email || !password) {
      return corsResponse({ error: "Missing id, email or password" }, 400);
    }

    // update the user password
    const { data: updated, error: updateErr } =
      await supabase.auth.admin.updateUserById(id, { password });

    if (updateErr) {
      return corsResponse({ error: updateErr.message }, 400);
    }

    // silent login after password change
    const { data: signIn, error: signInErr } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInErr) {
      console.error("Silent re-login failed:", signInErr);
      return corsResponse({
        success: true,
        user: updated.user,
        session: null,
        warning: "Password updated, but silent re-login failed. User may need to login again.",
      });
    }

    return corsResponse({
      success: true,
      user: updated.user,
      session: signIn.session, // Return new access + refresh token
    });
  } catch (err) {
    console.error(err);
    return corsResponse({ error: "Server error" }, 500);
  }
});

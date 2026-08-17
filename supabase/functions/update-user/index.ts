import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

serve(async (req) => {
  // Pre-flight
  if (req.method === "OPTIONS") return corsResponse({}, 200);

  try {
    const { id, email, password } = await req.json();

    if (!id || !email) {
      return corsResponse({ error: "Missing user id or email" }, 400);
    }

    const updateParams: Record<string, unknown> = {};
    if (email) updateParams.email = email;
    if (password) updateParams.password = password;

    // Update the user (service-role)
    const { data: updated, error: updateErr } =
      await supabase.auth.admin.updateUserById(id, updateParams);

    if (updateErr) return corsResponse({ error: updateErr.message }, 400);

    let newSession = null;
    if (password) {
      // sign the user in on the SERVER
      const { data: signIn, error: signInErr } =
        await supabase.auth.signInWithPassword({ email, password }); 

      if (signInErr) {
        console.error("Silent re-login failed:", signInErr);
      } else {
        newSession = signIn.session;     
      }
    }
    return corsResponse({
      success: true,
      user: updated.user,
      session: newSession         
    });
  } catch (err) {
    console.error(err);
    return corsResponse({ error: "Server error" }, 500);
  }
});

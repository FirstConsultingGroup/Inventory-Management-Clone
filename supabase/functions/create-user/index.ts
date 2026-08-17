import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// CORS response helper
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // You can restrict this in production
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE, PUT, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

serve(async (req) => {
  // Handle preflight request for CORS
  if (req.method === "OPTIONS") {
    return corsResponse({}, 200);
  }

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return corsResponse({ error: "Missing email or password" }, 400);
    }

    // Create user in auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error(authError);
      return corsResponse({ error: authError.message }, 400);
    }

    const userId = authUser.user?.id;

    return corsResponse({ user_id: userId }, 200);
  } catch (err) {
    console.error(err);
    return corsResponse({ error: "Server error" }, 500);
  }
});

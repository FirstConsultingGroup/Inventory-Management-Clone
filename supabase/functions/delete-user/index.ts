import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// CORS helper function
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",  // <-- Allow all origins for now, restrict in prod
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE, PUT, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

serve(async (req) => {
  // Handle preflight request
  if (req.method === "OPTIONS") {
    return corsResponse({}, 200);
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return corsResponse({ error: "Missing user id" }, 400);
    }

    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      console.error(error);
      return corsResponse({ error: error.message }, 400);
    }

    return corsResponse({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return corsResponse({ error: "Server error" }, 500);
  }
});
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

// CORS helper
function corsResponse(body: any, status = 200) {
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
  // Handle preflight
  if (req.method === "OPTIONS") return corsResponse({}, 200);

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      return corsResponse({ error: "Missing filePath" }, 400);
    }

    const { data, error } = await supabase.storage
      .from("profile-picture")
      .remove([filePath]);

    if (error) {
      return corsResponse({ error: error.message }, 500);
    }

    // If nothing deleted, send informative message
    if (!data || data.length === 0) {
      return corsResponse({ message: "No file deleted. Check the file path." }, 200);
    }

    return corsResponse({ message: "Image deleted successfully", data }, 200);
  } catch (err: any) {
    console.error(err);
    return corsResponse({ error: "Server error" }, 500);
  }
});

// supabase/functions/fetch-stores/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
// Supabase environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
// Helper for CORS
function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE, PUT, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return corsResponse({}, 200);
  }
  try {
    if (req.method !== "POST") {
      return corsResponse({
        error: "Only POST allowed"
      }, 405);
    }
    const { company_id } = await req.json();
    if (!company_id) {
      return corsResponse({
        error: "company_id is required"
      }, 400);
    }
    const { data, error } = await supabase.from("store_mgmt").select("*").eq("company_id", company_id).eq("is_active", true).order("name");
    if (error) {
      console.error("Supabase error:", error);
      return corsResponse({
        error: error.message
      }, 500);
    }
    return corsResponse({
      stores: data
    }, 200);
  } catch (err) {
    console.error("Server error:", err);
    return corsResponse({
      error: "Server error"
    }, 500);
  }
});

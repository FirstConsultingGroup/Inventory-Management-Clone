import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
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
    const { email, password } = await req.json();
    if (!email || !password) {
      return corsResponse({
        success: false,
        message: "Email and password are required"
      }, 400);
    }
    // verifies old password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: password
    });
    if (error) {
      return corsResponse({
        success: true,
        valid: false
      }, 200);
    }
    return corsResponse({
      success: true,
      valid: true,
      userId: data.user?.id
    }, 200);
  } catch (err) {
    console.error("verify-password error:", err);
    return corsResponse({
      success: false,
      message: "Server error"
    }, 500);
  }
});

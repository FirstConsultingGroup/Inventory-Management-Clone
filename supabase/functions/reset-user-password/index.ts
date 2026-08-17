import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

// Create Supabase client using service role key
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// CORS helper
function corsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") return corsResponse({}, 200);

  try {
    const { id, email, password } = await req.json();

    // Input validation
    if (!id || !email || !password) {
      return corsResponse(
        { success: false, error: "Missing required fields: id, email, or password" },
        400
      );
    }

    // Update password in Supabase Auth
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      id,
      { password }
    );

    if (updateError) {
      return corsResponse({ success: false, error: updateError.message }, 400);
    }

    return corsResponse({
      success: true,
      message: "Password reset successful. Please log in with your new password.",
      user: updatedUser.user,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return corsResponse({ success: false, error: "Internal server error" }, 500);
  }
});

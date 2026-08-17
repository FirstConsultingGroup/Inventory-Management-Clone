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
    const { company_id, access_key, user_id } = await req.json();
    if (!company_id || !access_key || !user_id) {
      return corsResponse({
        error: "Missing required fields"
      }, 400);
    }
    // Validate company
    const { data: company, error: companyError } = await supabase
      .from("company_master")
      .select("id")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      return corsResponse({
        error: "Invalid company_id"
      }, 404);
    }
    // Validate or insert integration record
    const { data: integration, error: integrationError } = await supabase
      .from("client_integrations")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (integrationError) {
      return corsResponse({
        error: "Error checking integration"
      }, 500);
    }
    if (!integration) {
      const { error: insertError } = await supabase
        .from("client_integrations")
        .insert({
          company_id,
          access_key,
          user_id
        });

      if (insertError) {
        return corsResponse({
          error: "Failed to create integration record"
        }, 500);
      }
    } else if (integration.access_key !== access_key) {
      return corsResponse({
        error: "Invalid access key"
      }, 403);
    }
    // Get user
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(user_id);
    if (authError || !authData?.user) {
      return corsResponse({
        error: "Invalid user_id"
      }, 404);
    }
    const sessionUser = authData.user;
    // Fetch user details with company info
    const { data: userDetails, error: userError } = await supabase
      .from("user_mgmt")
      .select(`
        *,
        company_master (*)
      `)
      .eq("id", sessionUser.id)
      .single();

    if (userError || !userDetails) {
      return corsResponse({
        error: "User not found in user_mgmt"
      }, 404);
    }
    // Fetch role name
    let roleName = null;
    if (userDetails.role_id) {
      const { data: roleData } = await supabase
        .from("role_master")
        .select("name")
        .eq("id", userDetails.role_id)
        .single();

      roleName = roleData?.name || null;
    }
    const userData = {
      id: sessionUser.id,
      email: sessionUser.email ?? "",
      email_confirmed: sessionUser.email_confirmed_at ? true : false,
      created_at: sessionUser.created_at,
      last_sign_in: sessionUser.last_sign_in_at,
      first_name: userDetails?.first_name || null,
      last_name: userDetails?.last_name || null,
      role_id: userDetails?.role_id || null,
      role_name: roleName,
      status: userDetails?.status || null,
      is_active: userDetails?.is_active,
      company_id: userDetails?.company_id || null,
      company_data: userDetails?.company_master || null,
      full_name: userDetails?.first_name && userDetails?.last_name ? `${userDetails.first_name} ${userDetails.last_name}` : null
    };
    if (!userData.is_active) {
      return corsResponse({
        error: "Account is inactive"
      }, 403);
    }
    const redirectUrl = `http://localhost:5173/dashboard/inventoryManagement`;
    return corsResponse({
      success: true,
      message: "Login successful",
      user: userData,
      redirect_url: redirectUrl
    });
  } catch (err) {
    console.error("Server error:", err);
    return corsResponse({
      error: "Server error"
    }, 500);
  }
});

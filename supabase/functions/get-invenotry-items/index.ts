import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
// CORS response helper
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
    const body = await req.json();
    const { search_term, sort_field, sort_direction, page_size, page_number, company_id } = body;
    if (!page_size || !page_number || !company_id) {
      return corsResponse({
        error: "Invalid or missing parameters"
      }, 400);
    }
    // Call the RPC function
    const { data, error } = await supabase.rpc('get_combined_inventory', {
      search_term: search_term || "",
      sort_field,
      sort_direction,
      page_size,
      page_number,
      company_id
    });
    if (error) {
      console.error("RPC error:", error);
      return corsResponse({
        error: error.message
      }, 500);
    }
    if (!data || !Array.isArray(data)) {
      return corsResponse({
        items: [],
        total_count: 0
      }, 200);
    }
    // Map data to the expected format
    const items = data.map((item)=>({
        id: item.id,
        item_uuid: item.item_uuid,
        item_id: item.item_id || '',
        item_name: item.item_name || 'Unknown Item',
        item_category: item.item_category || 'Uncategorized',
        description: item.description || 'No description',
        selling_price: item.selling_price || 0,
        total_quantity: item.total_quantity || 0,
        store_id: item.store_id || '',
        purchase_order_id: item.purchase_order_id || '',
        stock_date: item.stock_date || '',
        expiry_date: item.expiry_date || null
      }));
    const total_count = data.length > 0 ? data[0].total_count || 0 : 0;
    return corsResponse({
      items,
      total_count
    }, 200);
  } catch (err) {
    console.error("Server error:", err);
    return corsResponse({
      error: "Server error"
    }, 500);
  }
});

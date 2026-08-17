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
    const body = await req.json();
    const { company_id, store_id, search_query = "" } = body;
    if (!company_id || !store_id) {
      return corsResponse({
        error: "company_id or store_id are required!"
      }, 400);
    }
    // if search query is null, then return empty response
    // if (!search_query || search_query.trim() === "") {
    //   return corsResponse({
    //     success: true,
    //     data: []
    //   }, 200);
    // }
    // Get inventory data by store
    const { data: inventoryData, error: inventoryError } = await supabase.from('inventory_mgmt').select('item_id, item_qty').eq('company_id', company_id).eq('store_id', store_id).gt('item_qty', 0);
    if (inventoryError) {
      console.error("Error fetching inventory items:", inventoryError);
      return corsResponse({
        error: inventoryError.message
      }, 500);
    }
    // Unique item ids
    const itemIds = [
      ...new Set(inventoryData.map((item)=>item.item_id).filter(Boolean))
    ];
    const { data: stockData, error: stockErr } = await supabase.rpc('get_total_stock_for_items_by_store', {
      item_ids: itemIds,
      p_store_id: store_id
    });
    if (stockErr) {
      console.error("Error fetching stock data:", stockErr);
      return corsResponse({
        error: stockErr.message
      }, 500);
    }
    // Fetch items data from item_mgmt
    const { data: itemData, error: itemError } = await supabase.from('item_mgmt').select('*').eq('is_active', true).eq('company_id', company_id).in('id', itemIds).or(`item_name.ilike.%${search_query.trim()}%,description.ilike.%${search_query.trim()}%`).limit(10);
    if (itemError) {
      console.error("Error fetching item data:", itemError);
      return corsResponse({
        error: itemError.message
      }, 500);
    }
    // Formatted item data with available qty
    const formattedItemData = itemData.map((item)=>({
        id: item.id,
        item_id: item.item_id,
        item_name: item.item_name,
        description: item.description,
        selling_price: item.selling_price,
        available_stock: stockData.find((stock)=>item.id === stock.item_id).total_qty
      }));
    return corsResponse({
      success: true,
      data: formattedItemData
    }, 200);
  } catch (err) {
    console.error("Server error:", err);
    return corsResponse({
      error: "Server error"
    }, 500);
  }
});

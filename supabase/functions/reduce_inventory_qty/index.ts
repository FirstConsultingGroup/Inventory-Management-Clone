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
    const items = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return corsResponse({
        success: false,
        error: "Request body must be an array of items"
      }, 400);
    }
    // Validation for all items
    for (const { itemId, storeId, requiredQuantity, companyId } of items){
      if (!itemId || !storeId || !requiredQuantity || !companyId) {
        return corsResponse({
          success: false,
          error: "itemId, storeId, companyId & requiredQuantity are required for each item"
        }, 400);
      }
      const { data: rows, error: fetchErr } = await supabase.from("inventory_mgmt").select("item_qty").eq("item_id", itemId).eq("store_id", storeId).eq("company_id", companyId).gt("item_qty", 0);
      if (fetchErr) {
        return corsResponse({
          success: false,
          error: fetchErr.message
        }, 500);
      }
      const totalAvailable = rows?.reduce((sum, r)=>sum + (r.item_qty || 0), 0) || 0;
      if (totalAvailable < requiredQuantity) {
        return corsResponse({
          success: false,
          error: `Insufficient stock for itemId ${itemId}. Available: ${totalAvailable}, Required: ${requiredQuantity}`
        }, 400);
      }
    }
    // Reduce inventory qty for all items
    for (const { itemId, storeId, requiredQuantity, companyId } of items){
      let remaining = requiredQuantity;
      const { data: rows, error: fetchRowsErr } = await supabase.from("inventory_mgmt").select("id, item_qty, created_at").eq("item_id", itemId).eq("store_id", storeId).eq("company_id", companyId).gt("item_qty", 0).order("created_at", {
        ascending: true
      });
      if (fetchRowsErr) {
        return corsResponse({
          success: false,
          error: fetchRowsErr.message
        }, 500);
      }
      for (const row of rows){
        if (remaining <= 0) break;
        const available = row.item_qty || 0;
        const deduct = Math.min(available, remaining);
        const newQty = available - deduct;
        const { error: updateErr } = await supabase.from("inventory_mgmt").update({
          item_qty: newQty
        }).eq("id", row.id);
        if (updateErr) {
          return corsResponse({
            success: false,
            error: updateErr.message
          }, 500);
        }
        remaining -= deduct;
      }
    }
    return corsResponse({
      success: true
    }, 200);
  } catch (err) {
    console.error("FIFO multi-item reduction error:", err);
    return corsResponse({
      success: false,
      error: err?.message || err
    }, 500);
  }
});

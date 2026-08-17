import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const generatePRNumber = (serial: number) => {
      const now = new Date();

      const dd = String(now.getUTCDate()).padStart(2, "0");
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const yy = String(now.getUTCFullYear()).slice(-2);

      const serialStr = String(serial).padStart(4, "0");

      return `PR-${dd}${mm}${yy}-${serialStr}`;
    };

    const validateAndFixPRNumber = async (
      supabase: any,
      companyId: string,
      prNumber: string
    ) => {

      const now = new Date();

      const dd = String(now.getUTCDate()).padStart(2, "0");
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const yy = String(now.getUTCFullYear()).slice(-2);

      const todayPrefix = `PR-${dd}${mm}${yy}-`;

      const { data } = await supabase
        .from("purchase_req_master")
        .select("purchase_req_number")
        .eq("company_id", companyId)
        .like("purchase_req_number", `${todayPrefix}%`);

      const existingSerials =
        data?.map((row: any) => {
          const match = row.purchase_req_number?.match(/-(\d{4})$/);
          return match ? parseInt(match[1], 10) : 0;
        }) ?? [];

      const match = prNumber.match(/-(\d{4})$/);
      const currentSerial = match ? parseInt(match[1], 10) : 1;

      const nextSerial =
        existingSerials.length > 0
          ? Math.max(...existingSerials) + 1
          : 1;

      const finalSerial = existingSerials.includes(currentSerial)
        ? nextSerial
        : currentSerial;

      return generatePRNumber(finalSerial);
    };

    const payload = await req.json();

    const {
      company_id,
      purchase_req_number,
      purchase_req_date,
      created_by,
      store_id,
      department_id,
      category_type,
      procurement_status,
      items,
    } = payload;

    if (!items || items.length === 0) {
      throw new Error("Items are required");
    }

    const now = new Date().toISOString();

    /**
     * Fetch Workflow Config 
     */
    const { data: workflowConfig } = await supabase
      .from("workflow_config")
      .select("*")
      .eq("company_id", company_id)
      .eq("process_name", "Purchase Requisition")
      .eq("store_id", store_id)
      .eq("is_active", true)
      .eq("status", true)
      .order("level", { ascending: true })
      .limit(1)
      .maybeSingle();

    /**
     * Fetch System Status Config
     */
    const { data: statusConfig } = await supabase
      .from("system_message_config")
      .select("id, sub_category_id")
      .eq("company_id", company_id)
      .eq("category_id", "PURCHASE_REQUISITION");

    const statusNew = statusConfig?.find(
      (s) => s.sub_category_id === "NEW"
    );

    const statusApproved = statusConfig?.find(
      (s) => s.sub_category_id === "APPROVED"
    );

    let status: string | null = null;
    let workflow_id: string | null = null;
    let next_level_role_id: string | null = null;
    let approval_status: any = null;

    /**
     * Generate Approval Status
     */
    if (workflowConfig) {
      workflow_id = workflowConfig.id;
      next_level_role_id = workflowConfig.role_id;

      status = statusNew?.id ?? null;

      approval_status = [
        {
          status: `Level ${workflowConfig.level} approval pending`,
          trail: "Pending",
          role_id: workflowConfig.role_id,
          sequence_no: 0,
          isFinalized: false,
        },
      ];
    } else {
      status = statusApproved?.id ?? null;
      approval_status = null;
    }

    const fixedPRNumber = await validateAndFixPRNumber(
      supabase,
      company_id,
      purchase_req_number
    );

    /**
     * Insert PR MASTER
     */
    const { data: createdPR, error: prError } = await supabase
      .from("purchase_req_master")
      .insert({
        company_id,
        purchase_req_number: fixedPRNumber,
        purchase_req_date,
        status,
        approval_status,
        total_items: items.length,
        created_by,
        created_at: now,
        workflow_id,
        next_level_role_id,
        store_id,
        department_id,
        procurement_status,
        category_type,
      })
      .select()
      .single();

    if (prError) throw prError;

    /**
     * Insert PR ITEMS
     */
    const itemsPayload = items.map((item: any) => ({
      company_id,
      purchase_req_id: createdPR.id,
      item_id: item.item?.value,
      req_qty: item.quantity,
      created_at: now,
    }));

    const { error: itemsError } = await supabase
      .from("purchase_req_details")
      .insert(itemsPayload);

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Purchase requisition created",
        data: createdPR,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
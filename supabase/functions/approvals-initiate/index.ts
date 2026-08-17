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

    const payload = await req.json();
    const {
      module_id,
      action_id,
      store_id, // Might be null for general modules
      company_id,
      requested_by,
      action_payload,
      entity_id,
    } = payload;

    if (!module_id || !action_id || !company_id || !requested_by || !action_payload) {
      throw new Error("Missing required fields for approval initiation.");
    }

    // 1. Fetch Module Info to check if store-specific
    const { data: moduleData, error: moduleError } = await supabase
      .from("main_modules")
      .select("is_store_specific, module_name")
      .eq("id", module_id)
      .single();

    if (moduleError || !moduleData) {
      throw new Error("Error fetching module info: " + (moduleError?.message || "Module not found"));
    }

    const isStoreSpecific = moduleData.is_store_specific;
    let finalStoreId = store_id;

    if (isStoreSpecific && !store_id) {
      throw new Error("store_id is required for store-specific modules.");
    }

    if (!isStoreSpecific) {
      finalStoreId = null; // Ignore store_id for general modules
    }

    // 2. Fetch the single workflow config for (user, module, action)
    const { data: workflowConfigs, error: workflowError } = await supabase
      .from("workflow_config")
      .select("*")
      .eq("assigned_to", requested_by)
      .eq("module_id", module_id)
      .eq("action_id", action_id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .eq("status", true)
      .order("level", { ascending: true }); // It might still have levels via multiple rows or a single row with levels array. Assuming multiple rows per level for the SAME workflow based on existing schema.

    if (workflowError) {
      throw new Error("Error fetching workflow config: " + workflowError.message);
    }

    if (!workflowConfigs || workflowConfigs.length === 0) {
      // No active workflow found, return flag indicating no approval needed
      return new Response(
        JSON.stringify({
          success: true,
          requires_approval: false,
          message: "No workflow found, proceed with direct execution.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. For Store-Specific modules, check if the current store is in the workflow's stores array
    if (isStoreSpecific) {
      // We assume the stores array is the same across all level rows for this workflow config
      const stores = workflowConfigs[0].stores || [];
      const storeExists = stores.some((s: any) => s.id === store_id);

      if (!storeExists) {
        return new Response(
          JSON.stringify({
            success: true,
            requires_approval: false,
            message: "Workflow not applicable for this store, proceed with direct execution.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Snapshot the workflow config for this request
    const workflowSnapshot = workflowConfigs.map(c => ({
      level: c.level,
      role_id: c.role_id,
      multiple_approvers_enabled: c.multiple_approvers_enabled,
      approval_users: c.approval_users,
      override_enabled: c.override_enabled,
      full_rejection_enabled: c.full_rejection_enabled
    }));

    // 4.5 Generate Reference Number (REQ-DDMMYYYY-XXXX)
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { count, error: countError } = await supabase
      .from('approval_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    if (countError) {
      throw new Error("Error fetching request count: " + countError.message);
    }
    
    const seq = String((count || 0) + 1).padStart(4, '0');
    const referenceNumber = `REQ-${dateStr}-${seq}`;

    // 5. Create the pending approval request
    const { data: createdRequest, error: insertError } = await supabase
      .from("approval_requests")
      .insert({
        module_id,
        action_id,
        store_id: finalStoreId,
        company_id,
        requested_by,
        payload: action_payload,
        current_level: 1,
        status: 'PENDING',
        workflow_snapshot: workflowSnapshot,
        entity_id: entity_id || null,
        reference_number: referenceNumber
      })
      .select()
      .single();

    if (insertError) {
      throw new Error("Error creating approval request: " + insertError.message);
    }

    // 6. Generate Notifications
    try {
      const level1Workflow = workflowSnapshot.find(w => w.level === 1);
      const level1Approvers = level1Workflow?.approval_users || [];
      const assignedUserIds = level1Approvers.map((u: any) => typeof u === 'string' ? u : (u.id || u));

      // Get Super Admin role
      const { data: roleData } = await supabase
        .from("role_master")
        .select("id")
        .eq("company_id", company_id)
        .eq("name", "Super Admin")
        .eq("is_active", true)
        .single();

      let superAdminIds: string[] = [];
      if (roleData) {
        const { data: saUsers } = await supabase
          .from("user_mgmt")
          .select("id")
          .eq("role_id", roleData.id)
          .eq("company_id", company_id)
          .eq("is_active", true);
        if (saUsers) {
          superAdminIds = saUsers.map(u => u.id);
        }
      }

      // Avoid duplicates using a Map
      const notificationSet = new Map(); // key: user_id, value: message
      
      const moduleName = moduleData?.module_name || "Request";

      // Add Level 1 Approvers
      assignedUserIds.forEach((id: string) => {
        if (id !== requested_by) {
           notificationSet.set(id, `${moduleName} ${referenceNumber} requires your approval at Level 1.`);
        }
      });

      // Add Super Admins
      superAdminIds.forEach((id: string) => {
         if (!notificationSet.has(id) && id !== requested_by) {
            notificationSet.set(id, `${moduleName} ${referenceNumber} has been raised and requires approval at Level 1.`);
         }
      });

      const notificationsToInsert = [];
      for (const [userId, message] of notificationSet.entries()) {
        notificationsToInsert.push({
           priority: "High",
           alert_type: "Approval Request",
           entity_id: createdRequest.id,
           message: message,
           status: "New",
           assign_to: userId,
           company_id: company_id,
           created_by: requested_by,
           is_active: true
        });
      }

      if (notificationsToInsert.length > 0) {
         const { error: notifError } = await supabase.from("system_notification").insert(notificationsToInsert);
         if (notifError) console.error("Error inserting notifications:", notifError);
      }
    } catch (notifError) {
       console.error("Error generating notifications:", notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        requires_approval: true,
        message: "Action submitted for approval.",
        data: createdRequest,
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

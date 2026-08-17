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
    const { request_id, action, comments, approver_id, force_override } = payload;

    if (!request_id || !action || !approver_id) {
      throw new Error("Missing required fields: request_id, action, approver_id.");
    }

    if (!["APPROVED", "REJECTED"].includes(action)) {
      throw new Error("Invalid action. Must be APPROVED or REJECTED.");
    }

    // 1. Fetch the approval request
    const { data: requestData, error: requestError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (requestError || !requestData) {
      throw new Error("Approval request not found.");
    }

    if (requestData.status === "Approved" || requestData.status === "Rejected") {
      throw new Error(`Request is already ${requestData.status}.`);
    }

    if (!force_override) {
      const snapshot = requestData.workflow_snapshot || [];
      const currentStep = snapshot.find((step: any) => step.level === requestData.current_level);
      
      if (!currentStep) {
        throw new Error("Invalid workflow configuration for the current level.");
      }

      const assignedApprovers = currentStep.approval_users?.map((u: any) => 
        typeof u === 'string' ? u : (u.id || u)
      ) || [];
      
      if (!assignedApprovers.includes(approver_id)) {
        throw new Error("Unauthorized: You are not assigned as an approver for this request's current level.");
      }
    }

    if (action === "APPROVED") {
      // Execute Payload-Driven Validations (Fail early before modifying any state)
      if (requestData.payload && Array.isArray(requestData.payload.validations)) {
        for (const validation of requestData.payload.validations) {
           if (validation.type === 'unique') {
             let query = supabase
               .from(validation.table)
               .select('*', { count: 'exact', head: true })
               .eq(validation.column, validation.value);
               
             if (validation.ignore_id) {
               query = query.neq('id', validation.ignore_id);
             }
             
             if (validation.company_id) {
               query = query.eq('company_id', validation.company_id);
             }
               
             const { count, error } = await query;
               
             if (error) throw new Error(`Validation query failed on table ${validation.table}: ${error.message}`);
             
             // If a record is found, it's not unique
             if (count && count > 0) {
               throw new Error(`Validation failed: ${validation.column} '${validation.value}' already exists.`);
             }
           } else if (validation.type === 'exists') {
             const { count, error } = await supabase
               .from(validation.table)
               .select('*', { count: 'exact', head: true })
               .eq(validation.column, validation.value);
               
             if (error) throw new Error(`Validation query failed on table ${validation.table}: ${error.message}`);
             
             // If no record is found, it does not exist
             if (!count || count === 0) {
               throw new Error(`Validation failed: ${validation.column} '${validation.value}' does not exist.`);
             }
           }
        }
      }
    }

    // 2. Insert into history
    const snapshot = requestData.workflow_snapshot || [];
    const parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    const maxLevel = parsedSnapshot.reduce((max: number, step: any) => Math.max(max, step.level || 0), 0);

    if (force_override && action === "APPROVED") {
      const historyRecords = [];
      for (let lvl = requestData.current_level; lvl <= maxLevel; lvl++) {
        historyRecords.push({
          approval_request_id: request_id,
          level: lvl,
          approver_id,
          action,
          comments: comments ? `[Super Admin Override] ${comments}` : `[Super Admin Override]`
        });
      }
      
      const { error: historyError } = await supabase
        .from("approval_history")
        .insert(historyRecords);

      if (historyError) {
        throw new Error("Failed to record super admin override history: " + historyError.message);
      }
    } else {
      const { error: historyError } = await supabase
        .from("approval_history")
        .insert({
          approval_request_id: request_id,
          level: requestData.current_level,
          approver_id,
          action,
          comments
        });

      if (historyError) {
        throw new Error("Failed to record approval history: " + historyError.message);
      }
    }

    let finalStatus = requestData.status;

    if (action === "REJECTED") {
      const snapshot = requestData.workflow_snapshot || [];
      // Supabase jsonb usually auto-parses, but if it's a string we should handle it
      const parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
      const currentStep = parsedSnapshot.find((step: any) => step.level === requestData.current_level);
      
      const isFullRejection = currentStep?.full_rejection_enabled === true || requestData.full_rejection_enabled === true;
      const currentLevel = requestData.current_level;

      if (isFullRejection || currentLevel === 1) {
        finalStatus = "Rejected";
        
        const { error: updateError } = await supabase
          .from("approval_requests")
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq("id", request_id);

        if (updateError) throw updateError;
        
        // Garbage Collection for Orphaned Files
        if (requestData.payload && Array.isArray(requestData.payload.operations)) {
          try {
            const payloadString = JSON.stringify(requestData.payload);
            // Regex to find Supabase Storage URLs. Example: https://project-ref.supabase.co/storage/v1/object/public/bucket-name/folder/file.jpg
            const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/([^/]+)\/([^"'\s]+)/g;
            let match;
            while ((match = urlRegex.exec(payloadString)) !== null) {
              const bucket = match[1];
              // Decode the URI component to handle spaces or special chars in the path
              const path = decodeURIComponent(match[2]);
              await supabase.storage.from(bucket).remove([path]);
              console.log(`Garbage collected orphaned file: bucket=${bucket}, path=${path}`);
            }
          } catch (gcError) {
             console.error("Garbage collection failed:", gcError);
             // We do not throw here to allow the rejection to succeed even if cleanup fails
          }
        }
      } else {
        // Move back to previous level
        const previousLevel = currentLevel - 1;
        finalStatus = `Level ${currentLevel} Approval - Rejected`;

        // Update the request to go back one level
        const { error: updateError } = await supabase
          .from("approval_requests")
          .update({ 
            current_level: previousLevel,
            status: finalStatus, 
            updated_at: new Date().toISOString() 
          })
          .eq("id", request_id);

        if (updateError) throw updateError;

      }
      
    } else if (action === "APPROVED") {
      // Check if there are more levels in the workflow snapshot
      const snapshot = requestData.workflow_snapshot || [];
      const currentStep = snapshot.find((step: any) => step.level === requestData.current_level);
      
      let shouldAdvanceLevel = true;
      
      if (currentStep && currentStep.multiple_approvers_enabled && !force_override) {
        // 1. Fetch the most recent rejection to establish the current "cycle"
        const { data: lastRejection, error: rejectionFetchError } = await supabase
          .from("approval_history")
          .select("action_date")
          .eq("approval_request_id", request_id)
          .eq("action", "REJECTED")
          .order("action_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rejectionFetchError) throw new Error("Failed to fetch rejection history.");

        let approvalsQuery = supabase
          .from("approval_history")
          .select("approver_id")
          .eq("approval_request_id", request_id)
          .eq("level", requestData.current_level)
          .eq("action", "APPROVED");

        if (lastRejection) {
          approvalsQuery = approvalsQuery.gt("action_date", lastRejection.action_date);
        }

        const { data: historyData, error: historyFetchError } = await approvalsQuery;
          
        if (historyFetchError) throw new Error("Failed to fetch approval history for validation.");
        
        const approvedUserIds = new Set(historyData.map(h => h.approver_id));
        const totalAssignedApprovers = currentStep.approval_users?.length || 0;
        
        if (approvedUserIds.size < totalAssignedApprovers) {
          shouldAdvanceLevel = false;
        }
      }

      if (shouldAdvanceLevel) {
        const nextLevelExists = snapshot.some((step: any) => step.level > requestData.current_level);

      if (nextLevelExists && !force_override) {
        // Move to next level
        finalStatus = `Level ${requestData.current_level} Approved`;
        const { error: updateError } = await supabase
          .from("approval_requests")
          .update({ 
            current_level: requestData.current_level + 1,
            status: finalStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", request_id);

        if (updateError) throw updateError;

      } else {
        // Final approval reached
        finalStatus = "Approved";
        const { error: updateError } = await supabase
          .from("approval_requests")
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq("id", request_id);

        if (updateError) throw updateError;



        // Execute Payload-Driven Operations
        if (requestData.payload && Array.isArray(requestData.payload.operations)) {
          const variables: Record<string, any> = {};

          for (const op of requestData.payload.operations) {
            let parsedData: any = null;
            
            if (op.data !== undefined) {
              let opDataStr = JSON.stringify(op.data);
              
              // Variable Replacement
              for (const [key, value] of Object.entries(variables)) {
                opDataStr = opDataStr.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
              }
              
              parsedData = JSON.parse(opDataStr);
              
              // Clean up unresolved placeholders (they should be auto-generated by the database)
              if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
                 for (const key in parsedData) {
                    if (typeof parsedData[key] === 'string' && parsedData[key].startsWith('{{') && parsedData[key].endsWith('}}')) {
                       delete parsedData[key];
                    }
                 }
              }
            }

            const returnIdAs = op.return_id_as || op.return_id_key;

            if (op.type === "auth_user_create") {
               const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                  email: parsedData.email,
                  password: parsedData.password,
                  email_confirm: parsedData.email_confirm ?? true,
                  user_metadata: parsedData.user_metadata || {}
               });
               if (authError) throw new Error(`Auth creation failed: ${authError.message}`);
               
               if (returnIdAs && authData.user) {
                 variables[returnIdAs] = authData.user.id;
               }
            } else if (op.type === "auth_user_update") {
               if (!op.user_id) throw new Error("auth_user_update requires a 'user_id' parameter.");
               const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
                  op.user_id,
                  {
                    email: parsedData.email,
                    password: parsedData.password,
                    user_metadata: parsedData.user_metadata
                  }
               );
               if (authError) throw new Error(`Auth update failed: ${authError.message}`);
               
            } else if (op.type === "generate_sequence") {
               // Execute generic sequence generation directly via query
               const prefix = op.prefix || "";
               const padding = op.padding || 3;
               
               const { data: seqData, error: seqError } = await supabase
                 .from(op.table)
                 .select(op.column)
                 .like(op.column, `${prefix}%`)
                 // Reverse order to get the highest sequence string
                 .order(op.column, { ascending: false })
                 .limit(1)
                 .maybeSingle();
                 
               if (seqError && seqError.code !== 'PGRST116') {
                 throw new Error(`Sequence generation query failed: ${seqError.message}`);
               }
               
               let nextNum = op.start_sequence || 1;
               
               if (seqData && seqData[op.column]) {
                 const currentId = String(seqData[op.column]);
                 if (currentId.startsWith(prefix)) {
                   const numPart = currentId.substring(prefix.length);
                   const parsedNum = parseInt(numPart, 10);
                   if (!isNaN(parsedNum)) {
                     nextNum = parsedNum + 1;
                   }
                 }
               }
               
               const paddedNum = String(nextNum).padStart(padding, '0');
               const generatedSequence = `${prefix}${paddedNum}`;
               
               if (returnIdAs) {
                 variables[returnIdAs] = generatedSequence;
               }
            } else if (op.type === "rpc") {
               // Execute generic RPC
               const rpcName = op.rpc_name || op.function_name;
               const rpcArgs = op.rpc_args || op.data || {};
               const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);
               if (rpcError) throw new Error(`RPC execution failed (${rpcName}): ${rpcError.message}`);
               
               if (returnIdAs) {
                 variables[returnIdAs] = rpcData;
               }
            } else if (op.type === "insert") {
              const { data: result, error: opError } = await supabase
                .from(op.table)
                .insert(parsedData)
                .select();
              
              if (opError) {
                throw new Error(`Operation failed on table ${op.table}: ${opError.message}`);
              }

              if (returnIdAs && result && result.length > 0) {
                variables[returnIdAs] = result[0].id;
              }
            } else if (op.type === "update") {
              let query = supabase.from(op.table).update(parsedData);
              
              const matchObj = op.match || op.conditions;
              if (matchObj) {
                for (const mKey of Object.keys(matchObj)) {
                  let mVal = matchObj[mKey];
                  if (typeof mVal === 'string' && mVal.startsWith('{{') && mVal.endsWith('}}')) {
                     const vName = mVal.slice(2, -2);
                     mVal = variables[vName] !== undefined ? variables[vName] : mVal;
                  }
                  if (Array.isArray(mVal)) { query = query.in(mKey, mVal); } else { query = query.eq(mKey, mVal); }
                }
              }
              
              const { error: opError } = await query;
              if (opError) {
                throw new Error(`Update failed on table ${op.table}: ${opError.message}`);
              }
            } else if (op.type === "delete") {
              let query = supabase.from(op.table).delete();
              
              const matchObj = op.match || op.conditions;
              if (matchObj) {
                for (const mKey of Object.keys(matchObj)) {
                  let mVal = matchObj[mKey];
                  if (typeof mVal === 'string' && mVal.startsWith('{{') && mVal.endsWith('}}')) {
                     const vName = mVal.slice(2, -2);
                     mVal = variables[vName] !== undefined ? variables[vName] : mVal;
                  }
                  if (Array.isArray(mVal)) { query = query.in(mKey, mVal); } else { query = query.eq(mKey, mVal); }
                }
              }
              
              const { error: opError } = await query;
              if (opError) {
                throw new Error(`Delete failed on table ${op.table}: ${opError.message}`);
              }
            }
          }
        }
      }
      } else {
        // Keep it on the same level, but someone has approved it, so it's IN_PROGRESS
        finalStatus = `Level ${requestData.current_level} Approval - In Progress`;
        const { error: updateError } = await supabase
          .from("approval_requests")
          .update({ 
            status: finalStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", request_id);

        if (updateError) throw updateError;
      }
    }

    // --- 3. Generate Notifications ---
    try {
      const companyId = requestData.company_id;
      const requesterId = requestData.requested_by;
      const refNum = requestData.reference_number || `REQ`;
      const currentLevel = requestData.current_level;

      // Get Module Name
      const { data: moduleData } = await supabase
        .from("main_modules")
        .select("module_name")
        .eq("id", requestData.module_id)
        .single();
      const moduleName = moduleData?.module_name || "Request";

      // Get Approver Name
      const { data: approverData } = await supabase
        .from("user_mgmt")
        .select("first_name, last_name")
        .eq("id", approver_id)
        .single();
      const approverName = approverData ? `${approverData.first_name} ${approverData.last_name}` : "An approver";

      // Get Super Admins
      const { data: roleData } = await supabase
        .from("role_master")
        .select("id")
        .eq("company_id", companyId)
        .eq("name", "Super Admin")
        .eq("is_active", true)
        .single();

      let superAdminIds: string[] = [];
      if (roleData) {
        const { data: saUsers } = await supabase
          .from("user_mgmt")
          .select("id")
          .eq("role_id", roleData.id)
          .eq("company_id", companyId)
          .eq("is_active", true);
        if (saUsers) superAdminIds = saUsers.map((u: any) => u.id);
      }

      const notificationMap = new Map(); // key: user_id, value: { alert_type, message, priority }
      const snapshot = requestData.workflow_snapshot || [];
      const parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

      const addNotification = (userId: string, type: string, msg: string, priority = "Medium", allowSelf = false) => {
        if (!notificationMap.has(userId)) {
          if (userId !== approver_id || allowSelf) {
            notificationMap.set(userId, { alert_type: type, message: msg, priority });
          }
        }
      };

      if (action === "REJECTED") {
        const msg = `${moduleName} ${refNum} has been rejected by ${approverName} at Level ${currentLevel}. Reason: ${comments || 'None'}`;
        
        superAdminIds.forEach(id => addNotification(id, "Approval Rejected", msg, "High"));
        addNotification(requesterId, "Approval Rejected", msg, "High");
        
        if (finalStatus !== "Rejected") { // moved back to previous level
           const previousLevel = currentLevel - 1;
           const prevStep = parsedSnapshot.find((step: any) => step.level === previousLevel);
           const prevApprovers = prevStep?.approval_users?.map((u: any) => typeof u === 'string' ? u : (u.id || u)) || [];
           prevApprovers.forEach((id: string) => addNotification(id, "Approval Rejected", msg, "High"));
        }
      } else if (action === "APPROVED") {
        if (finalStatus === "Approved") {
           // Fully Completed
           let msg = `${moduleName} ${refNum} has been fully approved and completed by ${approverName}.`;
           if (force_override) {
             msg = `${moduleName} ${refNum} has been fully approved by Super Admin Override (${approverName}).`;
           }
           // Allow self notification for Super Admins on final completion
           superAdminIds.forEach(id => addNotification(id, "Approval Fully Completed", msg, "High", true));
           addNotification(requesterId, "Approval Fully Completed", msg, "High");
           
           // Notify all level approvers
           parsedSnapshot.forEach((step: any) => {
             const approvers = step.approval_users?.map((u: any) => typeof u === 'string' ? u : (u.id || u)) || [];
             approvers.forEach((id: string) => addNotification(id, "Approval Fully Completed", msg, "High"));
           });
        } else if (finalStatus.includes("Level") && finalStatus.includes("Approved")) {
           // Level Advanced
           const newLevel = currentLevel + 1;
           const msg = `${moduleName} ${refNum} Level ${currentLevel} has been approved by ${approverName}.`;
           superAdminIds.forEach(id => addNotification(id, "Approval Level Completed", msg, "Medium"));
           
           // Notify next level approvers
           const nextStep = parsedSnapshot.find((step: any) => step.level === newLevel);
           const nextApprovers = nextStep?.approval_users?.map((u: any) => typeof u === 'string' ? u : (u.id || u)) || [];
           nextApprovers.forEach((id: string) => addNotification(id, "Approval Request", `${moduleName} ${refNum} requires your approval at Level ${newLevel}.`, "High"));
        } else {
           // In Progress
           const msg = `${moduleName} ${refNum} has been approved by ${approverName} at Level ${currentLevel}.`;
           superAdminIds.forEach(id => addNotification(id, "Approval Submitted", msg, "Medium"));
        }
      }

      const notificationsToInsert = Array.from(notificationMap.entries()).map(([userId, info]) => ({
        priority: info.priority,
        alert_type: info.alert_type,
        entity_id: request_id,
        message: info.message,
        status: "New",
        assign_to: userId,
        company_id: companyId,
        created_by: approver_id,
        is_active: true
      }));

      if (notificationsToInsert.length > 0) {
        const { error: notifError } = await supabase.from("system_notification").insert(notificationsToInsert);
        if (notifError) console.error("Error inserting notifications:", notifError);
      }
    } catch (notifError) {
      console.error("Error generating notifications:", notifError);
    }
    // --- End Generate Notifications ---

    return new Response(
      JSON.stringify({
        success: true,
        message: `Action recorded successfully. Final status: ${finalStatus}`,
        status: finalStatus
      }),
      {
        status: 200,
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


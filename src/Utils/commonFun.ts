import { supabase } from "./types/supabaseClient";

const asJsonArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

// Helper function to get local datetime in database format
const getLocalDateTime = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  // Format: YYYY-MM-DD HH:MM:SS.mmm
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

// Common function for load module permissions API integration
const loadModulePermissions = async (_appCode: string, moduleKey: string, userId: string) => {
  try {
    // 1. Get user details
    const { data: userData, error: userError } = await supabase
      .from('user_mgmt')
      .select(`
    id,
    role_id,
    company_id,
    role:role_id (
      name
    )
  `)
      .eq('id', userId)
      .single();

      const roleName = userData?.role?.name?.toLowerCase() || "";

const isAdmin =
  roleName === "super admin" ||
  roleName === "administrator";

    if (userError || !userData) {
      console.error("User not found:", userError);
      return null;
    }

    // 2. Get module details
    const { data: moduleData, error: moduleError } = await supabase
      .from('main_modules')
      .select('id')
      .eq('module_key', moduleKey)
      .single();

    if (moduleError || !moduleData) {
      console.error("Module not found:", moduleError);
      return null;
    }

    

    // 4. Fetch reference data for names
    const [{ data: actionsData }, { data: submodulesData }] = await Promise.all([
      supabase.from('available_actions').select('id, action_name'),
      supabase.from('available_submodules').select('id, submodule_name')
    ]);

    if (isAdmin) {
  return {
    permissions: (actionsData || []).map((action: any) => ({
      action_id: {
        actionName: action.action_name,
      },
      isAllowed: true,
    })),

    subModulePermissions: (submodulesData || []).map((sub: any) => ({
      sub_module_id: {
        subModuleName: sub.submodule_name,
      },
      isAllowed: true,
    })),
  };
}
// 3. Fetch permissions
    const { data: rolePerms } = await supabase
      .from('module_permissions')
      .select('*')
      .eq('company_id', userData?.company_id || '')
      .eq('module_id', moduleData.id)
      .eq('role_id', userData?.role_id || '')
      .is('user_id', null)
      .single();

    const { data: userPerms } = await supabase
      .from('module_permissions')
      .select('*')
      .eq('company_id', userData?.company_id || '')
      .eq('module_id', moduleData.id)
      .eq('user_id', userData.id)
      .single();
    const actionsMap = new Map((actionsData || []).map((a: any) => [a.id, a.action_name]));
    const submodulesMap = new Map((submodulesData || []).map((s: any) => [s.id, s.submodule_name]));

    // 5. Merge and format permissions
    const mergedPermissions = new Map();
    const mergedSubmodules = new Map();

    if (rolePerms) {
      asJsonArray<any>(rolePerms.permissions).forEach((p: any) => mergedPermissions.set(p.action_id, p.isAllowed));
      asJsonArray<any>(rolePerms.submodule_permissions).forEach((s: any) => mergedSubmodules.set(s.sub_module_id || s.submodule_id, s.isAllowed));
    }

    if (userPerms) {
      asJsonArray<any>(userPerms.permissions).forEach((p: any) => mergedPermissions.set(p.action_id, p.isAllowed));
      asJsonArray<any>(userPerms.submodule_permissions).forEach((s: any) => mergedSubmodules.set(s.sub_module_id || s.submodule_id, s.isAllowed));
    }

    const formattedPermissions = Array.from(mergedPermissions.entries()).map(([actionId, isAllowed]) => ({
      action_id: { actionName: actionsMap.get(actionId) },
      isAllowed
    }));

    const formattedSubmodules = Array.from(mergedSubmodules.entries()).map(([submoduleId, isAllowed]) => ({
      sub_module_id: { subModuleName: submodulesMap.get(submoduleId) },
      isAllowed
    }));

    return {
      permissions: formattedPermissions,
      subModulePermissions: formattedSubmodules
    };

  } catch (error) {
    console.error("Error loading module permissions:", error);
    return null;
  }
};

interface ApprovalRequestPayload {
  module_name: string;
  action_name: string;
  company_id: string;
  requested_by: string;
  action_payload: any;
  store_id?: string | null;
  entity_id?: string | null;
}

const initiateApprovalRequest = async (params: ApprovalRequestPayload) => {
  const { module_name, action_name, company_id, requested_by, action_payload, store_id, entity_id } = params;
  
  // 1. Get Module ID
  const { data: moduleData, error: moduleError } = await supabase
    .from('main_modules')
    .select('id, module_name, is_store_specific')
    .or(`module_name.eq.${module_name},module_key.eq.${module_name}`)
    .limit(1)
    .single();
  
  if (moduleError || !moduleData) throw new Error(`Could not find module: ${module_name}`);

  // 2. Get Action ID
  const { data: actionData, error: actionError } = await supabase
    .from('available_actions')
    .select('id')
    .eq('action_name', action_name)
    .single();
    
  if (actionError || !actionData) throw new Error(`Could not find action: ${action_name}`);

  // 3. Initiate Approval

  const { data: approvalResponse, error: invokeError } = await supabase.functions.invoke('approvals-initiate', {
    body: {
      module_id: moduleData.id,
      action_id: actionData.id,
      store_id: store_id || null,
      company_id,
      requested_by,
      action_payload,
      entity_id: entity_id || null
    }
  });
  
  if (invokeError) throw new Error('Failed to initiate approval: ' + invokeError.message);
  
  if (!approvalResponse?.success) {
     throw new Error(approvalResponse?.message || 'Approval initiation failed');
  }

  return approvalResponse;
};

const checkEntityLock = async (entity_id: string): Promise<boolean> => {
  if (!entity_id) return false;
  
  const { count, error } = await supabase
    .from('approval_requests' as any)
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity_id)
    .in('status', ['PENDING', 'IN_PROGRESS']);
    
  if (error) {
    console.error("Error checking entity lock:", error);
    return false; // Fail open or closed? Typically fail open if it's just a UI check, but fail closed is safer. For now, fail open so we don't block on network errors unnecessarily, but ideally Edge function enforces it.
  }
  
  return (count !== null && count > 0);
};

export { getLocalDateTime, loadModulePermissions, initiateApprovalRequest, checkEntityLock };

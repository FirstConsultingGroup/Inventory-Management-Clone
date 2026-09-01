// Utility to fetch and cache permissions for performance
import { supabase } from '@/Utils/types/supabaseClient';

const asJsonArray = <T,>(value: unknown): T[] => Array.isArray(value) ? (value as T[]) : [];
// Export ModuleKey here to avoid circular imports. This is the canonical list
// of module keys used across the app.
export type ModuleKey =
  | 'Inventory Dashboard'
  | 'Procurement Dashboard'
  | 'Sales Dashboard'
  | 'Supplier Management'
  | 'Store Management'
  | 'Purchase Order Management'
  | 'Inventory Management'
  | 'Sales Invoice'
  | 'Reports'
  | 'Purchase Order Approvals'
  | 'Returns Management'
  | 'Returns Eligible'
  | 'Category Master'
  | 'Customer Master'
  | 'Role Master'
  | 'Item Configurator'
  | 'Item Master'
  | 'Workflow Configuration'
  | 'Audit Trail'
  | 'Users'
  | 'Role Management'
  | 'Purchase Return Requests'
  | 'Purchase Requisitions'
  | 'Quotations'
  | 'Purchase Requisition Approvals'
  | 'Sales Returns'
  | 'Department Management'
  | 'Sales Return Approvals'
  | 'Location Master'
  | 'Administration'
  | 'Module and Access'
  | 'Manage Modules'
  // | 'Billing'
  | 'All Modules';

export const ALL_MODULES: ModuleKey[] = [
  'Inventory Dashboard',
  'Procurement Dashboard',
  'Sales Dashboard',
  'Supplier Management',
  'Store Management',
  'Purchase Order Management',
  'Inventory Management',
  'Sales Invoice',
  'Reports',
  'Purchase Order Approvals',
  'Returns Management',
  'Returns Eligible',
  'Category Master',
  'Customer Master',
  'Role Master',
  'Item Configurator',
  'Item Master',
  'Workflow Configuration',
  'Audit Trail',
  'Users',
  'Role Management',
  'Purchase Return Requests',
  'Purchase Requisitions',
  'Quotations',
  'Department Management',
  'Purchase Requisition Approvals',
  'Sales Returns',
  'Sales Return Approvals',
  'Location Master',
  'Administration',
  'Module and Access',
  'Manage Modules',
  'All Modules',
  // 'Billing',
];

export interface UserPermissions {
  roleId: string;
  permissions: Record<ModuleKey, boolean>;
  groupedModules?: any[];
}

const buildAllocatedPermissions = (
  moduleId: string,
  userPerms: any[],
  actionsMap: Map<string, string>
) => {
  const merged = new Map<string, boolean>();

  const up = userPerms.find((p: any) => p.module_id === moduleId);
  if (up) {
    asJsonArray<any>(up.permissions).forEach((p: any) => {
      const key = p.action_id?.toString();
      if (key) merged.set(key, p.isAllowed);
    });
  }

  return Array.from(merged.entries()).map(([actionId, isAllowed]) => ({
    action_id: { actionName: actionsMap.get(actionId) },
    isAllowed,
  }));
};

export const fetchUserPermissions = async (userId: string, companyId: string): Promise<UserPermissions | null> => {
  try {
    // Fetch user's role_id and uuid from user_mgmt
    const { data: userData, error: userError } = await supabase
      .from('user_mgmt')
      .select(`
      id,
      email,
      role_master!user_mgmt_role_id_fkey (
        id,
    name
      )
    `)
      .eq('id', userId)
      .eq('company_id', companyId)
      .single();

    if (userError || !userData?.role_master) {
      console.error('Error fetching user role:', userError);
      return null;
    }

    const roleId = userData.role_master.id || '';
    const userUuid = userData.id || '';

    const roleName = (userData.role_master.name || "").toLowerCase();

const isAdmin =
  roleName === "super admin" ||
  roleName === "superadmin" ||
  roleName === "administrator";

    // Fetch parent modules, main modules, permissions, and actions in parallel
    const [
      { data: parentModulesData },
      { data: mainModulesData },
      { data: userPermsData },
      { data: allActionsData },
    ] = await Promise.all([
      supabase.from('parent_modules').select('*').order('parent_order', { ascending: true }),
      supabase.from('main_modules').select('*').order('module_order', { ascending: true }),
      supabase.from('module_permissions').select('*').eq('user_id', userUuid),
      supabase.from('available_actions').select('id, action_name'),
    ]);

    const actionsMap = new Map(
      (allActionsData || []).map((a: any) => [a.id, a.action_name])
    );
    const moduleAccessActionId =
      allActionsData?.find((a) =>
        a.action_name?.toLowerCase().includes('module access')
      )?.id ?? null;

      

    const parentModules = parentModulesData || [];
    const mainModules = mainModulesData || [];
    const userPerms = userPermsData || [];

    const groupedModules: any[] = [];

    if (isAdmin) {
  const groupedModules = parentModules.map((parent: any) => {
    const modules = mainModules
      .filter((m: any) => m.parent_id === parent.id)
      .map((mod: any) => ({
        moduleKey: (mod.module_key || "").trim(),
        moduleName: mod.module_name,
        moduleRoute: mod.module_route,
        allocatedPermissions: (allActionsData || []).map((action: any) => ({
          action_id: {
            actionName: action.action_name,
          },
          isAllowed: true,
        })),
      }));
       // Cache permissions
  try {
    localStorage.setItem(
      "userPermissions",
      JSON.stringify({ roleId, permissions, groupedModules })
    );
  } catch (err) {
    console.warn("Failed to cache permissions:", err);
  }

    return {
      name: parent.module_name,
      moduleName: parent.module_name,
      modules,
    };
  });

  // Modules without parent
  const otherModules = mainModules
    .filter((m: any) => !m.parent_id)
    .map((mod: any) => ({
      moduleKey: (mod.module_key || "").trim(),
      moduleName: mod.module_name,
      moduleRoute: mod.module_route,
      allocatedPermissions: (allActionsData || []).map((action: any) => ({
        action_id: {
          actionName: action.action_name,
        },
        isAllowed: true,
      })),
    }));

  if (otherModules.length) {
    groupedModules.push({
      name: "Other",
      moduleName: "Other",
      modules: otherModules,
    });
  }

  const permissions = {} as Record<ModuleKey, boolean>;

  groupedModules.forEach((group: any) => {
    group.modules.forEach((mod: any) => {
      permissions[mod.moduleKey as ModuleKey] = true;
    });
  });

  return {
    roleId,
    permissions,
    groupedModules,
  };
}

    // Grouping modules
    parentModules.forEach((parent: any) => {
      const group = {
        name: parent.module_name,
        moduleName: parent.module_name,
        modules: [] as any[]
      };

      const children = mainModules.filter((m: any) => m.parent_id === parent.id);
      children.forEach((mod: any) => {
        let isAllowed = false;

        const up = userPerms.find((p: any) => p.module_id === mod.id);
        if (up) {
          const perm = asJsonArray<any>(up.permissions).find((p: any) => p.action_id === moduleAccessActionId);
          if (perm) {
             isAllowed = perm.isAllowed; // override
          }
        }

        if (isAllowed) {
          group.modules.push({
            moduleKey: (mod.module_key || '').trim(),
            moduleName: mod.module_name,
            moduleRoute: mod.module_route,
            allocatedPermissions: buildAllocatedPermissions(
              mod.id,
              userPerms,
              actionsMap
            ),
          });
        }
      });

      if (group.modules.length > 0) {
        groupedModules.push(group);
      }
    });

    // Handle "Other" category for modules without a parent
    const otherModules = mainModules.filter((m: any) => !m.parent_id);
    if (otherModules.length > 0) {
      const group = {
        name: 'Other',
        moduleName: 'Other',
        modules: [] as any[]
      };

      otherModules.forEach((mod: any) => {
        let isAllowed = true;

        const up = userPerms.find((p: any) => p.module_id === mod.id);
        if (up) {
          const perm = asJsonArray<any>(up.permissions).find((p: any) => p.action_id === moduleAccessActionId);
          if (perm) {
             isAllowed = perm.isAllowed;
          }
        }

        if (isAllowed) {
          group.modules.push({
            moduleKey: (mod.module_key || '').trim(),
            moduleName: mod.module_name,
            moduleRoute: mod.module_route,
            allocatedPermissions: buildAllocatedPermissions(
              mod.id,
              userPerms,
              actionsMap
            ),
          });
        }
      });

      if (group.modules.length > 0) {
        groupedModules.push(group);
      }
    }

    const permissions: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;


    // Transform API response to the expected permissions format
    if (Array.isArray(groupedModules)) {
      groupedModules.forEach((parentModule: any) => {
        if (Array.isArray(parentModule.modules)) {
          parentModule.modules.forEach((mod: any) => {
            if (mod.moduleKey) {
              permissions[mod.moduleKey as ModuleKey] = true;
            }
          });
        }
      });
    }

    // Cache permissions in localStorage
    try {
      localStorage.setItem('userPermissions', JSON.stringify({ roleId, permissions, groupedModules }));
    } catch (err) {
      console.warn('Failed to cache permissions:', err);
    }

    return { roleId, permissions, groupedModules };
  } catch (err) {
    console.error('Error in fetchUserPermissions:', err);
    return null;
  }
};

// Get cached permissions
export const getCachedPermissions = (): UserPermissions | null => {
  try {
    const cached = localStorage.getItem('userPermissions');
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.warn('Failed to retrieve cached permissions:', err);
    return null;
  }
};

// Clear cached permissions (e.g., on logout)
export const clearCachedPermissions = () => {
  try {
    localStorage.removeItem('userPermissions');
  } catch (err) {
    console.warn('Failed to clear cached permissions:', err);
  }
};
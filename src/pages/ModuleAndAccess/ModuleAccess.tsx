import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/Utils/types/supabaseClient"
import { AlertCircle, CheckCircleIcon, ChevronDown, ChevronRight, ChevronUp, Circle, Filter, Settings, ShieldCheck, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ViewUsersModal } from "./ViewUsersModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ManageWorkflowModal } from "./ManageWorkflowModal";
import { ModifyWorkflowModal } from "./ModifyWorkflowModal";
import { WorkflowConfig } from "../WorkflowConfig/WorkflowConfig";
import { Json } from "@/Utils/types/database.types";
import toast from "react-hot-toast";

interface ParentModuleProps {
    created_at: string;
    id: string;
    module_name: string | null;
    parent_order: number | null;
}

interface AvailableActionProps {
    action_id: string;
    requires_approval?: boolean;
}

interface ModuleDataProps {
    selected_submodules: any[];
    available_actions: Json[] | AvailableActionProps[];
    created_at: string;
    id: string;
    is_store_specific: boolean | null;
    module_key: string | null;
    module_name: string | null;
    module_order: number | null;
    module_route: string | null;
    parent_id: string | null;
}

interface ActionProps {
    action_id: string;
    isAllowed: boolean;
    requiredworkflow: boolean;
    action_name?: string;
}

interface SubModuleProps {
    sub_module_id: string;
    isAllowed: boolean;
}

interface PermissionDataProps {
    module_id: string;
    permissions: ActionProps[];
    submodule_permissions: SubModuleProps[] | null;
}

interface UserProps {
    email: string | null;
    first_name: string | null;
    id: string;
    last_name: string | null;
    role_id: string | null;
    role_name?: string;
    stores: Json | null;
}

interface GroupedSectionProps {
    signature: string;
    user_count: number;
    users: UserProps[];
    permissions_data: PermissionDataProps[];
}

interface ConfigWorkflowDataProps {
    selectedActions: ActionProps[];
    assignedUsers: UserProps[];
    userStores: string[];
    selectedModule: {
        module_id: string;
        module_name: string;
        is_store_specific: boolean;
    };
    isEditMode: boolean;
}

export const ModuleAccess = () => {

    const user = localStorage.getItem("userData");
    const userData = JSON.parse(user || '{}');
    const companyId = userData?.company_id || null;

    const [parentModules, setParentModules] = useState<ParentModuleProps[]>([]);
    const [modules, setModules] = useState<ModuleDataProps[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [users, setUsers] = useState<UserProps[]>([]);
    const [actions, setActions] = useState<{ id: string; action_name: string | null; }[]>([]);
    const [parentId, setParentId] = useState('all');
    const [moduleId, setModuleId] = useState('all');
    const [roleId, setRoleId] = useState(null);
    const [userId, setUserId] = useState<string>('all');
    const [roleName, setRoleName] = useState("");
    const [userName, setUserName] = useState("");
    const [isRolesOpen, setRolesOpen] = useState(false);
    const [isUsersOpen, setUsersOpen] = useState(false);

    const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
    const [showModuleAccess, setShowModuleAccess] = useState(true);

    const [initialPermissions, setInitialPermissions] = useState<any[]>([])
    const [groupedSections, setGroupedSections] = useState<GroupedSectionProps[]>([]);
    const [expandedGroup, setExpandedGroup] = useState<Set<number>>(new Set([0]));
    const [expandedParents, setExpandedParents] = useState<Set<string>>();
    const [expandedModules, setExpandedModules] = useState<Set<string>>();

    const [showUsersModal, setShowUsersModal] = useState(false);
    const [singleActionModal, setSingleActionModal] = useState(false);
    const [multipleActionModal, setMultipleActionModal] = useState(false);
    const [manageWorkflowModal, setManageWorkflowModal] = useState(false);
    const [modifyWorkflowModal, setModifyWorkflowModal] = useState(false);
    const [workflowConfigData, setWorkflowConfigData] = useState<any[]>([]);
    const [groupedUsers, setGroupedUsers] = useState<any[] | null>([]);
    const [loadPermission, setLoadPermission] = useState<boolean>(false);
    const [selectedAction, setSelectedAction] = useState<ActionProps | null>();
    const [selectedMultipleActions, setSelectedMultipleActions] = useState<ActionProps[]>([]);
    const [configWorkflowData, setConfigWorkflowData] = useState<ConfigWorkflowDataProps | null>(null);
    const [manageWorkflowData, setManageWorkflowData] = useState({});
    const [groupedAccessLevel,setGroupedAccessLevel] = useState<any[]>([]);
    const [modifyWorkflowData, setModifyWorkflowData] = useState({});
    const [loading, setLoading] = useState(false);
    const [filteredTree,setFilteredTree] = useState<any[]>([]);


    useEffect(() => {
        const fetchParentModules = async () => {
            try {
                const { data: parentModules, error } = await supabase
                    .from('parent_modules')
                    .select('*')
                    .order('parent_order');

                if (error) throw error;

                setParentModules(parentModules);
            } catch (error) {
                console.log("Error fetching parent modules", error)
            }
        }

        const fetchModules = async () => {
            try {
                let query = supabase
                    .from('main_modules')
                    .select('*')
                    .order('module_order');

                if (parentId !== "all") {
                    query = query.eq('parent_id', parentId)
                }

                const { data: modules, error } = await query;

                if (error) throw error;

                let moduleData = [];
                for (const m of modules) {
                    const subModules = typeof m.selected_submodules === 'string' ? JSON.parse(m.selected_submodules) : m.selected_submodules;
                    let selectedSubModules: any = [];
                    if (subModules.length > 0) {
                        const subModulesArray = subModules.flatMap((sub: any) => sub.subModule_id)

                        const { data } = await supabase
                            .from('available_submodules')
                            .select('id,submodule_name')
                            .in('id', subModulesArray);

                        if (data) {
                            selectedSubModules = data;
                        }
                    }
                    moduleData.push({ ...m, selected_submodules: selectedSubModules })
                }
                setModules(moduleData as ModuleDataProps[]);
            } catch (error) {
                console.log("Error fetching modules", error)
            }
        }


        fetchParentModules();
        fetchModules();
    }, [parentId])

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                let query = supabase
                    .from('role_master')
                    .select('*')
                    .eq('is_active', true)
                    .neq('name', 'Super Admin')
                    .eq('company_id', companyId);

                if (roleName.trim()) {
                    query = query.ilike('name', `%${roleName}%`)
                }

                const { data: roles, error } = await query;

                if (error) throw error;

                setRoles(roles);
            } catch (error) {
                console.log("Error fetching roles", error)
            }
        }

        fetchRoles();
    }, [roleName])

    useEffect(() => {
        const fetchUsers = async () => {
            if (!roleId) return;
            try {
                let query = supabase
                    .from('user_mgmt')
                    .select('*')
                    .eq('is_active', true)
                    .eq('company_id', companyId);

                if (roleId) {
                    query = query.eq('role_id', roleId)
                }
                if (userName.trim()) {
                    query = query.or(`first_name.ilike.%${userName}%,last_name.ilike.%${userName}%`)
                }

                const { data: users, error } = await query;

                if (error) throw error;

                setUsers(users);
            } catch (error) {
                console.log("Error fetching users", error)
            }
        }

        fetchUsers();

    }, [roleId, userName])

    useEffect(() => {
        const fetchActions = async () => {
            try {
                const { data: actions, error } = await supabase
                    .from('available_actions')
                    .select('id,action_name');

                if (error) throw error;

                setActions(actions);
            } catch (error) {
                console.log("Error fetching parent modules", error)
            }
        }

        fetchActions();
    }, [])

    useEffect(() => {

        const fetchWorkflowConfig = async () => {
            if (!roleId) return;
            try {
                let query = supabase
                    .from('workflow_config')
                    .select('*')
                    .eq('is_active', true)
                    .eq('company_id', companyId);

                const userIds = users.flatMap(u => u.id);

                if (userId == 'all') {
                    query = query.in('assigned_to', userIds)
                } else {
                    query = query.eq('assigned_to', userId)
                }

                const { data, error } = await query;

                if (error) throw error;

                if (data) {
                    setWorkflowConfigData(data);
                }

            } catch (error) {
                console.log("Error fetching workflow Data", error)
            }
        }
        fetchWorkflowConfig();

    }, [roleId, userId, groupedSections])



    useEffect(() => {
        if (expandedGroup.size === 0 && parentModules.length === 0) return;

        const defaultExpandedparents = Array.from(expandedGroup).flatMap((grpIndex) => {
            return parentModules.map((_, parentIndex) =>
                `${grpIndex},${parentIndex}`
            )
        })

        const result = new Set(defaultExpandedparents);

        setExpandedParents(result);

    }, [parentModules, groupedSections])


    useEffect(() => {
      let filteredtree=[];
        if (parentId !== "all" && moduleId == "all") {
            const parentModule = parentModules.find((p) => p.id === parentId)
                filteredtree.push({
                    parentModule: parentModule?.module_name,
                    parentId: parentModule?.id,
                    modules: modules
                })
    
        } else if(moduleId !== "all"){
            const module = modules.find((m)=>m.id === moduleId)
            const parentModule = parentModules.find((p) => p.id === module?.parent_id)
                filteredtree.push({
                    parentModule: parentModule?.module_name,
                    parentId: parentModule?.id,
                    modules: [module]
                })
        } else {
            parentModules.map((p) => {
                const Modules = modules.filter((m) => m.parent_id === p.id)
    
                filteredtree.push({
                    parentModule: p.module_name,
                    parentId: p.id,
                    modules: Modules
                })
            })
        }

        setFilteredTree(filteredtree)
    }, [groupedSections])
    

    useEffect(() => {
       const updatedAccesslevel = groupedSections.map(grp => {
             const permissions = grp.permissions_data;
             let permittedActionCount:number =0;
             let permittedSubModuleCount:number =0;
             let totalPermissionCount:number = 0;
            filteredTree.forEach(item => {
                item.modules.forEach((m:any)=>{
                let modulePermissionCount = m.available_actions.length + m.selected_submodules.length;
                totalPermissionCount = totalPermissionCount + modulePermissionCount
                const modulePermission = permissions?.flatMap((module) => module).filter((mod) => mod.module_id === m.id);
                let permittedActions: any[] = [];
                let permittedSubModules: any[] = [];
                if (modulePermission && modulePermission.length > 0) {
                permittedActions = modulePermission[0]?.permissions.map(actions => actions)
                if (modulePermission[0]?.submodule_permissions) {
                 permittedSubModules = modulePermission[0]?.submodule_permissions
                }
                }
                permittedActionCount = permittedActionCount + permittedActions.length;
                permittedSubModuleCount = permittedSubModuleCount + permittedSubModules.length;
            })
        });
        let grantedPermissions = permittedActionCount + permittedSubModuleCount;
        let deniedPermissions = totalPermissionCount - grantedPermissions;
        let accessPercent = Math.round((grantedPermissions/totalPermissionCount) * 100)
        return {granted: grantedPermissions,denied: deniedPermissions, accessPercent: accessPercent};
    })
    setGroupedAccessLevel(updatedAccesslevel)
    }, [groupedSections]);

    

    const fetchGroupedModuleAccess = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase.rpc("get_grouped_module_access", {
                p_company_id: companyId,
                p_role_ids: roleId ? [roleId] : [],
                p_user_id: userId !== "all" ? userId : undefined,
            })

            if (error) throw error;
            console.log("fetchGroupedModuleAccess", data)
            const sections = data as unknown as GroupedSectionProps[];
            setGroupedSections(sections);

            const InitialPermissionsList: any[] = [];
            sections.forEach((group) => {
                const users = group.users as UserProps[] || [];
                const permissions = group.permissions_data as PermissionDataProps[] || [];

                users.forEach((user) => {
                    permissions.forEach((prm) => {
                        InitialPermissionsList.push({
                            user_id: user.id,
                            module_id: prm.module_id,
                            permissions: prm.permissions,
                            submodule_permissions: prm.submodule_permissions
                        })
                    });
                })
            });
            setInitialPermissions(InitialPermissionsList);

            setExpandedGroup(new Set([0]));
            setExpandedParents(new Set());
            setExpandedModules(new Set());
            setLoadPermission(false)
            setTimeout(() => {
                setLoading(false)
            }, 1000);

        } catch (error) {
            console.log('Error fetching grouped module access', error)
        }
    }

    useEffect(() => {
        if (loadPermission) {
            fetchGroupedModuleAccess();
        }
    }, [userId])

    function handleToggleModuleAccess(signature: string, moduleId: string, actionId?: string) {
        if (!actionId || !moduleId) return;
        let permissionData = groupedSections.filter(grp => grp.signature === signature).flatMap(sec => sec.permissions_data)
        let newPermissionData: any[] = [];
        if (permissionData !== null) {
            let module = permissionData.find(prm => prm?.module_id === moduleId);
            if (module) {
                const isPermitted = module.permissions?.find(prm => prm.action_id === actionId)
                if (isPermitted) {
                    newPermissionData = permissionData.filter(prm => prm?.module_id !== moduleId)
                }
            } else {
                const permission = { action_id: actionId, isAllowed: true, requiredworkflow: false }
                permissionData.push({ module_id: moduleId, permissions: [permission], submodule_permissions: [] })
                newPermissionData = permissionData;
            }
        } else {
            const permission = { action_id: actionId, isAllowed: true, requiredworkflow: false }
            newPermissionData.push({ module_id: moduleId, permissions: [permission], submodule_permissions: [] })
        }
        const newSectionData = groupedSections.map((section) => section.signature === signature ? { ...section, permissions_data: newPermissionData } : section)
        setGroupedSections(newSectionData)
    }

    function handleToggleAction(signature: string, moduleId: string, actionId?: string | null, subModuleId?: string | null) {
        let permissionData = groupedSections.filter(grp => grp.signature === signature).flatMap(sec => sec.permissions_data)
        let module = permissionData.find(prm => prm.module_id === moduleId)
        if (module) {
            if (actionId) {
                const isPermitted = module.permissions?.find(prm => prm.action_id === actionId)
                if (isPermitted) {
                    const permissions = module.permissions.filter(prm => prm.action_id !== actionId)
                    module = { ...module, permissions: permissions }
                } else {
                    module.permissions.push({ action_id: actionId, isAllowed: true, requiredworkflow: false })
                }
            } else if (subModuleId) {
                if (module.submodule_permissions) {
                    const isPermitted = module.submodule_permissions.find(prm => prm.sub_module_id === subModuleId)
                    if (isPermitted) {
                        const submodule_permissions = module.submodule_permissions.filter(prm => prm.sub_module_id !== subModuleId)
                        module = { ...module, submodule_permissions: submodule_permissions }
                    } else {
                        module.submodule_permissions.push({ isAllowed: true, sub_module_id: subModuleId })
                    }
                } else {
                    let submodule_permissions = [{ isAllowed: true, sub_module_id: subModuleId }];
                    module = { ...module, submodule_permissions: submodule_permissions }
                }
            }
        }
        const newPermissionData = permissionData.map((prm) => prm.module_id === module?.module_id ? module : prm)
        const newSectionData = groupedSections.map((section) => section.signature === signature ? { ...section, permissions_data: newPermissionData } : section)
        setGroupedSections(newSectionData as GroupedSectionProps[])
    }

    function handleToggleAllAction(signature: string, moduleId: string, actionId?: string[] | null, subModuleId?: string[] | null) {
        if (!actionId || !moduleId) return;
        let permissionData = groupedSections.filter(grp => grp.signature === signature).flatMap(sec => sec.permissions_data);
        let newPermissionData: any[] = [];

        if (permissionData[0] !== null) {
            let module = permissionData.find(prm => prm.module_id === moduleId)
            if (module) {
                if (module.permissions.length === actionId.length && ((module.submodule_permissions?.length === subModuleId?.length) || (typeof (module.submodule_permissions) != typeof (subModuleId)))) {
                    permissionData = permissionData.filter(prm => prm.module_id !== moduleId)
                } else {
                    for (const id of actionId) {
                        const isPermitted = module.permissions?.find(prm => prm.action_id === id)
                        if (!isPermitted) {
                            module.permissions?.push({ action_id: id, isAllowed: true, requiredworkflow: false })
                        }
                    }
                    if (subModuleId) {
                        const CurrentSubPermissions = [...(module?.submodule_permissions || [])];
                        for (const id of subModuleId) {
                            const isPermitted = CurrentSubPermissions.some(prm => prm.sub_module_id === id)
                            if (!isPermitted) {
                                CurrentSubPermissions.push({ isAllowed: true, sub_module_id: id })
                            }
                        }
                        module = { ...module, submodule_permissions: CurrentSubPermissions }
                    }
                }
            } else {
                const permissions = actionId.map((action) => {
                    return { action_id: action, isAllowed: true, requiredworkflow: false }
                })

                const submodule_permissions = subModuleId?.map((id) => {
                    return { isAllowed: true, sub_module_id: id }
                })

                permissionData.push({
                    module_id: moduleId, permissions: permissions,
                    submodule_permissions: submodule_permissions ? submodule_permissions : []
                })
            }
            newPermissionData = permissionData.map((prm) => prm.module_id === module?.module_id ? module : prm)
        } else {
            const permissions = actionId.map((action) => {
                return { action_id: action, isAllowed: true, requiredworkflow: false }
            })

            const submodule_permissions = subModuleId?.map((id) => {
                return { isAllowed: true, sub_module_id: id }
            })

            newPermissionData.push({
                module_id: moduleId, permissions: permissions,
                submodule_permissions: submodule_permissions ? submodule_permissions : []
            })
        }
        const newSectionData = groupedSections.map((section) => section.signature === signature ? { ...section, permissions_data: newPermissionData } : section)
        setGroupedSections(newSectionData)
    }


    function toggleExpandedSection(index: number) {
        setExpandedGroup(prev => {
            const expandedIndexes = new Set(prev);

            if (expandedIndexes.has(index)) {
                expandedIndexes.delete(index)
            } else {
                expandedIndexes.add(index)
            }

            return expandedIndexes;
        })

        let prevParentIndexes = new Set(expandedParents)
        const updatedIndexes = Array.from(prevParentIndexes).filter((item) => !item.startsWith(String(index)))

        const newExpandedparents = parentModules.map((_, parentIndex) =>
            `${index},${parentIndex}`
        )
        setExpandedParents(new Set([...updatedIndexes, ...newExpandedparents]));
    }

    function toggleExpandedParent(grpIndex: number, parentIndex: number) {
        const key = `${grpIndex},${parentIndex}`;

        setExpandedParents(prev => {
            const prevIndexes = new Set(prev)

            if (prevIndexes.has(key)) {
                prevIndexes.delete(key)
            } else {
                prevIndexes.add(key)
            }

            return prevIndexes;
        })

        setExpandedModules(prev => {
            const prevIndexes = new Set(prev)

            const updatedIndexes = Array.from(prevIndexes).filter((item) => !item.startsWith(key))
            return new Set(updatedIndexes)
        })
    }

    function toggleExpandedModule(grpIndex: number, parentIndex: number, moduleIndex: number) {
        const key = `${grpIndex},${parentIndex},${moduleIndex}`;

        setExpandedModules(prev => {
            const prevIndexes = new Set(prev)

            if (prevIndexes.has(key)) {
                prevIndexes.delete(key)
            } else {
                prevIndexes.add(key)
            }

            return prevIndexes;
        })
    }


    let selectedParent;
    let selectedModule;
    let selectedRole;
    let selectedUser;

    if (parentModules && parentId) {
        selectedParent = parentId != "all" ? parentModules.filter((parent) => parent.id === parentId).map((p) => p.module_name) : "All Parent Modules";
    }
    if (modules && moduleId) {
        selectedModule = moduleId != "all" ? modules.filter((module) => module.id === moduleId).map((m) => m.module_name) : "All Modules";
    }
    if (users && userId) {
        selectedUser = userId != "all" ? new Set(users.filter((user) => user.id === userId).map((u) => (u.first_name + (' ') + u.last_name))) : "All Users";
    }
    if (roles && roleId) {
        selectedRole = roleId != "all" ? roles.filter((role) => role.id === roleId).map((r) => r.name) : "All Roles";
    }

    const activeState = roleId && userId && groupedSections.length > 0;

    const flattenGroupSections = () => {
        const currentPermissionsList: any[] = [];
        groupedSections.forEach((group) => {
            const users = group.users as UserProps[] || [];
            const permissions = group.permissions_data as PermissionDataProps[] || [];

            users.forEach((user) => {
                permissions.forEach((prm) => {
                    const moduleData = modules.find(m => m.id === prm.module_id)
                    currentPermissionsList.push({
                        user_id: user.id,
                        module_id: prm.module_id,
                        parentmodule_id: moduleData?.parent_id,
                        permissions: prm.permissions,
                        submodule_permissions: prm.submodule_permissions
                    })
                });
            })
        });

        return currentPermissionsList;
    }

    const handleSaveChanges = async () => {
        try {
            setLoading(true)
            const { data: dbRecords, error: dbRecordsError } = await supabase
                .from('module_permissions')
                .select('id,user_id,module_id')
                .eq('company_id', companyId);

            if (dbRecordsError) throw dbRecordsError;

            const roleBasedUserIds = users.flatMap(user => user.id)

            const { data: existingWorkflowData, error: workflowError } = await supabase
                .from('workflow_config')
                .select('module_id,action_id,assigned_to,is_active')
                .in('assigned_to', roleBasedUserIds)
                .eq('company_id', companyId)

            if (workflowError) throw workflowError;

            const currentPermissions = flattenGroupSections();
            const upserts: any[] = [];
            let WorkflowsToDeactivate: any[] = [];
            let WorkflowsToActivate: any[] = [];

            currentPermissions.forEach((currentItem) => {
                const matchingRecord = dbRecords.find((item) =>
                    item.user_id === currentItem.user_id && item.module_id === currentItem.module_id
                );
                if (matchingRecord) {
                    upserts.push({ ...currentItem, id: matchingRecord.id || undefined })
                } else {
                    upserts.push(currentItem)
                }
            })


            currentPermissions.forEach((currentItem) => {
                const oldItem = initialPermissions.find((old) => old.user_id === currentItem.user_id && old.module_id === currentItem.module_id)
                let addedActionIds: any[] =[];
                let removedActionIds: any[]=[];
                if(oldItem){
                    const oldActionIds: any[] = oldItem?.permissions.map((prm: any) => prm.action_id) || [];
                    const currentActionIds: any[] = currentItem.permissions.map((prm: any) => prm.action_id) || [];

                    removedActionIds = oldActionIds.filter(id => !currentActionIds.includes(id));
                    addedActionIds = currentActionIds.filter(id => !oldActionIds.includes(id));
                }else{
                    addedActionIds = currentItem.permissions.map((prm: any) => prm.action_id) || [];
                }

                if (removedActionIds.length > 0) {
                    const activeWorkflows = existingWorkflowData.filter(w =>
                        w.module_id === currentItem?.module_id &&
                        w.assigned_to === currentItem?.user_id &&
                        removedActionIds.includes(w.action_id) &&
                        w.is_active === true
                    )

                    if (activeWorkflows.length > 0) {
                        activeWorkflows.forEach((workflow) => {
                            const existing = WorkflowsToDeactivate.find(wf => wf.moduleId === workflow.module_id && wf.actionId === workflow.action_id)
                            if (existing) {
                                existing.userIds = Array.from(new Set([...existing.userIds, workflow.assigned_to]))
                            } else {
                                WorkflowsToDeactivate.push({
                                    moduleId: workflow.module_id,
                                    actionId: workflow.action_id,
                                    userIds: [workflow.assigned_to]
                                })
                            }
                        })
                    }
                }

                if (addedActionIds.length > 0) {
                    const inactiveWorkflows = existingWorkflowData.filter(w =>
                        w.module_id === currentItem?.module_id &&
                        w.assigned_to === currentItem?.user_id &&
                        addedActionIds.includes(w.action_id) &&
                        w.is_active === false
                    )

                    if (inactiveWorkflows.length > 0) {
                        inactiveWorkflows.forEach((workflow) => {
                            const existing = WorkflowsToActivate.find(wf => wf.moduleId === workflow.module_id && wf.actionId === workflow.action_id)
                            if (existing) {
                                existing.userIds = Array.from(new Set([...existing.userIds, workflow.assigned_to]))
                            } else {
                                WorkflowsToActivate.push({
                                    moduleId: workflow.module_id,
                                    actionId: workflow.action_id,
                                    userIds: [workflow.assigned_to]
                                })
                            }
                        })
                    }
                }
            })

            const deletes: any[] = [];
            initialPermissions.forEach((oldItem) => {
                const stillExists = currentPermissions.some((item) =>
                    item.user_id === oldItem.user_id && item.module_id === oldItem.module_id
                )
                if (!stillExists) {
                    const matchingRecord = dbRecords.find((item) =>
                        item.user_id === oldItem.user_id && item.module_id === oldItem.module_id
                    );
                    deletes.push(matchingRecord?.id)
                }
            })

            deletes.forEach((recordId) => {
                const deletedRecord = dbRecords.find(r => r.id === recordId);

                const activeWorkflows = existingWorkflowData.filter(w =>
                    w.module_id === deletedRecord?.module_id &&
                    w.assigned_to === deletedRecord?.user_id &&
                    w.is_active === true
                )
                if (activeWorkflows.length > 0) {
                    activeWorkflows.forEach((workflow) => {
                        const existing = WorkflowsToDeactivate.find(wf => wf.moduleId === workflow.module_id && wf.actionId === workflow.action_id)
                        if (existing) {
                            existing.userIds = Array.from(new Set([...existing.userIds, workflow.assigned_to]))
                        } else {
                            WorkflowsToDeactivate.push({
                                moduleId: workflow.module_id,
                                actionId: workflow.action_id,
                                userIds: [workflow.assigned_to]
                            })
                        }
                    })
                }
            })

            const ActivatePayload = {
                company_id: companyId,
                upserts: upserts.map(item =>
                    ({ ...item, submodule_permissions: item.submodule_permissions ?? [] })),
                deletes: deletes,
                workflow_updates: WorkflowsToActivate,
                is_active: true
            }

            const { data: ActivateData, error: ActivateError } = await supabase.rpc("bulk_update_module_permissions", {
                p_payload: ActivatePayload
            })

            if (ActivateError) throw ActivateError;

            const DeActivatePayload = {
                company_id: companyId,
                upserts: [],
                deletes: [],
                workflow_updates: WorkflowsToDeactivate,
                is_active: false
            }

            const { data: DeActivateData, error: DeActivateError } = await supabase.rpc("bulk_update_module_permissions", {
                p_payload: DeActivatePayload
            })

            if (DeActivateError) throw DeActivateError;

            if (ActivateData && DeActivateData) {
                toast.success("Permissions Saved Successfully");
                setInitialPermissions([])
                fetchGroupedModuleAccess();
            }

        } catch (error) {
            console.log("Error saving permission changes", error);
        } finally {
            setLoading(false)
        }
    }

    const handleSetWorkflowConfig = () => {
        handleSaveChanges();
        setLoading(true)
        setTimeout(() => {

            setLoading(false);
            setShowModuleAccess(false);
            setShowWorkflowConfig(true);
        }, 1000);
    }

    if (showModuleAccess) {
        return (
            <>
                <div className="p-6">
                    <div className="mx-auto max-w-7xl space-y-6">
                        <Card className="min-h-[85vh] shadow-sm">
                            <CardHeader className="rounded-t-lg border-b pb-6">
                                <div className="flex items-center space-x-3 p-2">
                                    <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                                        <ShieldCheck className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                            Module & Access
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Manage modules and access permissions here.
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 mx-2">
                                <div className="mb-6 bg-gray-50 border rounded-md p-4 space-y-4">
                                    <div className=" flex gap-2 items-center">
                                        <Filter className="h-4 w-4 text-gray-500" />
                                        <span className="text-gray-700 font-semibold text-sm">Select Permission Scope</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="space-y-3 w-full">
                                            <label className="text-xs ps-1">Parent Modules</label>
                                            <Select
                                                value={parentId}
                                                onValueChange={(value) => {
                                                    setParentId(value);
                                                    setModuleId('all')
                                                }}
                                            >
                                                <SelectTrigger className="w-full bg-white">
                                                    <SelectValue placeholder="Filter by parent module" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Parent Modules</SelectItem>
                                                    {parentModules.map((parent) => (
                                                        <SelectItem key={parent.id} value={parent.id}>
                                                            {parent.module_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3 w-full">
                                            <label className="text-xs ps-1">Modules</label>
                                            <Select
                                                value={moduleId}
                                                onValueChange={(value) => {
                                                    setModuleId(value);
                                                }}
                                            >
                                                <SelectTrigger className="w-full bg-white">
                                                    <SelectValue placeholder="Filter by module" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Modules</SelectItem>
                                                    {modules.map((module) => (
                                                        <SelectItem key={module.id} value={module.id}>
                                                            {module.module_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3 w-full">
                                            <label className="text-xs ps-1">Roles <span className="text-red-600">*</span></label>
                                            <div>
                                                <Popover open={isRolesOpen} onOpenChange={setRolesOpen}>
                                                    <PopoverTrigger className="rounded-md border w-full bg-white flex justify-start items-center py-1.5 px-2">
                                                        <span className={`text-sm p-0.5 ${roleId ? '' : 'text-gray-500'} `}>{roleId ? selectedRole : "Select Role"}</span>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="p-0 rounded-md">
                                                        <div className="bg-white text-sm rounded-b-md">
                                                            <div className="bg-gray-100 p-2 border-b">
                                                                <Input className="bg-white" placeholder="Search role.." value={roleName} onChange={(e) => {
                                                                    setRoleName(e.target.value)
                                                                }} />
                                                            </div>
                                                            <div className="flex flex-col p-2 ">
                                                                {roles.length > 0 ? roles.slice(0, 5).map((role) => {

                                                                    return (
                                                                        <span key={role.id} onClick={() => {
                                                                            setRolesOpen(false);
                                                                            setRoleId(role.id);
                                                                            setUserId('all')
                                                                        }} className={`w-full flex justify-start items-center px-3 py-2 rounded-lg ${role.id === roleId ? 'text-blue-500 bg-blue-50 font-semibold' : 'text-gray-700'} hover:bg-gray-50`}>{role.name}</span>
                                                                    )
                                                                }) : (
                                                                    <span className="flex justify-center items-center py-4 text-gray-600">No matching roles found</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                        <div className="space-y-3 w-full">
                                            <label className="text-xs ps-1">Users</label>
                                            <div>
                                                <Popover open={isUsersOpen} onOpenChange={setUsersOpen}>
                                                    <PopoverTrigger disabled={!roleId} className="rounded-md border w-full bg-white flex justify-start items-center py-1.5 px-2">
                                                        <span className={`text-sm p-0.5 ${!roleId ? 'text-gray-400 cursor-not-allowed' : userId ? '' : 'text-gray-600'} `}>{!roleId ? 'Please select a role' : userId ? selectedUser : "Select User"}</span>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="p-0 rounded-md">
                                                        <div className="bg-white text-sm rounded-b-md">
                                                            <div className="bg-gray-100 p-2 border-b">
                                                                <Input className="bg-white" placeholder="Search user.." value={userName} onChange={(e) => {
                                                                    setUserName(e.target.value)
                                                                }} />
                                                            </div>
                                                            <div className="flex flex-col p-2">
                                                                <span onClick={() => {
                                                                    setUsersOpen(false);
                                                                    setUserId('all');
                                                                }} className={`w-full flex justify-start items-center px-3 py-2 rounded-lg ${userId == 'all' ? 'text-blue-500 bg-blue-50 font-semibold' : 'text-gray-700'} hover:bg-gray-50`}>All Users</span>
                                                                {users.length > 0 ? users.slice(0, 5).map((user) => {

                                                                    return (
                                                                        <span key={user.id} onClick={() => {
                                                                            setUsersOpen(false);
                                                                            setUserId(user.id);
                                                                        }} className={`w-full flex justify-start items-center px-3 py-2 rounded-lg ${user.id === userId ? 'text-blue-500 bg-blue-50 font-semibold' : 'text-gray-700'} hover:bg-gray-50`}>{user.first_name}{' '}{user.last_name}</span>
                                                                    )
                                                                }) : (
                                                                    <span className="flex justify-center items-center py-4 text-gray-600">No matching users found</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                        <div className="w-[70%] h-full flex items-center mt-5 justify-start">
                                            <Button
                                                onClick={() => fetchGroupedModuleAccess()}
                                                disabled={loading}
                                                className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white w-full"
                                            >
                                                {loading ? 'Loading' : 'Load Permissions'}
                                                {loading && (
                                                    <span className="border-t-2 border-l-2 rounded-full animate-spin h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {activeState && (

                                    <div className="p-5 mb-5 flex items-center justify-between space-x-4 gap-4 bg-blue-50 border rounded-md">
                                        <div className="flex flex-col w-full items-start">
                                            <span className="uppercase text-xs text-gray-500 font-semibold">parent module</span>
                                            <span className="font-semibold">{selectedParent}</span>
                                        </div>
                                        <div className="flex flex-col w-full items-start">
                                            <span className="uppercase text-xs text-gray-500 font-semibold">module</span>
                                            <span className="font-semibold">{selectedModule}</span>
                                        </div>
                                        <div className="flex flex-col w-full items-start">
                                            <span className="uppercase text-xs text-gray-500 font-semibold">role</span>
                                            <span className="font-semibold">{selectedRole}</span>
                                        </div>
                                        <div className="flex flex-col w-full items-start">
                                            <span className="uppercase text-xs text-gray-500 font-semibold">user</span>
                                            <span className="font-semibold">{selectedUser}</span>
                                        </div>
                                    </div>
                                )}
                                {loading ? (
                                    <div className="max-h-50 flex justify-center items-center gap-3 pt-8">
                                        <span className="border-t-2 border-l-2 border-gray-500 rounded-full animate-spin h-5 w-5" /> <span className="text-gray-500">Loading permissions...</span>
                                    </div>
                                ) : (
                                    <>
                                        {groupedSections.length > 0 ? (
                                            <>
                                                <div className="space-y-3 py-3">
                                                    <div>
                                                        {groupedSections.length > 1 && (
                                                            <div>
                                                                <label className="text-xl font-semibold text-gray-700">Grouped by module permissions and stores</label>
                                                            </div>
                                                        )}
                                                        {groupedSections.map((grp, index) => {
                                                            const multipleUsers = grp.user_count > 1;
                                                            let user;
                                                            if (!multipleUsers) {
                                                                user = grp.users[0]
                                                            }
                                                            const isGroupOpen = expandedGroup.has(index);
                                                            const permissions = grp.permissions_data;
                                                            const accessLevel = groupedAccessLevel[index];

                                                            return (
                                                                <div key={index} className="py-2">
                                                                    <Collapsible
                                                                        open={isGroupOpen}
                                                                        onOpenChange={() => toggleExpandedSection(index)}
                                                                        className="flex w-full flex-col gap-2"
                                                                    >
                                                                        <CollapsibleTrigger asChild>
                                                                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-md">
                                                                                <div className="flex items-start gap-3">
                                                                                    {multipleUsers ? (
                                                                                        <Users className="h-10 w-10 p-2 text-green-500 bg-green-100 rounded-md" />
                                                                                    ) : (
                                                                                        <User className="h-10 w-10 p-2 text-green-500 bg-green-100 rounded-md" />
                                                                                    )}
                                                                                    <div className="flex flex-col items-start gap-1">
                                                                                        <h4 className="text-sm font-semibold text-gray-700">{multipleUsers ? `Group No. ${index + 1}` : user?.first_name + (' ') + user?.last_name}</h4>
                                                                                        <span className="text-xs text-gray-500 font-semibold">{multipleUsers ? (
                                                                                            <span onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                setShowUsersModal(true);
                                                                                                setGroupedUsers(grp.users);
                                                                                            }} className="text-blue-500 hover:underline hover:text-blue-600 cursor-pointer">View Users</span>
                                                                                        ) : user?.email}</span>
                                                                                    </div>
                                                                                    <span className="bg-green-100 text-green-700 font-semibold text-xs mt-0.5 px-3 rounded-lg py-1">{grp.users.length}{' '}users</span>
                                                                                </div>
                                                                                <Button variant="ghost" size="icon" className="size-8 ">
                                                                                    {isGroupOpen ? (
                                                                                        <ChevronUp />
                                                                                    ) : (
                                                                                        <ChevronDown />
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        </CollapsibleTrigger>
                                                                        <CollapsibleContent>
                                                                            <div className="rounded-md border p-4 space-y-4 mx-1">
                                                                                <div className="flex items-center justify-end">

                                                                                    <div className="w-[52%] grid grid-cols-[30%_68%] gap-3">
                                                                                        <div className=" text-xs font-semibold text-gray-600 border px-2 py-1 rounded-md shadow"><span className=" text-green-600 mr-2">Action</span>Requires Workflow</div>
                                                                                        <div className="flex gap-2 items-center text-xs border px-2 py-1 rounded-md shadow">
                                                                                            <span className="items-center uppercase text-[12px] text-gray-500 font-semibold">access level : </span>
                                                                                            <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 py-0 text-[11px]">
                                                                                              {accessLevel.granted}  granted
                                                                                            </Badge>
                                                                                            <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 py-0 text-[11px]">
                                                                                               {accessLevel.denied} denied
                                                                                            </Badge>
                                                                                            <Progress value={accessLevel.accessPercent} className="max-w-[90px] h-1.5" /><span className="text-blue-800 font-bold">{accessLevel.accessPercent}%</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="rounded-md shadow border overflow-hidden">
                                                                                    <Table>
                                                                                        <TableHeader>
                                                                                            <TableRow className="text-md bg-gray-50">
                                                                                                <TableHead className="w-[250px] ps-4 text-gray-600">Parent modules & Sub modules</TableHead>
                                                                                                <TableHead className="flex justify-start items-center text-gray-700">Permissions</TableHead>
                                                                                            </TableRow>
                                                                                        </TableHeader>
                                                                                        <TableBody>
                                                                                            {filteredTree.length > 0 && (
                                                                                                filteredTree.map((item, i) => {
                                                                                                    const key = `${index},${i}`;
                                                                                                    const expandedParent = expandedParents?.has(key);

                                                                                                    return (
                                                                                                        <>
                                                                                                            <TableRow key={i} className="bg-gray-100 border hover:bg-gray-200">
                                                                                                                <TableCell colSpan={2}>
                                                                                                                    <div onClick={() => toggleExpandedParent(index, i)} className="flex justify-start items-center gap-2 ps-2 py-1 text-gray-800">
                                                                                                                        {expandedParent ? (
                                                                                                                            <ChevronDown size={16} />
                                                                                                                        ) : (
                                                                                                                            <ChevronRight size={16} />
                                                                                                                        )}
                                                                                                                        <span className="font-semibold">{item.parentModule}</span>
                                                                                                                    </div>
                                                                                                                </TableCell>
                                                                                                            </TableRow>
                                                                                                            {expandedParent && (
                                                                                                                item.modules.map((m:any, moduleIndex:number) => {
                                                                                                                    let expandedModule;
                                                                                                                    if (m.selected_submodules.length > 0) {

                                                                                                                        const key = `${index},${i},${moduleIndex}`;
                                                                                                                        expandedModule = expandedModules?.has(key);
                                                                                                                    }
                                                                                                                    const modulePermission = permissions?.flatMap((module) => module).filter((mod) => mod.module_id === m.id);
                                                                                                                    let permittedActions: any[] = [];
                                                                                                                    let permittedSubModules: any[] = [];
                                                                                                                    let availableActions = [];
                                                                                                                    let workflowData = [];
                                                                                                                    if (modulePermission && modulePermission.length > 0) {
                                                                                                                        permittedActions = modulePermission[0]?.permissions.map(actions => actions)
                                                                                                                        const workflowConfiguredData = workflowConfigData.flatMap((workflow) => workflow).filter((w) => w.module_id === modulePermission[0]?.module_id)
                                                                                                                        workflowData = workflowConfiguredData.filter(workflow => (
                                                                                                                            grp.users.flatMap((u) => u.id).includes(workflow.assigned_to)
                                                                                                                        ))
                                                                                                                        if (modulePermission[0]?.submodule_permissions) {
                                                                                                                            permittedSubModules = modulePermission[0]?.submodule_permissions
                                                                                                                        }
                                                                                                                        for (const a of m.available_actions.slice(1) as any) {
                                                                                                                            const permittedAction = permittedActions.flatMap(actions => actions).find((action) => action.action_id === a.action_id)
                                                                                                                            availableActions.push({
                                                                                                                                ...a,
                                                                                                                                isAllowed: permittedAction?.isAllowed ?? false,
                                                                                                                                requiredworkflow: permittedAction?.requiredworkflow ?? false
                                                                                                                            })
                                                                                                                        }
                                                                                                                    }

                                                                                                                    const moduleAccessAction:any = m.available_actions.slice(0, 1);
                                                                                                                    const ModuleAccessPermission = permittedActions.flatMap(actions => actions).filter((action) => (action.action_id === moduleAccessAction[0]?.action_id) && (action.isAllowed))
                                                                                                                    const isModuleAccessEnabled = ModuleAccessPermission.length > 0;

                                                                                                                    return (
                                                                                                                        <>
                                                                                                                            {m.selected_submodules.length > 0 ? (
                                                                                                                                <>
                                                                                                                                    <TableRow key={moduleIndex}>
                                                                                                                                        <TableCell colSpan={2}>
                                                                                                                                            <div className="grid grid-cols-[22%_70%_8%] items-center py-2 text-gray-700">
                                                                                                                                                <div onClick={() => toggleExpandedModule(index, i, moduleIndex)} className="flex justify-start items-center gap-2 ps-5 text-gray-700">
                                                                                                                                                    {expandedModule ? (
                                                                                                                                                        <ChevronDown className="text-gray-400" size={14} />
                                                                                                                                                    ) : (
                                                                                                                                                        <ChevronRight className="text-gray-400" size={14} />
                                                                                                                                                    )}
                                                                                                                                                    <span className="font-semibold">{m.module_name}</span>
                                                                                                                                                </div>
                                                                                                                                                <div className="flex items-center gap-5 w-full px-6">
                                                                                                                                                    <div className="flex items-center justify-between gap-4 space-x-2">
                                                                                                                                                        <span className="flex items-center gap-2">
                                                                                                                                                            <Checkbox
                                                                                                                                                                checked={m.selected_submodules.length === permittedSubModules.length}
                                                                                                                                                                onCheckedChange={() => handleToggleAllAction(grp.signature, m.id, [moduleAccessAction[0]?.action_id], m.selected_submodules.map((s:any) => s.id))}
                                                                                                                                                                className="data-[state=checked]:bg-white data-[state=checked]:text-gray-800 data-[state=checked]:border-gray-500" />
                                                                                                                                                            <label className="text-[13px] text-gray-500 font-semibold">All</label>
                                                                                                                                                        </span>
                                                                                                                                                        <span className="flex items-center gap-2">
                                                                                                                                                            <Checkbox
                                                                                                                                                                onCheckedChange={() => handleToggleModuleAccess(grp.signature, m.id, moduleAccessAction[0]?.action_id)}
                                                                                                                                                                checked={isModuleAccessEnabled ?? false}
                                                                                                                                                            />
                                                                                                                                                            <label className="text-[13px] text-gray-600 hover:text-blue-700 font-semibold">Module Access</label>
                                                                                                                                                        </span>
                                                                                                                                                    </div>
                                                                                                                                                    <div className="flex items-center gap-4 space-x-2 ps-4 border-l-1">
                                                                                                                                                        <span className="text-xs text-gray-400 italic">Sub-screens only</span>
                                                                                                                                                    </div>
                                                                                                                                                </div>
                                                                                                                                                 <div className="flex items-center justify-end pr-2">

                                                                                                                                            <Tooltip>
                                                                                                                                                <TooltipTrigger asChild>
                                                                                                                                                    <button
                                                                                                                                                disabled={!modulePermission || modulePermission.length === 0}
                                                                                                                                                onClick={() => {
                                                                                                                                                    setManageWorkflowModal(true)
                                                                                                                                                    const data = { selectedModule: { module_id: m.id, module_name: m.module_name, is_store_specific: m.is_store_specific },
                                                                                                                                                     available_actions: availableActions, assignedUsers: grp.users, userStores: grp.users[0].stores,workflowData:workflowData }
                                                                                                                                                    setManageWorkflowData(data)
                                                                                                                                                }} className="">
                                                                                                                                                <Settings className={`h-6 w-6 p-1 rounded-full ${!modulePermission ||modulePermission.length === 0 ? 'text-[#bfbfbf]' : 'text-gray-500  hover:bg-blue-100 hover:text-blue-500 transition duration-200 '}`} />
                                                                                                                                            </button>
                                                                                                                                                </TooltipTrigger>
                                                                                                                                                {!modulePermission || modulePermission.length === 0  &&
                                                                                                                                                    <TooltipContent>Please assign permissions to configure workflow</TooltipContent>
                                                                                                                                                }
                                                                                                                                            </Tooltip>
                                                                                                                                            </div>
                                                                                                                                            </div>
                                                                                                                                        </TableCell>
                                                                                                                                    </TableRow>
                                                                                                                                    {expandedModule &&
                                                                                                                                        m.selected_submodules.map((sub: any) => {
                                                                                                                                            const isPermittedSubModule = permittedSubModules.flatMap(subModules => subModules).filter((subModule) => (subModule.sub_module_id === sub.id) && (subModule.isAllowed))
                                                                                                                                            const isPermitted = isPermittedSubModule.length > 0;

                                                                                                                                            return (
                                                                                                                                                <TableRow key={sub.id} className="bg-[#f9fdff] hover:bg-[#f1faff]">
                                                                                                                                                    <TableCell colSpan={2}>
                                                                                                                                                        <div className="flex items-center py-1 text-gray-700">
                                                                                                                                                            <span className="w-[30%] text-gray-600 text-sm flex gap-2 items-center ps-12">
                                                                                                                                                                <Circle size={7} fill="#60a5fa" color="#60a5fa" />
                                                                                                                                                                <span>{sub.submodule_name}</span>
                                                                                                                                                            </span>
                                                                                                                                                            <Tooltip>
                                                                                                                                                                <TooltipTrigger asChild>

                                                                                                                                                                    <span className="flex justify-start items-center gap-2">
                                                                                                                                                                        <Checkbox
                                                                                                                                                                            disabled={!isModuleAccessEnabled}
                                                                                                                                                                            checked={(isPermitted && isModuleAccessEnabled) ?? false}
                                                                                                                                                                            onCheckedChange={() => handleToggleAction(grp.signature, m.id, null, sub.id)}
                                                                                                                                                                        />
                                                                                                                                                                        <span className="flex items-center gap-1">
                                                                                                                                                                            <label className={`text-[13px] font-semibold ${isModuleAccessEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Sub Module</label>
                                                                                                                                                                            {!isModuleAccessEnabled && (
                                                                                                                                                                                <AlertCircle className="w-3 h-3 text-gray-400" />
                                                                                                                                                                            )}
                                                                                                                                                                        </span>
                                                                                                                                                                    </span>
                                                                                                                                                                </TooltipTrigger>
                                                                                                                                                                {!isModuleAccessEnabled && (
                                                                                                                                                                    <TooltipContent>Enable module access to use dashboard sub modules</TooltipContent>
                                                                                                                                                                )}
                                                                                                                                                            </Tooltip>

                                                                                                                                                        </div>
                                                                                                                                                    </TableCell>
                                                                                                                                                </TableRow>
                                                                                                                                            )
                                                                                                                                        })
                                                                                                                                    }
                                                                                                                                </>
                                                                                                                            ) : (
                                                                                                                                <TableRow key={m.id}>
                                                                                                                                    <TableCell colSpan={2}>
                                                                                                                                        <div className="grid grid-cols-[22%_70%_8%] items-center py-2 text-gray-700">
                                                                                                                                            <span className="font-semibold text-gray-700 text-sm ps-11">{m.module_name}</span>
                                                                                                                                            <div className="flex items-center gap-5 w-full ps-6 pr-3">
                                                                                                                                                <div className="flex items-center justify-between gap-4 space-x-2">
                                                                                                                                                    <span className="flex items-center gap-2">
                                                                                                                                                        <Checkbox
                                                                                                                                                            checked={m.available_actions?.length === permittedActions.length}
                                                                                                                                                            onCheckedChange={() => {
                                                                                                                                                                handleToggleAllAction(grp.signature, m.id, m.available_actions?.map((a:any) => a?.action_id), null)
                                                                                                                                                                const unChecked = m.available_actions?.length !== permittedActions.length;
                                                                                                                                                                if (unChecked) {
                                                                                                                                                                    const isRequireWorkflowActions = m.available_actions?.filter((a:any) => a?.requires_approval === true)
                                                                                                                                                                    if (isRequireWorkflowActions && isRequireWorkflowActions.length > 0) {
                                                                                                                                                                        setMultipleActionModal(true);
                                                                                                                                                                        const actionData = isRequireWorkflowActions.map((action:any) => {
                                                                                                                                                                            const action_name = actions.filter((a) => a.id === action?.action_id).map((item) => item.action_name)

                                                                                                                                                                            return (
                                                                                                                                                                                { ...action, action_name: action_name }
                                                                                                                                                                            )
                                                                                                                                                                        })
                                                                                                                                                                        setSelectedMultipleActions(actionData);
                                                                                                                                                                        const configData = {
                                                                                                                                                                            selectedModule: { module_id: m.id, module_name: m.module_name, is_store_specific: m.is_store_specific },
                                                                                                                                                                            selectedActions: [], assignedUsers: grp.users, userStores: grp.users[0].stores, isEditMode :false
                                                                                                                                                                        }
                                                                                                                                                                        setConfigWorkflowData(configData as ConfigWorkflowDataProps)
                                                                                                                                                                    }
                                                                                                                                                                }
                                                                                                                                                            }}
                                                                                                                                                            className="data-[state=checked]:bg-white data-[state=checked]:text-gray-800 data-[state=checked]:border-gray-500" />
                                                                                                                                                        <label className="text-[13px] text-gray-600 font-semibold">All</label>
                                                                                                                                                    </span>
                                                                                                                                                    <span className="flex items-center gap-2">
                                                                                                                                                        <Checkbox
                                                                                                                                                            onCheckedChange={() => handleToggleModuleAccess(grp.signature, m.id, moduleAccessAction[0]?.action_id)}
                                                                                                                                                            checked={isModuleAccessEnabled ?? false}
                                                                                                                                                        />
                                                                                                                                                        <label className="text-[13px] text-gray-600 hover:text-blue-700 font-semibold">Module Access</label>
                                                                                                                                                    </span>
                                                                                                                                                </div>
                                                                                                                                                <div className="flex items-center flex-wrap gap-4 space-x-2 ps-5 border-l-1">
                                                                                                                                                    {m.available_actions && m.available_actions.length > 1 &&
                                                                                                                                                        m.available_actions.slice(1).map((a:any) => {
                                                                                                                                                            const action_name = actions.filter((action) => action.id === a.action_id).map((item) => item.action_name)
                                                                                                                                                            const action = availableActions.filter((action) => action.action_id === a.action_id);
                                                                                                                                                            const hasWorkflowConfig = action[0]?.requiredworkflow;
                                                                                                                                                            const isPermitted = action[0]?.isAllowed;

                                                                                                                                                            let workflow = [];
                                                                                                                                                            if (isPermitted && workflowData.length > 0) {
                                                                                                                                                                workflow = workflowData.filter((w) => w.action_id === a.action_id)
                                                                                                                                                            }

                                                                                                                                                            return (
                                                                                                                                                                <Tooltip>
                                                                                                                                                                    <TooltipTrigger asChild>

                                                                                                                                                                        <span key={a.action_id} className="flex items-center gap-2">
                                                                                                                                                                            <Checkbox
                                                                                                                                                                                disabled={!isModuleAccessEnabled}
                                                                                                                                                                                checked={(isPermitted && isModuleAccessEnabled) ?? false}
                                                                                                                                                                                onCheckedChange={() => {
                                                                                                                                                                                    handleToggleAction(grp.signature, m.id, a.action_id, null)
                                                                                                                                                                                    const unChecked = !(isPermitted && isModuleAccessEnabled);
                                                                                                                                                                                    if (unChecked) {
                                                                                                                                                                                        if (a.requires_approval) {
                                                                                                                                                                                            setSingleActionModal(true);
                                                                                                                                                                                            const actionData = { ...a, action_name: action_name }
                                                                                                                                                                                            setSelectedAction(actionData);
                                                                                                                                                                                            const configData = {
                                                                                                                                                                                                selectedModule: { module_id: m.id, module_name: m.module_name, is_store_specific: m.is_store_specific },
                                                                                                                                                                                                selectedActions: [actionData], assignedUsers: grp.users, userStores: grp.users[0].stores,isEditMode :false
                                                                                                                                                                                            }
                                                                                                                                                                                            setConfigWorkflowData(configData as ConfigWorkflowDataProps)
                                                                                                                                                                                        }
                                                                                                                                                                                    }
                                                                                                                                                                                }}
                                                                                                                                                                            />
                                                                                                                                                                            <span
                                                                                                                                                                                onClick={() => {
                                                                                                                                                                                    if (isModuleAccessEnabled && hasWorkflowConfig) {
                                                                                                                                                                                        setModifyWorkflowModal(true);
                                                                                                                                                                                        const data = { selectedModule: { module_id: m.id, module_name: m.module_name, is_store_specific: m.is_store_specific },
                                                                                                                                                                                        selectedActions: [{ ...a, action_name: action_name }], workflow: workflow }
                                                                                                                                                                                        setModifyWorkflowData(data);
                                                                                                                                                                                        setGroupedUsers(grp.users);
                                                                                                                                                                                    }
                                                                                                                                                                                }}
                                                                                                                                                                                className="flex items-center gap-1">
                                                                                                                                                                                <label className={`text-[13px] font-semibold ${isModuleAccessEnabled && hasWorkflowConfig ? 'text-green-600 hover:text-green-700 transition duration-200 hover:underline' : isModuleAccessEnabled ? 'text-gray-600' : 'text-gray-400'}`}>{action_name}</label>
                                                                                                                                                                                {!isModuleAccessEnabled && (

                                                                                                                                                                                    <AlertCircle className="w-3 h-3 text-gray-400" />
                                                                                                                                                                                )}
                                                                                                                                                                            </span>
                                                                                                                                                                        </span>
                                                                                                                                                                    </TooltipTrigger>
                                                                                                                                                                    {!isModuleAccessEnabled && (
                                                                                                                                                                        <TooltipContent>Enable module access to use this action</TooltipContent>
                                                                                                                                                                    )}
                                                                                                                                                                </Tooltip>

                                                                                                                                                            )
                                                                                                                                                        })
                                                                                                                                                    }
                                                                                                                                                </div>
                                                                                                                                            </div>
                                                                                                                                            <div className="flex items-center justify-end pr-2">

                                                                                                                                            <Tooltip>
                                                                                                                                                <TooltipTrigger asChild>
                                                                                                                                                    <button
                                                                                                                                                disabled={!modulePermission || modulePermission.length === 0}
                                                                                                                                                onClick={() => {
                                                                                                                                                    setManageWorkflowModal(true)
                                                                                                                                                    const data = { selectedModule: { module_id: m.id, module_name: m.module_name, is_store_specific: m.is_store_specific },
                                                                                                                                                     available_actions: availableActions.filter(action => action.isAllowed), 
                                                                                                                                                     assignedUsers: grp.users, userStores: grp.users[0].stores,workflowData:workflowData }
                                                                                                                                                    setManageWorkflowData(data)
                                                                                                                                                }} className="">
                                                                                                                                                <Settings className={`h-6 w-6 p-1 rounded-full ${!modulePermission || modulePermission.length === 0 ? 'text-[#bfbfbf]' : 'text-gray-500  hover:bg-blue-100 hover:text-blue-500 transition duration-200 '}`} />
                                                                                                                                            </button>
                                                                                                                                                </TooltipTrigger>
                                                                                                                                                {!modulePermission || modulePermission.length === 0  &&
                                                                                                                                                    <TooltipContent>Please assign permissions to configure workflow</TooltipContent>
                                                                                                                                                }
                                                                                                                                            </Tooltip>
                                                                                                                                            </div>
                                                                                                                                            
                                                                                                                                        </div>
                                                                                                                                    </TableCell>
                                                                                                                                </TableRow>
                                                                                                                            )}
                                                                                                                        </>
                                                                                                                    )
                                                                                                                })
                                                                                                            )}
                                                                                                        </>
                                                                                                    )
                                                                                                })
                                                                                            )}
                                                                                        </TableBody>
                                                                                    </Table>

                                                                                </div>
                                                                            </div>
                                                                        </CollapsibleContent>
                                                                    </Collapsible>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="flex justify-end items-center pt-3 px-3">
                                                    <Button
                                                        onClick={() => handleSaveChanges()}
                                                        className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-md text-white save-button"
                                                    >
                                                        <CheckCircleIcon className="text-sm" /><span>Save Changes</span>
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-center items-center py-20">
                                                <div className="space-y-1 flex flex-col justify-center items-center">
                                                    <ShieldCheck className="w-12 h-12 text-gray-300 font-semibold mb-2" />
                                                    <span className="text-gray-400 text-sm font-semibold">Select a module and role, then click <label className="font-bold text-gray-600">Load Permissions</label> to begin.</span>
                                                    <span className="text-gray-400 opacity-75 text-xs font-semibold">You can optionally filter by module, role or user</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Dialog open={singleActionModal} onOpenChange={() => {
                    setSingleActionModal(false);
                    setSelectedAction(null);
                    setConfigWorkflowData(null);
                }}>
                    <DialogContent className="w-md p-0 gap-0">
                        <DialogHeader className="p-5 border-b border-gray-300">
                            <DialogTitle className="text-blue-700">Configure Action Workflow</DialogTitle>
                        </DialogHeader>
                        <div className=" bg-gray-50 p-5 rounded-b-md space-y-4">
                            <p className="flex flex-wrap gap-1 text-gray-700 py-4 pr-4">
                                <span>Do you want to configure an approval workflow for the</span>
                                <label className="font-bold">{selectedAction?.action_name}</label>
                                <span>action?</span>
                            </p>
                            <div className="flex justify-end gap-2 mt-2">
                                <Button variant="outline" onClick={() => {
                                    setSingleActionModal(false);
                                    setSelectedAction(null);
                                    setConfigWorkflowData(null);
                                }}>
                                    No
                                </Button>
                                <Button
                                    onClick={() => {
                                        setSingleActionModal(false);
                                        handleSetWorkflowConfig()
                                    }}
                                    className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                    Yes, Configure Workflow
                                </Button>

                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={multipleActionModal} onOpenChange={() => {
                    setMultipleActionModal(false);
                    setSelectedMultipleActions([]);
                    setConfigWorkflowData(null);
                }}>
                    <DialogContent className="md:max-w-[50%] p-0 gap-0 rounded-xl">
                        <DialogHeader className="p-5 border-b border-gray-300">
                            <DialogTitle className="text-blue-700 ps-1 my-2">Apply require workflow to selected actions</DialogTitle>
                        </DialogHeader>
                        <div className=" bg-gray-50 p-5 rounded-b-md space-y-8">
                            <p className="flex gap-1 text-sm text-gray-600 p-1">
                                <span>Select the actions for which you want to configure the approval workflow.</span>

                            </p>
                            <div className="grid grid-cols-3 items-center gap-3 flex-wrap my-6">
                                {selectedMultipleActions.length > 0 &&
                                    selectedMultipleActions.map((action) => (
                                        <div className="flex-1">
                                            <span key={action.action_id} className="flex justify-start items-center gap-3 min-w-[100px] bg-white border px-2 py-3 rounded-md">
                                                <Checkbox
                                                    checked={configWorkflowData?.selectedActions.some(a => a.action_id === action.action_id)}
                                                    onCheckedChange={() => {
                                                        setConfigWorkflowData((prev : any) => {
                                                            let currentActions = prev?.selectedActions || [];
                                                            const exists = currentActions?.some((a:ActionProps) => a.action_id === action.action_id)
                                                            const updatedActions = exists ?
                                                                currentActions.filter((a:ActionProps) => a.action_id !== action.action_id) :
                                                                [...currentActions, action]

                                                            return { ...prev, selectedActions: updatedActions }
                                                        })
                                                    }}
                                                    className="w-5 h-5 border-2 border-blue-400 data-[state=checked]:bg-blue-400 data-[state=checked]:text-white data-[state=checked]:border-blue-400" />
                                                <label className="text-sm text-gray-600 font-semibold">{action.action_name}</label>
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <Button className="py-4 px-5" variant="outline" onClick={() => {
                                    setMultipleActionModal(false);
                                    setSelectedMultipleActions([]);
                                    setConfigWorkflowData(null);
                                }}>
                                    No
                                </Button>
                                <Button
                                    disabled={configWorkflowData?.selectedActions.length === 0}
                                    onClick={() => {
                                        setMultipleActionModal(false);
                                        handleSetWorkflowConfig();
                                    }}
                                    className="py-4 px-6 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                    Yes
                                </Button>

                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <ViewUsersModal
                    open={showUsersModal}
                    onClose={() => setShowUsersModal(false)}
                    groupedUsers={groupedUsers}
                    setGroupedUsers={setGroupedUsers}
                    setUserId={setUserId}
                    setLoadPermission={setLoadPermission}
                />

                <ManageWorkflowModal
                    open={manageWorkflowModal}
                    onClose={() => setManageWorkflowModal(false)}
                    manageWorkflowData={manageWorkflowData}
                    setManageWorkflowData={setManageWorkflowData}
                    setGroupedUsers={setGroupedUsers}
                    setModifyWorkflowModal={setModifyWorkflowModal}
                    setModifyWorkflowData={setModifyWorkflowData}
                    actions={actions}
                    setConfigWorkflowData={setConfigWorkflowData}
                    handleSetWorkflowConfig={handleSetWorkflowConfig}
                />

                <ModifyWorkflowModal
                    open={modifyWorkflowModal}
                    onClose={() => setModifyWorkflowModal(false)}
                    modifyWorkflowData={modifyWorkflowData}
                    setModifyWorkflowData={setModifyWorkflowData}
                    companyId={companyId}
                    groupedUsers={groupedUsers}
                    setGroupedUsers={setGroupedUsers}
                    setConfigWorkflowData={setConfigWorkflowData}
                    handleSetWorkflowConfig={handleSetWorkflowConfig}
                    fetchGroupedModuleAccess={fetchGroupedModuleAccess}
                />
            </>
        )
    } else {
        return <WorkflowConfig
            companyId={companyId}
            UserId={userData.id}
            setShowModuleAccess={setShowModuleAccess}
            setShowWorkflowConfig={setShowWorkflowConfig}
            configWorkflowData={configWorkflowData}
            setConfigWorkflowData={setConfigWorkflowData}
            fetchGroupedModuleAccess={fetchGroupedModuleAccess}
        />
    }

}
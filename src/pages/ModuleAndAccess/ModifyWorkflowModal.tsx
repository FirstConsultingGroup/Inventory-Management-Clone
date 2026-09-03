import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Json } from "@/Utils/types/database.types";
import { supabase } from "@/Utils/types/supabaseClient";
import { AlertTriangle, Check, CheckCircle, ChevronDown, ChevronRight, ChevronUp, CircleCheck, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface ModifyWorkflowModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    modifyWorkflowData: object;
    setModifyWorkflowData: React.Dispatch<React.SetStateAction<{}>>
    groupedUsers: any[] | null;
    setGroupedUsers: React.Dispatch<React.SetStateAction<any[] | null>>
    companyId: string;
    setConfigWorkflowData: React.Dispatch<React.SetStateAction<ConfigWorkflowDataProps | null>>
    handleSetWorkflowConfig: () => void;
    fetchGroupedModuleAccess: () => Promise<void>;
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

interface ConfigWorkflowDataProps {
    selectedActions: any[] | [];
    assignedUsers: UserProps[];
    userStores: any[];
    selectedModule: {
        module_id: string;
        module_name: string;
        is_store_specific: boolean;
    };
    isEditMode: boolean;
}

interface LocationsAndStoresProps {
    stores: {
        id: string;
        name: string;
        location_id: string | null;
    }[];
    id: string;
    location_name: string | null;
}[]

interface selectedWorkflowStoreDataType{
    id: string;
    name: string;
    location_id: string | null;
    stores?: string[];
    assigned_to?: string[];
}

export const ModifyWorkflowModal = ({
    open,
    onClose,
    modifyWorkflowData,
    setModifyWorkflowData,
    companyId,
    groupedUsers,
    setGroupedUsers,
    setConfigWorkflowData,
    handleSetWorkflowConfig,
    fetchGroupedModuleAccess
}: ModifyWorkflowModalProps) => {

    const [data, setData] = useState<any>({});
    const [viewStores, setViewStores] = useState(false);
    const [viewWorkflow, setViewWorkflow] = useState(true);
    const [stores, setStores] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);

    const [locationsAndStores, setLocationAndStores] = useState<LocationsAndStoresProps[]>([]);
    const [expandedLocations, setExpandedLocations] = useState<Set<number>>();
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>();
    const [initialPermittedStores, setInitialPermittedStores] = useState<string[]>([]);

    const [permittedStores, setPermittedStores] = useState<string[]>([]);
    const [permittedLocations, setPermittedLocations] = useState<string[]>([]);
    const [userLocations, setUserLocations] = useState<string[]>([]);
    const [selectedWorkflowGroup, setSelectedWorkflowGroup] = useState<{ assignedUsers: UserProps[]; index?: number } | null>(null);
    const [showWorkflowUsersModal, setShowWorkflowUsersModal] = useState(false);
    const [groupedWorkflowUsers, setGroupedWorkflowUsers] = useState<any[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showRemoveStoreWorkflowModal, setShowRemoveStoreWorkflowModal] = useState(false);
    const [showConfigStoreWorkflowModal, setShowConfigStoreWorkflowModal] = useState(false);
    const [selectedWorkflowStoreData, setSelectedWorkflowStoreData] = useState<selectedWorkflowStoreDataType | null>(null);
    const [showWorkflowConfiguration, setShowWorkflowConfiguration] = useState(false);

    useEffect(() => {
        console.log('modifyWorkflowData', modifyWorkflowData)
        setData(modifyWorkflowData)
    }, [modifyWorkflowData])

    const groupedUserIds = groupedUsers?.flatMap(u => u.id);

    useEffect(() => {

        const fetchLocationsAndStores = async () => {
            if(!groupedUserIds) return;
            try {

                const { data: userLocation, error: userLocationError } = await supabase
                    .from('user_mgmt')
                    .select('locations')
                    .in('id', groupedUserIds);

                if (userLocationError) throw userLocationError;
                if (userLocation) {
                    const mappedLoc = userLocation.map(item => item.locations)
                    const matchingLocations = mappedLoc.reduce((commonItems:any, currentArray:any) => {
                        const currentSet = new Set(currentArray);
                        return commonItems.filter((item: any) => currentSet.has(item))
                    })
                    setUserLocations(matchingLocations as string[])
                }

                const { data: locations, error: locationsError } = await supabase
                    .from('location_master')
                    .select('id,location_name')
                    .eq('company_id', companyId)
                    .eq('is_active', true);

                if (locationsError) throw locationsError;

                const { data: stores, error: storesError } = await supabase
                    .from('store_mgmt')
                    .select('id,name,location_id')
                    .eq('company_id', companyId)
                    .eq('is_active', true);

                if (storesError) throw storesError;

                setStores(stores)

                let locationsAndStores = [];
                if (locations && stores) {
                    for (const loc of locations) {
                        const locationStores = stores.filter(store => store.location_id === loc.id);
                        locationsAndStores.push({ ...loc, stores: locationStores })
                    }
                }

                setLocationAndStores(locationsAndStores)

            } catch (error) {
                console.log('Error fetching locations', error)
            }
        }

        fetchLocationsAndStores();
    }, [modifyWorkflowData])

    useEffect(() => {
        const PermittedStores =  groupedUsers?.[0]?.stores;
        setInitialPermittedStores(PermittedStores);
        setPermittedStores(PermittedStores);

        let PermittedLocations = [];
        for (const loc of locationsAndStores) {
            const hasPermittedStores = loc.stores.filter(store => PermittedStores?.includes(store.id))
            if (hasPermittedStores.length > 0) {
                PermittedLocations.push(loc.id)
            } else if (userLocations.includes(loc.id)) {
                PermittedLocations.push(loc.id)
            }
        }

        setPermittedLocations(PermittedLocations)

    }, [locationsAndStores, groupedUsers]);

    let groupedWorkflow: any[] = [];
    if (data?.workflow?.length > 0) {

        const workflowData = data?.workflow.filter((w:any) => w.level === 1);

        for (const workflow of workflowData) {
            const storeIds: [] = workflow.stores.map((store:any) => store.id || store);
            const existingGroup = groupedWorkflow.find(item => {
                if (item.stores.length !== storeIds.length) return false;
                return item.stores.every((store:any, index:number) => store === storeIds[index])
            });
            if (existingGroup) {
                existingGroup.assigned_to.push(workflow.assigned_to)
            } else {
                groupedWorkflow.push({ stores: storeIds, assigned_to: [workflow.assigned_to] })
            }
        }
    }

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                let query = supabase
                    .from('role_master')
                    .select('*')
                    .eq('is_active', true)
                    .neq('name', 'Super Admin')
                    .eq('company_id', companyId);


                const { data: roles, error } = await query;

                if (error) throw error;

                setRoles(roles);
            } catch (error) {
                console.log("Error fetching roles", error)
            }
        }

        fetchRoles();
    }, [modifyWorkflowData]);

    function toggleLocationAccess(loc: any) {
        setPermittedLocations(prev => {
            const prevPermittedLocs = new Set(prev);

            if (prevPermittedLocs.has(loc.id)) {
                prevPermittedLocs.delete(loc.id)
            } else {
                prevPermittedLocs.add(loc.id)
            }

            return Array.from(prevPermittedLocs)
        })

        setPermittedStores(prev => {
            const prevStores = new Set(prev);
            for (const s of loc.stores) {
                if (prevStores.has(s.id)) {
                    prevStores.delete(s.id)
                }
            }
            return Array.from(prevStores)
        })
    }

    function handleSetSelectedGroup(assignedUsers: any[], index: number) {

        if (selectedWorkflowGroup?.index === index) {
            setSelectedWorkflowGroup(null);
        } else {
            setSelectedWorkflowGroup({ assignedUsers: assignedUsers, index: index });
        }
    }

    function toggleStoreAccess(storeId: string) {
        setPermittedStores((prev) => {
            const prevPermittedStores = new Set(prev);

            if (prevPermittedStores.has(storeId)) {
                prevPermittedStores.delete(storeId)
            } else {
                prevPermittedStores.add(storeId)
            }

            return Array.from(prevPermittedStores)
        })

    }

    function toggleExpandedGroups(index: number) {
        setExpandedGroups(prev => {
            const expandedIndexes = new Set(prev);

            if (expandedIndexes.has(index)) {
                expandedIndexes.delete(index)
            } else {
                expandedIndexes.add(index)
            }

            return expandedIndexes;
        })
    }

    function toggleExpandedLocation(index: number) {
        setExpandedLocations(prev => {
            const expandedIndexes = new Set(prev);

            if (expandedIndexes.has(index)) {
                expandedIndexes.delete(index)
            } else {
                expandedIndexes.add(index)
            }

            return expandedIndexes;
        })
    }

    const handleSaveConfiguration = async () => {
        try {
            if(!groupedUserIds) return;
            
            let existsInWorkflow: boolean = false;
            const removedStores = initialPermittedStores.filter(id => !permittedStores.includes(id));

            const { data: stores, error } = await supabase
                .from('workflow_config')
                .select('stores')
                .in('assigned_to', groupedUserIds)
                .eq('company_id', companyId);

            if (error) throw error;

            if (stores && stores.length > 0) {
                const flattenStoresArray = Array.from(new Set(stores.flatMap(item => item.stores).map((store:any) => store.id ? store.id : store)))
                const hasWorklowConfigured = removedStores.some(store => flattenStoresArray.includes(store))
                existsInWorkflow = hasWorklowConfigured;
                if (existsInWorkflow) {
                    toast.error("Cannot configure store access. Removed stores has active workflows for this users.")
                    return;
                }
            }

            const { error: updateError } = await supabase
                .from('user_mgmt')
                .update({
                    locations: permittedLocations,
                    stores: permittedStores
                })
                .in('id', groupedUserIds);

            if (updateError) throw updateError;
            toast.success("Locations and Stores access updated successfully.")

        } catch (error) {
            console.log("Failed to save configuration", error)
        }
    }

        const handleRemoveStoreWorkflow = async () => {
        if (!selectedWorkflowStoreData) return;

        const assignedWorkflowUsers = selectedWorkflowStoreData.assigned_to ? selectedWorkflowStoreData.assigned_to : 
        groupedUserIds;

        const module_id = data.selectedModule.module_id;
        const action_id = data.selectedActions[0].action_id;
        const updatedStorIds = selectedWorkflowStoreData.stores ? selectedWorkflowStoreData.stores?.filter(storeId => storeId !== selectedWorkflowStoreData.id) :
        data?.workflow[0].stores?.filter((store:any) => store.id !== selectedWorkflowStoreData.id).map((store:any) => store.id);
        const updatedStores = stores.filter((store:any) => updatedStorIds?.includes(store.id)).map((store:any) => ({ id: store.id, name: store.name}));

            const { data:UpdateWorkflowStore, error:UpdateWorkflowStoreError } = await supabase
                .from('workflow_config')
                .update({ stores: updatedStores})
                .in('assigned_to', assignedWorkflowUsers!)
                .eq('module_id', module_id)
                .eq('action_id', action_id)
                .eq('company_id', companyId)
                .select();

            if (UpdateWorkflowStoreError) {
                toast.error(UpdateWorkflowStoreError.message);
                throw UpdateWorkflowStoreError;
            }

            if (UpdateWorkflowStore) {
                setData((prevData: any) => {
            const updatedWorkflow = prevData.workflow.map((workflow: any) => {
                if (workflow.stores.some((store: any) => store.id === selectedWorkflowStoreData.id)) {
                    return { ...workflow, stores: workflow.stores.filter((store: any) => store.id !== selectedWorkflowStoreData.id) };
                }
                return workflow;
            });
            return { ...prevData, workflow: updatedWorkflow };
        })
            }

            toast.success("Workflow Configuration for the store removed successfully")
            setSelectedWorkflowStoreData(null);
        fetchGroupedModuleAccess();
    }

        const handleApplyConfiguration = async () => {
        if (!selectedWorkflowStoreData) return;

        const assignedWorkflowUsers = selectedWorkflowStoreData.assigned_to ? selectedWorkflowStoreData.assigned_to : 
        groupedUserIds;

        const module_id = data.selectedModule.module_id;
        const action_id = data.selectedActions[0].action_id;
        const newStore = { id: selectedWorkflowStoreData.id, name: selectedWorkflowStoreData.name };
        const currentStores = selectedWorkflowStoreData.stores ? selectedWorkflowStoreData.stores : data?.workflow[0].stores;
        const updatedStores = currentStores.some((store: any) => store.id === newStore.id) ? currentStores : [...currentStores, newStore];

            const { data:UpdateWorkflowStore, error:UpdateWorkflowStoreError } = await supabase
                .from('workflow_config')
                .update({ stores: updatedStores})
                .in('assigned_to', assignedWorkflowUsers!)
                .eq('module_id', module_id)
                .eq('action_id', action_id)
                .eq('company_id', companyId)
                .select();

            if (UpdateWorkflowStoreError) {
                toast.error(UpdateWorkflowStoreError.message);
                throw UpdateWorkflowStoreError;
            }

            if (UpdateWorkflowStore) {
                setData((prevData: any) => {
            const updatedWorkflow = prevData.workflow.map((workflow: any) => {
                if (workflow.stores.some((store: any) => store.id === selectedWorkflowStoreData.id)) {
                    return workflow;
                }
                return { ...workflow, stores: [...workflow.stores, newStore] };
            });
            return { ...prevData, workflow: updatedWorkflow };
        })
            }

            toast.success("Workflow Configuration for the store removed successfully")
            setSelectedWorkflowStoreData(null);
        fetchGroupedModuleAccess();
        }


    const handleEditWorkflowConfig = () => {
        let assignedUsers: any = data.selectedModule?.is_store_specific && groupedWorkflow.length > 1 ? selectedWorkflowGroup?.assignedUsers : groupedUsers;
        const configData = {
            selectedModule: data.selectedModule,
            selectedActions: [data.selectedActions?.[0]], assignedUsers: assignedUsers, userStores: assignedUsers[0].stores, isEditMode: true
        }
        onClose(open)
        setConfigWorkflowData(configData as ConfigWorkflowDataProps);
        handleSetWorkflowConfig()
        handleResetState();
    }

    const handleDeleteWorkflow = async () => {
        if (!data.selectedModule && data.selectedActions.length === 0 && groupedUsers?.length === 0) return;
        if(!groupedUserIds) return;
        const module_id = data.selectedModule.module_id;
        const action_id = data.selectedActions[0].action_id;

        for (const userId of groupedUserIds) {
            const { data, error } = await supabase
                .from('workflow_config')
                .update({ is_active: false })
                .eq('assigned_to', userId)
                .eq('module_id', module_id)
                .eq('action_id', action_id)
                .eq('company_id', companyId)
                .select();

            if (error) {
                toast.error(error.message);
                throw error;
            }

            if (data) {

                const { data: modulePrm } = await supabase
                    .from('module_permissions')
                    .select('permissions')
                    .eq('user_id', userId)
                    .eq('module_id', module_id)
                    .eq('company_id', companyId);


                if (modulePrm && Array.isArray(modulePrm[0].permissions)) {
                    const updatedPermissions = modulePrm[0].permissions.map((prm:any) => {
                        if (prm.action_id === action_id) {
                            return { ...prm, requiredworkflow: false }
                        } else {
                            return { ...prm }
                        }
                    });

                    const { data: updatedPrm } = await supabase
                        .from('module_permissions')
                        .update({ permissions: updatedPermissions })
                        .eq('user_id', userId)
                        .eq('module_id', module_id)
                        .eq('company_id', companyId)
                        .select();

                }
            }

            toast.success("Workflow Configuration Deleted Successfully")
            handleResetState();
                    fetchGroupedModuleAccess();
        }
    }

    function handleResetState() {
        onClose(open);
        setModifyWorkflowData({});
        setViewStores(false);
        setViewWorkflow(true);
        setExpandedLocations(new Set());
        setExpandedGroups(new Set())
        setGroupedUsers([]);
        setSelectedWorkflowGroup(null)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={() => handleResetState()}>
                <DialogContent className="md:max-w-[58vw] p-0 gap-0 rounded-xl bg-slate-50">
                    <DialogHeader className="px-5 py-4 border-b rounded-t-xl border-gray-300 bg-white">
                        <DialogTitle className="text-blue-700 ps-1 my-2">
                            <span className="flex items-center gap-2">
                                Modify the action workflow approval
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                        <div className=" border-b-8 border-white">

                            <div className="rounded-lg p-2 bg-gray-50 shadow m-4 z-10 sticky">
                                <div className="flex items-center rounded-lg bg-gray-100 ">
                                    <button
                                        onClick={() => {
                                            setViewStores(true);
                                            setViewWorkflow(false);
                                        }}
                                        className={`flex-1 font-semibold p-1 rounded-lg ${viewStores ? 'bg-white border shadow-sm' : 'hover:scale-95 transition-transform duration-200'}`}>
                                        <label>Store Access</label>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewStores(false);
                                            setViewWorkflow(true);
                                        }}
                                        className={`flex-1 font-semibold p-1 rounded-lg ${viewWorkflow ? 'bg-white border shadow-sm' : 'hover:scale-95 transition-transform duration-200'}`}>
                                        <label>Workflow Config</label>
                                    </button>
                                </div>
                            </div>
                        </div>
                        {viewWorkflow ? (
                            <div className="p-6 bg-gray-50 max-h-[52vh] overflow-y-auto">
                                {data.selectedModule?.is_store_specific ? (
                                    <div className="bg-white border shadow rounded-lg overflow-hidden">
                                        <div className="grid grid-cols-[25%_75%] bg-slate-50 py-2 px-3 font-semibold text-sm border-b hover:bg-gray-100 transition-colors duration-200">
                                            <span>Action</span>
                                            <span>Workflow Configured Stores</span>
                                        </div>
                                        <div className="bg-white grid grid-cols-[25%_65%_8%] p-3 hover:bg-gray-50 transition-colors duration-200">
                                            <span className="flex justify-start items-center">
                                                <label className="font-semibold text-sm">{data.selectedModule?.module_name}{' '}-{' '}{data.selectedActions?.[0]?.action_name}</label>
                                            </span>
                                            <div>
                                                {groupedUsers && groupedUsers.length > 1 ? (
                                                    <Table>
                                                        <TableBody>

                                                            {groupedWorkflow.map((workflow, index) => {
                                                                const isExpanded = expandedGroups?.has(index);
                                                                const isSelected = selectedWorkflowGroup?.index === index;
                                                                const assignedUsers = groupedUsers.filter(user => workflow.assigned_to.includes(user.id)).map((u) => u);
                                                                const multipleUserCount = assignedUsers.length > 2;
                                                                return (
                                                                    <TableRow>
                                                                        <div key={index}
                                                                            onClick={() => {
                                                                                toggleExpandedGroups(index)
                                                                            }} className="flex justify-between items-center p-2">
                                                                            <div className="flex items-center gap-3">
                                                                                <Checkbox
                                                                                    checked={isSelected}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    onCheckedChange={() => handleSetSelectedGroup(assignedUsers, index)}
                                                                                    className="shadow data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                                                                <span className="flex flex-col justify-start items-start">
                                                                                    <label className="font-semibold text-sm text-gray-800">{multipleUserCount ?
                                                                                        <span>{assignedUsers.slice(0, 2).map((u) => (u.first_name + (' ') + u.last_name)).join(', ')} + {assignedUsers.slice(2).length} more</span> :
                                                                                        <span>{assignedUsers.map((u) => (u.first_name + (' ') + u.last_name)).join(', ')}</span>
                                                                                    }
                                                                                    </label>
                                                                                    {multipleUserCount ?
                                                                                        <span
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setShowWorkflowUsersModal(true);
                                                                                                setGroupedWorkflowUsers(assignedUsers);
                                                                                            }}
                                                                                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold cursor-pointer">{assignedUsers.length} users in this group</span>
                                                                                        :
                                                                                        <span className="text-gray-500 text-xs">{assignedUsers.map((u) => u.email).join(', ')}</span>
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="bg-blue-50 text-blue-600 rounded-xl py-1 px-2 text-xs font-semibold cursor-pointer">{workflow.stores?.length} / {permittedStores?.length} stores</span>
                                                                                {isExpanded ? (
                                                                                    <ChevronUp size={16} className="text-gray-400" />
                                                                                ) : (
                                                                                    <ChevronDown size={16} className="text-gray-400" />
                                                                                )}

                                                                            </div>
                                                                        </div>
                                                                        {isExpanded &&
                                                                            <div className="grid grid-cols-2 gap-1 flex-wrap p-2">
                                                                                {stores.map((store:any) => {
                                                                                    const alreadyConfiguredStores = workflow.stores;

                                                                                    const configuredStore = alreadyConfiguredStores.filter((s:any) => s === store.id);
                                                                                    const isConfiguredStore = configuredStore.length > 0;
                                                                                    const hasStoreAccess = permittedStores?.includes(store.id);

                                                                                    return (
                                                                                        <div key={store.id}>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <span className="flex justify-start items-center font-semibold gap-2 p-1">
                                                                                                        <Checkbox
                                                                                                        onCheckedChange={() => {
                                                                                    setSelectedWorkflowStoreData({...store,...workflow});
                                                                                    if(isConfiguredStore){
                                                                                        setShowRemoveStoreWorkflowModal(true)
                                                                                    }else{
                                                                                        setShowConfigStoreWorkflowModal(true)
                                                                                    }
                                                                                }}
                                                                                                            checked={isConfiguredStore}
                                                                                                            disabled={!hasStoreAccess && !isConfiguredStore}
                                                                                                        />
                                                                                                        <span className={`text-sm ${hasStoreAccess ? '' : 'text-gray-400'}`}>{store.name}</span>
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                {!hasStoreAccess &&
                                                                                                    <TooltipContent>The {groupedUsers.length > 1 ? 'group of users' : 'user'} doesn't have access on this store. </TooltipContent>
                                                                                                }
                                                                                            </Tooltip>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        }
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>


                                                ) : (
                                                    <div className="grid grid-cols-2 gap-1 flex-wrap">
                                                        {stores.map((store) => {
                                                            const alreadyConfiguredStores = data?.workflow?.[0]?.stores;

                                                            const configuredStore = alreadyConfiguredStores?.filter((s:any) => s.id === store.id);
                                                            const isConfiguredStore = configuredStore?.length > 0;
                                                            const hasStoreAccess = permittedStores?.includes(store.id);

                                                            return (
                                                                <div key={store.id}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="flex justify-start items-center font-semibold gap-2 p-1">
                                                                                <Checkbox
                                                                                onCheckedChange={() => {
                                                                                    setSelectedWorkflowStoreData(store);
                                                                                    if(isConfiguredStore){
                                                                                        setShowRemoveStoreWorkflowModal(true)
                                                                                    }else{
                                                                                        setShowConfigStoreWorkflowModal(true)
                                                                                    }
                                                                                }}
                                                                                    checked={isConfiguredStore}
                                                                                    disabled={!hasStoreAccess && !isConfiguredStore}
                                                                                />
                                                                                <span className={`text-sm ${hasStoreAccess ? '' : 'text-gray-400'}`}>{store.name}</span>
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        {!hasStoreAccess &&
                                                                            <TooltipContent>The {groupedUsers && groupedUsers.length > 1 ? 'group of users' : 'user'} doesn't have access on this store. </TooltipContent>
                                                                        }
                                                                    </Tooltip>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                                }
                                            </div>
                                            <span className="flex items-center justify-end">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Trash2
                                                            onClick={() => setShowDeleteModal(true)} className="text-red-500 h-8 w-8 p-2 hover:bg-red-50 hover:text-red-600 rounded-full" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete all workflows for this action</TooltipContent>
                                                </Tooltip>
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white border shadow px-5 py-7 text-gray-600 rounded-lg flex flex-col justify-center items-center space-y-1">
                                        <p className="text-[15px]">The approval workflow for the action{' '}
                                            <label className="font-bold text-gray-600 text-[16px]">"{data.selectedModule?.module_name}{' '}-{' '}{data.selectedActions?.[0]?.action_name}"</label>{' '}
                                            is currently configured and applies to <label className="font-bold text-gray-600">{groupedUsers?.length} {groupedUsers && groupedUsers?.length > 1 ? 'users' : 'user'}</label>.</p>
                                        Any modifications made to this configuration will be applied to all this users.
                                        <span className="text-black mt-3 font-semibold">Would you like to proceed and edit this workflow configuration?</span>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="py-4 px-6 bg-gray-50 max-h-[52vh] overflow-y-auto space-y-4">
                                <div className="bg-white rounded-lg border shadow p-4 flex items-center justify-between">
                                    <div className="flex flex-col items-start">
                                        <h3 className="font-semibold text-lg">Locations & Store Access</h3>
                                        <p className="text-sm text-gray-500">Configure store access for the selected user or group.</p>
                                    </div>
                                    <Button
                                        onClick={() => handleSaveConfiguration()}
                                        className="flex items-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white ">
                                        <Save />
                                        <span>Save Configuration</span>

                                    </Button>
                                </div>
                                <div className="rounded-lg overflow-hidden shadow-sm border">
                                    <Table>
                                        {locationsAndStores.length > 0 &&
                                            locationsAndStores.map((loc, index) => {
                                                const isExpanded = expandedLocations?.has(index);
                                                const hasLocationAccess = permittedLocations.includes(loc.id);

                                                return (
                                                    <>
                                                        <TableRow key={loc.id} className="bg-white hover:bg-gray-50">
                                                            <TableCell colSpan={2}>
                                                                <div onClick={() => {
                                                                    toggleExpandedLocation(index)
                                                                }} className=" flex justify-between items-center gap-2 px-3 py-2 text-gray-800">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="mx-1">

                                                                            <Checkbox
                                                                                checked={hasLocationAccess}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onCheckedChange={() => toggleLocationAccess(loc)}
                                                                            />
                                                                        </div>
                                                                        <span className="font-semibold text-[16px]">{loc.location_name}</span>
                                                                        <span className="bg-gray-50 rounded-lg px-2 text-xs text-gray-500">{loc.stores.length}{' '} Stores</span>
                                                                    </div>
                                                                    {isExpanded ? (
                                                                        <ChevronUp size={17} className="text-gray-500" />
                                                                    ) : (
                                                                        <ChevronDown size={17} className="text-gray-500" />
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                        {isExpanded && (
                                                            <TableRow>
                                                                <TableCell>
                                                                    <div className="bg-gray-50 px-3 py-1">
                                                                        {loc.stores.length > 0 ? (
                                                                            <div className="grid grid-cols-3 gap-3 px-6 items-center text-gray-800">
                                                                                {loc.stores.map((store) => {
                                                                                    const hasStoreAccess = permittedStores?.includes(store.id);

                                                                                    return (

                                                                                        <div key={store.id} className="flex justify-start items-center gap-2">
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <span>

                                                                                                        <Checkbox
                                                                                                            disabled={!hasLocationAccess}
                                                                                                            checked={hasLocationAccess && hasStoreAccess}
                                                                                                            onCheckedChange={() => toggleStoreAccess(store.id)}
                                                                                                        />
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                {!hasLocationAccess &&
                                                                                                    <TooltipContent>Enable location access.</TooltipContent>
                                                                                                }
                                                                                            </Tooltip>
                                                                                            <span className=" text-sm text-gray-600">{store.name}</span>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="ps-5 text-sm text-gray-500 italic">No stores in this location</span>
                                                                        )}

                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </>
                                                )
                                            })
                                        }
                                    </Table>
                                </div>
                            </div>
                        )}

                    </div>
                    <DialogFooter className="bg-white border border-t px-5 py-4 rounded-b-xl">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => handleResetState()}>
                                Close
                            </Button>
                            {viewWorkflow &&
                                <Button
                                    onClick={() => {
                                        handleEditWorkflowConfig()
                                    }}
                                    disabled={data.selectedModule?.is_store_specific && !selectedWorkflowGroup && (groupedUsers && groupedUsers.length > 1)}
                                    className="py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                    Edit Workflow Config
                                </Button>
                            }

                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showWorkflowUsersModal} onOpenChange={() => {
                setShowWorkflowUsersModal(false);
                setGroupedWorkflowUsers([]);
            }}>
                <DialogContent className="w-md rounded-xl bg-slate-50">
                    <DialogHeader className="">
                        <DialogTitle className="text-blue-700">
                            Group Users ({groupedWorkflowUsers.length})
                        </DialogTitle>
                        <DialogDescription>These users share identical workflow configurations.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        {groupedWorkflowUsers.length > 0 &&
                            groupedWorkflowUsers.map(user =>
                                <div className="flex items-center gap-3 p-3 shadow border rounded-xl">
                                    <span className="w-9 h-8 rounded-full p-4 bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                    </span>
                                    <div className="flex flex-col justify-start">
                                        <span className="font-semibold">{user.first_name}{' '}{user.last_name}</span>
                                        <span className="text-sm text-gray-500">{user.email}</span>
                                    </div>
                                </div>
                            )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showDeleteModal} onOpenChange={() => {
                setShowDeleteModal(false);
            }}>
                <DialogContent className="w-md rounded-xl bg-slate-50">
                    <DialogHeader className="">
                        <DialogTitle className="text-red-600">
                            <span className="flex items-center gap-3">
                                <AlertTriangle />
                                <label>Remove Action Workflow</label>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-1">
                        <p className="text-gray-700">Are you sure you want to permanently delete all workflow configurations for{' '}
                            <label className="font-bold">{data.selectedModule?.module_name}{' '}-{' '}{data.selectedActions?.[0]?.action_name}?</label>
                        </p>
                        <p className="text-sm text-gray-500 mt-1">This will remove the workflow setup across all stores for this action. This cannot be undone.</p>
                    </div>
                    <DialogFooter className="mt-2">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => {
                                setShowDeleteModal(false);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    handleDeleteWorkflow();
                                    setShowDeleteModal(false);
                                }}
                                variant="destructive">
                                Delete All Workflows
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showRemoveStoreWorkflowModal} onOpenChange={() => {
                setShowRemoveStoreWorkflowModal(false);
            }}>
                <DialogContent className="w-md rounded-xl bg-slate-50">
                    <DialogHeader className="">
                        <DialogTitle className="text-red-600">
                            <span className="flex items-center gap-3">
                                <AlertTriangle />
                                <label>Remove Store Workflow</label>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-1">
                        <p className="text-gray-700">Are you sure you want to permanently delete the workflow configurations for{' '}
                            <label className="font-bold">{selectedWorkflowStoreData?.name}?</label>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">This action cannot be undone. Users will no longer require approval for this action in this store.</p>
                    </div>
                    <DialogFooter className="mt-2">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => {
                                setShowRemoveStoreWorkflowModal(false);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    handleRemoveStoreWorkflow();
                                    setShowRemoveStoreWorkflowModal(false);
                                }}
                                variant="destructive">
                                Delete Workflow
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

                        <Dialog open={showConfigStoreWorkflowModal} onOpenChange={() => {
                setShowConfigStoreWorkflowModal(false);
                setShowWorkflowConfiguration(false);
            }}>
                <DialogContent className="md:max-w-[50vw] rounded-lg p-0">
                    <DialogHeader className="border-b px-5 py-4">
                        <DialogTitle className="text-blue-700">
                            <span className="flex items-center gap-2">
                                <CheckCircle size={20} />
                                <label className="pb-0.5">Apply Existing Configuration?</label>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-5 space-y-6">
                        <p className="text-gray-500 text-sm mt-2">Would you like to instantly apply this existing configuration to{' '}
                            <label className="text-gray-600 font-semibold">{selectedWorkflowStoreData?.name}?</label>
                        </p>
                        <div className="flex flex-col gap-3">
                            <span className=" text-blue-600 hover:text-blue-800 transition-colors duration-200 text-sm">
                                {showWorkflowConfiguration ? (
                                    <span className="flex items-center gap-1" onClick={() => setShowWorkflowConfiguration(false)}>
                                    <ChevronUp size={20} className="mt-0.5"/>
                                    <label className="font-semibold">Hide Workflow Configuration</label>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1" onClick={() => setShowWorkflowConfiguration(true)}>
                                    <ChevronDown size={20} className="mt-0.5"/>
                                    <label className="font-semibold">View Workflow Configuration</label>
                                    </span>
                                )}
                            </span>
                            {showWorkflowConfiguration && data?.workflow.length > 0 && (
                                <div className="shadow border rounded-lg overflow-hidden pointer-events-none">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b text-[14px] hover:bg-white">
                                                <TableHead className="text-center py-3 text-gray-500">Level</TableHead>
                                                <TableHead className="text-center w-[200px] text-gray-500"> Approver Role</TableHead>
                                                <TableHead className="text-center w-[150px] text-gray-500">Approval Users</TableHead>
                                                <TableHead className="text-gray-500">Multiple Approval Required</TableHead>
                                                <TableHead className="w-[100px] text-gray-500">Active</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody >
                                            {data?.workflow.filter((level: any) => {
                                                if (groupedUserIds && groupedUserIds.length > 1) {
                                                return level.assigned_to === selectedWorkflowStoreData?.assigned_to?.[0];
                                                }
                                                return true;
                                            } ).map((level:any, index:number) => {
                                                const roleName = roles.find(role => role.id === level.role_id)?.name;

                                            return (
                                                <TableRow key={index} className="border border-slate-50 mb-6 text-[14px] hover:bg-white">
                                                    <TableCell className="text-center py-5">{level.level}</TableCell>
                                                    <TableCell className="text-center w-[200px]">
                                                        <span className='border rounded-lg px-2 pb-0.5 font-semibold text-gray-600 text-center text-[12px]'>
                                                                                {roleName}
                                                                            </span>
                                                    </TableCell>
                                                    <TableCell className="text-center w-[150px]">
                                                        <span className="rounded-lg px-2.5 py-0.5 bg-gray-50 font-semibold text-gray-600 text-[12px]">{level.approval_users?.length} users</span>
                                                    </TableCell>
                                                    <TableCell className="text-gray-500">
                                                        <span>
                                                            {level.multiple_approvers_enabled ? (
                                                                        <Check size={18} className="text-green-600" />
                                                                    ) : (
                                                                        <X size={16} className="text-red-600" />
                                                                    )}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="w-[100px] text-gray-500">
                                                        <span>
                                                          {level.status ? (
                                                                        <Check size={18} className="text-green-600" />
                                                                    ) : (
                                                                        <X size={16} className="text-red-600" />
                                                                    )}  
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            
                                            )})}
                                        </TableBody>
                                        </Table>
                                        <div className="flex flex-col gap-3 mt-5 mb-2 p-4 text-sm text-gray-600 border-t">
                                            <span className="flex items-center gap-2 w-fit">
                                            <Checkbox
                                            checked={data?.workflow[0].override_enabled}
                                                className="border rounded-xs border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                            <label>Allow SuperAdmin to override all approval levels</label>
                                        </span>
                                        <span className="flex items-center gap-2 w-fit">
                                            <Checkbox
                                            checked={data?.workflow[0].full_rejection_enabled}
                                                className="border rounded-xs border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                            <label>Enable Complete rejection</label>
                                        </span>
                                        </div>
                                </div>
                            )
                            }
                        </div>
                    </div>
                    <DialogFooter className="mt-2 border-t px-5 py-4">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-lg" variant="outline" onClick={() => {
                                setShowConfigStoreWorkflowModal(false);
                                setShowWorkflowConfiguration(false);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    handleApplyConfiguration();
                                    setShowConfigStoreWorkflowModal(false);
                                    setShowWorkflowConfiguration(false);
                                }}
                                className="py-4 px-6 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-white">
                                Yes, Apply Configuration
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>

    )
}
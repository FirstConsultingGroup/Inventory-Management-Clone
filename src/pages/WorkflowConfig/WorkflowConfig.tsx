import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Json } from "@/Utils/types/database.types"
import { supabase } from "@/Utils/types/supabaseClient"
import { ArrowLeft, BadgeAlert, Ban, Check, CheckCheck, ChevronUp, Edit, Plus, Trash, Trash2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { boolean } from "zod"


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
}

interface LevelDataProps {
    level: number;
    approverRole: string | null
    approvalUsers: string[] | [];
    multipleApprovalRequired: boolean;
    active: boolean;
}

interface WorkflowConfigProps {
    companyId: string;
    createdBy: string;
    setShowWorkflowConfig: React.Dispatch<React.SetStateAction<boolean>>;
    setShowModuleAccess: React.Dispatch<React.SetStateAction<boolean>>;
    configWorkflowData: ConfigWorkflowDataProps | null | undefined;
    setConfigWorkflowData: React.Dispatch<React.SetStateAction<ConfigWorkflowDataProps | null | undefined>>
}

export const WorkflowConfig = ({
    companyId,
    createdBy,
    setShowModuleAccess,
    setShowWorkflowConfig,
    configWorkflowData,
    setConfigWorkflowData
}: WorkflowConfigProps) => {

    const [levels, setLevels] = useState<LevelDataProps[]>([]);
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [roleId, setRoleId] = useState<string | null>(null);
    const [userName, setUserName] = useState("");
    const [selectedRoleUsers, setSelectedRoleUsers] = useState<any[]>([]);
    const [selectedApprovalUsers, setSelectedApprovalUsers] = useState<any[]>([]);
    const [selectedStores, setSelectedStores] = useState<any[]>([]);
    const [storeName, setStoreName] = useState("");
    const [stores, setStores] = useState<any[]>([]);
    const [storeAccessData, setStoreAccessData] = useState<any | null>();
    const [showApprovalUsersModal, setShowApprovalUsersModal] = useState(false);
    const [showApprovalUsersList, setShowApprovalUsersList] = useState(false);
    const [showStoresList, setShowStoresList] = useState(false);
    const [showAssignedUsersModal, setShowAssignedUsersModal] = useState(false);
    const [showAvailableActionsModal, setShowAvailableActionsModal] = useState(false);
    const [showConfirmReturnModal, setShowConfirmReturnModal] = useState(false);
    const [showConfirmStoreAccessModal, setShowConfirmStoreAccessModal] = useState(false);
    const [configData, setConfigData] = useState<ConfigWorkflowDataProps | null>();
    const [updatingStoreAccess, setUpdatingStoreAccess] = useState(false);
    const [temporaryLevelData, setTemporaryLevelData] = useState<LevelDataProps>({
        level: levels.length + 1,
        approverRole: null,
        approvalUsers: [],
        multipleApprovalRequired: false,
        active: true
    })

    const [superAdminOverride, setSuperAdminOverride] = useState(false);
    const [completeRejection, setCompleteRejection] = useState(false);

    useEffect(() => {
        console.log('configWorkflowData', configWorkflowData)
        setConfigData(configWorkflowData);
    }, [configWorkflowData])


    useEffect(() => {
        const fetchRoles = async () => {
            try {
                let query = supabase
                    .from('role_master')
                    .select('*')
                    .eq('is_active', true)
                    .neq('name', 'Super Admin')
                    .eq('company_id', companyId);

                const { data: roleData, error } = await query;

                if (error) throw error;

                setRoles(roleData);
            } catch (error) {
                console.log("Error fetching roles", error)
            }
        }

        fetchRoles();
    }, [])

    const fetchUsers = async () => {
        if (!roleId) return;
        try {
            let query = supabase
                .from('user_mgmt')
                .select(`*, department_id(id,department_name)`)
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
            if (selectedApprovalUsers.length > 0) {
                setSelectedRoleUsers(selectedApprovalUsers)
            } else {
                setSelectedRoleUsers(users.map(u => u.id))
            }
        } catch (error) {
            console.log("Error fetching users", error)
        }
    }

    useEffect(() => {
        fetchUsers();
    }, [roleId, userName])

    useEffect(() => {
        const fetchStores = async () => {
            if (!configData?.userStores) return;
            try {
                const storeIds: any = configData.userStores;
                let query = supabase
                    .from('store_mgmt')
                    .select('id,name,location_id')
                    .eq('company_id', companyId)
                    .eq('is_active', true)
                    .in('id', storeIds);

                if (storeName.trim()) {
                    query = query.ilike('name', `%${storeName}%`)
                }

                const { data: storeData, error: storesError } = await query;

                if (storesError) throw storesError;
                setStores(storeData);
                setSelectedStores(storeData.map(s => s.id))
            } catch (error) {
                console.log('Error fetching locations', error)
            }
        }
        fetchStores();
    }, [storeName, configData?.userStores])

    function toggleApprovalUsers(userId: string) {
        setSelectedRoleUsers(prev => {
            const prevUsers = new Set(prev);
            if (prevUsers.has(userId)) {
                prevUsers.delete(userId)
            } else {
                prevUsers.add(userId)
            }
            return Array.from(prevUsers)
        })
    }

    function toggleStores(storeId: string) {
        setSelectedStores(prev => {
            const prevStores = new Set(prev);
            if (prevStores.has(storeId)) {
                prevStores.delete(storeId)
            } else {
                prevStores.add(storeId)
            }
            return Array.from(prevStores)
        })
    }

    const filteredRoles = useMemo(() => {

        const assignedRoles = levels.filter(lvl => lvl.level !== temporaryLevelData.level).map(lvl => lvl.approverRole).filter(Boolean);
        return (roles.filter(role => !assignedRoles.includes(role.id)))

    }, [roles, levels, temporaryLevelData.level]);

    function handleUpdateLevelData(addLevel?: boolean | undefined, updateData?: boolean) {

        const updatedLevelData = levels.map((l) => l.level === temporaryLevelData.level ? temporaryLevelData : l);

        if (addLevel == true) {
            setLevels(updatedLevelData => {
                return [...updatedLevelData, {
                    level: levels.length + 1,
                    approverRole: null,
                    approvalUsers: [],
                    multipleApprovalRequired: false,
                    active: true
                }]
            })
        } else if (updateData != false) {
            setLevels(updatedLevelData);
        }

        setRoleId(null);
        setSelectedApprovalUsers([]);
        setSelectedRoleUsers([]);

        setTemporaryLevelData({
            level: levels.length + 1,
            approverRole: null,
            approvalUsers: [],
            multipleApprovalRequired: false,
            active: true
        })
        console.log('updatedLevelData', updatedLevelData)
    }

    const handleDeleteLevel = (levelNumber: number) => {
        console.log('temprary data before', temporaryLevelData)

        setLevels(prev => {
            let Levels = prev.filter(lvl => lvl.level !== levelNumber);
            const updatedLevels = Levels.map((lvl, index) => {
                return { ...lvl, level: index + 1 }
            })
            console.log('updatedLevels', updatedLevels);

            return updatedLevels
        })
        setTemporaryLevelData((prev) => {
            return { ...prev, level: levels.length }
        })
        console.log('temprary data', temporaryLevelData)
    }

    const handleUpdateStoreAccess = async () => {
        try {
            setUpdatingStoreAccess(true);
            if (!storeAccessData) return;
            console.log('storeAccessData', storeAccessData);
            const user_id = storeAccessData.userData.id;
            const location_id = storeAccessData.storeData?.location_id;
            const locationExists = storeAccessData.userData.locations.includes(location_id);
            console.log('locationExists', locationExists);
            let payload;
            if (locationExists) {
                payload = {
                    stores: [...storeAccessData.userData.stores, storeAccessData.storeData?.id]
                }
            } else {
                payload = {
                    locations: [...storeAccessData.userData.locations, location_id],
                    stores: [...storeAccessData.userData.stores, storeAccessData.storeData?.id]
                }
            }
            console.log('payload', payload);

            const { error } = await supabase
                .from('user_mgmt')
                .update(payload)
                .eq('id', user_id);

            if (error) {
                toast.error(error?.message)
                throw error;
            }

            setTimeout(() => {
                setUpdatingStoreAccess(false);
                setShowConfirmStoreAccessModal(false);
                setStoreAccessData(null);
                fetchUsers();
                toast.success("Store access updated successfully")
            }, 500);

        } catch (error) {
            console.log('Error updating store access', error);
        }
    }

    const handleSaveWorkflow = async () => {

        const selectedStoresList = stores.filter(store => selectedStores.includes(store.id)).map(store => {
            return { id: store.id, name: store.name }
        })
        const moduleId = configData?.selectedModule.module_id;

        const workflowLevelsPayload: any[] = [];
        levels.forEach((levelItem) => {
            configData?.assignedUsers.forEach((user) => {
                configData.selectedActions.forEach((action) => {
                    workflowLevelsPayload.push({
                        level: levelItem.level,
                        role_id: levelItem.approverRole,
                        override_enabled: superAdminOverride,
                        created_by: createdBy,
                        modified_by: createdBy,
                        company_id: companyId,
                        multiple_approvers_enabled: levelItem.multipleApprovalRequired,
                        approval_users: levelItem.approvalUsers,
                        full_rejection_enabled: completeRejection,
                        module_id: moduleId,
                        action_id: action.action_id,
                        assigned_to: user.id,
                        scope_level: "User",
                        status: levelItem.active,
                        is_active: true,
                        modified_at: new Date().toISOString(),
                        stores: selectedStoresList
                    })
                })
            })
        })

        if (workflowLevelsPayload.length > 0) {
            const { data, error } = await supabase
                .from('workflow_config')
                .insert(workflowLevelsPayload)
                .select();

            if (error) {
                toast.error(error?.message)
                throw error;
            }

            console.log('data', data);
            if (configData?.assignedUsers && moduleId) {
                for(const user of configData?.assignedUsers){
                        const {data:modulePrm} = await supabase
                        .from('module_permissions')
                        .select('permissions')
                        .eq('user_id',user.id)
                        .eq('module_id',moduleId)
                        .eq('company_id',companyId);

                        console.log(user.first_name,modulePrm[0]?.permissions);

                        if(modulePrm){
                            const selectedActionIds = configData.selectedActions.flatMap(action=>action.action_id)
                            const updatedPermissions = modulePrm[0]?.permissions.map(prm => {
                                if(selectedActionIds.includes(prm.action_id)){
                                    return {...prm,requiredworkflow:true}
                                }else{
                                    return {...prm}
                                }
                            });

                            const {data: updatedPrm} = await supabase
                        .from('module_permissions')
                        .update({permissions:updatedPermissions})
                        .eq('user_id',user.id)
                        .eq('module_id',moduleId)
                        .eq('company_id',companyId)
                        .select();

                            console.log('updatedPermissions data',updatedPrm)
                        }
                }
            }

            toast.success("Workflow Configuration Saved Successfully")
        }
    }

    return (
        <>
            <div className="p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    <Card className="min-h-[85vh] shadow-sm">
                        <CardHeader className="rounded-t-lg border-b pb-5">
                            <div className="flex items-center space-x-3 p-1">
                                <Button
                                    onClick={() => setShowConfirmReturnModal(true)}
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-slate-50 transition-colors duration-200 rounded-full"
                                >
                                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                                </Button>
                                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                                    <BadgeAlert className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                        Workflow Configuration
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Configure approval workflows for business processes.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 mx-1">
                            <div className="flex items-start gap-5 pr-4">
                                <div className="flex flex-col gap-1 justify-start w-1/3">
                                    <label className="text-sm font-semibold ps-1">Available Actions</label>
                                    <div className="flex items-center justify-between py-1 px-3 rounded-xl border bg-slate-50 w-full shadow-xs">
                                        {configData?.selectedActions && configData.selectedActions.length > 1 ? (
                                            <>
                                                <span className="text-gray-600 text-[14px]">{configData.selectedActions.length}{' '} Module Actions</span>
                                                <span
                                                    onClick={() => setShowAvailableActionsModal(true)} className="text-[13px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg py-1 px-2 cursor-pointer">View Actions
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-gray-600 py-1 font-semibold text-[14px]">{configData?.selectedModule.module_name}{' '}-{' '}{configData?.selectedActions[0].action_name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 justify-start w-1/3">
                                    <label className="text-sm font-semibold ps-1">Assigned Users</label>
                                    <div className="flex items-center justify-between py-1 px-3 rounded-xl border bg-slate-50 w-full shadow-xs">
                                        {configData?.assignedUsers && configData?.assignedUsers.length > 1 ? (
                                            <>
                                                <span className="text-gray-600 text-[14px]">Group users in <label className="font-semibold">{configData?.selectedModule.module_name}{' '}({configData?.assignedUsers.length})</label> </span>
                                                <span
                                                    onClick={() => setShowAssignedUsersModal(true)} className="text-[13px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg py-1 px-2 cursor-pointer">View Users
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-gray-600 py-1 font-semibold text-[14px] capitalize">{configData?.assignedUsers[0].first_name}{' '}{configData?.assignedUsers[0].last_name}</span>
                                        )}
                                    </div>
                                </div>
                                {configData?.selectedModule.is_store_specific &&
                                    <div className="flex flex-col gap-1 justify-start w-[320px]">
                                        <label className="text-sm font-semibold ps-1">Store</label>
                                        <div className="">
                                            <Popover open={showStoresList} onOpenChange={setShowStoresList} modal={false}>
                                                <PopoverTrigger
                                                    type="button" className="rounded-md border border-slate-200 w-full flex justify-between items-center px-2 py-1.5">
                                                    {selectedStores.length > 0 ?
                                                        <div className="flex flex-col gap-1 flex-wrap items-start">
                                                            {selectedStores.map((s) => {
                                                                const store = stores.find(store => store.id === s)
                                                                return (
                                                                    <span key={store.id} className=" px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-lg">{store?.name} </span>
                                                                )
                                                            }
                                                            )}
                                                        </div>
                                                        :
                                                        <span className="text-sm p-0.5 text-gray-500">Select Stores</span>
                                                    }
                                                    <ChevronUp size={15} className={` text-gray-500 ${showStoresList ? 'transition-all duration-300' : 'rotate-180 transition-all duration-300'}`} />
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    style={{ width: "var(--radix-popover-trigger-width)" }} className="p-0 rounded-md overflow-hidden pointer-events-auto">
                                                    <div className="bg-white text-sm rounded-b-md w-full ">
                                                        <div className="bg-gray-100 px-2 py-4 ">
                                                            <Input className="bg-white" placeholder="Search stores.."
                                                                value={storeName}
                                                                onChange={(e) => {
                                                                    setStoreName(e.target.value)
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex flex-col ">
                                                            {stores.length > 0 ? (
                                                                <>
                                                                    <span className={`w-full flex justify-start items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 text-xs font-semibold uppercase`}>
                                                                        <Checkbox
                                                                            checked={stores.length === selectedStores.length}
                                                                            onCheckedChange={() => {
                                                                                if (stores.length === selectedStores.length) {
                                                                                    setSelectedStores([])
                                                                                } else {
                                                                                    setSelectedStores(stores.map(s => s.id))
                                                                                    setShowStoresList(false)
                                                                                }
                                                                            }}
                                                                            className="shadow-xs border-gray-300 w-4 h-4" />
                                                                        <label>Select All</label>
                                                                    </span>
                                                                    <div className="flex flex-col max-h-[160px] overflow-y-auto">
                                                                        {stores.map((store) => {
                                                                            const selectedStore = selectedStores.includes(store.id)
                                                                            return (
                                                                                <span
                                                                                    key={store.id} className={`w-full flex justify-start items-center gap-2 px-4 py-2 capitalize hover:bg-gray-50`}>
                                                                                    <Checkbox
                                                                                        checked={selectedStore}
                                                                                        onCheckedChange={() => toggleStores(store.id)}
                                                                                        className="shadow-xs border-gray-300 w-4 h-4" />
                                                                                    <label>{store.name}</label></span>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="flex justify-center items-center py-10 text-gray-600">No matching stores found</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                }
                            </div>
                            <div className="rounded-lg border shadow p-4 space-y-3 my-8">
                                <div className="rounded-md shadow border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead className="text-center py-3 cursor-default hover:text-blue-600">Level</TableHead>
                                                <TableHead className="text-center w-[220px] cursor-default hover:text-blue-600"> Approver Role</TableHead>
                                                <TableHead className="text-center w-[200px] cursor-default hover:text-blue-600">Approval Users</TableHead>
                                                <TableHead className="ps-10 cursor-default hover:text-blue-600">Multiple Approval Required</TableHead>
                                                <TableHead className="w-[100px] cursor-default hover:text-blue-600">Active</TableHead>
                                                <TableHead className="ps-5 cursor-default hover:text-blue-600">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {levels.length > 0 &&
                                                levels.map((level: LevelDataProps, index: number) => {
                                                    let roleData = '';
                                                    if (level.approverRole) {
                                                        const role = roles.find(role => role.id === level.approverRole)
                                                        roleData = role?.name
                                                    } else {
                                                        roleData = "No role Selected"
                                                    }
                                                    return (
                                                        <TableRow key={index}>
                                                            <TableCell className="text-center font-semibold">{level.level}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center justify-center py-2">
                                                                    {temporaryLevelData.level === level.level ?
                                                                        <Select
                                                                            value={roleId || undefined}
                                                                            onValueChange={(value) => {
                                                                                setRoleId(value);
                                                                                setSelectedApprovalUsers([]);
                                                                                setSelectedRoleUsers([])
                                                                                setTemporaryLevelData(prev => {

                                                                                    return {
                                                                                        ...prev,
                                                                                        approverRole: value,
                                                                                    }

                                                                                })
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-[170px] bg-white">
                                                                                <SelectValue placeholder="Select Role" />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="max-h-[350px]">
                                                                                {filteredRoles.map((role) => (
                                                                                    <SelectItem key={role.id} value={role.id}>
                                                                                        {role.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        :
                                                                        (
                                                                            <span className={` ${level.approverRole ? 'bg-gray-100 border rounded-lg px-2 font-semibold text-gray-800 text-center text-[13px]' : 'italic ps-1 text-gray-400'}`}>
                                                                                {roleData}
                                                                            </span>
                                                                        )
                                                                    }
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {temporaryLevelData.level === level.level ?
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex items-center justify-center">
                                                                                <button
                                                                                    disabled={!temporaryLevelData.approverRole}
                                                                                    onClick={() => setShowApprovalUsersModal(true)}
                                                                                    className={` font-semibold py-1.5 px-3 border rounded-md shadow-xs ${temporaryLevelData.approverRole ? 'cursor-pointer hover:bg-gray-100 hover:text-blue-900 ' : 'cursor-not-allowed text-gray-400 '}`}>{selectedApprovalUsers.length > 0 ? `Selected Users (${selectedApprovalUsers.length})` : 'Select Users'}
                                                                                </button>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        {!temporaryLevelData.approverRole &&
                                                                            <TooltipContent>Select approver role first </TooltipContent>
                                                                        }
                                                                    </Tooltip>
                                                                    :
                                                                    <div className="flex items-center justify-center">
                                                                        <span className="bg-gray-100 rounded-lg px-2.5 py-0.5 font-semibold text-gray-800 text-[13px]">{level.approvalUsers.length} users</span>
                                                                    </div>
                                                                }
                                                            </TableCell>
                                                            <TableCell className="ps-11">
                                                                {temporaryLevelData.level === level.level ?
                                                                    <Checkbox
                                                                        checked={temporaryLevelData.multipleApprovalRequired}
                                                                        onCheckedChange={() => {
                                                                            if (temporaryLevelData.multipleApprovalRequired) {
                                                                                setTemporaryLevelData(prev => {
                                                                                    return { ...prev, multipleApprovalRequired: false }
                                                                                })
                                                                            } else {
                                                                                setTemporaryLevelData(prev => {
                                                                                    return { ...prev, multipleApprovalRequired: true }
                                                                                })
                                                                            }
                                                                        }}
                                                                        className="border rounded-xs border-gray-800 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                                                    :
                                                                    level.multipleApprovalRequired ? (
                                                                        <Check size={20} className="text-green-600" />
                                                                    ) : (
                                                                        <X size={18} className="text-red-600" />
                                                                    )
                                                                }
                                                            </TableCell>
                                                            <TableCell>
                                                                {temporaryLevelData.level === level.level ?
                                                                    <Checkbox
                                                                        checked={temporaryLevelData.active}
                                                                        onCheckedChange={() => {
                                                                            if (temporaryLevelData.active) {
                                                                                setTemporaryLevelData(prev => {
                                                                                    return { ...prev, active: false }
                                                                                })
                                                                            } else {
                                                                                setTemporaryLevelData(prev => {
                                                                                    return { ...prev, active: false }
                                                                                })
                                                                            }
                                                                        }}
                                                                        className="border rounded-xs border-gray-800 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                                                    :
                                                                    level.active ? (
                                                                        <Check size={20} className="text-green-600" />
                                                                    ) : (
                                                                        <X size={18} className="text-red-600" />
                                                                    )
                                                                }
                                                            </TableCell>
                                                            <TableCell>
                                                                {temporaryLevelData.level === level.level ?
                                                                    <span className="flex gap-5 items-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                if (!temporaryLevelData.approverRole) {
                                                                                    toast.error("Please select an approval role")
                                                                                    return;
                                                                                }
                                                                                if (temporaryLevelData.approverRole && temporaryLevelData.approvalUsers.length === 0) {
                                                                                    toast.error("Please select atleast one approval user")
                                                                                    return;
                                                                                }
                                                                                handleUpdateLevelData();
                                                                            }}
                                                                            className="px-3 py-1 rounded-lg font-semibold hover:bg-gray-100">Apply</button>
                                                                        <button
                                                                            onClick={() => {
                                                                                handleUpdateLevelData(undefined, false)
                                                                            }}
                                                                            className="px-3 py-1 rounded-lg font-semibold hover:bg-gray-100">Cancel</button>
                                                                    </span>
                                                                    :
                                                                    <span className="flex gap-3 items-center px-3 py-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                console.log('approvalUsers', level.approvalUsers)
                                                                                setTemporaryLevelData({ ...level });
                                                                                setRoleId(level.approverRole ?? null);
                                                                                setSelectedApprovalUsers(level.approvalUsers);
                                                                                // setSelectedRoleUsers(level.approvalUsers);
                                                                            }}
                                                                            className="p-2 rounded-md shadow border font-semibold hover:bg-gray-100"><Edit size={16} /></button>
                                                                        <button
                                                                            onClick={() => handleDeleteLevel(level.level)}
                                                                            className=" p-2 rounded-md border font-semibold shadow hover:bg-gray-100"><Trash2 size={16} className="text-red-500" /></button>
                                                                    </span>
                                                                }
                                                            </TableCell>
                                                        </TableRow>

                                                    )
                                                })}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="mt-4 mb-6 flex justify-start items-center">
                                    <Button
                                        onClick={() => {
                                            if (levels.length === 0) {
                                                setLevels(prev => {
                                                    return [...prev, temporaryLevelData]
                                                })
                                            } else {
                                                handleUpdateLevelData(true);
                                            }
                                        }} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-700 transition-colors duration-200 ">
                                        <Plus className="mx-1" /><span>Add Level</span>
                                    </Button>
                                </div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-2 w-fit">
                                            <Checkbox
                                                checked={superAdminOverride}
                                                onCheckedChange={() => setSuperAdminOverride(!superAdminOverride)}
                                                className="border rounded-xs border-gray-800 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                            <label>Allow SuperAdmin to override all approval levels</label>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>When enabled, SuperAdmins can approvals for all levels in this process.</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex items-center gap-2 w-fit">
                                            <Checkbox
                                                checked={completeRejection}
                                                onCheckedChange={() => setCompleteRejection(!completeRejection)}
                                                className="border rounded-xs border-gray-800 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                            <label>Enable Complete rejection</label>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[400px] flex flex-wrap">When enabled, rejecting at any approval level will fully reject the document
                                        instead of sending it back to the previous approval level.
                                    </TooltipContent>
                                </Tooltip>
                                <div className="flex justify-end items-center my-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    disabled={levels.length === 0 || levels.some(lvl => lvl.approverRole === null)}
                                                    onClick={() => handleSaveWorkflow()}
                                                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-700 transition-colors duration-200 ">
                                                    <span>Save Workflow</span>
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        {levels.length === 0 &&
                                            <TooltipContent>Please select atleast one level.</TooltipContent>
                                        }
                                        {levels.length > 0 && levels.some(lvl => lvl.approverRole === null) &&
                                            <TooltipContent>All levels must have an approver role.</TooltipContent>
                                        }
                                    </Tooltip>
                                </div>

                            </div>
                            <div className="flex justify-end items-center border-t pt-4">
                                <Button className="bg-[#542ce6] hover:bg-[#5e33f9] transition-colors duration-200 ">
                                    <span>Return to Permissions</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={showApprovalUsersModal} onOpenChange={() => setShowApprovalUsersModal(false)}>
                <DialogContent className="md:max-w-[50vw] p-0 gap-0 rounded-xl overflow-hidden">
                    <DialogHeader className="px-5 py-2 bg-white">
                        <DialogTitle className="text-gray-800 ps-1 my-2 text-lg font-semibold">
                            Select Approval Users
                        </DialogTitle>
                    </DialogHeader>
                    <div className="px-5">
                        <Popover open={showApprovalUsersList} onOpenChange={setShowApprovalUsersList} modal={false}>
                            <PopoverTrigger
                                type="button" className="rounded-md border border-slate-300 w-full bg-slate-50 flex justify-between items-center p-2">
                                {selectedRoleUsers.length > 0 ?
                                    <span className="bg-blue-50 px-2 p-1 text-xs font-semibold text-blue-600 rounded-lg">{selectedRoleUsers.length} users selected</span> :
                                    <span className="text-sm p-0.5">Select Users</span>
                                }
                                <ChevronUp size={15} className={` text-gray-500 ${showApprovalUsersList ? 'transition-all duration-300' : 'rotate-180 transition-all duration-300'}`} />
                            </PopoverTrigger>
                            <PopoverContent
                                style={{ width: "var(--radix-popover-trigger-width)" }} className="p-0 rounded-md overflow-hidden pointer-events-auto">
                                <div className="bg-white text-sm rounded-b-md w-full ">
                                    <div className="bg-gray-100 px-2 py-4 ">
                                        <Input className="bg-white" placeholder="Search users.."
                                            value={userName}
                                            onChange={(e) => {
                                                setUserName(e.target.value)
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-col ">
                                        {users.length > 0 ? (
                                            <>
                                                <span className={`w-full flex justify-start items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 text-xs font-semibold uppercase`}>
                                                    <Checkbox
                                                        checked={users.length === selectedRoleUsers.length}
                                                        onCheckedChange={() => {
                                                            if (users.length === selectedRoleUsers.length) {
                                                                setSelectedRoleUsers([])
                                                            } else {
                                                                setSelectedRoleUsers(users.map(u => u.id))
                                                                setShowApprovalUsersList(false)
                                                            }
                                                        }}
                                                        className="shadow-xs border-gray-300 w-4 h-4" />
                                                    <label>Select All Users</label>
                                                </span>
                                                {users.slice(0, 4).map((user) => {
                                                    const selectedUser = selectedRoleUsers.includes(user.id)
                                                    return (
                                                        <span
                                                            key={user.id} className={`w-full flex justify-start items-center gap-2 px-4 py-2.5 border-t rounded-lg hover:bg-gray-50`}>
                                                            <Checkbox
                                                                checked={selectedUser}
                                                                onCheckedChange={() => toggleApprovalUsers(user.id)} className="shadow-xs border-gray-300 w-4 h-4" />
                                                            <label>{user.first_name}{' '}{user.last_name}</label></span>
                                                    )
                                                })}
                                            </>
                                        ) : (
                                            <span className="flex justify-center items-center py-10 text-gray-600">No matching users found</span>
                                        )}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className={`rounded-md shadow ${showApprovalUsersList ? 'min-h-[30vh]' : 'min-h-[8vh]'} max-h-[30vh] pr-2 border bg-slate-50  overflow-y-auto my-8 mx-6`}>
                        {selectedRoleUsers.length > 0 ? (
                            selectedRoleUsers.map(userId => {
                                const user = users.find(user => user.id === userId);

                                return (
                                    <div key={user?.id} className="grid grid-cols-[30%_60%_5%] items-center gap-4 bg-gray-50 border-l-2 border-b border-l-blue-400 border-b-gray-200 p-3">
                                        <div className="flex flex-col justify-start shrink-0">
                                            <label className="text-sm font-semibold text-gray-700 capitalize">{user.first_name}{' '}{user.last_name}</label>
                                            <span className="text-xs text-gray-500">Dept. {user.department_id.department_name}</span>
                                        </div>
                                        <div>
                                            {configData?.selectedModule.is_store_specific &&
                                                <div className="flex gap-4 flex-wrap items-center">
                                                    {selectedStores.map((store) => {
                                                        const storeData = stores.find(s => s.id === store)
                                                        // const alreadyConfiguredStores = data?.workflow[0].stores;

                                                        // const configuredStore = alreadyConfiguredStores.filter(s => s.id === store.id);
                                                        // const isConfiguredStore = configuredStore.length > 0;
                                                        const hasStoreAccess = user?.stores.includes(store)

                                                        return (
                                                            <div key={store}>

                                                                <span className="flex justify-start items-center font-semibold gap-2 py-1 px-2 border w-fit bg-white rounded-md shadow">
                                                                    <Checkbox
                                                                        checked={hasStoreAccess}
                                                                        disabled={hasStoreAccess}
                                                                        onCheckedChange={() => {
                                                                            setShowConfirmStoreAccessModal(true)
                                                                            setStoreAccessData({ userData: user, storeData: storeData })
                                                                        }}
                                                                    />
                                                                    <span className={`text-xs `}>{storeData.name}</span>
                                                                </span>

                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            }</div>
                                        <div className="flex justify-center shrink-0">
                                            <X
                                                onClick={() => toggleApprovalUsers(user.id)}
                                                size={22} className="text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200 rounded-full p-1" />
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="w-full h-full flex justify-center items-center py-10">
                                <span className="text-gray-500 font-semibold">No Users Selected</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="bg-white border-t px-5 py-4 rounded-b-xl">
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={selectedRoleUsers.length === 0}
                                onClick={() => {
                                    setShowApprovalUsersModal(false);
                                    setSelectedApprovalUsers(selectedRoleUsers);
                                    setTemporaryLevelData(prev => {

                                        return {
                                            ...prev,
                                            approvalUsers: selectedRoleUsers
                                        }

                                    })
                                }}
                                variant="default">
                                Done
                            </Button>

                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showAvailableActionsModal} onOpenChange={setShowAvailableActionsModal}>
                <DialogContent className="!max-w-[32vw] rounded-xl bg-slate-50">
                    <DialogHeader className="mb-5">
                        <DialogTitle className="">
                            Available Actions ({configData?.selectedActions.length})
                        </DialogTitle>
                        <DialogDescription>This workflow configuration includes the following actions.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
                        {configData?.selectedActions && configData.selectedActions.length > 0 &&
                            configData?.selectedActions.map(action =>
                                <div key={action.action_id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
                                    <span className="w-9 h-8 rounded-full p-4 bg-green-100 flex items-center justify-center uppercase text-green-600 text-[18px] font-semibold">
                                        {configData.selectedModule.module_name?.[0]}
                                    </span>
                                    <div className="flex flex-col justify-start">
                                        <span className="font-semibold capitalize text-[14px]">{configData.selectedModule.module_name}{' '}-{' '}{action.action_name}</span>
                                    </div>
                                </div>
                            )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showAssignedUsersModal} onOpenChange={setShowAssignedUsersModal}>
                <DialogContent className="max-w-[35vw] rounded-xl bg-slate-50">
                    <DialogHeader className="mb-5">
                        <DialogTitle className="">
                            Assigned Users ({configData?.assignedUsers.length})
                        </DialogTitle>
                        <DialogDescription>This workflow configuration applies to the following users.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
                        {configData?.assignedUsers && configData?.assignedUsers.length > 0 &&
                            configData?.assignedUsers.map(user =>
                                <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
                                    <span className="w-9 h-8 rounded-full p-4 bg-blue-100 flex items-center justify-center uppercase text-blue-600 font-medium">
                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                    </span>
                                    <div className="flex flex-col justify-start">
                                        <span className="font-semibold capitalize text-[14px]">{user.first_name}{' '}{user.last_name}</span>
                                        <span className="text-xs text-gray-500">{user.email}</span>
                                    </div>
                                </div>
                            )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showConfirmReturnModal} onOpenChange={setShowConfirmReturnModal}>
                <DialogContent className="w-md rounded-lg bg-slate-50">
                    <DialogHeader className="">
                        <DialogTitle className="mb-2">
                            Return to Permissions
                        </DialogTitle>
                        <DialogDescription ><p className="text-gray-900">Are you sure you want to return to the Module & Access page?</p></DialogDescription>
                    </DialogHeader>
                    <div className="py-3">
                        <p className="text-red-500 text-[14px]">Any unsaved module permissions and workflow configurations will be lost.</p>
                    </div>
                    <DialogFooter className="mt-1">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-lg" variant="outline" onClick={() => {
                                setShowConfirmReturnModal(false);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowWorkflowConfig(false);
                                    setShowModuleAccess(true);
                                    setConfigWorkflowData(null);
                                }}
                                className="py-4 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                Confirm Return
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showConfirmStoreAccessModal} onOpenChange={setShowConfirmStoreAccessModal}>
                <DialogContent className="w-md rounded-lg bg-slate-50">
                    <DialogHeader className="">
                        <DialogTitle className="capitalize">
                            Update user store access
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-1">
                        <p className="text-gray-800 text-[14px]">Are you sure you want to grant access to this store for this user?</p>
                    </div>
                    <DialogFooter className="mt-2">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-lg" variant="outline" onClick={() => {
                                setShowConfirmStoreAccessModal(false);
                                setStoreAccessData(null);
                            }}>
                                Cancel
                            </Button>
                            <Button
                                disabled={updatingStoreAccess}
                                onClick={() => {
                                    handleUpdateStoreAccess();
                                }}
                                className="py-4 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                {updatingStoreAccess ? 'Updating' : 'Confirm'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
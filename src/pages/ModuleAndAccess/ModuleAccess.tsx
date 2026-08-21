import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/Utils/types/supabaseClient"
import { AlertCircle, CheckCircleIcon, ChevronDown, ChevronRight, ChevronUp, Circle, Filter, GripVerticalIcon, Search, Settings, ShieldCheck, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ViewUsersModal } from "./ViewUsersModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ManageWorkflowModal } from "./ManageWorkflowModal";


export const ModuleAccess = () => {

    const user = localStorage.getItem("userData");
    const userData = JSON.parse(user || '{}');
    const companyId = userData?.company_id || null;

    const [parentModules, setParentModules] = useState([]);
    const [modules, setModules] = useState([]);
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [actions, setActions] = useState<any[]>([]);
    const [parentId, setParentId] = useState('all');
    const [moduleId, setModuleId] = useState('all');
    const [roleId, setRoleId] = useState(null);
    const [userId, setUserId] = useState<string>('all');
    const [roleName, setRoleName] = useState("");
    const [userName, setUserName] = useState("");
    const [isRolesOpen, setRolesOpen] = useState(false);
    const [isUsersOpen, setUsersOpen] = useState(false);

    const [groupedSections, setGroupedSections] = useState<any[]>([]);
    const [expandedGroup, setExpandedGroup] = useState<Set<number>>(new Set([0]));

    const [expandedParents, setExpandedParents] = useState<Set<string>>();
    const [expandedModules, setExpandedModules] = useState<Set<string>>();
    const [showUsersModal, setShowUsersModal] = useState(false);
    const [singleActionModal, setSingleActionModal] = useState(false);
    const [multipleActionModal, setMultipleActionModal] = useState(false);
    const [manageWorkflowModal, setManageWorkflowModal] = useState(false);
    const [groupedUsers, setGroupedUsers] = useState<any[]>([]);
    const [loadPermission, setLoadPermission] = useState<boolean>(false);
    const [selectedAction, setSelectedAction] = useState();
    const [selectedMultipleActions, setSelectedMultipleActions] = useState([]);
    const [manageWorkflowData, setManageWorkflowData] = useState({});
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        const fetchParentModules = async () => {
            try {
                const { data: parentModules, error } = await supabase
                    .from('parent_modules')
                    .select()
                    .order('parent_order');

                if (error) throw error;

                console.log("parent modules", parentModules)
                setParentModules(parentModules);
            } catch (error) {
                console.log("Error fetching parent modules", error)
            }
        }

        const fetchModules = async () => {
            try {
                let query = supabase
                    .from('main_modules')
                    .select()
                    .order('module_order');

                if (parentId !== "all") {
                    query = query.eq('parent_id', parentId)
                }

                const { data: modules, error } = await query;

                if (error) throw error;

                console.log("modules", modules)

                let moduleData = [];
                for (const m of modules) {
                    const subModules = typeof m.selected_submodules === 'string' ? JSON.parse(m.selected_submodules) : m.selected_submodules;
                    let selectedSubModules: any = [];
                    if (subModules.length > 0) {
                        const subModulesArray = subModules.flatMap((sub) => sub.subModule_id)

                        const { data } = await supabase
                            .from('available_submodules')
                            .select('id,submodule_name')
                            .in('id', subModulesArray);

                        if (data) {
                            selectedSubModules = data;
                        }
                        console.log('selectedSubModules', selectedSubModules)
                    }
                    moduleData.push({ ...m, selected_submodules: selectedSubModules })
                }
                console.log('moduleData', moduleData)
                setModules(moduleData);
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
                    .select()
                    .eq('is_active', true)
                    .eq('company_id', companyId);

                if (roleName.trim()) {
                    query = query.ilike('name', `%${roleName}%`)
                }

                const { data: roles, error } = await query;

                if (error) throw error;

                console.log("roles", roles)
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
                    .select()
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

                console.log("users", users)
                setUsers(users);
            } catch (error) {
                console.log("Error fetching users", error)
            }
        }

        fetchUsers();

    }, [roleId, userName])

    useEffect(() => {
        console.log('fetchActions')
        const fetchActions = async () => {
            try {
                const { data: actions, error } = await supabase
                    .from('available_actions')
                    .select('id,action_name');

                if (error) throw error;

                console.log("actions ", actions)
                setActions(actions);
            } catch (error) {
                console.log("Error fetching parent modules", error)
            }
        }

        fetchActions();

    }, [])


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


    let filteredTree = []
    if (parentId !== "all") {
        const parentModule = parentModules.find((p) => p.id === parentId)
        filteredTree.push({
            parentModule: parentModule.module_name,
            parentId: parentModule.id,
            modules: modules
        })

    } else {
        parentModules.map((p) => {
            const Modules = modules.filter((m) => m.parent_id === p.id)

            filteredTree.push({
                parentModule: p.module_name,
                parentId: p.id,
                modules: Modules
            })
        })
    }

    const fetchGroupedModuleAccess = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase.rpc("get_grouped_module_access", {
                p_company_id: companyId,
                p_role_ids: roleId ? [roleId] : [],
                p_user_id: userId !== "all" ? userId : null,
            })

            if (error) throw error;
            console.log("fetchGroupedModuleAccess", data)
            setGroupedSections(data as any[]);
            setExpandedGroup(new Set([0]));
            setExpandedParents(new Set());
            setExpandedModules(new Set());
            console.log("filteredTree", filteredTree)
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


    let selectedParent = "";
    let selectedModule = "";
    let selectedRole = "";
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

                                                        return (
                                                            <div key={index} className="py-2">
                                                                <Collapsible
                                                                    open={isGroupOpen}
                                                                    onOpenChange={() => toggleExpandedSection(index)}
                                                                    className="flex w-full flex-col gap-2"
                                                                >
                                                                    <CollapsibleTrigger asChild>
                                                                        <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-md">
                                                                            <div className="flex items-center gap-3">
                                                                                {multipleUsers ? (
                                                                                    <Users className="h-10 w-10 p-2 text-green-500 bg-green-100 rounded-md" />
                                                                                ) : (
                                                                                    <User className="h-10 w-10 p-2 text-green-500 bg-green-100 rounded-md" />
                                                                                )}
                                                                                <div className="flex flex-col items-start gap-1">
                                                                                    <h4 className="text-sm font-semibold text-gray-700">{multipleUsers ? `Group No. ${index + 1}` : user.first_name + (' ') + user.last_name}</h4>
                                                                                    <span className="text-xs text-gray-500 font-semibold">{multipleUsers ? (
                                                                                        <span onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            setShowUsersModal(true);
                                                                                            setGroupedUsers(grp.users);
                                                                                        }} className="text-blue-500 hover:underline hover:text-blue-600">View Users</span>
                                                                                    ) : user.email}</span>
                                                                                </div>
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

                                                                                <div className="w-[50%] grid grid-cols-[30%_68%] gap-3">
                                                                                    <div className=" text-xs font-semibold text-gray-600 border px-2 py-1 rounded-md shadow"><span className=" text-green-600 mr-2">Action</span>Requires Workflow</div>
                                                                                    <div className="flex gap-2 items-center text-xs border px-2 py-1 rounded-md shadow">
                                                                                        <span className="items-center uppercase text-[12px] text-gray-500 font-semibold">access level :</span>
                                                                                        <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 py-0">
                                                                                            granted
                                                                                        </Badge>
                                                                                        <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 py-0">
                                                                                            denied
                                                                                        </Badge>
                                                                                        <Progress value={56} className="max-w-[100px]" /><span>56%</span>
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
                                                                                                const expandedParent = expandedParents.has(key);

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
                                                                                                            item.modules.map((m, moduleIndex) => {
                                                                                                                let expandedModule;
                                                                                                                if (m.selected_submodules.length > 0) {

                                                                                                                    const key = `${index},${i},${moduleIndex}`;
                                                                                                                    expandedModule = expandedModules?.has(key);
                                                                                                                }
                                                                                                                const modulePermission = permissions.flatMap((module) => module).filter((mod) => mod.module_id === m.id);
                                                                                                                let permittedActions = [];
                                                                                                                let permittedSubModules = [];
                                                                                                                if (modulePermission.length > 0) {
                                                                                                                    permittedActions = modulePermission[0]?.permissions.map(actions => actions)
                                                                                                                    if(modulePermission[0]?.submodule_permissions){
                                                                                                                        permittedSubModules = modulePermission[0]?.submodule_permissions
                                                                                                                    }
                                                                                                                }

                                                                                                                const moduleAccessAction = m.available_actions.slice(0, 1)
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
                                                                                                                                                        <Checkbox className="data-[state=checked]:bg-white data-[state=checked]:text-gray-800 data-[state=checked]:border-gray-500" />
                                                                                                                                                        <label className="text-[13px] text-gray-500 font-semibold">All</label>
                                                                                                                                                    </span>
                                                                                                                                                    <span className="flex items-center gap-2">
                                                                                                                                                        <Checkbox 
                                                                                                                                                        checked={isModuleAccessEnabled}
                                                                                                                                                        />
                                                                                                                                                        <label className="text-[13px] text-gray-600 hover:text-blue-700 font-semibold">Module Access</label>
                                                                                                                                                    </span>
                                                                                                                                                </div>
                                                                                                                                                <div className="flex items-center gap-4 space-x-2 ps-4 border-l-1">
                                                                                                                                                    <span className="text-xs text-gray-400 italic">Sub-screens only</span>
                                                                                                                                                </div>
                                                                                                                                            </div>
                                                                                                                                            <span className="flex items-center justify-end pr-2 "><Settings className="h-6 w-6 text-gray-500 p-1 rounded-full hover:bg-blue-100 hover:text-blue-500 transition duration-200" /></span>
                                                                                                                                        </div>
                                                                                                                                    </TableCell>
                                                                                                                                </TableRow>
                                                                                                                                {expandedModule &&
                                                                                                                                    m.selected_submodules.map((sub) => {
                                                                                                                                         const isPermittedSubModule = permittedSubModules.flatMap(subModules => subModules).filter((subModule) => (subModule.sub_module_id === sub.id) && (subModule.isAllowed))
                                                                                                                                        const isPermitted = isPermittedSubModule.length > 0;

                                                                                                                                        return(
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
                                                                                                                                                checked={isPermitted && isModuleAccessEnabled}
                                                                                                                                                        />
                                                                                                                                                    <span className="flex items-center gap-1">
                                                                                                                                                        <label className={`text-[13px] font-semibold ${isModuleAccessEnabled? 'text-gray-600' : 'text-gray-400'}`}>Sub Module</label>
                                                                                                                                                    {!isModuleAccessEnabled && (
                                                                                                                                                <AlertCircle className="w-3 h-3 text-gray-400"/>
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
                                                                                                                                    )})
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
                                                                                                                                                        onCheckedChange={() => {
                                                                                                                                                            const isRequireWorkflowActions = m.available_actions.filter((a) => a.requires_approval === true)
                                                                                                                                                            if (isRequireWorkflowActions.length > 0) {
                                                                                                                                                                setMultipleActionModal(true);
                                                                                                                                                                const actionData = isRequireWorkflowActions.map((action) => {
                                                                                                                                                                    const actionName = actions.filter((a) => a.id === action.action_id).map((item) => item.action_name)

                                                                                                                                                                    return (
                                                                                                                                                                        { ...action, actionName: actionName }
                                                                                                                                                                    )
                                                                                                                                                                })
                                                                                                                                                                setSelectedMultipleActions(actionData);
                                                                                                                                                            }
                                                                                                                                                        }}
                                                                                                                                                        className="data-[state=checked]:bg-white data-[state=checked]:text-gray-800 data-[state=checked]:border-gray-500" />
                                                                                                                                                    <label className="text-[13px] text-gray-600 font-semibold">All</label>
                                                                                                                                                </span>
                                                                                                                                                <span className="flex items-center gap-2">
                                                                                                                                                    <Checkbox
                                                                                                                                                        checked={isModuleAccessEnabled}
                                                                                                                                                    />
                                                                                                                                                    <label className="text-[13px] text-gray-600 hover:text-blue-700 font-semibold">Module Access</label>
                                                                                                                                                </span>
                                                                                                                                            </div>
                                                                                                                                            <div className="flex items-center flex-wrap gap-4 space-x-2 ps-5 border-l-1">
                                                                                                                                                {m.available_actions.length > 1 &&
                                                                                                                                                    m.available_actions.slice(1).map((a) => {
                                                                                                                                                        const actionName = actions.filter((action) => action.id === a.action_id).map((item) => item.action_name)
                                                                                                                                                        const isPermittedAction = permittedActions.flatMap(actions => actions).filter((action) => (action.action_id === a.action_id) && (action.isAllowed))
                                                                                                                                                        const isPermitted = isPermittedAction.length > 0;

                                                                                                                                                        return (
                                                                                                                                            <Tooltip>
                                                                                                                                                <TooltipTrigger asChild>

                                                                                                                                            <span key={a.action_id} className="flex items-center gap-2">
                                                                                                                                                <Checkbox 
                                                                                                                                                disabled={!isModuleAccessEnabled}
                                                                                                                                                checked={isPermitted && isModuleAccessEnabled}
                                                                                                                                                onCheckedChange={()=>{
                                                                                                                                                    if(a.requires_approval){
                                                                                                                                                        setSingleActionModal(true);
                                                                                                                                                        const actionData = {...a,actionName: actionName}
                                                                                                                                                        setSelectedAction(actionData);
                                                                                                                                                    }
                                                                                                                                                }}
                                                                                                                                                />
                                                                                                                                                <span className="flex items-center gap-1">
                                                                                                                                                    <label className={`text-[13px] font-semibold ${isModuleAccessEnabled? 'text-gray-600' : 'text-gray-400'}`}>{actionName}</label>
                                                                                                                                                    {!isModuleAccessEnabled && (

                                                                                                                                                <AlertCircle className="w-3 h-3 text-gray-400"/>
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
                                                                                                                                        <span onClick={()=>{
                                                                                                                                            setManageWorkflowModal(true)
                                                                                                                                            setManageWorkflowData(m)
                                                                                                                                        }} className="flex items-center justify-end pr-2"><Settings className="h-6 w-6 text-gray-500 p-1 rounded-full hover:bg-blue-100 hover:text-blue-500 transition duration-200" /></span>
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

            <Dialog open={singleActionModal} onOpenChange={setSingleActionModal}>
                <DialogContent className="w-md p-0 gap-0">
                    <DialogHeader className="p-5 border-b border-gray-300">
                        <DialogTitle className="text-blue-700">Configure Action Workflow</DialogTitle>
                    </DialogHeader>
                    <div className=" bg-gray-50 p-5 rounded-b-md space-y-4">
                        <p className="flex flex-wrap gap-1 text-gray-700 py-4 pr-4">
                            <span>Do you want to configure an approval workflow for the</span>
                            <label className="font-bold">{selectedAction?.actionName}</label>
                            <span>action?</span>
                        </p>
                        <div className="flex justify-end gap-2 mt-2">
                            <Button variant="outline" onClick={() => setSingleActionModal(false)}>
                                No
                            </Button>
                            <Button className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                Yes, Configure Workflow
                            </Button>

                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={multipleActionModal} onOpenChange={setMultipleActionModal}>
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
                                            <Checkbox className="w-5 h-5 border-2 border-blue-400 data-[state=checked]:bg-blue-400 data-[state=checked]:text-white data-[state=checked]:border-blue-400" />
                                            <label className="text-sm text-gray-600 font-semibold">{action.actionName}</label>
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <Button className="py-4 px-5" variant="outline" onClick={() => setMultipleActionModal(false)}>
                                No
                            </Button>
                            <Button className="py-4 px-6 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
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
            actions={actions}
            />
        </>
    )

}
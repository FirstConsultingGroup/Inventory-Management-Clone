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
import { CheckCircleIcon, ChevronDown, ChevronRight, ChevronUp, Circle, Filter, GripVerticalIcon, Search, ShieldCheck, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ViewUsersModal } from "./ViewUsersModal";


export const ModuleAccess = () => {

    const user = localStorage.getItem("userData");
    const userData = JSON.parse(user || '{}');
    const companyId = userData?.company_id || null;

    const [parentModules, setParentModules] = useState([]);
    const [modules, setModules] = useState([]);
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [parentId, setParentId] = useState('all');
    const [moduleId, setModuleId] = useState('all');
    const [roleId, setRoleId] = useState(null);
    const [userId, setUserId] = useState<string>('all');
    const [roleQuery, setRoleQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const [groupedSections, setGroupedSections] = useState<any[]>([]);
    const [expandedGroup, setExpandedGroup] = useState<Set<number>>(new Set([0]));

        const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
                let defaultExpandedparents;

            if(expandedGroup.size > 0 ){
        defaultExpandedparents = Array.from(expandedGroup).flatMap((grpIndex)=>{
           return parentModules.map((_,index) =>
                    `${grpIndex},${index}`
        ) 
    })
    
    console.log('defaultExpandedparents',new Set(defaultExpandedparents))
}
return new Set(defaultExpandedparents);
        });

        const [showUsersModal, setShowUsersModal] = useState(false);
        const [groupedUsers, setGroupedUsers] = useState<any[]>([]);
        const [loadPermission,setLoadPermission] = useState<boolean>(false);


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

                let moduleData=[];
                for(const m of modules) {
                    const subModules = typeof m.selected_submodules === 'string' ? JSON.parse(m.selected_submodules) : m.selected_submodules;
                    let selectedSubModules:any =[];
                    if(subModules.length >0 ){
                        const subModulesArray = subModules.flatMap((sub)=>sub.subModule_id)
    
                        const {data} = await supabase
                        .from('available_submodules')
                        .select('id,submodule_name')
                        .in('id',subModulesArray);
    
                        if(data){
                            selectedSubModules = data;
                        }
                        console.log('selectedSubModules',selectedSubModules)
                    }
                    moduleData.push({...m, selected_submodules: selectedSubModules})
                }
                console.log('moduleData',moduleData)
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

                if (roleQuery) {
                    query = query.ilike('name', roleQuery)
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
    }, [roleQuery])

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

                const { data: users, error } = await query;

                if (error) throw error;

                console.log("users", users)
                setUsers(users);
            } catch (error) {
                console.log("Error fetching users", error)
            }
        }

        fetchUsers();

    }, [roleId])

        let filteredTree = []
    if(parentId !== "all"){
        const parentModule = parentModules.find((p)=> p.id === parentId)
        filteredTree.push({
                parentModule : parentModule.module_name,
                parentId : parentModule.id,
                modules: modules
            })

    }else{
        parentModules.map((p)=>{
            const Modules = modules.filter((m)=> m.parent_id === p.id)

            filteredTree.push({
                parentModule : p.module_name,
                parentId : p.id,
                modules: Modules
            })
        })
    }

    const fetchGroupedModuleAccess = async()=>{
        console.log('userId',userId)
        const {data,error} = await supabase.rpc("get_grouped_module_access", {
            p_company_id : companyId,
             p_role_ids : roleId ? [roleId] : [],
            p_user_id : userId !== "all" ? userId : null,
        })

        if(error) throw error;
        console.log("fetchGroupedModuleAccess",data)
        setGroupedSections(data as any[])
        console.log("filteredTree",filteredTree)
        setLoadPermission(false)
    }

    useEffect(() => {
        if(loadPermission){
            fetchGroupedModuleAccess();
        }
    }, [userId])
    

    function toggleExpandedSection(index :number) {
        setExpandedGroup(prev => {
            const expandedIndexes = new Set(prev);

            if(expandedIndexes.has(index)){
                expandedIndexes.delete(index)
            }else{
                expandedIndexes.add(index)
            }

            return expandedIndexes;
        })
    }

        function toggleExpandedParent(grpIndex:number, parentIndex :number) {
            console.log('default indexes',expandedParents)
        const key=`${grpIndex},${parentIndex}`;
        const prevIndexes =new Set(expandedParents)

        if(prevIndexes.has(key)){
            prevIndexes.delete(key)
        }else{
            prevIndexes.add(key)
        }

        setExpandedParents(prevIndexes);
        console.log('expandedParents',expandedParents)
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
                                    {/* <div>
                                        <Popover>
        <PopoverTrigger className="rounded-md border w-full bg-white flex justify-start items-center py-1.5 px-2">
            <span className="text-sm text-gray-700 p-0.5">Select Role</span>
        </PopoverTrigger>
        <PopoverContent align="start" className=" p-0">
            <div className="bg-gray-50 border-b px-3 py-4 rounded-md">
                <Input 
                value={roleQuery}
                onChange={(e)=> setRoleQuery(e.target.value)}
                 className="bg-white" placeholder="Search roles..." />
            </div>

          <div>
            {roles.length === 0 ? ( 

            <span>No results found.</span>
            ) : 
                {roles.slice(0,5).map((role) => (
                    <div key={role.id} value={role.id}>{role.name}</div>
                ))}
          </div>
        </PopoverContent>
      </Popover>
                                    </div> */}
                                    <Select
                                        value={roleId}
                                        onValueChange={(value) => {
                                            setRoleId(value);
                                        }}
                                    >
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="Select Role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.id} value={role.id}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3 w-full">
                                    <label className="text-xs ps-1">Users</label>
                                    <Select
                                        value={userId}
                                        onValueChange={(value) => {
                                            setUserId(value);
                                        }}
                                        disabled={!roleId || users.length === 0}
                                    >
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue
                                                placeholder={!roleId
                                                    ? "Select Role"
                                                    : users.length === 0
                                                        ? "No Users Found"
                                                        : "All Users"}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.length > 0 && (
                                                <SelectItem value="all">All Users</SelectItem>
                                            )}
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.first_name}{' '}{user.last_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-[70%] h-full flex items-center mt-5 justify-start">
                                    <Button
                                    onClick={()=>fetchGroupedModuleAccess()}
                                        className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white w-full"
                                    >
                                        Load Permissions
                                    </Button>
                                </div>
                            </div>
                        </div>
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
                        <div className="space-y-3 py-3">
                            <div>
                                <label className="text-xl font-semibold text-gray-700">Grouped by module permissions and stores</label>
                            </div>
                            <div>
                                    {groupedSections.length > 0 && (
                                        groupedSections.map((grp,index) => {
                                            const multipleUsers = grp.user_count > 1;
                                            let user;
                                            if(!multipleUsers){
                                                user = grp.users[0]
                                            }
                                            const isGroupOpen = expandedGroup.has(index);

                                            return (
                                            <div key={index} className="py-2">
                                    <Collapsible
                                        open={isGroupOpen}
                                        onOpenChange={()=>toggleExpandedSection(index)}
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
                                                            <span onClick={(e)=>{
                                                                e.preventDefault();
                                                                setShowUsersModal(true);
                                                                setGroupedUsers(grp.users);
                                                            }} className="text-blue-500 hover:underline hover:text-blue-600">View Users</span>
                                                        ) : user.email}</span>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="size-8 ">
                                                    {isGroupOpen ? (                                                       
                                                        <ChevronUp/>
                                                    ) : (
                                                        <ChevronDown/>
                                                    )}
                                                    </Button>
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="rounded-md border p-4 space-y-4">
                                                <div className="flex items-center">
                                                    <div className="w-full">
                                                        <div className="relative w-[70%]">
                                                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                            <Input
                                                                placeholder="Search modules..."
                                                                className="pl-10"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="w-full grid grid-cols-[30%_68%] gap-3">
                                                        <div className=" text-xs font-semibold text-gray-600 border px-2 py-1 rounded-md"><span className=" text-green-600 mr-2">Action</span>Requires Workflow</div>
                                                        <div className="flex gap-2 items-center text-xs border px-2 py-1 rounded-md">
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
                                                        <TableRow className="text-md text-gray-500 bg-gray-50">
                                                        <TableHead className="w-[250px] ps-4">Parent modules & Sub modules</TableHead>
                                                        <TableHead className="flex justify-start items-center">Permissions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredTree.length > 0 && (
                                                            filteredTree.map((item,i)=>{
                                                                const key= `${index},${i}`;
                                                                const expandedParent = expandedParents.has(key);
                                                                console.log('expandedParent',expandedParent)
                                                                let expandedModule =true;

                                                                return(
                                                                    <>
                                                                    <TableRow key={i} className="bg-gray-100 border hover:bg-gray-200">
                                                                        <TableCell colSpan={2}>
                                                                            <div onClick={()=>toggleExpandedParent(index,i)} className="flex justify-start items-center gap-2 ps-2 py-1 text-gray-800">
                                                                                {expandedParent ? (
                                                                                     <ChevronDown size={16}/>
                                                                                ) : (
                                                                                    <ChevronRight size={16}/>
                                                                                )}
                                                                           <span className="font-semibold">{item.parentModule}</span>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    {expandedParent && (
                                                                    item.modules.map((m)=>(
                                                                        <>
                                                                        {m.selected_submodules.length > 0 ? (
                                                                            <>
                                                                            <TableRow key={m.id}>
                                                                        <TableCell colSpan={2}>
                                                                            <div className="flex justify-start items-center gap-2 ps-5 py-2 text-gray-700">
                                                                                {expandedModule == true ? (
                                                                                     <ChevronDown className="text-gray-500" size={14}/>
                                                                                ) : (
                                                                                    <ChevronRight className="text-gray-500" size={14}/>
                                                                                )}
                                                                           <span className="font-semibold">{m.module_name}</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        </TableRow>
                                                                        {expandedModule && 
                                                                        m.selected_submodules.map((sub)=>(
                                                                             <TableRow key={sub.id} className="bg-[#f9fdff] hover:bg-[#f1faff]">
                                                                        <TableCell colSpan={2}>
                                                                            <div className="flex justify-start items-center gap-2 px-4 py-1 text-gray-700">
                                                                           <span className=" text-gray-600 text-sm px-4 flex gap-2 items-center">
                                                                            <Circle size={7} fill="#60a5fa" color="#60a5fa"/>
                                                                            <span>{sub.submodule_name}</span>
                                                                            </span>                                                                                
                                                                           <span className="font-semibold text-gray-700 text-sm">sub module</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        </TableRow>
                                                                        ))
                                                                        }
                                                                        </>
                                                                        ) : (
                                                                            <TableRow key={m.id}>
                                                                        <TableCell colSpan={2}>
                                                                            <div className="flex justify-start items-center gap-2 ps-10 py-2 text-gray-700">
                                                                           <span className="font-semibold text-gray-700 text-sm">{m.module_name}</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        </TableRow>
                                                                        )}
                                                                        </>
                                                                     ))
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
                                        )})
                                    )}
                            </div>
                        </div>
                        <div className="flex justify-end items-center pt-3 px-3">
                            <Button
                                className="p-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-md text-white save-button"
                            >
                                <CheckCircleIcon className="text-sm" /><span>Save Changes</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <ViewUsersModal
        open={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        groupedUsers={groupedUsers}
        setGroupedUsers={setGroupedUsers}
        setUserId={setUserId}
        setLoadPermission={setLoadPermission}
        />
        </>
    )

}
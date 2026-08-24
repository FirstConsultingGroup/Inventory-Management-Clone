import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/Utils/types/supabaseClient";
import { CommandLoading } from "cmdk";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, Save, Settings, Trash, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { object } from "zod";

interface ModifyWorkflowModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    modifyWorkflowData: object;
    groupedUsers: any[];
    setGroupedUsers: React.Dispatch<React.SetStateAction<any[]>>;
    companyId: string;
    actions: any[];
}

export const ModifyWorkflowModal = ({
    open,
    onClose,
    modifyWorkflowData,
    companyId,
    groupedUsers,
    setGroupedUsers,
    actions
}: ModifyWorkflowModalProps) => {

    const [data, setData] = useState({});
    const [viewStores, setViewStores] = useState(false);
    const [viewWorkflow, setViewWorkflow] = useState(true);
    const [stores, setStores] = useState<any[]>([]);
    const [locationsAndStores, setLocationAndStores] = useState([]);
    const [expandedLocations, setExpandedLocations] = useState<Set<number>>();
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>();

    const [permittedStores, setPermittedStores] = useState<string[]>([]);
    const [permittedLocations, setPermittedLocations] = useState<string[]>([]);
    const [userLocations, setUserLocations] = useState<string[]>([]);
    const [selectedWorkflowGroup, setSelectedWorkflowGroup] = useState<any[]>([]);
    const [showWorkflowUsersModal, setShowWorkflowUsersModal]=useState(false);
    const [groupedWorkflowUsers,setGroupedWorkflowUsers]=useState([]);
    const [showDeleteModal, setShowDeleteModal]=useState(false);


    useEffect(() => {
        console.log('modifyWorkflowData', modifyWorkflowData)
        setData(modifyWorkflowData)
    }, [modifyWorkflowData])

    useEffect(() => {

        const fetchLocationsAndStores = async () => {

            try {
                const groupedUserIds = groupedUsers.flatMap(u => u.id);

                const { data: userLocation, error: userLocationError } = await supabase
                    .from('user_mgmt')
                    .select('locations')
                    .in('id', groupedUserIds);

                if (userLocationError) throw userLocationError;

                if (userLocation) {
                    const mappedLoc = userLocation.map(item => item.locations)
                    const matchingLocations = mappedLoc.reduce((commonItems, currentArray) => {
                        const currentSet = new Set(currentArray);
                        return commonItems?.filter(item => currentSet.has(item))
                    })
                    setUserLocations(matchingLocations)
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
        const PermittedStores = groupedUsers[0]?.stores;
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

        const workflowData = data?.workflow.filter(w => w.level === 1);

        for (const workflow of workflowData) {
            const storeIds: [] = workflow.stores.map(store => store.id || store);
            const existingGroup: boolean = groupedWorkflow.find(item => {
                if (item.stores.length !== storeIds.length) return false;
                return item.stores.every((store, index) => store === storeIds[index])
            });
            if (existingGroup) {
                existingGroup.assigned_to.push(workflow.assigned_to)
            } else {
                groupedWorkflow.push({ stores: storeIds, assigned_to: [workflow.assigned_to] })
            }
        }
    }

    function toggleLocationAccess(loc: object) {
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

    function handleSetSelectedGroup(workflow:object,index :number){
        console.log('workflow set',[workflow,index])
        if(selectedWorkflowGroup.includes(index)){
            setSelectedWorkflowGroup([]);
        } else {
            setSelectedWorkflowGroup([workflow,index]);           
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
            console.log('updated locations', permittedLocations);
            console.log('updated stores', permittedStores);
        } catch (error) {
            console.log("Failed to save configuration", error)
        }
    }

    return (
<>
        <Dialog open={open} onOpenChange={(open) => {
            if (!open) {
                setExpandedLocations(new Set());
                setGroupedUsers([]);
            }
            onClose(open);
        }}>
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
                            {data.is_store_specific ? (
                                <div className="bg-white border shadow rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-[25%_75%] bg-slate-50 py-2 px-3 font-semibold text-sm border-b hover:bg-gray-100 transition-colors duration-200">
                                        <span>Action</span>
                                        <span>Workflow Configured Stores</span>
                                    </div>
                                    <div className="bg-white grid grid-cols-[25%_65%_8%] p-3 hover:bg-gray-50 transition-colors duration-200">
                                        <span className="flex justify-start items-center">
                                            <label className="font-semibold text-sm">{data.module_name}{' '}-{' '}{data.actionName}</label>
                                        </span>
                                        <div>
                                            {groupedUsers.length > 1 ? (
                                                <Table>
                                                    <TableBody>

                                                        {groupedWorkflow.map((workflow, index) => {
                                                            const isExpanded = expandedGroups?.has(index);
                                                            const isSelected = selectedWorkflowGroup?.includes(index);
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
                                                                                onClick={(e)=>e.stopPropagation()}
                                                                                onCheckedChange={()=>handleSetSelectedGroup(workflow,index)}
                                                                                className="shadow data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500" />
                                                                                <span className="flex flex-col justify-start items-start">
                                                                                    <label className="font-semibold text-sm text-gray-800">{multipleUserCount ?
                                                                                       <span>{assignedUsers.slice(0,2).map((u) => (u.first_name + (' ') + u.last_name)).join(', ')} + {assignedUsers.slice(2).length} more</span>  : 
                                                                                       <span>{assignedUsers.map((u) => (u.first_name + (' ') + u.last_name)).join(', ')}</span>
                                                                                    }
                                                                                    </label>
                                                                                    {multipleUserCount ? 
                                                                                    <span
                                                                                    onClick={(e)=>{
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
                                                    {stores.map((store: string) => {
                                                        const alreadyConfiguredStores = workflow.stores;

                                                        const configuredStore = alreadyConfiguredStores.filter(s => s === store.id);
                                                        const isConfiguredStore = configuredStore.length > 0;
                                                        const hasStoreAccess = permittedStores?.includes(store.id);

                                                        return (
                                                            <div key={store.id}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="flex justify-start items-center font-semibold gap-2 p-1">
                                                                            <Checkbox
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
                                                    {stores.map((store: string) => {
                                                        const alreadyConfiguredStores = data?.workflow[0].stores;

                                                        const configuredStore = alreadyConfiguredStores.filter(s => s.id === store.id);
                                                        const isConfiguredStore = configuredStore.length > 0;
                                                        const hasStoreAccess = permittedStores?.includes(store.id);

                                                        return (
                                                            <div key={store.id}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="flex justify-start items-center font-semibold gap-2 p-1">
                                                                            <Checkbox
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
                                            )
                                            }
                                        </div>
                                        <span className="flex items-center justify-end">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Trash2 
                                                    onClick={()=>setShowDeleteModal(true)} className="text-red-500 h-8 w-8 p-2 hover:bg-red-50 hover:text-red-600 rounded-full" />
                                                </TooltipTrigger>
                                                <TooltipContent>Delete all workflows for this action</TooltipContent>
                                            </Tooltip>
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border shadow px-5 py-7 text-gray-600 rounded-lg flex flex-col justify-center items-center space-y-1">
                                    <p className="text-[15px]">The approval workflow for the action{' '}
                                        <label className="font-bold text-gray-600 text-[16px]">"{data.module_name}{' '}-{' '}{data.actionName}"</label>{' '}
                                        is currently configured and applies to <label className="font-bold text-gray-600">{groupedUsers?.length} {groupedUsers?.length > 1 ? 'users' : 'user'}</label>.</p>
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
                                                                            onClick={(e)=>e.stopPropagation()}
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
                                                                                        <Checkbox
                                                                                            checked={hasLocationAccess && hasStoreAccess}
                                                                                            onCheckedChange={() => toggleStoreAccess(store.id)}
                                                                                        />
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
                        <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => {
                            if (!open) {
                                setExpandedLocations(new Set());
                                setGroupedUsers([]);
                            }
                            onClose(open)
                        }}>
                            Close
                        </Button>
                        {viewWorkflow &&
                            <Button
                            disabled={selectedWorkflowGroup.length === 0}
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
                            <AlertTriangle/>
                            <label>Remove Action Workflow</label>
                        </span>
                    </DialogTitle>
                </DialogHeader>
                <div className="p-1">
                   <p className="text-gray-700">Are you sure you want to permanently delete all workflow configurations for{' '}
                    <label className="font-bold">{data.module_name}{' '}-{' '}{data.actionName}?</label>
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
                            variant="destructive">
                                Delete All Workflows
                            </Button>
                    </div>
                </DialogFooter>
                </DialogContent>  
</Dialog>
</>

    )
}
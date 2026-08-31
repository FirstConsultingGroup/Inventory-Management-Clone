import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Json } from "@/Utils/types/database.types";
import { outline } from "@yudiel/react-qr-scanner";
import { Pencil, Settings } from "lucide-react";
import { useEffect, useState } from "react";

interface ManageWorkflowModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    manageWorkflowData: object;
    actions:any[];
    setConfigWorkflowData: React.Dispatch<React.SetStateAction<ConfigWorkflowDataProps | null | undefined>>
    handleSetWorkflowConfig: () => void
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
    userStores: Json;
    selectedModule: Json;
}

export const ManageWorkflowModal =({
    open,
    onClose,
    manageWorkflowData,
    actions,
    setConfigWorkflowData,
    handleSetWorkflowConfig
}: ManageWorkflowModalProps) => {

    const [data,setData]=useState({});
    const [selectedWorkflowActions,setSelectedWorkflowActions] =useState<any[]>([]);


    useEffect(() => {
      console.log('manageWorkflowData',manageWorkflowData)
      setData(manageWorkflowData)
    }, [manageWorkflowData])
    
     function toggleAction(action: object) {
        setSelectedWorkflowActions(prev => {
            let currentActions=[...prev];
            if (currentActions.some((a)=>a.action_id === action.action_id)) {
               currentActions= currentActions.filter((a)=> a.action_id !== action.action_id)
            } else {
                currentActions.push({action_id:action.action_id, action_name:action.action_name, requires_approval:action.requires_approval})
            }

            return currentActions
        })
    }

    const handleConfigureWorkflow = ()=>{
         const configData = {
        selectedModule: data.selectedModule,
        selectedActions: selectedWorkflowActions, assignedUsers: data.assignedUsers, userStores: data.userStores
        }
        onClose(open)
        setConfigWorkflowData(configData);
        handleSetWorkflowConfig()
        console.log('configData',configData)
    }


    return(

<Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="md:max-w-[55vw] p-0 gap-0 rounded-xl bg-gray-50">
                    <DialogHeader className="px-5 py-4 border-b rounded-t-xl border-gray-300 bg-white">
                        <DialogTitle className="text-blue-700 ps-1 my-2">
                            <span className="flex items-center gap-2">
                                <Settings className="w-5 h-5"/>
                                <span>Manage Workflows : {data.selectedModule?.module_name}</span>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md shadow border overflow-hidden my-8 mx-6">
                        {data.available_actions && data.available_actions.some(action=>action.requires_approval) ?
                        (
                            <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow className="text-md bg-gray-50">
                                                                                            <TableHead className="w-[40px]"/>
                                                                                            <TableHead className="w-[220px]"><span>Module Actions</span></TableHead>
                                                                                            <TableHead className=" flex-1"><span className="ps-2">Status</span></TableHead>
                                                                                            <TableHead className=" w-[200px] text-right"><span className="pr-2">Action</span></TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody> 
                                                                                        {data.available_actions.filter(action=>action.requires_approval).map(a => {
                                                                                        const action_name = actions?.filter((action) => action.id === a.action_id).map(item => item.action_name)
                                                                                        const hasWorkflowConfig = a.requiredworkflow;
                                                                                        const isSelected = selectedWorkflowActions.some((action)=> action.action_id=== a.action_id)

                                                                                            return(
                                                                                             <TableRow key={a.action_id} className="text-md bg-white">
                                                                                                <TableCell className="">
                                                                                                <span className="flex justify-center">
                                                                                                    {hasWorkflowConfig ? (
                                                                                                        <span></span>
                                                                                                    ) : (
                                                                                                    <Checkbox
                                                                                                    checked={isSelected}
                                                                                                    onCheckedChange={()=> toggleAction({...a,action_name})}/>
                                                                                                    )}
                                                                                                    </span>
                                                                                            </TableCell>
                                                                                            <TableCell className="">
                                                                                                    <label className="font-semibold text-gray-800">{action_name}</label>
                                                                                            </TableCell>
                                                                                            <TableCell className="">
                                                                                                <span className={` rounded-xl py-0.5 px-3 ${hasWorkflowConfig ? 'text-green-600 font-semibold text-xs bg-green-100' : 'text-gray-500 text-sm bg-gray-50'}`}>
                                                                                                   {hasWorkflowConfig ? 'Workflow Configured' : 'Not Configured'}
                                                                                                   </span>
                                                                                                </TableCell>
                                                                                            <TableCell className="">
                                                                                                <span className="flex justify-end items-center pr-1">
                                                                                                    
                                                                                                {hasWorkflowConfig ? (
                                                                                                    <Button size='sm' variant='outline' className="flex items-center text-sm text-blue-500 border border-blue-200 hover:text-blue-600">
                                                                                                      <Pencil/>  Edit Workflow
                                                                                                    </Button>
                                                                                                ): (

                                                                                                    <span className=" text-slate-400 my-0.5 italic">
                                                                                                        Select to Configure
                                                                                                    </span>
                                                                                                )}
                                                                                                </span>
                                                                                                    </TableCell>
                                                                                        </TableRow>
                                                                                        )})}
                                                                                    </TableBody>
                                                                                    </Table>
                        ):(
                            <div className="flex justify-center items-center py-10">
                                <span className="text-gray-500 text-[15px]">Actions in this module doesn't requires approval</span>
                            </div>
                        )
                    }
                                                                                    </div>
                    <DialogFooter className="bg-white border-t px-5 py-4 rounded-b-xl">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => onClose(open)}>
                                Close
                            </Button>
                            <Button
                            disabled={selectedWorkflowActions.length === 0}
                            onClick={handleConfigureWorkflow} className="py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                Configure Workflow
                            </Button>

                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

                        )
                    }
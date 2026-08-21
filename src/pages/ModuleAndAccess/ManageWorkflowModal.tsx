import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

interface ManageWorkflowModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    manageWorkflowData: object;
    actions:any[];
}

export const ManageWorkflowModal =({
    open,
    onClose,
    manageWorkflowData,
    actions
}: ManageWorkflowModalProps) => {

    const [data,setData]=useState({});

    useEffect(() => {
      console.log('manageWorkflowData',manageWorkflowData)
      setData(manageWorkflowData)
    }, [manageWorkflowData])
    


    return(

<Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="md:max-w-[55vw] lg:max-w-[50vw] p-0 gap-0 rounded-xl bg-gray-50">
                    <DialogHeader className="px-5 py-4 border-b rounded-t-xl border-gray-300 bg-white">
                        <DialogTitle className="text-blue-700 ps-1 my-2">
                            <span className="flex items-center gap-2">
                                <Settings className="w-5 h-5"/>
                                <span>Manage Workflows : {data.module_name}</span>
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md shadow border overflow-hidden mx-7 my-9">
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow className="text-md bg-gray-50">
                                                                                            <TableHead className="w-[250px]"><span className="ps-3">Module Actions</span></TableHead>
                                                                                            <TableHead className=" flex-1">Status</TableHead>
                                                                                            <TableHead className=" w-[200px] text-right"><span className="pr-2">Action</span></TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {data.available_actions && 
                                                                                        data.available_actions.filter(action=>action.requires_approval).map(a => {
                                                                                        const actionName = actions?.filter((action) => action.id === a.action_id).map(item => item.action_name)

                                                                                            return(
                                                                                             <TableRow key={a.action_id} className="text-md bg-white">
                                                                                            <TableCell className="">
                                                                                                <span className="flex items-center gap-3 ps-3">
                                                                                                    <Checkbox/>
                                                                                                    <label className="font-semibold text-gray-800">{actionName}</label>
                                                                                                    </span></TableCell>
                                                                                            <TableCell className="">
                                                                                                <span className="text-gray-500 bg-gray-50 rounded-xl py-1 px-3">Not Configured</span>
                                                                                                </TableCell>
                                                                                            <TableCell className="">
                                                                                                <span className="flex justify-end items-center py-2 pr-2 text-slate-400  italic">
                                                                                                    Select to Configure
                                                                                                    </span>
                                                                                                    </TableCell>
                                                                                        </TableRow>
                                                                                        )})}
                                                                                    </TableBody>
                                                                                    </Table>
                                                                                    </div>
                    <DialogFooter className="bg-white border-t px-5 py-4 rounded-b-xl">
                        <div className="flex justify-end gap-2">
                            <Button className="py-4 px-5 rounded-xl" variant="outline" onClick={() => onClose(open)}>
                                Close
                            </Button>
                            <Button className="py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
                                Configure Workflow
                            </Button>

                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

                        )
                    }
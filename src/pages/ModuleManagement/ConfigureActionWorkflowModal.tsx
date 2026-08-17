import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/Utils/types/supabaseClient";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface Action {
    id: string;
    action_name: string;
}

interface ConfigureActionWorkflowModalProps {
    open: boolean;
    onClose: () => void;
    actions: Action[];
    selectedWorkflowActions: string[];
    setSelectedWorkflowActions: React.Dispatch<
        React.SetStateAction<string[]>
    >;
      moduleId: string;
}


const ConfigureActionWorkflowModal = ({
   open,
    onClose,
    actions,
    selectedWorkflowActions,
    setSelectedWorkflowActions,
    moduleId,
}: ConfigureActionWorkflowModalProps) => {
    const [lockedActions, setLockedActions] = useState<string[]>([]);
    const [localSelectedActions, setLocalSelectedActions] = useState<string[]>([]);
    const [defaultWorkflowActions, setDefaultWorkflowAcions]= useState<string[]>([]);
    

      useEffect(() => {
        if (open) {
            if (selectedWorkflowActions && selectedWorkflowActions.length > 0) {
                setLocalSelectedActions([...selectedWorkflowActions]);
            } else {
                setLocalSelectedActions([]);
            }
        }
    }, [open]);


   const fetchDefaultWorkflowActions = async () => {
  const { data, error } = await supabase
    .from("main_modules")
    .select("available_actions")
    .eq("id", moduleId)
    .single();

  if (error || !data) return;

  const actionIds: string[] = [];

  if (Array.isArray(data.available_actions)) {
    data.available_actions.forEach((action: any) => {
      if (action.requires_approval === true) {
        actionIds.push(String(action.action_id));
      }
    });
  }
  setDefaultWorkflowAcions(actionIds)

   if (!selectedWorkflowActions || selectedWorkflowActions.length === 0) {
            setLocalSelectedActions(actionIds);
        }
};


  const fetchWorkflowActions = async () => {
  const { data, error } = await (supabase as any).rpc(
    "get_locked_workflow_actions",
    {
      p_module_id: moduleId,
    }
  );
console.log("fetchWorkflowActions data:", data);
  if (error) {
    console.error(error);
    return;
  }

  setLockedActions(
    ((data ?? []) as { action_id: string }[]).map(
      (item) => String(item.action_id)
    )
  );
};

useEffect(() => {
  if (!open || !moduleId) return;

  fetchWorkflowActions();
  fetchDefaultWorkflowActions();
}, [open, moduleId]);

  const handleWorkflowToggle = (actionId: string, checked: boolean | string) => {
        if (lockedActions.includes(actionId)) return;

        if (checked) {
            setLocalSelectedActions((prev) => [...new Set([...prev, actionId])]);
        } else {
            setLocalSelectedActions((prev) => prev.filter((id) => id !== actionId));
        }
    };


const handleClose = () => {
    if (!selectedWorkflowActions || selectedWorkflowActions.length === 0) {
            setSelectedWorkflowActions([...defaultWorkflowActions]);
        } 
        onClose();
};

console.log("lockedActions", lockedActions);
console.log("localSelectedActions", localSelectedActions);
console.log("selectedWorkflowActions", selectedWorkflowActions);

    return (
      <Dialog
    open={open}
    onOpenChange={(isOpen) => {
        if (!isOpen) {
            handleClose();
        }
    }}
>
            <DialogContent
                className="
                    [&>button]:hidden
                    sm:max-w-3xl
                    w-full
                    h-[550px]
                    p-0
                    rounded-2xl
                    overflow-hidden
                    flex
                    flex-col
                "
            >
                {/* Header */}
                <div className="shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                                    <Workflow className="h-5 w-5 text-blue-600" />
                                    Configure Action Workflows
                                </DialogTitle>

                                <DialogDescription className="mt-1 text-sm">
                                    Configure workflow settings for selected actions.
                                </DialogDescription>
                            </div>

                            <Badge
                                variant="secondary"
                                className="px-3 py-1 text-xs"
                            >
                                {actions.length} Actions
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {actions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Workflow className="h-10 w-10 text-gray-300 mb-3" />

                            <p className="font-medium text-gray-600">
                                No Actions Selected
                            </p>

                            <p className="text-sm text-gray-500">
                                Select actions to configure workflows.
                            </p>
                        </div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {actions.map((action) => {
  console.log({
  action: action.action_name,
  actionId: action.id,
  isChecked: localSelectedActions.includes(String(action.id)),
  isLocked: lockedActions.includes(String(action.id)),
  selectedWorkflowActions,
});
const isChecked = localSelectedActions.includes(String(action.id));
 
const isDisabled = isChecked && lockedActions.includes(String(action.id));

  return (
    <div
      key={action.id}
      className="
        border
        rounded-lg
        bg-white
        px-3
        py-4
        shadow-sm
        hover:border-blue-300
        hover:shadow-md
        transition-all
      "
    >
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Checkbox
                   checked={isChecked}
  disabled={isDisabled}
  onCheckedChange={(checked) =>
    handleWorkflowToggle(action.id, checked)
  }
                />
              </div>
            </TooltipTrigger>

          {isDisabled && (
  <TooltipContent>
    <p>
      This action already has a workflow applied and cannot be modified.
    </p>
  </TooltipContent>
)}
          </Tooltip>
        </TooltipProvider>

        <h3 className="text-sm font-medium text-slate-800">
          {action.action_name}
        </h3>
      </div>
    </div>
  );
})}
</div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t bg-white px-5 py-3">
                    <div className="flex justify-end gap-3">
                        <Button
    type="button"
    variant="outline"
    onClick={handleClose}
>
    Cancel
</Button>

                    <Button
    type="button"
    onClick={()=>{
      setSelectedWorkflowActions([...localSelectedActions])
      onClose()
    }}
    className="bg-blue-600 hover:bg-blue-700 text-white w-40"
>
    Done
</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ConfigureActionWorkflowModal;
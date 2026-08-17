import { useNavigate, useParams } from "react-router-dom";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { Info } from "lucide-react";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

import {
    ArrowLeft,
    CheckCircle,
    Component,
    Route,
    ChevronDown,
    ChevronUp,
    ListChecks,
    CheckSquare,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/Utils/types/supabaseClient";
import ConfigureActionWorkflowModal from "./ConfigureActionWorkflowModal";
import { stringify } from "querystring";
import { initiateApprovalRequest } from "@/Utils/commonFun";


type Actions = {
    id: string,
    action_name: string
}

type SubModule = {
    id: string;
    submodule_name: string;
}

const asJsonArray = <T,>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : [];

export const AddModule = ({ isEditing = false }) => {
    const navigate = useNavigate();
    const { id } = useParams();
     const userData = localStorage.getItem('userData');
  const user = userData ? JSON.parse(userData) : null;
  const companyId = user?.company_id;
  const userId = user?.id;

    const [parentModules, setParentModules] = useState<any[]>([]);

    const [moduleData, setModuleData] = useState<any>(null);
    const [parentId, setParentId] = useState<string>("");
    const [moduleKey, setModuleKey] = useState<string>("");
    const [moduleName, setModuleName] = useState<string>("");
    const [moduleRoute, setModuleRoute] = useState<string>("");
    const [availableActions, setAvailableActions] = useState<string[]>([]);
    const [errors, setErrors] = useState({
        parentId: "",
        moduleKey: "",
        moduleName: "",
        moduleRoute: "",
        availableActions: "",
        selectedSubModules: ""
    });
    const [actions, setActions] = useState<Actions[]>([]);
    const [isStoreSpecific, setIsStoreSpecific] = useState<boolean>(false);

    const [subModules, setSubModules] = useState<SubModule[]>([]);
    const [selectedSubModules, setSelectedSubModules] = useState<string[]>([]);

    const [isSubModulesOpen, setIsSubModulesOpen] = useState<boolean>(true);


    const [isAvailableActionsOpen, setIsAvailableActionsOpen] = useState<boolean>(true);
    const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
    const [hasWorkflowConfig, setHasWorkflowConfig] = useState(false);
   
    const [selectedWorkflowActions, setSelectedWorkflowActions] = useState<string[]>([]);
    const [selectedModuleId, setSelectedModuleId] = useState("");
    const handleCancel = () => {
        navigate("/dashboard/module-management");
    };

    const getAllActions = async () => {
        try {
            const { data, error } = await supabase
                .from('available_actions')
                .select('*')

            if (error) {
                throw error;
            }

            console.log(data);
            setActions(
                (data ?? []).map(({ id, action_name }) => ({
                    id,
                    action_name: action_name ?? '',
                }))
            );

        } catch (error) {
            console.error("Error fetching roles:", error);
            setActions([]);

        }
    }

    const getAllSubModules = async () => {
        try {
            const { data, error } = await supabase
                .from('available_submodules')
                .select('*')

            if (error) {
                throw error;
            }

            console.log(data);
            setSubModules(
                (data ?? []).map(({ id, submodule_name }) => ({
                    id,
                    submodule_name: submodule_name ?? '',
                }))
            );

        } catch (error) {
            console.log(
                "Error fetching sub modules",
                error
            );
        }
    };

    useEffect(() => {
        getAllActions();
        getAllSubModules();
    }, []);

    const handleSubmit = async (e: any) => {
        e.preventDefault();

        const newErrors = {
            parentId: "",
            moduleKey: "",
            moduleName: "",
            moduleRoute: "",
            availableActions: "",
            selectedSubModules: ""
        };

        let hasError = false;

        try {

            if (!parentId) {
    newErrors.parentId = "Parent module is required";
    hasError = true;
}
            if (!moduleKey.trim()) {
                newErrors.moduleKey = "Module key is required";
                hasError = true;
            }
            if (!moduleName.trim()) {
                newErrors.moduleName = "Module name is required";
                hasError = true;
            }
            if (!moduleRoute.trim()) {
                newErrors.moduleRoute = "Module route is required";
                hasError = true;
            }
            if (availableActions?.length === 0) {
                newErrors.availableActions = "Select atleast one action";
                hasError = true;
            }

            if (showSubModules && selectedSubModules.length === 0) {
                newErrors.selectedSubModules = "Select at least one sub module";
                hasError = true;
            }

            setErrors(newErrors);

            if (hasError) {
                toast.error("Please fill all required fields");
                return;
            }

            if (isEditing) {
                if (!id) {
                    toast.error("Module id is missing");
                    return;
                }

             const formattedActions = availableActions.map((id) => ({
    action_id: id,
    requires_approval: selectedWorkflowActions.includes(id),
}));
                const formattedSubModules = selectedSubModules.map((id) => ({
                    subModule_id: id,
                }));

                const payload={
                    parent_id: parentId,
                        module_key: moduleKey,
                        module_name: moduleName,
                        module_route: moduleRoute,
                        available_actions: formattedActions,
                        selected_submodules: formattedSubModules,
                        is_store_specific: isStoreSpecific
                } 
                
                const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Manage Module",
          scope: "Edit",
          key: "",
          log: `Module: ${moduleName} updated.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

                const action_payload = {
        operations: [
          {
            table: 'main_modules',
            type: 'update',
            data: payload,
            match: { id: id! }
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Manage Module',
        action_name: 'Edit',
        company_id: companyId,
        requested_by: userId,
        action_payload
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');

        } else {
            const { data, error } = await supabase
                    .from("main_modules")
                    .update(payload)
                    .eq("id", id)
                    .select();

                if (error) {
                    throw error;
                }

                const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

            toast.success("Module updated successfully")
        }}

            } else {

               const formattedActions = availableActions.map((id) => ({
    action_id: id,
    requires_approval: selectedWorkflowActions.includes(id),
}));

                const formattedSubModules = selectedSubModules.map((id) => ({
                    subModule_id: id,
                }));

                const payload = {
                     parent_id: parentId,
                            module_key: moduleKey,
                            module_name: moduleName,
                            module_route: moduleRoute,
                            available_actions: formattedActions,
                            selected_submodules: formattedSubModules,
                            is_store_specific: isStoreSpecific
                }

                 const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Manage Module",
          scope: "Add",
          key: "",
          log: `Module: ${moduleName} created.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

                const action_payload = {
        operations: [
          {
            table: 'main_modules',
            type: 'insert',
            data: payload,
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };

      // Initiate Approval using the reusable common function
      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Manage Module',
        action_name: 'Add',
        company_id: companyId,
        requested_by: userId,
        action_payload: action_payload
      });

       if (approvalResponse?.success) {
         if (approvalResponse.requires_approval) {
            toast.success('Your action has been submitted and is currently pending approval.');
        
         } else {
            const { data, error } = await supabase
                    .from("main_modules")
                    .insert(payload)
                    .select();

                console.log("added successfully", data);


                if (error) {
                    throw error;
                }

                const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

                toast.success("Module created successfully")
            }

         }}

            setParentId("");
            setModuleKey("");
            setModuleName("");
            setModuleRoute("");
            setAvailableActions([]);
            setIsStoreSpecific(false);

            navigate("/dashboard/module-management");
        } catch (error: any) {
            console.error(error.response?.data);
            toast.error(error.response?.data?.message || "Something went wrong");
        }
    };

    const moduleAccessAction = actions.find((action) => action.action_name === "Module Access");
    const isModuleAccessEnabled = moduleAccessAction ? availableActions.includes(moduleAccessAction.id) : false;
    const selectedParentModule = parentModules.find((module) => module.id === parentId);

    const showSubModules = selectedParentModule && ["Dashboard", "Dashboards"].includes(selectedParentModule.module_name);
    const shouldDisableSubModules = !isModuleAccessEnabled;

    useEffect(() => {
        if (moduleData && parentModules.length > 0) {
            setParentId(moduleData.parent_id);
        }
    }, [moduleData, parentModules]);

    const fetchParentModules = async () => {
        try {

            const { data, error } = await supabase
                .from('parent_modules')
                .select('*')

            if (error) {
                throw error;
            }

            console.log(data);
            setParentModules(data);

        } catch (error) {
            console.error("Error fetching roles:", error);
            setParentModules([]);
        }
    }

    useEffect(() => {
        fetchParentModules()
    }, []);

    const fetchModuleById = async () => {
        if (!id) return;

        try {
            const { data, error } = await supabase
                .from('main_modules')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) return;

            console.log(data);
            setModuleData(data);
            setModuleKey(data.module_key || "");
            setModuleName(data.module_name || "");
            setModuleRoute(data.module_route || "");
            setIsStoreSpecific(data.is_store_specific || false);
            // Available Actions
            const parsedActions = asJsonArray<{ action_id: string, requires_approval?: boolean }>(data.available_actions);
            setAvailableActions(
                parsedActions.map((action) => action.action_id)
            );
            setSelectedWorkflowActions(
                parsedActions
                    .filter((action) => action.requires_approval)
                    .map((action) => action.action_id)
            );

            // Selected Sub Modules
            setSelectedSubModules(
                asJsonArray<{ subModule_id: string }>(data.selected_submodules).map(
                    (sub) => sub.subModule_id
                )
            );

        } catch (error) {
            console.log(error, "Error fetching role");
        }
    };

    const [lockedActions, setLockedActions] = useState<string[]>([]);

const fetchLockedActions = async (moduleId: string) => {
    const { data, error } = await (supabase as any).rpc(
        "get_locked_module_actions",
        {
            p_module_id: moduleId,
        }
    );

    if (error) {
        console.error(error);
        return;
    }
      console.log("Locked Actions:", data);


    setLockedActions(
        data?.map((item: any) => item.action_id) || []
    );
};

const fetchModuleWorkflow = async() =>{
            if (!id) return;

    try {      
        const{data,error}=await supabase
        .from('workflow_config')
        .select('*')
        .eq('module_id',id);

        if(error) throw error;

        if(data && data.length > 0){
            setHasWorkflowConfig(true);
        }

    } catch (error) {
        console.log("failed to fetch workflows for this module",error)
    }
}

useEffect(() => {
    if (isEditing && id) {
        fetchModuleById();
        fetchLockedActions(id);
        fetchModuleWorkflow();
    }
}, [id]);

const selectedActions = actions.filter(
    (action) =>
        availableActions.includes(action.id) &&
        action.id !== moduleAccessAction?.id
);
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
                    >
                        <ArrowLeft className="h-5 w-5 text-blue-600" />
                    </Button>
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Component className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {isEditing ? "Edit Module" : "Add New Module"}
                            </h1>
                            <p className="text-gray-600">
                                {isEditing ? "Update Module details here" : "Configure a new module for the organizational structure application."}
                            </p>
                        </div>
                    </div>
                </div>


                <form
                    onSubmit={handleSubmit}
                    className="grid gap-y-5"
                >


                    <Card className="overflow-hidden rounded-xl !border-0 shadow-md bg-white">


                        <CardHeader className="border-b bg-white">
                            <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
                                <Component className="h-5 w-5 text-blue-600" />
                                Module Information
                            </CardTitle>

                            <CardDescription className="text-sm text-blue-500">
                                Fill in the module details below to{" "}
                                {isEditing ? "update the existing" : "create a new"}{" "}
                                module. Fields marked with{" "}
                                <span className="text-red-500">*</span>{" "}
                                are required.
                            </CardDescription>
                        </CardHeader>


                        <CardContent className="space-y-6 pt-6">


                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">


                                <div className="space-y-2">
                                    <Label
                                        htmlFor="parent_module"
                                        className="font-medium text-gray-600  hover:text-blue-600"
                                    >
                                        <Component className="h-4 w-4 " />
                                        <span>
                                            Parent Module{" "}
                                            <span className="text-red-500">*</span>
                                        </span>
                                    </Label>

                                    <Select value={parentId} onValueChange={(value) => {
                                        setParentId(value);
                                        if (errors.parentId) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                parentId: "",
                                            }));
                                        }
                                    }} >
                                        <SelectTrigger disabled={parentModules.length === 0} className="bg-white w-full ">
                                            <SelectValue
                                                placeholder={
                                                    parentModules.length === 0
                                                        ? "No parent modules available"
                                                        : "Select parent module"
                                                }
                                            />                                        </SelectTrigger>
                                        {parentModules.length === 0 ? (
                                            <SelectContent>

                                            </SelectContent>
                                        ) :
                                            (<SelectContent>
                                                {parentModules.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.module_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            )}
                                    </Select>
                                    {errors.parentId && (
                                        <p className="text-sm text-red-500">
                                            {errors.parentId}
                                        </p>
                                    )}
                                </div>


                                <div className="space-y-2 ">
                                    <Label
                                        htmlFor="module_key"
                                        className="font-medium text-gray-600  hover:text-blue-600 "
                                    >
                                        <Component className="h-4 w-4  " />
                                        <span>
                                            Module Key{" "}
                                            <span className="text-red-500">*</span>
                                        </span>
                                    </Label>

                                    <Input
                                        id="module_key"
                                        placeholder="Enter Module Key"
                                        className="h-11 rounded-xl"
                                        value={moduleKey} onChange={(e) => {
                                            setModuleKey(e.target.value);
                                            if (errors.moduleKey) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    moduleKey: "",
                                                }));
                                            }
                                        }}
                                    />
                                    {errors.moduleKey && (
                                        <p className="text-sm text-red-500">
                                            {errors.moduleKey}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="module_name"
                                        className="font-medium text-gray-600  hover:text-blue-600"
                                    >
                                        <Component className="h-4 w-4 " />
                                        <span>
                                            Label{" "}
                                            <span className="text-red-500">*</span>
                                        </span>
                                    </Label>

                                    <Input
                                        id="module_name"
                                        placeholder="Enter Module name"
                                        className="h-11 rounded-xl"
                                        value={moduleName} onChange={(e) => {
                                            setModuleName(e.target.value);
                                            if (errors.moduleName) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    moduleName: "",
                                                }));
                                            }
                                        }}
                                    />
                                    {errors.moduleName && (
                                        <p className="text-sm text-red-500">
                                            {errors.moduleName}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="module_route"
                                        className="font-medium text-gray-600  hover:text-blue-600"
                                    >
                                        <Route className="h-4 w-4 " />
                                        <span>
                                            Module Route{" "}
                                            <span className="text-red-500">*</span>
                                        </span>
                                    </Label>

                                    <Input
                                        id="module_route"
                                        placeholder="Enter a route for the module"
                                        className="h-11 rounded-xl"
                                        value={moduleRoute} onChange={(e) => {
                                            setModuleRoute(e.target.value);
                                            if (errors.moduleRoute) {
                                                setErrors((prev) => ({
                                                    ...prev,
                                                    moduleRoute: "",
                                                }));
                                            }
                                        }}
                                    />
                                    {errors.moduleRoute && (
                                        <p className="text-sm text-red-500">
                                            {errors.moduleRoute}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between items-center mb-4">
                    <TooltipProvider>
                    <div className="flex items-start ml-1 space-x-3">
                                      <Tooltip >
                                        <TooltipTrigger asChild>                            
                      <Checkbox
                        className="border border-gray-400 mt-1"
                        id="is store specific"
                        checked={isStoreSpecific}
                        disabled={hasWorkflowConfig}
                        onCheckedChange={()=>setIsStoreSpecific(!isStoreSpecific)}
                      />
                       </TooltipTrigger> 
                      <div className="flex flex-col">
                        <Label htmlFor="is store specific" className="text-sm font-medium text-gray-800">
                          Store Specific Module
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Enable this option if workflows and approvals for this module need to be configured separately for each store.
                        </p>
                      </div>
                      {hasWorkflowConfig && (
                      <TooltipContent>
                        <p>Cannot edit. This module has active workflows.</p>
                      </TooltipContent>
                    )}
                      </Tooltip>
                    </div>
                    </TooltipProvider>
    <Button
        type="button"
          onClick={() => {
        setSelectedModuleId(id ?? "");
        setIsWorkflowModalOpen(true);
    }}
        disabled={selectedActions.length === 0}
        className="bg-blue-600 hover:bg-blue-700"
    >
        Configure Action Workflows
    </Button>
</div>

                            <Collapsible
                                open={isAvailableActionsOpen}
                                onOpenChange={setIsAvailableActionsOpen}
                                className="mb-3 bg-[#fcfcfd] border rounded-lg border-[#ececf1] shadow-sm p-3"
                            >
                                {/* Header */}
                                <CollapsibleTrigger asChild>
                                    <div
                                        className={`flex items-center justify-between cursor-pointer ${isAvailableActionsOpen ? "mb-4" : ""
                                            }`}
                                    >
                                        <div className="flex items-center">
                                            <CheckSquare className="h-5 w-5 text-[#667eea] mr-2" />

                                            <h2 className="font-medium text-gray-600 text-lg hover:text-blue-600">
                                                Available Actions <span className="text-red-500">*</span>
                                            </h2>
                                        </div>

                                        <Button variant="ghost" size="icon">
                                            {isAvailableActionsOpen ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </CollapsibleTrigger>

                                {/* Content */}
                                <CollapsibleContent className="space-y-4">
                                    <Separator className="mb-4" />

                                    <div className="grid grid-cols-3 gap-6 md:grid-cols-5 rounded-lg bg-white p-4">
                                        {actions.map((option) => {

                                            const isModuleAccess =
                                                option.action_name === "Module Access";

                                            const shouldDisable =
                                                !isModuleAccess && !isModuleAccessEnabled;

                                            const hasLockedActions =
                                                isEditing && availableActions.some((id) => lockedActions.includes(id));

                                            const isLocked =
                                                isEditing &&
                                                ((availableActions.includes(option.id) &&
                                                    lockedActions.includes(option.id)) ||
                                                    (isModuleAccess && hasLockedActions));

                                            return (
                                                <TooltipProvider key={option.id}>
                                                    <Tooltip>

                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`
                                                                    flex items-center gap-3
                                                                    border border-[#e0e0e0]
                                                                    rounded-md
                                                                    p-3
                                                                    max-w-50
                                                                    transition-all
                                                                    ${shouldDisable
                                                                        ? "bg-gray-100 opacity-60 cursor-not-allowed"
                                                                        : "bg-[#f9f9f9] hover:bg-[#f0f0f0] hover:border-[#667eea] cursor-pointer"
                                                                    }
                                                                `}
                                                            >
                                                                <Checkbox
                                                                    id={option.id}
                                                                    disabled={shouldDisable || isLocked}
                                                                    checked={availableActions.includes(option.id)}
                                                                    onCheckedChange={(checked) => {

                                                                        if (!checked && isModuleAccess) {
                                                                            setAvailableActions([]);
                                                                            setSelectedSubModules([]);
                                                                            return;
                                                                        }

                                                                        if (checked) {
                                                                            setAvailableActions((prev) => [
                                                                                ...prev,
                                                                                option.id,
                                                                            ]);
                                                                        } else {
                                                                            setAvailableActions((prev) =>
                                                                                prev.filter(
                                                                                    (item) => item !== option.id
                                                                                )
                                                                            );
                                                                        }

                                                                        if (errors.availableActions) {
                                                                            setErrors((prev) => ({
                                                                                ...prev,
                                                                                availableActions: "",
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className="
                                                                    border-2 border-[#667eea]
                                                                    data-[state=checked]:bg-[#667eea]
                                                                    data-[state=checked]:border-[#667eea]
                                                                    "
                                                                />

                                                                <label
                                                                    htmlFor={option.id}
                                                                    className="text-sm capitalize text-slate-600 leading-none"
                                                                >
                                                                    {option.action_name}
                                                                </label>

                                                               {shouldDisable && (
    <TooltipContent>
        <p>
            Enable module access to use this action
        </p>
    </TooltipContent>
)}

{!shouldDisable && isLocked && (
    <TooltipContent>
        <p>
            This action is assigned to one or more users and cannot be removed.
        </p>
    </TooltipContent>
)}
                                                            </div>
                                                        </TooltipTrigger>

                                                        {shouldDisable && (
                                                            <TooltipContent>
                                                                <p>
                                                                    Enable module access to use this action
                                                                </p>
                                                            </TooltipContent>
                                                        )}

                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
                                    </div>

                                </CollapsibleContent>
                            </Collapsible>

                            {showSubModules && (
                                <Collapsible
                                    open={isSubModulesOpen}
                                    onOpenChange={setIsSubModulesOpen}
                                    className="mb-3 bg-[#fcfcfd] border rounded-lg border-[#ececf1] shadow-sm p-3"
                                >
                                    <CollapsibleTrigger asChild>
                                        <div
                                            className={`flex items-center justify-between cursor-pointer ${isSubModulesOpen ? "mb-4" : ""
                                                }`}
                                        >
                                            <div className="flex items-center">
                                                <ListChecks className="h-5 w-5 text-[#667eea] mr-2" />

                                                <h2 className="font-medium text-gray-600 text-lg hover:text-blue-600">
                                                    Available Dashboard Sub Modules{" "}
                                                    <span className="text-red-500">
                                                        *
                                                    </span>
                                                </h2>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                            >
                                                {isSubModulesOpen ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                        <Separator className="mb-4" />

                                        <div className="grid grid-cols-3 gap-6 md:grid-cols-4 rounded-lg bg-white p-4">

                                            {subModules.map((module) => (
                                                <TooltipProvider key={module.id}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`
                                                                    flex items-center gap-3
                                                                    border rounded-md p-3
                                                                    transition-all
                                                                    ${shouldDisableSubModules
                                                                        ? "bg-gray-100 opacity-60 cursor-not-allowed"
                                                                        : "bg-[#f9f9f9] hover:bg-[#f0f0f0] hover:border-[#667eea]"
                                                                    }
                                                            `}
                                                            >
                                                                <Checkbox
                                                                    id={module.id}
                                                                    disabled={shouldDisableSubModules}
                                                                    checked={selectedSubModules.includes(
                                                                        module.id
                                                                    )}
                                                                    onCheckedChange={(checked) => {

                                                                        if (checked) {
                                                                            setSelectedSubModules(
                                                                                (prev) => [
                                                                                    ...prev,
                                                                                    module.id
                                                                                ]
                                                                            );
                                                                        } else {
                                                                            setSelectedSubModules(
                                                                                (prev) =>
                                                                                    prev.filter(
                                                                                        (item) =>
                                                                                            item !== module.id
                                                                                    )
                                                                            );
                                                                        }

                                                                        if (
                                                                            errors.selectedSubModules
                                                                        ) {
                                                                            setErrors((prev) => ({
                                                                                ...prev,
                                                                                selectedSubModules: ""
                                                                            }));
                                                                        }
                                                                    }}
                                                                />

                                                                <label
                                                                    htmlFor={module.id}
                                                                    className="text-sm text-slate-600"
                                                                >
                                                                    {module.submodule_name}
                                                                </label>
                                                                {shouldDisableSubModules && (
                                                                    <Info className="h-3 w-3 text-gray-400" />
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>

                                                        {shouldDisableSubModules && (
                                                            <TooltipContent>
                                                                <p>
                                                                    Enable module access to use dashboard sub modules
                                                                </p>
                                                            </TooltipContent>
                                                        )}

                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                    {errors.selectedSubModules && (
                                        <p className="text-sm text-red-500">
                                            {errors.selectedSubModules}
                                        </p>
                                    )}

                                </Collapsible>
                            )}

                            {errors.availableActions && (
                                <p className="text-sm text-red-500">
                                    {errors.availableActions}
                                </p>
                            )}
                            {/* </CardContent>
                            </Card> */}


                        </CardContent>
                    </Card>


                    <div className="flex justify-end gap-4">


                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            className="h-11 rounded-xl border border-blue-300 px-6 text-blue-600 bg-blue-50"
                        >
                            Cancel
                        </Button>


                        <Button
                            type="submit"
                            className="h-11 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-500"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {isEditing ? "Update Module" : "Create Module"}
                        </Button>
                    </div>
                </form>
            </div>
<ConfigureActionWorkflowModal
    open={isWorkflowModalOpen}
    onClose={() => setIsWorkflowModalOpen(false)}
    actions={selectedActions}
    selectedWorkflowActions={selectedWorkflowActions}
    setSelectedWorkflowActions={setSelectedWorkflowActions}
    moduleId={selectedModuleId}
/>
        </div >
    );
};


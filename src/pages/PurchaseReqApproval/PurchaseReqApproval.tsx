import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, Check, X, ChevronLeft, ChevronRight, Eye, ArrowUpDown, ArrowUp, ArrowDown, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import { supabase } from '@/Utils/types/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface Approver {
    approval_status: any;
    id: string;
    first_name: string;
    last_name: string;
}

interface PurchaseRequisition {
    categoryType: string;
    id: string;
    prNumber: string;
    prDate: string;
    totalItems: number;
    reqStatus: string;
    reqStatusValue: string;
    createdBy: string;
    status: string;
    trail: string;
    workflowId: string;
    approvalStatus: any[];
    approvers?: Approver[];
    is_multiple_approvers: boolean;
    store_id: string;
    department_id: string;
}

interface ApprovalStatus {
    status: string;
    trail: string;
}

interface PurchaseReqDB {
    category_type: string;
    total_count: number;
    last_trail: undefined;
    last_status: undefined;
    created_by: string;
    created_by_id: string;
    id: string;
    purchase_req_number: string;
    purchase_req_date: string;
    total_items: number | null;
    status: string | null;
    status_value?: string;
    approval_status: ApprovalStatus[] | null;
    system_message_config?: {
        sub_category_id?: string;
    };
    user_mgmt?: {
        first_name?: string;
        last_name?: string;
    };

    created_at: string;
    next_level_role_id: string;
    workflow_id: string;
    approvers?: Approver[];
    department: any;
    multiple_approvers_enabled: boolean;
    store: any;
    approval_users: any[];
}

interface WorkflowConfig {
    id: string;
    process_name: string;
    level: number;
    role_id: string;
    levels: number[];
    override_enabled?: boolean;
}

const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'dd MMM yyyy');
};

type SortFieldPR = 'purchase_req_number' | 'purchase_req_date' | 'total_items';
type SortDirectionPR = 'ASC' | 'DESC' | null;

interface SortConfigPR {
    field: SortFieldPR | null;
    direction: SortDirectionPR;
}

type CategoryTypeFilter = 'all' | 'internal' | 'external';

const PurchaseRequisitionApprovals: React.FC = () => {
    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;
    const userId = userData?.id || null;
    const roleId = userData?.role_id || null;

    const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfigPR, setSortConfigPR] = useState<SortConfigPR>({
        field: 'purchase_req_date',
        direction: 'DESC',
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState<number>(0);
    const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);
    const [loading, setIsLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [_workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfig[]>([]);
    const [canApprovePR, setCanApprovePR] = useState(true);
    const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
    const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
    const [categoryTypeFilter, setCategoryTypeFilter] = useState<CategoryTypeFilter>('all');
    const [moduleId, setModuleId] = useState<string | null>(null);
    const [actionId, setActionId] = useState<string | null>(null);
    

    const navigate = useNavigate();
    const [newStatusId, setNewStatusId] = useState<string | null>(null);

    const fetchModuleAndActionIds = async () => {
      try {
        // Fetch Module ID
        const { data: moduleData, error: moduleError } = await supabase
          .from("main_modules")
          .select("id")
          .eq("module_key", "Purchase Requisitions")
          .single();
    
        if (moduleError || !moduleData) {
          console.error("Error fetching module:", moduleError);
          return;
        }
    
        setModuleId(moduleData.id);
    
        // Fetch Action ID
        const { data: actionData, error: actionError } = await supabase
          .from("available_actions")
          .select("id")
          .eq("action_name", "Add")
          .single();
    
        if (actionError || !actionData) {
          console.error("Error fetching action:", actionError);
          return;
        }
    
        setActionId(actionData.id);
    
        console.log("Module ID:", moduleData.id);
        console.log("Action ID:", actionData.id);
      } catch (err) {
        console.error("Error fetching module/action:", err);
      }
    };
    
    
    useEffect(()=>{
    fetchModuleAndActionIds();
    },[])
    

    // Check the user is 'Super Admin'
    useEffect(() => {
        if (!companyId) return;

        const initializeUser = async () => {
            try {
                // Fetch workflow configurations
                await fetchWorkflowConfigs();

                // Fetch Super Admin role ID
                const { data: roleData, error: roleError } = await supabase
                    .from('role_master')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('name', 'Super Admin')
                    .eq('is_active', true)
                    .single();

                if (roleError) throw roleError

                setIsSuperAdmin(roleId === roleData.id);
            } catch (error) {
                console.error('Error initializing user:', error);
            }
        };

        initializeUser();
    }, [companyId]);

    // Fetch status options
    useEffect(() => {
        if (!companyId) return;

        const fetchStatusOptions = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_message_config')
                    .select('*')
                    .eq('company_id', companyId)
                    .eq('category_id', 'PURCHASE_REQUISITION');

                if (error) {
                    console.error(error);
                    return;
                }

                const newStatus = data.find(
                    (s) => s.sub_category_id === 'NEW'
                );
                setNewStatusId(newStatus?.id || null);
            } catch (error) {
                console.error('Error fetching new status:', error);
            }
        };

        fetchStatusOptions();
    }, [companyId]);

    // Fetch purchase requisitions for approvals
    const fetchPurchaseRequisitions = async () => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase.rpc(
                'get_purchase_requisitions_for_approval',
                {
                    p_company_id: companyId ?? '',
                    p_user_id: userId ?? '',
                    p_user_role_id: roleId ?? '',
                    p_is_super_admin: isSuperAdmin,
                    p_category_type: categoryTypeFilter,
                    p_search: searchQuery || '',
                    p_sort_field: sortConfigPR.field ?? '',
                    p_sort_dir: sortConfigPR.direction?.toLowerCase(),
                    p_page: currentPage,
                    p_limit: itemsPerPage,
                }
            );

            if (error) throw error;

            console.log(data)
            const rows = Array.isArray(data) ? (data as unknown as PurchaseReqDB[]) : [];

            const formatted = rows.map((item) => ({
                id: item.id,
                prNumber: item.purchase_req_number,
                prDate: item.purchase_req_date,
                totalItems: item.total_items ?? 0,
                reqStatus: item.status ?? '',
                reqStatusValue: item.system_message_config?.sub_category_id ?? '',
                createdBy: item.created_by_id,
                status: item.last_status ?? '',
                trail: item.last_trail ?? '',
                workflowId: item.workflow_id,
                nextLevelRoleId: item.next_level_role_id,
                createdAt: item.created_at,
                approvalStatus: item.approval_status ?? [],
                approvers: item.approval_users || [],
                store_id: item.store.id,
                is_multiple_approvers: item.multiple_approvers_enabled,
                department_id: item.department.id,
                categoryType: item.category_type,
            }));


            setRequisitions(formatted);
            setTotalItems(rows[0]?.total_count ?? 0);
        } catch (error) {
            console.error('Error fetching requisitions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId || !newStatusId) return;
        if (isSuperAdmin === null) return;

        fetchPurchaseRequisitions();
    }, [companyId, newStatusId, searchQuery, currentPage, itemsPerPage, sortConfigPR, isSuperAdmin, roleId, categoryTypeFilter]);

    useEffect(() => {
        if (!isApproveDialogOpen) {
            setCanApprovePR(true);
        }
    }, [isApproveDialogOpen]);

    // Pagination
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    // Sorting handler
    function handleSortPR(field: SortFieldPR): void {
        let direction: SortDirectionPR = 'ASC';
        if (sortConfigPR.field === field) {
            if (sortConfigPR.direction === 'ASC') {
                direction = 'DESC';
            } else if (sortConfigPR.direction === 'DESC') {
                direction = null; // Click again to reset
            }
        }
        setSortConfigPR({ field: direction ? field : null, direction });
        setCurrentPage(1);
    }

    // Sort icon helper
    function getSortIconPR(field: SortFieldPR) {
        if (sortConfigPR.field !== field) {
            return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
        }
        if (sortConfigPR.direction === 'ASC') {
            return <ArrowUp className="h-4 w-4 text-blue-600" />;
        }
        if (sortConfigPR.direction === 'DESC') {
            return <ArrowDown className="h-4 w-4 text-blue-600" />;
        }
        return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }

    // Fetch workflow configurations
    const fetchWorkflowConfigs = async () => {
       if (!companyId || !moduleId || !actionId  || !userId) {
  return;
}
        try {
            

            const { data: workflowData, error: workflowError } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId)
  .eq("action_id", actionId) 
  .eq("assigned_to", userId)
  .eq("is_active", true)
  .eq("status", true)
  .order("level", { ascending: true });

if (workflowError) {
  console.error("Error fetching workflow configs:", workflowError);
  toast.error("Failed to fetch workflow configurations");
  return;
}

console.log("Workflow Data:", workflowData);

            // Group by workflow ID and collect levels
            const groupedWorkflows: { [key: string]: WorkflowConfig } = {};
            workflowData?.forEach((config: any) => {
                if (!groupedWorkflows[config.id]) {
                    groupedWorkflows[config.id] = {
                        id: config.id,
                        process_name: config.process_name,
                        level: config.level,
                        role_id: config.role_id,
                        levels: [],
                        override_enabled: config.override_enabled || false
                    };
                }
                groupedWorkflows[config.id].levels.push(config.level);
            });

            setWorkflowConfigs(Object.values(groupedWorkflows));
        } catch (error) {
            console.error('Error fetching workflow configs:', error);
            toast.error('Failed to fetch workflow configurations');
        }
    };

    // Approver dialog opening
    const prepareApproveDialog = async (pr: PurchaseRequisition) => {
        setSelectedPR(pr);
        setComment('');

        let canApprove = true;
         if (!companyId || !moduleId || !actionId  || !userId) {
  return;
}

        try {
          // Fetch workflow for this user
const { data: storeWorkflows, error } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId!)
  .eq("module_id", moduleId!)
  .eq("action_id", actionId!)
  .eq("assigned_to", pr.createdBy)
  .eq("store_id",pr.store_id)
  .eq("is_active", true)
  .eq("status", true)
  .order("level", { ascending: true });

if (error) {
  console.error("Error fetching workflow:", error);
  toast.error("Failed to fetch workflow configuration.");
  return;
}

console.log("Store Workflows:", storeWorkflows);



            if (!storeWorkflows || storeWorkflows.length === 0) {
                toast.error("No workflow configured for this store.");
                return;
            }

            if (isSuperAdmin) {
                const currentWorkflow = storeWorkflows.find((w) => w.id === pr.workflowId);
                if (!currentWorkflow) {
                    toast.error("Current workflow level not found.");
                    return;
                }

                const canOverride = currentWorkflow.override_enabled === true;
                // const userWorkflow = storeWorkflows.find((w) => w.role_id === roleId);

                // const userWorkflowLevel = userWorkflow?.level ?? null;
                // const currentWorkflowLevel = currentWorkflow.level;

                // Block approval if override disabled and not correct level
                if (!canOverride) {
                    canApprove = false;
                }
            }

            setCanApprovePR(canApprove);
            setIsApproveDialogOpen(true);

        } catch (err) {
            console.error("Error in prepareApproveDialog:", err);
            toast.error("Something went wrong while preparing approval.");
        }
    };

    // Check if Super Admin can override for a specific workflow
    const canSuperAdminOverride = async (workflowId: string): Promise<boolean> => {
        try {
            const { data: workflowData, error: workflowError } = await supabase
                .from('workflow_config')
                .select('override_enabled')
                .eq('company_id', companyId!)
                .eq('id', workflowId)
                .single();

            if (workflowError) {
                console.error('Error checking override permission:', workflowError);
                return false;
            }

            return workflowData?.override_enabled === true;
        } catch (error) {
            console.error('Error in canSuperAdminOverride:', error);
            toast.error('Error checking override permissions');
            return false;
        }
    };

    // Purchase requisition approve
    const handleApprove = async (pr: PurchaseRequisition) => {
        if (!pr || !userId || !companyId) return;

        setProcessing(true);
        const toastId = toast.loading("Processing approval...");

        try {
            const canOverride = isSuperAdmin
                ? await canSuperAdminOverride(pr.workflowId)
                : false;

            // If Super Admin but override NOT enabled
            if (isSuperAdmin && !canOverride) {
                toast.error(
                    "Super Admin override is not enabled for this Purchase Requisition workflow. Please follow the regular approval process.",
                    { id: toastId }
                );
                return;
            }

            // Super admin approval override 
            if (isSuperAdmin && canOverride) {
                 if (!companyId || !moduleId || !actionId  || !userId) {
  return;
}

                const { data: workflows, error: workflowError } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId!)
  .eq("action_id", actionId!)
  .eq("assigned_to", pr.createdBy)
  .eq("is_active", true)
  .eq("status", true)
  .order("level", { ascending: true });

if (workflowError) {
  console.error("Failed to fetch workflows:", workflowError);
  toast.error("Failed to fetch workflows");
  return;
}

if (!workflows || workflows.length === 0) {
  toast.error("No active workflow found.");
  return;
}

                if (!workflows || workflows.length === 0) {
                    toast.error("No active workflow found for this Purchase Requisition.");
                    return;
                }

                const currentApprovalStatus = pr.approvalStatus || [];

                let sequence =
                    currentApprovalStatus.length > 0
                        ? Math.max(...currentApprovalStatus.map((a: any) => a.sequence_no || 0))
                        : -1;

                const now = new Date().toISOString();
                const maxLevel = Math.max(...workflows.map((w: any) => w.level));

                let updatedApprovalStatus = [...currentApprovalStatus];

                for (const wf of workflows) {

                    updatedApprovalStatus.push({
                        status: `Level ${wf.level} Approved`,
                        trail: "Approved",
                        role_id: wf.role_id,
                        approvedBy: userId,
                        sequence_no: ++sequence,
                        isFinalized: wf.level === maxLevel,
                        date: now,
                        comment: comment || "Super Admin Override",
                    });
                }

                const { data: approvedStatus } = await supabase
                    .from("system_message_config")
                    .select("id")
                    .eq("company_id", companyId)
                    .eq("category_id", "PURCHASE_REQUISITION")
                    .eq("sub_category_id", "APPROVED")
                    .single();

                await supabase
                    .from("purchase_req_master")
                    .update({
                        approval_status: updatedApprovalStatus,
                        workflow_id: null,
                        next_level_role_id: null,
                        status: approvedStatus?.id,
                    })
                    .eq("id", pr.id);

                // System Log
                await supabase.from("system_log").insert({
                    company_id: companyId,
                    transaction_date: now,
                    module: "Purchase Requisition Approval",
                    scope: "Override",
                    key: pr.prNumber,
                    log: `Purchase Requisition ${pr.prNumber} approved by Super Admin override (User: ${userData?.first_name} ${userData?.last_name}).`,
                    action_by: userId,
                    created_at: now,
                });

                toast.success(
                    `Purchase Requisition ${pr.prNumber} fully approved via Super Admin override`,
                    { id: toastId }
                );

                setIsApproveDialogOpen(false);
                fetchPurchaseRequisitions();
                return;
            }

            // Normal Approval

            // Authorization check
            const isApprover = pr.approvers?.some(a => a.id === userId);

            if (!isApprover) {
                toast.error("You are not authorized to approve this requisition.", { id: toastId });
                return;
            }

            // Fetch Workflow
            const { data: workflow } = await supabase
                .from("workflow_config")
                .select("*")
                .eq("id", pr.workflowId)
                .single();

            if (!workflow) {
                toast.error("Workflow not found.", { id: toastId });
                return;
            }

            const currentLevel = workflow.level;
            const isMulti = workflow.multiple_approvers_enabled === true;

            const approvalStatus = pr.approvalStatus || [];

            // Prevent duplicate approval
            const lastRejectionSeq = Math.max(
                -1,
                ...approvalStatus
                    .filter((a: any) => a.trail === "Rejected")
                    .map((a: any) => a.sequence_no || -1)
            );

            const alreadyApproved = approvalStatus.some(
                (a: any) =>
                    a.role_id === workflow.role_id &&
                    a.approvedBy === userId &&
                    (a.sequence_no ?? 0) > lastRejectionSeq
            );

            if (alreadyApproved) {
                toast.error("You already approved this level.", { id: toastId });
                return;
            }

            // Count approvals
            const approvalsForLevel =
                approvalStatus.filter(
                    (a: any) =>
                        a.role_id === workflow.role_id &&
                        a.approvedBy &&
                        (a.sequence_no ?? 0) > lastRejectionSeq
                ) || [];

            const requiredApprovers = pr.approvers?.length || 0;
            const approvalsDone = approvalsForLevel.length + 1;

            const levelCompleted = isMulti
                ? approvalsDone >= requiredApprovers
                : true;

            // Current sequence
            const currentSequence =
                approvalStatus.length > 0
                    ? Math.max(...approvalStatus.map((a: any) => a.sequence_no || 0))
                    : -1;

            const now = new Date().toISOString();

            let updatedApprovalStatus = [
                ...approvalStatus,
                {
                    status: levelCompleted
                        ? `Level ${currentLevel} Approval Completed`
                        : `Level ${currentLevel} Approval – In Progress`,
                    trail: levelCompleted ? "Approved" : "In Progress",
                    role_id: workflow.role_id,
                    approvedBy: userId,
                    sequence_no: currentSequence + 1,
                    isFinalized: false,
                    date: now,
                    comment: comment || "",
                },
            ];

            // Waiting for other approvers
            if (!levelCompleted) {

                await supabase
                    .from("purchase_req_master")
                    .update({
                        approval_status: updatedApprovalStatus,
                    })
                    .eq("id", pr.id);

                // System log
                await supabase.from("system_log").insert({
                    company_id: companyId,
                    transaction_date: now,
                    module: "Purchase Requisition Approval",
                    scope: "Approve",
                    key: pr.prNumber,
                    log: `Purchase Requisition ${pr.prNumber} level ${currentLevel} approved by ${userData?.first_name} ${userData?.last_name}. Waiting for other approvers.`,
                    action_by: userId,
                    created_at: now,
                });

                toast.success("Approval recorded. Waiting for other approvers.", {
                    id: toastId,
                });

                setIsApproveDialogOpen(false);
                fetchPurchaseRequisitions();
                return;
            }

           // Find and Validate next level approvers before moving forward
const { data: nextLevelData, error: nextLevelError } =
  await supabase.rpc(
    "validate_next_level_workflow_approvers",
    {
      p_company_id: companyId,
      p_store_id: pr.store_id,
      p_department_id: pr?.department_id ?? "",
      p_module_key: "Purchase Requisitions",
      p_action_name: "Add",
      p_assigned_to: pr.createdBy,
      p_current_level: currentLevel,
    } as any
  );

console.log("Next Level Data:", nextLevelData);
console.log("Next Level Error:", nextLevelError);

if (nextLevelError) {
  toast.error("Failed to validate next workflow level.", { id: toastId });
  return;
}

            // If next level exists but has NO approvers → block
            if (nextLevelData && nextLevelData.length > 0) {
                const nextLevel = nextLevelData[0];

                if (!nextLevel.has_approvers) {
                    toast.error(
                        `Next level (Level ${nextLevel.next_level}) has no configured approval users for this department.`,
                        { id: toastId }
                    );
                    return;
                }
            }

            let updateData: any = {};

            const nextWorkflow = nextLevelData?.[0];

            // Final level
            if (!nextWorkflow) {

                const { data: approvedStatus } = await supabase
                    .from("system_message_config")
                    .select("id")
                    .eq("company_id", companyId)
                    .eq("category_id", "PURCHASE_REQUISITION")
                    .eq("sub_category_id", "APPROVED")
                    .single();

                updatedApprovalStatus = updatedApprovalStatus.map((entry, i, arr) =>
                    i === arr.length - 1
                        ? { ...entry, isFinalized: true }
                        : entry
                );

                updateData = {
                    approval_status: updatedApprovalStatus,
                    workflow_id: null,
                    next_level_role_id: null,
                    status: approvedStatus?.id,
                };

                toast.success(
                    `Purchase Requisition ${pr.prNumber} has been fully approved`,
                    { id: toastId }
                );
            }

            // Move to next level
            else {

                updatedApprovalStatus.push({
                    status: `Level ${nextWorkflow.next_level} Approval Pending`,
                    trail: "Pending",
                    role_id: nextWorkflow.next_role_id,
                    sequence_no: currentSequence + 2,
                    isFinalized: false,
                    date: now,
                });

                updateData = {
                    approval_status: updatedApprovalStatus,
                    workflow_id: nextWorkflow.next_workflow_id,
                    next_level_role_id: nextWorkflow.next_role_id,
                };

                toast.success(
                    `Purchase Requisition ${pr.prNumber} forwarded to next level`,
                    { id: toastId }
                );
            }

            // Update PR
            await supabase
                .from("purchase_req_master")
                .update(updateData)
                .eq("id", pr.id);

            const systemLogMsg = nextWorkflow
                ? `Purchase Requisition ${pr.prNumber} level ${currentLevel} approved by ${userData?.first_name} ${userData?.last_name} and moved to level ${nextWorkflow.next_level}.`
                : `Purchase Requisition ${pr.prNumber} fully approved at final level ${currentLevel} by ${userData?.first_name} ${userData?.last_name}.`;

            // System log
            await supabase.from("system_log").insert({
                company_id: companyId,
                transaction_date: now,
                module: "Purchase Requisition Approval",
                scope: "Approve",
                key: pr.prNumber,
                log: systemLogMsg,
                action_by: userId,
                created_at: now,
            });

            setIsApproveDialogOpen(false);
            setComment("");

            fetchPurchaseRequisitions();

        } catch (err) {
            console.error(err);
            toast.error("Failed to process approval.", { id: toastId });
        } finally {
            setProcessing(false);
        }
    };

    // Purchase requisition rejection
    const handleReject = async (pr: PurchaseRequisition) => {
        if (!comment.trim() || !pr || !userId || !companyId) {
            toast.error("Rejection comment is required");
            return;
        }

        setProcessing(true);
        const toastId = toast.loading("Processing rejection...");

        try {
            // Fetch current workflow
            const { data: workflow, error: wfError } = await supabase
                .from("workflow_config")
                .select("*")
                .eq("id", pr.workflowId)
                .single();

            if (wfError || !workflow) {
                toast.error("Workflow not found.", { id: toastId });
                return;
            }

            const currentLevel = workflow.level;
            const approvalStatus = pr.approvalStatus || [];

            // Current sequence
            const currentSequence =
                approvalStatus.length > 0
                    ? Math.max(...approvalStatus.map((a: any) => a.sequence_no || 0))
                    : -1;

            const now = new Date().toISOString();

            const fullRejectEnabled = workflow?.full_rejection_enabled === true;

            let updatedApprovalStatus = [
                ...approvalStatus,
                {
                    status: fullRejectEnabled
                        ? `Purchase Requisition Fully Rejected at Level ${currentLevel}`
                        : currentLevel === 1
                            ? "Created - Rejected"
                            : `Level ${currentLevel} Approval Rejected`,
                    trail: "Rejected",
                    role_id: workflow.role_id,
                    rejectedBy: userId,
                    sequence_no: currentSequence + 1,
                    isFinalized: false,
                    date: now,
                    comment,
                },
            ];

            // Full Rejection (Enabled or Level 1)
            if (fullRejectEnabled || currentLevel === 1) {

                const { data: rejectedStatus } = await supabase
                    .from("system_message_config")
                    .select("id")
                    .eq("company_id", companyId)
                    .eq("category_id", "PURCHASE_REQUISITION")
                    .eq("sub_category_id", "REJECTED")
                    .single();

                await supabase
                    .from("purchase_req_master")
                    .update({
                        approval_status: updatedApprovalStatus,
                        workflow_id: null,
                        next_level_role_id: null,
                        status: rejectedStatus?.id,
                    })
                    .eq("id", pr.id);

                // System Log
                await supabase.from("system_log").insert({
                    company_id: companyId,
                    transaction_date: now,
                    module: "Purchase Requisition Approval",
                    scope: "Reject",
                    key: pr.prNumber,
                    log: fullRejectEnabled
                        ? `Purchase Requisition ${pr.prNumber} fully rejected at level ${currentLevel} by ${userData?.first_name} ${userData?.last_name}.`
                        : `Purchase Requisition ${pr.prNumber} level 1 rejected by ${userData?.first_name} ${userData?.last_name} and moved to Created.`,
                    action_by: userId,
                    created_at: now,
                });

                toast.success(
                    `Purchase Requisition ${pr.prNumber} has been fully rejected and moved to Created`,
                    { id: toastId }
                );

                fetchPurchaseRequisitions();
                return;
            }

           if (!companyId || !moduleId || !actionId || !userId) {
  toast.error("Workflow configuration is not ready.", { id: toastId });
  return;
}

// Move back to previous level
const { data: prevWorkflow, error: prevError } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId)
  .eq("action_id", actionId)
  .eq("assigned_to", userId)
  .eq("level", currentLevel - 1)
  .eq("is_active", true)
  .eq("status", true)
  .single();

if (prevError || !prevWorkflow) {
  console.error("Previous workflow not found:", prevError);
  toast.error("Previous workflow not found.", { id: toastId });
  return;
}

            updatedApprovalStatus = updatedApprovalStatus.map(entry => {

                if (entry.isFinalized) {
                    return { ...entry, isFinalized: false };
                }

                return entry;
            });

            // Update PR
            const { error: updateError } = await supabase
                .from("purchase_req_master")
                .update({
                    approval_status: updatedApprovalStatus,
                    workflow_id: prevWorkflow.id,
                    next_level_role_id: prevWorkflow.role_id,
                })
                .eq("id", pr.id);

            if (updateError) throw updateError;

            // System Log
            await supabase.from("system_log").insert({
                company_id: companyId,
                transaction_date: now,
                module: "Purchase Requisition Approval",
                scope: "Reject",
                key: pr.prNumber,
                log: `Purchase Requisition ${pr.prNumber} level ${currentLevel} rejected by ${userData?.first_name} ${userData?.last_name}.`,
                action_by: userId,
                created_at: now,
            });

            toast.success(
                `Purchase Requisition ${pr.prNumber} has been rejected`,
                { id: toastId }
            );

            fetchPurchaseRequisitions();

        } catch (err) {
            console.error(err);
            toast.error("Failed to process rejection.", { id: toastId });
        } finally {
            setProcessing(false);
            setIsRejectDialogOpen(false);
            setSelectedPR(null);
            setComment("");
        }
    };

    const handleFilterReset = () => {
        setSearchQuery('');
        setCurrentPage(1);
        setCategoryTypeFilter('all');
    };

    const getApprovalStatusStyle = (status?: string) => {
        if (!status) return 'bg-gray-100 text-gray-600';

        if (status.includes('Pending'))
            return 'bg-yellow-100 text-yellow-800';

        if (status.includes('Approved'))
            return 'bg-green-100 text-green-800';

        return 'bg-gray-100 text-gray-600';
    };

    const hasUserApproved = (pr: PurchaseRequisition) => {
        return pr.approvers?.some(
            (approver) =>
                approver.id === userId &&
                approver.approval_status === "Approved"
        );
    };

    return (
        <TooltipProvider>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <Card className="min-h-[85vh] shadow-sm">
                    <CardHeader className="rounded-t-lg border-b pb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-lg bg-indigo-100 shadow-sm">
                                <FileText className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-bold">Purchase Requisition Approvals</CardTitle>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <div className="mb-6 space-y-4">
                            <div className="flex flex-row items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search Purchase Requisition Number..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Category Type Filtration */}
                                <div className="flex items-center gap-2 w-full sm:w-[180px]">
                                    <Select
                                        value={categoryTypeFilter}
                                        onValueChange={(value) => {
                                            setCategoryTypeFilter(value as CategoryTypeFilter);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="All Category Types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Category Types</SelectItem>
                                            <SelectItem value="internal">Internal</SelectItem>
                                            <SelectItem value="external">External</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" onClick={handleFilterReset}>
                                    Clear Filters
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 border-b border-gray-200">
                                        <TableHead className="font-semibold">
                                            <button
                                                onClick={() => handleSortPR('purchase_req_number')}
                                                className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer"
                                            >
                                                Purchase Requisition Order #
                                                {getSortIconPR('purchase_req_number')}
                                            </button>
                                        </TableHead>

                                        <TableHead className="font-semibold">
                                            <button
                                                onClick={() => handleSortPR('purchase_req_date')}
                                                className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer"
                                            >
                                                Requisition Date
                                                {getSortIconPR('purchase_req_date')}
                                            </button>
                                        </TableHead>

                                        <TableHead className="font-semibold">Category Type</TableHead>
                                        <TableHead className="font-semibold text-center">
                                            <button
                                                onClick={() => handleSortPR('total_items')}
                                                className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer mx-auto"
                                            >
                                                Total Items
                                                {getSortIconPR('total_items')}
                                            </button>
                                        </TableHead>

                                        <TableHead className="font-semibold hover:text-blue-700">Approvers</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Approval Trail</TableHead>
                                        <TableHead className="font-semibold text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {loading ? (
                                        Array(itemsPerPage)
                                            .fill(0)
                                            .map((_, index) => (
                                                <TableRow key={index} className="hover:bg-gray-50">
                                                    <TableCell><div className="h-4 w-36 bg-gray-200 rounded animate-pulse" /></TableCell>
                                                    <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                                                    <TableCell className="text-center"><div className="h-4 w-10 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                                                    <TableCell className="text-center"><div className="h-8 w-24 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                                                    <TableCell><div className="h-6 w-24 bg-gray-200 rounded animate-pulse" /></TableCell>
                                                    <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                                                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                                                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                    ) : requisitions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center py-6">
                                                    <FileText className="h-12 w-12 text-gray-300 mb-2" />
                                                    <p className="text-base font-medium">No purchase requisitions found</p>
                                                    <p className="text-sm text-gray-500">
                                                        Try adjusting your search or filters
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        requisitions.map((pr) => (
                                            <TableRow key={pr.id} className="hover:bg-gray-50 transition-colors">
                                                <TableCell className="font-medium">{pr.prNumber}</TableCell>
                                                <TableCell>{formatDate(pr.prDate)}</TableCell>
                                                <TableCell className='capitalize'>{pr.categoryType}</TableCell>
                                                <TableCell className="text-center">{pr.totalItems}</TableCell>
                                                <TableCell className="text-center">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedApprovers(pr.approvers || []);
                                                                    setIsApproversDialogOpen(true);
                                                                    setSelectedPR(pr);
                                                                }}
                                                                className="flex items-center gap-2 text-blue-900 hover:bg-blue-50 hover:border-blue-300 transition"
                                                            >
                                                                <Users className="h-4 w-4" />
                                                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                                    {pr.approvers?.filter(approver => approver.approval_status === 'Approved').length || 0}/{pr.approvers?.length || 0}
                                                                </span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Assigned Approvers</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-medium capitalize
                                                            ${pr.trail === 'Pending'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : pr.trail === 'Rejected'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : pr.trail === 'In Progress'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-green-100 text-green-700'
                                                            }`}
                                                    >
                                                        {pr.status}
                                                    </span>
                                                </TableCell>

                                                <TableCell>{pr.trail}</TableCell>

                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => prepareApproveDialog(pr)}
                                                                        disabled={hasUserApproved(pr)}
                                                                        className="text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {hasUserApproved(pr)
                                                                    ? "You have already approved this requisition"
                                                                    : "Approve"}
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            setSelectedPR(pr);
                                                                            setIsRejectDialogOpen(true);
                                                                        }}
                                                                        disabled={hasUserApproved(pr)}
                                                                        className="text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {hasUserApproved(pr)
                                                                    ? "You have already approved this requisition"
                                                                    : "Reject"}
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => navigate(`/dashboard/purchaseReqApprovalView/${pr.id}`)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View Details</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">Show</p>
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={(value) => {
                                        setItemsPerPage(Number(value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">entries</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground hidden sm:block">
                                    Showing {totalItems > 0 ? startIndex : 0} to {endIndex} of {totalItems} entries
                                </p>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                                        Page {currentPage} of {totalPages || 1}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Approve Dialog */}
                <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-blue-700">Confirm PR Approval</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {selectedPR && (
                                <div className="bg-gray-50 p-3 rounded-md">
                                    <p className="text-sm"><strong>PR Number:</strong> {selectedPR.prNumber}</p>
                                    <p className="text-sm"><strong>Date:</strong> {formatDate(selectedPR.prDate)}</p>
                                    <p className="text-sm"><strong>Total Items:</strong> {selectedPR.totalItems}</p>
                                </div>
                            )}
                            <Input
                                placeholder="Add remarks (optional)"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            <p className="text-sm text-gray-600">
                                Are you sure you want to approve this Purchase Requisition?
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <Button
                                                onClick={() => handleApprove(selectedPR!)}
                                                disabled={processing || !canApprovePR}
                                            >
                                                {processing ? 'Processing...' : 'Approve'}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>

                                    {!canApprovePR && isSuperAdmin && (
                                        <TooltipContent>
                                            Super Admin override is not enabled for this workflow.
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Reject Dialog */}
                <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-red-700">Confirm PR Rejection</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {selectedPR && (
                                <div className="bg-gray-50 p-3 rounded-md">
                                    <p className="text-sm"><strong>PR Number:</strong> {selectedPR.prNumber}</p>
                                    <p className="text-sm"><strong>Date:</strong> {formatDate(selectedPR.prDate)}</p>
                                    <p className="text-sm"><strong>Total Items:</strong> {selectedPR.totalItems}</p>
                                </div>
                            )}
                            <Input
                                placeholder="Rejection reason (required)"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            <p className="text-sm text-gray-600">
                                Are you sure you want to reject this Purchase Requisition?
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => handleReject(selectedPR!)}
                                    disabled={!comment.trim() || processing}
                                >
                                    {processing ? 'Processing...' : 'Reject'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Approvers Dialog */}
                <Dialog open={isApproversDialogOpen} onOpenChange={setIsApproversDialogOpen}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className='font-bold'>Assigned Approval Users</DialogTitle>
                        </DialogHeader>

                        <div className="max-h-[500px] overflow-y-auto border rounded-lg py-1">
                            {selectedApprovers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                                    <p className="text-gray-500 font-medium">
                                        No approvers found
                                    </p>

                                    <p className="text-sm text-gray-400 mt-1">
                                        Approvers will appear once the workflow is configured
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow>
                                            <TableHead className="w-[80px]">SI No.</TableHead>
                                            <TableHead>Approver Name</TableHead>
                                            <TableHead className="text-center">Approval Status</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {selectedApprovers.map((approver, index) => (
                                            <TableRow key={approver.id} className="hover:bg-gray-50">

                                                <TableCell className="font-medium py-3">
                                                    {index + 1}
                                                </TableCell>

                                                <TableCell className="font-medium py-3">
                                                    {approver.first_name} {approver.last_name}
                                                </TableCell>

                                                <TableCell className="text-center py-3">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getApprovalStatusStyle(
                                                            approver.approval_status
                                                        )}`}
                                                    >
                                                        {approver.approval_status}
                                                    </span>
                                                </TableCell>

                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {selectedPR?.is_multiple_approvers ? (
                                <>
                                    This workflow requires approval from
                                    <span className="font-semibold"> all assigned approvers</span>.
                                </>
                            ) : (
                                <>
                                    This workflow requires approval from
                                    <span className="font-semibold"> any one assigned approver</span>.
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};

export default PurchaseRequisitionApprovals;
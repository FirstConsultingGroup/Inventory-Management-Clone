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

interface SalesReturn {
  id: string;
  returnNumber: string;
  returnDate: string;
  createdBy: string;
  createdById: string;
  totalItems: number;
  status: string;
  trail: string;
  workflowId: string;
  approvalStatus: any[];
  approvers?: Approver[];
  is_multiple_approvers: boolean;
  store_id: string;
  department_id: string;
}

interface SalesReturnDB {
  total_count: number;
  last_trail: string | undefined;
  last_status: string | undefined;
  created_by: string;
  created_by_id: string;
  id: string;
  sales_return_number: string;
  return_date: string;
  total_items: number | null;
  return_status: string | null;
  status_value?: string;
  approval_status: any[] | null;
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

type SortFieldSR = 'sales_return_number' | 'return_date' | 'total_items';
type SortDirectionSR = 'ASC' | 'DESC' | null;

interface SortConfigSR {
  field: SortFieldSR | null;
  direction: SortDirectionSR;
}

const SalesReturnApprovals: React.FC = () => {
  const userData = useSelector(selectUser);
  const companyId = userData?.company_id || null;
  const userId = userData?.id || null;
  const roleId = userData?.role_id || null;

  const navigate = useNavigate();

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfigSR>({
    field: 'return_date',
    direction: 'DESC',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [_workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfig[]>([]);
  const [canApproveSR, setCanApproveSR] = useState(true);
  const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);
    const [moduleId,setModuleId]=useState("");
    const [actionId,setActionId]=useState("");

  // Check Super Admin + fetch workflow configs
  useEffect(() => {
    if (!companyId) return;

    const initializeUser = async () => {
      try {

        const { data: roleData, error: roleError } = await supabase
          .from('role_master')
          .select('id')
          .eq('company_id', companyId)
          .eq('name', 'Super Admin')
          .eq('is_active', true)
          .single();

        if (roleError) throw roleError;
        setIsSuperAdmin(roleId === roleData.id);
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initializeUser();
  }, [companyId]);

      useEffect(() => {
      const fetchModuleAndActionId=async()=>{
        
         if (!userId || !companyId) return;
  
        const { data: moduleData } = await supabase
                 .from("main_modules")
                 .select("id")
                 .eq("module_key", "Sales Returns")
                 .single();
  
                 if(moduleData){
                  setModuleId(moduleData?.id)
                 }
       
               const { data: actionData } = await supabase
                 .from("available_actions")
                 .select("id")
                 .eq("action_name", "Add")
                 .single();
  
                 if(actionData){
                  setActionId(actionData?.id)
                 }

      }
  
      fetchModuleAndActionId();
       
    }, [userId,companyId])

  // Fetch sales returns for approval
  const fetchSalesReturns = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_sales_returns_for_approval', {
        p_company_id: companyId ?? '',
        p_user_id: userId ?? '',
        p_user_role_id: roleId ?? '',
        p_is_super_admin: isSuperAdmin,
        p_search: searchQuery || '',
        p_sort_field: sortConfig.field ?? '',
        p_sort_dir: sortConfig.direction?.toLowerCase(),
        p_page: currentPage,
        p_limit: itemsPerPage,
      });

      if (error) throw error;

      const rows = Array.isArray(data) ? (data as unknown as SalesReturnDB[]) : [];

      console.log('Fetched sales returns:', rows);

      const formatted = rows.map((item) => ({
        id: item.id,
        returnNumber: item.sales_return_number,
        returnDate: item.return_date,
        totalItems: item.total_items ?? 0,
        createdBy: item.created_by,
        createdById: item.created_by_id,
        status: item.last_status ?? '',
        trail: item.last_trail ?? '',
        workflowId: item.workflow_id,
        approvalStatus: item.approval_status ?? [],
        approvers: item.approval_users || [],
        store_id: item.store?.id,
        is_multiple_approvers: item.multiple_approvers_enabled,
        department_id: item.department?.id,
      }));

      setReturns(formatted);
      setTotalItems(rows[0]?.total_count ?? 0);
    } catch (error) {
      console.error('Error fetching sales returns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    fetchSalesReturns();
  }, [companyId, searchQuery, currentPage, itemsPerPage, sortConfig, isSuperAdmin, roleId]);

  useEffect(() => {
    if (!isApproveDialogOpen) {
      setCanApproveSR(true);
    }
  }, [isApproveDialogOpen]);

  // Pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Sorting
  const handleSort = (field: SortFieldSR) => {
    let direction: SortDirectionSR = 'ASC';
    if (sortConfig.field === field) {
      if (sortConfig.direction === 'ASC') direction = 'DESC';
      else if (sortConfig.direction === 'DESC') direction = null;
    }
    setSortConfig({ field: direction ? field : null, direction });
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortFieldSR) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    if (sortConfig.direction === 'ASC') return <ArrowUp className="h-4 w-4 text-blue-600" />;
    if (sortConfig.direction === 'DESC') return <ArrowDown className="h-4 w-4 text-blue-600" />;
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  // Fetch workflow configurations
  useEffect(() => {
    const fetchWorkflowConfigs = async () => {

    try {

      if (!companyId || !userId || !moduleId || !actionId) return;
      
            const { data: workflowData, error: workflowError } = await supabase
              .from('workflow_config')
              .select('*')
              .eq('company_id', companyId)
              .eq("module_id", moduleId)
              .eq("action_id", actionId)
              .eq("assigned_to", userId)
              .eq('is_active', true)
              .eq('status', true)
              .order('level', { ascending: true });


      if (workflowError) {
        console.error('Error fetching workflow configs:', workflowError);
        toast.error('Failed to fetch workflow configurations');
        return;
      }
      console.log("workflowData",workflowData)

      const groupedWorkflows: { [key: string]: WorkflowConfig } = {};
      workflowData?.forEach((config: any) => {
        if (!groupedWorkflows[config.id]) {
          groupedWorkflows[config.id] = {
            id: config.id,
            process_name: config.process_name,
            level: config.level,
            role_id: config.role_id,
            levels: [],
            override_enabled: config.override_enabled || false,
          };
        }
        groupedWorkflows[config.id].levels.push(config.level);
      });

      setWorkflowConfigs(Object.values(groupedWorkflows));
    } catch (error) {
      console.error('Error fetching workflow configs:', error);
    }
  };

  fetchWorkflowConfigs();
  }, [companyId, userId, moduleId, actionId])

  // Check if Super Admin can override
  const canSuperAdminOverride = async (workflowId: string): Promise<boolean> => {
    try {
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflow_config')
        .select('override_enabled')
        .eq('company_id', companyId!)
        .eq('id', workflowId)
        .single();

      if (workflowError) return false;
      return workflowData?.override_enabled === true;
    } catch {
      return false;
    }
  };

  // Prepare approve dialog
  const prepareApproveDialog = async (sr: SalesReturn) => {
    setSelectedReturn(sr);
    setComment('');

    let canApprove = true;

    try {
      // Fetch workflow for this Sales Return store

      if (!companyId || !userId || !moduleId || !actionId) return;

      const { data: storeWorkflows, error } = await supabase
        .from("workflow_config")
        .select("*")
        .eq("company_id", companyId!)
        .eq("module_id", moduleId)
        .eq("action_id", actionId)
        .eq("assigned_to", sr.createdById)
        .eq("store_id", sr.store_id)
        .eq("is_active", true)
        .eq("status", true)
        .order("level", { ascending: true });

      if (error) {
        console.error("Error fetching workflow:", error);
        toast.error("Failed to fetch workflow configuration.");
        return;
      }

      console.log("storeWorkflows",storeWorkflows)

      if (!storeWorkflows || storeWorkflows.length === 0) {
        toast.error("No workflow configured for this store.");
        return;
      }

      if (isSuperAdmin) {
        const currentWorkflow = storeWorkflows.find((w) => w.id === sr.workflowId);
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

      setCanApproveSR(canApprove);
      setIsApproveDialogOpen(true);

    } catch (err) {
      console.error("Error preparing approval dialog:", err);
      toast.error("Something went wrong while preparing approval.");
    }
  };

  // Approve handler
  const handleApprove = async (sr: SalesReturn) => {
    if (!sr || !userId || !companyId) return;

    setProcessing(true);
    const toastId = toast.loading('Processing approval...');

    try {
      const canOverride = isSuperAdmin ? await canSuperAdminOverride(sr.workflowId) : false;

      // Super Admin override blocked
      if (isSuperAdmin && !canOverride) {
        toast.error(
          'Super Admin override is not enabled for this Sales Return workflow. Please follow the regular approval process.',
          { id: toastId }
        );
        return;
      }

      // Super Admin override
      if (isSuperAdmin && canOverride) {

        if (!companyId || !userId || !moduleId || !actionId) return;

        const { data: workflows, error: workflowError } = await supabase
          .from('workflow_config')
          .select('*')
          .eq('company_id', companyId)
          .eq("module_id", moduleId)
          .eq("action_id", actionId)
          .eq("assigned_to", sr.createdById)
          .eq('store_id', sr.store_id)
          .eq('is_active', true)
          .eq('status', true)
          .order('level', { ascending: true });

        if (workflowError || !workflows || workflows.length === 0) {
          toast.error('No active workflow found for this Sales Return.', { id: toastId });
          return;
        }
        console.log("workflows",workflows)

        const currentApprovalStatus = sr.approvalStatus || [];
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
            trail: 'Approved',
            role_id: wf.role_id,
            approvedBy: userId,
            sequence_no: ++sequence,
            isFinalized: wf.level === maxLevel,
            date: now,
            comment: comment || 'Super Admin Override',
          });
        }

        const { data: approvedStatus } = await supabase
          .from('system_message_config')
          .select('id')
          .eq('company_id', companyId)
          .eq('category_id', 'SALES_RETURN')
          .eq('sub_category_id', 'APPROVER_COMPLETED')
          .single();

        await supabase
          .from('sales_return')
          .update({
            approval_status: updatedApprovalStatus,
            workflow_id: null,
            next_level_role_id: null,
            return_status: approvedStatus?.id,
          })
          .eq('id', sr.id);

        await supabase.from('system_log').insert({
          company_id: companyId,
          transaction_date: now,
          module: 'Sales Return Approval',
          scope: 'Override',
          key: sr.returnNumber,
          log: `Sales Return ${sr.returnNumber} approved by Super Admin override (User: ${userData?.first_name} ${userData?.last_name}).`,
          action_by: userId,
          created_at: now,
        });

        toast.success(`Sales Return ${sr.returnNumber} fully approved via Super Admin override`, { id: toastId });
        setIsApproveDialogOpen(false);
        fetchSalesReturns();
        return;
      }

      // Normal approval — authorization check
      const isApprover = sr.approvers?.some((a) => a.id === userId);
      if (!isApprover) {
        toast.error('You are not authorized to approve this sales return.', { id: toastId });
        return;
      }

      // Fetch workflow
      const { data: workflow } = await supabase
        .from('workflow_config')
        .select('*')
        .eq('id', sr.workflowId)
        .single();

      if (!workflow) {
        toast.error('Workflow not found.', { id: toastId });
        return;
      }

      const currentLevel = workflow.level;
      const isMulti = workflow.multiple_approvers_enabled === true;
      const approvalStatus = sr.approvalStatus || [];

      // Prevent duplicate approval
      const lastRejectionSeq = Math.max(
        -1,
        ...approvalStatus
          .filter((a: any) => a.trail === 'Rejected')
          .map((a: any) => a.sequence_no || -1)
      );

      const alreadyApproved = approvalStatus.some(
        (a: any) =>
          a.role_id === workflow.role_id &&
          a.approvedBy === userId &&
          (a.sequence_no ?? 0) > lastRejectionSeq
      );

      if (alreadyApproved) {
        toast.error('You already approved this level.', { id: toastId });
        return;
      }

      const approvalsForLevel = approvalStatus.filter(
        (a: any) =>
          a.role_id === workflow.role_id &&
          a.approvedBy &&
          (a.sequence_no ?? 0) > lastRejectionSeq
      );

      const requiredApprovers = sr.approvers?.length || 0;
      const approvalsDone = approvalsForLevel.length + 1;
      const levelCompleted = isMulti ? approvalsDone >= requiredApprovers : true;

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
          trail: levelCompleted ? 'Approved' : 'In Progress',
          role_id: workflow.role_id,
          approvedBy: userId,
          sequence_no: currentSequence + 1,
          isFinalized: false,
          date: now,
          comment: comment || '',
        },
      ];

      // Waiting for other approvers
      if (!levelCompleted) {
        await supabase
          .from('sales_return')
          .update({ approval_status: updatedApprovalStatus })
          .eq('id', sr.id);

        await supabase.from('system_log').insert({
          company_id: companyId,
          transaction_date: now,
          module: 'Sales Return Approval',
          scope: 'Approve',
          key: sr.returnNumber,
          log: `Sales Return ${sr.returnNumber} level ${currentLevel} approved by ${userData?.first_name} ${userData?.last_name}. Waiting for other approvers.`,
          action_by: userId,
          created_at: now,
        });

        toast.success('Approval recorded. Waiting for other approvers.', { id: toastId });
        setIsApproveDialogOpen(false);
        fetchSalesReturns();
        return;
      }

      // Validate next level
      const { data: nextLevelData, error: nextLevelError } = await supabase.rpc(
        'validate_next_level_workflow_approvers',
        {
          p_company_id: companyId,
          p_store_id: sr.store_id,
          p_module_key: "Sales Returns",
          p_action_name: "Add",
          p_assigned_to: sr.createdById,
          p_current_level: currentLevel,
          p_department_id: sr?.department_id ?? '',
        }
      );

      if (nextLevelError) {
        toast.error('Failed to validate next workflow level.', { id: toastId });
        return;
      }

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
          .from('system_message_config')
          .select('id')
          .eq('company_id', companyId)
          .eq('category_id', 'SALES_RETURN')
          .eq('sub_category_id', 'APPROVER_COMPLETED')
          .single();

        updatedApprovalStatus = updatedApprovalStatus.map((entry, i, arr) =>
          i === arr.length - 1 ? { ...entry, isFinalized: true } : entry
        );

        updateData = {
          approval_status: updatedApprovalStatus,
          workflow_id: null,
          next_level_role_id: null,
          return_status: approvedStatus?.id,
        };

        toast.success(`Sales Return ${sr.returnNumber} has been fully approved`, { id: toastId });
      } else {
        // Move to next level
        updatedApprovalStatus.push({
          status: `Level ${nextWorkflow.next_level} Approval Pending`,
          trail: 'Pending',
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

        toast.success(`Sales Return ${sr.returnNumber} forwarded to next level`, { id: toastId });
      }

      await supabase.from('sales_return').update(updateData).eq('id', sr.id);

      const systemLogMsg = nextWorkflow
        ? `Sales Return ${sr.returnNumber} level ${currentLevel} approved by ${userData?.first_name} ${userData?.last_name} and moved to level ${nextWorkflow.next_level}.`
        : `Sales Return ${sr.returnNumber} fully approved at final level ${currentLevel} by ${userData?.first_name} ${userData?.last_name}.`;

      await supabase.from('system_log').insert({
        company_id: companyId,
        transaction_date: now,
        module: 'Sales Return Approval',
        scope: 'Approve',
        key: sr.returnNumber,
        log: systemLogMsg,
        action_by: userId,
        created_at: now,
      });

      setIsApproveDialogOpen(false);
      setComment('');
      fetchSalesReturns();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process approval.', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  // Reject handler
  const handleReject = async (sr: SalesReturn) => {
    if (!comment.trim() || !sr || !userId || !companyId) {
      toast.error('Rejection comment is required');
      return;
    }

    setProcessing(true);
    const toastId = toast.loading('Processing rejection...');

    try {
      const { data: workflow, error: wfError } = await supabase
        .from('workflow_config')
        .select('*')
        .eq('id', sr.workflowId)
        .single();

      if (wfError || !workflow) {
        toast.error('Workflow not found.', { id: toastId });
        return;
      }

      const currentLevel = workflow.level;
      const approvalStatus = sr.approvalStatus || [];

      const currentSequence =
        approvalStatus.length > 0
          ? Math.max(...approvalStatus.map((a: any) => a.sequence_no || 0))
          : -1;

      const now = new Date().toISOString();

      // Match PR: check full_rejection_enabled from workflow
      const fullRejectEnabled = workflow?.full_rejection_enabled === true;

      let updatedApprovalStatus = [
        ...approvalStatus,
        {
          status: fullRejectEnabled
            ? `Sales Return Fully Rejected at Level ${currentLevel}`
            : currentLevel === 1
              ? 'Created - Rejected'
              : `Level ${currentLevel} Approval Rejected`,
          trail: 'Rejected',
          role_id: workflow.role_id,
          rejectedBy: userId,
          sequence_no: currentSequence + 1,
          isFinalized: false,
          date: now,
          comment,
        },
      ];

      // Full Rejection (fullRejectEnabled OR level 1) — matches PR logic
      if (fullRejectEnabled || currentLevel === 1) {
        const { data: rejectedStatus } = await supabase
          .from('system_message_config')
          .select('id')
          .eq('company_id', companyId)
          .eq('category_id', 'SALES_RETURN')
          .eq('sub_category_id', 'RETURN_CREATED')
          .single();

        await supabase
          .from('sales_return')
          .update({
            approval_status: updatedApprovalStatus,
            workflow_id: null,
            next_level_role_id: null,
            return_status: rejectedStatus?.id,
          })
          .eq('id', sr.id);

        await supabase.from('system_log').insert({
          company_id: companyId,
          transaction_date: now,
          module: 'Sales Return Approval',
          scope: 'Reject',
          key: sr.returnNumber,
          log: fullRejectEnabled
            ? `Sales Return ${sr.returnNumber} fully rejected at level ${currentLevel} by ${userData?.first_name} ${userData?.last_name}.`
            : `Sales Return ${sr.returnNumber} level 1 rejected by ${userData?.first_name} ${userData?.last_name} and moved to Created.`,
          action_by: userId,
          created_at: now,
        });

        toast.success(
          `Sales Return ${sr.returnNumber} has been fully rejected and moved to Created`,
          { id: toastId }
        );

        fetchSalesReturns();
        return;
      }

      // Move back to previous level

      if (!companyId || !userId || !moduleId || !actionId) return;

      const { data: prevWorkflow, error: prevError } = await supabase
        .from('workflow_config')
        .select('*')
        .eq('company_id', companyId)
        .eq("module_id", moduleId)
        .eq("action_id", actionId)
        .eq("assigned_to", userId)
        .eq('store_id', sr.store_id)
        .eq('level', currentLevel - 1)
        .eq('is_active', true)
        .single();

      if (prevError || !prevWorkflow) {
        toast.error('Previous workflow not found.', { id: toastId });
        return;
      }

      console.log("prevWorkflow",prevWorkflow)

      // Reset isFinalized flags — matches PR logic
      updatedApprovalStatus = updatedApprovalStatus.map((entry) =>
        entry.isFinalized ? { ...entry, isFinalized: false } : entry
      );

      const { error: updateError } = await supabase
        .from('sales_return')
        .update({
          approval_status: updatedApprovalStatus,
          workflow_id: prevWorkflow.id,
          next_level_role_id: prevWorkflow.role_id,
        })
        .eq('id', sr.id);

      if (updateError) throw updateError;

      await supabase.from('system_log').insert({
        company_id: companyId,
        transaction_date: now,
        module: 'Sales Return Approval',
        scope: 'Reject',
        key: sr.returnNumber,
        log: `Sales Return ${sr.returnNumber} level ${currentLevel} rejected by ${userData?.first_name} ${userData?.last_name}.`,
        action_by: userId,
        created_at: now,
      });

      toast.success(`Sales Return ${sr.returnNumber} has been rejected`, { id: toastId });
      fetchSalesReturns();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process rejection.', { id: toastId });
    } finally {
      setProcessing(false);
      setIsRejectDialogOpen(false);
      setSelectedReturn(null);
      setComment('');
    }
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const getApprovalStatusStyle = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-600';
    if (status.includes('Pending')) return 'bg-yellow-100 text-yellow-800';
    if (status.includes('Approved')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-600';
  };

  const hasUserApproved = (sr: SalesReturn) => {
    return sr.approvers?.some(
      (approver) => approver.id === userId && approver.approval_status === 'Approved'
    );
  };

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Sales Return Approvals</CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="flex flex-row items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search Sales Return Number..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
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
                        onClick={() => handleSort('sales_return_number')}
                        className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer"
                      >
                        Sales Return Number #
                        {getSortIcon('sales_return_number')}
                      </button>
                    </TableHead>

                    <TableHead className="font-semibold">
                      <button
                        onClick={() => handleSort('return_date')}
                        className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer"
                      >
                        Return Date
                        {getSortIcon('return_date')}
                      </button>
                    </TableHead>

                    <TableHead className="font-semibold text-center">
                      <button
                        onClick={() => handleSort('total_items')}
                        className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer mx-auto"
                      >
                        Total Items
                        {getSortIcon('total_items')}
                      </button>
                    </TableHead>

                    <TableHead className="font-semibold text-center hover:text-blue-700">Approvers</TableHead>
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
                  ) : returns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center py-6">
                          <FileText className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">No sales returns found</p>
                          <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    returns.map((sr) => (
                      <TableRow key={sr.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{sr.returnNumber}</TableCell>
                        <TableCell>{formatDate(sr.returnDate)}</TableCell>
                        <TableCell className="text-center">{sr.totalItems}</TableCell>

                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedApprovers(sr.approvers || []);
                                  setIsApproversDialogOpen(true);
                                  setSelectedReturn(sr);
                                }}
                                className="flex items-center gap-2 text-blue-900 hover:bg-blue-50 hover:border-blue-300 transition"
                              >
                                <Users className="h-4 w-4" />
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {sr.approvers?.filter((a) => a.approval_status === 'Approved').length || 0}/{sr.approvers?.length || 0}
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
                              ${sr.trail === 'Pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : sr.trail === 'Rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : sr.trail === 'In Progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                              }`}
                          >
                            {sr.status}
                          </span>
                        </TableCell>

                        <TableCell>{sr.trail}</TableCell>

                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => prepareApproveDialog(sr)}
                                    disabled={hasUserApproved(sr)}
                                    className="text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {hasUserApproved(sr)
                                  ? 'You have already approved this return'
                                  : 'Approve'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedReturn(sr);
                                      setIsRejectDialogOpen(true);
                                    }}
                                    disabled={hasUserApproved(sr)}
                                    className="text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {hasUserApproved(sr)
                                  ? 'You have already approved this return'
                                  : 'Reject'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-600 hover:bg-blue-50"
                                  onClick={() => navigate(`/dashboard/SalesReturnApproval/view/${sr.id}`)}
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
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
              <DialogTitle className="text-blue-700">Confirm Sales Return Approval</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedReturn && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm"><strong>Return Number:</strong> {selectedReturn.returnNumber}</p>
                  <p className="text-sm"><strong>Date:</strong> {formatDate(selectedReturn.returnDate)}</p>
                  <p className="text-sm"><strong>Total Items:</strong> {selectedReturn.totalItems}</p>
                </div>
              )}
              <Input
                placeholder="Add remarks (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="text-sm text-gray-600">
                Are you sure you want to approve this Sales Return?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
                  Cancel
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => handleApprove(selectedReturn!)}
                        disabled={processing || !canApproveSR}
                      >
                        {processing ? 'Processing...' : 'Approve'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canApproveSR && isSuperAdmin && (
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
              <DialogTitle className="text-red-700">Confirm Sales Return Rejection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedReturn && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm"><strong>Return Number:</strong> {selectedReturn.returnNumber}</p>
                  <p className="text-sm"><strong>Date:</strong> {formatDate(selectedReturn.returnDate)}</p>
                  <p className="text-sm"><strong>Total Items:</strong> {selectedReturn.totalItems}</p>
                </div>
              )}
              <Input
                placeholder="Rejection reason (required)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="text-sm text-gray-600">
                Are you sure you want to reject this Sales Return?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedReturn!)}
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
              <DialogTitle className="font-bold">Assigned Approval Users</DialogTitle>
            </DialogHeader>

            <div className="max-h-[500px] overflow-y-auto border rounded-lg py-1">
              {selectedApprovers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                  <p className="text-gray-500 font-medium">No approvers found</p>
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
                        <TableCell className="font-medium py-3">{index + 1}</TableCell>
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
              {selectedReturn?.is_multiple_approvers ? (
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

export default SalesReturnApprovals;
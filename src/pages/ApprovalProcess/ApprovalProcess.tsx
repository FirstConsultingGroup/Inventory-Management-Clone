import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, Check, X, ChevronLeft, ChevronRight, Eye, ArrowUpDown, ArrowUp, ArrowDown, Users, History } from 'lucide-react';
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
import { getApprovalViewPath } from '@/Utils/approvalRoutes';

interface approver {
  name: string;
  status: string;
  userId?: string;
  department?: string;
}

interface ApprovalRequest {
  id: string;
  reference: string;
  moduleAction: string;
  moduleName: string;
  actionName: string;
  currentLevel: number;
  requestedBy: string;
  requestDate: string;
  status: string;
  approvers: approver[];
  payload?: any;
  multipleApproversEnabled?: boolean;
  superAdminOverride?: boolean;
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


const ApprovalProcess: React.FC = () => {
    const navigate = useNavigate();
    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;
    const userId = userData?.id || null;
    const roleId = userData?.role_id || null;

    const [requisitions, setRequisitions] = useState<ApprovalRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfigPR, setSortConfigPR] = useState<SortConfigPR>({
        field: 'purchase_req_date',
        direction: 'DESC',
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState<number>(0);
    const [selectedPR, setSelectedPR] = useState<ApprovalRequest | null>(null);
    const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);
    const [loading, setIsLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [_workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfig[]>([]);
    const [canApprovePR, setCanApprovePR] = useState(true);
    const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
    const [selectedApprovers, setSelectedApprovers] = useState<approver[]>([]);
    const [moduleId, setModuleId] = useState<string | 'all'>('all');
    const [actionId, setActionId] = useState<string | 'all'>('all');
    const [modulesList, setModulesList] = useState<{ id: string; module_key: string }[]>([]);
    const [actionsList, setActionsList] = useState<{ id: string; action_name: string }[]>([]);
    


    const fetchModuleAndActionIds = async () => {
      try {
        const { data: mData } = await supabase.from("main_modules").select("id, module_key");
        if (mData) setModulesList(mData as any);

        const { data: aData } = await supabase.from("available_actions").select("id, action_name");
        if (aData) setActionsList(aData as any);
      } catch (err) {
        console.error("Error fetching modules/actions:", err);
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

    // Fetch purchase requisitions for approvals
    const fetchPurchaseRequisitions = async () => {
        if (!userId || !roleId) return;

        setIsLoading(true);
        try {
            const { data, error } = await (supabase.rpc as any)('get_pending_approvals', {
                p_user_id: userId,
                p_role_id: roleId,
                p_store_id: null,
                p_module_id: moduleId === 'all' ? null : moduleId,
                p_action_id: actionId === 'all' ? null : actionId,
                p_search: searchQuery || null,
                p_page: currentPage,
                p_limit: itemsPerPage,
                p_is_super_admin: isSuperAdmin
            });

            if (error) {
                throw error;
            }

            if (data && data.length > 0) {
                const requestIds = data.map((d: any) => d.request_id);
                // Fetch approval history to know who already approved
                const { data: historyData } = await supabase
                    .from('approval_history')
                    .select('approval_request_id, approver_id, level, action, action_date')
                    .in('approval_request_id', requestIds);

                const mappedApprovals: ApprovalRequest[] = data.map((item: any) => {
                    const currentStep = (item.workflow_snapshot || []).find((step: any) => step.level === item.current_level);
                    
                    const requestHistory = historyData?.filter(h => h.approval_request_id === item.request_id) || [];
                    const rejections = requestHistory.filter(h => h.action === 'REJECTED');
                    const lastRejectionDate = rejections.length > 0 
                        ? new Date(Math.max(...rejections.map(r => new Date(r.action_date).getTime())))
                        : null;
                        
                    const currentCycleHistory = lastRejectionDate 
                        ? requestHistory.filter(h => new Date(h.action_date) > lastRejectionDate)
                        : requestHistory;

                    const approversList: approver[] = currentStep?.approval_users?.map((u: any) => {
                        const uid = typeof u === 'string' ? u : (u.id || u);
                        const userHistory = currentCycleHistory.filter(h => 
                            h.level === item.current_level && 
                            h.approver_id === uid
                        );
                        
                        let userStatus = 'PENDING';
                        if (userHistory.some(h => h.action === 'APPROVED')) {
                            userStatus = 'APPROVED';
                        } else if (userHistory.some(h => h.action === 'REJECTED')) {
                            userStatus = 'REJECTED';
                        }
                        
                        return {
                            name: 'Unknown User',
                            userId: uid,
                            status: userStatus,
                            department: 'N/A'
                        };
                    }) || [];

                    return {
                        id: item.request_id,
                        reference: item.reference_number || 'N/A',
                        moduleAction: `${item.module_name} - ${item.action_name}`,
                        moduleName: item.module_name,
                        actionName: item.action_name,
                        currentLevel: item.current_level,
                        requestedBy: item.requested_by_name || 'Unknown',
                        requestDate: item.created_at,
                        status: item.status,
                        approvers: approversList,
                        payload: item.payload,
                        multipleApproversEnabled: currentStep?.multiple_approvers_enabled || false,
                        superAdminOverride: currentStep?.override_enabled || currentStep?.super_admin_override || currentStep?.superAdminOverride || false,
                    };
                });

                setRequisitions(mappedApprovals);
                setTotalItems(data[0]?.total_count || 0);
            } else {
                setRequisitions([]);
                setTotalItems(0);
            }
        } catch (err) {
            console.error("Error fetching approvals:", err);
            toast.error("Failed to load approvals");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId) return;
        if (isSuperAdmin === null) return;

        fetchPurchaseRequisitions();
    }, [companyId, searchQuery, currentPage, itemsPerPage, sortConfigPR, isSuperAdmin, roleId, moduleId, actionId]);

    useEffect(() => {
        if (!isApproveDialogOpen) {
            setCanApprovePR(true);
        }
    }, [isApproveDialogOpen]);

    // Pagination
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    // // Sorting handler
    // function handleSortPR(field: SortFieldPR): void {
    //     let direction: SortDirectionPR = 'ASC';
    //     if (sortConfigPR.field === field) {
    //         if (sortConfigPR.direction === 'ASC') {
    //             direction = 'DESC';
    //         } else if (sortConfigPR.direction === 'DESC') {
    //             direction = null; // Click again to reset
    //         }
    //     }
    //     setSortConfigPR({ field: direction ? field : null, direction });
    //     setCurrentPage(1);
    // }

    // // Sort icon helper
    // function getSortIconPR(field: SortFieldPR) {
    //     if (sortConfigPR.field !== field) {
    //         return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    //     }
    //     if (sortConfigPR.direction === 'ASC') {
    //         return <ArrowUp className="h-4 w-4 text-blue-600" />;
    //     }
    //     if (sortConfigPR.direction === 'DESC') {
    //         return <ArrowDown className="h-4 w-4 text-blue-600" />;
    //     }
    //     return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    // }

    // Approver dialog opening
    const prepareApproveDialog = async (pr: ApprovalRequest | null) => {
        setSelectedPR(pr);
        setComment('');

        let canApprove = true;
         if (!companyId || !moduleId || !actionId  || !userId) {
  return;
}
        try {

            setCanApprovePR(canApprove);
            setIsApproveDialogOpen(true);

        } catch (err) {
            console.error("Error in prepareApproveDialog:", err);
            toast.error("Something went wrong while preparing approval.");
        }
    };

    // Purchase requisition approve
    const handleApprove = async (pr: ApprovalRequest | null) => {
        if (!pr || !userId) return;

        setProcessing(true);
        const toastId = toast.loading("Processing approval...");

        try {
            const { data, error: fnError } = await supabase.functions.invoke('approvals-action', {
                body: {
                    request_id: pr.id,
                    action: 'APPROVED',
                    comments: comment || "Approved",
                    approver_id: userId,
                    force_override: Boolean(isSuperAdmin && pr.superAdminOverride)
                }
            });

            if (fnError) throw fnError;

            let successMessage = "Approval processed successfully.";
            
            if (isSuperAdmin && pr.superAdminOverride) {
                successMessage = "Request approved successfully using Super Admin override. The requested action has been executed.";
            } else if (data?.status === 'PENDING_NEXT_LEVEL') {
                successMessage = "Approval submitted successfully. The request has been moved to the next approval level.";
            } else if (data?.status === 'IN_PROGRESS' || data?.status === 'PENDING') {
                successMessage = "Your approval has been recorded. The request is waiting for the remaining approvers at the current level.";
            } else if (data?.status === 'APPROVED') {
                successMessage = "Request approved successfully. The approval workflow is complete and the requested action has been executed.";
            }

            toast.success(successMessage, { id: toastId });

            if (selectedPR?.id === pr.id) {
                fetchPurchaseRequisitions();
            }
        } catch (err: any) {
            console.error(err);
            let errMsg = "Failed to process approval.";
            if (err?.context?.json) {
                try {
                    const ctxData = await err.context.json();
                    if (ctxData?.message) errMsg = ctxData.message;
                } catch (e) {
                    // ignore
                }
            } else if (err?.message) {
                errMsg = err.message;
            }
            toast.error(errMsg, { id: toastId });
        } finally {
            setProcessing(false);
            setIsApproveDialogOpen(false);
            setSelectedPR(null);
            setComment("");
        }
    };

    // Purchase requisition rejection
    const handleReject = async (pr: ApprovalRequest | null) => {
        if (!pr || !comment.trim()) return;

        setProcessing(true);
        const toastId = toast.loading("Processing rejection...");

        try {
            const { error: fnError } = await supabase.functions.invoke('approvals-action', {
                body: {
                    request_id: pr.id,
                    action: 'REJECTED',
                    comments: comment,
                    approver_id: userId,
                    force_override: Boolean(isSuperAdmin && pr.superAdminOverride)
                }
            });

            if (fnError) throw fnError;

            toast.success(`Purchase Requisition ${pr.reference} rejected successfully`, { id: toastId });

            if (selectedPR?.id === pr.id) {
                fetchPurchaseRequisitions();
                return;
            }
        } catch (err: any) {
            console.error(err);
            let errMsg = "Failed to process rejection.";
            if (err?.context?.json) {
                try {
                    const ctxData = await err.context.json();
                    if (ctxData?.message) errMsg = ctxData.message;
                } catch (e) {
                    // ignore
                }
            } else if (err?.message) {
                errMsg = err.message;
            }
            toast.error(errMsg, { id: toastId });
        } finally {
            setProcessing(false);
            setIsRejectDialogOpen(false);
            setSelectedPR(null);
            setComment("");
        }
    };

    const openApproversDialog = async (pr: ApprovalRequest) => {
        if (!pr.approvers || pr.approvers.length === 0) {
            setSelectedApprovers([]);
            setSelectedPR(pr);
            setIsApproversDialogOpen(true);
            return;
        }

        const userIds = pr.approvers.map(a => a.userId).filter(Boolean);
        if (userIds.length > 0) {
            const { data, error } = await supabase
                .from('user_mgmt')
                .select('id, first_name, last_name, department:department_master(department_name)')
                .in('id', userIds as string[]);

            if (!error && data) {
                const enrichedApprovers = pr.approvers.map(a => {
                    const user = data.find((u: any) => u.id === a.userId);
                    if (user) {
                        return {
                            ...a,
                            name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
                            department: user.department?.department_name || 'N/A'
                        };
                    }
                    return a;
                });
                setSelectedApprovers(enrichedApprovers);
                setSelectedPR(pr);
                setIsApproversDialogOpen(true);
                return;
            }
        }
        
        setSelectedApprovers(pr.approvers);
        setSelectedPR(pr);
        setIsApproversDialogOpen(true);
    };

    const handleFilterReset = () => {
        setSearchQuery('');
        setCurrentPage(1);
        setModuleId('all');
        setActionId('all');
    };

    const getApprovalStatusStyle = (status?: string) => {
        if (!status) return 'bg-gray-100 text-gray-600';

        if (status.includes('Pending'))
            return 'bg-yellow-100 text-yellow-800';

        if (status.includes('Progress') || status === 'IN_PROGRESS')
            return 'bg-blue-100 text-blue-800 border border-blue-200';

        if (status.includes('Approved'))
            return 'bg-green-100 text-green-800';

        return 'bg-gray-100 text-gray-600';
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
                                <CardTitle className="text-2xl font-bold">Approval Requests</CardTitle>
                                <p className="text-sm text-gray-500 mt-1">Manage and track all pending requests requiring your approval.</p>
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

                                {/* Module and Action Filtration */}
                                <div className="flex items-center gap-2 w-full sm:w-[360px]">
                                    <Select
                                        value={moduleId}
                                        onValueChange={(value) => {
                                            setModuleId(value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="All Modules" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Modules</SelectItem>
                                            {modulesList.map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.module_key}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={actionId}
                                        onValueChange={(value) => {
                                            setActionId(value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="All Actions" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Actions</SelectItem>
                                            {actionsList.map(a => (
                                                <SelectItem key={a.id} value={a.id}>{a.action_name}</SelectItem>
                                            ))}
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
                                        <TableHead className="w-[150px] font-semibold text-gray-700">Request ID</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Module & Action</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Requested By</TableHead>

                                        <TableHead className="font-semibold text-gray-700">
                                            <button
                                                className="flex items-center gap-1 hover:text-blue-600 font-semibold cursor-pointer"
                                            >
                                                Requested Date
                                            </button>
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-right">Current Level</TableHead>
                                        <TableHead className="font-semibold text-gray-700 hover:text-blue-700 text-center">Approvers</TableHead>
                                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
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
                                        requisitions.map((pr,index) => (
                                            <TableRow key={index} className="hover:bg-gray-50 transition-colors">
                                                <TableCell className="font-medium">{pr.reference}</TableCell>
                                        <TableCell className="font-medium">{pr.moduleAction}</TableCell>
                                        <TableCell className='capitalize'>{pr.requestedBy}</TableCell>
                                        <TableCell>{formatDate(pr.requestDate)}</TableCell>
                                        <TableCell className="font-medium text-right pr-6">{pr.currentLevel}</TableCell>
                                        <TableCell className="text-center">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openApproversDialog(pr)}
                                                        className="flex items-center gap-2 text-blue-900 hover:bg-blue-50 hover:border-blue-300 transition"
                                                    >
                                                        <Users className="h-4 w-4" />
                                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                            {pr.approvers?.filter(approver => approver.status === 'APPROVED').length || 0}/{pr.approvers?.length || 0}
                                                        </span>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    View Approvers
                                                </TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`capitalize px-3 py-1 font-medium ${
                                                    pr.status === 'APPROVED' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                                                    pr.status === 'REJECTED' ? 'bg-red-100 text-red-800 hover:bg-red-100' :
                                                    pr.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                                                    'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                                                }`}
                                            >
                                                {pr.status.toLowerCase().replace('_', ' ')}
                                            </Badge>
                                        </TableCell>

                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-2">
                                                        {(() => {
                                                            let isAuthorized = pr.approvers.some(a => a.userId === userId);
                                                            
                                                            if (isSuperAdmin && pr.superAdminOverride) {
                                                                isAuthorized = true;
                                                            }

                                                            const hasApproved = pr.multipleApproversEnabled && pr.approvers.some(a => a.userId === userId && a.status === 'APPROVED');
                                                            
                                                            let disabled = false;
                                                            let tooltipText = "";
                                                            
                                                            if (!isAuthorized) {
                                                                disabled = true;
                                                                if (isSuperAdmin) {
                                                                    tooltipText = "Super Admin override is disabled for this workflow level.";
                                                                } else {
                                                                    tooltipText = "You are not authorized to approve or reject this request.";
                                                                }
                                                            } else if (hasApproved) {
                                                                disabled = true;
                                                                tooltipText = "You have already submitted your approval for this level.";
                                                            }

                                                            return (
                                                                <>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    onClick={() => prepareApproveDialog(pr)}
                                                                                    disabled={disabled}
                                                                                    className="text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                                >
                                                                                    <Check className="h-4 w-4" />
                                                                                </Button>
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                           {tooltipText || "Approve"}
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
                                                                                    disabled={disabled}
                                                                                    className="text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                                >
                                                                                    <X className="h-4 w-4" />
                                                                                </Button>
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            {tooltipText || "Reject"}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </>
                                                            );
                                                        })()}

                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => navigate(`/dashboard/approval-history/${pr.id}`)}
                                                                >
                                                                    <History className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View Approval History</TooltipContent>
                                                        </Tooltip>

                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-indigo-600 hover:bg-indigo-50"
                                                                    onClick={() => {
                                                                        const path = getApprovalViewPath(pr.moduleName, pr.id);
                                                                        if (path) {
                                                                            navigate(path);
                                                                        } else {
                                                                            toast.error(`View route not configured for ${pr.moduleName}`);
                                                                        }
                                                                    }}
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View Document</TooltipContent>
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
                                    <p className="text-sm"><strong>PR Number:</strong> {selectedPR.reference}</p>
                                    <p className="text-sm"><strong>Date:</strong> {formatDate(selectedPR.requestDate)}</p>
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
                                                disabled={processing}
                                            >
                                                {processing ? 'Processing...' : 'Approve'}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
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
                                    <p className="text-sm"><strong>PR Number:</strong> {selectedPR.reference}</p>
                                    <p className="text-sm"><strong>Date:</strong> {formatDate(selectedPR.requestDate)}</p>
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
                                            <TableHead className="w-[80px]">Sl No.</TableHead>
                                            <TableHead>Approver Name</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead className="text-right">Approval Status</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {selectedApprovers.map((approver, index) => (
                                            <TableRow key={index} className="hover:bg-gray-50">

                                                <TableCell className="font-medium py-3">
                                                    {index + 1}
                                                </TableCell>

                                                <TableCell className="py-3">
                                                    <span className="font-medium text-gray-700 capitalize">{approver.name}</span>
                                                </TableCell>
                                                
                                                <TableCell className="py-3">
                                                    <span className="text-gray-600">{approver.department || 'N/A'}</span>
                                                </TableCell>

                                                <TableCell className="text-right py-3">
                                                    <Badge
                                                        variant="secondary"
                                                        className={`capitalize px-3 py-1 text-xs font-semibold ${
                                                            approver.status === 'APPROVED' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                            approver.status === 'REJECTED' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                            'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                                                        }`}
                                                    >
                                                        {approver.status.toLowerCase()}
                                                    </Badge>
                                                </TableCell>

                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-4 text-center">
                                    This workflow requires approval from
                                    <span className="font-semibold"> {selectedPR?.multipleApproversEnabled ? 'all assigned approvers' : 'any one assigned approver'}</span>.
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};

export default ApprovalProcess;
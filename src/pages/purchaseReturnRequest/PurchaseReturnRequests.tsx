import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Search,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { formatCurrency } from "@/Utils/formatters";
// import { getLocalDateTime } from "@/Utils/commonFun";
// import { triggerNotificationUpdate } from "@/Utils/notificationEvents";

// Notification payload for system_notification
// interface NotificationPayload {
//   assign_to: string;
//   message: string;
//   status: "New" | "Read" | "Deleted";
//   priority: "Low" | "Medium" | "High";
//   alert_type: string;
//   entity_id: string;
// }

// Interface for Approver
interface Approver {
  id: string;
  first_name: string;
  last_name: string;
  approval_status: string;
}

// Interface for PurchaseReturn
interface PurchaseReturn {
  id: string;
  return_number: string;
  supplier: string;
  returnDate: string;
  total_items: number;
  value: number;
  status: string;
  remark: string;
  approval_status: any[];
  created_by: string;
  created_at: string;
  purchase_order_id: string;
  workflow_id: string | null;
  next_level_role_id: string | null;
  approvers?: Approver[];
  is_multiple_approvers: boolean;
  trail: string;
  department_id: string;
  store_id: string;
}

// Interface for Filters
interface Filters {
  status: string;
}

type SortFieldPR = "purchase_return_number" | "return_date" | "total_value" | "total_items";
type SortDirectionPR = "ASC" | "DESC" | null;

interface SortConfigPR {
  field: SortFieldPR | null;
  direction: SortDirectionPR;
}

// Helper functions
const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "Invalid Date";
  }
};

// use imported getLocalDateTime

const PurchaseReturnRequests: React.FC = () => {
  // Data returned is rendered via displayedPurchaseReturns only
  const [displayedPurchaseReturns, setDisplayedPurchaseReturns] = useState<
    PurchaseReturn[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPR, setSelectedPR] = useState<PurchaseReturn | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [filters, setFilters] = useState<Filters>({ status: "all" });
  const [userRoleId, setUserRoleId] = useState<string | null>(null);
  const [userRoleName, setUserRoleName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(false);
  const [sortConfigPR, setSortConfigPR] = useState<SortConfigPR>({
    field: "return_date",
    direction: "DESC",
  });
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
  const [selectedApprovers, setSelectedApprovers] = useState<Approver[]>([]);

  // Workflow cache for PR
  const [workflowConfigs, setWorkflowConfigs] = useState<
    { id: string; level: number; role_id: string }[]
  >([]);
  // System message config for Purchase Return (we keep maps below)
  const [_systemMsgById, setSystemMsgById] = useState<Record<string, any>>({});
  const [_systemMsgBySub, setSystemMsgBySub] = useState<Record<string, any>>({});
  const [canApprovePR, setCanApprovePR] = useState(true);

  // const createNotifications = async (notifications: NotificationPayload[]) => {
  //   try {
  //     if (!companyId || notifications.length === 0) return;
  //     const formatted = notifications.map((n) => ({
  //       created_at: getLocalDateTime(),
  //       acknowledged_at: null,
  //       assign_to: n.assign_to,
  //       message: n.message,
  //       status: n.status,
  //       priority: n.priority,
  //       alert_type: n.alert_type,
  //       entity_id: n.entity_id,
  //       company_id: companyId,
  //     }));
  //     const { error } = await supabase
  //       .from("system_notification")
  //       .insert(formatted);
  //     if (error) console.error("Notification insert error:", error);
  //     else triggerNotificationUpdate();
  //   } catch (e) {
  //     console.error("createNotifications error", e);
  //   }
  // };

  // const getUsersInRole = async (roleId: string) => {
  //   const { data, error } = await supabase
  //     .from("user_mgmt")
  //     .select("id")
  //     .eq("role_id", roleId)
  //     .eq("company_id", companyId!)
  //     .eq("is_active", true);
  //   if (error) return [] as string[];
  //   return (data || []).map((u) => u.id);
  // };

  // Check if Super Admin can override for a specific workflow

   const [moduleId, setModuleId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  
  
  
  const fetchModuleAndActionIds = async () => {
    try {
      // Fetch Module ID
      const { data: moduleData, error: moduleError } = await supabase
        .from("main_modules")
        .select("id")
        .eq("module_key", "Returns Management")
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
  const canSuperAdminOverride = async (
    workflowId: string,
  ): Promise<boolean> => {
    try {
      const { data: workflowData, error: workflowError } = await supabase
        .from("workflow_config")
        .select("override_enabled")
        .eq("company_id", companyId!)
        .eq("id", workflowId)
        .single();

      if (workflowError) {
        console.error("Error checking override permission:", workflowError);
        return false;
      }

      return workflowData?.override_enabled === true;
    } catch (error) {
      console.error("Error in canSuperAdminOverride:", error);
      toast.error("Error checking override permissions");
      return false;
    }
  };

  // Create notifications for approval actions
  // const createApprovalNotifications = async (
  //   pr: PurchaseReturn,
  //   action: "approved" | "rejected",
  //   nextLevelInfo: any,
  // ) => {
  //   const notifications: NotificationPayload[] = [];

  //   if (action === "approved") {
  //     // Notify creator
  //     if (pr.created_by && pr.created_by !== userId) {
  //       notifications.push({
  //         assign_to: pr.created_by,
  //         message: `Your Purchase Return ${pr.return_number} has been approved`,
  //         status: "New",
  //         priority: "Medium",
  //         alert_type: "PURCHASE_RETURN_APPROVED",
  //         entity_id: pr.id,
  //       });
  //     }

  //     // If not final approval, notify next level users
  //     if (!nextLevelInfo.isMaxLevel && nextLevelInfo.nextRoleId) {
  //       const nextUsers = await getUsersInRole(nextLevelInfo.nextRoleId);
  //       for (const uid of nextUsers) {
  //         if (uid !== userId) {
  //           notifications.push({
  //             assign_to: uid,
  //             message: `Approval required for Purchase Return ${pr.return_number}`,
  //             status: "New",
  //             priority: "Medium",
  //             alert_type: "PURCHASE_RETURN_APPROVAL_REQUESTED",
  //             entity_id: pr.id,
  //           });
  //         }
  //       }
  //     }
  //   } else if (action === "rejected") {
  //     // Notify creator about rejection
  //     if (pr.created_by && pr.created_by !== userId) {
  //       notifications.push({
  //         assign_to: pr.created_by,
  //         message: `Your Purchase Return ${pr.return_number} has been rejected. Reason: ${comment}`,
  //         status: "New",
  //         priority: "High",
  //         alert_type: "PURCHASE_RETURN_REJECTED",
  //         entity_id: pr.id,
  //       });
  //     }
  //   }

  //   if (notifications.length > 0) {
  //     await createNotifications(notifications);
  //   }
  // };

  // Initialize user and workflow
  useEffect(() => {
    const init = async () => {
      const u = JSON.parse(localStorage.getItem("userData") || "{}");
      if (!u?.id || !u?.role_id) {
        toast.error("User not found in localStorage");
        return;
      }
      setUserId(u.id);
      setUserRoleId(u.role_id);
      setUserName(`${u.first_name} ${u.last_name}`)
      setCompanyId(u.company_id);

      // Set role name
      const { data: roleData } = await supabase
        .from("role_master")
        .select("id, name")
        .eq("id", u.role_id)
        .eq("company_id", u.company_id)
        .eq("is_active", true)
        .single();
      setUserRoleName(roleData?.name || null);

      if (roleData?.name === "Super Admin") {
        setIsSuperAdmin(roleData.id === u.role_id);
      }


      // Fetch system_message_config for Purchase Return Request and index
      try {
        const { data: prSys, error: prErr } = await supabase
          .from("system_message_config")
          .select("*")
          .eq("company_id", u.company_id)
          .eq("category_id", "PURCHASE_ORDER_RETURN");

        // console.log("System Message Config Result:", {
        //   data: prSys,
        //   error: prErr,
        // });

        if (prErr) {
          console.error("Error fetching PR system_message_config", prErr);
        } else if (prSys) {
          const byId: Record<string, any> = {};
          const bySub: Record<string, any> = {};
          prSys.forEach((c: any) => {
            if (c.id) byId[c.id] = c;
            if (c.sub_category_id) bySub[c.sub_category_id] = c;
          });

          setSystemMsgById(byId);
          setSystemMsgBySub(bySub);
        }
      } catch (err) {
        console.error(
          "Failed to fetch Purchase Return system_message_config",
          err,
        );
      }
    };
    init();
  }, []);


  useEffect(() => {
  if (!companyId || !moduleId || !actionId || !userId) return;

  const fetchWorkflow = async () => {
    const { data: wfData, error } = await supabase
      .from("workflow_config")
      .select("id, level, role_id")
      .eq("company_id", companyId)
      .eq("module_id", moduleId)
      .eq("action_id", actionId)
      .eq("assigned_to", userId)
      .eq("is_active", true)
      .eq("status", true)
      .order("level", { ascending: true });

    console.log("Workflow Data:", wfData);
    console.log("Workflow Error:", error);

    setWorkflowConfigs(wfData || []);
  };

  fetchWorkflow();
}, [companyId, moduleId, actionId, userId]);
  // Fetch and filter data from Supabase
  const fetchPurchaseReturns = async () => {
    if (!companyId || !userRoleId) {
      console.error("Missing companyId or userRoleId, skipping fetch");
      return;
    }
    if (processingApproval) return; // Don't fetch while processing approval

    setLoading(true);
    try {
      const { data: purchaseReturnData, error: prError } =
        await supabase.rpc("get_purchase_returns_by_status", {
          p_company_id: companyId,
          p_user_id: userId,
          p_user_role_id: isSuperAdmin ? null : (userRoleId ?? undefined),
          p_is_super_admin: isSuperAdmin ?? false,
          p_search_query: searchQuery || null,
          p_page: currentPage,
          p_limit: itemsPerPage,
          p_sort_by: sortConfigPR.field || 'return_date',
          p_sort_order: sortConfigPR.direction || 'ASC',
          p_trail_status: filters.status,
        } as any);

      if (prError) {
        console.error("Supabase RPC Error =>", prError);
        toast.error("Failed to fetch purchase returns");
        return;
      }

      const dataArray = Array.isArray(purchaseReturnData) ? purchaseReturnData : [];
      const totalCount = dataArray.length > 0 ? (dataArray[0] as any).total_count ?? 0 : 0;

      // Formatted RPC Response
      const formatted = (dataArray ?? []).map((item: any) => {
        const approvalList = item.approval_status ?? [];
        const lastApproval = approvalList.length > 0 ? approvalList[approvalList.length - 1] : null;

        return {
          id: item.id,
          return_number: item.purchase_retrun_number,
          supplier: item.supplier_name,
          returnDate: item.return_date,
          total_items: item.total_items,
          value: item.total_value,
          status: lastApproval?.status ?? "Unknown",
          trail: lastApproval?.trail ?? "Unknown",
          remark: item.remarks ?? "N/A",
          approval_status: approvalList,
          created_by: item.created_by,
          created_at: item.created_at,
          purchase_order_id: item.purchase_order_id,
          workflow_id: item.workflow_id,
          next_level_role_id: item.next_level_role_id,
          approvers: item.approval_users || [],
          store_id: item.store.id,
          is_multiple_approvers: item.multiple_approvers_enabled,
          department_id: item.department.id,
        };
      });

      setDisplayedPurchaseReturns(formatted);
      setTotalCount(totalCount);

    } catch (e) {
      console.error("Failed to fetch purchase returns", e);
      toast.error("Failed to fetch purchase returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have the basic requirements
    if (companyId && userRoleId) {
      fetchPurchaseReturns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    companyId,
    currentPage,
    itemsPerPage,
    searchQuery,
    filters,
    sortConfigPR,
    userRoleId,
    workflowConfigs, // Add workflowConfigs as dependency
  ]);

  useEffect(() => {
    if (!isApproveDialogOpen) {
      setCanApprovePR(true);
    }
  }, [isApproveDialogOpen]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleFilterReset = () => {
    setSearchQuery("");
    setFilters({ status: "all" });
    setItemsPerPage(10);
    setCurrentPage(1);
  };

  const handleSortPR = (field: SortFieldPR): void => {
    let direction: SortDirectionPR = "ASC";
    if (sortConfigPR.field === field) {
      if (sortConfigPR.direction === "ASC") {
        direction = "DESC";
      } else if (sortConfigPR.direction === "DESC") {
        direction = null;
      } else {
        direction = "ASC";
      }
    }
    setSortConfigPR({ field: direction ? field : null, direction });
    setCurrentPage(1);
  };

  const getSortIconPR = (field: SortFieldPR) => {
    if (sortConfigPR.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfigPR.direction === "ASC") {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    if (sortConfigPR.direction === "DESC") {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  // Adjust inventory back (increase) when a final-level rejection happens
  const increaseInventoryForReturn = async (pr: PurchaseReturn) => {
    const { data: items, error: itemsErr } = await supabase
      .from("purchase_return_items")
      .select("item_id, returned_qty")
      .eq("purchase_return_id", pr.id);
    if (itemsErr || !items) return;

    for (const it of items) {
      const returnQty = it.returned_qty || 0;
      if (returnQty <= 0) continue;

      const { data: inventories, error: invError } = await supabase
        .from("inventory_mgmt")
        .select("id, item_qty")
        .eq("purchase_order_id", pr.purchase_order_id)
        .eq("item_id", it.item_id);
      if (invError || !inventories || inventories.length === 0) continue;

      // Add back the quantity that was reduced at creation time
      const inventory = inventories[0];
      const newQty = (inventory.item_qty ?? 0) + returnQty;

      await supabase
        .from("inventory_mgmt")
        .update({ item_qty: newQty })
        .eq("id", inventory.id);
    }
  };

  // Handle super admin override
  const handleSuperAdminOverride = async (pr: PurchaseReturn) => {
    try {
      const currentApprovalStatus = pr.approval_status || [];
      const currentSequenceNo =
        currentApprovalStatus.length > 0
          ? Math.max(...currentApprovalStatus.map((a: any) => a.sequence_no || 0))
          : -1;

      if (!companyId || !moduleId || !actionId || !userId) return;
      const creatorUserId = pr.created_by;
      console.log("Purchase Return:", pr);
console.log("Created By:", pr.created_by);

const { data: workflows, error: workflowError } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId)
  .eq("action_id", actionId)
  .eq("store_id", pr.store_id)
  .eq("assigned_to", creatorUserId) 
  .eq("is_active", true)
  .eq("status", true)
  .order("level", { ascending: true });

console.log("Workflows:", workflows);

if (workflowError) {
  console.error("Workflow Error:", workflowError);
  toast.error("Failed to fetch workflows");
  return;
}


      if (!workflows || workflows.length === 0) {
        toast.error("No active workflow found for this Purchase Requisition.");
        return;
      }

      const maxLevel = Math.max(...workflows.map((w: any) => w.level));
      let sequence = currentSequenceNo;
      const now = new Date().toISOString();

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

      const { data: completedStatus } = await supabase
        .from("system_message_config")
        .select("id")
        .eq("company_id", companyId!)
        .eq("sub_category_id", "APPROVER_COMPLETED")
        .eq("category_id", "PURCHASE_ORDER_RETURN")
        .single();

      await supabase
        .from("purchase_return")
        .update({
          approval_status: updatedApprovalStatus,
          workflow_id: null,
          next_level_role_id: null,
          return_status: completedStatus?.id,
          modified_at: now,
        })
        .eq("id", pr.id);

      // System Log
      await supabase.from("system_log").insert({
        company_id: companyId,
        transaction_date: now,
        module: "Purchase Return Approval",
        scope: "Override",
        key: pr.return_number,
        log: `Purchase Return ${pr.return_number} approved by Super Admin override (User: ${userName}).`,
        action_by: userId,
        created_at: now,
      });

    } catch (error) {
      console.error('Error super admin override', error);
    }
  };

  // Purchase return approve
  const handleApprove = async (pr: PurchaseReturn) => {
    if (!pr || !userId || !companyId) return;

    setProcessingApproval(true);
    const toastId = toast.loading("Processing approval...");

    try {
      const now = new Date().toISOString();

      // Super Admin override check
      if (isSuperAdmin) {
        const canOverride = await canSuperAdminOverride(pr.workflow_id!);

        if (!canOverride) {
          toast.error(
            "Super Admin override is not enabled for this return request workflow. Please follow the regular approval process.",
            { id: toastId }
          );
          setProcessingApproval(false);
          return;
        }

        // If override enabled → approve all levels
        await handleSuperAdminOverride(pr);

        toast.success(
          `Purchase Return ${pr.return_number} approved through all levels`,
          { id: toastId }
        );

        fetchPurchaseReturns();
        setProcessingApproval(false);
        return;
      }

      // Check if user is assigned approver
      const isApprover = pr.approvers?.some(a => a.id === userId);
      if (!isApprover) {
        toast.error("You are not authorized to approve this return.", {
          id: toastId,
        });
        return;
      }

      // Fetch workflow
      const { data: workflow } = await supabase
        .from("workflow_config")
        .select("*")
        .eq("id", pr.workflow_id!)
        .single();

      if (!workflow) {
        toast.error("Workflow not found.", { id: toastId });
        return;
      }

      const currentLevel = workflow.level;
      const isMulti = workflow.multiple_approvers_enabled === true;

      const lastRejectionSeq = Math.max(
        -1,
        ...pr.approval_status
          .filter((a: any) => a.trail === "Rejected")
          .map((a: any) => a.sequence_no || -1)
      );

      // Prevent duplicate approval
      const alreadyApproved = pr.approval_status?.some(
        (a: any) =>
          a.role_id === workflow.role_id &&
          a.approvedBy === userId &&
          (a.sequence_no ?? 0) > lastRejectionSeq
      );

      if (alreadyApproved) {
        toast.error("You already approved this level.", { id: toastId });
        return;
      }

      // Count approvals for this level
      const approvalsForLevel =
        pr.approval_status?.filter(
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

      const currentSequence =
        pr.approval_status?.length > 0
          ? Math.max(...pr.approval_status.map((a: any) => a.sequence_no || 0))
          : -1;

      const trailValue = isMulti
        ? levelCompleted ? "Approved" : "In Progress"
        : "Approved";

      const statusValue = isMulti
        ? levelCompleted
          ? `Level ${currentLevel} Approval Completed`
          : `Level ${currentLevel} Approval – In Progress`
        : `Level ${currentLevel} Approval Completed`;

      let updatedApprovalStatus = [
        ...(pr.approval_status || []),
        {
          status: statusValue,
          trail: trailValue,
          role_id: workflow.role_id,
          approvedBy: userId,
          sequence_no: currentSequence + 1,
          isFinalized: false,
          date: now,
          comment: comment || "",
        },
      ];

      // If multi-approver and not completed yet
      if (!levelCompleted) {
        await supabase
          .from("purchase_return")
          .update({
            approval_status: updatedApprovalStatus,
            modified_at: now,
          })
          .eq("id", pr.id);

        // System Log
        await supabase.from("system_log").insert({
          company_id: companyId,
          transaction_date: now,
          module: "Purchase Return Approval",
          scope: "Approve",
          key: pr.return_number,
          log: `Purchase Return ${pr.return_number} level ${currentLevel} approved by ${userName}. Waiting for other approvers.`,
          action_by: userId,
          created_at: now,
        });

        toast.success("Approval recorded. Waiting for other approvers.", {
          id: toastId,
        });

        fetchPurchaseReturns();
        return;
      }

      // Validate next level approvers
      const { data: nextLevelData, error: nextLevelError } =
  await supabase.rpc("validate_next_level_workflow_approvers", {
    p_company_id: companyId,
    p_store_id: pr.store_id,
    p_department_id: pr.department_id ?? "",
   p_module_key: "Returns Management",     
    p_action_name: "Add",  
    p_assigned_to: pr.created_by,
    p_current_level: currentLevel,
  } as any);

console.log("Next Level Data:", nextLevelData);
console.log("Next Level Error:", nextLevelError);
      const nextWorkflow = nextLevelData?.[0];

      let updateData: any = {
        modified_at: now,
      };

      // Final Level
      if (!nextWorkflow) {
        const { data: completedStatus } = await supabase
          .from("system_message_config")
          .select("id")
          .eq("company_id", companyId)
          .eq("sub_category_id", "APPROVER_COMPLETED")
          .eq("category_id", "PURCHASE_ORDER_RETURN")
          .single();

        updatedApprovalStatus = updatedApprovalStatus.map((entry, index, arr) => {
          if (index === arr.length - 1) {
            return {
              ...entry,
              isFinalized: true,
            };
          }
          return entry;
        });

        updateData = {
          approval_status: updatedApprovalStatus,
          workflow_id: null,
          next_level_role_id: null,
          return_status: completedStatus?.id,
        };

        toast.success(
          `Purchase Return ${pr.return_number} fully approved and completed`,
          { id: toastId }
        );
      }

      // Move to Next Level
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
          `Purchase Return ${pr.return_number} approved and moved to next level`,
          { id: toastId }
        );
      }

      await supabase
        .from("purchase_return")
        .update(updateData)
        .eq("id", pr.id);

      const systemLogMsg = nextWorkflow
        ? `Purchase Return ${pr.return_number} level ${currentLevel} approved by ${userName} and moved to level ${nextWorkflow.next_level}.`
        : `Purchase Return ${pr.return_number} fully approved at final level ${currentLevel} by ${userName}.`;

      // System log
      await supabase.from("system_log").insert({
        company_id: companyId,
        transaction_date: now,
        module: "Purchase Return Approval",
        scope: "Approve",
        key: pr.return_number,
        log: systemLogMsg,
        action_by: userId,
        created_at: now,
      });

      // await createApprovalNotifications(pr, "approved", nextLevel);

      fetchPurchaseReturns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process approval.", { id: toastId });
    } finally {
      setProcessingApproval(false);
      setIsApproveDialogOpen(false);
      setSelectedPR(null);
      setComment("");
    }
  };

  const handleReject = async (pr: PurchaseReturn) => {
    if (!comment || !pr || !userId || !companyId) {
      toast.error("Rejection comment is required");
      return;
    }

    setProcessingApproval(true);
    const toastId = toast.loading("Processing rejection...");

    try {
      const now = new Date().toISOString();
      const approvalStatus = pr.approval_status || [];

      const currentSequence =
        approvalStatus.length > 0
          ? Math.max(...approvalStatus.map((a: any) => a.sequence_no || 0))
          : -1;

      // Fetch current workflow
      const { data: workflow, error: workflowErr } = await supabase
        .from("workflow_config")
        .select("*")
        .eq("id", pr.workflow_id!)
        .single();

      if (workflowErr || !workflow) {
        throw new Error("Workflow not found for this Purchase Return");
      }

      const currentLevel = workflow.level;
      const fullRejectEnabled = workflow?.full_rejection_enabled === true;

      // Add rejection entry
      let updatedApprovalStatus = [
        ...approvalStatus,
        {
          status: fullRejectEnabled
            ? `Purchase Return Fully Rejected at Level ${currentLevel}`
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
        const { data: createdStatus } = await supabase
          .from("system_message_config")
          .select("id")
          .eq("company_id", companyId)
          .eq("category_id", "PURCHASE_ORDER_RETURN")
          .eq("sub_category_id", "ORDER_RETURN_CREATED")
          .single();

        await supabase
          .from("purchase_return")
          .update({
            approval_status: updatedApprovalStatus,
            workflow_id: null,
            next_level_role_id: null,
            return_status: createdStatus?.id,
            modified_at: now,
          })
          .eq("id", pr.id);

        // Restore inventory
        await increaseInventoryForReturn(pr);

        // System Log
        await supabase.from("system_log").insert({
          company_id: companyId,
          transaction_date: now,
          module: "Purchase Return Approval",
          scope: "Reject",
          key: pr.return_number,
          log: fullRejectEnabled
            ? `Purchase Return ${pr.return_number} fully rejected at level ${currentLevel} by ${userName}.`
            : `Purchase Return ${pr.return_number} level 1 rejected by ${userName} and moved to Created.`,
          action_by: userId,
          created_at: now,
        });

        toast.success(
          `Purchase Return ${pr.return_number} has been fully rejected and moved to Created`,
          { id: toastId }
        );

        // await createApprovalNotifications(pr, "rejected");

        fetchPurchaseReturns();
        return;
      }

      // Higher Level Rejection

      if (!companyId || !moduleId || !actionId || !userId) return;

// Fetch previous level workflow
const { data: prevWorkflow, error: prevWorkflowErr } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId)
  .eq("action_id", actionId)
  .eq("store_id", pr.store_id)
  .eq("assigned_to", userId)
  .eq("level", currentLevel - 1)
  .eq("is_active", true)
  .single();

console.log("Workflows",prevWorkflow)

      if (prevWorkflowErr || !prevWorkflow) {
        throw new Error("Previous workflow level not found");
      }

      // Remove any finalized flags
      updatedApprovalStatus = updatedApprovalStatus.map(entry =>
        entry.isFinalized ? { ...entry, isFinalized: false } : entry
      );

      await supabase
        .from("purchase_return")
        .update({
          approval_status: updatedApprovalStatus,
          workflow_id: prevWorkflow.id,
          next_level_role_id: prevWorkflow.role_id,
          modified_at: now,
        })
        .eq("id", pr.id);

      // Restore inventory if rejection cancels finalization
      if (!prevWorkflow) {
        await increaseInventoryForReturn(pr);
      }

      // System Log
      await supabase.from("system_log").insert({
        company_id: companyId,
        transaction_date: now,
        module: "Purchase Return Approval",
        scope: "Reject",
        key: pr.return_number,
        log: `Purchase Return ${pr.return_number} level ${currentLevel} rejected by ${userName}.`,
        action_by: userId,
        created_at: now,
      });

      // await createApprovalNotifications(pr, "rejected");

      toast.success(
        `Purchase Return ${pr.return_number} has been rejected`,
        { id: toastId }
      );

      fetchPurchaseReturns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process rejection.", { id: toastId });
    } finally {
      setProcessingApproval(false);
      setIsRejectDialogOpen(false);
      setSelectedPR(null);
      setComment("");
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  const hasUserApproved = (pr: PurchaseReturn) => {
    return pr.approvers?.some(
      (approver) =>
        approver.id === userId &&
        approver.approval_status === "Approved"
    );
  };

  const prepareApproveDialog = async (pr: PurchaseReturn) => {
    setSelectedPR(pr);
    setComment("");

    let canApprove = true;

    try {
     if (!companyId || !moduleId || !actionId || !userId) return;

const { data: storeWorkflows, error } = await supabase
  .from("workflow_config")
  .select("*")
  .eq("company_id", companyId)
  .eq("module_id", moduleId)
  .eq("action_id", actionId)
  .eq("store_id", pr.store_id)
  .eq("is_active", true)
  .eq("status", true)
  .eq("assigned_to",pr.created_by)
  .order("level", { ascending: true });

if (error) {
  console.error("Error fetching workflow:", error);
  toast.error("Failed to fetch workflow configuration.");
  return;
}

console.log("Store Workflows:", storeWorkflows);
      if (error) {
        toast.error("Failed to fetch workflow configuration.");
        return;
      }

      if (!storeWorkflows || storeWorkflows.length === 0) {
        toast.error("No workflow configured for this store.");
        return;
      }

      if (isSuperAdmin) {
        const currentWorkflow = storeWorkflows.find((w) => w.id === pr.workflow_id);

        if (!currentWorkflow) {
          toast.error("Current workflow level not found.");
          return;
        }

        const canOverride = currentWorkflow.override_enabled === true;
        // const userWorkflow = storeWorkflows.find((w) => w.role_id === userRoleId);

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

  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  Purchase Return Requests
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="flex flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search Return Number or Supplier..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: value })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleFilterReset}
                  className="px-3 py-2 text-sm"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="font-semibold w-1/4">
                      <p
                        onClick={() => handleSortPR("purchase_return_number")}
                        className="h-8 flex items-center text-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Return Number {getSortIconPR("purchase_return_number")}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold hover:text-blue-700">
                      Supplier
                    </TableHead>
                    <TableHead className="font-semibold w-1/4">
                      <p
                        onClick={() => handleSortPR("return_date")}
                        className="h-8 flex items-center text-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Return Date {getSortIconPR("return_date")}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold w-1/4 text-right">
                      <p
                        onClick={() => handleSortPR("total_items")}
                        className="h-8 flex items-center text-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Total Items {getSortIconPR("total_items")}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold w-1/4">
                      <p
                        onClick={() => handleSortPR("total_value")}
                        className="h-8 flex items-center justify-end gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Total Value {getSortIconPR("total_value")}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold text-center hover:text-blue-700">
                      Approvers
                    </TableHead>
                    <TableHead className="font-semibold hover:text-blue-700">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold hover:text-blue-700">
                      Remark
                    </TableHead>
                    <TableHead className="font-semibold hover:text-blue-700 text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(itemsPerPage)
                      .fill(0)
                      .map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mx-auto"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : displayedPurchaseReturns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center py-6">
                          <Package className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">
                            No purchase returns found
                          </p>
                          <p className="text-sm text-gray-500">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedPurchaseReturns.map((pr, i) => (
                      <TableRow
                        key={pr.id + i}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {pr.return_number}
                        </TableCell>
                        <TableCell>{pr.supplier}</TableCell>
                        <TableCell>{formatDate(pr.returnDate)}</TableCell>
                        <TableCell className="text-right">
                          {pr.total_items}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(pr.value)}
                        </TableCell>
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
                        <TableCell>{pr.remark}</TableCell>
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
                                  ? "You have already approved this return request"
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
                                  ? "You have already approved this return request"
                                  : "Reject"}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    navigate(
                                      `/dashboard/purchase-return-view/${pr.id}`,
                                    )
                                  }
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Show</p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) =>
                    handleItemsPerPageChange(Number(value))
                  }
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder={itemsPerPage.toString()} />
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
                  Showing {totalCount > 0 ? startIndex : 0} to {endIndex} of{" "}
                  {totalCount} entries
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
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
                    onClick={() => handlePageChange(currentPage + 1)}
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

        <Dialog
          open={isApproveDialogOpen}
          onOpenChange={setIsApproveDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-blue-700">
                Confirm Purchase Return Approval
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                You are approving as:{" "}
                <span className="font-semibold">{userRoleName}</span>
              </p>
              {selectedPR && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm">
                    <strong>Return Number:</strong> {selectedPR.return_number}
                  </p>
                  <p className="text-sm">
                    <strong>Supplier:</strong> {selectedPR.supplier}
                  </p>
                  <p className="text-sm">
                    <strong>Value:</strong> {formatCurrency(selectedPR.value)}
                  </p>
                </div>
              )}
              <Input
                placeholder="Add any remarks or supporting notes (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="text-sm text-gray-600">
                Are you sure you want to approve this Purchase Return? Your
                decision will be recorded.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsApproveDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="default"
                        onClick={() => handleApprove(selectedPR!)}
                        disabled={
                          !selectedPR ||
                          processingApproval ||
                          !canApprovePR
                        }
                      >
                        {processingApproval ? "Processing..." : "Approve"}
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

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-700">
                Confirm Purchase Return Rejection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                You are rejecting as:{" "}
                <span className="font-semibold">{userRoleName}</span>
              </p>
              {selectedPR && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm">
                    <strong>Return Number:</strong> {selectedPR.return_number}
                  </p>
                  <p className="text-sm">
                    <strong>Supplier:</strong> {selectedPR.supplier}
                  </p>
                  <p className="text-sm">
                    <strong>Value:</strong> {formatCurrency(selectedPR.value)}
                  </p>
                </div>
              )}
              <Input
                placeholder="Add rejection comment (required)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />
              <p className="text-sm text-gray-600">
                Are you sure you want to reject this Purchase Return? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRejectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedPR!)}
                  disabled={!comment || !selectedPR || processingApproval}
                >
                  {processingApproval ? "Processing..." : "Reject"}
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
                            className={`px-2 py-1 rounded-full text-xs font-medium ${approver.approval_status === "Approved"
                              ? "bg-green-100 text-green-800"
                              : approver.approval_status === "Rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                              }`}
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

export default PurchaseReturnRequests;
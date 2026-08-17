import { useState, useEffect, useRef } from "react"; // React core and hooks for component state & lifecycle
import { useNavigate, useParams } from "react-router-dom"; // Routing utilities: navigation and URL params
import { useForm, Controller, FieldError } from "react-hook-form"; // Form management: validation, control, watch, etc.
import { ArrowUpRight, Download, Paperclip, Printer, Store, Trash2} from "lucide-react";

// UI components from your design system (likely shadcn/ui)
import { Input } from "@/components/ui/input"; // Text input field
import { Label } from "@/components/ui/label"; // Label for form fields
import { Button } from "@/components/ui/button"; // Clickable button
import { Textarea } from "@/components/ui/textarea"; // Multi-line text input
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Card container components for grouping UI

// Supabase client for talking to your backend/database
import { supabase } from "@/Utils/types/supabaseClient";

// Date formatting helper
import { format } from "date-fns"; // Used to format JS Date objects into strings

// Icons from lucide-react for visual cues
import {
  SquareChartGantt,
  Package,
  Mail,
  ArrowLeft,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  CalendarCheck2,
  Tally5,
  FolderPen,
  ChartNoAxesCombined,
  Calendar1,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/features/userSlice";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ISystemMessageConfig, IWorkflowConfig } from "@/Utils/constants";
import generatePurchaseReturnPDF from "./PurchaseReturnPrintTemplate";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/Utils/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";
import { useApprovalDocument } from '@/hooks/useApprovalDocument';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';

// Represents a single supply item
interface Supply {
  item_name: string;
  unit_price?: any;
  order_price?: any;
  id: string;
  description: string;
  price?: number;
  brand_id: string;
  orderQty?: number;
  receivedQty?: number;
  return_qty?: number;
  return_reason?: string; // Optional reason for return, if applicable
  item_id?: string; // Optional item ID if needed for submission
  order_qty?: number; // Quantity ordered, if applicable
}

// Structure expected by react-hook-form for the entire form
interface FormValues {
  returnRequestNumber: string;
  returnStatus: string;
  createdDate: string;
  linkedPOId: string;
  supplierName: string;
  supplierEmail: string;
  supplierAddress: string;
  originalPODate: string;
  remarks: string;
  purchaseOrderId: string;
  createdBy: string;
  totalItems?: number | null;
  totalValue?: number | null;
  selectedSupplies: Supply[];
  supplier_id: string | null;
  returnDate?: string;
  companyId: string;
  storeName: string;
  store_id: string
  image_1?: File | null;
  image_2?: File | null;
  attachment?: File | null;
  workflow_id?: string | null;
  next_level_role_id?: string | null;
}

interface ApprovalStatus {
  status: string;
  trail: string;
  role_id: string | null;
  sequence_no: number;
  isFinalized: boolean;
  approvedBy?: string;
  date: string;
  comment: string;
}

type POOption = {
  id: string;
  po_number: string;
};

// --- Main Component ---
const ReturnForm = () => {
  const navigate = useNavigate(); // Function to programmatically navigate routes
  const { id } = useParams<{ id?: string }>(); // Extract `id` param from URL if present
  const isEdit = Boolean(id) && location.pathname.includes('edit');
  const isView = Boolean(id) && location.pathname.includes('view');
  const userData = useSelector(selectUser);
  const companyId = userData?.company_id;
  const departmentId = userData?.department_id;


      const userId = userData?.id;

  // --- Local UI / data state ---
  const [selectedSupplies, setSelectedSupplies] = useState<Supply[]>([]); // Confirmed selected supplies for return
  const [confirmedSupplyIds, setConfirmedSupplyIds] = useState<string[]>([]); // Stable, user-confirmed selection for count badge
  const [isSelectedSuppliesExpanded, setIsSelectedSuppliesExpanded] =
    useState<boolean>(false); // UI state (e.g., expand/collapse)
  const [poNumbers, setPoNumbers] = useState<POOption[]>([]);
  const [supplierName, setSupplierName] = useState<string | null>(null); // Supplier name from linked PO
  const [supplierEmail, setSupplierEmail] = useState<string | null>(null); // Supplier email
  const [supplierAddress, setSupplierAddress] = useState<string | null>(null); // Supplier address
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierUUID, setSupplierUUID] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const { id: returnRequestId } = useParams<{ id: string }>();

    const {
      data: approvalData,
      originalData,
      isPending,
      actionName: approvalActionName,
      requestDetails,
    } = useApprovalDocument<any>({
    id: returnRequestId === 'pending' ? undefined : returnRequestId,
    tableName: 'purchase_return',
  });

  const [originalPODate, setOriginalPODate] = useState("");
  const [returnQtyErrors, setReturnQtyErrors] = useState<Record<string, string>>({});
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isConfirmReturnDialogOpen, setIsConfirmReturnDialogOpen] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  // show preview URL or filename
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  // original attachment metadata loaded from DB (so we can keep track)
  const [existingAttachment, setExistingAttachment] = useState<any | null>(null);

  // flag to indicate user wants to remove the existing uploaded attachment
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);

  // @ts-ignore 
  const [orderDetailsByItemId, setOrderDetailsByItemId] = useState<
    Record<string, { order_qty: number; received_qty: number }>
  >({});

  const [systemMsgConfig, setSystemMsgConfig] = useState<ISystemMessageConfig[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<IWorkflowConfig | null>(null);
  const statusApprovalPending = systemMsgConfig.find(config => config.sub_category_id === "APPROVAL_PENDING");
  const statusApprovalCompleted = systemMsgConfig.find(config => config.sub_category_id === "APPROVER_COMPLETED");
  const statusCreated = systemMsgConfig.find(config => config.sub_category_id === "ORDER_RETURN_CREATED");
  const statusReturnCompleted = systemMsgConfig.find(config => config.sub_category_id === "RETURN_COMPLETED");
  const [returnStatus, setReturnStatus] = useState<ISystemMessageConfig>();
  const [currentWorkflow, setCurrentWorkflow] = useState<IWorkflowConfig>();
  const [currentApprovalStatus, setCurrentApprovalStatus] = useState<ApprovalStatus | undefined>();
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({});
  const [alreadyReturnedMap, setAlreadyReturnedMap] = useState<Record<string, number>>({});
  const [purchaseReturnForPrint, setPurchaseReturnForPrint] = useState<any | null>(null);
  const [originalReturnQuantities, setOriginalReturnQuantities] = useState<Record<string, number>>({});
  const originalDepartmentId = useRef<string | null>(null);
  const [allApprovalStatus, setAllApprovalStatus] = useState<ApprovalStatus[]>([]);
  const [linkedPONumberDisplay, setLinkedPONumberDisplay] = useState<string>("");
    const [moduleId, setModuleId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  

  const fetchModuleAndActionIds = async () => {
    try {
      // Fetch Module ID
      const { data: moduleData, error: moduleError } = await supabase
        .from("main_modules")
        .select("id")
        .or("module_name.eq.Returns Management,module_key.eq.Returns Management")
        .limit(1)
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
  
    } catch (err) {
      console.error("Error fetching module/action:", err);
    }
  };
  
  
  useEffect(()=>{
  fetchModuleAndActionIds();
  },[])

  const isResubmitting = isEdit && returnStatus?.sub_category_id === 'ORDER_RETURN_CREATED';
  const showConfirmReturnBtn = (isEdit || isView) && !isPending &&
    returnStatus?.sub_category_id === "APPROVER_COMPLETED" && 
    (currentApprovalStatus?.isFinalized || !currentApprovalStatus);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      returnRequestNumber: "",
      returnStatus: "",
      createdDate: format(new Date(), "yyyy-MM-dd"),
      linkedPOId: "",
      supplierName: "",
      supplierEmail: "",
      supplierAddress: "",
      originalPODate: "",
      remarks: "",
      selectedSupplies: [],
      storeName: "",
      store_id: "",
      workflow_id: null,
      next_level_role_id: null,
    },
  });

  const watchedStoreId = watch("store_id");

  useEffect(() => {
    if (isEdit || isView) return;

    if (!selectedPOId) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_po_items_by_po_id",
          { po_id_input: selectedPOId }
        );

        if (error || !Array.isArray(data)) {
          console.error("RPC error or invalid data:", error);
          return;
        }

        console.log("RPC data:", data);

        const mapped = data.map((itm: any, index: number) => {
          const itemId = itm.item_id || itm.id;

          if (!itemId) {
            console.warn(
              `⚠️ No valid item_id found for item at index ${index}:`,
              itm
            );
          }

          return {
            id: itemId || `fallback-${index}`,
            item_id: itemId, // ✅ Ensure this is always set
            item_name: itm.item_name || `Unnamed Item ${index + 1}`,
            description: itm.description || "",
            brand_id: itm.brand_id || "",
            return_qty: 0,
            return_reason: "",
          };
        });

        
        const selectedIds = mapped
  .map((s) => s.item_id)
  .filter((id): id is string => !!id);

  if (!selectedIds.length) {
  setSelectedSupplies([]);
  setValue("selectedSupplies", []);
  return;
}

const { data: fullData,error: fullDataError } = await supabase.rpc(
  "get_purchase_order_items",
  {
    p_po_id: selectedPOId,
    p_item_ids: selectedIds,
  }
);

if (!fullDataError && fullData) {
  const fullSupplies = fullData.map((itm: any) => ({
    id: itm.item_id,
    item_id: itm.item_id,
    item_name: itm.item_name,
    description: itm.description ?? "",
    brand_id: "",
    unit_price: Number(itm.unit_price),
    order_price: Number(itm.order_price),
    return_qty: 0,
    return_reason: "",
  }));

  setSelectedSupplies(fullSupplies);
  setValue("selectedSupplies", fullSupplies);
  setConfirmedSupplyIds(fullSupplies.map((s) => s.id));
  setIsSelectedSuppliesExpanded(true);
}
      } catch (err) {
        console.error("⚠️ RPC fetch error:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isEdit, isView,selectedPOId]);

  // System Message Config
  useEffect(() => {
    const fetchSystemMessageConfig = async () => {
      if (!companyId) return;

      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq("company_id", companyId)
          .eq("category_id", 'PURCHASE_ORDER_RETURN');

        if (error) throw error;

        if (data.length > 0) {
          setSystemMsgConfig(data);
          const statusCreated = data.find(config => config.sub_category_id === "ORDER_RETURN_CREATED");
          const statusApprovalPending = data.find(config => config.sub_category_id === "APPROVAL_PENDING");
          const statusApprovalCompleted = data.find(config => config.sub_category_id === "APPROVER_COMPLETED");

          if (!statusCreated || !statusApprovalPending || !statusApprovalCompleted) {
            console.error('Missing ORDER_CREATED, APPROVAL_PENDING or APPROVER_COMPLETED in system_message_config');
            toast.error('Status configuration is incomplete', { position: "top-center" });
            return;
          }

          if (!isEdit && !isView) {
            const defaultStatusId = workflowConfig ? statusApprovalPending.id : statusApprovalCompleted.id;
            setValue("returnStatus", defaultStatusId);
          }
        } else {
          console.error('No system message config found for PURCHASE_ORDER');
          toast.error('Failed to load status configuration', { position: "top-center" });
        }
      } catch (error) {
        console.error('Error fetching system message config:', error);
        // toast.error('Failed to fetch status configuration', { position: "top-center" });
      }
    };

    fetchSystemMessageConfig();
  }, [setValue, workflowConfig, companyId]);

 

  useEffect(() => {
  
        console.log("Workflow useEffect fired", {
      companyId,
      watchedStoreId,
      moduleId,
      actionId,
      userId,
    });
    if (!companyId || !watchedStoreId) {
      setWorkflowConfig(null);
      return;
    }
  
    const fetchWorkflow = async () => {
  
     console.log("fetchWorkflow started");
      if (!moduleId || !actionId || !userId) return;
  
      console.log("companyId:", companyId);
      console.log("moduleId:", moduleId);
      console.log("actionId:", actionId);
      console.log("userId:", userId);
  
      const { data, error } = await supabase
        .from("workflow_config")
        .select("*")
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .eq("action_id", actionId)
        .contains("stores", `[{"id": "${watchedStoreId}"}]`)
        .eq("assigned_to", userId)
        .eq("is_active", true)
        .eq("status", true)
        .order("level", { ascending: true })
        .limit(1)
        .single();
  
        console.log("Workflow Data:", data);
  console.log("Workflow Error:", error);
  
  
      if (error) {
        setWorkflowConfig(null);
        return;
      }
  
      setWorkflowConfig(data);
    };
  
    fetchWorkflow();
  }, [companyId, watchedStoreId, moduleId, actionId, userId]);

  useEffect(() => {
    if (!selectedPOId || !inventoryList.length) return;
    const fetchAlreadyReturned = async () => {
      const map: Record<string, number> = {};

      for (const item of inventoryList) {
        const qty = await getAlreadyReturnedQty(selectedPOId, item.item_id);
        map[String(item.item_id)] = qty;
      }

      setAlreadyReturnedMap(map);
    };

    fetchAlreadyReturned();
  }, [selectedPOId, inventoryList]);

  useEffect(() => {
    if (!isEdit) {
      setOriginalReturnQuantities({});
    }
  }, [isEdit]);

  useEffect(() => {
    if (!returnRequestId || returnRequestId === 'pending') return;

    const fetchPurchaseReturnToPrint = async () => {
      try {
        // Fetch purchase_return along with supplier info and return status
        const { data: returnData, error: returnError } = await supabase
          .from("purchase_return")
          .select(`id, purchase_retrun_number, return_date, total_items, total_value, remark, return_status, supplier_id,
          supplier_mgmt (supplier_name, email, address),
          system_message_config!purchase_return_return_status_fkey (sub_category_id)
        `)
          .eq("id", returnRequestId)
          .single();

        if (returnError) throw returnError;
        if (!returnData) throw new Error("Purchase return not found");

        // Fetch purchase_return_items along with item_mgmt
        const { data: itemsData, error: itemsError } = await supabase
          .from("purchase_return_items")
          .select(`id, returned_qty, order_price, item_id, remarks, return_reason,
          item_mgmt (item_name, description)
        `)
          .eq("purchase_return_id", returnRequestId)
          .order("id", { ascending: true });

        if (itemsError) throw itemsError;

        // Map items to ReturnItem[]
        const items: any[] = (itemsData || []).map(item => ({
          returned_qty: item.returned_qty,
          order_price: item.order_price,
          return_reason: item.return_reason,
          item_mgmt: {
            item_name: item.item_mgmt?.item_name || "N/A",
            description: item.item_mgmt?.description || ""
          }
        }));

        // Map supplier
        const supplier: any | null = returnData.supplier_mgmt
          ? {
            supplier_name: returnData.supplier_mgmt.supplier_name,
            email: returnData.supplier_mgmt.email,
            address: returnData.supplier_mgmt.address
          }
          : null;

        // Use sub_category_id as status
        const status = returnData.system_message_config?.sub_category_id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: any) => c.toUpperCase()) || "UNKNOWN";

        // Final purchase return object
        const finalReturn: any = {
          purchase_retrun_number: returnData.purchase_retrun_number,
          return_date: returnData.return_date,
          total_items: returnData.total_items,
          total_value: returnData.total_value,
          status,
          remarks: returnData.remark,
          supplier,
          items
        };

        setPurchaseReturnForPrint(finalReturn);
      } catch (err: any) {
        console.error("Error fetching purchase return:", err);
      }
    };

    fetchPurchaseReturnToPrint();
  }, [returnRequestId]);

  useEffect(() => {
    const generateReturnNumber = async () => {
      if (!supplierId) return;

      // Today's date DDMMYY
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yy = String(now.getFullYear()).slice(-2, 4);
      const formattedDate = `${dd}${mm}${yy}`;

      // Supplier
      const formattedSupplier = supplierId.toUpperCase();

      const basePrefix = `RO-${formattedDate}-${formattedSupplier}`;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("purchase_return")
        .select("purchase_retrun_number")
        .ilike("purchase_retrun_number", `${basePrefix}%`)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (error) {
        console.error("Error fetching existing return numbers:", error.message);
        return;
      }

      const existingCount = data?.length || 0;
      const newSequence = existingCount + 1;

      return `${basePrefix}-${newSequence}`;
    };

    if (!isEdit && !isView) {
      (async () => {
        const autoNumber = await generateReturnNumber();
        if (autoNumber) {
          setValue("returnRequestNumber", autoNumber);
        }
      })();
    }
  }, [isEdit, isView, supplierId, setValue, supabase]);

  // Get already returned qty of the item
  const getAlreadyReturnedQty = async (
    purchaseOrderId: string,
    itemId: string
  ): Promise<number> => {
    if (!purchaseOrderId || !itemId) return 0;

    try {
      // Get all return requests for the purchase order
      const { data: returnRequests, error: returnRequestsError } = await supabase
        .from("purchase_return")
        .select("id")
        .eq("purchase_order_id", purchaseOrderId);

      if (returnRequestsError) throw returnRequestsError;
      if (!returnRequests?.length) return 0;

      const returnIds = returnRequests.map((r) => r.id);

      // Get all returned items for these return requests matching the item_id
      const { data: returnedItems, error: returnedItemsError } = await supabase
        .from("purchase_return_items")
        .select("returned_qty")
        .in("purchase_return_id", returnIds)
        .eq("item_id", itemId);

      if (returnedItemsError) throw returnedItemsError;
      if (!returnedItems?.length) return 0;

      // Total returned_qty
      const totalReturnedQty = returnedItems.reduce(
        (sum, item) => sum + (item.returned_qty || 0),
        0
      );

      return totalReturnedQty;
    } catch (error) {
      console.error("Error fetching returned quantity:", error);
      return 0;
    }
  };

  // --- Reusable error message display component ---
  const ErrorMessage = ({ message }: { message?: string }) => {
    if (!message) return null; // Nothing to show if no message
    return (
      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {/* Icon to indicate error */}
        {message}
      </p>
    );
  };

  // --- Today's date (used in submission or defaults) ---
  const today = format(new Date(), "yyyy-MM-dd");

  // --- Fetch list of valid purchase orders on initial mount ---
  useEffect(() => {
    const fetchFilteredPOs = async () => {
      try {
        // Query for active purchase orders with specific statuses
        const { data, error } = await supabase
          .from("purchase_order")
          .select(
            `
            id,
            po_number,
            created_at,
            order_status:system_message_config!inner(sub_category_id)
          `
          )
          .eq("is_active", true)
          .eq('company_id', userData?.company_id!)
          .in("order_status.sub_category_id", [
            "ORDER_RECEIVED",
            "ORDER_PARTIALLY_RECEIVED",
          ]);

        if (error) throw error;

        // Extract PO numbers safely
        const poList = (data ?? [])
          .map((r: any) => ({
            id: r.id,
            po_number: r.po_number,
          }))
          .filter((po: any) => po.id && typeof po.po_number === "string");

        setPoNumbers(poList); // Store available PO numbers
      } catch (err) {
        console.error(err); // Log failure
      }
    };

    fetchFilteredPOs(); // Trigger fetch once
  }, []); // Empty deps: run only on mount

  // --Merged UseEffect--
  // --- Watch the linked purchase order number to auto-populate supplier info ---
  const watchedPOId = watch("linkedPOId");

  const fetchAllData = async (poId: string) => {
    if (!poId) {
      console.warn("⚠️ No PO number provided, aborting fetchAllData");
      return;
    }

    // helper to normalize rpc responses (Supabase RPC sometimes returns { data: [...] } or just [...])
    const normalizeRpc = (res: any) => {
      if (!res) return null;
      if (Array.isArray(res)) return res;
      if (res.data && Array.isArray(res.data)) return res.data;
      // some rpc wrapper returns [{ data: [...] }]
      if (Array.isArray(res) && res[0]?.data && Array.isArray(res[0].data)) return res[0].data;
      return null;
    };

    try {
      // 1️⃣ Get PO metadata
      const { data: poMeta, error: poMetaError } = await supabase
        .from("purchase_order")
        .select("id, supplier_id, order_date, store_id")
        .eq("id", poId)
        .single();

      if (poMetaError || !poMeta?.id) {
        console.error("❌ Could not fetch PO ID for RPC:", poMetaError);
        return;
      }

      setSelectedPOId(poMeta.id);
      // 2️⃣ Populate original PO date
      if (poMeta.order_date) {
        setOriginalPODate(poMeta.order_date);
        setValue("originalPODate", poMeta.order_date);
      }

      // 👇 ADD THIS SECTION: Fetch store info
      if (poMeta.store_id) {
        const { data: storeData, error: storeError } = await supabase
          .from("store_mgmt")
          .select("id, name")
          .eq("id", poMeta.store_id)
          .single();

        if (!storeError && storeData) {
          setStoreName(storeData.name);
          setStoreId(storeData.id);
          setValue("storeName", storeData.name);
          setValue("store_id", storeData.id);
        }
      }

      const [inventoryRaw, itemsResponse] = await Promise.all([
        // keep typing as any because rpc is flexible
        (supabase.rpc as any)("get_consolidated_inventory", {
          po_id: poMeta.id,
          search_query: null,
        }),
        (supabase.rpc as any)("get_purchase_order_items", {
          p_po_id: poMeta.id,
        })
      ]);

      const inventoryData = normalizeRpc(inventoryRaw) as
        | {
          item_id: string;
          item_name: string;
          total_quantity: number;
          received_qty: number;
        }[]
        | null;

      const itemsData = normalizeRpc(itemsResponse) as
        | {
          unit_price: any;
          order_price: any;
          item_name: string;
          order_qty: number;
          received_qty: number;
          description?: string;
          price?: number;
          brand_id?: string;
        }[]
        | null;

      console.log("itemsData =>", itemsResponse);

      // 4️⃣ Fetch supplier info
      if (poMeta.supplier_id) {
        const { data: supData, error: supError } = await supabase
          .from("supplier_mgmt")
          .select("id, supplier_name, email, address, supplier_id")
          .eq("id", poMeta.supplier_id)
          .single();
        if (!supError && supData) {
          setSupplierName(supData.supplier_name);
          setSupplierEmail(supData.email);
          setSupplierAddress(supData.address);
          setSupplierId(supData.supplier_id);
          setSupplierUUID(supData.id);
        }
      }

      // 5️⃣ Set raw inventory list for the table
      if (inventoryData && Array.isArray(inventoryData)) {
        setInventoryList(inventoryData);
      } else {
        console.warn("⚠️ No inventoryData returned");
        setInventoryList([]); // keep state predictable
      }

      // 6️⃣ Build selectedSupplies with all required fields
      if (Array.isArray(itemsData) && Array.isArray(inventoryData)) {
        const itemMap: Record<string, { order_qty: number; received_qty: number }> = {};
        const availableSupplies: Supply[] = [];

        // 6.1️⃣ Map item_name → item_id
        const inventoryMap: Record<string, string> = {};
        inventoryData.forEach((inv) => {
          if (inv?.item_name && inv?.item_id) {
            inventoryMap[inv.item_name] = inv.item_id;
          }
        });

        // 6.2️⃣ For each PO item, look up its inventory ID
        itemsData.forEach((itm, idx) => {
          const name = itm?.item_name || `Unknown Item ${idx + 1}`;
          const item_id_from_inventory = inventoryMap[name];
          if (!item_id_from_inventory) {
            console.warn(`⚠️ item_id not found for "${name}" — skipping this PO item`);
            return;
          }

          // record order/received for table (use safe defaults)
          itemMap[item_id_from_inventory] = {
            order_qty: typeof itm.order_qty === "number" ? itm.order_qty : 0,
            received_qty: typeof itm.received_qty === "number" ? itm.received_qty : 0,
          };

          // build Supply (match your Supply interface)
          availableSupplies.push({
            id: item_id_from_inventory,
            item_id: item_id_from_inventory,
            item_name: name,
            description: itm.description || "",
            brand_id: itm.brand_id || "",
            unit_price: Number(itm.unit_price ?? itm.price ?? 0),
            order_price: Number(itm.order_price ?? 0),
            price: Number(itm.price ?? 0),
            return_qty: 0,
            return_reason: "",
          });
        });

        // 6.3️⃣ Sync to state & form
        // setSelectedSupplies(availableSupplies);
        // setValue("selectedSupplies", availableSupplies, {
        //   shouldDirty: !isEdit && !isView,
        //   shouldTouch: !isEdit && !isView,
        // });
        // if (!isEdit && !isView) {
        //   setConfirmedSupplyIds(availableSupplies.map((s) => s.id));
        // }
        setOrderDetailsByItemId(itemMap);
      } else {
        console.warn(
          "⚠️ itemsData or inventoryData not arrays, skipping supplies build"
        );
        // keep consistent state
        setSelectedSupplies([]);
        setValue("selectedSupplies", [], {
          shouldDirty: !isEdit && !isView,
          shouldTouch: !isEdit && !isView,
        });
        setOrderDetailsByItemId({});
      }
    } catch (err) {
      console.error("❌ Error in fetchAllData:", err);
    }
  };

  // Trigger on PO change
  // ✅ Fetch fresh data on PO change
  useEffect(() => {
    if (watchedPOId) {
      fetchAllData(watchedPOId);
    }
  }, [watchedPOId]);

  // ✅ Handle edit mode population
  useEffect(() => {
    if (!returnRequestId || !companyId) return;

    const fetchEditData = async () => {
      try {
        let returnData: any = null;
        let returnItems: any = null;

          if (isPending && approvalData) {
            // Extract from operations array
            const ops = approvalData.operations || [];
            const parentOp = ops.find((op: any) => op.table === 'purchase_return' && (op.type === 'insert' || op.type === 'update'));
            const itemsOp = ops.find((op: any) => op.table === 'purchase_return_items' && op.type === 'insert');
            
            // Merge approvalData with parentOp.data (crucial for 'Add' where data is only in operations)
            returnData = { ...approvalData, ...(parentOp?.data || {}) };
            
            if (itemsOp) {
                returnItems = itemsOp.data;
            } else if (returnData.id) {
                // For Delete or if items are not in payload, fetch from DB
                const { data: dbItems } = await supabase
                    .from('purchase_return_items')
                    .select('*')
                    .eq('purchase_return_id', returnData.id)
                    .eq('is_active', true);
                if (dbItems) returnItems = dbItems;
            }
            
            if (!returnData.store_id) {
               returnData.store_id = watchedStoreId;
            }

        } else if (returnRequestId !== 'pending') {
          // 1️⃣ Fetch the main return request
          const { data: fetchReturnData, error: returnError } = await supabase
            .from("purchase_return")
            .select("*, purchase_order_id, store_id")  // 👈 ADD store_id here
            .eq("id", returnRequestId)
            .eq("is_active", true)
            .single();

          if (returnError || !fetchReturnData) {
            console.error("❌ Failed to fetch return request:", returnError);
            return;
          }
          returnData = fetchReturnData;
        }

        if (!returnData) return;

        console.log("Fetched return request data:", returnData);

        setSelectedPOId(returnData.purchase_order_id);

        setCurrentApprovalStatus(
          (Array.isArray(returnData.approval_status)
            ? returnData.approval_status.at(-1)
            : returnData.approval_status) as ApprovalStatus | undefined
        );

        console.log("Debug fetchEditData dependencies:", {
          companyId,
          moduleId,
          actionId,
          storeId: returnData.store_id,
          userId
        });

      if (
  !companyId ||
  !moduleId ||
  !actionId ||
  !returnData.store_id ||
  !userId
) {
  console.log("fetchEditData early returned because a dependency is missing");
  return;
}

const [returnStatusData, workflowConfigData] = await Promise.all([
  supabase
    .from("system_message_config")
    .select("*")
    .eq("company_id", companyId)
    .eq("category_id", "PURCHASE_ORDER_RETURN"),

  supabase
    .from("workflow_config")
    .select("*")
    .eq("company_id", companyId)
    .eq("module_id", moduleId)
    .eq("action_id", actionId)
    .eq("store_id", returnData.store_id)
    .eq("assigned_to", userId)
    .eq("is_active", true)
    .eq("status", true)
    .order("level", { ascending: true })
    .limit(1),
]);
console.log("Workflow Data:", workflowConfigData.data);
console.log("Workflow Error:", workflowConfigData.error);


        if (returnStatusData.error) throw returnStatusData.error;
        if (workflowConfigData.error) throw workflowConfigData.error;

        const currentWorkflowConfig = workflowConfigData.data?.find((config) => config.id === returnData.workflow_id);
        setCurrentWorkflow(currentWorkflowConfig);

        const returnStatus = returnStatusData.data?.find((status) => status.id === returnData.return_status);
        setReturnStatus(returnStatus);


        // 2️⃣ Reset form fields
        reset({
          linkedPOId: returnData.purchase_order_id ?? '',
          returnStatus: returnData.return_status ?? '',
          returnRequestNumber: returnData.purchase_retrun_number || ('DEBUG: ' + JSON.stringify(returnData).substring(0, 50)),
          remarks: returnData.remark ?? "",
          createdDate: returnData.created_at?.slice(0, 10) ?? today,
          returnDate: returnData.return_date?.slice(0, 10) ?? today,
          store_id: returnData.store_id ?? "",
          workflow_id: returnData.workflow_id,
          next_level_role_id: returnData.next_level_role_id
        });

        originalDepartmentId.current = returnData.department_id;
        const approvalStatus = returnData.approval_status as unknown as ApprovalStatus[];
        setAllApprovalStatus(approvalStatus);

        if (returnData.purchase_order_id) {
          const { data: poData } = await supabase
            .from("purchase_order")
            .select("po_number")
            .eq("id", returnData.purchase_order_id)
            .single();

          if (poData) {
            setLinkedPONumberDisplay(poData.po_number ?? '');
          }
        }

        if (returnData.store_id) {
          const { data: storeData, error: storeError } = await supabase
            .from("store_mgmt")
            .select("id, name")
            .eq("id", returnData.store_id)
            .single();

          if (!storeError && storeData) {
            setStoreName(storeData.name);
            setStoreId(storeData.id);
            setValue("storeName", storeData.name);
            setValue("store_id", storeData.id);
          }
        }
        // --- Hydrate attachment preview & metadata (edit mode) ---
        try {
          if (returnData.attachment) {
            let parsed: any = returnData.attachment;
            if (typeof parsed === "string") {
              // could be a JSON string or plain URL
              try {
                parsed = JSON.parse(parsed);
              } catch {
                // keep as string (legacy plain URL or filename)
              }
            }

            // store parsed metadata (object) or plain string
            setExistingAttachment(parsed ?? null);
            setRemoveExistingAttachment(false);

            // prefer explicit url in metadata
            if (parsed && typeof parsed === "object" && parsed.url && typeof parsed.url === "string") {
              setAttachmentPreview(parsed.url);
            } else if (parsed && typeof parsed === "object" && parsed.path && typeof parsed.path === "string") {
              // generate public url from stored path if available
              try {
                const { data: publicUrlData } = supabase.storage
                  .from("return-files")
                  .getPublicUrl(parsed.path);
                const publicUrl = (publicUrlData as any)?.publicUrl ?? (publicUrlData as any)?.publicURL ?? null;
                setAttachmentPreview(publicUrl);
              } catch (err) {
                console.error("Failed to generate public URL from path:", err);
                setAttachmentPreview(null);
              }
            } else if (typeof parsed === "string" && parsed.startsWith("http")) {
              // legacy plain URL
              setAttachmentPreview(parsed);
            } else {
              setAttachmentPreview(null);
            }

            // we don't want the DB-stored attachment to be treated as a local File
            // ensure form field is null (user can upload a fresh file to replace)
            setValue("attachment", null, { shouldDirty: false });
          } else {
            // no attachment in DB
            setExistingAttachment(null);
            setAttachmentPreview(null);
            setRemoveExistingAttachment(false);
            setValue("attachment", null, { shouldDirty: false });
          }
        } catch (err) {
          console.error("Failed to hydrate attachment preview:", err);
          setExistingAttachment(null);
          setAttachmentPreview(null);
          setRemoveExistingAttachment(false);
          setValue("attachment", null, { shouldDirty: false });
        }

        // ✅ Fetch full related data
        if (returnData.purchase_order_id) {
          await fetchAllData(returnData.purchase_order_id);
        }

        // 3️⃣ Supplier info
        if (returnData.supplier_id) {
          const { data: supData, error: supError } = await supabase
            .from("supplier_mgmt")
            .select("supplier_name, email, address")
            .eq("id", returnData.supplier_id)
            .single();

          if (!supError && supData) {
            setSupplierName(supData.supplier_name ?? "");
            setSupplierEmail(supData.email ?? "");
            setSupplierAddress(supData.address ?? "");
            setValue("supplierName", supData.supplier_name ?? "");
            setValue("supplierEmail", supData.email ?? "");
            setValue("supplierAddress", supData.address ?? "");
          }
        }

        // 4️⃣ Fetch inventory list for this PO
        const [invResRaw, poItemsRaw] = await Promise.all([
          (supabase.rpc as any)("get_consolidated_inventory", {
            po_id: returnData.purchase_order_id,
            search_query: null,
          }),
          (supabase.rpc as any)("get_purchase_order_items", {
            p_po_id: returnData.purchase_order_id,
          })
        ]);
        const invRes = invResRaw.data;
        const invErr = invResRaw.error;
        const poItems = poItemsRaw.data;

        if (invErr) {
          console.error("❌ Failed to fetch inventory for edit:", invErr);
        }

        // 5️⃣ Fetch return items if not already fetched from pending payload
        let itemsToUse = returnItems;
        if (!itemsToUse && returnRequestId !== 'pending') {
          const { data: fetchedReturnItems, error: returnItemsError } = await supabase
            .from("purchase_return_items")
            .select("*")
            .eq("purchase_return_id", returnRequestId)
            .eq("is_active", true);

          if (returnItemsError || !fetchedReturnItems) {
            console.error("❌ Failed to fetch return items:", returnItemsError);
            return;
          }
          itemsToUse = fetchedReturnItems;
        }

        const initialQuantities: Record<string, number> = {};
        itemsToUse.forEach((item: any) => {
          if (item.item_id && item.returned_qty) {
            initialQuantities[item.item_id] = item.returned_qty;
          }
        });
        setOriginalReturnQuantities(initialQuantities);

        // 6️⃣ Merge inventory with return items
        const editedSupplies: Supply[] = itemsToUse.map((ri: any) => {
          const inv = (invRes || []).find(
            (i: any) => String(i.item_id) === ri.item_id
          );

          const poItem = (poItems || []).find(
            (i: any) => String(i.item_id) === ri.item_id
          );

          return {
            id: ri.item_id,
            item_id: ri.item_id,
            item_name: poItem?.item_name ?? inv?.item_name ?? `Unknown Item (${ri.item_id})`,
            description: "",
            unit_price: Number(poItem?.unit_price ?? poItem?.price ?? inv?.unit_price ?? inv?.price ?? ((ri.order_price || 0) / (ri.returned_qty || 1))),
            order_price: typeof ri.order_price === "number" ? ri.order_price : 0,
            price: ri.order_price,
            brand_id: "",
            orderQty: inv?.total_quantity ?? 0,
            receivedQty: inv?.received_qty ?? 0,
            return_qty: ri.returned_qty,
            return_reason: ri.return_reason ?? "",
          };
        });

        setSelectedSupplies(editedSupplies);
        setValue("selectedSupplies", editedSupplies, {
          shouldDirty: false,
          shouldTouch: false,
        });
        setConfirmedSupplyIds(editedSupplies.map((s) => s.id));
        setIsSelectedSuppliesExpanded(true)
      } catch (err) {
        console.error("❌ Error in edit fetch:", err);
      }
    };

    fetchEditData();
  }, [returnRequestId, systemMsgConfig, companyId, moduleId, actionId, watchedStoreId, userId, approvalData, isPending, approvalActionName]);

  const extractStoragePathFromPublicUrl = (url: string, bucket = "return-files"): string | null => {
    try {
      const u = new URL(url);
      const pathname = u.pathname;

      // Try multiple patterns that Supabase might use
      const patterns = [
        `/storage/v1/object/public/${bucket}/`,
        `/object/public/${bucket}/`,
        `/${bucket}/`,
      ];

      for (const pattern of patterns) {
        const idx = pathname.indexOf(pattern);
        if (idx !== -1) {
          const extracted = decodeURIComponent(pathname.slice(idx + pattern.length));
          return extracted;
        }
      }

      return null;
    } catch (e) {
      console.error("URL parsing error:", e);
      return null;
    }
  };

  // detect if a URL or filename looks like an image
  const isImageUrl = (u: string) => {
    if (!u) return false;
    if (u.startsWith("data:")) return true;
    try {
      const lower = u.toLowerCase();
      return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/.test(lower) || lower.includes("image/");
    } catch {
      return false;
    }
  };
  

  // call to clear the attachment both in form and local preview
 const handleRemoveAttachment = () => {
  setAttachmentPreview(null);

  setValue("attachment", null, {
    shouldDirty: true,
    shouldValidate: true,
  });

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }

  setRemoveExistingAttachment(true);
};

  const uploadAttachmentToBucket = async (
    file: File,
    returnRequestNumber: string
  ): Promise<{ url: string; type: string; size: number; path: string }> => {
    const filePath = `${returnRequestNumber}/${Date.now()}_${file.name}`;

    try {
      // Upload the file to the "return-files" bucket
      const { error: uploadError } = await supabase.storage
        .from("return-files")   // 👈 hardcoded bucket name
        .upload(filePath, file);

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
      }

      // Generate public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("return-files")   // 👈 same bucket
        .getPublicUrl(filePath);

      const publicUrl =
        (publicUrlData as any)?.publicUrl ??
        (publicUrlData as any)?.publicURL ??
        "";

      return {
        url: publicUrl,
        type: file.type,
        size: file.size,
        path: filePath,
      };
    } catch (err) {
      console.error("Error in uploadAttachmentToBucket:", err);
      throw err;
    }
  };


  // Utility: handle file selection & preview
  const handleAttachmentChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setAttachmentPreview: React.Dispatch<React.SetStateAction<string | null>>,
    setFile: (file: File) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Save the file in react-hook-form
    setFile(file);

    // Generate preview
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreview(reader.result as string); // data URL for <img>
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(file.name); // just show filename for docs/pdf
    }
  };

  const validateBeforeSubmit = () => {
    const newReasonErrors: Record<string, string> = {};
    const newQtyErrors: Record<string, string> = {};

    // Filter out fallback items
    const validSupplies = selectedSupplies.filter((s) => s.item_id);
    validSupplies.forEach((s) => {
      const qty = Number(s.return_qty);

      // Empty or invalid qty
      if (isNaN(qty) || qty === 0) {
        newQtyErrors[s.item_id!] = "Return quantity is required";
      }
      // less than 1 qty
      else if (qty < 1) {
        newQtyErrors[s.item_id!] = "Must be at least 1";
      }

      // Reason required only if qty > 0
      if (qty > 0 && (!s.return_reason || s.return_reason.trim() === "")) {
        newReasonErrors[s.item_id!] = "Reason is required for returned items";
      }
    });

    setReturnQtyErrors(newQtyErrors);
    setReasonErrors(newReasonErrors);

    return (
      Object.keys(newQtyErrors).length === 0 &&
      Object.keys(newReasonErrors).length === 0
    );
  };

  // Validate return request number before submit
  const validateAndFixReturnNumber = async (returnNumber: string, supplierId: string) => {
    try {
      if (!supplierId) return returnNumber;

      // Extract date + supplier
      const match = returnNumber.match(/^RO-(\d{6})-(.+)-(\d+)$/);
      if (!match) return returnNumber;

      const [, datePart, supplierCode, seqString] = match;
      const currentSeq = parseInt(seqString, 10);

      const basePrefix = `RO-${datePart}-${supplierCode}`;

      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // Fetch all return numbers for this day + supplier
      const { data, error } = await supabase
        .from("purchase_return")
        .select("purchase_retrun_number")
        .ilike("purchase_retrun_number", `${basePrefix}%`)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      if (error) {
        console.error("Return number validation error:", error);
        return returnNumber;
      }

      const existingSeqs =
        data
          ?.map((row: { purchase_retrun_number: string | null }) => {
            if (!row.purchase_retrun_number) return 0;
            const m = row.purchase_retrun_number.match(/-(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
          })
          .filter((n) => !isNaN(n)) ?? [];

      const next =
        existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;

      const finalSeq = existingSeqs.includes(currentSeq)
        ? next
        : currentSeq;

      return `${basePrefix}-${finalSeq}`;
    } catch (err) {
      console.error("Failed to validate return number:", err);
      return returnNumber;
    }
  };

  // Item stock validation
  const validateStockBeforeReduction = async (
    purchaseOrderId: string,
    items: { item_id: string; item_name: string; requiredQty: number }[]
  ) => {
    const { data: inventoryRows, error } = await supabase
      .from("inventory_mgmt")
      .select("item_id, item_qty")
      .eq("purchase_order_id", purchaseOrderId);

    if (error || !inventoryRows) {
      return { ok: false, message: "Failed to load inventory." };
    }

    const failures: string[] = [];

    for (const item of items) {
      const row = inventoryRows.find((i) => i.item_id === item.item_id);
      const stock = row?.item_qty ?? 0;

      if (item.requiredQty > stock) {
        failures.push(
          `Item: ${item.item_name} does not have enough stock. Required: ${item.requiredQty}, Available: ${stock}`
        );
      }
    }

    if (failures.length > 0) {
      return { ok: false, message: failures.join("\n") };
    }

    return { ok: true };
  };

  console.log(watch().selectedSupplies)

  const validateWorkflowApprovers = async (): Promise<boolean> => {
    try {
      const prDepartment = isEdit ? originalDepartmentId.current : departmentId;
      if (!companyId || !prDepartment || !watchedStoreId) {
        toast.error("Missing company, department or store information.", {
          position: "top-center",
        });
        return false;
      }

     const { data, error } = await (supabase as any).rpc(
  "get_workflow_levels_with_approvers",
  {
    p_company_id: companyId,
    p_store_id: watchedStoreId,
    p_department_id: prDepartment,
    p_module_key: "Returns Management",
    p_action_name: "Add",
    p_assigned_to: userId,
  }
);

      if (error) {
        console.error("Workflow validation error:", error);
        toast.error("Failed to validate workflow configuration.", {
          position: "top-center",
        });
        return false;
      }

      // If no workflow configured, allow submission
      if (!data || data.length === 0) {
        return true;
      }

      // Find any level without approvers
      const invalidLevel = data.find((level: any) => !level.has_approvers);

      if (invalidLevel) {
        toast.error(
          `No approval users configured for Level ${invalidLevel.level}. Please configure approvers for this department.`,
          { position: "top-center" }
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error("Workflow validation failed:", err);
      toast.error("Unexpected error during workflow validation.", {
        position: "top-center",
      });
      return false;
    }
  };

  const handleConfirmReturnItems = async () => {
    setIsReturning(true);
    try {
      if (!returnRequestId || !selectedPOId) return;

      const validSupplies = selectedSupplies.filter(
        (s) => s.item_id && Number(s.return_qty) > 0
      );

      const stockCheckItems = validSupplies.map((s) => ({
        item_id: s.item_id!,
        item_name: s.item_name,
        requiredQty: Number(s.return_qty),
      }));

      const stockCheck = await validateStockBeforeReduction(selectedPOId, stockCheckItems);
      if (!stockCheck.ok) {
        toast.error(stockCheck.message || "Not enough stock for some items.");
        setIsReturning(false);
        return;
      }

      // Payload for approvals-action
      const returnStatusToSave = statusReturnCompleted?.id || returnStatus?.id;
      const rpcItems = validSupplies.map((s) => ({
        item_id: s.item_id,
        return_qty: Number(s.return_qty)
      }));

      // Direct execution
      const { error: rpcError } = await supabase.rpc('process_purchase_return', {
        p_return_id: returnRequestId,
        p_po_id: selectedPOId,
        p_items: rpcItems,
        p_status_id: returnStatusToSave as string
      });

      if (rpcError) throw rpcError;

      // System Log
      await supabase.from('system_log').insert({
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: "Return Management",
        scope: "Confirm",
        key: `${watch("returnRequestNumber")}`,
        log: `Purchase Return ${watch("returnRequestNumber")} items returned and inventory reduced.`,
        action_by: userData?.id,
        created_at: new Date().toISOString()
      });

      toast.success("Items returned and inventory reduced successfully.");
      setIsConfirmReturnDialogOpen(false);
      navigate("/dashboard/return-request", { state: { refresh: true } });
    } catch (err: any) {
      console.error("Error returning items:", err);
      toast.error(err.message || "Failed to initiate confirm return request.");
    } finally {
      setIsReturning(false);
    }
  };

  // Form submission handler
  const onSubmit = async (data: FormValues) => {
    const isWorkflowValid = await validateWorkflowApprovers();
    if (!isWorkflowValid) return;

    if (isEdit && returnRequestId) {
      const isLocked = await checkEntityLock(returnRequestId);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }

    try {
      // Validation
      const isValid = validateBeforeSubmit();
      if (!isValid) {
        console.warn("Validation failed — check fields before submitting.");
        return;
      }

      if (!data.linkedPOId || !selectedPOId) {
        toast.error("Please select a purchase order.");
        return;
      }

      const currentTime = new Date().toISOString();

      // Modes
      const isNewReturn = !isEdit;
      const lastApproval = allApprovalStatus?.at(-1);
      const isResubmitted = isEdit && data.returnStatus === statusCreated?.id && lastApproval?.trail === "Rejected";

      let returnStatusToSave = data.returnStatus;
      if (isNewReturn || isResubmitted) {
        if (statusApprovalCompleted) {
          returnStatusToSave = statusApprovalCompleted.id;
        }
      }

      // Calculate totals
      const validSupplies = data.selectedSupplies.filter(
        (s) => s.item_id && Number(s.return_qty) > 0
      );

      if (validSupplies.length === 0 && (isNewReturn || isResubmitted)) {
        toast.error("Please return at least one valid item.");
        return;
      }

      const totalReturnQty = validSupplies.reduce(
        (sum, s) => sum + Number(s.return_qty || 0),
        0
      );
      const totalReturnValue = validSupplies.reduce((sum, s) => {
        const price = Number(s.unit_price ?? 0);
        const qty = Number(s.return_qty ?? 0);

        return sum + qty * price;
      }, 0);

      // Inventory stock check
      if (isNewReturn || isResubmitted) {
        const stockCheckItems = validSupplies.map((s) => ({
          item_id: s.item_id!,
          item_name: s.item_name,
          requiredQty: Number(s.return_qty),
        }));

        const stockCheck = await validateStockBeforeReduction(selectedPOId!, stockCheckItems);
        if (!stockCheck.ok) {
          toast.error(stockCheck.message || "Not enough stock for some items.");
          return;
        }
      }

      const purchaseOrderId = data.linkedPOId;

      // Handle attachment (Client side upload must still occur immediately)
      let attachmentToSave: any = null;
      let finalReturnNumber = data.returnRequestNumber;

      if (isNewReturn) {
        finalReturnNumber = await validateAndFixReturnNumber(
          data.returnRequestNumber,
          supplierId || ""
        );
      }

      if (data.attachment) {
        try {
          attachmentToSave = await uploadAttachmentToBucket(
            data.attachment,
            finalReturnNumber
          );
        } catch (uploadErr: any) {
          console.error("Attachment upload failed:", uploadErr);
          toast.error("Failed to upload attachment, continuing anyway.");
        }
      } else if (removeExistingAttachment && existingAttachment) {
        attachmentToSave = null;
      } else if (!removeExistingAttachment && existingAttachment) {
        attachmentToSave = existingAttachment;
      }

      const operations = [];
      let payloadId = returnRequestId;
      let payloadReturnNumber = finalReturnNumber;

      if (isNewReturn) {
        payloadId = "{{return_id}}";
        payloadReturnNumber = "{{return_number}}";

        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yy = String(now.getFullYear()).slice(-2, 4);
        const formattedDate = `${dd}${mm}${yy}`;
        const formattedSupplier = supplierId?.toUpperCase() || "SUP";
        const basePrefix = `RO-${formattedDate}-${formattedSupplier}-`;

        operations.push({
          type: "generate_sequence",
          table: "purchase_return",
          column: "purchase_retrun_number",
          prefix: basePrefix,
          padding: 1,
          start_sequence: 1,
          return_id_as: "return_number"
        });
      }

      // Payload
      const returnPayload = {
        purchase_retrun_number: payloadReturnNumber,
        return_date: data.returnDate || format(new Date(), "yyyy-MM-dd"),
        supplier_id: supplierUUID ?? undefined,
        total_items: totalReturnQty,
        total_value: totalReturnValue,
        remark: data.remarks || null,
        purchase_order_id: purchaseOrderId,
        company_id: companyId,
        created_by: userData?.id,
        created_at: currentTime,
        modified_at: currentTime,
        store_id: storeId,
        attachment: attachmentToSave,
        department_id: isNewReturn ? departmentId : originalDepartmentId.current,
        return_status: returnStatusToSave,
      };

      if (isNewReturn) {
        operations.push({
          table: "purchase_return",
          type: "insert",
          data: returnPayload,
          return_id_as: "return_id"
        });
      } else {
        operations.push({
          table: "purchase_return",
          type: "update",
          data: returnPayload,
          match: { id: payloadId }
        });
        
        operations.push({
          table: "purchase_return_items",
          type: "delete",
          match: { purchase_return_id: payloadId }
        });
      }

      const itemsPayload = validSupplies.map((s) => ({
        purchase_return_id: payloadId,
        item_id: s.item_id!,
        returned_qty: Number(s.return_qty),
        return_reason: s.return_reason || "No reason provided",
        order_price: Number(s.return_qty) * Number(s.unit_price || s.order_price || 0),
        company_id: companyId,
        remarks: data.remarks || null,
      }));

      operations.push({
        table: "purchase_return_items",
        type: "insert",
        data: itemsPayload
      });

      operations.push({
        table: "system_log",
        type: "insert",
        data: {
          company_id: companyId,
          transaction_date: currentTime,
          module: "Return Management",
          scope: isNewReturn ? "Add" : "Edit",
          key: payloadReturnNumber,
          log: `Purchase Return ${payloadReturnNumber} ${isNewReturn ? 'created' : 'updated'}.`,
          action_by: userData?.id,
          created_at: currentTime,
        }
      });

      const action_payload = { operations };

      await initiateApprovalRequest({
        module_name: "Returns Management",
        action_name: isNewReturn ? "Add" : "Edit",
        company_id: companyId ?? "",
        requested_by: userData?.id ?? "",
        store_id: watchedStoreId ?? null,
        entity_id: isNewReturn ? null : returnRequestId,
        action_payload: action_payload
      });

      toast.success(isNewReturn ? "Return request submitted for approval." : "Return request update submitted for approval.");
      navigate("/dashboard/return-request", { state: { refresh: true } });

    } catch (err: any) {
      console.error("Error processing return request:", err);
      toast.error(err.message || "Failed to process return request. Please try again.");
    }
  };

  const selectedNames = new Set(selectedSupplies.map((s) => s.item_name));

  // Return current status to display on status input
  const getCurrentReturnStatus = () => {
    if (isEdit || isView) {
      if (returnStatus?.sub_category_id === "APPROVAL_PENDING") {
        return returnStatus?.value?.replace('{@}', `${currentWorkflow?.level || ''}`) || '';
      } else if (returnStatus?.sub_category_id === "APPROVER_COMPLETED" && currentApprovalStatus?.isFinalized) {
        return returnStatus?.value?.replace('{@} Return Approved', 'Purchase Return Approved') || '';
      } else if (returnStatus?.sub_category_id === "APPROVER_COMPLETED" && !currentApprovalStatus) {
        return returnStatus?.value?.replace('{@} Return Approved', 'Purchase Return Approved') || '';
      } else {
        return returnStatus?.value;
      }
    } else {
      return (workflowConfig
        ? statusApprovalPending?.value?.replace('{@}', `${workflowConfig?.level || ''}`) || ''
        : statusApprovalCompleted?.value?.replace('{@} Return Approved', 'Purchase Return Approved') || '');
    }
  };

  // Handling Return Quantity input change
  const handleReturnQtyChange = (
    item: any,
    e: React.ChangeEvent<HTMLInputElement>,
    alreadyReturnedQty: number = 0
  ) => {
    const { item_id, total_quantity, unit_price = 0 } = item;
    const inputValue = e.target.value;
    const qty = parseInt(inputValue) || 0;

    let adjustedAlreadyReturnedQty = alreadyReturnedQty;
    if (isResubmitting) {
      const originalQty = originalReturnQuantities[item_id] || 0;
      adjustedAlreadyReturnedQty = alreadyReturnedQty - originalQty;
    }

    const returnableQty = total_quantity - adjustedAlreadyReturnedQty;

    // Validate quantity instantly
    if (inputValue && qty > returnableQty) {
      setReturnQtyErrors((prev) => ({
        ...prev,
        [item_id]: `Cannot exceed returnable qty (${returnableQty})`,
      }));
    } else if (inputValue && qty < 1) {
      setReturnQtyErrors((prev) => ({
        ...prev,
        [item_id]: "Must be at least 1",
      }));
    } else {
      setReturnQtyErrors((prev) => {
        const copy = { ...prev };
        delete copy[item_id];
        return copy;
      });
    }

    // Update selected supplies
    const updated = [...selectedSupplies];
    const idx = updated.findIndex((s) => s.item_id === item_id || s.id === item_id);

    if (idx !== -1) {
      updated[idx] = {
        ...updated[idx],
        return_qty: qty,
        order_price: qty * (updated[idx].unit_price ?? unit_price ?? 0),
      };
    } else {
      updated.push({
        ...item,
        id: item_id,
        item_id,
        unit_price,
        return_qty: qty,
        return_reason: "",
        order_price: qty * unit_price,
      });
    }

    setSelectedSupplies(updated);
    setValue("selectedSupplies", updated, { shouldDirty: true, shouldTouch: true });
  };

  // Handling Reason select change
  const handleReasonChange = (item: any, e: React.ChangeEvent<HTMLSelectElement>) => {
    const { item_id } = item;
    const reason = e.target.value;

    const updated = [...selectedSupplies];
    const idx = updated.findIndex((s) => s.item_id === item_id || s.id === item_id);

    if (idx !== -1) {
      updated[idx].return_reason = reason;
    } else {
      updated.push({
        ...item,
        id: item_id,
        item_id: item_id,
        return_qty: 0,
        return_reason: reason,
      });
    }

    // Validate reason required if return_qty > 0
    const currentQty = updated.find((s) => s.item_id === item_id)?.return_qty || 0;
    if (currentQty > 0 && reason.trim() === "") {
      setReasonErrors((prev) => ({
        ...prev,
        [item_id]: "Reason is required for returned items",
      }));
    } else {
      setReasonErrors((prev) => {
        const copy = { ...prev };
        delete copy[item_id];
        return copy;
      });
    }

    setSelectedSupplies(updated);
    setValue("selectedSupplies", updated, { shouldDirty: true, shouldTouch: true });
  };

  // Print return request
  const handlePrint = () => {
    if (!purchaseReturnForPrint || !userData) return;
    generatePurchaseReturnPDF(purchaseReturnForPrint, userData);
  };

  // Function to generate PDF
  const generatePDF = (purchaseReturn: any, userData: any) => {
    if (!purchaseReturn || !userData) return;

    const doc = new jsPDF();
    const companyData = userData.company_data;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("PURCHASE RETURN", 15, 20);

    // Company details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Company:", 15, 30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyData.name || "GarageInventory", 15, 36);
    doc.text(companyData.address || "123 Garage Street, City, State 12345", 15, 42);
    doc.text(`Phone: ${companyData.phone || "(555) 123-4567"}`, 15, 48);

    // Return details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Return Details:", 135, 30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Return #: ${purchaseReturn.purchase_retrun_number || "N/A"}`, 135, 36);
    doc.text(
      `Date: ${purchaseReturn.return_date ? format(new Date(purchaseReturn.return_date), "dd-MM-yyyy") : "N/A"}`,
      135,
      42
    );
    doc.text(`Status: ${purchaseReturn.status || "N/A"}`, 135, 48);

    // Supplier details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Supplier:", 15, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(purchaseReturn.supplier?.supplier_name || "N/A", 15, 66);
    doc.text(purchaseReturn.supplier?.address || "N/A", 15, 72);
    doc.text(purchaseReturn.supplier?.email || "N/A", 15, 78);

    // Items table including totals
    autoTable(doc, {
      startY: 90,
      head: [["Item Name", "Description", "Return Reason", "Returned Qty", "Unit Price", "Amount"]],
      body: [
        ...purchaseReturn.items.map((item: any) => {
          const formattedAmount = formatCurrency(item.order_price ?? 0).substring(1); // remove symbol
          const unitPrice = item.returned_qty ? (item.order_price ?? 0) / item.returned_qty : 0;
          const formattedUnitPrice = formatCurrency(unitPrice).substring(1);
          return [
            item.item_mgmt?.item_name || "N/A",
            item.item_mgmt?.description || "-",
            item.return_reason || "-",
            item.returned_qty || 0,
            formattedUnitPrice,
            formattedAmount,
          ];
        }),
        // Totals row
        [
          { content: "Grand Total", colSpan: 3, styles: { halign: "left" } },
          purchaseReturn.total_items || 0,
          "",
          (formatCurrency(purchaseReturn.total_value ?? 0).substring(1)),
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 10,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        if (data.row.index === purchaseReturn.items.length) {
          data.cell.styles.fontStyle = "bold";
          // data.cell.styles.fillColor = [230, 230, 230];
          data.cell.styles.fontSize = 10;
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 90;

    // Totals
    // doc.setFontSize(11);
    // doc.setFont("helvetica", "bold");
    // doc.text(`Total Items: ${purchaseReturn.total_items || 0}`, 15, finalY + 10);
    // const totalValueNumeric = formatCurrency(purchaseReturn.total_value ?? 0).substring(1);
    // doc.text(`Total Returned Value: ${totalValueNumeric}`, 110, finalY + 10);

    // Remarks
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Remarks: ${purchaseReturn.remarks?.trim() || "N/A"}`, 15, finalY + 10);

    // Footer
    doc.setDrawColor(200);
    doc.line(15, 273, 195, 273);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Thank you!", 15, 279);
    doc.text(`Contact: ${companyData.email}`, 15, 285);

    return doc;
  };

  const handleDownloadPDF = () => {
    const doc = generatePDF(purchaseReturnForPrint, userData);
    if (doc) {
      doc.save(`${purchaseReturnForPrint?.purchase_retrun_number || 'download'}.pdf`);
      toast.success("PDF downloaded successfully");
    }
  };

  // --- Render the form UI ---

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <PendingApprovalBanner />
        {/* Header */}
        <div className="flex items-center gap-4 w-full">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => {
              if (isDirty && !isView) {
                setShowCancelDialog(true);
              } else {
                navigate("/dashboard/return-request", { state: { refresh: true } });
              }
            }}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>

          <div className="flex items-center space-x-3 flex-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <SquareChartGantt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isView ? "View Return Request" : isEdit ? "Edit Return Request" : "Add Return Request"}
              </h1>
              <p className="text-gray-600">
                {isView
                  ? "View details of an existing return request"
                  : isEdit
                    ? "Update details of an existing return request"
                    : "Create a new return request for damaged or unused items"}
              </p>
            </div>

            {(isView || showConfirmReturnBtn) && (
              <div className="ml-auto flex gap-2">
                {showConfirmReturnBtn && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setIsConfirmReturnDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Confirm Return
                  </Button>
                )}
                {isView && !isPending && (
                  <>
                    <Button
                      variant="outline"
                      className="transition-colors me-2"
                      onClick={handlePrint}
                    >
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadPDF}
                    >
                      <Download className="h-4 w-4" /> Download as PDF
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden bg-white">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-xl text-blue-800">
              Request Information
            </CardTitle>
            <CardDescription className="text-blue-600">
              Fill in the return details below. Fields marked with{" "}
              <span className="text-red-500">*</span> are required.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <SquareChartGantt className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Basic Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Return Request Number */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="returnRequestNumber"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.returnRequestNumber
                        ? "text-red-500"
                        : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <SquareChartGantt className="h-4 w-4" />
                      Return Request Number{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="returnRequestNumber"
                      control={control}
                      defaultValue=""
                      rules={{
                        required: "Return Request Number is required",
                      }}
                      render={({ field }) => (
                        <>
                          <Input
                            {...field}
                            readOnly
                            disabled={isView}
                            className={`${errors.returnRequestNumber
                              ? "border-red-500 focus:ring-red-300"
                              : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                          />
                          <ErrorMessage
                            message={
                              (errors.returnRequestNumber as FieldError)?.message
                            }
                          />
                        </>
                      )}
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="status"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.returnStatus ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <ChartNoAxesCombined className="h-4 w-4" />
                      Status <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="return_status_display"
                      value={getCurrentReturnStatus() || ''}
                      readOnly
                      disabled={isView}
                      className={`h-10 w-full bg-gray-50 ${errors.returnStatus ? "border-red-500" : ""
                        }`}
                    />
                    <ErrorMessage message={errors.returnStatus?.message} />
                  </div>

                  {/* Created Date */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="createdDate"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.createdDate ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <Calendar1 className="h-4 w-4" />
                      Request Created Date{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="createdDate"
                      control={control}
                      defaultValue={isEdit || isView ? "" : today}
                      rules={{ required: "Created Date is required" }}
                      render={({ field }) => (
                        <>
                          <Input
                            {...field}
                            type="date"
                            readOnly={isEdit}
                            disabled={isView}
                            className={`${errors.createdDate
                              ? "border-red-500 focus:ring-red-300"
                              : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                          />
                          <ErrorMessage
                            message={
                              (errors.createdDate as FieldError)?.message
                            }
                          />
                        </>
                      )}
                    />
                  </div>

                  {/* Linked PO Number */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="linkedPONumber"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.linkedPOId
                        ? "text-red-500"
                        : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <Tally5 className="h-4 w-4" />
                      Linked PO Number <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="linkedPOId"
                      control={control}
                      defaultValue=""
                      rules={{ required: "Linked PO Number is required" }}
                      render={({ field }) => (
                        <>
                          <div className="flex items-center gap-2">
                            {isEdit || isView ? (
                              <Input
                                {...field}
                                readOnly
                                disabled={isView}
                                value={linkedPONumberDisplay || ""}
                                className={`flex-1 border rounded-md px-3 py-2 text-sm ${errors.linkedPOId
                                  ? "border-red-500 focus:ring-red-300"
                                  : "border-gray-300 focus:ring-blue-300"
                                  }`}
                              />
                            ) : (
                              <Select
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setSelectedPOId(value);
                                  const selected = poNumbers.find((po) => po.id === value);
                                  if (selected) {
                                    setLinkedPONumberDisplay(selected.po_number);
                                  }
                                }}
                              >
                                <SelectTrigger
                                  id="linkedPONumber"
                                  className={`flex-1 ${errors.linkedPOId
                                    ? "border-red-500 focus:ring-red-300"
                                    : ""
                                    }`}
                                >
                                  <SelectValue placeholder="Select PO Number" />
                                </SelectTrigger>

                                <SelectContent>
                                  {poNumbers.map((po, idx) => (
                                    <SelectItem key={idx} value={po.id}>
                                      {po.po_number}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!selectedPOId}
                                  onClick={() =>
                                    navigate(`/dashboard/purchaseOrderView/${selectedPOId}`)
                                  }
                                  className="whitespace-nowrap cursor-pointer"
                                >
                                  <ArrowUpRight className="h-5 w-5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Purchase Order</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <ErrorMessage
                            message={(errors.linkedPOId as FieldError)?.message}
                          />
                        </>
                      )}
                    />

                  </div>

                  {/* Supplier Name */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="supplierName"
                      className="flex items-center gap-1 font-medium text-gray-700 group-hover:text-blue-700 transition-colors"
                    >
                      <FolderPen className="h-4 w-4" />
                      Supplier Name
                    </Label>
                    <Controller
                      name="supplierName"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={supplierName ?? ""}
                          onChange={(e) => {
                            setSupplierName(e.target.value);
                            field.onChange(e);
                          }}
                          readOnly
                          disabled={isView}
                          className="w-full border rounded-md px-3 py-2 text-sm border-gray-300 focus:ring-blue-300"
                        />
                      )}
                    />
                  </div>

                  {/* Supplier Email */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="supplierEmail"
                      className="flex items-center gap-1 font-medium text-gray-700 group-hover:text-blue-700 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Supplier Email
                    </Label>
                    <Controller
                      name="supplierEmail"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={supplierEmail ?? ""}
                          onChange={(e) => {
                            setSupplierEmail(e.target.value);
                            field.onChange(e);
                          }}
                          readOnly
                          disabled={isView}
                          className="w-full border rounded-md px-3 py-2 text-sm border-gray-300 focus:ring-blue-300"
                        />
                      )}
                    />
                  </div>

                  {/* Supplier Address */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="supplierAddress"
                      className="flex items-center gap-1 font-medium text-gray-700 group-hover:text-blue-700 transition-colors"
                    >
                      <Package className="h-4 w-4" />
                      Supplier Address
                    </Label>
                    <Controller
                      name="supplierAddress"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={supplierAddress ?? ""}
                          onChange={(e) => {
                            setSupplierAddress(e.target.value);
                            field.onChange(e);
                          }}
                          readOnly
                          disabled={isView}
                          className="w-full border rounded-md px-3 py-2 text-sm border-gray-300 focus:ring-blue-300"
                        />
                      )}
                    />
                  </div>

                  {/* Date of Original PO */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="originalPODate"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.originalPODate ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <CalendarCheck2 className="h-4 w-4" />
                      Date of Original PO{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="originalPODate"
                      control={control}
                      defaultValue=""
                      rules={{ required: "Original PO Date is required" }}
                      render={({ field }) => (
                        <>
                          <Input
                            {...field}
                            value={originalPODate}
                            readOnly
                            disabled={isView}
                            className={
                              errors.originalPODate
                                ? "border-red-500 focus:ring-red-300"
                                : ""
                            }
                          />
                          <ErrorMessage
                            message={
                              (errors.originalPODate as FieldError)?.message
                            }
                          />
                        </>
                      )}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="storeName"
                      className={`flex items-center gap-1 font-medium transition-colors ${errors.storeName ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700`}
                    >
                      <Store className="h-4 w-4" />
                      Store Name <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="storeName"
                      control={control}
                      rules={{ required: "Store Name is required" }}
                      render={({ field }) => (
                        <>
                          <Input
                            {...field}
                            value={storeName ?? ""}
                            onChange={(e) => {
                              setStoreName(e.target.value);
                              field.onChange(e);
                            }}
                            readOnly
                            disabled={isView}
                            className={`w-full border rounded-md px-3 py-2 text-sm ${errors.storeName
                              ? "border-red-500 focus:ring-red-300"
                              : "border-gray-300 focus:ring-blue-300"
                              }`}
                          />
                          <ErrorMessage message={(errors.storeName as FieldError)?.message} />
                        </>
                      )}
                    />
                  </div>
                </div>
              </div>
              {/* Supplies Section */}
              <div className="space-y-6">
                <div className="flex-col items-centerpb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Supplies Details
                  </h3>
                </div>
                 <p className="text-sm text-blue-600 my-2"> Items from the selected purchase order. Specify return quantity and reason.</p>
                </div>

                <div className="space-y-4">

                  {selectedSupplies.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          Selected Supplies
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {confirmedSupplyIds.length}
                          </span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setIsSelectedSuppliesExpanded(
                                !isSelectedSuppliesExpanded
                              )
                            }
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-xs flex items-center gap-1"
                          >
                            <span>
                              {isSelectedSuppliesExpanded
                                ? "Collapse"
                                : "Expand"}
                            </span>
                            {isSelectedSuppliesExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplies([]);
                              setValue("selectedSupplies", []);
                              setConfirmedSupplyIds([]);
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                            disabled={isEdit || isView}
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>

                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${isSelectedSuppliesExpanded
                          ? "max-h-[1000px] opacity-100"
                          : "max-h-0 opacity-0"
                          }`}
                      >
                        <div className="mt-3 border rounded-lg overflow-hidden">
                          <table className="w-full border-collapse rounded-md overflow-hidden">
                            <thead className="bg-blue-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Item Name</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Received Qty</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Already Returned Qty</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Returnable Qty</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Return Qty</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Reason for Return</th>
                                {!isView && <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Action</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryList
                                .filter((item) => selectedNames.has(item.item_name))
                                .map((item) => {
                                  const { item_id, item_name, total_quantity = 0 } = item;
                                  const selected = selectedSupplies.find(
                                    (s) => s.item_id === item_id || s.id === item_id
                                  );

                                  let priorReturnedQty;
                                  if (isEdit || isView || isResubmitting) {
                                    priorReturnedQty =
                                      alreadyReturnedMap[item_id] === undefined || originalReturnQuantities[item_id] === undefined
                                        ? 0
                                        : (alreadyReturnedMap[item_id] ?? 0) - (originalReturnQuantities[item_id] ?? 0);
                                  } else {
                                    priorReturnedQty = alreadyReturnedMap[item_id] ?? 0;
                                  }

                                  return (
                                    <tr key={item_id} className="border-t hover:bg-gray-50">
                                      <td className="px-4 py-2 text-sm text-gray-700">{item_name}</td>
                                      <td className="px-4 py-2 text-sm text-gray-700">{total_quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {priorReturnedQty}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700">
                                        {total_quantity - (alreadyReturnedMap[item_id] ?? 0)}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {(isEdit && !isResubmitting) || isView ? (
                                          <span className="text-gray-700">
                                            {selected?.return_qty ?? "-"}
                                          </span>
                                        ) : (
                                          <Input
                                            type="number"
                                            value={selected?.return_qty || ""}
                                            className="h-8 w-24 rounded-md border-gray-300"
                                            onChange={(e) => handleReturnQtyChange(item, e, alreadyReturnedMap[item_id] ?? 0)}
                                            disabled={isView}
                                          />
                                        )}
                                        {returnQtyErrors[item_id] && (
                                          <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {returnQtyErrors[item_id]}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {(isEdit && !isResubmitting) || isView ? (
                                          <span className="text-gray-700">
                                            {selected?.return_reason ?? "-"}
                                          </span>
                                        ) : (
                                          <>
                                            <select
                                              className={`h-8 w-full rounded-md border px-2 text-sm text-gray-700 ${reasonErrors[item_id] ? "border-red-500" : "border-gray-300"
                                                }`}
                                              value={selected?.return_reason ?? ""}
                                              onChange={(e) => handleReasonChange(item, e)}
                                              disabled={isView}
                                            >
                                              <option value="">Select reason</option>
                                              <option value="Damaged">Damaged</option>
                                              <option value="Wrong Item">Wrong Item</option>
                                              <option value="Expired">Expired</option>
                                              <option value="Other">Other</option>
                                            </select>
                                            {reasonErrors[item_id] && (
                                              <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {reasonErrors[item_id]}
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </td>
                             <td className="px-4 py-2 text-sm">
  <Tooltip>
    <TooltipTrigger asChild>
      <span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isEdit && !isResubmitting || isView}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            const updated = selectedSupplies.filter(
              (i) => i.id !== item.item_id
            );
            setSelectedSupplies(updated);
            setValue("selectedSupplies", updated);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </span>
    </TooltipTrigger>

    {isEdit && !isResubmitting || isView ? (
      <TooltipContent>
        <p>Items cannot be removed in Edit or View mode.</p>
      </TooltipContent>
    ) : (
      <TooltipContent>
        <p>Remove Item</p>
      </TooltipContent>
    )}
  </Tooltip>
</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {!isSelectedSuppliesExpanded && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            {selectedSupplies.length} supplies selected - Click
                            expand to view details
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                                                                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                                                <p>Please select a purchase order to view its items</p>
                                                            </div>
                  )}
                </div>
              </div>

              {/* Remarks & Attachments Section */}
              <div className="space-y-3">
                <div className="space-y-6 pt-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <CalendarCheck2 className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">
                      Remarks & Attachments
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2 group">
                      <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 font-medium">
                        Remarks
                      </Label>
                      <Controller
                        name="remarks"
                        control={control}
                        defaultValue=""
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            placeholder="Enter any notes about the return request..."
                            className="resize-none min-h-[100px] border border-gray-200 focus:border-blue-500 focus:ring-blue-200 shadow-sm transition-all duration-200"
                            disabled={isView}
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="attachment"
                        className={`${errors.attachment ? "text-red-500" : "text-gray-700"} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Paperclip className="h-4 w-4" /> Attachment (JPG - max 5MB)
                      </Label>
                      <Input
                       ref={fileInputRef}
                        id="attachment"
                        type="file"
                        accept=".jpg"
                        onChange={(e) =>
                          handleAttachmentChange(e, setAttachmentPreview, (file) =>
                            setValue("attachment", file, { shouldDirty: true })
                          )
                        }
                        className={`${errors.attachment
                          ? "text-red-500 border-red-300 focus:border-red-500 focus:ring-red-200"
                          : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                        disabled={isView}
                      />
                      {attachmentPreview && (
                        <div className="mt-2 flex items-start gap-3">
                          {isImageUrl(attachmentPreview) ? (
                            <img
                              src={attachmentPreview}
                              alt="Attachment Preview"
                              className="h-32 w-32 object-cover rounded-md border border-gray-200"
                            />
                          ) : (
                            <div className="flex flex-col">
                              {attachmentPreview.startsWith("http") ? (
                                <a
                                  href={attachmentPreview}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-blue-600 underline"
                                >
                                  Open attachment
                                </a>
                              ) : (
                                <p className="text-sm text-gray-600">{attachmentPreview}</p>
                              )}
                            </div>
                          )}
                          {!isView && (
                            <div className="flex flex-col items-start gap-2">
                              <button
                                type="button"
                                onClick={handleRemoveAttachment}
                                className="text-sm text-red-600 hover:underline"
                                disabled={isView}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {errors.attachment?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.attachment.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit/Cancel Buttons */}
              {!isView && (
                <div className="pt-6 border-t flex justify-end gap-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      if (isDirty && !isView) {
                        setShowCancelDialog(true);
                      } else {
                        navigate("/dashboard/return-request", {
                          state: { refresh: true },
                        });
                      }
                    }}
                    disabled={isView}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    disabled={isView}
                  >
                    Save
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg text-blue-600">
                Unsaved Changes
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Are you sure you want to cancel? Unsaved changes will be lost.
              </p>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
              >
                No
              </Button>
              <Button
                variant="destructive"
                onClick={() => navigate("/dashboard/return-request")}
              >
                Yes, Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Return Dialog */}
        <Dialog open={isConfirmReturnDialogOpen} onOpenChange={setIsConfirmReturnDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg text-blue-600">
                Confirm Return
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Are you sure you want to return these items and reduce inventory? This action cannot be undone.
              </p>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmReturnDialogOpen(false)}
                disabled={isReturning}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleConfirmReturnItems}
                disabled={isReturning}
              >
                {isReturning ? "Returning..." : "Yes, Return Items"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ReturnForm;


import React, { useEffect, useRef, useState } from 'react';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, ShoppingCart, Calendar1, CheckCircle, Loader2, X, Edit2, Search, Check, AlertCircle, Store, Plus, ArrowLeftRight, History } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import IssueHistoryModal from '../Modal/IssueHistoryModal';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast, { Toaster } from "react-hot-toast";
import { z } from "zod";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ISystemMessageConfig, ItemManagement, IWorkflowConfig } from '@/Utils/constants';
import { supabase } from '@/Utils/types/supabaseClient';
import { getLocalDateTime, loadModulePermissions, initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';
import { Json } from '@/Utils/types/database.types';
import ItemDetailsModal from '@/components/inventory/ItemDetailsModal';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import InventoryTempItemModal from '../Modal/InventoryTempItemModal';
import ReplaceTempItemModal from '../Modal/ReplaceTempItemModal';
import { Image as ImageIcon } from "lucide-react";
import ItemImageModal from '../Modal/ItemImageModal';
import InventoryItemImageModal from '../Modal/InventoryItemImageModal';
import StockTransferModal from '../Modal/StockTransfereModal';
import StockIssueModal from '../Modal/StockIssueModal';
import ScanQRModal from '../../Profile/ScanQRModal';
import ConfirmIssueModal from '../Modal/ConfirmIssueModal';
import CancelItemModal from '../Modal/CancelItemModal';
import CancelHistoryModal from '../Modal/CancelHistoryModal';


interface ImageMetadata extends Record<string, Json> {
    name: string;
    type: string;
    size: number;
    path: string;
}

interface SelectedItem {
    max_level: number;
    description: string;
    id: string;
    item_code: string;
    item_name: string;
    quantity: number;
    selected_store_stock: number;
    other_stores_stock: number;
    image: Json | null;
    is_temporary?: boolean;
    issued_qty?: number;
    remaining_qty?: number;
    status?: string;
    issue_history?: any[];
    cancel_history?: any[];
    cancelled_qty?: number;
    source_locations?: any[];
}

// const toImageString = (value: Json | null | undefined): string | null =>
//     typeof value === 'string' ? value : null;

interface ApprovalStatus {
    rejectedTo: string | null;
    next_approver: string;
    status: string;
    trail: string;
    sequence_no: number;
    isFinalized: boolean;
    approvedBy: string;
    date: string;
    comment: string;
    role_id: string;
}

type ApprovalStatusDraft = ApprovalStatus | PendingApproval;

interface PendingApproval {
    status: string;
    trail: string;
    role_id: string;
    sequence_no: number;
    isFinalized: false;
}

type CategoryType = "internal" | "external";

export const requisitionSchema = z.object({
    requisitionNumber: z.string().min(1, "Requisition number is required"),
    required_by_date: z.string().optional().nullable(),
    status: z.string().min(1, "Status is required"),
    store_id: z.string().min(1, "Store is required"),

    category_type: z.enum(["internal", "external"], {
        required_error: "Category type is required"
    }),

    workflow_id: z.string().nullable().optional(),
    next_level_role_id: z.string().nullable().optional(),
    requisition_items: z
        .array(
            z.object({
                id: z.string().optional(), // for edit mode
                item_id: z.string().min(1, "Item is required"),
                quantity: z.number().min(1, "Quantity must be at least 1"),
            })
        )
        .min(1, "At least one item is required"),
});

export type RequisitionFormValues = z.infer<typeof requisitionSchema>;

interface StoreOption {
    id: string;
    name: string;
}

interface ItemImageData {
    image_1?: ImageMetadata | null;
    image_2?: ImageMetadata | null;
}

const PurchaseRequisitionForm: React.FC = () => {
    const location = useLocation();
    const { id } = useParams();
    const isEditMode = Boolean(id) && location.pathname.includes('edit');
    const isViewMode = Boolean(id) && location.pathname.includes('view');
const activeTab = location.state?.activeTab;
const fromPurchaseRequisition = location.state?.fromPurchaseRequisition;
    const navigate = useNavigate();
    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;
    const userId = userData?.id;
    const departmentId = userData?.department_id;

    const [imageModalItemId, setImageModalItemId] = useState("");
    const [currentImageItem, setCurrentImageItem] = useState<SelectedItem | null>(null);
    const [tempModalItemId, setTempModalItemId] = useState("");
    const [replaceModalItemId, setReplaceModalItemId] = useState("");
    const [quantity, setQuantity] = useState<number>(1);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState<number>(1);
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const [pendingStoreId, setPendingStoreId] = useState<string | null>(null);

    const [showCreateItemDialog, setShowCreateItemDialog] = useState(false);

    const [creatingItem, setCreatingItem] = useState(false);

    const [newItemData, setNewItemData] = useState({
        item_name: "",
        description: "",
        category_id: ""
    });
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [filteredItems, setFilteredItems] = useState<ItemManagement[]>([])
    const [isItemSelected, setIsItemSelected] = useState(false)
    const [workflowConfig, setWorkflowConfig] = useState<IWorkflowConfig | null>(null)
    const [systemMsgConfig, setSystemMsgConfig] = useState<ISystemMessageConfig[]>([])
    const [selectedItemIdForDetails, setSelectedItemIdForDetails] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [allApprovalStatus, setAllApprovalStatus] = useState<ApprovalStatus[]>([]);
    const [stores, setStores] = useState<StoreOption[]>([]);
    const originalDepartmentId = useRef<string | null>(null);
    const [selectedCategoryType, setSelectedCategoryType] = useState<"internal" | "external" | "">("");
    const [selectedItemData, setSelectedItemData] = useState<ItemManagement | null>(null);
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
    const [modulePermissions, setModulePermissions] = useState<any[]>([]);
    const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<ItemImageData | null>(null);
    const [selectedImages, setSelectedImages] = useState({
        image1: null as string | null,
        image2: null as string | null,
    });
    const [image1File, setImage1File] = useState<File | null>(null);
    const [image2File, setImage2File] = useState<File | null>(null);
    const [isStockTransferOpen, setIsStockTransferOpen] = useState(false);
    const [isStockIssueOpen, setIsStockIssueOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
    const [isScanQROpen, setIsScanQROpen] = useState(false);
    const [isConfirmIssueOpen, setIsConfirmIssueOpen] = useState(false);
    const [issuingQtysState, setIssuingQtysState] = useState<Record<string, number>>({});
    const [isCancelItemModalOpen, setIsCancelItemModalOpen] = useState(false);
    const [cancelModalItemId, setCancelModalItemId] = useState("");
    const [cancelModalItemName, setCancelModalItemName] = useState("");
    const [scannedUser, setScannedUser] = useState<any>(null);
    const [isCancelHistoryModalOpen, setIsCancelHistoryModalOpen] = useState(false);
    const [selectedCancelHistory, setSelectedCancelHistory] = useState<any[]>([]);
    const [prStatus, setPRStatus] = useState<string | null>(null);
    const [moduleId, setModuleId] = useState<string | null>(null);
const [actionId, setActionId] = useState<string | null>(null);



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

useEffect(()=>{
fetchModuleAndActionIds();
},[])

useEffect(() => {
  console.log("Workflow userId", userId);
  console.log("userData", userData);
}, [userId]);

    useEffect(() => {
        console.log("Selected Images =>", selectedImages);
    }, [selectedImages]);

    useEffect(() => {
        console.log("Image1 File =>", image1File);
    }, [image1File]);

    useEffect(() => {
        console.log("Image2 File =>", image2File);
    }, [image2File]);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState,
        formState: { errors, isSubmitting },
    } = useForm<RequisitionFormValues>({
        resolver: zodResolver(requisitionSchema),
        defaultValues: {
            requisitionNumber: "",
            required_by_date: null,
            status: "",
            requisition_items: [],
            store_id: "",
            workflow_id: null,
            next_level_role_id: null,
        },
    });

    const statusRejected = systemMsgConfig.find(config => config.sub_category_id === "REJECTED");
    const statusApproved = systemMsgConfig.find(config => config.sub_category_id === "APPROVED");
    const statusNewPR = systemMsgConfig.find(config => config.sub_category_id === "NEW");
    const statusClosed = systemMsgConfig.find(config => config.sub_category_id === "CLOSED");
    const watchedStoreId = watch("store_id");
    console.log("Store ID:", watchedStoreId);
    const watchedFields = watch();
    const isApprovedPR = watchedFields.status === statusApproved?.id;

    function generatePRNumber(lastNumber = 1): string {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);

        const serial = String(lastNumber).padStart(4, '0');

        return `PR-${dd}${mm}${yy}-${serial}`;
    }

    useEffect(() => {
        const fetchAndSetNextPRNumber = async () => {
            if (isEditMode || isViewMode) return;
            if (!companyId) return;

            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yy = String(now.getFullYear()).slice(-2);

            const todayPrefix = `PR-${dd}${mm}${yy}-`;

            const { data, error } = await supabase
                .from('purchase_req_master')
                .select('purchase_req_number')
                .eq('company_id', companyId)
                .like('purchase_req_number', `${todayPrefix}%`)
                .order('purchase_req_number', { ascending: false })
                .limit(1);

            let nextSerial = 1;

            if (!error && data?.length && data[0]?.purchase_req_number) {
                const match = data[0].purchase_req_number.match(/-(\d{4})$/);
                if (match) {
                    nextSerial = parseInt(match[1], 10) + 1;
                }
            }

            setValue('requisitionNumber', generatePRNumber(nextSerial));
        };

        fetchAndSetNextPRNumber();
    }, [isEditMode, isViewMode, companyId, setValue]);

    useEffect(() => {
        if (!companyId || !selectedCategoryType) {
            return;
        }

        const userData = JSON.parse(localStorage.getItem("userData") || "{}");

        const fetchStores = async () => {

            const { data:userStore, error:storeError } = await supabase
  .from("user_mgmt")
  .select("*")
  .eq("id", userData.id)
  .single();

  if(storeError){
    console.log("Error fetching user error",storeError)
  }

  const storesJson = (userStore as any)?.stores;
   const storeIds: string[] = storesJson || [];
  console.log("userStores",storeIds)
  
            let query = supabase
                .from("store_mgmt")
                .select("id, name")
                .eq("company_id", companyId)
                .eq("is_active", true)
                .eq("direct_purchase_allowed", true);

            if (!isViewMode) {
                query = query.in("id", storeIds);
            }

            if (selectedCategoryType === "internal") {
                query = query.eq("internal", true);
            }

            if (selectedCategoryType === "external") {
                query = query.eq("external", true);
            }

            const { data, error } = await query;

            if (!error && data) {
                setStores(data);

                if ((isEditMode || isViewMode) && id) {
                    const existingStoreId = watch("store_id");
                    console.log("fetchStores existingStoreId:", existingStoreId);

                    if (!existingStoreId) {
                        // get store from PR master
                        const { data: pr } = await supabase
                            .from("purchase_req_master")
                            .select(`store_id,
                                system_message_config!purchase_req_master_status_fkey (id,category_id,sub_category_id)`)
                            .eq("id", id)
                            .single();

                            console.log("Fetched PR for store_id", pr);
                            setPRStatus(pr?.system_message_config?.sub_category_id? pr.system_message_config.sub_category_id : null);

                        if (pr?.store_id) {
                            setValue("store_id", pr.store_id, {
                                shouldValidate: true,
                            });
                        }
                    }
                }
            }
        };

        const fetchCategories = async () => {
            try {
                const { data, error } = await supabase
                    .from("category_master")
                    .select("*")
                    .order("name", { ascending: true });

                if (error) throw error;
                console.log("Fetched Categories", data)
                setCategories(data || []);
            } catch (err) {
                console.error("Error fetching categories:", err);
            }
        };
        fetchCategories()
        fetchStores();

    }, [companyId, selectedCategoryType]);

    // Ensure store_id sticks in pending view
    useEffect(() => {
        if (isViewMode && id === 'pending' && pendingStoreId) {
            const currentStoreId = watch("store_id");
            if (currentStoreId !== pendingStoreId) {
                console.log("Forcing store_id to pendingStoreId:", pendingStoreId);
                setValue("store_id", pendingStoreId, { shouldValidate: true });
            }
        }
    }, [isViewMode, id, pendingStoreId, watch, setValue]);

    // Item search
    useEffect(() => {
        if (isItemSelected || !itemSearchTerm.trim() || itemSearchTerm.length < 3 || !selectedCategoryType || !watchedStoreId) {
            setFilteredItems([]);
            setShowItemDropdown(false);
            return;
        }

        const fetchItems = async () => {
            try {
                const selectedItemsIds = selectedItems.map(item => item.id);

                const { data, error } = await supabase
                    .from("item_mgmt")
                    .select("*")
                    .eq("company_id", companyId!)
                    .eq("is_active", true)
                    .eq("category_type", selectedCategoryType)
                    .or(`item_name.ilike.%${itemSearchTerm}%,item_id.ilike.%${itemSearchTerm}%`)
                    .limit(10);

                if (error) throw error;

                const filtered = (data || []).filter(
                    item => !selectedItemsIds.includes(item.id)
                );

                setFilteredItems(filtered);
                setShowItemDropdown(true);
            } catch (err) {
                console.error("Unexpected error in fetchItems:", err);
                toast.error("An unexpected error occurred");
            }
        };

        fetchItems();
    }, [itemSearchTerm, selectedCategoryType, selectedItems, watchedStoreId]);

    // Fetch Purchase Requisition and Items
    useEffect(() => {
        if ((!isEditMode && !isViewMode) || !id || !companyId) return;

        const fetchPurchaseRequisition = async () => {
            try {
                if (id === 'pending') {
                    const searchParams = new URLSearchParams(window.location.search);
                    const requestId = searchParams.get('request_id');
                    if (!requestId) {
                        toast.error("No request ID provided");
                        return;
                    }

                    const { data: requestData, error: requestError } = await supabase
                        .from('approval_requests')
                        .select('*')
                        .eq('id', requestId)
                        .single();

                    if (requestError) throw requestError;

                    let parsedPayload: any = requestData.payload;
                    if (typeof parsedPayload === 'string') {
                        try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
                    }
                    const operations = parsedPayload?.operations || [];

                    const prOp = operations.find((op: any) => op.table === 'purchase_req_master' && (op.type === 'insert' || op.type === 'update'));
                    const itemOps = operations.filter((op: any) => op.table === 'purchase_req_details');

                    if (prOp) {
                        const parsedPrData = prOp.data || {};
                        setValue("requisitionNumber", parsedPrData.purchase_req_number === '{{pr_number}}' ? 'Pending' : parsedPrData.purchase_req_number);
                        setValue("required_by_date", parsedPrData.required_by_date ? new Date(parsedPrData.required_by_date).toISOString().split("T")[0] : null);
                        setValue("status", requestData.status);
                        console.log("fetchPurchaseRequisition setting store_id:", parsedPrData.store_id);
                        setValue("store_id", parsedPrData.store_id, { shouldValidate: true });
                        setPendingStoreId(parsedPrData.store_id);
                        console.log("fetchPurchaseRequisition setting category_type:", parsedPrData.category_type);
                        
                        const categoryType = parsedPrData.category_type as CategoryType || 'internal';
                        setSelectedCategoryType(categoryType);
                        setValue("category_type", categoryType, { shouldValidate: true });
                        setValue("workflow_id", (requestData.workflow_snapshot as any)?.workflow_id || null);
                        if (parsedPrData.department_id) {
                             originalDepartmentId.current = parsedPrData.department_id;
                        }

                        const itemsArray = itemOps.flatMap((op: any) => Array.isArray(op.data) ? op.data : [op.data]);
                        const itemIds = itemsArray.map((d: any) => d.item_id).filter(Boolean);

                        const { data: itemsMeta } = await supabase.from('item_mgmt').select('id, item_id, item_name, description, max_level, is_temporary, image').in('id', itemIds);

                        const mappedItems: SelectedItem[] = itemsArray.map((item: any) => {
                             const meta = itemsMeta?.find(m => m.id === item.item_id);
                             return {
                                 id: item.item_id,
                                 item_code: meta?.item_id || "",
                                 item_name: meta?.item_name || "",
                                 description: meta?.description || "",
                                 max_level: meta?.max_level || 0,
                                 is_temporary: meta?.is_temporary || false,
                                 quantity: item.req_qty || 0,
                                 issued_qty: 0,
                                 remaining_qty: item.req_qty || 0,
                                 status: 'Pending',
                                 issue_history: [],
                                 cancel_history: [],
                                 cancelled_qty: 0,
                                 source_locations: [],
                                 selected_store_stock: 0,
                                 other_stores_stock: 0,
                                 image: meta?.image
                             };
                        });

                        setSelectedItems(mappedItems);
                        setValue("requisition_items", mappedItems.map(item => ({ item_id: item.id, quantity: item.quantity })), { shouldValidate: true });
                    }
                    return;
                }

                // Fetch Purchase Requisition
                const { data: prData, error: prError } = await supabase
                    .from('purchase_req_master')
                    .select(`*, 
                        category_master!purchase_req_master_category_id_fkey (*)`)
                    .eq('company_id', companyId)
                    .eq('id', id)
                    .single();

                if (prError) throw prError;
                if (!prData) return;

                setValue("requisitionNumber", prData.purchase_req_number);
                setValue(
                    "required_by_date",
                    prData.required_by_date
                        ? new Date(prData.required_by_date).toISOString().split("T")[0]
                        : null
                );
                setValue("status", prData.status ?? '');
                // Set category type FIRST
                const categoryType = prData.category_type as CategoryType;

                setSelectedCategoryType(categoryType);
                setValue("category_type", categoryType, {
                    shouldValidate: true,
                });
                setValue("workflow_id", prData.workflow_id);
                setValue("next_level_role_id", prData.next_level_role_id);
                originalDepartmentId.current = prData.department_id;
                setValue("category_type", categoryType);
                setSelectedCategoryType(categoryType);

                const approvalStatus = prData.approval_status as unknown as ApprovalStatus[];
                setAllApprovalStatus(approvalStatus);

                // Fetch Purchase Requisition Items
                const { data: prItemsData, error: prItemsError } = await supabase
                    .from('purchase_req_details')
                    .select(`
                    id,
                    item_id,
                    req_qty,
                    issued_qty,
                    remaining_qty,
                    status,
                    issue_history,
                    cancel_history,
                    cancelled_qty,
                    source_locations,
                    item_mgmt (
                        id,
                        item_id,
                        item_name,
                        description,
                        max_level,
                        is_temporary,
                        image
                    )
                `)
                    .eq('company_id', companyId)
                    .eq('purchase_req_id', id);

                console.log("Fetched pr Items", prItemsData);


                if (prItemsError) throw prItemsError;

                const mappedItems: SelectedItem[] = (prItemsData || []).map((item) => ({
                    id: item.item_id,
                    item_code: item.item_mgmt?.item_id || "",
                    item_name: item.item_mgmt?.item_name || "",
                    description: item.item_mgmt?.description || "",
                    max_level: item.item_mgmt?.max_level ?? 0,
                    is_temporary: item.item_mgmt?.is_temporary ?? false,
                    quantity: item.req_qty ?? 0,
                    issued_qty: item.issued_qty ?? 0,
                    remaining_qty: item.remaining_qty ?? item.req_qty ?? 0,
                    status: item.status ?? 'Pending',
                    issue_history: Array.isArray(item.issue_history) ? (item.issue_history as any[]) : [],
                    cancel_history: Array.isArray(item.cancel_history) ? (item.cancel_history as any[]) : [],
                    cancelled_qty: item.cancelled_qty ?? 0,
                    source_locations: Array.isArray(item.source_locations) ? (item.source_locations as any[]) : [],
                    selected_store_stock: 0,
                    other_stores_stock: 0,
                    image: item.item_mgmt?.image,
                }));

                setSelectedItems(mappedItems);
                console.log("Mapped Items", mappedItems);
                setValue(
                    "requisition_items",
                    mappedItems.map((item) => ({
                        item_id: item.id,
                        quantity: item.quantity,
                    })),
                    { shouldValidate: true }
                );

            } catch (error: any) {
                console.error("Failed to fetch purchase requisition:", error);
                toast.error(`Failed to load PR data: ${error?.message || 'Unknown error'}`);
            }
        };

        fetchPurchaseRequisition();
    }, [isEditMode, isViewMode, id, companyId, setValue]);

    // Fetch workflow configs
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



    // System Message Config
    useEffect(() => {
        const fetchSystemMessageConfig = async () => {
            if (!companyId) return;

            try {
                const { data, error } = await supabase
                    .from('system_message_config')
                    .select('*')
                    .eq("company_id", companyId)
                    .eq("category_id", 'PURCHASE_REQUISITION');

                if (error) throw error;

                if (data.length > 0) {
                    setSystemMsgConfig(data);
                    const statusNewPR = data.find(config => config.sub_category_id === "NEW");
                    const statusApproved = data.find(config => config.sub_category_id === "APPROVED");
                    const statusClosed = data.find(config => config.sub_category_id === "CLOSED");

                    if (!statusNewPR || !statusApproved || !statusClosed) {
                        console.error('Missing ORDER_CREATED, APPROVAL_PENDING or APPROVER_COMPLETED in system_message_config');
                        toast.error('Status configuration is incomplete', { position: "top-center" });
                        return;
                    }

                    if (!isEditMode && !isViewMode) {
                        const defaultStatusId = workflowConfig ? statusNewPR.id : statusApproved.id;
                        setValue("status", defaultStatusId);
                    }
                } else {
                    console.error('No system message config found for PURCHASE_ORDER');
                    toast.error('Failed to load status configuration', { position: "top-center" });
                }
            } catch (error) {
                console.error('Error fetching system message config:', error);
                toast.error('Failed to fetch status configuration', { position: "top-center" });
            }
        };

        fetchSystemMessageConfig();
    }, [setValue, workflowConfig, companyId, isEditMode, isViewMode]);

    useEffect(() => {
        const formattedItems = selectedItems.map(item => ({
            item_id: item.id,
            quantity: item.quantity,
        }));

        setValue("requisition_items", formattedItems, {
            shouldValidate: true,
        });
    }, [selectedItems, setValue]);

    useEffect(() => {
        if (!watchedStoreId) return;

        const refreshStocks = async () => {
            const updatedItems = await Promise.all(
                selectedItems.map(async (item) => {
                    const { selectedStock, otherStock } = await fetchItemStock(item.id);
                    return {
                        ...item,
                        selected_store_stock: selectedStock,
                        other_stores_stock: otherStock,
                    };
                })
            );

            setSelectedItems(updatedItems);
        };

        refreshStocks();
    }, [watchedStoreId]);

    const validateAndFixPRNumber = async (
        prNumber: string
    ): Promise<string> => {
        if (!companyId) return prNumber;

        try {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yy = String(now.getFullYear()).slice(-2);

            const todayPrefix = `PR-${dd}${mm}${yy}-`;

            // Extract serial from provided PR number
            const match = prNumber.match(/-(\d{4})$/);
            const currentSerial = match ? parseInt(match[1], 10) : 1;

            // Fetch today's PRs
            const { data, error } = await supabase
                .from('purchase_req_master')
                .select('purchase_req_number')
                .eq('company_id', companyId)
                .like('purchase_req_number', `${todayPrefix}%`);

            if (error) throw error;

            const existingSerials =
                data
                    ?.map((row: { purchase_req_number: string | null }) => {
                        if (!row.purchase_req_number) return 0;
                        const m = row.purchase_req_number.match(/-(\d{4})$/);
                        return m ? parseInt(m[1], 10) : 0;
                    })
                    .filter(n => !isNaN(n)) ?? [];

            const nextSerial =
                existingSerials.length > 0
                    ? Math.max(...existingSerials) + 1
                    : 1;

            const finalSerial = existingSerials.includes(currentSerial)
                ? nextSerial
                : currentSerial;

            return generatePRNumber(finalSerial);

        } catch (err) {
            console.error('PR number validation failed:', err);
            return prNumber;
        }
    };

    const fetchItemStock = async (
        itemId: string
    ): Promise<{ selectedStock: number; otherStock: number }> => {

        if (!companyId || !watchedStoreId) {
            return { selectedStock: 0, otherStock: 0 };
        }

        try {
            const { data, error } = await supabase.rpc(
                "get_item_stock_store_summary",
                {
                    p_company_id: companyId,
                    p_item_id: itemId,
                    p_selected_store_id: watchedStoreId
                }
            );

            if (error) {
                console.error("Stock fetch error:", error);
                return { selectedStock: 0, otherStock: 0 };
            }

            let selectedStock = 0;
            let otherStock = 0;

            data?.forEach((row: any) => {
                if (row.is_selected_store) {
                    selectedStock = Number(row.total_stock);
                } else {
                    otherStock += Number(row.total_stock);
                }
            });

            return { selectedStock, otherStock };

        } catch (error) {
            console.error('Error fetching item stock', error);
            return { selectedStock: 0, otherStock: 0 };
        }
    };

    const handleAddItem = async () => {
        if (!selectedItemId) {
            toast.error("Please search and select an item");
            return;
        }

        if (!watchedStoreId) {
            toast.error("Please select a store first");
            return;
        }

        if (!selectedItemData) {
            toast.error("Please select an item from the list");
            return;
        }

        const item = selectedItemData;

        if (selectedItems.some(i => i.id === item.id)) {
            toast.error("This item is already added");
            return;
        }

        // Fetch stock before adding
        const stock = await fetchItemStock(item.id);
        const selectedStock = stock?.selectedStock ?? 0;
        const otherStock = stock?.otherStock ?? 0;

        setSelectedItems(prev => [
            ...prev,
            {
                id: item.id,
                item_code: item.item_id ?? '',
                item_name: item.item_name,
                description: item.description ?? "",
                max_level: item.max_level ?? 0,
                quantity,
                selected_store_stock: selectedStock,
                other_stores_stock: otherStock,
                image: item.image,
            }
        ]);

        setSelectedItemId("");
        setItemSearchTerm("");
        setQuantity(1);
        setSelectedItemData(null);
    };

    const handleCreateNewItem = async () => {
        try {
            setCreatingItem(true);
            const generateTempItemId = () => {
                return `TEMP-${Date.now().toString().slice(-6)}`;
            };

            if (!newItemData.item_name || !newItemData.description || !newItemData.category_id) {
                toast.error("Please fill in all required fields");
                return;
            }

            const payload = {
                company_id: companyId,
                item_name: newItemData.item_name,
                description: newItemData.description,
                category_type: selectedCategoryType,
                category_id: newItemData.category_id,
                item_id: generateTempItemId(),
                is_temporary: true,

                is_active: true,
            };

            const { data, error } = await supabase
                .from("item_mgmt")
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            toast.success("Temporary item created");

            // Auto-select newly created item
            setSelectedItemId(data.id);
            setSelectedItemData(data);

            setItemSearchTerm(
                `${data.item_id} — ${data.item_name}`
            );

            setIsItemSelected(true);

            setShowCreateItemDialog(false);
            setShowItemDropdown(false);

            // Reset form
            setNewItemData({
                item_name: "",
                description: "",
                category_id: "",
            });

        } catch (err) {
            console.error(err);
            toast.error("Failed to create item");
        } finally {
            setCreatingItem(false);
        }
    };

    const handleDeleteItem = () => {
        setSelectedItems(prev => prev.filter(item => item.id !== itemToDelete));
        setShowDeleteDialog(false);
        setItemToDelete(null);
    };

    const handleEditStart = (item: SelectedItem) => {
        setEditingItemId(item.id);
        setEditQuantity(item.quantity);
    };

    const handleEditSave = () => {
        const item = selectedItems.find(i => i.id === editingItemId);
        if (!item) return;

        const minAllowed = isApprovedPR ? item.quantity : 1;
        if (editQuantity < minAllowed) {
            toast.error(`Quantity must be at least ${minAllowed}`, { position: "top-center" });
            return;
        }

        setSelectedItems(prev => prev.map(i => {
            if (i.id === editingItemId) {
                return { ...i, quantity: editQuantity };
            }
            return i;
        }));
        setEditingItemId(null);
    };

    const handleEditCancel = () => {
        setEditingItemId(null);
    };

    const handleCancelItemSubmit = async (cancelQty: number, reason: string) => {
        if (!userId) {
            toast.error("User not identified");
            return;
        }

        if (!id) {
            toast.error("Requisition ID not found");
            return;
        }

        const item = selectedItems.find(i => i.id === cancelModalItemId);
        if (!item) return;

        // 1. Calculate new cancellation state
        const currentCancelHistory = item.cancel_history || [];
        const cancelEntry = {
            date: new Date().toISOString(),
            quantity: cancelQty,
            reason,
            cancelled_by: userId
        };
        const newCancelHistory = [...currentCancelHistory, cancelEntry];

        const currentCancelledQty = item.cancelled_qty || 0;
        const newCancelledQty = currentCancelledQty + cancelQty;
        const issuedQty = item.issued_qty || 0;
        const newRemainingQty = Math.max(0, item.quantity - issuedQty - newCancelledQty);

        // 2. Calculate new status
        let newStatus = item.status || 'Pending';
        if (issuedQty === 0 && newCancelledQty >= item.quantity) {
            newStatus = 'Cancelled';
        } else if (issuedQty > 0 && (issuedQty + newCancelledQty) >= item.quantity) {
            newStatus = 'Issued';
        }

        // 3. Update database
        try {
            const { error } = await supabase
                .from('purchase_req_details')
                .update({
                    remaining_qty: newRemainingQty,
                    status: newStatus,
                    cancel_history: newCancelHistory as any,
                    cancelled_qty: newCancelledQty
                })
                .eq('purchase_req_id', id)
                .eq('item_id', item.id);

            if (error) throw error;

            // 4. Update local state
            setSelectedItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    return {
                        ...i,
                        remaining_qty: newRemainingQty,
                        status: newStatus,
                        cancel_history: newCancelHistory,
                        cancelled_qty: newCancelledQty
                    };
                }
                return i;
            }));

            // Check whether this item was partially issued


if (issuedQty > 0 && issuedQty < item.quantity) {
    const { error: reqError } = await supabase
        .from("purchase_req_master")
        .update({
            status: "00147a13-c194-4f59-884a-74bdde466685"
        })
        .eq("id", id);

    if (reqError) throw reqError;

   
    const { data } = await supabase
        .from("purchase_req_master")
        .select("status")
        .eq("id", id)
        .single();

    console.log("Status after cancel:", data?.status);
}
            toast.success("Item cancelled successfully");
        } catch (error) {
            console.error("Failed to cancel item:", error);
            toast.error("Failed to cancel item");
        }
    };

    const handleCancel = () => {
        if (selectedItems.length > 0) {
            setShowCancelDialog(true);
        } else {
            navigate("/dashboard/purchaseRequisitions",{state: { activeTab}});
        }
    };

    const confirmCancel = () => {
        setShowCancelDialog(false);
        navigate("/dashboard/purchaseRequisitions",{state: { activeTab}});
    };

    const validateWorkflowApprovers = async (): Promise<boolean> => {
        try {
            const prDepartment = isEditMode ? originalDepartmentId.current : departmentId;
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
    p_module_key: "Purchase Requisitions",
    p_action_name: "Add",
    p_assigned_to: userId,
  }
);

console.log("Workflow Levels:", data);
console.log("Workflow Error:", error);
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

    const convertAvifToJpeg = async (file: File) => {
        return new Promise<File>((resolve) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement("canvas");

                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext("2d");

                if (!ctx) return;

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (!blob) return;

                    resolve(
                        new File([blob], `${Date.now()}.jpg`, {
                            type: "image/jpeg",
                        })
                    );
                }, "image/jpeg", 0.9);
            };

            img.src = URL.createObjectURL(file);
        });
    };

    // Submit PR form
    const onSubmit = async (data: RequisitionFormValues) => {
        if (isEditMode && id) {
            const isLocked = await checkEntityLock(id);
            if (isLocked) {
                toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
                return;
            }
        }

        console.log("Image1 File =>", image1File);
        console.log("Image1 Type =>", image1File?.type);

        console.log("Image2 File =>", image2File);
        console.log("Image2 Type =>", image2File?.type);



        const isWorkflowValid = await validateWorkflowApprovers();
        if (!isWorkflowValid) return;

        try {
            const currentTime = getLocalDateTime();
            const lastApproval = allApprovalStatus?.at(-1);
            const isNewPR = !isEditMode;
            const isResubmitted = !!isEditMode && data.status === statusRejected?.id && !data.workflow_id && lastApproval?.trail === "Rejected";

            let workflowId = data.workflow_id ?? null;
            let nextRoleId = data.next_level_role_id ?? null;
            let approvalStatusToSave: ApprovalStatusDraft[] = allApprovalStatus ?? [];

            // Create approval status
            if (workflowConfig && (isNewPR || isResubmitted)) {

                approvalStatusToSave = [
                    ...approvalStatusToSave,
                    {
                        status: `Level ${workflowConfig.level} approval pending`,
                        trail: "Pending",
                        role_id: workflowConfig.role_id,
                        sequence_no: approvalStatusToSave.length,
                        isFinalized: false,
                    },
                ];

                workflowId = workflowConfig.id;
                nextRoleId = workflowConfig.role_id;
            }

            let finalPRNumber = data.requisitionNumber;
            if (!isEditMode) {
                finalPRNumber = await validateAndFixPRNumber(data.requisitionNumber);
            }

            let reqStatus: string = data.status;

            if (!statusNewPR?.id) throw new Error("Missing New status configuration");
            if (!statusApproved?.id) throw new Error("Missing Approved status configuration");
            if (!statusClosed?.id) throw new Error("Missing Closed status configuration");

            if (isNewPR || isResubmitted) {
                reqStatus = statusApproved.id;
            }

            const CLOSED_STATUS_ID = statusClosed.id;

            if (isEditMode && id) {
                const { data: reqDetails } = await supabase
                    .from("purchase_req_details")
                    .select("*")
                    .eq("purchase_req_id", id);

                const hasPartiallyIssuedItems = reqDetails?.some(
                    item =>
                        (item.issued_qty || 0) > 0 &&
                        (item.issued_qty || 0) < (item.req_qty || 0)
                );

                if (hasPartiallyIssuedItems) {
                    reqStatus = CLOSED_STATUS_ID;
                }
            }


console.log("Final Status:", reqStatus);


            const purchaseReqPayload = {
                purchase_req_number: finalPRNumber,
                required_by_date: data.required_by_date || null,
                status: reqStatus,
                total_items: data.requisition_items.length,
                company_id: companyId ?? '',
                approval_status: null,
                workflow_id: null,
                next_level_role_id: null,
                store_id: data.store_id,
                department_id: isNewPR ? departmentId : originalDepartmentId.current,
                category_type: data.category_type,

                
            };

            // 1. Handle File Uploads first so we have the paths
            let itemImageMetaData: any = null;


            if (currentImageItem) {
                const { data: itemData, error: fetchError } = await supabase
                    .from("item_mgmt")
                    .select("image")
                    .eq("id", currentImageItem.id)
                    .single();

                if (fetchError) throw fetchError;

                console.log("Existing Image Metadata:", itemData?.image);

                itemImageMetaData = itemData;
            }

            const existingImageMetadata = (itemImageMetaData?.image as {
                image_1?: ImageMetadata;
                image_2?: ImageMetadata;
            } | null) ?? null;


            let image_1 = existingImageMetadata?.image_1 ?? null;
            let image_2 = existingImageMetadata?.image_2 ?? null;


            if (image1File instanceof File) {

                if (existingImageMetadata?.image_1?.path) {
                    await supabase.storage.from("item-images").remove([existingImageMetadata.image_1.path]);
                }

                let fileToUpload = image1File;

                if (image1File.type === "image/avif") {
                    fileToUpload = await convertAvifToJpeg(image1File);
                }

                const fileExt = fileToUpload.name.split(".").pop() || "jpg";
                const fileName = `${currentImageItem?.item_code}_image1_${Date.now()}.${fileExt}`;
                const filePath = `${currentImageItem?.item_code}/${fileName}`;

                const { error } = await supabase.storage.from("item-images").upload(filePath, fileToUpload, { contentType: fileToUpload.type });
                if (error) throw error;

                image_1 = { name: fileToUpload.name, type: fileToUpload.type, size: fileToUpload.size, path: filePath };
            }


            if (image2File instanceof File) {

                if (existingImageMetadata?.image_2?.path) {
                    await supabase.storage.from("item-images").remove([existingImageMetadata.image_2.path]);
                }

                let fileToUpload = image2File;

                if (image2File.type === "image/avif") {
                    fileToUpload = await convertAvifToJpeg(image2File);
                }

                const fileExt = fileToUpload.name.split(".").pop() || "jpg";
                const fileName = `${currentImageItem?.item_code}_image2_${Date.now()}.${fileExt}`;
                const filePath = `${currentImageItem?.item_code}/${fileName}`;

                const { error } = await supabase.storage.from("item-images").upload(filePath, fileToUpload, { contentType: fileToUpload.type });
                if (error) throw error;

                image_2 = { name: fileToUpload.name, type: fileToUpload.type, size: fileToUpload.size, path: filePath };
            }

            const imageData = { image_1, image_2 };

            // 2. Build Approval Framework Payload
            const operations: any[] = [];
            let requisitionId = isEditMode ? id! : '{{pr_id}}';

            if (isEditMode && id) {
                operations.push({
                   table: 'purchase_req_master',
                   type: 'update',
                   data: purchaseReqPayload,
                   match: { id: id }
                });
                operations.push({
                   table: 'purchase_req_details',
                   type: 'delete',
                   match: { purchase_req_id: id }
                });
                operations.push({
                   table: 'system_log',
                   type: 'insert',
                   data: {
                       company_id: companyId,
                       transaction_date: new Date().toISOString(),
                       module: 'Purchase Requisition',
                       scope: 'Edit',
                       key: finalPRNumber,
                       log: `Purchase Requisition ${finalPRNumber} updated.`,
                       action_by: userId,
                       created_at: new Date().toISOString(),
                   }
                });
            } else {
                const now = new Date();
                const dd = String(now.getDate()).padStart(2, '0');
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const yy = String(now.getFullYear()).slice(-2);
                const todayPrefix = `PR-${dd}${mm}${yy}-`;

                operations.push({
                   type: 'generate_sequence',
                   table: 'purchase_req_master',
                   column: 'purchase_req_number',
                   prefix: todayPrefix,
                   padding: 4,
                   start_sequence: 1,
                   return_id_as: 'pr_number'
                });
                
                operations.push({
                   table: 'purchase_req_master',
                   type: 'insert',
                   data: {
                       ...purchaseReqPayload,
                       purchase_req_number: '{{pr_number}}',
                       purchase_req_date: currentTime,
                       created_by: userId,
                       created_at: currentTime,
                   },
                   return_id_as: 'pr_id'
                });
                
                operations.push({
                   table: 'system_log',
                   type: 'insert',
                   data: {
                       company_id: companyId,
                       transaction_date: new Date().toISOString(),
                       module: 'Purchase Requisition',
                       scope: 'Add',
                       key: '{{pr_number}}',
                       log: `Purchase Requisition {{pr_number}} created.`,
                       action_by: userId,
                       created_at: new Date().toISOString(),
                   }
                });
            }

            const reqItemsPayload = data.requisition_items.map((formItem) => {
                const item = selectedItems.find(i => i.id === formItem.item_id) || {} as any;

                const issuedQty = item.issued_qty || 0;
                const cancelledQty = item.cancelled_qty || 0;

                const newRemainingQty = formItem.quantity - issuedQty - cancelledQty;
                
                let newStatus = item.status || 'Pending';
                if (newRemainingQty > 0) {
                    newStatus = issuedQty > 0 ? 'Partially Issued' : 'Pending';
                } else if (newRemainingQty <= 0) {
                    if (issuedQty > 0) newStatus = 'Issued';
                    else if (cancelledQty > 0) newStatus = 'Cancelled';
                }

                return {
                    company_id: companyId ?? '',
                    purchase_req_id: requisitionId,
                    item_id: formItem.item_id,
                    req_qty: formItem.quantity,
                    issued_qty: issuedQty,
                    remaining_qty: newRemainingQty,
                    status: newStatus,
                    issue_history: item.issue_history || [],
                    cancel_history: item.cancel_history || null,
                    cancelled_qty: cancelledQty,
                    source_locations: item.source_locations || null,
                    created_at: currentTime,
                };
            });

            operations.push({
               table: 'purchase_req_details',
               type: 'insert',
               data: reqItemsPayload
            });

            if (currentImageItem && (image1File instanceof File || image2File instanceof File)) {
                operations.push({
                   table: 'item_mgmt',
                   type: 'update',
                   data: { image: imageData },
                   match: { id: currentImageItem.id }
                });
            }

            const action_payload = {
               validations: [
                 {
                    type: 'exists',
                    table: 'department_master',
                    column: 'id',
                    value: isNewPR ? departmentId : originalDepartmentId.current
                 },
                 {
                    type: 'exists',
                    table: 'store_mgmt',
                    column: 'id',
                    value: data.store_id
                 }
               ],
               operations
            };

            const approvalResponse = await initiateApprovalRequest({
                module_name: 'Purchase Requisitions',
                action_name: isEditMode ? 'Edit' : 'Add',
                company_id: companyId ?? '',
                requested_by: userId ?? '',
                store_id: data.store_id,
                action_payload,
                entity_id: isEditMode ? id : null
            });
            
            if (approvalResponse?.success) {
                if (approvalResponse.requires_approval) {
                    toast.success('Your action has been submitted and is currently pending approval.');
                    navigate('/dashboard/purchaseRequisitions', { state: { activeTab } });
                } else {
                    // 3. Fallback for immediate execution (no approval needed)
                    let finalReqId = requisitionId;
                    let finalPrNumberFallback = finalPRNumber;
                    
                    if (!isEditMode) {
                        const { data: createdPR, error } = await supabase
                            .from('purchase_req_master')
                            .insert([{
                                ...purchaseReqPayload,
                                purchase_req_date: currentTime,
                                created_by: userId,
                                created_at: currentTime,
                            }])
                            .select()
                            .single();
                        if (error || !createdPR) throw error || new Error('Failed to create PR');
                        finalReqId = createdPR.id;
                        finalPrNumberFallback = createdPR.purchase_req_number;
                    } else {
                        const { error: prError } = await supabase.from("purchase_req_master").update(purchaseReqPayload).eq("id", id!);
                        if (prError) throw prError;
                        await supabase.from("purchase_req_details").delete().eq("purchase_req_id", id!);
                    }
                    
                    await supabase.from('system_log').insert({
                        company_id: companyId,
                        transaction_date: new Date().toISOString(),
                        module: 'Purchase Requisition',
                        scope: isEditMode ? 'Edit' : 'Add',
                        key: `${finalPrNumberFallback}`,
                        log: `Purchase Requisition ${finalPrNumberFallback} ${isEditMode ? 'updated' : 'created'}.`,
                        action_by: userId,
                        created_at: new Date().toISOString(),
                    });
                    
                    const finalItemsPayload = reqItemsPayload.map(item => ({ ...item, purchase_req_id: finalReqId }));
                    const { error: reqItemsError } = await supabase.from("purchase_req_details").insert(finalItemsPayload);
                    if (reqItemsError) throw reqItemsError;
                    
                    if (currentImageItem && (image1File instanceof File || image2File instanceof File)) {
                        const { error } = await supabase.from("item_mgmt").update({ image: imageData }).eq("id", currentImageItem.id);
                        if (error) throw error;
                    }
                    
                    toast.success((isEditMode && isResubmitted) ? 'Purchase Requisition resubmitted successfully!'
                        : isEditMode ? 'Purchase Requisition updated successfully!'
                            : 'Purchase Requisition created successfully!');
                    navigate('/dashboard/purchaseRequisitions', { state: { activeTab } });
                }
            } else {
                throw new Error(approvalResponse?.message || 'Approval initiation failed');
            }
        } catch (error: any) {
            console.error("Error processing purchase requisition:", error);
            toast.error(error.message || "Failed to process purchase requisition", { position: "top-center" });
        }
    };

    const ErrorMessage: React.FC<{ message?: string }> = ({ message }) => {
        if (!message) return null;
        return (
            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {message}
            </p>
        );
    };

    const selectableItems = selectedItems.filter(item => item.status !== 'Issued' && item.status !== 'Cancelled' && !item.is_temporary);
    const isAllSelected =
        selectableItems.length > 0 &&
        selectedRowIds.length === selectableItems.length;

    // const isIndeterminate =
    //     selectedRowIds.length > 0 &&
    //     selectedRowIds.length < selectableItems.length;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRowIds(selectableItems.map(item => item.id));
        } else {
            setSelectedRowIds([]);
        }
    };

    const handleRowSelect = (itemId: string, checked: boolean) => {
        if (checked) {
            setSelectedRowIds(prev => [...prev, itemId]);
        } else {
            setSelectedRowIds(prev =>
                prev.filter(id => id !== itemId)
            );
        }
    };

    const selectedRows = selectedItems.filter(item =>
        selectedRowIds.includes(item.id)
    );

    const selectedStoreName =
        stores.find(store => store.id === watchedStoreId)?.name || "";

    const isInternalCategory = watchedFields.category_type === "internal";
    const canStockIssue =
        isInternalCategory &&
        selectedRows.length > 0 &&
        selectedRows.every(item => item.selected_store_stock >= (item.remaining_qty ?? item.quantity));

    const stockIssueTooltip =
        !isInternalCategory
            ? "Stock issue allowed only for internal requisitions"
            : "Insufficient stock in selected store for one or more items";

    const canStockTransfer =
        selectedRows.length > 0 &&
        selectedRows.every(item => {
            const totalAvailable = item.selected_store_stock + item.other_stores_stock;
            const reqQty = item.remaining_qty ?? item.quantity;
            return (
                item.other_stores_stock > 0 &&
                totalAvailable >= reqQty
            );
        });

    const stockTransferTooltip = "Not enough stock available in other stores to fulfill required quantity";

    const getSelectedStoreStockColor = (item: SelectedItem) => {
        const reqQty = item.remaining_qty ?? item.quantity;
        return item.selected_store_stock >= reqQty
            ? "text-green-600"
            : "text-red-600";
    };

    const getOtherStoresStockColor = (item: SelectedItem) => {
        const reqQty = item.remaining_qty ?? item.quantity;

        // If selected store already has enough → black
        if (item.selected_store_stock >= reqQty) {
            return "text-gray-900";
        }

        const remainingRequired = reqQty - item.selected_store_stock;

        // If other stores can fulfill the remaining
        if (item.other_stores_stock >= remainingRequired) {
            return "text-green-600";
        }

        return "text-red-600";
    };


    useEffect(() => {
        const fetchPermissions = async () => {
            if (userData?.user_id) {
                const res = await loadModulePermissions(
                    appCode,
                    'Purchase Requisitions',
                    userData.user_id
                );

                if (res && res.permissions) {
                    setModulePermissions(res.permissions);
                }
            }
        };

        fetchPermissions();
    }, [userData?.user_id]);
    const hasPermission = (actionName: string) => {
        const perm = modulePermissions.find(
            (p: any) =>
                p.action_id?.actionName?.toLowerCase() ===
                actionName.toLowerCase()
        );

        return perm ? perm.isAllowed : false;
    };

    const handleIssueStockStart = (qtys: Record<string, number>) => {
        setIssuingQtysState(qtys);
        setIsStockIssueOpen(false);
        setIsScanQROpen(true);
    };

    const handleScanSuccess = async (scannedValue: string) => {
        try {
            const { data: user, error } = await supabase
                .from("user_mgmt")
                .select("id, first_name, last_name, employee_id, email, role_master(name)")
                .eq("id", scannedValue)
                .single();

            if (error || !user) {
                toast.error("Invalid QR code or user not found.");
                setIsScanQROpen(false);
                return;
            }

            setScannedUser(user);
            setIsScanQROpen(false);
            setIsConfirmIssueOpen(true);
        } catch (err) {
            console.error(err);
            toast.error("Error fetching user details.");
            setIsScanQROpen(false);
        }
    };

    const handleConfirmIssue = async () => {
        try {
            if (!id || !companyId || !userId) return;

            const storeId = watchedStoreId;
            if (!storeId) {
                toast.error("Store not selected for this requisition.");
                setIsConfirmIssueOpen(false);
                return;
            }

            // Build array of items to issue for the RPC payload
            const itemsToIssue: any[] = [];
            for (const [itemId, issueQty] of Object.entries(issuingQtysState)) {
                if (issueQty > 0) {
                    itemsToIssue.push({ item_id: itemId, issue_qty: issueQty });
                }
            }

            if (itemsToIssue.length === 0) {
                toast.error("No valid quantities to issue.");
                return;
            }

            const operations = [{
                type: 'rpc',
                rpc_name: 'process_stock_issue',
                rpc_args: {
                    p_pr_id: id,
                    p_store_id: storeId,
                    p_company_id: companyId,
                    p_action_by: userId,
                    p_items: itemsToIssue
                }
            }];

            const approvalResponse = await initiateApprovalRequest({
                module_name: 'Purchase Requisitions',
                action_name: 'Stock Issue',
                company_id: companyId,
                requested_by: userId,
                store_id: storeId,
                action_payload: { operations }
            });

            if (approvalResponse?.success && approvalResponse.requires_approval) {
                toast.success('Your action has been submitted and is currently pending approval.');
                setIsConfirmIssueOpen(false);
                navigate('/dashboard/purchaseRequisitions');
                return;
            } else if (approvalResponse && !approvalResponse.success) {
                toast.error(approvalResponse.message);
                return;
            }

            // Fallback: If no approval required, call the RPC directly
            const { error: rpcError } = await (supabase as any).rpc('process_stock_issue', {
                p_pr_id: id,
                p_store_id: storeId,
                p_company_id: companyId,
                p_action_by: userId,
                p_items: itemsToIssue
            });

            if (rpcError) throw rpcError;

            toast.success("Items issued successfully!");
            setIsConfirmIssueOpen(false);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error: any) {
            console.error("Failed to issue items:", error);
            toast.error(error.message || "Failed to issue items.");
        }
    };


    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <Toaster />
            <div className="max-w-6xl mx-auto space-y-8">
                <PendingApprovalBanner />
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>{
                            if (fromPurchaseRequisition) {
    navigate("/dashboard/purchaseRequisitions", {
      state: { activeTab },
    });
  } else {
    navigate(-1);
  }
                        } }
                        className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
                    >
                        <ArrowLeft className="h-5 w-5 text-blue-600" />
                    </Button>
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {isEditMode ? "Edit Purchase Requisition" : isViewMode ? "Purchase Requisition Details" : "Create Purchase Requisition"}
                            </h1>
                            <p className="text-gray-600">
                                {isEditMode
                                    ? "Modify the details of an existing purchase requisition"
                                    : isViewMode ? "View the details of an existing purchase requisition"
                                        : "Request items needed for inventory or operations"}
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Purchase Requisition Details
                        </CardTitle>
                        <CardDescription className="text-blue-600">
                            Fill in the details below to create a new purchase requisition
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 px-6">
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {/* Section 1: Basic Information */}
                            <Card className="border-none shadow-sm mb-5">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Basic Information
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Requisition number and date
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="pr_number" className="text-gray-700 flex items-center gap-1 font-medium">
                                                <FileText className="h-4 w-4" />
                                                Purchase Requisition Number <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="pr_number"
                                                value={watchedFields.requisitionNumber}
                                                readOnly
                                                className="h-10 bg-gray-50"
                                            />
                                            <ErrorMessage message={errors.requisitionNumber?.message} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 flex items-center gap-1 font-medium">
                                                <Calendar1 className="h-4 w-4" />
                                                Required By Date
                                            </Label>

                                            <Input
                                                type="date"
                                                {...register("required_by_date")}
                                                min={new Date().toISOString().split("T")[0]}
                                                disabled={isViewMode}
                                                className="h-10 bg-gray-50"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Section 2: Add Items */}
                            <Card className="border-none shadow-sm mb-5">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        Add Items
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Select items and specify required quantity
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-6 mb-5">

                                        {/* Category Type */}
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 gap-1 font-medium">
                                                <FileText className="h-4 w-4" />
                                                Category Type <span className="text-red-500">*</span>
                                            </Label>

                                            <Select
                                                value={selectedCategoryType}
                                                onValueChange={(val: "internal" | "external") => {
                                                    setSelectedCategoryType(val);
                                                    setValue("category_type", val, { shouldValidate: true });

                                                    // Clear dependent data
                                                    setSelectedItems([]);
                                                    setSelectedItemId("");
                                                    setItemSearchTerm("");
                                                    
                                                    if (!isViewMode) {
                                                        console.log("onValueChange clearing store_id");
                                                        setValue("store_id", "");
                                                    }
                                                }}
                                                disabled={isViewMode}
                                            >
                                                <SelectTrigger className="h-10 w-full">
                                                    <SelectValue placeholder="Select Category Type" />
                                                </SelectTrigger>

                                                <SelectContent>
                                                    <SelectItem value="internal">Internal</SelectItem>
                                                    <SelectItem value="external">External</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <ErrorMessage message={errors.category_type?.message} />
                                        </div>

                                        {/* Store */}
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 flex items-center gap-1 font-medium">
                                              <Store className="h-4 w-4" />
                                              Store <span className="text-red-500">*</span>
                                            </Label>

                                            <Select
                                                value={watch("store_id")}
                                                onValueChange={(val) =>
                                                    setValue("store_id", val, { shouldValidate: true })
                                                }
                                                disabled={!selectedCategoryType || isViewMode}
                                            >
                                                <SelectTrigger className="h-10 w-full">
                                                    <SelectValue
                                                        placeholder={
                                                            !selectedCategoryType
                                                                ? "Select category type first..."
                                                                : "Select Store"
                                                        }
                                                    />
                                                </SelectTrigger>

                                                <SelectContent>
                                                    {stores.map(store => (
                                                        <SelectItem key={store.id} value={store.id}>
                                                            {store.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <ErrorMessage message={errors.store_id?.message} />
                                        </div>
                                    </div>

                                    {!isViewMode &&
                                        <>
                                            <div className="grid grid-cols-12 gap-4 items-end">
                                                <div className="col-span-6 space-y-2">
                                                    <div className="space-y-2 relative">
                                                        <Label className="text-gray-700 flex items-center gap-1 font-medium">
                                                            <Search className="h-4 w-4" />
                                                            Search Item
                                                        </Label>

                                                        <div className="relative">
                                                            <Input
                                                                placeholder={
                                                                    !selectedCategoryType || !watchedStoreId
                                                                        ? "Select the category type and store first..."
                                                                        : "Search item by name or code..."
                                                                }
                                                                value={itemSearchTerm}
                                                                onChange={(e) => {
                                                                    setItemSearchTerm(e.target.value);
                                                                    if (isItemSelected) {
                                                                        setIsItemSelected(false);
                                                                    }
                                                                }}
                                                                disabled={!selectedCategoryType || !watchedStoreId}
                                                            />
                                                        </div>

                                                        {showItemDropdown && itemSearchTerm.length >= 3 && (
                                                            <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                                                {filteredItems.length > 0 ? (
                                                                    filteredItems.map((item) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="px-4 py-3 hover:bg-blue-50 flex justify-between items-center"
                                                                        >
                                                                            <div
                                                                                className="cursor-pointer"
                                                                                onClick={() => {
                                                                                    setSelectedItemId(item.id);
                                                                                    setSelectedItemData(item);
                                                                                    setItemSearchTerm(`${item.item_id} — ${item.item_name}`);
                                                                                    setShowItemDropdown(false);
                                                                                    setIsItemSelected(true);
                                                                                }}
                                                                            >
                                                                                <p className="font-medium text-sm">{item.item_name}</p>
                                                                                <p className="text-xs text-gray-500">{item.item_id}</p>
                                                                            </div>

                                                                            {/* View Details */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedItemIdForDetails(item.id);
                                                                                    setIsDetailsModalOpen(true);
                                                                                }}
                                                                                className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium flex items-center gap-1"
                                                                            >
                                                                                View Details
                                                                            </button>
                                                                            <ItemDetailsModal
                                                                                open={isDetailsModalOpen}
                                                                                itemId={selectedItemIdForDetails}
                                                                                onClose={() => {
                                                                                    setIsDetailsModalOpen(false);
                                                                                    setSelectedItemIdForDetails(null);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="p-2">
                                                                        <div className="p-3 text-center text-gray-500 text-sm">
                                                                            No items found
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-md text-blue-600 font-medium"
                                                                            onClick={() => {
                                                                                setNewItemData({
                                                                                    item_name: itemSearchTerm,
                                                                                    description: "",
                                                                                    category_id: "",
                                                                                });

                                                                                setShowCreateItemDialog(true);
                                                                                setShowItemDropdown(false);
                                                                            }}
                                                                        >
                                                                            + Create new item "{itemSearchTerm}"
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-3 space-y-2">
                                                    <Label htmlFor="quantity">Quantity</Label>
                                                    <Input
                                                        id="quantity"
                                                        type="number"
                                                        min="1"
                                                        value={quantity}
                                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="h-10"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <Button
                                                        type="button"
                                                        onClick={handleAddItem}
                                                        className="w-full h-10 bg-blue-600 hover:bg-blue-700"
                                                    >
                                                        Add Item
                                                    </Button>
                                                </div>
                                            </div>
                                            {errors.requisition_items && formState.isSubmitted && (
                                                <ErrorMessage message={errors.requisition_items.message} />
                                            )}
                                        </>
                                    }
                                </CardContent>
                            </Card>

                            {/* Section 3: Items Added */}
                            <Card className="border-none shadow-sm mb-5">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        Items Added
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Review and manage requested items
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {selectedItems.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                            <p>No items added yet. Start by selecting items above.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {isViewMode && isApprovedPR && selectedRowIds.length > 0 && (
                                                <div className="mb-4 w-full">
                                                    <div className="w-full rounded-lg shadow-sm px-4 py-3 animate-in fade-in slide-in-from-right-4">
                                                        <div className="flex justify-between items-center w-full">

                                                            {/* Selected Count */}
                                                            <span className="text-sm font-medium">
                                                                {selectedRowIds.length} item(s) selected
                                                            </span>

                                                            {/* Action Buttons */}
                                                            <div className="flex flex-wrap gap-2">


                                                                {/* STOCK ISSUE */}
                                                                {isInternalCategory && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <span>
                                                                                    <Button
                                                                                        type='button'
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                                                                        disabled={!canStockIssue || !hasPermission('Stock Issue')}
                                                                                        onClick={() => setIsStockIssueOpen(true)}
                                                                                    >
                                                                                        Stock Issue
                                                                                    </Button>
                                                                                </span>
                                                                            </TooltipTrigger>

                                                                            <TooltipContent>
                                                                                {!hasPermission('Stock Issue') ? (
                                                                                    'You do not have permission for Stock Issue'
                                                                                ) : !canStockIssue ? (
                                                                                    stockIssueTooltip
                                                                                ) : 'Stock Issue'}
                                                                            </TooltipContent>

                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                                <StockIssueModal
                                                                    open={isStockIssueOpen}
                                                                    onClose={() => setIsStockIssueOpen(false)}
                                                                    items={selectedRows.map(item => ({
                                                                        id: item.id,
                                                                        item_code: item.item_code,
                                                                        item_name: item.item_name,
                                                                        quantity: item.quantity,
                                                                        remaining_qty: item.remaining_qty ?? item.quantity,
                                                                        selected_store_stock: item.selected_store_stock,
                                                                    }))}
                                                                    onIssue={handleIssueStockStart}
                                                                />
                                                                <ScanQRModal
                                                                    isOpen={isScanQROpen}
                                                                    onClose={() => setIsScanQROpen(false)}
                                                                    onSuccess={handleScanSuccess}
                                                                />
                                                                <ConfirmIssueModal
                                                                    open={isConfirmIssueOpen}
                                                                    onClose={() => setIsConfirmIssueOpen(false)}
                                                                    user={scannedUser}
                                                                    onConfirm={handleConfirmIssue}
                                                                />
                                                                {/* STOCK TRANSFER */}
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span>
                                                                                <Button
                                                                                    type='button'
                                                                                    size="sm"
                                                                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                                                                    disabled={!canStockTransfer || !hasPermission('Transfer Stock')}
                                                                                    onClick={() => setIsStockTransferOpen(true)}
                                                                                >
                                                                                    Stock Transfer
                                                                                </Button>
                                                                            </span>
                                                                        </TooltipTrigger>

                                                                        <TooltipContent>
                                                                            {!hasPermission('Transfer Stock') ? (
                                                                                'You do not have permission for Stock Transfer'
                                                                            ) : !canStockTransfer ? (
                                                                                stockTransferTooltip
                                                                            ) : 'Stock Transfer'}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>


                                                                <StockTransferModal
                                                                    open={isStockTransferOpen}
                                                                    onClose={() => setIsStockTransferOpen(false)}
                                                                    items={selectedRows}
                                                                    destinationStore={selectedStoreName}
                                                                    destinationStoreId={watchedStoreId}
                                                                />

                                                                {/* CREATE QUOTATION */}

                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span>
                                                                                <Button
                                                                                    size="sm"
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const selectedItemsForQuotation = selectedRows.map(item => ({
                                                                                            id: item.id,
                                                                                            item_code: item.item_code,
                                                                                            item_name: item.item_name,
                                                                                            quantity: item.quantity,
                                                                                            cost_price: 0
                                                                                        }));

                                                                                        navigate("/dashboard/QuotationForm/create", {
                                                                                            state: {
                                                                                                source: "purchaseRequisition",
                                                                                                purchaseReqId: id,
                                                                                                items: selectedItemsForQuotation
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                    disabled={!hasPermission('Create Quotation')}
                                                                                >
                                                                                    Create Quotation
                                                                                </Button>
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            {hasPermission('Create Quotation') ? 'Create Quotation' : 'You do not have permission to create quotation'}
                                                                        </TooltipContent>

                                                                    </Tooltip>
                                                                </TooltipProvider>





                                                                {/* CREATE PURCHASE ORDER */}
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span>
                                                                                <Button
                                                                                    size="sm"
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const selectedItemsForPO = selectedRows.map((item) => ({
                                                                                            id: item.id,
                                                                                            item_id: item.item_code,
                                                                                            item_name: item.item_name,
                                                                                            description: item.description || "",
                                                                                            selling_price: 0,
                                                                                            max_level: item.max_level || 0,
                                                                                            order_qty: item.quantity,
                                                                                            received_qty: null,
                                                                                        }));

                                                                                        navigate("/dashboard/purchaseOrderForm", {
                                                                                            state: {
                                                                                                source: "purchaseRequisition",
                                                                                                purchaseReqId: id,
                                                                                                store_id: watchedStoreId,
                                                                                                category_type: watchedFields.category_type,
                                                                                                items: selectedItemsForPO,
                                                                                            },
                                                                                        });
                                                                                    }}
                                                                                    disabled={!hasPermission('Create Purchase Order')}
                                                                                >
                                                                                    Create Purchase Order
                                                                                </Button>
                                                                            </span>

                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            {hasPermission('Create Purchase Order') ? "Create purchase order" : "You dont have permission to access"}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>


                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">

                                                            {isViewMode && isApprovedPR && (
                                                                <TableHead className="w-[50px]">
                                                                    <Checkbox
                                                                        checked={isAllSelected}
                                                                        onCheckedChange={(value) =>
                                                                            handleSelectAll(!!value)
                                                                        }
                                                                    />
                                                                </TableHead>
                                                            )}

                                                            <TableHead><p className={!(isViewMode && isApprovedPR) ? "ps-2" : ""}>Item ID</p></TableHead>
                                                            <TableHead>Item Name</TableHead>
                                                            <TableHead className="text-center">Status</TableHead>
                                                            <TableHead className="text-center">Requested Qty</TableHead>
                                                            {isInternalCategory && <TableHead className="text-center">Issued Qty</TableHead>}
                                                            <TableHead className="text-center">Store Stock</TableHead>
                                                            <TableHead className="text-center">Other Stores</TableHead>
                                                            {!isViewMode && <TableHead className="text-center">Images</TableHead>}
                                                            <TableHead className="text-center">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
                                                        {selectedItems.map((item) => (
                                                            <TableRow
                                                                key={item.id}
                                                                className="hover:bg-indigo-50/30 transition-colors"
                                                            >
                                                                {isViewMode && isApprovedPR && (
                                                                    <TableCell>
                                                                        {(() => {
                                                                            const isCheckboxDisabled = item.status === 'Issued' || item.status === 'Cancelled' || item.is_temporary;
                                                                            const tooltipMessage = item.is_temporary ? "Temporary items cannot be selected" : item.status === 'Issued' ? "Item fully issued" : "Item cancelled";

                                                                            return (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <span className="inline-block">
                                                                                                <Checkbox
                                                                                                    checked={selectedRowIds.includes(item.id)}
                                                                                                    disabled={isCheckboxDisabled}
                                                                                                    onCheckedChange={(value) =>
                                                                                                        handleRowSelect(item.id, !!value)
                                                                                                    }
                                                                                                />
                                                                                            </span>
                                                                                        </TooltipTrigger>
                                                                                        {isCheckboxDisabled && (
                                                                                            <TooltipContent>
                                                                                                <p>{tooltipMessage}</p>
                                                                                            </TooltipContent>
                                                                                        )}
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        })()}
                                                                    </TableCell>
                                                                )}

                                                                <TableCell className="font-medium text-indigo-600">
                                                                    <p className={!(isViewMode && isApprovedPR) ? "ps-2" : ""}>{item.item_code}</p>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.item_name}
                                                                    {item.is_temporary && (
                                                                        <span className="ml-2 inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                                                            Temp
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="px-6 py-4 text-center">
                                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Issued' ? 'bg-green-100 text-green-800' :
                                                                        item.status === 'Partially Issued' ? 'bg-blue-100 text-blue-800' :
                                                                            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                                'bg-gray-100 text-gray-800'
                                                                        }`}>
                                                                        {item.status || 'Pending'}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {editingItemId === item.id ? (
                                                                        <div className="flex items-center justify-center gap-2">

                                                                            <Input
                                                                                type="number"
                                                                                min={isApprovedPR ? item.quantity : 1}
                                                                                value={editQuantity}
                                                                                onChange={(e) =>
                                                                                    setEditQuantity(
                                                                                        Math.max(isApprovedPR ? item.quantity : 1, parseInt(e.target.value) || (isApprovedPR ? item.quantity : 1))
                                                                                    )
                                                                                }
                                                                                className="w-20 h-8 text-center"
                                                                            />

                                                                            <Button
                                                                                type='button'
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={handleEditSave}
                                                                                className="text-green-600"
                                                                            >
                                                                                <Check className="h-4 w-4" />
                                                                            </Button>

                                                                            <Button
                                                                                type='button'
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={handleEditCancel}
                                                                                className="text-red-600"
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>

                                                                        </div>

                                                                    ) : (

                                                                        <div className="text-center font-medium">{item.quantity}</div>
                                                                    )}

                                                                </TableCell>
                                                                {isInternalCategory && (
                                                                    <TableCell className="px-6 py-4 text-center font-medium text-gray-900">
                                                                        {item.issued_qty || 0}
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className={`px-6 py-4 text-center text-sm font-semibold ${getSelectedStoreStockColor(item)}`}>
                                                                    {item.selected_store_stock}
                                                                </TableCell>

                                                                <TableCell className={`px-6 py-4 text-center text-sm font-semibold ${getOtherStoresStockColor(item)}`}>
                                                                    {item.other_stores_stock}
                                                                </TableCell>

                                                                {!isViewMode && (
                                                                    <TableCell className={`px-6 py-4 text-center text-sm font-semibold ${getOtherStoresStockColor(item)}`}>

                                                                        {(() => {
                                                                            const imageData = item.image as ItemImageData | null;

                                                                            const hasImage =
                                                                                !!imageData?.image_1?.path ||
                                                                                !!imageData?.image_2?.path;

                                                                            return (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div>
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                disabled={isViewMode && !hasImage}

                                                                                                onClick={() => {
                                                                                                    setCurrentImageItem(item);
                                                                                                    if (hasImage) {
                                                                                                        setImageModalItemId(item.id);
                                                                                                        return;
                                                                                                    }

                                                                                                    setSelectedImage(item.image as ItemImageData);
                                                                                                    setIsImageModalOpen(true);
                                                                                                }}
                                                                                            >
                                                                                                <ImageIcon
                                                                                                    className={`h-5 w-5 ${isViewMode
                                                                                                        ? "text-gray-400"
                                                                                                        : hasImage
                                                                                                            ? "text-gray-400"
                                                                                                            : "text-blue-500"
                                                                                                        }`}
                                                                                                />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </TooltipTrigger>

                                                                                    <TooltipContent>
                                                                                        {hasImage
                                                                                            ? "View item image"
                                                                                            : isViewMode
                                                                                                ? "No images available"
                                                                                                : "No images, click to add"
                                                                                        }
                                                                                    </TooltipContent>

                                                                                </Tooltip>

                                                                            );
                                                                        })()}

                                                                    </TableCell>
                                                                )}

                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-center gap-1">
                                                                        {isInternalCategory && isViewMode && !item.is_temporary && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="outline"
                                                                                            size="icon"
                                                                                            className="border-blue-300 hover:bg-blue-50"
                                                                                            onClick={() => {
                                                                                                setSelectedHistory(item.issue_history || []);
                                                                                                setIsHistoryModalOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            <History className="h-4 w-4 text-blue-600" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>View Issue History</TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}

                                                                        {isViewMode && (() => {
                                                                            const imageData = item.image as {
                                                                                image_1?: { path?: string };
                                                                                image_2?: { path?: string };
                                                                            } | null;

                                                                            const hasImages =
                                                                                !!imageData?.image_1?.path ||
                                                                                !!imageData?.image_2?.path;

                                                                            return (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <span className="inline-block">
                                                                                                <Button
                                                                                                    type="button"
                                                                                                    variant="outline"
                                                                                                    size="icon"
                                                                                                    className={`border-gray-300 hover:bg-gray-50 ${!hasImages ? "pointer-events-none" : ""
                                                                                                        }`}
                                                                                                    disabled={!hasImages}
                                                                                                    onClick={() => {
                                                                                                        if (hasImages) {
                                                                                                            setImageModalItemId(item.id);
                                                                                                        }
                                                                                                    }}
                                                                                                >
                                                                                                    <ImageIcon
                                                                                                        className={`h-4 w-4 ${hasImages
                                                                                                            ? "text-gray-400"
                                                                                                            : "text-blue-500"
                                                                                                            }`}
                                                                                                    />
                                                                                                </Button>
                                                                                            </span>
                                                                                        </TooltipTrigger>

                                                                                        <TooltipContent>
                                                                                            {hasImages
                                                                                                ? "View item image"
                                                                                                : "No images available"}
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        })()}

                                                                        {!isViewMode && (
                                                                            <>
                                                                                <Button
                                                                                    type='button'
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="border-blue-300 hover:bg-blue-50"
                                                                                    disabled={prStatus === 'CLOSED'}
                                                                                    onClick={() => handleEditStart(item)}
                                                                                >
                                                                                    <Edit2 className="h-4 w-4 text-blue-600" />
                                                                                </Button>

                                                                                {(!isApprovedPR || isInternalCategory) && (() => {
                                                                                    const isCancelDisabled = isApprovedPR && !item.is_temporary && (item.status === 'Issued' || item.status === 'Cancelled');
                                                                                    const tooltipMessage = item.status === 'Issued' ? "Cannot cancel a fully issued item" : "Item is already cancelled";

                                                                                    return (
                                                                                        <TooltipProvider>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <span className="inline-block">
                                                                                                        <Button
                                                                                                            type='button'
                                                                                                            variant="outline"
                                                                                                            size="icon"
                                                                                                            className={`border-red-300 hover:bg-red-50 ${isCancelDisabled ? 'pointer-events-none opacity-50' : ''}`}
                                                                                                            disabled={isCancelDisabled || prStatus === 'CLOSED'}
                                                                                                            onClick={() => {
                                                                                                                if (isApprovedPR && !item.is_temporary) {
                                                                                                                    setCancelModalItemId(item.id);
                                                                                                                    setCancelModalItemName(item.item_name);
                                                                                                                    setIsCancelItemModalOpen(true);
                                                                                                                } else {
                                                                                                                    setItemToDelete(item.id);
                                                                                                                    setShowDeleteDialog(true);
                                                                                                                }
                                                                                                            }}
                                                                                                        >
                                                                                                            <X className="h-4 w-4 text-red-600" />
                                                                                                        </Button>
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                {isCancelDisabled && (
                                                                                                    <TooltipContent>
                                                                                                        <p>{tooltipMessage}</p>
                                                                                                    </TooltipContent>
                                                                                                )}
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    );
                                                                                })()}
                                                                            </>
                                                                        )}

                                                                        {isViewMode && !item.is_temporary && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="outline"
                                                                                            size="icon"
                                                                                            className="border-red-300 hover:bg-red-50"
                                                                                            onClick={() => {
                                                                                                console.log("Item ID:", item.id);
                                                                                                console.log("Item Name:", item.item_name);
                                                                                                console.log("Cancel History:", item.cancel_history);

                                                                                                setSelectedCancelHistory(item.cancel_history || []);
                                                                                                setIsCancelHistoryModalOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            <History className="h-4 w-4 text-red-600" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>

                                                                                    <TooltipContent>
                                                                                        <p>View Cancel History</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}

                                                                        {isViewMode && item.is_temporary === true && (
                                                                            <>
                                                                                <Button
                                                                                    type='button'
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="border-red-300 hover:bg-red-50"
                                                                                    onClick={() => setTempModalItemId(item.id)}                                                         >
                                                                                    <Plus className="h-4 w-4 text-red-600" />
                                                                                </Button>
                                                                                <Button
                                                                                    type='button'
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="border-orange-300 hover:bg-orange-50"
                                                                                    onClick={() => setReplaceModalItemId(item.id)}                                                                       >
                                                                                    <ArrowLeftRight className="h-4 w-4 text-orange-400" />
                                                                                </Button>
                                                                            </>
                                                                        )}


                                                                        <InventoryTempItemModal
                                                                            itemId={tempModalItemId}
                                                                            open={!!tempModalItemId}
                                                                            onOpenChange={(open) => {
                                                                                if (!open) setTempModalItemId("");
                                                                            }}
                                                                        />

                                                                        <ReplaceTempItemModal
                                                                            itemId={replaceModalItemId}
                                                                            selectedCategoryType={watchedFields.category_type}
                                                                            open={!!replaceModalItemId}
                                                                            onOpenChange={(open) => {
                                                                                if (!open) setReplaceModalItemId("");
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}

                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Action Buttons */}
                            {!isViewMode &&
                                <div className="pt-6 border-t flex justify-end gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancel}
                                        disabled={isSubmitting}
                                        className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700">
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {isEditMode ? "Updating..." : "Creating..."}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                {isEditMode ? "Update Purchase Requisition" : "Create Purchase Requisition"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            }
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Cancel</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel? All added items will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-between">
                        <DialogClose asChild>
                            <Button variant="outline">No, Continue</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={confirmCancel}>
                            Yes, Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Item Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Removal</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this item from the requisition?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-between">
                        <DialogClose asChild>
                            <Button variant="outline">No</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteItem}>
                            Yes, Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showCreateItemDialog}
                onOpenChange={setShowCreateItemDialog}
            >
                <DialogContent className="sm:max-w-xl rounded-2xl border-0 p-0 overflow-hidden">

                    {/* Header */}
                    <DialogHeader className="px-6 py-5 border-b bg-white">
                        <DialogTitle className="text-xl font-bold text-blue-700 flex items-center gap-2">
                            Create Temporary Item
                        </DialogTitle>

                        <p className="text-sm text-blue-500 mt-1">
                            Add a temporary item to the inventory
                        </p>
                    </DialogHeader>

                    <div className="p-6 bg-[#fafafa] space-y-2">

                        {/* Item Name */}
                        <div className="space-y-1">
                            <Label className="text-sm font-semibold text-slate-700">
                                Item Name <span className="text-red-500">*</span>
                            </Label>

                            <Input
                                value={newItemData.item_name}
                                onChange={(e) =>
                                    setNewItemData(prev => ({
                                        ...prev,
                                        item_name: e.target.value
                                    }))
                                }
                                placeholder="Enter item name"
                                className="h-11 rounded-xl border-gray-200 bg-white"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                            <Label className="text-sm font-semibold text-slate-700">
                                Description <span className="text-red-500">*</span>
                            </Label>

                            <Textarea
                                value={newItemData.description}
                                onChange={(e) =>
                                    setNewItemData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))
                                }
                                placeholder="Enter description"
                                className="rounded-xl border-gray-200 bg-white resize-none"
                            />
                        </div>

                        {/* Category Type + Category */}
                        <div className="flex gap-4 w-full">

                            {/* Category */}
                            <div className="w-full space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">
                                    Category <span className="text-red-500">*</span>
                                </Label>

                                <Select
                                    value={newItemData.category_id}
                                    onValueChange={(value) =>
                                        setNewItemData(prev => ({
                                            ...prev,
                                            category_id: value
                                        }))
                                    }
                                >
                                    <SelectTrigger className="w-full h-10 rounded-xl border border-gray-200 bg-white shadow-sm">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>

                                    <SelectContent className="rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
                                        {categories.map((category) => (
                                            <SelectItem
                                                key={category.id}
                                                value={category.id}
                                                className="cursor-pointer text-sm hover:bg-blue-50 focus:bg-blue-50"
                                            >
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Selected Category Type */}
                            <div className="w-full space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">
                                    Mark this item as
                                </Label>

                                <Input
                                    value={selectedCategoryType}
                                    disabled
                                    className="capitalize rounded-xl border-gray-300 bg-white cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setShowCreateItemDialog(false)
                                }
                                className="rounded-xl px-6"
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                onClick={handleCreateNewItem}
                                disabled={
                                    creatingItem ||
                                    !newItemData.item_name.trim()
                                }
                                className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6"
                            >
                                {creatingItem
                                    ? "Creating..."
                                    : "Create Item"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <InventoryItemImageModal
                key={imageModalItemId}
                itemId={imageModalItemId}
                open={!!imageModalItemId}
                onOpenChange={(open) => {
                    if (!open) {
                        setImageModalItemId("");
                    }
                }}
            />
            <ItemImageModal
                open={isImageModalOpen}
                image={selectedImage}
                onClose={() => {
                    setIsImageModalOpen(false);
                    setSelectedImage(null);
                }}
                images={selectedImages}
                setImages={setSelectedImages}
                setImage1File={setImage1File}
                setImage2File={setImage2File}
            />
            <IssueHistoryModal
                open={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                history={selectedHistory}
            />
            <CancelItemModal
                open={isCancelItemModalOpen}
                onClose={() => setIsCancelItemModalOpen(false)}
                partName={cancelModalItemName}
                maxQuantity={selectedItems.find(i => i.id === cancelModalItemId)?.remaining_qty || 0}
                onConfirm={handleCancelItemSubmit}
            />
            <CancelHistoryModal
                open={isCancelHistoryModalOpen}
                onClose={() => setIsCancelHistoryModalOpen(false)}
                history={selectedCancelHistory}
            />
        </div >
    );
};

export default PurchaseRequisitionForm;

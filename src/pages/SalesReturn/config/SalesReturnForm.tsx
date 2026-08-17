import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
    ArrowLeft,
    ArrowUpRight,
    CalendarCheck2,
    Calendar1,
    Package,
    Paperclip,
    Phone,
    Printer,
    SquareChartGantt,
    User,
    Store,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    Loader2,
    X,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSelector } from "react-redux";
import { selectUser } from "@/redux/features/userSlice";
import { ISalesInvoice, ISystemMessageConfig, IWorkflowConfig } from "@/Utils/constants";
import { supabase } from "@/Utils/types/supabaseClient";
import { useApprovalDocument } from '@/hooks/useApprovalDocument';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";

export const salesReturnSchema = z.object({
    returnNumber: z.string().min(1, "Return number is required"),
    returnDate: z.string().min(1, "Return date is required"),
    invoiceId: z.string().min(1, "Invoice is required"),
    returnStatus: z.string().min(1, "Return status is required"),
    store_id: z.string().min(1, "Store is required"),
    workflow_id: z.string().nullable().optional(),
    next_level_role_id: z.string().nullable().optional(),

    return_items: z
        .array(
            z.object({
                item_id: z.string(),
                item_name: z.string(),
                soldQty: z.number(),
                returnQty: z
                    .number()
                    .min(0, "Return quantity must not be negative"),
                reason: z.string().min(1, "Reason is required"),
                storeId: z.string().min(1, "Store is required"),
                location: z.string().min(1, "Location is required"),
            })
        )
        .min(1, "At least one item must be returned"),

    remarks: z.string().optional(),
    attachment: z
        .any()
        .optional()
        .refine(
            (file) =>
                !file ||
                (file instanceof File &&
                    ['image/jpeg', 'image/png'].includes(file.type)),
            'Attachment must be a JPG or PNG image'
        )
        .refine(
            (file) => !file || file.size <= 5 * 1024 * 1024,
            'Attachment must be less than 5MB'
        ),

});

export type SalesReturnFormValues = z.infer<typeof salesReturnSchema>;

interface ExtendedInvoice extends ISalesInvoice {
    store_mgmt: {
        id: string;
        name: string;
    } | null;
}

interface Store {
    id: string;
    name: string;
}

interface Location {
    id: string;
    shelf: {
        short_name: string;
    } | null;
    cabinet: {
        short_name: string;
    } | null;
}

type Attachment = {
    name: string;
    type: string;
    size: number;
    path: string;
} | null;

export default function SalesReturnForm() {
    const { id } = useParams();
    const isEditMode = Boolean(id) && location.pathname.includes('edit');
    const isViewMode = Boolean(id) && location.pathname.includes('view');
    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;
    const userId = userData?.id;
    const departmentId = userData?.department_id;
    const navigate = useNavigate();
    const today = format(new Date(), "yyyy-MM-dd");

    // Approvals integration
    const salesReturnId = id === "pending" ? undefined : id;
    const {
        data: approvalData,
        originalData,
        isPending,
        actionName: approvalActionName
    } = useApprovalDocument<any>({
        id: salesReturnId,
        tableName: 'sales_return'
    });

    const [selectedInvoice, setSelectedInvoice] = useState("");
    const [isItemsExpanded, setIsItemsExpanded] = useState(true);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [isConfirmReturnDialogOpen, setIsConfirmReturnDialogOpen] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [salesInvoices, setSalesInvoices] = useState<ExtendedInvoice[]>([]);
    const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [returnStores, setReturnStores] = useState<Record<string, string>>({});
    const [locationsByItem, setLocationsByItem] = useState<Record<string, Location[]>>({})
    const [customerName, setCustomerName] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
    const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
    const [returnLocations, setReturnLocations] = useState<Record<string, string>>({});
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const [systemMsgConfig, setSystemMsgConfig] = useState<ISystemMessageConfig[]>([])
    const [isEditDataLoaded, setIsEditDataLoaded] = useState(false);
    const [removeAttachment, setRemoveAttachment] = useState(false);
    const [workflowConfig, setWorkflowConfig] = useState<IWorkflowConfig | null>(null);
    const [allApprovalStatus, setAllApprovalStatus] = useState<any[]>([]);
    const originalDepartmentId = useRef<string | null>(null);

    const statusApprovalPending = systemMsgConfig.find(config => config.sub_category_id === "APPROVAL_PENDING");
    const statusApproverCompleted = systemMsgConfig.find(c => c.sub_category_id === "APPROVER_COMPLETED");
    const statusReturnCreated = systemMsgConfig.find(c => c.sub_category_id === "RETURN_CREATED");
    const statusReturnCompleted = systemMsgConfig.find(c => c.sub_category_id === "RETURN_COMPLETED");

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isSubmitting },
        reset
    } = useForm<SalesReturnFormValues>({
        resolver: zodResolver(salesReturnSchema),
        defaultValues: {
            returnNumber: "",
            returnDate: today,
            invoiceId: "",
            return_items: [],
            remarks: "",
            returnStatus: "",
            workflow_id: null,
            next_level_role_id: null,
            store_id: "",
        },
    });

    const watchedStoreId = watch("store_id");
    const invoiceStoreId = watch("store_id");
    const storeName = stores.find(s => s.id === invoiceStoreId)?.name ?? "";

    // Generate sales return number
    function generateSalesReturnNumber(lastNumber = 1): string {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const serial = String(lastNumber).padStart(4, '0');

        return `SR-${dd}${mm}${yy}-${serial}`;
    }

    useEffect(() => {
        const fetchAndSetNextSalesReturnNumber = async () => {
            try {
                if (!companyId || isEditMode || isViewMode) return;

                const now = new Date();
                const dd = String(now.getDate()).padStart(2, '0');
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const yy = String(now.getFullYear()).slice(-2);

                const todayPrefix = `SR-${dd}${mm}${yy}-`;

                const { data, error } = await supabase
                    .from('sales_return')
                    .select('sales_return_number')
                    .eq('company_id', companyId)
                    .like('sales_return_number', `${todayPrefix}%`)
                    .order('sales_return_number', { ascending: false })
                    .limit(1);

                let nextSerial = 1;

                if (!error && data && data.length > 0 && data[0].sales_return_number) {
                    const match = data[0].sales_return_number.match(/-(\d{4})$/);
                    if (match) {
                        nextSerial = parseInt(match[1], 10) + 1;
                    }
                }

                setValue(
                    'returnNumber',
                    generateSalesReturnNumber(nextSerial),
                    { shouldValidate: true }
                );
            } catch (error) {
                console.error('Error fetch and set next sales return number', error);
            }
        };

        fetchAndSetNextSalesReturnNumber();
    }, [companyId, setValue, isEditMode, isViewMode]);

    // Load sales invoices
    useEffect(() => {
        if (!companyId) {
            setSalesInvoices([]);
            return;
        }

        const fetchSalesInvoices = async () => {
            try {
                const { data, error } = await supabase
                    .from('sales_invoice')
                    .select(`*,
                        store_mgmt!sales_invoice_store_id_fkey (id, name)`)
                    .eq('company_id', companyId)
                    .order('invoice_number', { ascending: true });

                if (error) throw error;

                if (data) {
                    setSalesInvoices(data)
                }
            } catch (error) {
                console.error('Unexpected error in fetchSalesInvoices:', error);
                toast.error('An unexpected error occurred while fetching invoices.');
            }
        }

        fetchSalesInvoices();
    }, [companyId])

    useEffect(() => {
        if (!companyId || !invoiceStoreId || !departmentId) {
            setWorkflowConfig(null);
            return;
        }

        const fetchWorkflow = async () => {

            const { data: moduleData } = await supabase
                .from("main_modules")
                .select("id")
                .or("module_name.eq.Sales Returns,module_key.eq.Sales Returns")
                .limit(1)
                .single();

            const { data: actionData } = await supabase
                .from("available_actions")
                .select("id")
                .eq("action_name", "Add")
                .single();

            console.log("fetched module and action", moduleData, actionData, userId, invoiceStoreId)

            if (!moduleData || !actionData || !userId) return;

            const { data, error } = await supabase
                .from("workflow_config")
                .select("*")
                .eq("company_id", companyId)
                .eq("module_id", moduleData.id)
                .eq("action_id", actionData.id)
                .eq("assigned_to", userId)
                .eq("store_id", invoiceStoreId)
                .eq("is_active", true)
                .eq("status", true)
                .order("level", { ascending: true })
                .limit(1)
                .single();

            if (error) {
                setWorkflowConfig(null);
                return;
            }

            setWorkflowConfig(data);
        };

        fetchWorkflow();
    }, [companyId, invoiceStoreId, departmentId]);

    console.log(workflowConfig)

    // Load sales invoice items after invoice selection
    useEffect(() => {
        if (isEditMode || isViewMode) return;

        if (!selectedInvoice || !companyId) {
            setInvoiceItems([]);
            return;
        }

        const fetchInvoiceItems = async () => {
            try {
                const { data, error } = await supabase.rpc(
                    "get_invoice_items_grouped",
                    {
                        p_sales_invoice_id: selectedInvoice,
                        p_company_id: companyId
                    }
                );
                if (error) throw error;
                const normalizedItems = (data || []).map((item: any) => ({
                    id: item.item_uuid,
                    code: item.item_id,
                    name: item.item_name,
                    soldQty: item.quantity,
                }));

                setInvoiceItems(normalizedItems);
            } catch (error) {
                console.error("Error fetching invoice items", error);
                toast.error("Failed to load invoice items");
            }
        };

        fetchInvoiceItems();
    }, [selectedInvoice, companyId]);

    useEffect(() => {
        const items = invoiceItems.map((item) => ({
            item_id: item.id,
            item_name: item.name,
            soldQty: item.soldQty,
            returnQty: returnQuantities[item.id] ?? 0,
            reason: returnReasons[item.id] ?? "",
            storeId: returnStores[item.id] ?? "",
            location: returnLocations[item.id] ?? "",
        }));

        setValue("return_items", items, { shouldValidate: true });
    }, [invoiceItems, returnQuantities, returnReasons, returnStores, returnLocations, setValue,]);

    // Load stores
    useEffect(() => {
        if (!companyId) {
            setStores([]);
            return;
        }

        const fetchStores = async () => {
            try {
                const { data, error } = await supabase
                    .from("store_mgmt")
                    .select("id, name")
                    .eq("company_id", companyId)
                    .eq("is_active", true)
                    .order("name", { ascending: true });

                if (error) throw error;

                setStores(data || []);
            } catch (err) {
                console.error("Error fetching stores:", err);
                toast.error("Failed to load stores");
            }
        };

        fetchStores();
    }, [companyId]);

    // System Message Config
    useEffect(() => {
        const fetchSystemMessageConfig = async () => {
            if (!companyId) return;

            try {
                const { data, error } = await supabase
                    .from('system_message_config')
                    .select('*')
                    .eq("company_id", companyId)
                    .eq("category_id", 'SALES_RETURN');

                if (error) throw error;

                if (data.length > 0) {
                    setSystemMsgConfig(data);
                    const statusApprovalPending = data.find(config => config.sub_category_id === "APPROVAL_PENDING");
                    const statusApproverCompleted = data.find(config => config.sub_category_id === "APPROVER_COMPLETED");
                    if (!isEditMode && !isViewMode) {
                        const defaultStatusId = workflowConfig ? statusApprovalPending?.id : statusApproverCompleted?.id;
                        setValue("returnStatus", defaultStatusId ?? "");
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
    }, [setValue, companyId, workflowConfig, isEditMode, isViewMode]);

    // Load store location for each item
    const fetchLocationsForItem = async (itemId: string, storeId: string) => {
        if (!companyId || !storeId) return;

        try {
            const { data, error } = await supabase
                .from("inventory_loc_mgmt")
                .select(`
                id,
                shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey(short_name),
                cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey(short_name)
            `)
                .eq("store_Id", storeId)
                .eq("company_id", companyId);

            if (error) throw error;

            setLocationsByItem(prev => ({
                ...prev,
                [itemId]: data || []
            }));
        } catch (err) {
            console.error("Error fetching locations:", err);
            toast.error("Failed to load storage locations");
        }
    };

    const loadAttachmentPreview = async (path: string) => {
        try {
            const { data } = await supabase.storage
                .from("sales_return_images")
                .getPublicUrl(path);

            setAttachmentPreview(data.publicUrl);
        } catch (err) {
            console.error("Attachment preview failed", err);
            setAttachmentPreview(null);
        }
    };

    useEffect(() => {
        if ((!isEditMode && !isViewMode) || !id || !companyId) return;

        const fetchSalesReturn = async () => {
            try {
                let data: any = null;
                let returnItems: any[] = [];

                if (isPending && approvalData) {
                    const ops = approvalData.operations || [];
                    const parentOp = ops.find((op: any) => op.table === 'sales_return' && (op.type === 'insert' || op.type === 'update'));
                    const itemsOp = ops.find((op: any) => op.table === 'sales_return_items' && op.type === 'insert');
                    
                    data = { ...approvalData, ...(parentOp?.data || {}) };
                    
                    if (itemsOp) {
                        returnItems = itemsOp.data;
                    } else if (data.id) {
                        const { data: dbItems } = await supabase
                            .from('sales_return_items')
                            .select('*')
                            .eq('sales_return_id', data.id)
                            .eq('is_active', true);
                        if (dbItems) returnItems = dbItems;
                    }
                    
                    if (!data.store_id) {
                       data.store_id = watchedStoreId;
                    }
                } else if (id !== 'pending') {
                    const { data: fetchReturnData, error } = await supabase
                        .from("sales_return")
                        .select(`
                            sales_return_number,
                            return_date,
                            linked_invoice_id,
                            remarks,
                            attachment,
                            return_status,
                            approval_status,
                            workflow_id,
                            next_level_role_id,
                            department_id,
                            store_id
                        `)
                        .eq("id", id)
                        .single();

                    if (error) {
                        toast.error("Failed to load sales return");
                        return;
                    }
                    data = fetchReturnData;
                }

                if (!data) return;

                reset({
                    returnNumber: data.sales_return_number ?? '',
                    returnDate: data.return_date ?? '',
                    invoiceId: data.linked_invoice_id ?? '',
                    remarks: data.remarks ?? "",
                    returnStatus: data.return_status ?? '',
                    workflow_id: data.workflow_id ?? null,
                    next_level_role_id: data.next_level_role_id ?? null,
                    store_id: data.store_id ?? "",
                    return_items: []
                });

                originalDepartmentId.current = data.department_id;
                const approvalStatus = Array.isArray(data.approval_status) ? data.approval_status : [];
                setAllApprovalStatus(approvalStatus as any[]);
                setSelectedInvoice(data.linked_invoice_id ?? '');

                if (data.attachment) {
                    const attachment = data.attachment as Attachment | null;
                    if (attachment?.path) {
                        await loadAttachmentPreview(attachment.path);
                    }
                }

                setIsEditDataLoaded(true);
            } catch (error) {
                console.error("Error fetching sales return", error)
            }
        };

        fetchSalesReturn();
    }, [isEditMode, isViewMode, id, companyId, reset, isPending, approvalData, approvalActionName]);

    useEffect(() => {
        if ((!isEditMode && !isViewMode) || !id || !companyId) return;

        const fetchReturnItems = async () => {
            try {
                let data: any[] = [];
                if (isPending && approvalData) {
                    const ops = approvalData.operations || [];
                    const itemsOp = ops.find((op: any) => op.table === 'sales_return_items' && op.type === 'insert');
                    if (itemsOp) {
                        data = itemsOp.data || {};
                        // Fetch item names because payload only has item_ids
                        if (data && data.length > 0) {
                            const itemIds = data.map((d: any) => d.item_id);
                            const { data: itemData } = await supabase.from('item_mgmt').select('id, item_name').in('id', itemIds);
                            if (itemData) {
                                data = data.map((d: any) => {
                                    const item = itemData.find((i: any) => i.id === d.item_id);
                                    return { ...d, item_mgmt: item };
                                });
                            }
                        }
                    }
                } else if (id !== 'pending') {
                    const { data: fetchedData, error } = await supabase
                        .from("sales_return_items")
                        .select(`
                        item_id,
                        returned_qty,
                        return_reason,
                        next_store_id,
                        storage_location_id,
                        item_mgmt ( id, item_name )
                    `)
                        .eq("sales_return_id", id)
                        .eq("company_id", companyId);

                    if (error) throw error;
                    data = fetchedData || [];
                }

                if (!data || data.length === 0) return;

                const qtyMap: Record<string, number> = {};
                const reasonMap: Record<string, string> = {};
                const storeMap: Record<string, string> = {};
                const locationMap: Record<string, string> = {};

                const items = data.map((row: any) => {
                    qtyMap[row.item_id] = row.returned_qty;
                    reasonMap[row.item_id] = row.return_reason;
                    storeMap[row.item_id] = row.next_store_id;
                    locationMap[row.item_id] = row.storage_location_id;

                    return {
                        id: row.item_id,
                        name: row.item_mgmt?.item_name || "Unknown Item",
                        soldQty: row.returned_qty,
                    };
                });

                setInvoiceItems(items);
                setReturnQuantities(qtyMap);
                setReturnReasons(reasonMap);
                setReturnStores(storeMap);
                setReturnLocations(locationMap);

                // Load locations per item
                Object.entries(storeMap).forEach(([itemId, storeId]) => {
                    fetchLocationsForItem(itemId, storeId);
                });

            } catch (err) {
                console.error(err);
                toast.error("Failed to load return items");
            }
        };

        fetchReturnItems();
    }, [isEditMode, isViewMode, id, companyId, isPending, approvalData]);

    useEffect(() => {
        if (!selectedInvoice || salesInvoices.length === 0) return;

        const inv = salesInvoices.find(i => i.id === selectedInvoice);
        if (!inv) return;

        setCustomerName(inv.customer_name ?? "");
        setContactNumber(inv.contact_number ?? "");
        setInvoiceDate(inv.invoice_date ?? "");
    }, [selectedInvoice, salesInvoices]);

    const handleInvoiceChange = (invoiceId: string) => {
        if (isEditMode && invoiceId === selectedInvoice) return;

        const invoice = salesInvoices.find(i => i.id === invoiceId);

        setSelectedInvoice(invoiceId);

        // Set store_id in form
        setValue("store_id", invoice?.store_mgmt?.id ?? "", { shouldValidate: true, });

        setInvoiceItems([]);
        setValue("return_items", [], { shouldValidate: false });

        setReturnQuantities({});
        setReturnReasons({});
        setReturnStores({});
        setReturnLocations({});
        setLocationsByItem({});
    };

    const updateStore = (itemId: string, storeId: string) => {
        setReturnStores(prev => ({
            ...prev,
            [itemId]: storeId
        }));

        setReturnLocations(prev => ({
            ...prev,
            [itemId]: ""
        }));

        fetchLocationsForItem(itemId, storeId);
    };

    const updateLocation = (itemId: string, locationId: string) => {
        setReturnLocations(prev => ({
            ...prev,
            [itemId]: locationId
        }));
    };

    const updateReturnQty = (itemId: string, value: string, maxQty: number) => {
        let qty = parseInt(value, 10);

        if (isNaN(qty)) qty = 0;

        if (qty < 1) qty = 0;
        if (qty > maxQty) {
            qty = maxQty;
            toast.error("Maximum returnable quantity reached")
        }

        setReturnQuantities(prev => ({
            ...prev,
            [itemId]: qty,
        }));
    };

    const updateReason = (itemId: string, value: string) => {
        setReturnReasons((prev) => ({ ...prev, [itemId]: value }));
    };

    // Handle attachment change
    const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;

        setValue('attachment', file, { shouldDirty: true });

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachmentPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setAttachmentPreview(null);
        }
    };

    // Upload sales return attachment
    const uploadSalesReturnAttachment = async (file: File, salesReturnNumber: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${salesReturnNumber}_image_${Date.now()}.${fileExt}`;
        const filePath = `${salesReturnNumber}/${fileName}`;

        const { error } = await supabase.storage
            .from('sales_return_images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;

        return {
            name: file.name,
            type: file.type,
            size: file.size,
            path: filePath,
        };
    };

    // Validate the sales return number
    const validateAndFixSalesReturnNumber = async (salesReturnNumber: string, companyId: string | null): Promise<string> => {
        if (!companyId) return salesReturnNumber;

        try {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yy = String(now.getFullYear()).slice(-2);

            const todayPrefix = `SR-${dd}${mm}${yy}-`;

            // Extract serial from provided number
            const match = salesReturnNumber.match(/-(\d{4})$/);
            const currentSerial = match ? parseInt(match[1], 10) : 1;

            const { data, error } = await supabase
                .from('sales_return')
                .select('sales_return_number')
                .eq('company_id', companyId)
                .like('sales_return_number', `${todayPrefix}%`);

            if (error) throw error;

            const existingSerials =
                data
                    ?.map((row: { sales_return_number: string | null }) => {
                        if (!row.sales_return_number) return 0;
                        const m = row.sales_return_number.match(/-(\d{4})$/);
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

            return generateSalesReturnNumber(finalSerial);

        } catch (err) {
            console.error('Sales return number validation failed:', err);
            return salesReturnNumber;
        }
    };

    const isAttachment = (value: unknown): value is Attachment => {
        if (!value || typeof value !== "object") return false;
        const v = value as Record<string, unknown>;
        return (
            typeof v.name === "string" &&
            typeof v.type === "string" &&
            typeof v.size === "number" &&
            typeof v.path === "string"
        );
    };

    const getExistingAttachment = async (salesReturnId: string): Promise<Attachment | null> => {
        try {
            const { data, error } = await supabase
                .from("sales_return")
                .select("attachment")
                .eq("id", salesReturnId)
                .single();

            if (error) {
                console.error("Failed to fetch existing attachment", error);
                return null;
            }

            const attachment = data?.attachment;

            return isAttachment(attachment) ? attachment : null;
        } catch (error) {
            console.error("Failed to get existing attachment", error);
            return null;
        }
    };

    const deleteSalesReturnAttachment = async (path: string) => {
        try {
            const { error } = await supabase.storage
                .from("sales_return_images")
                .remove([path]);

            if (error) throw error;
        } catch (err) {
            console.error("Failed to delete old attachment", err);
        }
    };

    const validateWorkflowApprovers = async (): Promise<boolean> => {
        try {
            const srDepartment = isEditMode ? originalDepartmentId.current : departmentId;

            if (!companyId || !srDepartment || !invoiceStoreId) {
                toast.error("Missing company, department or store information.");
                return false;
            }

            const { data, error } = await supabase.rpc(
                "get_workflow_levels_with_approvers",
                {
                    p_company_id: companyId,
                    p_store_id: invoiceStoreId,
                    p_department_id: srDepartment,
                    p_module_key: "Sales Returns",
                    p_action_name: "Add",
                    p_assigned_to: userId ?? ""
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

            const invalidLevel = data?.find((l: any) => !l.has_approvers);

            if (invalidLevel) {
                toast.error(
                    `No approval users configured for Level ${invalidLevel.level}. Please configure approvers for this department.`,
                );
                return false;
            }

            return true;
        } catch (err) {
            console.error("Workflow validation failed:", err);
            toast.error("Unexpected workflow validation error");
            return false;
        }
    };

    const handleConfirmReturnItems = async () => {
        setIsReturning(true);
        try {
            if (!id || !companyId || !userId) return;
            const returnStatusToSave = statusReturnCompleted?.id || currentOrderStatus?.id;

            const { error: rpcError } = await supabase.rpc('process_sales_return', {
                p_sales_return_id: id,
                p_action_by: userId,
                p_status_id: returnStatusToSave as string
            });

            if (rpcError) throw rpcError;

            // System Log
            await supabase.from('system_log').insert({
                company_id: companyId,
                transaction_date: new Date().toISOString(),
                module: "Sales Return",
                scope: "Confirm",
                key: `${watch("returnNumber")}`,
                log: `Sales Return ${watch("returnNumber")} items returned and inventory restored.`,
                action_by: userId,
                created_at: new Date().toISOString()
            });

            toast.success("Items returned and inventory restored successfully.");
            setIsConfirmReturnDialogOpen(false);
            navigate("/dashboard/SalesReturns", { state: { refresh: true } });
        } catch (err: any) {
            console.error("Error returning items:", err);
            toast.error(err.message || "Failed to return items.");
        } finally {
            setIsReturning(false);
        }
    };

    // Submit return form
    const onSubmit = async (data: SalesReturnFormValues) => {

        const isWorkflowValid = await validateWorkflowApprovers();
        if (!isWorkflowValid) return;

        if (isEditMode && salesReturnId) {
            const isLocked = await checkEntityLock(salesReturnId);
            if (isLocked) {
                toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
                return;
            }
        }

        try {
            if (!companyId || !userId) {
                throw new Error("Missing company or user");
            }

            if (!invoiceStoreId) {
                toast.error("Invoice store not found");
                return;
            }

            const isNewSR = !isEditMode;
            const lastApproval = allApprovalStatus?.at(-1);
            const isResubmitted = isEditMode && data.returnStatus === statusReturnCreated?.id && !data.workflow_id && lastApproval?.trail === "Rejected";

            let workflowId = data.workflow_id ?? null;
            let nextRoleId = data.next_level_role_id ?? null;
            let approvalStatusToSave = allApprovalStatus ?? [];

            // NEW or RESUBMISSION
            if (workflowConfig && (isNewSR || isResubmitted)) {

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

            let finalStatus = data.returnStatus;

            if (isNewSR || isResubmitted) {
                if (!statusApproverCompleted?.id) throw new Error("APPROVER_COMPLETED status not configured");

                finalStatus = statusApproverCompleted!.id;
            }

            let currentSalesReturnId = salesReturnId; // from route params / pending view

            // Attachment upload
            let attachment: Attachment | null = null;

            if (data.attachment instanceof File) {
                if (isEditMode && currentSalesReturnId) {
                    const oldAttachment = await getExistingAttachment(currentSalesReturnId);
                    if (oldAttachment) {
                        await deleteSalesReturnAttachment(oldAttachment.path);
                    }
                }
                attachment = await uploadSalesReturnAttachment(data.attachment, data.returnNumber);
            } else if (removeAttachment && isEditMode && currentSalesReturnId) {
                const oldAttachment = await getExistingAttachment(currentSalesReturnId);
                if (oldAttachment) {
                    await deleteSalesReturnAttachment(oldAttachment.path);
                }
                attachment = null;
            } else if (isEditMode && currentSalesReturnId) {
                attachment = await getExistingAttachment(currentSalesReturnId);
            }

            let finalReturnNumber = data.returnNumber;
            if (isNewSR) {
                finalReturnNumber = await validateAndFixSalesReturnNumber(data.returnNumber, companyId);
            }

            const payload = {
                linked_invoice_id: data.invoiceId,
                return_date: data.returnDate,
                total_items: data.return_items.length,
                remarks: data.remarks ?? null,
                attachment,
                return_status: finalStatus,
                approval_status: approvalStatusToSave,
                workflow_id: workflowId,
                next_level_role_id: nextRoleId,
                store_id: invoiceStoreId,
                department_id: isNewSR ? departmentId : originalDepartmentId.current,
            };

            const operations: any[] = [];

            if (isEditMode && currentSalesReturnId) {
                operations.push({
                    table: 'sales_return',
                    type: 'update',
                    data: payload,
                    match: { id: currentSalesReturnId, company_id: companyId }
                });
                operations.push({
                    table: 'system_log',
                    type: 'insert',
                    data: {
                        company_id: companyId,
                        transaction_date: new Date().toISOString(),
                        module: 'Sales Return',
                        scope: 'Edit',
                        key: `${data.returnNumber}`,
                        log: `Sales Return ${data.returnNumber} updated.`,
                        action_by: userId,
                    }
                });
                operations.push({
                    table: 'sales_return_items',
                    type: 'delete',
                    match: { sales_return_id: currentSalesReturnId }
                });
            } else {
                operations.push({
                    table: 'sales_return',
                    type: 'insert',
                    data: {
                        company_id: companyId,
                        created_by: userId,
                        sales_return_number: finalReturnNumber,
                        ...payload
                    },
                    return_id_as: 'new_sales_return_id'
                });
                operations.push({
                    table: 'system_log',
                    type: 'insert',
                    data: {
                        company_id: companyId,
                        transaction_date: new Date().toISOString(),
                        module: 'Sales Return',
                        scope: 'Add',
                        key: `${finalReturnNumber}`,
                        log: `Sales Return ${finalReturnNumber} created.`,
                        action_by: userId,
                    }
                });
            }

            const itemsPayload = data.return_items
                .filter(item => item.returnQty > 0)
                .map(item => ({
                    company_id: companyId,
                    sales_return_id: isEditMode ? currentSalesReturnId : '{{new_sales_return_id}}',
                    item_id: item.item_id,
                    returned_qty: item.returnQty,
                    return_reason: item.reason,
                    next_store_id: item.storeId,
                    storage_location_id: item.location,
                }));

            if (itemsPayload.length === 0) {
                throw new Error("No return items");
            }

            operations.push({
                table: 'sales_return_items',
                type: 'insert',
                data: itemsPayload
            });

            const success = await initiateApprovalRequest({
                company_id: companyId,
                requested_by: userId,
                module_name: 'Sales Returns',
                action_name: isEditMode ? 'Edit' : 'Add',
                entity_id: isEditMode ? currentSalesReturnId : undefined,
                store_id: invoiceStoreId,
                action_payload: { operations }
            });

            if (success) {
                toast.success(isEditMode ? "Sales return update requested" : "Sales return creation requested");
                navigate("/dashboard/SalesReturns");
            }

        } catch (err: any) {
            console.error("Sales return submit error:", err);
            toast.error(err.message || "Failed to save sales return");
        }
    };

    const currentOrderStatus = systemMsgConfig.find(c => c.id === watch("returnStatus"));
    const currentApprovalStatus = allApprovalStatus?.at(-1);

    const showConfirmReturnBtn = (isEditMode || isViewMode) && !isPending &&
        currentOrderStatus?.sub_category_id === "APPROVER_COMPLETED" &&
        (currentApprovalStatus?.isFinalized || !currentApprovalStatus);

    const getCurrentOrderStatus = () => {
        // Edit Mode
        if (isEditMode || isViewMode) {

            if (!currentOrderStatus) return "";

            // Approval Pending
            if (currentOrderStatus.sub_category_id === "APPROVAL_PENDING") {
                return currentOrderStatus.value?.replace(
                    '{@}',
                    `${workflowConfig?.level || ''}`
                ) || '';
            }

            // Approved
            if (currentOrderStatus.sub_category_id === "APPROVER_COMPLETED" && currentApprovalStatus?.isFinalized) {
                return "Sales Return Approved";
            }

            // Completed without workflow
            if (currentOrderStatus.sub_category_id === "APPROVER_COMPLETED" && !workflowConfig) {
                return "Sales Return Approved";
            }

            // Rejected or others
            return currentOrderStatus.value || '';
        }

        // Create Mode
        return workflowConfig
            ? statusApprovalPending?.value?.replace(
                '{@}',
                `${workflowConfig?.level || ''}`
            ) || ''
            : statusApproverCompleted?.value?.replace(
                '{@} Approved',
                'Sales Return Approved'
            ) || '';
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-8">
                <PendingApprovalBanner />
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (isViewMode) {
                                navigate("/dashboard/SalesReturns");
                            } else {
                                setShowCancelDialog(true);
                            }
                        }}
                        className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
                        type="button"
                    >
                        <ArrowLeft className="h-5 w-5 text-blue-600" />
                    </Button>
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {isEditMode ? "Edit Sales Return" : isViewMode ? "View Sales Return" : "Create Sales Return"}
                            </h1>
                            <p className="text-gray-600">
                                {isEditMode
                                    ? "Modify the details of an existing sales return"
                                    : isViewMode ? "View the details of an existing sales return"
                                        : "Record returned items from customers"}</p>
                        </div>
                    </div>
                    {showConfirmReturnBtn && (
                        <div className="ml-auto">
                            <Button
                                type="button"
                                variant="default"
                                onClick={() => setIsConfirmReturnDialogOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" /> Confirm Return
                            </Button>
                        </div>
                    )}
                </div>

                {/* Main Card */}
                <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden bg-white">
                    <CardHeader className="px-6 pt-6">
                        <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Sales Return Request
                        </CardTitle>
                        <CardDescription className="text-blue-600">
                            Fill in the details below. Fields marked with{" "}
                            <span className="text-red-500">*</span> are required.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 space-y-10">
                        <form onSubmit={handleSubmit(
                            onSubmit,
                            (errors) => {
                                if (errors.return_items) {
                                    if ((errors.return_items as any).message) {
                                        toast.error((errors.return_items as any).message);
                                    } else {
                                        toast.error("Please fill in all required fields (such as Reason and Location) for the selected return items.");
                                    }
                                } else {
                                    toast.error("Please fill all required fields correctly.");
                                }
                            }
                        )} className="space-y-10">
                            {/* Basic Information */}
                            <Card className="border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <SquareChartGantt className="h-5 w-5" />
                                        Basic Information
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Return number, date and linked invoice details
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                    {/* Return Number */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <SquareChartGantt className="h-4 w-4" />
                                            Sales Return Number <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            {...register("returnNumber")}
                                            readOnly
                                            className="bg-gray-50 h-10"
                                        />
                                        <p className="text-sm text-red-600">{errors.returnNumber?.message}</p>
                                    </div>

                                    {/* Status */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <AlertCircle className="h-4 w-4" />
                                            Status <span className="text-red-500">*</span>
                                        </Label>
                                        <Input value={getCurrentOrderStatus() || ''} readOnly className="bg-gray-50 h-10" />
                                    </div>

                                    {/* Return Date */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <Calendar1 className="h-4 w-4" />
                                            Return Request Date <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            {...register("returnDate")}
                                            type="date"
                                            className="bg-gray-50 h-10"
                                            readOnly={isViewMode}
                                        />
                                        <p className="text-sm text-red-600">{errors.returnDate?.message}</p>
                                    </div>

                                    {/* Linked Invoice */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <Printer className="h-4 w-4" />
                                            Linked Invoice Number <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1">
                                                <Select
                                                    value={watch("invoiceId")}
                                                    onValueChange={(val) => {
                                                        setValue("invoiceId", val, { shouldValidate: true });
                                                        handleInvoiceChange(val);
                                                    }}
                                                    disabled={(!(salesInvoices.length > 0) && !isEditDataLoaded) || isViewMode}
                                                >
                                                    <SelectTrigger
                                                        className={`flex-1 h-10 ${errors.invoiceId ? "border-red-500 focus:ring-red-200" : ""
                                                            }`}
                                                    >
                                                        <SelectValue placeholder="Select Invoice" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {salesInvoices.map((inv) => (
                                                            <SelectItem key={inv.id} value={inv.id}>
                                                                {inv.invoice_number}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {selectedInvoice && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    onClick={() =>
                                                                        navigate(`/dashboard/invoice/view/${selectedInvoice}`)
                                                                    }
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10"
                                                                    type="button"
                                                                >
                                                                    <ArrowUpRight className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>View Invoice</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>

                                            {errors.invoiceId?.message && (
                                                <p className="text-sm text-red-600">
                                                    {errors.invoiceId.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Customer Name */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <User className="h-4 w-4" />
                                            Customer Name
                                        </Label>
                                        <Input value={customerName} readOnly className="bg-gray-50 h-10" />
                                    </div>

                                    {/* Contact Number */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <Phone className="h-4 w-4" />
                                            Contact Number
                                        </Label>
                                        <Input value={contactNumber} readOnly className="bg-gray-50 h-10" />
                                    </div>

                                    {/* Invoice Date */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <CalendarCheck2 className="h-4 w-4" />
                                            Date of Original Invoice
                                        </Label>
                                        <Input
                                            value={invoiceDate ? format(new Date(invoiceDate), "dd-MM-yyyy") : ""}
                                            readOnly
                                            className="bg-gray-50 h-10"
                                        />
                                    </div>

                                    {/* Sold From Store */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                                            <Store className="h-4 w-4" />
                                            Sold From Store
                                        </Label>
                                        <Input value={storeName} readOnly className="bg-gray-50 h-10" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Return Items */}
                            <Card className="border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <Package className="h-5 w-5" />
                                        Return Items
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Items from the selected invoice. Specify return quantity and reason.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-6">
                                    {/* If no invoice selected → show placeholder message */}
                                    {!selectedInvoice ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                            <p>Please select an invoice to view its items</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Selected Items Table – auto-populated from invoice */}
                                            {invoiceItems.length > 0 ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Label className="font-medium text-gray-800">Invoice Items</Label>
                                                            <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">
                                                                {invoiceItems.length}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                                                            className="text-blue-600 hover:text-blue-700"
                                                            type="button"
                                                        >
                                                            {isItemsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>

                                                    <div className={isItemsExpanded ? "block" : "hidden"}>
                                                        <div className="border rounded-lg overflow-hidden">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-blue-50">
                                                                    <tr>
                                                                        <th className="px-3 py-3 text-left font-medium text-blue-800">Item Name</th>
                                                                        <th className="px-3 py-3 text-center font-medium text-blue-800">Sold Qty</th>
                                                                        <th className="px-3 py-3 text-center font-medium text-blue-800">Returnable</th>
                                                                        <th className="px-3 py-3 text-center font-medium text-blue-800">Return Qty</th>
                                                                        <th className="px-3 py-3 text-left font-medium text-blue-800">Reason</th>
                                                                        <th className="px-3 py-3 text-left font-medium text-blue-800">Store → Location</th>

                                                                        {!isViewMode && (
                                                                            <th className="px-3 py-3 text-center font-medium text-blue-800">Action</th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {invoiceItems.map((item) => {
                                                                        const returnable = item.soldQty;
                                                                        return (
                                                                            <tr key={item.id} className="border-t hover:bg-gray-50">
                                                                                <td className="px-3 py-4 font-medium">{item.name}</td>
                                                                                <td className="px-3 py-4 text-center">{item.soldQty}</td>
                                                                                <td className="px-3 py-4 text-center">{returnable}</td>
                                                                                <td className="px-3 py-4">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        max={returnable}
                                                                                        value={returnQuantities[item.id] ?? 0}
                                                                                        onChange={(e) =>
                                                                                            updateReturnQty(item.id, e.target.value, returnable)
                                                                                        }
                                                                                        className="w-20 mx-auto text-center h-9"
                                                                                        readOnly={isViewMode}
                                                                                    />

                                                                                </td>

                                                                                {/* Reason for Return */}
                                                                                <td className="px-3 py-4">
                                                                                    {isViewMode ? (
                                                                                        <Input
                                                                                            value={returnReasons[item.id] || "-"}
                                                                                            readOnly
                                                                                            title={returnReasons[item.id] || "-"}
                                                                                            className="h-9 bg-gray-100 truncate overflow-hidden whitespace-nowrap"
                                                                                        />
                                                                                    ) : (
                                                                                        <Select
                                                                                            value={returnReasons[item.id] || ""}
                                                                                            onValueChange={(value) => updateReason(item.id, value)}
                                                                                        >
                                                                                            <SelectTrigger className="w-full h-9">
                                                                                                <SelectValue placeholder="Select reason" />
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="Damaged packaging">Damaged packaging</SelectItem>
                                                                                                <SelectItem value="Expired">Expired</SelectItem>
                                                                                                <SelectItem value="Wrong item supplied">Wrong item supplied</SelectItem>
                                                                                                <SelectItem value="Customer returned">Customer returned</SelectItem>
                                                                                                <SelectItem value="Other">Other</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    )}
                                                                                </td>

                                                                                {/* Store → Location */}
                                                                                <td className="px-3 py-4">
                                                                                    {isViewMode ? (
                                                                                        <div className="flex gap-2">
                                                                                            <Input
                                                                                                value={
                                                                                                    stores.find(s => s.id === returnStores[item.id])?.name || "-"
                                                                                                }
                                                                                                readOnly
                                                                                                className="h-9 bg-gray-100 truncate overflow-hidden whitespace-nowrap"
                                                                                                title={stores.find(s => s.id === returnStores[item.id])?.name || "-"}
                                                                                            />
                                                                                            <Input
                                                                                                value={
                                                                                                    locationsByItem[item.id]?.find(
                                                                                                        l => l.id === returnLocations[item.id]
                                                                                                    )
                                                                                                        ? `${locationsByItem[item.id]
                                                                                                            .find(l => l.id === returnLocations[item.id])!
                                                                                                            .shelf?.short_name} - ${locationsByItem[item.id]
                                                                                                                .find(l => l.id === returnLocations[item.id])!
                                                                                                                .cabinet?.short_name
                                                                                                        }`
                                                                                                        : "-"
                                                                                                }
                                                                                                readOnly
                                                                                                className="h-9 bg-gray-100 truncate overflow-hidden whitespace-nowrap"
                                                                                                title={
                                                                                                    locationsByItem[item.id]?.find(
                                                                                                        l => l.id === returnLocations[item.id]
                                                                                                    )
                                                                                                        ? `${locationsByItem[item.id]
                                                                                                            .find(l => l.id === returnLocations[item.id])!
                                                                                                            .shelf?.short_name} - ${locationsByItem[item.id]
                                                                                                                .find(l => l.id === returnLocations[item.id])!
                                                                                                                .cabinet?.short_name
                                                                                                        }`
                                                                                                        : "-"
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex gap-2">
                                                                                            <Select
                                                                                                value={returnStores[item.id] || ""}
                                                                                                onValueChange={(value) => updateStore(item.id, value)}
                                                                                            >
                                                                                                <SelectTrigger className="w-36 h-9">
                                                                                                    <SelectValue placeholder="Select Store" />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    {stores.map(store => (
                                                                                                        <SelectItem key={store.id} value={store.id}>
                                                                                                            {store.name}
                                                                                                        </SelectItem>
                                                                                                    ))}
                                                                                                </SelectContent>
                                                                                            </Select>

                                                                                            <Select
                                                                                                value={returnLocations[item.id] || ""}
                                                                                                onValueChange={(value) => updateLocation(item.id, value)}
                                                                                                disabled={!returnStores[item.id]}
                                                                                            >
                                                                                                <SelectTrigger className="w-40 h-9">
                                                                                                    <SelectValue placeholder="Select Location" />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    {(locationsByItem[item.id] || []).map(loc => (
                                                                                                        <SelectItem key={loc.id} value={loc.id}>
                                                                                                            {`${loc.shelf?.short_name} - ${loc.cabinet?.short_name}`}
                                                                                                        </SelectItem>
                                                                                                    ))}
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        </div>
                                                                                    )}
                                                                                </td>

                                                                                {!isViewMode && (
                                                                                    <td className="px-3 py-4 text-center">
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full"
                                                                                            onClick={() => {
                                                                                                setInvoiceItems((prev) => prev.filter((i) => i.id !== item.id));
                                                                                                const { [item.id]: _, ...newQtys } = returnQuantities;
                                                                                                setReturnQuantities(newQtys);
                                                                                                const { [item.id]: __, ...newReasons } = returnReasons;
                                                                                                setReturnReasons(newReasons);
                                                                                                const { [item.id]: ___, ...newStores } = returnStores;
                                                                                                setReturnStores(newStores);
                                                                                                const { [item.id]: ____, ...newLocs } = returnLocations;
                                                                                                setReturnLocations(newLocs);
                                                                                            }}
                                                                                            type="button"
                                                                                        >
                                                                                            <X className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-gray-500">
                                                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                                    <p>No items found in this invoice</p>
                                                </div>
                                            )}
                                            {errors.return_items && (errors.return_items as any).message && (
                                                <p className="text-sm text-red-600 flex items-center gap-1 mt-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    {(errors.return_items as any).message}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Remarks & Attachment */}
                            <Card className="border-none shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                                        <Paperclip className="h-5 w-5" />
                                        Remarks & Attachment
                                    </CardTitle>
                                    <CardDescription className="text-blue-600">
                                        Add any notes or supporting documents
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium">Remarks / Notes</Label>
                                        <Textarea
                                            placeholder="Any additional information about this return (condition of items, customer feedback, etc.)"
                                            className="min-h-[110px] resize-none border-input focus:ring-blue-200"
                                            {...register("remarks")}
                                            readOnly={isViewMode}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium">
                                            Attachment (JPG/PNG, max 5MB)
                                        </Label>
                                        <Input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={handleAttachmentChange}
                                            className="h-10 border-input file:mr-4 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            disabled={isViewMode}
                                        />
                                        {attachmentPreview && (
                                            <div className="relative inline-block">
                                                <img
                                                    src={attachmentPreview}
                                                    alt="Attachment Preview"
                                                    className="h-32 w-32 object-cover rounded-md border"
                                                />
                                                {!isViewMode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAttachmentPreview(null);
                                                            setValue("attachment", undefined);
                                                            setRemoveAttachment(true);
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                                                        title="Remove attachment"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Action Buttons */}
                            {!isViewMode && (
                                <div className="pt-6 border-t flex justify-end gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowCancelDialog(true)}
                                        className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700 px-8 min-w-[180px]"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {isEditMode ? "Updating..." : "Creating..."}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                {isEditMode ? "Update Return Request" : "Create Return Request"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
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
                            Are you sure you want to cancel? All unsaved changes will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-between sm:justify-end gap-3">
                        <DialogClose asChild>
                            <Button variant="outline">No, Continue</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                setShowCancelDialog(false);
                                navigate("/dashboard/SalesReturns");
                            }}
                        >
                            Yes, Cancel
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
                        <DialogDescription>
                            Are you sure you want to return these items and update inventory? This action cannot be undone.
                        </DialogDescription>
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
    );
}

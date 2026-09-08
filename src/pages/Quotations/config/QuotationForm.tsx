import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  FileText,
  Calendar1,
  Users,
  ShoppingCart,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef} from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";
import { PendingApprovalBanner } from "@/components/common/PendingApprovalBanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogDescription } from "@radix-ui/react-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ISystemMessageConfig } from "@/Utils/constants";

export const quotationSchema = z.object({
  quotationNumber: z.string().min(1, "Quotation number is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  quotation_items: z
    .array(
      z.object({
        id: z.string(),
        item_id: z.string(),
        item_name: z.string(),
        req_qty: z
          .number()
          .min(0, "Return quantity must not be negative"),
        cost_price: z
          .number()
          .min(0, "Return quantity must not be negative"),
      })
    )
    .min(1, "At least one item must be returned"),

});

export type QuotationFormValues = z.infer<typeof quotationSchema>;

interface UserData {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string;
  first_name: string;
  last_name: string;
  role_id: string;
  status: string;
  company_id: string;
  role_name: string;
  full_name: string;
}

interface PRItemProps {
  id: string;
  item_id: string;
  item_name: string;
  req_qty: number;
  cost_price: number;
}


const QuotationForm = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id) && location.pathname.includes('edit');
  const isViewMode = Boolean(id) && location.pathname.includes('view');
  const navigate = useNavigate();
  const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseRequisitions, setPurchaseRequisitions] = useState<any[]>([]);
  const [purchaseReqId, setPurchaseReqId] = useState<string | null>(null);
  const [purchaseReqItems, setPurchaseReqItems] = useState<any[]>([]);
  const [selectedPRItems, setSelectedPRItems] = useState<PRItemProps[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
    const [statusOptions, setStatusOptions] = useState<ISystemMessageConfig[]>([]);
  const [showReqItemsModal, setShowReqItemsModal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotationNumber: "",
      quotationDate: format(new Date(), "yyyy-MM-dd"),
      supplierId: "",
      quotation_items: []
    },
  });

  function generateQuotationNumber(lastNumber = 1): string {
    const prefix = 'QT'
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const serial = String(lastNumber).padStart(4, '0');

    return `${prefix}-${dd}${mm}${yy}-${serial}`;
  }

  useEffect(() => {
    const fetchAndSetNextQuotationNumber = async () => {
      try {
        if (!companyId || isEditMode || isViewMode) return;

        const prefix = 'QT'
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);

        const todayPrefix = `${prefix}-${dd}${mm}${yy}-`;

        const { data, error } = await supabase
          .from('quotation_master')
          .select('quotation_number')
          .eq('company_id', companyId)
          .like('quotation_number', `${todayPrefix}%`)
          .order('quotation_number', { ascending: false })
          .limit(1);

        let nextSerial = 1;

        if (!error && data && data.length > 0 && data[0].quotation_number) {
          const match = data[0].quotation_number.match(/-(\d{4})$/);
          if (match) {
            nextSerial = parseInt(match[1], 10) + 1;
          }
        }

        setValue('quotationNumber', generateQuotationNumber(nextSerial), { shouldValidate: true })
        console.log('generateQuotationNumber(nextSerial)', generateQuotationNumber(nextSerial),)

      } catch (error) {
        console.error('Error fetch and set next sales return number', error);
      }
    };

    fetchAndSetNextQuotationNumber();
  }, [companyId, isEditMode, isViewMode]);

  const validateAndFixQuotationNumber = async (quotationNumber: string, companyId: string | null): Promise<string> => {
    if (!companyId) return quotationNumber;

    try {
      const prefix = 'QT'
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);

      const todayPrefix = `${prefix}-${dd}${mm}${yy}-`;

      const match = quotationNumber.match(/-(\d{4})$/);
      const currentSerial = match ? parseInt(match[1], 10) : 1;

      const { data, error } = await supabase
        .from('quotation_master')
        .select('quotation_number')
        .eq('company_id', companyId)
        .like('quotation_number', `${todayPrefix}%`);

      if (error) throw error;


      const existingSerials =
        data
          ?.map((row: { quotation_number: string | null }) => {
            if (!row.quotation_number) return 0;
            const m = row.quotation_number.match(/-(\d{4})$/);
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

      return generateQuotationNumber(finalSerial);

    } catch (err) {
      console.error('Sales return number validation failed:', err);
      return quotationNumber;
    }
  };

        useEffect(() => {
    if (!companyId) return;

    const fetchStatusOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq('company_id', companyId)
          .eq('category_id', 'QUOTATION');
        if (error) {
          console.error('Error fetching status options:', error);
          return;
        }
        setStatusOptions(data);
      } catch (error) {
        console.error('Unexpected error fetching status options:', error);
      }
    };
    fetchStatusOptions();
  }, [companyId]);


  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataString = localStorage.getItem("userData");
        if (userDataString) {
          const userData: UserData = JSON.parse(userDataString);
          if (userData.company_id) {
            setCompanyId(userData.company_id);
            setUserId(userData.id);
            setUserRole(userData.role_name);
          } else {
            throw new Error("Company ID not found in user data");
          }
        } else {
          throw new Error("User data not found in local storage");
        }
      } catch (error) {
        console.error("Error fetching company_id from local storage:", error);
        toast.error("Failed to load user data. Please log in again.", {
          position: "top-center",
        });
        navigate("/login");
      }
    };

    loadUserData();
  }, [navigate]);

  function handlePRItemQtyChange(item: PRItemProps) {
    console.log('item', item)

    setSelectedPRItems((prev) => {
      const existingItem = selectedPRItems.find(prItem => prItem.id === item.id);
      if (existingItem) {
        return prev.map((prItem) =>
          prItem.id === item.id ? { ...prItem, req_qty: item.req_qty } : prItem
        )
      }
      return [...prev, item]
    })

  }

  useEffect(() => {
    if (!companyId) return;

    const fetchSuppliers = async () => {
      try {
        const { data, error } = await supabase
          .from('supplier_mgmt')
          .select('id,supplier_name')
          .eq('is_active', true)
          .eq('approval_status', 'APPROVED')
          .eq("company_id", companyId);

        if (error) throw error;

        if (data) {
          setSuppliers(data);
          console.log('suppliers', data);
        }

      } catch (error) {
        console.log('Error fetching suppliers', error)
      }

    }
    fetchSuppliers();
  }, [companyId])

  useEffect(() => {
    if (!companyId) return;

    const fetchPurchaseReq = async () => {
      try {
        const { data, error } = await supabase
          .from('purchase_req_master')
          .select('id, purchase_req_number')
          .eq('approval_status', 'APPROVED')
          .eq("company_id", companyId);

        if (error) throw error;

        if (data) {
          setPurchaseRequisitions(data);
          console.log('purchaseRequisitions', data);
        }

      } catch (error) {
        console.log('Error fetching purchase requisitions', error)
      }

    }
    fetchPurchaseReq();
  }, [companyId])

  useEffect(() => {
    if (!companyId || !purchaseReqId) return;

    const fetchPurchaseReqItems = async () => {
      try {
        const { data, error } = await supabase
          .from('purchase_req_details')
          .select(`item_mgmt:item_id(id,item_id,item_name),
            req_qty`)
          .eq('purchase_req_id', purchaseReqId)
          .eq("company_id", companyId);

        if (error) throw error;

        if (data) {
          setPurchaseReqItems(data);
          console.log('purchaseRequisitionItems', data);
        }

      } catch (error) {
        console.log('Error fetching requisition items', error)
      }

    }
    fetchPurchaseReqItems();
  }, [companyId, purchaseReqId])

  useEffect(() => {
    if (!id || !companyId) return;

    setIsLoadingQuotation(true);
    const fetchQuotation = async () => {
      try {
        const { data, error } = await supabase
          .from('quotation_master')
          .select(`quotation_number,quotation_date,supplier_id`)
          .eq('id', id)
          .eq('company_id', companyId)
          .single();

        if (error || !data) throw new Error('Failed to fetch quotation');

        const { data: quotation_items, error: qItemsError } = await supabase
          .from('quotation_details')
          .select(`item_mgmt:item_id(id,item_id,item_name),
              req_qty,cost_price`)
          .eq('quotation_id', id)
          .eq('company_id', companyId);

        if (qItemsError || !quotation_items) throw new Error('Failed to fetch quotation items');

        console.log('quotation_items', quotation_items);
        console.log('quotation_data', data);

       const mappedItems: PRItemProps[] = quotation_items.map((item) => ({
  id: item.item_mgmt.id,
  item_id: item.item_mgmt.item_id ?? "",
  item_name: item.item_mgmt.item_name,
  req_qty: item.req_qty ?? 0,
  cost_price: item.cost_price ?? 0,
}));

        reset({
          quotationNumber: data.quotation_number,
          quotationDate: data.quotation_date,
          supplierId: data.supplier_id,
          quotation_items: [...mappedItems]
        })

      } catch (error) {
        console.error("Error fetching quotation:", error);
        toast.error("Failed to fetch quotation data", { position: "top-center" });
        navigate("/dashboard/Quotations");
      } finally {
        setIsLoadingQuotation(false);
      }
    };
    fetchQuotation();
  }, [id, reset, companyId, navigate]);

  const onSubmit = async (data: QuotationFormValues) => {
    if (!companyId || !userId) return;

    try {
      const isDraftCorrection = new URLSearchParams(location.search).get('draft_correction') === 'true';

      if (isEditMode && id) {
            const isLocked = !isDraftCorrection ? await checkEntityLock(id) : false;
            if (isLocked) {
                toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
                return;
            }
        }

      let finalQuotationNumber = data.quotationNumber;
      if (!isEditMode) {
        finalQuotationNumber = await validateAndFixQuotationNumber(data.quotationNumber, companyId)
      }

      const issuedStatus = statusOptions.find(status => status.value === "Quotation Issued");
      const issuedStatusId = issuedStatus?.id;
      
      const payload = {
        quotation_number: `${finalQuotationNumber}`,
        quotation_date: data.quotationDate,
        supplier_id: data.supplierId,
        total_items: data.quotation_items.length
      }

      const quotationItemsPayload = data.quotation_items.map((item) => {
        return {
          item_id: item.id,
          req_qty: item.req_qty,
          cost_price: item.cost_price,
          company_id: companyId,
          created_at: new Date().toISOString()
        }
      })

      let draftId: string;

          if (isEditMode && id) {
            const { data: updated, error } = await supabase
              .from('quotation_master')
              .update(payload)
              .eq('id', id)
              .select()
              .single();

            if (error || !updated) throw error || new Error('Failed to update quotation');
            draftId = updated.id;

            const { error: deleteError } = await supabase
              .from('quotation_details')
              .delete()
              .eq('quotation_id', id);

            if (deleteError) throw deleteError;
          } else {
            const { data: created, error } = await supabase
              .from('quotation_master')
              .insert({
                ...payload,
                created_by: userId,
                company_id: companyId,
                created_at: new Date().toISOString(),
                approval_status: "DRAFT",
                pending_action: "ADD_PENDING"
              })
              .select()
              .single();

            if (error || !created) throw error || new Error('Failed to create quotation');
            draftId = created.id;
          }

          if (quotationItemsPayload.length > 0) {
            const finalItemsPayload = quotationItemsPayload.map(item => ({ ...item, quotation_id: draftId }));

            const { error: itemsError } = await supabase
              .from('quotation_details')
              .insert(finalItemsPayload);

            if (itemsError) throw itemsError;
          }
      
      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: "Quotation",
        scope:  isEditMode && !isDraftCorrection ? 'Edit' : 'Add',
        key: `${finalQuotationNumber}`,
        log: `Quotation ${finalQuotationNumber} ${isEditMode && !isDraftCorrection ? "updated" : "created"}.`,
        action_by: userId,
        created_at: new Date().toISOString(),
      };
      
      const operations: any[] = [
        {
          table: 'system_log',
          type: 'insert',
          data: systemLogs
        }
      ];

      let approvalResponse = { requires_approval: false, success: true };

            approvalResponse = await initiateApprovalRequest({
                    module_name: 'Quotations',
                    action_name: isEditMode ? 'Edit' : 'Add',
                    company_id: companyId ?? '',
                    requested_by: userId ?? '',
                    side_effects_payload: { operations },
                    entity_id: draftId,
                    table_name: 'quotation_master',
                    resubmit_request_id: isDraftCorrection ? new URLSearchParams(window.location.search).get('request_id') : null
                });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {      
        toast.success('Your action has been submitted and is currently pending approval.');
        } else {

          if (!isEditMode) {   
           await supabase
            .from('quotation_master')
            .update({ approval_status: 'APPROVED',
               pending_action: null,
               status_id: issuedStatusId || null } as any)
               .eq('id', draftId);
          }

          const { error: systemLogError } = await supabase
            .from('system_log')
            .insert(systemLogs);

          if (systemLogError) throw systemLogError;

          toast.success(isEditMode ? 'Quotation updated successfully!' : 'Quotation created successfully!');

        }
      }

      navigate("/dashboard/Quotations");
    } catch (error: any) {
      console.error("Quotation submit error:", error);
      toast.error(error.message || "Failed to save or update quotation");
    }
};

useEffect(() => {
  console.log('quotation_items', watch('quotation_items'))
}, [watch('quotation_items')])

let quotationItems: PRItemProps[] = watch('quotation_items');

const handleCancel = () => {
  reset({
    quotationNumber: "",
    quotationDate: format(new Date(), "yyyy-MM-dd"),
    supplierId: "",
    quotation_items: []
  });
  navigate("/dashboard/Quotations");
};

const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
};


return (
  <>
    {(isEditMode || isViewMode) && isLoadingQuotation ? (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <div className="text-lg text-gray-600">Loading quotation data...</div>
        </div>
      </div>
    ) : (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          {isViewMode && <PendingApprovalBanner />}
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
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {isEditMode ? "Edit Quotation" : isViewMode ? "View Quotation" : "Create Quotation"}
                </h1>
                <p className="text-gray-600">
                  {isViewMode ? "View Supplier quotation details" : isEditMode ? "Update Supplier quotation details" : "Request pricing from supplier based on Purchase Requisition"}</p>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                <FileText className="h-5 w-5" /> Quotation Details
              </CardTitle>
              <CardDescription className="text-blue-600">
                {isViewMode
                  ? "View the quotation details below."
                  : `Fill in the details below to ${isEditMode ? "update the existing" : "create a new"
                  } supplier quotation.`}
                {!isViewMode && (
                  <span>
                    {" "}
                    Fields marked with <span className="text-red-500">*</span> are
                    required.
                  </span>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-3">
              <form
                ref={formRef}
                onSubmit={handleSubmit(onSubmit,
                   (errors) => {
    console.log("FORM ERRORS:", errors);
  }
                )}
                className="grid gap-y-5"
              >
                <div className="space-y-6">
                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-[18px] text-blue-800 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Basic Information
                      </CardTitle>
                      <CardDescription className="text-blue-600">
                        Quotation number, date and supplier
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                          <FileText className="h-4 w-4" />
                          Quotation Number
                        </Label>
                        <Input
                          {...register("quotationNumber")}
                          readOnly
                          className="bg-gray-50 h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                          <Calendar1 className="h-4 w-4" />
                          <span> Date</span>
                        </Label>
                        <Input
                          type="date"
                          {...register("quotationDate")}
                          className="h-10 bg-gray-50"
                          readOnly={isViewMode}
                        />
                        <p className="text-sm text-red-600"></p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700 flex items-center gap-1.5 font-medium">
                          <Users className="h-4 w-4" />
                          Supplier <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex flex-col w-full">
                          <Select
                            value={watch("supplierId")}
                            onValueChange={(val) => {
                              setValue("supplierId", val, { shouldValidate: true });
                            }}
                            disabled={isViewMode}
                          >
                            <SelectTrigger
                              className="w-full"
                            >
                              <SelectValue placeholder="Select Supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.supplier_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ErrorMessage message={errors.supplierId?.message} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {!isViewMode &&
                    <Card className="border-none shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-[18px] text-blue-800 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Purchase Requisition
                        </CardTitle>
                        <CardDescription className="text-blue-600">
                          Select a purchase requisition to include its required items
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-[85%_15%] items-end">

                        <div className="space-y-2">
                          <Label className="text-gray-700 font-medium">
                            Select Purchase Requisition <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex items-center gap-1 w-full">
                            <Select
                              value={purchaseReqId || undefined}
                              onValueChange={(val) => setPurchaseReqId(val)}
                            >
                              <SelectTrigger
                                className="w-full"
                              >
                                <SelectValue placeholder="Choose a purchase requisition..." />
                              </SelectTrigger>
                              <SelectContent>
                                {purchaseRequisitions.map((pr) => (
                                  <SelectItem key={pr.id} value={pr.id}>
                                    {pr.purchase_req_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2 flex justify-end items-center">
                          <Button
                          type="button"
                            onClick={() => {
                              if (!purchaseReqId) {
                                toast.error("Please select a Purchase Requisition first")
                              } else {
                                setShowReqItemsModal(true);
                              }
                            }}
                            className="py-4 px-6 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-md text-white">
                            Select Items
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  }

                  <Card className="border-none shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-[18px] text-blue-800 flex items-center gap-2">
                        <ShoppingCart size={18} />
                        Quotation Items
                      </CardTitle>
                      <CardDescription className="text-blue-600">
                        Review items and enter cost prices
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-60">
                      <div className="">
                        {quotationItems.length === 0 ?
                          <div className="flex flex-col justify-center items-center gap-3 h-40">
                            <ShoppingCart size={45} className="text-gray-300" />
                            <p className="text-gray-500">No items added yet. Select a Purchase Requisition above to add items.</p>
                          </div>
                          :
                          <div className="rounded-md shadow border overflow-hidden my-3">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-md bg-blue-50">
                                  <TableHead className="w-[160px] ps-5 text-blue-800">Item Code</TableHead>
                                  <TableHead className="h-11 w-[200px] text-blue-800">Item Name</TableHead>
                                  <TableHead className="text-center w-[300px] text-blue-800">Quantity</TableHead>
                                  <TableHead className="text-center w-[300px] text-blue-800">Cost Price</TableHead>
                                  <TableHead className="text-center text-blue-800 w-[100px]">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {quotationItems.map((item: PRItemProps) => {

                                  return (
                                    <TableRow key={item.id} className="text-md bg-white">
                                      <TableCell className="font-semibold text-gray-800 ps-5">{item.item_id}</TableCell>
                                      <TableCell className="font-semibold text-gray-800">{item.item_name}</TableCell>
                                      <TableCell className="text-center">
                                        <Input
                                          value={item.req_qty ?? 0}
                                          className="text-center mx-auto w-[200px]"
                                          readOnly={isViewMode}
                                          type="number"
                                          max={item.req_qty ?? 0}
                                          min={1}
                                          onChange={(e) => {
                                            const newQty = Number(e.target.value)
                                            const updatedItems:any = quotationItems.map((qItem) => qItem.id === item.id ? { ...qItem, req_qty: newQty } : qItem)
                                            setValue('quotation_items', updatedItems)
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Input
                                          value={item.cost_price || 0}
                                          className=" text-center mx-auto w-[200px]"
                                          readOnly={isViewMode}
                                          type="number"
                                          min={0}
                                          onChange={(e) => {
                                            const newPrice = Number(e.target.value)
                                            const updatedItems:any = quotationItems.map((qItem) => qItem.id === item.id ? { ...qItem, cost_price: newPrice } : qItem)
                                            setValue('quotation_items', updatedItems)
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className='border border-red-300'
                                          disabled={isViewMode}
                                          onClick={() => {
                                            setValue('quotation_items', quotationItems.filter((qItem => qItem.id !== item.id)))
                                          }}
                                        >
                                          <X className=" text-red-600" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        }
                      </div>
                      </CardContent>
                    </Card>

          {!isViewMode && (
            <div className="flex justify-end gap-4 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors duration-200 px-6 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || quotationItems.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg px-6 py-2 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {isEditMode ? "Update Quotation" : "Create Quotation"}
                  </>
                )}
              </Button>
            </div>
          )}
                </div>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    )}

    <Dialog open={showReqItemsModal} onOpenChange={(open) => {
      setShowReqItemsModal(open);
      if (!open) {
        setPurchaseReqId(null);
        setSelectedPRItems([]);
      }
    }}>
      <DialogContent className="md:max-w-[55vw] p-0 gap-0 rounded-xl">
        <DialogHeader className="px-5 py-4 rounded-t-xl my-2">
          <DialogTitle className="text-blue-700 ps-1">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Select Items from Purchase Requisition</span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm ps-1">Check the items you want to include in this quotation. You can adjust <b>PR</b> quantities if needed</DialogDescription>
        </DialogHeader>
        <div className="rounded-md shadow border overflow-hidden mt-4 mb-6 mx-6">
          <Table>
            <TableHeader>
              <TableRow className="text-md bg-blue-50">
                <TableHead className="w-[80px]" />
                <TableHead className="w-[220px]"><span className="text-blue-800">Item Code</span></TableHead>
                <TableHead className="h-11 flex-1"><span className="ps-2 text-blue-800">Item Name</span></TableHead>
                <TableHead className=" w-[200px] text-center"><span className="pr-2 text-blue-800">PR Quantity</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseReqItems.map((item: any) => {
                const selectedItem: any = selectedPRItems.find(prItem => prItem.id === item.item_mgmt.id);
                const isSelected: boolean = Boolean(selectedItem);
                const currentQty: number = selectedItem?.req_qty ?? item.req_qty;

                return (
                  <TableRow key={item.item_mgmt.id} className="text-md bg-white">
                    <TableCell className="">
                      <span className="flex justify-start ps-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={quotationItems.some(qitem => qitem.id === item.item_mgmt.id)}
                          onCheckedChange={(isSelected) => {
                            console.log('selectedPRItems', selectedPRItems)
                            setSelectedPRItems((prev) => {
                              if (isSelected) {
                                return [...prev, { ...item.item_mgmt, req_qty: item.req_qty,cost_price: 0 }]
                              }
                              return prev.filter((prItem) => prItem.id !== item.item_mgmt.id)
                            })
                          }}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="">
                      <span className="font-semibold text-gray-800">{item.item_mgmt.item_id}</span>
                    </TableCell>
                    <TableCell className="">
                      <span className="font-semibold text-gray-800">{item.item_mgmt.item_name}</span>
                    </TableCell>
                    <TableCell className="">
                      <span className="flex justify-center items-center pr-1">
                        <Input
                          value={currentQty}
                          className="w-24 text-center"
                          type="number"
                          readOnly={quotationItems.some(qitem => qitem.id === item.item_mgmt.id)}
                          max={item.req_qty}
                          min={1}
                          onChange={(e) => {
                            handlePRItemQtyChange({ ...item.item_mgmt, req_qty: Number(e.target.value), cost_price: 0 })
                          }}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="bg-white border-t px-5 py-4 rounded-b-xl">
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowReqItemsModal(false);
                setPurchaseReqId(null);
                setSelectedPRItems([]);
              }}
              className="py-4 px-5 " variant="outline">
              Cancel
            </Button>
            <Button
              disabled={selectedPRItems.length === 0}
              onClick={() => {
                setShowReqItemsModal(false);
                const updatedItems:PRItemProps[] = [...quotationItems,...selectedPRItems]
                setValue('quotation_items', updatedItems)
                setPurchaseReqId(null);
                setSelectedPRItems([]);
              }}
              className="py-4 px-6 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-white">
              Confirm Selection
            </Button>

          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);
};

export default QuotationForm;

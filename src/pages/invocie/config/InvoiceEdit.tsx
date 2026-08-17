import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  ArrowLeft,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  MapPin,
  Mail,
  Phone,
  Search,
  Package,
  Store,
  Tag,
  UserPlus,
  CreditCard,
  Hash,
  Percent,
  CircleDollarSign,
  CirclePercent,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/Utils/types/supabaseClient';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/Utils/formatters';
import { checkEntityLock, initiateApprovalRequest } from '@/Utils/commonFun';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ItemDetailsModal from '@/components/inventory/ItemDetailsModal';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';
// Define Store type
type Store = {
  id: string;
  name: string;
  address?: string | null;
  is_active: boolean | null;
};

// Define Supply type
type Supply = {
  id: string;
  name: string;
  description: string;
  stock_date: string;
  price: number;
  po_number: string | null;
  availableStock?: number;
  inv_id: string;
};

// Schema for invoice items
const invoiceItemSchema = z.object({
  id: z.string().uuid('Item must have a valid UUID'),
  name: z.string().min(1, 'Item name is required').max(100, 'Item name must be less than 100 characters'),
  quantity: z.number().min(1, 'Quantity must be at least 1').int('Quantity must be an integer'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  total: z.number().min(0, 'Total cannot be negative'),
  availableStock: z.number().min(0).optional(),
  maxAllowedQuantity: z.number().optional(),
  tax_percentage: z.record(z.number()).nullable().optional(),
  inv_id: z.string().optional(),
  locationName: z.string().optional(),
  locationId: z.string().uuid().nullable().optional(),
}).refine(
  (data) => {
    const maxAllowed = data.maxAllowedQuantity ?? data.availableStock ?? Infinity;
    return data.quantity <= maxAllowed;
  },
  {
    message: 'Quantity exceeds allowed limit',
    path: ['quantity'],
  }
);

// Schema for the invoice
const invoiceFormSchema = z
  .object({
    storeId: z.string().min(1, "Store is required"),
    invoiceNumber: z.string().min(1, 'Invoice number is required'),
    date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Invalid date format'),
    customerName: z.string().min(1, 'Customer name is required'),
    contactNumber: z
      .string()
      .transform((val) => (val === '' ? undefined : val))
      .optional()
      .refine((val) => !val || /^[0-9]{10}$/.test(val), 'Contact number must be 10 digits'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    billingAddress: z.string().min(0, 'Billing address is required').optional(),
    items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
    additionalCharges: z.number().min(0, 'Additional charges cannot be negative').optional(),
    paymentMethod: z.enum(['cash', 'card', 'upi'], {
      required_error: 'Payment method is required',
    }),
    transactionId: z.string().optional(),
    globalDiscountPercent: z.number().min(0, "Discount percentage cannot be negative").optional(),
    globalDiscountAmount: z.number().min(0, "Discount amount cannot be negative").optional(),
    freightCharges: z.number().min(0, "Freight charges cannot be negative").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod !== 'cash' && (!data.transactionId || !data.transactionId.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transaction ID is required for card or UPI payments',
        path: ['transactionId'],
      });
    }
  });

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
type TaxPercentages = Record<string, number>;
type PaymentMethod = 'cash' | 'card' | 'upi';
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'upi'];

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  availableStock?: number;
  tax_percentage?: TaxPercentages | null;
  locationName?: string;
  locationId?: string | null;
  maxAllowedQuantity?: number;
}

type Customer = {
  id: string;
  fullname: string;
  address: string;
  company_id: string | null;
  created_at: string;
  created_by: string | null;
  customer_id: string | null;
  email: string | null;
  is_active: boolean | null;
  phone: string | null;
  type: string;
};

type InventoryLocationEntry = {
  locationId: string | null;
  qty: number;
  created_at: string;
  inv_id: string;   // ← This is the UUID from inventory_mgmt.id
};

type ItemInventoryDetails = Record<string, InventoryLocationEntry[]>;

type LocationNameMap = Record<string, string>;

// Schema for add customer modal
const addCustomerSchema = z.object({
  fullname: z.string().min(1, 'Full name is required').max(100, 'Full name must be less than 100 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  type: z.enum(['Retail', 'Wholesale', 'VIP'], { required_error: 'Please select a customer type' }),
});
type AddCustomerForm = z.infer<typeof addCustomerSchema>;
// Generate invoice number
function generateInvoiceNumber(lastNumber = 1): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const serial = String(lastNumber).padStart(4, '0');
  return `INV-${dd}${mm}${yy}-${serial}`;
}

export default function InvoiceEdit() {
  const userData = localStorage.getItem('userData');
  const user = userData ? JSON.parse(userData) : null;
  const companyId = user?.company_id;
  const userId = user?.id;
  const currencySymbol = user?.company_data?.currency ?? '$';

  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(false);
  const [_, setError] = useState('');
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [filteredSupplies, setFilteredSupplies] = useState<Supply[]>([]);
  const [showSuppliesDropdown, setShowSuppliesDropdown] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const containerRef = useRef(null);
  const [selectedItemIdForDetails, setSelectedItemIdForDetails] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const isEditingPercent = useRef(false);
  const isEditingAmount = useRef(false);
  const hasAppliedDefaultDiscount = useRef(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [itemInventoryDetails, setItemInventoryDetails] = useState<ItemInventoryDetails>({});
  const [itemTaxMap, setItemTaxMap] = useState<Record<string, Record<string, number>>>({});
  const [selectedInventoryRecords, setSelectedInventoryRecords] = useState<Supply[]>([]);

  const [locationNameMap, setLocationNameMap] = useState<LocationNameMap>({});
  const [itemsVersion, setItemsVersion] = useState(0);

  // Helper function to clear validation errors
  const clearValidationErrors = () => {
    setError('');
    setFormStatus('idle');
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setValue('paymentMethod', method, { shouldDirty: true, shouldValidate: true });
    if (method === 'cash') {
      setValue('transactionId', '', { shouldDirty: true });
    }
    clearValidationErrors();
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
    reset,
    watch,
    setValue,
    control,
    trigger,
    getValues,
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      storeId: '',
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      contactNumber: '',
      email: '',
      billingAddress: '',
      items: [],
      additionalCharges: 0,
      paymentMethod: 'cash',
      transactionId: '',
      globalDiscountPercent: 0,
      globalDiscountAmount: 0,
      freightCharges: 0,
    },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
    keyName: 'rhfId'
  });

  const watchedFields = watch();
  const items = watch("items");
  const globalPercent = watch("globalDiscountPercent");
  const globalAmount = watch("globalDiscountAmount");

  const initialValuesRef = useRef<any>(null);

  // Capture initial values
  useEffect(() => {
    if (!initialValuesRef.current) {
      initialValuesRef.current = getValues();
    }
  }, []);

  // Debug form state
  useEffect(() => {
    console.log('Form State:', { isValid, errors, items: watchedFields.items });
  }, [isValid, errors, watchedFields.items]);

  // Fetch stores for the company
  useEffect(() => {
    const fetchStores = async () => {
      if (!companyId) return;

      try {
        const { data, error } = await supabase
          .from('store_mgmt')
          .select('id, name, address, is_active')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Error fetching stores:', error);
          toast.error('Failed to fetch stores');
          return;
        }
        setStores(data || []);

      } catch (error) {
        console.error('Unexpected error fetching stores:', error);
        toast.error('An unexpected error occurred while fetching stores');
      }
    };

    fetchStores();
  }, [companyId]);

  // Fetch invoice data for editing
  useEffect(() => {
    if (isEditing && id) {
      setIsLoading(true);
      const fetchInvoice = async () => {
        try {
          const { data, error } = await supabase
            .from('sales_invoice')
            .select(`
            *,
            sales_invoice_items (
              item_id,
              quantity,
              unit_price,
              discount_percentage,
              tax_percentage,
              loc_id,
              item_mgmt (item_name, selling_price)
            ),
            customer_data: customer_mgmt!sales_invoice_customer_id_fkey(*)
          `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single();

          if (error || !data) throw new Error('Failed to fetch invoice');

          // Fetch current inventory details for all batches in the store
          const { data: inventoryDetailsData, error: inventoryDetailsError } = await supabase
            .from('inventory_mgmt')
            .select('id, item_qty, link_loc')
            .eq('company_id', companyId)
            .eq('store_id', data.store_id!);

          if (inventoryDetailsError) {
            console.error('Error fetching inventory details:', inventoryDetailsError);
            toast.error('Failed to fetch current stock details');
          }

          // Map: inv_id → current stock & location
          const batchMap = new Map<string, { currentQty: number; link_loc: string | null }>();
          inventoryDetailsData?.forEach((row: any) => {
            batchMap.set(row.id, {
              currentQty: row.item_qty || 0,
              link_loc: row.link_loc,
            });
          });

          const invoiceItems = data.sales_invoice_items.map((item: any) => {
            const invoicedQuantity = item.quantity || 0;
            const unitPrice = item.unit_price || 0;
            const discountPercentage = Number(item.discount_percentage) || 0;
            const total = invoicedQuantity * unitPrice * (1 - discountPercentage / 100);

            let taxes: Record<string, number> = {};
            if (item.tax_percentage) {
              taxes = typeof item.tax_percentage === "object"
                ? item.tax_percentage
                : JSON.parse(item.tax_percentage);
            }

            // Get loc_id array
            const locIdArray = item.loc_id as Array<{ id: string | null; inv_id: string; qty: number }> | null;
            const batchEntry = locIdArray?.[0];
            const batchInvId = batchEntry?.inv_id;

            // Current stock of this exact batch
            const currentBatchStock = batchInvId ? (batchMap.get(batchInvId)?.currentQty ?? 0) : 0;

            // Max allowed = current stock + previously invoiced
            const maxAllowedQuantity = currentBatchStock + invoicedQuantity;

            // Location
            const locationId = batchEntry?.id || batchMap.get(batchInvId || '')?.link_loc || null;
            const locationName = locationId ? (locationNameMap[locationId] || 'Unknown Location') : '';

            return {
              id: item.item_id,
              name: item.item_mgmt.item_name,
              quantity: invoicedQuantity,
              unitPrice: unitPrice,
              discount: discountPercentage,
              total: total,
              availableStock: currentBatchStock,
              maxAllowedQuantity: maxAllowedQuantity,
              tax_percentage: taxes,
              inv_id: batchInvId || undefined,
              locationId: locationId,
              locationName: locationName,
            };
          });

          const rawPaymentMode = typeof data.payment_mode === 'string' ? data.payment_mode.toLowerCase() : 'cash';
          const normalizedPaymentMethod = PAYMENT_METHODS.includes(rawPaymentMode as PaymentMethod)
            ? (rawPaymentMode as PaymentMethod)
            : 'cash';

          const nextValues = {
            storeId: data.store_id || '',
            invoiceNumber: data.invoice_number || '',
            date: data.invoice_date || '',
            customerName: data.customer_data?.fullname || data.customer_name || '',
            contactNumber: data.customer_data?.phone || data.contact_number || '',
            email: data.customer_data?.email || data.email || '',
            billingAddress: data.customer_data?.address || data.billing_address || '',
            items: invoiceItems,
            additionalCharges: 0,
            paymentMethod: normalizedPaymentMethod,
            transactionId: data.transaction_id || '',
            globalDiscountPercent: data.total_discount_percentage ?? 0,
            globalDiscountAmount: data.total_discount_amount ?? 0,
            freightCharges: data.freight_charges ?? 0,
          };

          reset(nextValues);
          initialValuesRef.current = nextValues;

          setSelectedCustomer(data?.customer_data ?? undefined);
          setSelectedStore(data?.store_id ?? '');

        } catch (err) {
          setError('Failed to load invoice data');
          setFormStatus('error');
        } finally {
          setIsLoading(false);
        }
      };
      fetchInvoice();
    }
  }, [id, isEditing, reset, companyId, locationNameMap]);

  // Fetch location names
  useEffect(() => {
    const fetchLocationNames = async () => {
      if (!companyId || !watchedFields.storeId) return;

      const { data, error } = await supabase
        .from('inventory_loc_mgmt')
        .select(`
        id,
        shelf_id,
        cabinet_id,
        shelf:inventory_loc_master!shelf_id (short_name),
        cabinet:inventory_loc_master!cabinet_id (short_name)
      `)
        .eq('company_id', companyId)
        .eq('store_Id', watchedFields.storeId);

      if (error) {
        console.error('Error fetching location names:', error);
        return;
      }

      const map: Record<string, string> = {};

      data?.forEach((loc: any) => {
        const shelfName = loc.shelf?.short_name || 'NO-SHELF';
        const cabinetName = loc.cabinet?.short_name || 'NO-CABINET';
        map[loc.id] = `${shelfName} — ${cabinetName}`;
      });

      setLocationNameMap(map);
    };

    fetchLocationNames();
  }, [companyId, watchedFields.storeId]);

  // Generate invoice number
  useEffect(() => {
    const fetchAndSetNextInvoiceNumber = async () => {
      if (isEditing) return;
      if (!companyId) return;
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const todayPrefix = `INV-${dd}${mm}${yy}-`;
      const { data, error } = await supabase
        .from('sales_invoice')
        .select('invoice_number')
        .eq('company_id', companyId)
        .like('invoice_number', `${todayPrefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1);
      let nextSerial = 1;
      if (!error && data && data.length > 0 && data[0].invoice_number) {
        const match = data[0].invoice_number.match(/-(\d{4})$/);
        if (match) {
          nextSerial = parseInt(match[1], 10) + 1;
        }
      }
      setValue('invoiceNumber', generateInvoiceNumber(nextSerial));
    };
    fetchAndSetNextInvoiceNumber();
  }, [isEditing, companyId, setValue]);

  // Fetch customers based on search term
  useEffect(() => {
    // If there's a selected customer and the search term exactly matches, don't fetch or show dropdown
    if (
      selectedCustomer &&
      customerSearchTerm.trim().toLowerCase() === selectedCustomer.fullname.toLowerCase()
    ) {
      setValue('customerName', selectedCustomer.fullname)
      setValue('email', selectedCustomer?.email ?? '')
      setValue('contactNumber', selectedCustomer?.phone ?? '')
      setValue('billingAddress', selectedCustomer?.address ?? '')
      setShowCustomerDropdown(false);
      setFilteredCustomers([]);
      return;
    }

    if (!customerSearchTerm.trim() || customerSearchTerm.trim().length < 3) {
      setFilteredCustomers([]);
      setShowCustomerDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('customer_mgmt')
          .select('id, fullname, address, company_id, created_at, created_by, customer_id, email, is_active, phone, type')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .eq('status', true)
          .or(`fullname.ilike.%${customerSearchTerm.trim()}%,customer_id.ilike.%${customerSearchTerm.trim()}%`)
          .limit(10);

        if (fetchError) throw fetchError;

        setFilteredCustomers(data);
        setShowCustomerDropdown(true);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to fetch customers. Please try again.');
        setFilteredCustomers([]);
        setShowCustomerDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [customerSearchTerm, selectedCustomer]);

  // Handle selecting a customer
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer.fullname);
    setShowCustomerDropdown(false);
  };

  const getTypeStyles = (type: string) => {
    switch (type.toLowerCase()) {
      case 'retail':
        return 'bg-green-100 text-green-800';
      case 'vip':
        return 'bg-yellow-100 text-yellow-800';
      case 'wholesale':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Handle store selection change
  const handleStoreChange = (storeId: string) => {
    setSelectedStore(storeId);
    setValue('storeId', storeId);

    // Clear existing items and search when store changes
    setFilteredSupplies([]);
    setItemSearchTerm('');
    setShowSuppliesDropdown(false);

    setItemInventoryDetails({});
    // Clear form items and reset validation state
    reset({
      ...watchedFields,
      storeId: storeId,
      items: [],
    });

    // Clear any existing validation errors
    clearValidationErrors();
  };

  // Item search - now filtered by selected store
  useEffect(() => {
    const fetchSupplies = async () => {
      if (!itemSearchTerm.trim() || itemSearchTerm.trim().length < 3 || !selectedStore) {
        setFilteredSupplies([]);
        setShowSuppliesDropdown(false);
        return;
      }

      try {
        // Fetch matching items from item_mgmt
        const { data: itemData, error: itemError } = await supabase
          .from("item_mgmt")
          .select("id, item_name, description")
          .eq("is_active", true)
          .eq("company_id", companyId)
          .or(`item_name.ilike.%${itemSearchTerm.trim()}%,description.ilike.%${itemSearchTerm.trim()}%`);

        if (itemError) {
          console.error("Error fetching items:", itemError);
          toast.error("Failed to fetch items");
          return;
        }

        if (!itemData || itemData.length === 0) {
          setFilteredSupplies([]);
          setShowSuppliesDropdown(true);
          return;
        }

        // Extract all item IDs
        const itemIds = itemData.map((i) => i.id);

        // Fetch inventory for these items in the selected store
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory_mgmt")
          .select(`
            id,
            item_id,
            item_qty,
            selling_price,
            created_at,
            purchase_order_id,
            purchase_order:purchase_order_id (po_number)
          `)
          .eq("store_id", selectedStore)
          .eq("company_id", companyId)
          .in("item_id", itemIds)
          .gt("item_qty", 0)
          .order('created_at', { ascending: true });

        if (inventoryError) {
          console.error("Error fetching inventory:", inventoryError);
          toast.error("Failed to fetch inventory");
          return;
        }

        // Build item lookup map
        const itemMap = itemData.reduce(
          (acc: Record<string, any>, item: any) => {
            acc[item.id] = item;
            return acc;
          },
          {}
        );

        // Map inventory rows to supplies list
        const mappedSupplies: Supply[] = (inventoryData || []).map((inv: any) => {
          const item = itemMap[inv.item_id];

          return {
            inv_id: inv.id, // inventory record id
            id: inv.item_id,
            name: item?.item_name ?? "Unnamed Item",
            description: item?.description ?? "No description",
            availableStock: inv.item_qty ?? 0,
            stock_date: inv.created_at,
            price: inv.selling_price
              ? parseFloat(inv.selling_price)
              : 0,
            po_number: inv.purchase_order?.po_number ?? null,
          };
        });

        setFilteredSupplies(mappedSupplies);
        setShowSuppliesDropdown(true);
      } catch (error) {
        console.error("Unexpected error in fetchSupplies:", error);
        toast.error("An unexpected error occurred");
      }
    };

    const timeoutId = setTimeout(fetchSupplies, 300);
    return () => clearTimeout(timeoutId);
  }, [itemSearchTerm, selectedStore, companyId]);

  const itemIds = useMemo(() => {
    return Array.from(
      new Set(watchedFields.items.map(item => item.id))
    );
  }, [watchedFields.items]);

  useEffect(() => {
    const fetchItemTaxes = async () => {
      if (itemIds.length === 0) return;

      const { data, error } = await supabase
        .from('item_mgmt')
        .select('id, tax_percentage')
        .in('id', itemIds);

      if (error) {
        console.error('Failed to fetch item taxes', error);
        return;
      }

      const taxMap: Record<string, Record<string, number>> = {};

      data?.forEach(item => {
        const tax: Record<string, number> = {};

        if (
          item.tax_percentage &&
          typeof item.tax_percentage === "object" &&
          !Array.isArray(item.tax_percentage)
        ) {
          for (const [key, val] of Object.entries(item.tax_percentage)) {
            if (typeof val === "number") tax[key] = val;
          }
        }

        taxMap[item.id] = tax;
      });

      setItemTaxMap(taxMap);
    };

    fetchItemTaxes();
  }, [itemIds]);


  const dynamicTaxLabels = useMemo(() => {
    const labelSet = new Set<string>();

    Object.values(itemTaxMap).forEach(taxes => {
      Object.keys(taxes).forEach(label => labelSet.add(label));
    });

    return Array.from(labelSet).sort();
  }, [itemTaxMap]);


  const handleSupplyToggle = (supply: Supply, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const isSelected = selectedInventoryRecords.some(r => r.inv_id === supply.inv_id);
    if (isSelected) {
      setSelectedInventoryRecords(prev => prev.filter(r => r.inv_id !== supply.inv_id));
    } else {
      setSelectedInventoryRecords(prev => [...prev, supply]);
    }
  };

  const handleConfirmSupplies = async () => {
    if (selectedInventoryRecords.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    // Get unique inv_ids
    const invIds = selectedInventoryRecords.map(r => r.inv_id);

    // Fetch full inventory records to get link_loc
    const { data: inventoryRecords, error: invError } = await supabase
      .from('inventory_mgmt')
      .select('id, link_loc')
      .in('id', invIds);

    if (invError || !inventoryRecords) {
      console.error('Error fetching inventory locations:', invError);
      toast.error('Failed to load location data');
      return;
    }

    // Create map: inv_id : link_loc
    const locationMap = inventoryRecords.reduce((acc: Record<string, string | null>, rec) => {
      acc[rec.id] = rec.link_loc;
      return acc;
    }, {});

    // Fetch tax_percentage for unique item_ids
    const uniqueItemIds = [...new Set(selectedInventoryRecords.map(r => r.id))];
    const { data: itemTaxData } = await supabase
      .from('item_mgmt')
      .select('id, tax_percentage')
      .in('id', uniqueItemIds);

    const taxMap = (itemTaxData || []).reduce((acc: Record<string, any>, item: any) => {
      acc[item.id] = typeof item.tax_percentage === 'object'
        ? item.tax_percentage
        : item.tax_percentage ? JSON.parse(item.tax_percentage) : null;
      return acc;
    }, {});

    // Add each selected record as separate line with correct location
    selectedInventoryRecords.forEach((record) => {
      const linkLoc = locationMap[record.inv_id] || null;
      const locationName = linkLoc
        ? (locationNameMap[linkLoc] || 'Unknown Location')
        : '';

      append({
        id: record.id,
        name: record.name,
        quantity: 1,
        unitPrice: record.price,
        discount: 0,
        total: record.price,
        availableStock: record.availableStock ?? 0,
        tax_percentage: taxMap[record.id] || null,
        inv_id: record.inv_id,
        locationId: linkLoc,
        locationName: locationName,
      });
    });

    // Clear
    setSelectedInventoryRecords([]);
    setItemSearchTerm('');
    setShowSuppliesDropdown(false);
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const qty = typeof item.quantity === "number" && !isNaN(item.quantity) ? item.quantity : 0;
    const price = typeof item.unitPrice === "number" && !isNaN(item.unitPrice) ? item.unitPrice : 0;
    const discount = typeof item.discount === "number" && !isNaN(item.discount) ? item.discount : 0;

    // Collect all tax percentages
    const taxes: Record<string, number> =
      item.tax_percentage && typeof item.tax_percentage === "object"
        ? item.tax_percentage
        : {};

    const totalTaxPercentage = Object.values(taxes)
      .filter(v => typeof v === "number" && !isNaN(v) && v > 0)
      .reduce((sum, v) => sum + v, 0);

    const baseTotal = qty * price;

    // Discount
    const discountAmount = (baseTotal * discount) / 100;
    const totalAfterDiscount = baseTotal - discountAmount;

    // Calculate tax on the base total
    const taxAmount = (totalAfterDiscount * totalTaxPercentage) / 100;

    const finalTotal = totalAfterDiscount + taxAmount;

    return Math.max(finalTotal, 0);
  };

  // Load default discount percentage from database
  useEffect(() => {
    if (isEditing) return;
    if (!companyId) return;
    if (hasAppliedDefaultDiscount.current) return;

    const loadGlobalDiscount = async () => {
      const { data } = await supabase
        .from("global_discount")
        .select("value")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .single();

      if (!data) {
        hasAppliedDefaultDiscount.current = true;
        return;
      }

      const percent = Number(data.value) || 0;

      isEditingPercent.current = false;
      isEditingAmount.current = false;
      setValue("globalDiscountPercent", percent, { shouldValidate: false, shouldDirty: false });

      hasAppliedDefaultDiscount.current = true;
      setTimeout(() => {
        isEditingPercent.current = true;
        isEditingAmount.current = true;
      }, 100);
    };

    loadGlobalDiscount();
  }, [companyId, isEditing, setValue]);

  // Handle global discount percentage → amount sync
  useEffect(() => {
    if (!isEditingPercent.current) return;

    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const percent = Number(globalPercent) || 0;

    if (itemsTotal === 0) {
      if (globalAmount !== 0) {
        isEditingAmount.current = false;
        setValue("globalDiscountAmount", 0);
        setTimeout(() => { isEditingAmount.current = true; }, 0);
      }
      return;
    }

    if (percent <= 0 || isNaN(percent)) {
      if (globalAmount !== 0) {
        isEditingAmount.current = false;
        setValue("globalDiscountAmount", 0);
        setTimeout(() => { isEditingAmount.current = true; }, 0);
      }
      return;
    }

    const nextAmount = Number(((itemsTotal * percent) / 100).toFixed(2));
    const currentAmount = Number(globalAmount ?? 0);

    if (Math.abs(currentAmount - nextAmount) > 0.01) {
      isEditingAmount.current = false;
      setValue("globalDiscountAmount", nextAmount);
      setTimeout(() => { isEditingAmount.current = true; }, 0);
    }
  }, [globalPercent, items, globalAmount, setValue, itemsVersion, isEditing]);

  // Handle global discount amount → percentage sync
  useEffect(() => {
    if (!isEditingAmount.current) return;

    const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const amount = Number(globalAmount) || 0;

    if (itemsTotal === 0) return;

    if (amount <= 0 || isNaN(amount)) {
      if (globalPercent !== 0) {
        isEditingPercent.current = false;
        setValue("globalDiscountPercent", 0);
        setTimeout(() => { isEditingPercent.current = true; }, 0);
      }
      return;
    }

    const nextPercent = Number(((amount / itemsTotal) * 100).toFixed(2));
    const currentPercent = Number(globalPercent ?? 0);

    if (Math.abs(currentPercent - nextPercent) > 0.01) {
      isEditingPercent.current = false;
      setValue("globalDiscountPercent", nextPercent);
      setTimeout(() => { isEditingPercent.current = true; }, 0);
    }
  }, [globalAmount, items, globalPercent, setValue, itemsVersion, isEditing]);

  // Total Calculation
  const calculateTotal = () => {
    const itemsTotal = watchedFields.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const additional = Number(watchedFields.additionalCharges) || 0;
    const freight = Number(watchedFields.freightCharges) || 0;

    const percent = Number(watchedFields.globalDiscountPercent) || 0;
    const amount = Number(watchedFields.globalDiscountAmount) || 0;

    // Calculate discountAmount
    let discountAmount = percent > 0
      ? (itemsTotal * percent) / 100
      : amount;

    // discount cannot exceed itemsTotal
    discountAmount = Math.min(discountAmount, itemsTotal);

    const totalAfterDiscount = itemsTotal - discountAmount;

    return totalAfterDiscount + additional + freight;
  };

  // Restore inventory quantities Function
  const restoreInventoryQuantities = async (
    restorations: Array<{ inv_id: string; qty: number }>
  ): Promise<void> => {
    if (restorations.length === 0) return;

    for (const { inv_id, qty } of restorations) {
      if (qty <= 0) continue;

      const { error } = await supabase
        .rpc('restore_inventory_qty', { inv_id, inc_qty: qty });

      if (error) {
        throw new Error(`Failed to restore ${qty} units to batch ${inv_id}: ${error.message}`);
      }
    }
  };

  // Function to handle form submission with proper validation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any existing validation errors
    clearValidationErrors();

    // Trigger validation for all fields
    const isValid = await trigger();

    if (!isValid) {
      setFormStatus('error');
      setError('Please fix the validation errors before submitting.');
      return;
    }

    // If validation passes, submit the form
    handleSubmit(onSubmit)(e);
  };

  // Reduce inventory and return the exact allocations used
  const reduceInventoryQuantities = async (
    allocations: Array<{ inv_id: string; qty: number }>
  ): Promise<void> => {
    if (allocations.length === 0) return;

    const invIds = allocations.map(a => a.inv_id);

    const { data: currentRecords, error: fetchError } = await supabase
      .from('inventory_mgmt')
      .select('id, item_qty')
      .in('id', invIds);

    if (fetchError || !currentRecords) {
      throw new Error('Failed to fetch current stock');
    }

    const currentQtyMap = currentRecords.reduce((map: Record<string, number>, rec) => {
      map[rec.id] = rec.item_qty ?? 0;
      return map;
    }, {});


    // Validate all allocations
    for (const alloc of allocations) {
      const available = currentQtyMap[alloc.inv_id] || 0;
      if (available < alloc.qty) {
        toast.error(`Insufficient stock in batch ${alloc.inv_id.substring(0, 8)}...: Available ${available}, Required ${alloc.qty}`);
        throw new Error('Insufficient stock in one or more batches');
      }
    }

    // If all valid, reduce stock
    for (const alloc of allocations) {
      const newQty = currentQtyMap[alloc.inv_id] - alloc.qty;
      const { error } = await supabase
        .from('inventory_mgmt')
        .update({ item_qty: newQty })
        .eq('id', alloc.inv_id);

      if (error) throw error;
    }
  };

  const handleItemChange = async (index: number, field: keyof InvoiceItem, value: any) => {
    const currentItem = watchedFields.items[index];
    let updatedItem = { ...currentItem, [field]: value };

    // Handle discount field
    if (field === 'discount') {
      if (value === '' || value === null) {
        updatedItem.discount = 0;
      } else {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed >= 0) {
          updatedItem.discount = parsed;
        } else {
          updatedItem.discount = 0;
        }
      }
    }

    // Handle quantity field
    else if (field === 'quantity') {
      if (value === '' || value === null || value === undefined) {
        updatedItem.quantity = 0;  // Treat empty as 0
      } else {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) {
          updatedItem.quantity = 0;
        } else {
          let maxAllowed;

          if (isEditing) {
            maxAllowed = updatedItem.maxAllowedQuantity ?? Infinity;
          } else {
            maxAllowed = updatedItem.availableStock ?? Infinity;
          }

          if (parsed > maxAllowed) {
            const msg = isEditing
              ? `Quantity cannot exceed maximum allowed (${maxAllowed})`
              : `Quantity cannot exceed available stock (${maxAllowed})`;
            toast.error(msg);
            updatedItem.quantity = maxAllowed;
          } else {
            updatedItem.quantity = parsed;
          }
        }
      }
    }

    // Handle unitPrice field
    else if (field === 'unitPrice') {
      if (value === '' || value === null) {
        updatedItem.unitPrice = 0;
      } else {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed >= 0) {
          updatedItem.unitPrice = parsed;
        } else {
          updatedItem.unitPrice = 0;
        }
      }
    }

    // Recalculate line total
    const subtotal = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0);
    const lineDiscount = (subtotal * (updatedItem.discount || 0)) / 100;
    const taxable = subtotal - lineDiscount;
    const taxTotal = dynamicTaxLabels.reduce((sum, label) => {
      const taxRate = Number(updatedItem.tax_percentage?.[label]) || 0;
      return sum + (taxable * taxRate) / 100;
    }, 0);
    updatedItem.total = taxable + taxTotal;

    // Update form
    setValue(`items.${index}`, updatedItem, {
      shouldValidate: true,
      shouldTouch: true,
    });

    // Force global discount recalculation
    await trigger();
    if (isEditing) {
      isEditingPercent.current = true;
      isEditingAmount.current = true;
    }

    setItemsVersion(prev => prev + 1);

    // Clear errors
    if (errors.items?.[index]?.[field]) {
      clearValidationErrors();
    }
  };

  // Validate invoice number before submit
  const validateAndFixInvoiceNumber = async (invoiceNumber: string) => {
    if (!companyId) return invoiceNumber;

    try {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const todayPrefix = `INV-${dd}${mm}${yy}-`;

      // Extract serial from invoice number
      const match = invoiceNumber.match(/-(\d{4})$/);
      const currentSerial = match ? parseInt(match[1], 10) : 1;

      // Get all today's invoices
      const { data, error } = await supabase
        .from('sales_invoice')
        .select('invoice_number')
        .eq('company_id', companyId)
        .like('invoice_number', `${todayPrefix}%`);

      if (error) throw error;

      const existingSerials =
        data
          ?.map((row: { invoice_number: string | null }) => {
            if (!row.invoice_number) return 0;
            const m = row.invoice_number.match(/-(\d{4})$/);
            return m ? parseInt(m[1], 10) : 0;
          })
          .filter(n => !isNaN(n)) ?? [];


      const next =
        existingSerials.length > 0
          ? Math.max(...existingSerials) + 1
          : 1;

      const finalSerial = existingSerials.includes(currentSerial)
        ? next
        : currentSerial;

      return generateInvoiceNumber(finalSerial);

    } catch (err) {
      console.error("Invoice number validation failed:", err);
      return invoiceNumber;
    }
  };

  const onSubmit: SubmitHandler<InvoiceFormValues> = async (data) => {
    console.log('Form submitted with data:', data);
    setError('');
    setFormStatus('submitting');

    try {
      setIsLoading(true);

      if (isEditing && id) {
        const isLocked = await checkEntityLock(id);
        if (isLocked) {
          toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
          setIsLoading(false);
          setFormStatus('idle');
          return;
        }
      }

      const restoreAllocations: Array<{ inv_id: string; qty: number }> = [];
      const reduceAllocations: Array<{ inv_id: string; qty: number }> = [];

      // Edit mode
      if (isEditing && id) {
        // Fetch original invoice to compare quantities
        const { data: originalInvoice, error: fetchError } = await supabase
          .from('sales_invoice')
          .select('sales_invoice_items(item_id, quantity, loc_id)')
          .eq('id', id)
          .single();

        if (fetchError || !originalInvoice) {
          throw new Error('Failed to fetch original invoice for stock adjustment');
        }

        const originalItems = originalInvoice.sales_invoice_items;

        // Map original batch (inv_id) → quantity sold
        const originalBatchQtyMap = new Map<string, number>();
        originalItems.forEach((item: any) => {
          const locIdArray = item.loc_id as Array<{ inv_id: string; qty: number }> | null;
          if (locIdArray?.[0]?.inv_id) {
            originalBatchQtyMap.set(locIdArray[0].inv_id, item.quantity);
          }
        });

        // Check updated items
        data.items.forEach((currentItem) => {
          const currentQty = currentItem.quantity || 0;
          const invId = currentItem.inv_id;
          if (!invId) return;

          const originalQty = originalBatchQtyMap.get(invId) || 0;
          const delta = currentQty - originalQty;

          if (delta > 0) {
            // Reduce more from same batch
            reduceAllocations.push({ inv_id: invId, qty: delta });
          } else if (delta < 0) {
            // Restore to same batch
            restoreAllocations.push({ inv_id: invId, qty: -delta });
          }
        });

        // Check removed items
        originalItems.forEach((origItem: any) => {
          const locIdArray = origItem.loc_id as Array<{ inv_id: string }> | null;
          const origInvId = locIdArray?.[0]?.inv_id;
          if (!origInvId) return;

          const stillExists = data.items.some(item => item.inv_id === origInvId);
          if (!stillExists) {
            restoreAllocations.push({
              inv_id: origInvId,
              qty: origItem.quantity,
            });
          }
        });
      }
      // Create mode: Reduce stock
      else {
        data.items.forEach((item) => {
          const qty = item.quantity || 0;
          if (qty > 0 && item.inv_id) {
            reduceAllocations.push({ inv_id: item.inv_id, qty });
          }
        });
      }

      // Calculate amounts
      const grossItemsTotal = data.items.reduce((sum, item) => {
        return sum + (item.quantity || 0) * (item.unitPrice || 0);
      }, 0);

      const totalDiscountAmount = data.items.reduce((sum, item) => {
        const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + (subtotal * (item.discount || 0)) / 100;
      }, 0);

      // Total tax amount
      const totalTaxAmount = data.items.reduce((sum, item) => {
        const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
        const lineDiscount = (subtotal * (item.discount || 0)) / 100;
        const taxable = subtotal - lineDiscount;

        const taxes = item.tax_percentage && typeof item.tax_percentage === "object" ? item.tax_percentage : {};
        return sum + Object.values(taxes).reduce((s, v) => s + Number(v || 0), 0) * taxable / 100;
      }, 0);

      // Global discount
      const globalDiscountAmount = Number(data.globalDiscountAmount) || 0;

      // Freight charges
      const freightCharges = Number(data.freightCharges) || 0;
      const additionalCharges = Number(data.additionalCharges) || 0;

      const grossAmount = grossItemsTotal + additionalCharges;
      const netAmount = grossItemsTotal + additionalCharges + totalTaxAmount + freightCharges - totalDiscountAmount - globalDiscountAmount;

      let finalInvoiceNumber = data.invoiceNumber;
      if (!isEditing) {
        finalInvoiceNumber = await validateAndFixInvoiceNumber(data.invoiceNumber);
      }

      const invoicePayload = {
        invoice_number: finalInvoiceNumber,
        invoice_date: data.date,
        customer_name: data.customerName,
        billing_address: data.billingAddress,
        contact_number: data.contactNumber,
        email: data.email || null,
        total_items: data.items.length,
        invoice_amount: grossAmount,
        discount_amount: totalDiscountAmount,
        tax_amount: totalTaxAmount,
        net_amount: netAmount,
        created_at: new Date().toISOString(),
        created_by: userId,
        company_id: companyId,
        customer_id: selectedCustomer?.id || null,
        store_id: data.storeId,
        payment_mode: data.paymentMethod,
        transaction_id: data.paymentMethod === 'cash' ? null : (data.transactionId?.trim() || null),
        total_discount_amount: globalDiscountAmount,
        total_discount_percentage: data.globalDiscountPercent || 0,
        freight_charges: freightCharges,
      };

      const normalizeTax = (taxObj: Record<string, number> | null | undefined) => {
        if (!taxObj || typeof taxObj !== "object") return null;
        return Object.keys(taxObj).length === 0 ? null : taxObj;
      };

      const itemsPayload = data.items.map(item => {
        const qty = item.quantity || 0;

        const locIdEntry = qty > 0 && item.inv_id
          ? [{
            id: item.locationId || null,
            qty: qty,
            inv_id: item.inv_id,
          }]
          : null;

        return {
          item_id: item.id,
          quantity: qty,
          unit_price: item.unitPrice || 0,
          discount_percentage: item.discount || 0,
          tax_percentage: normalizeTax(item.tax_percentage),
          loc_id: locIdEntry,
          company_id: companyId,
          created_at: new Date().toISOString(),
        };
      });

      // --- BUILD APPROVAL OPERATIONS PAYLOAD ---
      const operations: any[] = [];

      restoreAllocations.forEach(alloc => {
        operations.push({
          type: 'rpc',
          function_name: 'restore_inventory_qty',
          data: { inv_id: alloc.inv_id, inc_qty: alloc.qty }
        });
      });

      reduceAllocations.forEach(alloc => {
        operations.push({
          type: 'rpc',
          function_name: 'reduce_inventory_qty',
          data: { inv_id: alloc.inv_id, dec_qty: alloc.qty }
        });
      });

      if (isEditing && id) {
        operations.push({
          table: 'sales_invoice',
          type: 'update',
          data: invoicePayload,
          conditions: { id: id }
        });
      } else {
        operations.push({
          table: 'sales_invoice',
          type: 'insert',
          data: { ...invoicePayload, id: "{{sales_invoice_id}}" },
          return_id: true,
          return_id_key: "sales_invoice_id"
        });
      }

      operations.push({
        table: 'system_log',
        type: 'insert',
        data: {
          company_id: companyId,
          transaction_date: invoicePayload.created_at,
          module: 'Sales Invoice',
          scope: isEditing ? 'Edit' : 'Add',
          key: finalInvoiceNumber,
          log: `Invoice: ${finalInvoiceNumber} ${isEditing ? 'updated' : 'created'}.`,
          action_by: userId,
          created_at: invoicePayload.created_at,
        }
      });

      if (isEditing && id) {
        operations.push({
          table: 'sales_invoice_items',
          type: 'delete',
          conditions: { sales_invoice_id: id }
        });
      }

      itemsPayload.forEach(item => {
        operations.push({
          table: 'sales_invoice_items',
          type: 'insert',
          data: isEditing ? { ...item, sales_invoice_id: id } : { ...item, sales_invoice_id: "{{sales_invoice_id}}" }
        });
      });

      // Initiate Approval
      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Sales Invoice',
        action_name: isEditing ? 'Edit' : 'Add',
        company_id: companyId ?? '',
        store_id: data.storeId,
        requested_by: userId ?? '',
        action_payload: { operations },
        entity_id: isEditing ? id : null
      });

      if (approvalResponse.requires_approval) {
        toast.success(isEditing ? 'Invoice update submitted for approval!' : 'Invoice creation submitted for approval!');
        setFormStatus('success');
        setTimeout(() => navigate('/dashboard/invoice'), 1000);
        return;
      }

      // --- DIRECT EXECUTION FALLBACK ---
      if (restoreAllocations.length > 0) {
        await restoreInventoryQuantities(restoreAllocations);
      }
      if (reduceAllocations.length > 0) {
        await reduceInventoryQuantities(reduceAllocations);
      }

      let invoiceId: string;

      // Create or Update invoice header
      if (isEditing && id) {
        const { data: updated, error } = await supabase
          .from('sales_invoice')
          .update(invoicePayload)
          .eq('id', id)
          .select()
          .single();

        if (error || !updated) throw error || new Error('Failed to update invoice');
        invoiceId = updated.id;

        // System log
        await supabase.from('system_log').insert({
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: 'Sales Invoice',
          scope: 'Edit',
          key: finalInvoiceNumber,
          log: `Invoice: ${finalInvoiceNumber} updated.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        });

        await supabase.from('sales_invoice_items').delete().eq('sales_invoice_id', id);
      } else {
        const { data: created, error } = await supabase
          .from('sales_invoice')
          .insert([invoicePayload])
          .select()
          .single();

        if (error || !created) throw error || new Error('Failed to create invoice');
        invoiceId = created.id;

        // System log
        await supabase.from('system_log').insert({
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: 'Sales Invoice',
          scope: 'Add',
          key: finalInvoiceNumber,
          log: `Invoice: ${finalInvoiceNumber} created.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        });
      }

      if (itemsPayload.length > 0) {
        const finalItemsPayload = itemsPayload.map(item => ({ ...item, sales_invoice_id: invoiceId }));
        const { error: itemsError } = await supabase
          .from('sales_invoice_items')
          .insert(finalItemsPayload);

        if (itemsError) throw itemsError;
      }

      toast.success(isEditing ? 'Invoice updated successfully!' : 'Invoice created successfully!');
      setFormStatus('success');
      setTimeout(() => navigate('/dashboard/invoice'), 1000);

    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      setError(error.message || 'Failed to save invoice');
      setFormStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Customer modal form
  const {
    register: registerCustomer,
    handleSubmit: handleCustomerSubmit,
    formState: { errors: customerErrors },
    setValue: setCustomerValue,
    reset: resetCustomer,
    watch: watchCustomer,
  } = useForm<AddCustomerForm>({
    resolver: zodResolver(addCustomerSchema),
    defaultValues: {
      fullname: '',
      phone: '',
      email: '',
      type: 'Retail',
    },
  });
  const onCustomerSubmit: SubmitHandler<AddCustomerForm> = async (data) => {
    try {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const todayPrefix = `CUST-${dd}${mm}${yy}-`;
      const { data: idData, error: fetchIdError } = await supabase
        .from('customer_mgmt')
        .select('customer_id')
        .eq('company_id', companyId)
        .like('customer_id', `${todayPrefix}%`)
        .order('customer_id', { ascending: false })
        .limit(1);
      let nextSerial = 1;
      if (!fetchIdError && idData && idData.length > 0 && idData[0].customer_id) {
        const match = idData[0].customer_id.match(/-(\d{4})$/);
        if (match) {
          nextSerial = parseInt(match[1], 10) + 1;
        }
      }
      const nextCustomerId = `CUST-${dd}${mm}${yy}-${String(nextSerial).padStart(4, '0')}`;
      const customerPayload = {
        fullname: data.fullname,
        phone: data.phone,
        email: data.email || null,
        type: data.type,
        status: true,
        company_id: companyId,
        notifications: false,
        created_by: userId,
        created_at: new Date().toISOString(),
        customer_id: nextCustomerId,
        address: ''
      };
      const { data: newCustomer, error } = await supabase
        .from('customer_mgmt')
        .insert([customerPayload])
        .select()
        .single();
      if (error || !newCustomer) throw error || new Error('Customer creation failed');
      // System log
      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: 'Customer Management',
        scope: 'Add',
        key: `${nextCustomerId}`,
        log: `Customer: ${nextCustomerId} created.`,
        action_by: userId,
        created_at: new Date().toISOString(),
      };
      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);
      if (systemLogError) throw systemLogError;
      // Populate invoice fields
      setSelectedCustomer(newCustomer);
      setCustomerSearchTerm(newCustomer.fullname);
      setShowCustomerDropdown(false);
      setValue('customerName', newCustomer.fullname);
      setValue('contactNumber', newCustomer.phone || '');
      setValue('email', newCustomer.email || '');
      setValue('billingAddress', '');
      toast.success('Customer created successfully!');
      setShowAddCustomerModal(false);
      resetCustomer();
    } catch (err: any) {
      console.error('Error creating customer:', err);
      toast.error(err.message || 'Failed to create customer');
    }
  };
  const openAddCustomerModal = () => {
    resetCustomer({
      fullname: customerSearchTerm,
      phone: '',
      email: '',
      type: 'Retail',
    });
    setShowAddCustomerModal(true);
  };
  if (isLoading && isEditing) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading invoice data...</p>
      </div>
    );
  }
  const hasUnsavedChanges = isDirty || JSON.stringify(watchedFields) !== JSON.stringify(initialValuesRef.current || {});
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowCancelDialog(true);
              } else {
                navigate('/dashboard/invoice');
              }
            }}
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
                {isEditing ? 'Update Invoice' : 'Create New Invoice'}
              </h1>
              <p className="text-gray-600">Create or update invoice details</p>
            </div>
          </div>
        </div>
        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">Invoice Information</CardTitle>
            <CardDescription className="text-blue-600">
              {isEditing ? 'Update the invoice details below' : 'Fill in the invoice details below to create a new invoice'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="space-y-2 group">
                  <Label
                    htmlFor="invoiceNumber"
                    className={`${errors.invoiceNumber ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <FileText className="h-4 w-4" /> Invoice Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="invoiceNumber"
                    placeholder="INV-YYYY-XXX"
                    {...register('invoiceNumber')}
                    className={`${errors.invoiceNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 bg-gray-50 ${watchedFields.invoiceNumber ? 'border-blue-300' : ''}`}
                    readOnly
                  />
                  {errors.invoiceNumber && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.invoiceNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2 group">
                  <Label
                    htmlFor="store"
                    className={`${errors.storeId ? 'text-red-500' : 'text-gray-700'} 
                                group-hover:text-blue-700 transition-colors duration-200 
                                flex items-center gap-1 font-medium`}
                  >
                    <Store className="h-4 w-4" /> Store <span className="text-red-500">*</span>
                  </Label>
                  <Select onValueChange={handleStoreChange} value={selectedStore}>
                    <SelectTrigger
                      className={`w-full pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200
                          ${errors.storeId
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                    >
                      <SelectValue placeholder="Select a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {errors.storeId && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.storeId.message}
                    </p>
                  )}

                  {!selectedStore && !errors.storeId && (
                    <p className="text-sm text-blue-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Please select a store to search for items
                    </p>
                  )}
                </div>
                <div className="space-y-2 group">
                  <Label
                    htmlFor="date"
                    className={`${errors.date ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Calendar className="h-4 w-4" /> Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    {...register('date')}
                    onChange={() => {
                      // Clear validation errors when user starts typing
                      if (errors.date) {
                        clearValidationErrors();
                      }
                    }}
                    className={`${errors.date ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.date ? 'border-blue-300' : ''}`}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.date.message}
                    </p>
                  )}
                </div>
                <div ref={containerRef} className="space-y-2 group relative">
                  <Label className={`${errors.customerName ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <User className="h-4 w-4" /> Customer Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Search customer by name or customer ID..."
                      value={isEditing ? selectedCustomer?.fullname : customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        if (selectedCustomer) {
                          setSelectedCustomer(undefined); // Clear selection if user edits the input
                        }
                      }}
                      onFocus={() => {
                        if (
                          filteredCustomers.length > 0 &&
                          (!selectedCustomer || customerSearchTerm.trim().toLowerCase() !== selectedCustomer.fullname.toLowerCase())
                        ) {
                          setShowCustomerDropdown(true);
                        }
                      }}
                      className={`pr-4 py-2 rounded-md shadow-sm focus:ring-4 ${errors.customerName
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } transition-all duration-200`}
                    />
                    {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                  </div>
                  {errors.customerName && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.customerName.message}
                    </p>
                  )}
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                      {/* Header */}
                      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            Available Customers ({filteredCustomers.length})
                          </span>
                        </div>
                      </div>
                      {/* List of Customers */}
                      <div className="max-h-80 overflow-y-auto">
                        {filteredCustomers.map((customer, index) => (
                          <div
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors duration-200 ${index !== filteredCustomers.length - 1 ? 'border-b border-gray-100' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              {/* Customer Details */}
                              <div className='flex'>
                                <div className='me-3'>
                                  <User className="h-4 w-4 text-gray-400 mt-1" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-gray-900 text-sm">{customer.fullname}</p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>ID:</span>
                                    <span className="text-gray-600">{customer.customer_id || customer.id}</span>
                                  </div>
                                </div>
                              </div>
                              {/* Customer Type Badge */}
                              <div className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeStyles(customer.type)}`}>
                                {customer.type}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {showCustomerDropdown && customerSearchTerm.trim().length >= 3 && filteredCustomers.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="p-4 text-center text-gray-500 text-sm">
                        <p className='mb-2'>No customers found for "{customerSearchTerm}"</p>
                        <Button
                          onClick={openAddCustomerModal}
                          className="transition-colors"
                          type='button'
                        >
                          Create Customer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 group">
                  <Label
                    htmlFor="contactNumber"
                    className={`${errors.contactNumber ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Phone className="h-4 w-4" /> Contact Number
                  </Label>
                  <Input
                    id="contactNumber"
                    value={selectedCustomer?.phone ?? ''}
                    readOnly
                    placeholder="10 digits"
                    onChange={() => {
                      // Clear validation errors when user starts typing
                      if (errors.contactNumber) {
                        clearValidationErrors();
                      }
                    }}
                    className={`${errors.contactNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.contactNumber ? 'border-blue-300' : ''}`}
                  />
                  {errors.contactNumber && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.contactNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2 group">
                  <Label
                    htmlFor="email"
                    className={`${errors.email ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    id="email"
                    value={selectedCustomer?.email ?? ''}
                    readOnly
                    placeholder="example@example.com"
                    onChange={() => {
                      // Clear validation errors when user starts typing
                      if (errors.email) {
                        clearValidationErrors();
                      }
                    }}
                    className={`${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.email ? 'border-blue-300' : ''}`}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2 group">
                  <Label
                    htmlFor="billingAddress"
                    className={`${errors.billingAddress ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <MapPin className="h-4 w-4" /> Billing Address
                  </Label>
                  <Textarea
                    id="billingAddress"
                    value={selectedCustomer?.address ?? ''}
                    readOnly
                    placeholder="Billing address"
                    onChange={() => {
                      // Clear validation errors when user starts typing
                      if (errors.billingAddress) {
                        clearValidationErrors();
                      }
                    }}
                    className={`w-full resize-none min-h-[100px] ${errors.billingAddress ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.billingAddress ? 'border-blue-300' : ''}`}
                  />
                  {errors.billingAddress && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.billingAddress.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="paymentMethod"
                      className={`${errors.paymentMethod ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> Payment Method <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={watchedFields.paymentMethod}
                      onValueChange={(value) => handlePaymentMethodChange(value as PaymentMethod)}
                    >
                      <SelectTrigger
                        id="paymentMethod"
                        className={`w-full pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${errors.paymentMethod
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          }`}
                      >
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.paymentMethod && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.paymentMethod.message}
                      </p>
                    )}
                  </div>

                  {watchedFields.paymentMethod && watchedFields.paymentMethod !== 'cash' && (
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="transactionId"
                        className={`${errors.transactionId ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Hash className="h-4 w-4" /> Transaction ID <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="transactionId"
                        placeholder="Enter transaction reference"
                        value={watchedFields.transactionId || ''}
                        onChange={(e) => {
                          setValue('transactionId', e.target.value, { shouldDirty: true });
                          if (errors.transactionId) {
                            clearValidationErrors();
                          }
                        }}
                        className={`${errors.transactionId ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                      />
                      {errors.transactionId && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.transactionId.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2 group relative">
                  <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium">
                    <Search className="h-4 w-4" /> Search Items
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={selectedStore ? "Search for items by name or description..." : "Please select a store first"}
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      onFocus={() => selectedStore && setShowSuppliesDropdown(true)}
                      disabled={!selectedStore}
                      className={`pl-10 pr-4 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${selectedStore
                        ? 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                        }`}
                    />
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${selectedStore ? 'text-gray-400' : 'text-gray-300'
                      }`} />
                  </div>
                  {showSuppliesDropdown && filteredSupplies.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            Available Items ({filteredSupplies.length})
                          </span>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {filteredSupplies.map((supply, index) => {
                          const isOutOfStock = (supply.availableStock ?? 0) <= 0;

                          return (
                            <div
                              key={supply.inv_id}
                              className={`p-3 hover:bg-blue-50 transition-colors duration-200 ${index !== filteredSupplies.length - 1 ? "border-b border-gray-100" : ""
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div>
                                          <Checkbox
                                            disabled={isOutOfStock || fields.some((f) => f.inv_id === supply.inv_id)}
                                            checked={fields.some((f) => f.inv_id === supply.inv_id) || selectedInventoryRecords.some(r => r.inv_id === supply.inv_id)}
                                            onCheckedChange={() => {
                                              if (isOutOfStock || fields.some((f) => f.inv_id === supply.inv_id)) return; // Prevent toggle if already added or out of stock
                                              const syntheticEvent = {
                                                stopPropagation: () => { },
                                              } as React.MouseEvent<HTMLButtonElement>;
                                              handleSupplyToggle(supply, syntheticEvent);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-gray-200 border-gray-400 text-white
                                              data-[state=unchecked]:bg-gray-400 data-[state=unchecked]:border-gray-500
                                              data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600
                                              disabled:opacity-40 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      {(isOutOfStock || fields.some((f) => f.inv_id === supply.inv_id)) && (
                                        <TooltipContent className="text-xs">
                                          {isOutOfStock ? 'Out of Stock' : 'Already Added'}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="w-[300px]">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Package className="h-3 w-3 text-gray-400" />
                                      <p className="font-medium text-gray-900 text-sm">{supply.name}</p>
                                    </div>
                                    <p
                                      className="text-xs text-gray-500 ml-5 line-clamp-2"
                                      title={supply.description}
                                    >
                                      {supply.description}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="bg-green-100 ms-4 font-medium text-[14px] my-2 text-gray-800 border-green-300"
                                    >
                                      Stock: {supply.availableStock ?? 0}
                                    </Badge>
                                  </div>
                                </div>

                                {/* PO Number */}
                                <div className="min-w-[140px] text-left">
                                  <p className="text-xs text-gray-500 tracking-wide">
                                    PO Number
                                  </p>
                                  <p className="text-xs font-medium text-gray-800">
                                    {supply.po_number ?? "—"}
                                  </p>
                                </div>

                                {/* Stock Date */}
                                <div className="min-w-[80px] text-left">
                                  <p className="text-xs text-gray-500 tracking-wide">
                                    Stock Date
                                  </p>
                                  <p className="text-xs font-medium text-gray-800">
                                    {supply.stock_date
                                      ? new Date(supply.stock_date).toLocaleDateString("en-GB")
                                      : "—"}
                                  </p>
                                </div>

                                <div className="text-right ml-4">
                                  <p className="font-semibold text-blue-600 text-sm">
                                    {formatCurrency(supply.price)}
                                  </p>
                                  <p className="text-xs text-gray-400">per unit</p>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemIdForDetails(supply.id);
                                    setIsDetailsModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium flex items-center gap-1"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{selectedInventoryRecords.length} selected</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInventoryRecords([]);
                              setShowSuppliesDropdown(false);
                              setItemSearchTerm('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleConfirmSupplies}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                          >
                            Confirm Selection
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showSuppliesDropdown && itemSearchTerm && filteredSupplies.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="p-6 text-center">
                        <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No items found matching "{itemSearchTerm}"</p>
                        <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms</p>
                      </div>
                    </div>
                  )}
                  {errors.items && typeof errors.items === 'object' && errors.items.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.items.message}
                    </p>
                  )}
                </div>
                {fields.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-700 font-medium flex items-center gap-2">
                        Invoice Items
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {fields.length}
                        </span>
                      </Label>
                    </div>
                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-blue-800 w-[30%]">
                              Item Name
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Quantity</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Unit Price</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Discount (%)</th>
                            <th className="px-4 py-2 text-right text-sm font-medium text-blue-800">Tax Amount</th>
                            <th className="px-4 py-2 text-right text-sm font-medium text-blue-800">Total Amount</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-blue-800">Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {fields.map((item, index) => {
                            const field = watchedFields.items[index];
                            const quantity = field?.quantity || 0;

                            // Calculations
                            const subtotal = quantity * (field?.unitPrice || 0);
                            const discountPercent = Number(field?.discount) || 0;
                            const discountAmount = (subtotal * discountPercent) / 100;
                            const taxableAmount = subtotal - discountAmount;

                            const totalTaxAmount = dynamicTaxLabels.reduce((sum, label) => {
                              const taxes = field.tax_percentage && typeof field.tax_percentage === "object"
                                ? field.tax_percentage
                                : {};
                              const taxPercent = Number(taxes[label]) || 0;
                              return sum + (taxableAmount * taxPercent) / 100;
                            }, 0);

                            const finalItemTotal = taxableAmount + totalTaxAmount;

                            // Allocation Logic
                            const locations = itemInventoryDetails[field.id] ?? [];
                            const sortedLocations = [...locations]
                              .filter((loc) => loc.qty > 0 && loc.created_at)
                              .sort((a, b) => a.created_at.localeCompare(b.created_at));

                            const allocated = [];
                            let remaining = quantity;
                            for (const loc of sortedLocations) {
                              if (remaining <= 0) break;
                              const take = Math.min(remaining, loc.qty);
                              if (loc.locationId && locationNameMap[loc.locationId]) {
                                allocated.push({ name: locationNameMap[loc.locationId], qty: take });
                              }
                              remaining -= take;
                            }

                            return (
                              <React.Fragment key={item.rhfId}>
                                <tr className="border-b hover:bg-gray-50">
                                  {/* Item Name + Expand Arrow */}
                                  <td className="px-4 py-3 align-top">
                                    <div className="flex items-start gap-3">

                                      {/* Arrow button */}
                                      <button
                                        type="button"
                                        onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                                        className="mt-1 text-gray-700 hover:text-blue-700 transition"
                                      >
                                        {expandedIndex === index ? (
                                          <ChevronDown className="h-5 w-5" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5" />
                                        )}
                                      </button>

                                      <div>
                                        <p className="font-medium text-gray-900">{field?.name}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Available Stock: {field?.availableStock ?? 0}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Quantity */}
                                  <td className="px-4 py-3 align-middle">
                                    <div className="flex flex-col">
                                      <div className="h-8 flex items-center">
                                        <Input
                                          type="number"
                                          min="0"
                                          max={isEditing ? field?.maxAllowedQuantity : field?.availableStock}
                                          value={field?.quantity !== undefined ? String(field.quantity) : ""}
                                          placeholder="0"
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            let num = parseInt(val, 10);

                                            if (isNaN(num) || num < 0) {
                                              num = 0;
                                            }

                                            const max = isEditing
                                              ? (field?.maxAllowedQuantity ?? Infinity)
                                              : (field?.availableStock ?? Infinity);

                                            if (num > max) {
                                              toast.error(
                                                isEditing
                                                  ? `Quantity cannot exceed maximum allowed (${max})`
                                                  : `Quantity cannot exceed available stock (${max})`
                                              );
                                              num = max;
                                            }

                                            handleItemChange(index, "quantity", num);
                                          }}
                                          className="h-8 w-24 text-sm"
                                        />

                                      </div>
                                    </div>
                                  </td>

                                  {/* Unit price */}
                                  <td className="px-4 py-3 align-middle">
                                    <div className="flex flex-col">
                                      <div className="h-8 flex items-center">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={field?.unitPrice ?? ''}
                                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                                          className="h-8 w-32 text-sm"
                                        />
                                      </div>
                                      {errors.items?.[index]?.unitPrice && (
                                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          {errors.items[index].unitPrice.message}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Discount */}
                                  <td className="px-4 py-3 align-middle">
                                    <div className="flex flex-col">
                                      <div className="h-8 flex items-center">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={field?.discount ?? ''}
                                          onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                                          className="h-8 w-24 text-sm"
                                        />
                                      </div>
                                      <p className="text-xs text-green-500 mt-1">
                                        -{formatCurrency(discountAmount)}
                                      </p>
                                      {errors.items?.[index]?.discount && (
                                        <p className="text-xs text-red-500 mt-0 flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          {errors.items[index].discount.message}
                                        </p>
                                      )}
                                    </div>
                                  </td>


                                  {/* Tax Amount */}
                                  <td className="px-4 py-3 text-gray-900 text-sm font-semibold text-right">
                                    {formatCurrency(totalTaxAmount)}
                                  </td>

                                  {/* Total Amount */}
                                  <td className="px-4 py-3 text-blue-600 text-sm font-semibold text-right">
                                    {formatCurrency(finalItemTotal)}
                                    {errors.items?.[index]?.total && (
                                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.items[index]?.total?.message}
                                      </p>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        remove(index);
                                        clearValidationErrors();
                                      }}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>

                                {/* EXPANDED SECTION */}
                                {expandedIndex === index && (
                                  <tr className="bg-gray-50 border-b">
                                    <td colSpan={10} className="px-6 py-5">

                                      <div className="flex flex-col md:flex-row gap-6">
                                        {/* Taxes - Fixed & Correct */}
                                        <div className="w-full md:w-[35%]">
                                          <p className="text-sm font-semibold text-gray-700 mb-3">Taxes</p>
                                          <div className="grid grid-cols-3 gap-3">
                                            {dynamicTaxLabels.length === 0 ? (
                                              <p className="col-span-3 text-center text-xs text-gray-500">
                                                No taxes configured for this item
                                              </p>
                                            ) : (
                                              dynamicTaxLabels.map((label) => {
                                                const taxPercent = Number(field.tax_percentage?.[label]) || 0;
                                                const taxAmount = (taxableAmount * taxPercent) / 100;

                                                return (
                                                  <div key={label} className="p-2 border rounded-lg bg-white shadow-sm">
                                                    <p className="text-xs font-medium text-gray-700">
                                                      {label}: {taxPercent}%
                                                    </p>
                                                    <p className="text-xs text-blue-600 mt-1">
                                                      {formatCurrency(taxAmount)}
                                                    </p>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>

                                        {/* Allocated Location */}
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-gray-700 mb-3">
                                            Allocated Location
                                          </p>
                                          <div className="bg-white border shadow-sm rounded-lg p-4">
                                            {quantity === 0 ? (
                                              <p className="text-sm text-gray-500">Enter quantity to see location</p>
                                            ) : field.locationName ? (
                                              <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                                                {field.locationName}
                                              </div>
                                            ) : (
                                              <p className="text-sm text-gray-500">
                                                No location information available
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}

                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>


                    </div>
                  </div>
                )}

                {fields.length > 0 && (
                  <div className="mt-6 p-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-gray-700 font-medium flex items-center gap-1 mb-2">
                          <CirclePercent className='h-4 w-4' /> Global Discount
                        </Label>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative group">
                            <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0.00"
                              {...register("globalDiscountPercent", {
                                valueAsNumber: true,
                                onChange: () => {
                                  isEditingPercent.current = true;
                                  isEditingAmount.current = false;
                                }
                              })}
                              className="pl-9 h-10 rounded-lg transition-all duration-300 
                                hover:border-blue-400 focus:border-blue-500 
                                focus:ring-blue-500/20"
                            />
                            {errors.globalDiscountPercent && (
                              <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors.globalDiscountPercent.message}
                              </p>
                            )}
                          </div>

                          <div className="relative group">
                            <span className="absolute left-3 top-2 text-muted-foreground text-md font-semibold group-hover:text-blue-500">
                              {currencySymbol}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0.00"
                              {...register("globalDiscountAmount", {
                                valueAsNumber: true,
                                onChange: () => {
                                  isEditingPercent.current = false;
                                  isEditingAmount.current = true;
                                }
                              })}
                              className="pl-7 h-10 rounded-lg transition-all duration-300 
                                hover:border-blue-400 focus:border-blue-500 
                                focus:ring-blue-500/20"
                            />
                            {errors.globalDiscountAmount && (
                              <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors.globalDiscountAmount.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-700 font-medium flex items-center gap-1 mb-2">
                          <CircleDollarSign className='h-4 w-4' /> Freight Charges
                        </Label>
                        <div className="relative group">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0.00"
                            value={watchedFields.freightCharges ?? 0}
                            {...register("freightCharges", { valueAsNumber: true })}
                            className="h-10 rounded-lg transition-all duration-300 
                              hover:border-blue-400 focus:border-blue-500 
                              focus:ring-blue-500/20"
                          />
                        </div>
                        {errors.freightCharges && (
                          <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.freightCharges.message}
                          </p>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {fields.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">
                      {!selectedStore ? 'Select a store first' : 'No items added yet'}
                    </p>
                    <p className="text-sm">
                      {!selectedStore
                        ? 'Choose a store from the dropdown above to start searching for items'
                        : 'Search and select items above to add them to your invoice'
                      }
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t flex justify-between items-center">
                <div className="text-right">
                  <Label className="text-gray-700 font-medium">Total Amount</Label>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculateTotal())}</p>
                </div>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setShowCancelDialog(true);
                      } else {
                        navigate('/dashboard/invoice');
                      }
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {(isSubmitting || isLoading) ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </span>
                    ) : formStatus === 'success' ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {isEditing ? 'Updated!' : 'Created!'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {/* <DollarSign className="h-4 w-4" /> */}
                        {isEditing ? 'Update Invoice' : 'Create Invoice'}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        <ItemDetailsModal
          open={isDetailsModalOpen}
          itemId={selectedItemIdForDetails}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedItemIdForDetails(null);
          }}
        />
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg text-blue-600">Unsaved Changes</DialogTitle>
              <p className="text-sm text-gray-600">Are you sure you want to cancel? Unsaved changes will be lost.</p>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                No
              </Button>
              <Button variant="destructive" onClick={() => navigate('/dashboard/invoice')}>
                Yes, Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Customer Modal */}
        <Dialog open={showAddCustomerModal} onOpenChange={setShowAddCustomerModal}>
          <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-2xl shadow-xl">
            {/* Header Section */}
            <div className="flex items-center gap-3 p-5 border-b bg-white">
              <div className="p-2 rounded-lg bg-gray-100">
                <UserPlus className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">
                  Create New Customer
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Fill in the customer details below to create a new customer
                </DialogDescription>
              </div>
            </div>

            {/* Form Section */}
            <div className="p-6">
              <form onSubmit={handleCustomerSubmit(onCustomerSubmit)} className="space-y-6">
                <div className="space-y-2 group">
                  <Label
                    htmlFor="customer-fullname"
                    className={`${customerErrors.fullname ? 'text-red-500' : 'text-gray-700'
                      } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <User className="h-4 w-4" /> Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customer-fullname"
                    placeholder="Enter full name"
                    {...registerCustomer('fullname')}
                    className={`pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${customerErrors.fullname
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                      }`}
                  />
                  {customerErrors.fullname && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {customerErrors.fullname.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="customer-phone"
                      className={`${customerErrors.phone ? 'text-red-500' : 'text-gray-700'
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Phone className="h-4 w-4" /> Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customer-phone"
                      type="tel"
                      placeholder="10-digit number"
                      {...registerCustomer('phone')}
                      className={`pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${customerErrors.phone
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                    />
                    {customerErrors.phone && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {customerErrors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="customer-email"
                      className={`${customerErrors.email ? 'text-red-500' : 'text-gray-700'
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium mb-1`}
                    >
                      <Mail className="h-4 w-4" /> Email <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="example@email.com"
                      {...registerCustomer('email')}
                      className={`pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${customerErrors.email
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                    />
                    {customerErrors.email && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {customerErrors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="customer-type"
                    className={`${customerErrors.type ? 'text-red-500' : 'text-gray-700'
                      } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Tag className="h-4 w-4" /> Customer Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={watchCustomer('type')}
                    onValueChange={(value: 'Retail' | 'Wholesale' | 'VIP') => setCustomerValue('type', value)}
                  >
                    <SelectTrigger
                      className={`w-full pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${customerErrors.type
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retail">Retail</SelectItem>
                      <SelectItem value="Wholesale">Wholesale</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                  {customerErrors.type && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {customerErrors.type.message}
                    </p>
                  )}
                </div>

                <DialogFooter className="flex justify-end gap-3 border-t pt-4 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddCustomerModal(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="transition-colors"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Create Customer
                      </span>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}
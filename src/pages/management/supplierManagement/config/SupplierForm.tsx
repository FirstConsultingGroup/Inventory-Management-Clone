import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Building2,
  CreditCard,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  Truck,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  Save,
  Edit3,
  Package,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  BadgeIndianRupee,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import toast, { Toaster } from 'react-hot-toast';
import { SubmitHandler } from 'react-hook-form';
import { useApprovalDocument } from '@/hooks/useApprovalDocument';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { supabase } from '@/Utils/types/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { ISupplierManagement, ISupplierItems } from '@/Utils/constants';
import { formatCurrency } from '@/Utils/formatters';
import ItemDetailsModal from '@/components/inventory/ItemDetailsModal';
import { initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Form schema
const formSchema = z.object({
  companyId: z.string()
    .min(1, "Company ID is required")
    .max(50, "Company ID must be less than 50 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Company ID can only contain letters, numbers, and hyphens"),
  name: z.string()
    .min(1, "Company name is required")
    .max(100, "Company name must be less than 100 characters"),
  registrationNumber: z.string()
    .min(1, "Registration number is required")
    .max(50, "Registration number must be less than 50 characters"),
  taxId: z.string()
    .min(1, "Tax ID is required")
    .max(50, "Tax ID must be less than 50 characters"),
  contactPerson: z.string()
    .min(1, "Contact person is required")
    .max(100, "Contact person name must be less than 100 characters"),
  email: z.string()
    .email("Invalid email address")
    .min(1, "Email is required")
    .refine((val) => val === val.toLowerCase(), {
      message: "Email must not contain uppercase letters"
    }),
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?\d{10,15}$/, "Invalid phone number format"),
  website: z.string()
    .url("Invalid website URL")
    .optional()
    .or(z.literal("")),
  address: z.string()
    .min(1, "Address is required")
    .max(200, "Address must be less than 200 characters"),
  city: z.string()
    .min(1, "City is required")
    .max(100, "City must be less than 100 characters"),
  state: z.string()
    .min(1, "State is required")
    .max(100, "State must be less than 100 characters"),
  postalCode: z.string()
    .min(1, "Postal code is required"),
  country: z.string()
    .min(1, "Country is required")
    .max(100, "Country must be less than 100 characters"),
  selectedSupplies: z.array(z.string()),
  selectedBrands: z.array(z.string()),
  bankName: z.string()
    .min(1, "Bank name is required")
    .max(100, "Bank name must be less than 100 characters"),
  bank_account_number: z.string()
    .min(1, "Account number is required")
    .max(50, "Account number must be less than 50 characters"),
  ifscCode: z.string()
    .min(1, "IFSC code is required")
    .max(11, "IFSC code must be less than 11 characters")
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  ibanCode: z.string()
    .min(1, "IBAN code is required")
    .max(34, "IBAN code must be less than 34 characters"),
  creditLimit: z.number()
    .min(1, "Credit limit must be positive")
    .max(1000000, "Credit limit cannot exceed 1,000,000"),
  paymentTerms: z.string()
    .min(1, "Payment terms are required")
    .max(100, "Payment terms must be less than 100 characters"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  status: z.enum(["Active", "Inactive", "Pending"], {
    required_error: "Please select a status"
  }),
  rating: z.number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  notes: z.string()
    .max(1000, "Notes must be less than 1000 characters")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Supply = {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
};

type Brand = {
  id: string;
  name: string;
};

interface DBBlock {
  table: string;
  type: 'insert' | 'update' | 'delete';
  data: any; 
  match?: any;
}

interface ActionPayload {
  validations?: any[];
  operations: DBBlock[];
}

const getRatingLabel = (rating: number) => {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 3.5) return "Good";
  if (rating >= 2.5) return "Average";
  if (rating >= 1.5) return "Poor";
  if (rating > 0) return "Very Poor";
  return "";
};

const StarRating = ({
  rating,
  onRatingChange,
  readonly = false,
}: {
  rating: number;
  onRatingChange: (value: number) => void;
  readonly?: boolean;
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFilled = (hoverRating || rating) >= starValue;
    const isHalfFilled = !isFilled && (hoverRating || rating) >= starValue - 0.5;

    return (
      <button
        key={index}
        type="button"
        disabled={readonly}
        className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform duration-150`}
        onMouseEnter={() => !readonly && setHoverRating(starValue)}
        onMouseLeave={() => !readonly && setHoverRating(0)}
        onClick={() => !readonly && onRatingChange(starValue)}
      >
        <Star
          className={`h-5 w-5 ${isFilled
            ? "fill-yellow-400 text-yellow-400"
            : isHalfFilled
              ? "fill-yellow-200 text-yellow-400"
              : "fill-gray-200 text-gray-200"
            } transition-colors duration-150`}
        />
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, index) => renderStar(index))}
      {rating > 0 && (
        <span className="ml-2 text-sm text-gray-600 font-medium">
          {getRatingLabel(rating)}
        </span>
      )}
    </div>
  );
};

const SupplierForm = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);
  const isViewMode = location.pathname.includes('/view');
  const [isLoading, setIsLoading] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [selectedSupplies, setSelectedSupplies] = useState<Supply[]>([]);
  const [filteredSupplies, setFilteredSupplies] = useState<Supply[]>([]);
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [actionName, setActionName] = useState<string>('');
  const [showSuppliesDropdown, setShowSuppliesDropdown] = useState(false);
  const [tempSelectedSupplies, setTempSelectedSupplies] = useState<string[]>([]);
  const [supplierItems, setSupplierItems] = useState<ISupplierItems[]>([]);
  const [supplierItemsData, setSupplierItemsData] = useState<Supply[]>([]);
  const [isSelectedSuppliesExpanded, setIsSelectedSuppliesExpanded] = useState(false);
  const [isSelectedBrandsExpanded, setIsSelectedBrandsExpanded] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [showBrandsDropdown, setShowBrandsDropdown] = useState(false);
  const [tempSelectedBrands, setTempSelectedBrands] = useState<string[]>([]);
  const user = localStorage.getItem('userData');
  const userData = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || '';
  const [selectedItemIdForDetails, setSelectedItemIdForDetails] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    setFocus
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: "",
      name: "",
      registrationNumber: "",
      taxId: "",
      contactPerson: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      selectedSupplies: [],
      selectedBrands: [],
      bankName: "",
      bank_account_number: "",
      ifscCode: "",
      ibanCode: "",
      creditLimit: 0,
      paymentTerms: "",
      description: "",
      status: "Active",
      rating: 0,
      notes: "",
    },
  });

  const watchedFields = watch();
  const [supplierIdError, setSupplierIdError] = useState<string>('');

  // Check if supplier ID already exists
  const checkSupplierIdExists = async (supplierId: string, excludeId?: string): Promise<boolean> => {
    try {
      let query = supabase
        .from('supplier_mgmt')
        .select('id')
        .eq('company_id', companyId)
        .eq('supplier_id', supplierId)
        .eq('is_active', true);

      // Exclude current supplier when editing
      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking supplier ID:', error);
        return false; // Return false on error to allow form submission (will be caught by DB constraint)
      }

      return (data && data.length > 0);
    } catch (error) {
      console.error('Unexpected error checking supplier ID:', error);
      return false;
    }
  };

  // Validate supplier ID on blur
  const handleSupplierIdBlur = async () => {
    const supplierId = watchedFields.companyId?.trim();

    if (!supplierId || supplierId.length === 0) {
      setSupplierIdError('');
      return;
    }

    // Only check if the field has a valid value (passes basic validation)
    if (supplierId.length < 1) {
      setSupplierIdError('');
      return;
    }

    const exists = await checkSupplierIdExists(supplierId, isEditing ? id : undefined);

    if (exists) {
      setSupplierIdError('This Supplier ID already exists. Please use a different ID.');
    } else {
      setSupplierIdError('');
    }
  };

  // Fetch brands from category_master
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('category_master')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('is_active', true)
          // .eq('status', true)
          .order('name', { ascending: true });

        if (error) {
          console.error('Supabase error fetching brands:', error.message);
          toast.error('Failed to fetch brands. Please try again.');
          return;
        }

        if (data) {
          setBrands(data as Brand[]);
          setFilteredBrands(data as Brand[]);
        }
      } catch (error) {
        console.error('Unexpected error in fetchBrands:', error);
        toast.error('An unexpected error occurred while fetching brands.');
      }
    };

    fetchBrands();
  }, []);

  // Filter brands based on search term
  useEffect(() => {
    if (!brandSearchTerm.trim() || brandSearchTerm.trim().length < 3) {
      setFilteredBrands([]);
      setShowBrandsDropdown(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        const filtered = brands.filter(brand =>
          brand.name.toLowerCase().includes(brandSearchTerm.trim().toLowerCase())
        );
        setFilteredBrands(filtered);
        setShowBrandsDropdown(true);
      } catch (error) {
        console.error('Error filtering brands:', error);
        toast.error('Failed pubsfilter brands. Please try again.');
        setFilteredBrands([]);
        setShowBrandsDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [brandSearchTerm, brands]);

  // Fetch supplies from Supabase - only if brands are selected
  useEffect(() => {
    const fetchSupplies = async () => {
      // Reset dropdown if no search term or less than 3 characters
      if (!searchTerm.trim() || searchTerm.trim().length < 3) {
        setFilteredSupplies([]);
        setShowSuppliesDropdown(false);
        return;
      }

      // Check if brands are selected before allowing item search
      if (selectedBrands.length === 0) {
        setFilteredSupplies([]);
        setShowSuppliesDropdown(true); // Show dropdown with message
        return;
      }

      try {
        let query = supabase
          .from('item_mgmt')
          .select('id, item_name, description, selling_price, category_id, company_id')
          .eq('company_id', companyId) // <-- Only fetch items for this company
          .eq('is_active', true)
          .eq("is_temporary", false)
          .or(`item_name.ilike.%${searchTerm.trim()}%,description.ilike.%${searchTerm.trim()}%`)
          .limit(10);

        // Filter by selected brands (now required)
        const selectedBrandIds = selectedBrands.map(brand => brand.id);
        query = query.in('category_id', selectedBrandIds);

        const { data, error } = await query;

        if (error) {
          console.error('Supabase error:', error.message);
          toast.error('Failed to fetch supplies. Please try again.');
          setFilteredSupplies([]);
          setShowSuppliesDropdown(true);
          return;
        }

        if (data && data.length > 0) {
          const mappedSupplies: Supply[] = data.map((item: any) => ({
            id: item.id,
            name: item.item_name || 'Unnamed Item',
            description: item.description || 'No description',
            price: item.selling_price ? parseFloat(item.selling_price) : 0,
            category_id: item.category_id,
          }));
          setFilteredSupplies(mappedSupplies);
          setShowSuppliesDropdown(true);
        } else {
          setFilteredSupplies([]);
          setShowSuppliesDropdown(true);
        }
      } catch (error) {
        console.error('Unexpected error in fetchSupplies:', error);
        toast.error('An unexpected error occurred. Please try again.');
        setFilteredSupplies([]);
        setShowSuppliesDropdown(false);
      }
    };

    const timeoutId = setTimeout(fetchSupplies, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedBrands]);

  // Update selectedSupplies and selectedBrands in form
  useEffect(() => {
    setValue('selectedSupplies', selectedSupplies.map(s => s.id));
    setValue('selectedBrands', selectedBrands.map(b => b.id));
  }, [selectedSupplies, selectedBrands, setValue]);

  // Fetch supplier data for editing
  useEffect(() => {
    if (isEditing && id) {
      if (id === 'pending') {
        const fetchPendingData = async () => {
          try {
            const searchParams = new URLSearchParams(window.location.search);
            const requestId = searchParams.get('request_id');
            if (!requestId) throw new Error("No request ID provided");
            
            setIsLoading(true);
            const { data: requestRow, error } = await supabase
              .from('approval_requests')
              .select(`
                  payload, 
                  entity_id,
                  current_level,
                  status,
                  created_at,
                  actions:action_id(action_name),
                  users:requested_by(first_name, last_name)
              `)
              .eq('id', requestId)
              .single();
              
            if (error) throw error;
            
            let currentSupplierData: any = {};
            let currentItemIds: any[] = [];
            
            const action = Array.isArray(requestRow?.actions) 
                ? requestRow.actions[0]?.action_name 
                : (requestRow?.actions as any)?.action_name || 'Unknown Action';
            setActionName(action);

            const requestedByObj = Array.isArray(requestRow?.users) 
                ? requestRow.users[0] 
                : (requestRow?.users as any);

            if (requestRow) {
                setRequestDetails({
                    requestedBy: requestedByObj ? `${requestedByObj.first_name || ''} ${requestedByObj.last_name || ''}`.trim() : 'Unknown',
                    level: requestRow.current_level,
                    status: requestRow.status,
                    createdAt: requestRow.created_at,
                });
            }
            
            if (requestRow?.entity_id) {
               const { data: existingSupplier } = await supabase
                 .from('supplier_mgmt')
                 .select('*')
                 .eq('id', requestRow.entity_id)
                 .single();
               if (existingSupplier) currentSupplierData = existingSupplier;
               
               const { data: existingItems } = await supabase
                 .from('supplier_items')
                 .select('id, item_id')
                 .eq('supplier_id', requestRow.entity_id);
                 
               if (existingItems) {
                 currentItemIds = existingItems;
               }
            }

            let parsedPayload: any = requestRow?.payload;
            if (typeof parsedPayload === 'string') {
               try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
            }

            if (parsedPayload?.operations) {
              const supplierOp = parsedPayload.operations.find((op: any) => op.table === 'supplier_mgmt');
              
              if (supplierOp?.data) {
                // Merge payload data over existing data
                currentSupplierData = { ...currentSupplierData, ...supplierOp.data };
              }
              
              const itemOps = parsedPayload.operations.filter((op: any) => op.table === 'supplier_items');
              let finalItemIdsArray: string[] = [];
              
              if (requestRow.entity_id) {
                 let filteredItems = [...currentItemIds];
                 // Process deletes
                 const deleteOps = itemOps.filter((op: any) => op.type === 'delete' && (op.match?.ids || op.match?.id));
                 for (const dOp of deleteOps) {
                    filteredItems = filteredItems.filter((fi: any) => !(dOp.match?.ids || dOp.match?.id || []).includes(fi.id));
                 }
                 finalItemIdsArray = filteredItems.map((fi: any) => fi.item_id).filter(Boolean);
              }
              
              // Process inserts
              const insertOps = itemOps.filter((op: any) => op.type === 'insert' && op.data);
              for (const iOp of insertOps) {
                 if (Array.isArray(iOp.data)) {
                    finalItemIdsArray.push(...iOp.data.map((d: any) => d.item_id).filter(Boolean));
                 } else if (iOp.data.item_id) {
                    finalItemIdsArray.push(iOp.data.item_id);
                 }
              }
              
              finalItemIdsArray = Array.from(new Set(finalItemIdsArray));
              
              if (currentSupplierData) {
                reset({
                  companyId: currentSupplierData.supplier_id ?? currentSupplierData.companyId ?? '',
                  name: currentSupplierData.supplier_name ?? currentSupplierData.name ?? '',
                  registrationNumber: currentSupplierData.registration_number ?? currentSupplierData.registrationNumber ?? '',
                  taxId: currentSupplierData.tax_id ?? currentSupplierData.taxId ?? '',
                  contactPerson: currentSupplierData.contact_person ?? currentSupplierData.contactPerson ?? '',
                  email: currentSupplierData.email ?? '',
                  phone: currentSupplierData.phone ?? '',
                  website: currentSupplierData.website ?? '',
                  address: currentSupplierData.address ?? '',
                  city: currentSupplierData.city ?? '',
                  state: currentSupplierData.state ?? '',
                  postalCode: currentSupplierData.postal_code ?? currentSupplierData.postalCode ?? '',
                  country: currentSupplierData.country ?? '',
                  bankName: currentSupplierData.bank_name ?? currentSupplierData.bankName ?? '',
                  bank_account_number: currentSupplierData.bank_account_number ?? currentSupplierData.bankAccountNumber ?? '',
                  ifscCode: currentSupplierData.ifsc_code ?? currentSupplierData.ifscCode ?? '',
                  ibanCode: currentSupplierData.iban_code ?? currentSupplierData.ibanCode ?? '',
                  creditLimit: currentSupplierData.credit_limit ?? currentSupplierData.creditLimit ?? 0,
                  paymentTerms: currentSupplierData.payment_terms ?? currentSupplierData.paymentTerms ?? '',
                  status: (currentSupplierData.status ?? 'Active') as "Active" | "Inactive" | "Pending",
                  rating: currentSupplierData.rating ?? 0,
                  notes: currentSupplierData.notes ?? '',
                  description: currentSupplierData.supplier_info ?? currentSupplierData.description ?? '',
                  selectedSupplies: [],
                  selectedBrands: [],
                });
              }

              if (finalItemIdsArray.length > 0) {
                 const { data: itemsData, error: itemsError } = await supabase
                  .from('item_mgmt')
                  .select('id, item_name, description, selling_price, category_id')
                  .eq('company_id', companyId)
                  .in('id', finalItemIdsArray);

                 if (itemsData && !itemsError) {
                    const mappedSupplies: Supply[] = itemsData.map((item: any) => ({
                      id: item.id,
                      name: item.item_name || 'Unnamed Item',
                      description: item.description || 'No description',
                      price: item.selling_price ? parseFloat(item.selling_price) : 0,
                      category_id: item.category_id,
                    }));
                    setSupplierItemsData(mappedSupplies);
                    setSelectedSupplies(mappedSupplies);
                    
                    const brandIds = itemsData
                      .map(item => item.category_id)
                      .filter((id): id is string => id !== null && id !== undefined)
                      .filter((id, index, self) => self.indexOf(id) === index);
                    
                    if (brandIds.length > 0) {
                       const { data: brandData } = await supabase
                        .from('category_master')
                        .select('id, name')
                        .eq('company_id', companyId)
                        .in('id', brandIds);
                        
                       if (brandData) {
                          setSelectedBrands(brandData.map((b: any) => ({ id: b.id, name: b.name || 'Unnamed Brand' })));
                       }
                    }
                 }
              }
            }
          } catch (e) {
            console.error("Fetch pending error", e);
            toast.error("Failed to load pending request data");
          } finally {
            setIsLoading(false);
          }
        };
        fetchPendingData();
        return;
      }

      const getSupplierDetails = async () => {
        try {
          if (!id) throw new Error("No ID provided");
          setIsLoading(true);
          const { data, error } = await supabase
            .from('supplier_mgmt')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            console.error('Error fetching supplier:', error);
            setError('Failed to fetch supplier data');
            toast.error('Failed to fetch supplier data');
            return;
          }

          if (data) {
            reset({
              companyId: data.supplier_id ?? '',
              name: data.supplier_name ?? '',
              registrationNumber: data.registration_number ?? '',
              taxId: data.tax_id ?? '',
              contactPerson: data.contact_person ?? '',
              email: data.email ?? '',
              phone: data.phone ?? '',
              website: data.website ?? '',
              address: data.address ?? '',
              city: data.city ?? '',
              state: data.state ?? '',
              postalCode: data.postal_code ?? '',
              country: data.country ?? '',
              bankName: data.bank_name ?? '',
              bank_account_number: data.bank_account_number ?? '',
              ifscCode: data.ifsc_code ?? '',
              ibanCode: data.iban_code ?? '',
              creditLimit: data.credit_limit ?? 0,
              paymentTerms: data.payment_terms ?? '',
              status: (data.status ?? 'Active') as "Active" | "Inactive" | "Pending",
              rating: data.rating ?? 0,
              notes: data.notes ?? '',
              description: data.supplier_info ?? '',
              selectedSupplies: [],
              selectedBrands: [],
            });
            // Clear supplier ID error when loading existing data
            setSupplierIdError('');
          }
        } catch (error) {
          console.error('Fetch supplier error:', error);
          setError('Failed to fetch supplier data');
          toast.error('Failed to fetch supplier data');
        } finally {
          setIsLoading(false);
        }
      };

      const getSupplierSupplies = async () => {
        try {
          const { data: supplierItems, error } = await supabase
            .from('supplier_items')
            .select('*')
            .eq('company_id', companyId)
            .eq('supplier_id', id);

          if (error) {
            console.error('Error fetching supplier_items:', error);
            setError('Failed to fetch supplier_items data');
            toast.error('Failed to fetch supplier_items data');
            return;
          }

          setSupplierItems(supplierItems);

          const itemIds = (supplierItems?.map(item => item.item_id).filter((id): id is string => id !== null) ?? []);

          if (itemIds.length === 0) {
            setSupplierItemsData([]);
            return;
          }

          const { data: itemsData, error: itemsError } = await supabase
            .from('item_mgmt')
            .select('id, item_name, description, selling_price, category_id')
            .eq('company_id', companyId)
            .in('id', itemIds);

          if (itemsError) {
            console.error('Error fetching items:', itemsError);
            setError('Failed to fetch item data');
            toast.error('Failed to fetch item data');
            return;
          }

          if (itemsData) {
            const mappedSupplies: Supply[] = itemsData.map((item: any) => ({
              id: item.id,
              name: item.item_name || 'Unnamed Item',
              description: item.description || 'No description',
              price: item.selling_price ? parseFloat(item.selling_price) : 0,
              category_id: item.category_id,
            }));

            setSupplierItemsData(mappedSupplies);
            setSelectedSupplies(mappedSupplies);

            // Determine associated brands from items
            const brandIds = itemsData
              .map(item => item.category_id)
              .filter((id): id is string => id !== null && id !== undefined)
              .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

            const { data: brandData, error: brandError } = await supabase
              .from('category_master')
              .select('id, name')
              .eq('company_id', companyId)
              .in('id', brandIds);

            if (brandError) {
              console.error('Error fetching brands for items:', brandError);
              toast.error('Failed to fetch brand data');
              return;
            }

            if (brandData) {
              const mappedBrands: Brand[] = brandData.map((item: any) => ({
                id: item.id,
                name: item.name || 'Unnamed Brand',
              }));
              setSelectedBrands(mappedBrands);
            }
          }
        } catch (error) {
          console.error("Fetch supplier's error:", error);
          setError('Failed to fetch supplies data');
          toast.error('Failed to fetch supplies data');
        } finally {
          setIsLoading(false);
        }
      };

      getSupplierDetails();
      getSupplierSupplies();
    }
  }, [id, isEditing, reset]);

  // Supplier details and supplies update function
  const updateSupplierDetails = async (data: FormValues) => {
    try {

      // Check if supplier ID already exists (excluding current supplier)
      const supplierIdExists = await checkSupplierIdExists(data.companyId.trim(), id!);

      if (supplierIdExists) {
        setSupplierIdError('This Supplier ID already exists. Please use a different ID.');
        toast.error('Supplier ID already exists. Please use a unique ID.');
        setFocus('companyId');
        return;
      }
      

      const supplierData = {
        supplier_id: data.companyId,
        supplier_name: data.name,
        registration_number: data.registrationNumber,
        tax_id: data.taxId,
        contact_person: data.contactPerson,
        email: data.email,
        phone: data.phone,
        website: data.website || null,
        address: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.postalCode,
        country: data.country,
        bank_name: data.bankName,
        bank_account_number: data.bank_account_number,
        ifsc_code: data.ifscCode,
        iban_code: data.ibanCode,
        credit_limit: data.creditLimit,
        payment_terms: data.paymentTerms,
        supplier_info: data.description || null,
        status: data.status,
        rating: data.rating,
        notes: data.notes || null,
        modified_at: new Date().toISOString(),
        is_active: true,
      };

      // Creating system log
      const systemLogs = {
        company_id: userData?.company_id,
        transaction_date: new Date().toISOString(),
        module: 'Supplier Management',
        scope: 'Edit',
        key: `${data.companyId}`,
        log: `Supplier ${data.companyId} updated.`,
        action_by: userData?.id,
        created_at: new Date().toISOString(),
      }

      const action_payload: ActionPayload  = {
        validations: [
          {
            type: 'unique',
            table: 'supplier_mgmt',
            column: 'supplier_id',
            value: data.companyId,
            company_id: companyId,
            ignore_id: id!
          }
        ],
        operations: [
          {
            table: 'supplier_mgmt',
            type: 'update',
            data: supplierData,
            match: { id: id! }
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };
       // Supplies update logic
      const selectedItemIds = selectedSupplies.map(item => item.id);
      const fetchedItemIds = supplierItemsData.map(item => item.id);
      const currentSupplierItems = supplierItems.map((item: ISupplierItems) => item.item_id);

      const itemsToAdd = selectedItemIds.filter(id => !fetchedItemIds.includes(id));
      const itemsToRemove = fetchedItemIds.filter(id => !selectedItemIds.includes(id));

      // Remove item associations
      const itemsToRemoveData = supplierItems.filter(
        (si: any) => itemsToRemove.includes(si.item_id)
      );

      if (itemsToRemoveData.length > 0) {
        const idsToDelete = itemsToRemoveData.map((si: any) => si.id);

       action_payload.operations.push({
    table: 'supplier_items',
    type: 'delete',
    data: null, 
    match: { id: idsToDelete }
  });
      }

      // Add new item associations
      if (itemsToAdd.length > 0) {
        const newEntries = itemsToAdd
          .filter(itemId => !currentSupplierItems.includes(itemId))
          .map(itemId => ({
            supplier_id: id!,
            item_id: itemId,
            is_active: true,
            company_id: companyId
          }));

        if (newEntries.length > 0) {
           action_payload.operations.push({
      table: 'supplier_items',
      type: 'insert',
      data: newEntries
    });
        }
      }

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Suppliers',
        action_name: 'Edit',
        company_id: companyId,
        requested_by: userData.id,
        action_payload,
        entity_id: isEditing ? id : null
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');

        } else {
                const { error: updateError } = await supabase
        .from('supplier_mgmt')
        .update(supplierData)
        .eq('id', id!);

      if (updateError) throw new Error(`Failed to update supplier: ${updateError.message}`);

      if (itemsToRemoveData.length > 0) {
        const idsToDelete = itemsToRemoveData.map((si: any) => si.id);

        const { error: deleteError } = await supabase
          .from('supplier_items')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error("Delete error =>", deleteError);
          throw new Error("Failed to remove old supplier item entries");
        }
      }

      // Add new item associations
      if (itemsToAdd.length > 0) {
        const newEntries = itemsToAdd
          .filter(itemId => !currentSupplierItems.includes(itemId))
          .map(itemId => ({
            supplier_id: id!,
            item_id: itemId,
            is_active: true,
            company_id: companyId
          }));

        if (newEntries.length > 0) {
          const { error: insertError } = await supabase
            .from('supplier_items')
            .insert(newEntries);

          if (insertError) {
            console.error("Insert error =>", insertError);
            throw new Error("Failed to add new supplier item entries");
          }
        }
      }

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;
      setFormStatus('success');
      toast.success('Supplier updated successfully!');
        }}

      setTimeout(() => {
        navigate('/dashboard/supplierManagement');
      }, 1500);
    } catch (error) {
      console.error("Update supplier error:", error);
      setError('Failed to update supplier data');
      toast.error('Failed to update supplier data');
    }
  };

  // Focus on first invalid field after submission attempt
  useEffect(() => {
    if (isSubmitting && Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0] as keyof FormValues;
      setFocus(firstErrorField);
      toast.error("Please correct the highlighted errors before saving.");
    }
  }, [errors, isSubmitting, setFocus]);

  // Handle supply checkbox toggle in dropdown
  const handleSupplyToggle = (supply: Supply, e: React.MouseEvent) => {
    e.stopPropagation();
    const isSelected = tempSelectedSupplies.includes(supply.id);
    if (isSelected) {
      setTempSelectedSupplies(tempSelectedSupplies.filter(id => id !== supply.id));
    } else {
      setTempSelectedSupplies([...tempSelectedSupplies, supply.id]);
    }
  };

  // Handle brand checkbox toggle in dropdown
  const handleBrandToggle = (brand: Brand, e: React.MouseEvent) => {
    e.stopPropagation();
    const isSelected = tempSelectedBrands.includes(brand.id);
    if (isSelected) {
      setTempSelectedBrands(tempSelectedBrands.filter(id => id !== brand.id));
    } else {
      setTempSelectedBrands([...tempSelectedBrands, brand.id]);
    }
  };

  const fetchTempSuppliesData = async (tempSelectedSuppliesIDs: string[]) => {
    try {
      const idsToFetch = tempSelectedSuppliesIDs.filter(
        id => !selectedSupplies.some(existing => existing.id === id));

      let newSupplies: Supply[] = [];

      // Only fetch if there are new IDs to add
      if (idsToFetch.length > 0) {
        const { data, error } = await supabase
          .from('item_mgmt')
          .select('id, item_name, description, selling_price, category_id')
          .eq('company_id', companyId)
          .in('id', idsToFetch); // server-side filter

        if (error) {
          console.error('Error fetching selected supplies:', error.message);
          toast.error('Failed to fetch selected supplies.');
          return;
        }

        newSupplies = (data || []).map((item: any) => ({
          id: item.id,
          name: item.item_name || 'Unnamed Item',
          description: item.description || 'No description',
          price: item.selling_price ? parseFloat(item.selling_price) : 0,
          category_id: item.category_id,
        }));
      }

      return newSupplies;
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Unexpected error occurred while confirming supplies.');
    }
  }

  // Confirm selected supplies
  const handleConfirmSupplies = async () => {
    // Merge tempSelectedSupplies with existing selectedSupplies, ensuring uniqueness
    const newSelectedSupplyIds = [...new Set([...tempSelectedSupplies, ...selectedSupplies.map(s => s.id)])];
    const tempSuppliesData = await fetchTempSuppliesData(tempSelectedSupplies) || [];
    const newSelectedSupplies = [
      ...selectedSupplies.filter(s => newSelectedSupplyIds.includes(s.id)),
      ...tempSuppliesData
    ];
    setSelectedSupplies(newSelectedSupplies);
    setSearchTerm('');
    setShowSuppliesDropdown(false);
    setTempSelectedSupplies([]);
  };

  // Confirm selected brands
  const handleConfirmBrands = () => {
    const newSelectedBrands = brands.filter(brand =>
      tempSelectedBrands.includes(brand.id) || selectedBrands.some(b => b.id === brand.id)
    );
    setSelectedBrands(newSelectedBrands);
    setBrandSearchTerm('');
    setShowBrandsDropdown(false);
    setTempSelectedBrands([]);

    // Only keep supplies that match the selected brands using category_id
    const selectedBrandIds = newSelectedBrands.map(b => b.id);
    const filteredSupplies = selectedSupplies.filter(s => selectedBrandIds.includes(s.category_id));
    setSelectedSupplies(filteredSupplies);
    setValue('selectedSupplies', filteredSupplies.map(s => s.id));
  };

  // Handle supply removal
  const handleSupplyRemove = (supplyId: string) => {
    setSelectedSupplies(selectedSupplies.filter(s => s.id !== supplyId));
  };

  // Handle brand removal
  const handleBrandRemove = (brandId: string) => {
    const newSelectedBrands = selectedBrands.filter(b => b.id !== brandId);
    setSelectedBrands(newSelectedBrands);
    // Clear supplies if brands change to ensure consistency
    setSelectedSupplies([]);
    setValue('selectedSupplies', []);
  };

  // Handle rating change
  const handleRatingChange = (newRating: number) => {
    setValue('rating', newRating);
  };

  // Get status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-600';
      case 'Inactive':
        return 'text-gray-600';
      case 'Pending':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get status dot color helper
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500';
      case 'Inactive':
        return 'bg-gray-500';
      case 'Pending':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (isEditing && id) {
      const isLocked = await checkEntityLock(id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }

    setError('');
    setFormStatus('submitting');
    setIsLoading(true);

    try {
      // Re-check supplier ID on submit (in case user bypassed blur validation)
      const supplierIdExists = await checkSupplierIdExists(data.companyId.trim(), isEditing ? id : undefined);

      if (supplierIdExists) {
        setSupplierIdError('This Supplier ID already exists. Please use a different ID.');
        setFormStatus('error');
        setIsLoading(false);
        toast.error('Supplier ID already exists. Please use a different ID.');
        setFocus('companyId');
        return;
      }

      // Clear any previous supplier ID errors if validation passes
      setSupplierIdError('');

      const supplierData: ISupplierManagement = {
        id: uuidv4(),
        supplier_id: data.companyId,
        company_id: companyId,
        supplier_name: data.name,
        registration_number: data.registrationNumber,
        tax_id: data.taxId,
        contact_person: data.contactPerson,
        email: data.email,
        phone: data.phone,
        website: data.website || null,
        address: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.postalCode,
        country: data.country,
        bank_name: data.bankName,
        bank_account_number: data.bank_account_number,
        ifsc_code: data.ifscCode,
        iban_code: data.ibanCode,
        credit_limit: data.creditLimit,
        payment_terms: data.paymentTerms,
        supplier_info: data.description || null,
        status: data.status,
        rating: data.rating,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        modified_at: null,
        is_active: true,
      };

      if (isEditing && id) {
        await updateSupplierDetails(data);
      } else {

        // Creating system log
        const systemLogs = {
          company_id: userData?.company_id,
          transaction_date: new Date().toISOString(),
          module: 'Supplier Management',
          scope: 'Add',
          key: `${data.companyId}`,
          log: `Supplier ${data.companyId} created.`,
          action_by: userData?.id,
          created_at: new Date().toISOString(),
        }

        const supplierItemsData: ISupplierItems[] = selectedSupplies.map((supply) => ({
          id: uuidv4(),
          supplier_id: supplierData.id,
          item_id: supply.id,
          created_at: new Date().toISOString(),
          is_active: true,
          company_id: supplierData.company_id,
        }));

        const action_payload: ActionPayload  = {
                validations: [
                  {
                    type: 'unique',
                    table: 'supplier_mgmt',
                    column: 'supplier_id',
                    value: data.companyId,
                    company_id: companyId
                  }
                ],
                operations: [
                  {
                    table: 'supplier_mgmt',
                    type: 'insert',
                    data: supplierData,
                  },
                  {
                    table: 'system_log',
                    type: 'insert',
                    data: systemLogs
                  }
                ]
              };

              if (supplierItemsData.length > 0) {
                action_payload.operations.push({
                  table: 'supplier_items',
                    type: 'insert',
                    data: supplierItemsData,
                })
              }
        
              // Initiate Approval using the reusable common function
              const approvalResponse = await initiateApprovalRequest({
                module_name: 'Suppliers',
                action_name: 'Add',
                company_id: companyId,
                requested_by: userData.id,
                action_payload: action_payload,
                entity_id: isEditing ? id : null
              });
        
               if (approvalResponse?.success) {
                 if (approvalResponse.requires_approval) {
                    toast.success('Your action has been submitted and is currently pending approval.');
                
                 } else {
                   const { data: insertedSupplier, error: supplierError } = await supabase
          .from('supplier_mgmt')
          .insert([supplierData])
          .select()
          .single();

        if (supplierError) {
          throw new Error(`Failed to insert supplier: ${supplierError.message}`);
        }

        if (!insertedSupplier) {
          throw new Error('No supplier data returned after insertion');
        }

        if (supplierItemsData.length > 0) {
          const { error: itemsError } = await supabase
            .from('supplier_items')
            .insert(supplierItemsData);

          if (itemsError) {
            throw new Error(`Failed to insert supplier items: ${itemsError.message}`);
          }
        }

        const { error: systemLogError } = await supabase
          .from('system_log')
          .insert(systemLogs);

        if (systemLogError) throw systemLogError;
        setFormStatus('success');
        toast.success('Supplier created successfully!');
                 }}

        setTimeout(() => {
          reset();
          setSelectedSupplies([]);
          setSelectedBrands([]);
          navigate('/dashboard/supplierManagement');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error adding supplier:', error);
      setError(error.message || 'Failed to create supplier. Please try again.');
      setFormStatus('error');
      toast.error(error.message || 'Failed to create supplier. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormStatusMessage = () => {
    if (formStatus === 'success') {
      return (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center space-x-2 animate-pulse">
          <CheckCircle className="h-5 w-5" />
          <span>Supplier {isEditing ? 'updated' : 'created'} successfully! Redirecting...</span>
        </div>
      );
    } else if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Toaster />
      <div className="max-w-4xl mx-auto space-y-8">
        <PendingApprovalBanner />

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
            disabled={isSubmitting || isLoading}
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isViewMode ? "View Supplier" : isEditing ? "Update Supplier" : "Add New Supplier"}
              </h1>
              <p className="text-gray-600">
                {isViewMode ? "View supplier details" : isEditing ? 'Update supplier information and settings' : 'Create a new supplier profile for your inventory management'}
              </p>
            </div>
          </div>
        </div>

        {renderFormStatusMessage()}

        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">Supplier Information</CardTitle>
            <CardDescription className="text-blue-600">
              {!isViewMode && (
                <>
                  Fill in the supplier details below to {isEditing ? 'update the existing' : 'create a new'} supplier profile.
                  Fields marked with <span className="text-red-500">*</span> are required.
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 bg-white">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="companyId"
                      className={`${errors.companyId || supplierIdError ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Company ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="companyId"
                      placeholder="Enter company ID"
                      {...register('companyId', {
                        onChange: () => {
                          // Clear supplier ID error when user starts typing
                          if (supplierIdError) {
                            setSupplierIdError('');
                          }
                        }
                      })}
                      onBlur={handleSupplierIdBlur}
                      disabled={isViewMode}
                      className={`${errors.companyId || supplierIdError
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.companyId ? 'border-blue-300' : ''}`}
                    />
                    {errors.companyId && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.companyId.message}
                      </p>
                    )}
                    {supplierIdError && !errors.companyId && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1 animate-pulse">
                        <AlertCircle className="h-3 w-3" />
                        {supplierIdError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="name"
                      className={`${errors.name ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Building2 className="h-4 w-4" /> Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Enter company name"
                      {...register('name')}
                      disabled={isViewMode}
                      className={`${errors.name
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.name ? 'border-blue-300' : ''}`}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="registrationNumber"
                      className={`${errors.registrationNumber ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Registration Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="registrationNumber"
                      placeholder="Enter registration number"
                      {...register('registrationNumber')}
                      disabled={isViewMode}
                      className={`${errors.registrationNumber
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.registrationNumber ? 'border-blue-300' : ''}`}
                    />
                    {errors.registrationNumber && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.registrationNumber.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="taxId"
                      className={`${errors.taxId ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> Tax ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="taxId"
                      placeholder="Enter tax ID"
                      {...register('taxId')}
                      disabled={isViewMode}
                      className={`${errors.taxId
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.taxId ? 'border-blue-300' : ''}`}
                    />
                    {errors.taxId && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.taxId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="contactPerson"
                      className={`${errors.contactPerson ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Building2 className="h-4 w-4" /> Contact Person <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="contactPerson"
                      placeholder="Enter contact person name"
                      {...register('contactPerson')}
                      disabled={isViewMode}
                      className={`${errors.contactPerson
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.contactPerson ? 'border-blue-300' : ''}`}
                    />
                    {errors.contactPerson && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.contactPerson.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="email"
                      className={`${errors.email ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Mail className="h-4 w-4" /> Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@company.com"
                      {...register('email')}
                      disabled={isViewMode}
                      className={`${errors.email
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.email ? 'border-blue-300' : ''}`}
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
                      htmlFor="phone"
                      className={`${errors.phone ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Phone className="h-4 w-4" /> Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      placeholder="Enter phone number"
                      {...register('phone')}
                      disabled={isViewMode}
                      className={`${errors.phone
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.phone ? 'border-blue-300' : ''}`}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group md:col-span-2">
                    <Label
                      htmlFor="website"
                      className={`${errors.website ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Globe className="h-4 w-4" /> Website (Optional)
                    </Label>
                    <Input
                      id="website"
                      placeholder="https://example.com"
                      {...register('website')}
                      disabled={isViewMode}
                      className={`${errors.website
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.website ? 'border-blue-300' : ''}`}
                    />
                    {errors.website && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.website.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Address Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group md:col-span-2">
                    <Label
                      htmlFor="address"
                      className={`${errors.address ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <MapPin className="h-4 w-4" /> Street Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="address"
                      placeholder="Enter street address"
                      {...register('address')}
                      disabled={isViewMode}
                      className={`${errors.address
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.address ? 'border-blue-300' : ''}`}
                    />
                    {errors.address && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.address.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="city"
                      className={`${errors.city ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                    >
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="city"
                      placeholder="Enter city"
                      {...register('city')}
                      disabled={isViewMode}
                      className={`${errors.city
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.city ? 'border-blue-300' : ''}`}
                    />
                    {errors.city && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.city.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="state"
                      className={`${errors.state ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                    >
                      State/Province <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="state"
                      placeholder="Enter state"
                      {...register('state')}
                      disabled={isViewMode}
                      className={`${errors.state
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.state ? 'border-blue-300' : ''}`}
                    />
                    {errors.state && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.state.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="postalCode"
                      className={`${errors.postalCode ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                    >
                      Postal Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="postalCode"
                      placeholder="Enter postal code"
                      {...register('postalCode')}
                      disabled={isViewMode}
                      className={`${errors.postalCode
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 ${watchedFields.postalCode ? 'border-blue-300' : ''}`}
                    />
                    {errors.postalCode && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.postalCode.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="country"
                      className={`${errors.country ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                    >
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="country"
                      placeholder="Enter country"
                      {...register('country')}
                      disabled={isViewMode}
                      className={`${errors.country
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 ${watchedFields.country ? 'border-blue-300' : ''}`}
                    />
                    {errors.country && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.country.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Package className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Supplies Details</h3>
                </div>

                <div className="space-y-4">
                  {/* Brand Selection */}
                  <div className="space-y-2 group relative">
                    <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium">
                      <Search className="h-4 w-4" /> Search Category
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="Search for categories by name..."
                        value={brandSearchTerm}
                        onChange={(e) => setBrandSearchTerm(e.target.value)}
                        onFocus={() => setShowBrandsDropdown(true)}
                        disabled={isViewMode}
                        className={`pl-10 pr-4 py-2 rounded-md shadow-sm focus:ring-4 ${errors.selectedBrands
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } transition-all duration-200`}
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {errors.selectedBrands && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.selectedBrands.message}
                      </p>
                    )}

                    {showBrandsDropdown && filteredBrands.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              Available Category ({filteredBrands.length})
                            </span>
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {filteredBrands.map((brand, index) => (
                            <div
                              key={brand.id}
                              className={`p-4 hover:bg-blue-50 transition-colors duration-200 ${index !== filteredBrands.length - 1 ? 'border-b border-gray-100' : ''
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={
                                      tempSelectedBrands.includes(brand.id) ||
                                      selectedBrands.some(b => b.id === brand.id)
                                    }
                                    onCheckedChange={() => {
                                      if(selectedBrands.some(b => b.id === brand.id)){
                                        return;
                                      }
                                      const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                      handleBrandToggle(brand, syntheticEvent);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isViewMode || selectedBrands.some(b => b.id === brand.id)}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 text-sm">{brand.name}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!isViewMode && <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{tempSelectedBrands.length + selectedBrands.length} selected</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTempSelectedBrands([]);
                                setBrandSearchTerm('');
                                setShowBrandsDropdown(false);
                              }}
                              className="text-gray-600 hover:bg-gray-100 px-3 py-1 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleConfirmBrands}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                              disabled={tempSelectedBrands.length === 0 && selectedBrands.length === 0}
                            >
                              Confirm Selection
                            </Button>
                          </div>
                        </div>}
                      </div>
                    )}

                    {showBrandsDropdown && brandSearchTerm && filteredBrands.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-6 text-center">
                          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No brands found matching "{brandSearchTerm}"</p>
                          <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Brands Display */}
                  {selectedBrands.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          Selected Brands
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {selectedBrands.length}
                          </span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSelectedBrandsExpanded(!isSelectedBrandsExpanded)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-xs flex items-center gap-1"
                          >
                            <span>{isSelectedBrandsExpanded ? 'Collapse' : 'Expand'}</span>
                            {isSelectedBrandsExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                          {!isViewMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBrands([]);
                                setValue('selectedBrands', []);
                                setSelectedSupplies([]);
                                setValue('selectedSupplies', []);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isSelectedBrandsExpanded
                        ? 'max-h-96 opacity-100'
                        : 'max-h-0 opacity-0'
                        }`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                          {selectedBrands.map((brand) => (
                            <div
                              key={brand.id}
                              className="group p-3 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 transform hover:scale-[1.02]"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Package className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                    <p className="font-medium text-gray-900 text-sm truncate">{brand.name}</p>
                                  </div>
                                </div>
                                {!isViewMode && <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBrandRemove(brand.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {!isSelectedBrandsExpanded && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            {selectedBrands.length} brands selected - Click expand to view details
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search Supplies */}
                  <div className="space-y-2 group relative">
                    <Label className={`transition-colors duration-200 flex items-center gap-1 font-medium ${selectedBrands.length === 0
                      ? 'text-gray-400'
                      : 'text-gray-700 group-hover:text-blue-700'
                      }`}>
                      <Search className="h-4 w-4" /> Search Supplies
                      {selectedBrands.length === 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full ml-2">
                          Select brands first
                        </span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder={
                          selectedBrands.length === 0
                            ? "Please select a brand first to search for supplies..."
                            : "Search for supplies by name or description..."
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setShowSuppliesDropdown(true)}
                        disabled={selectedBrands.length === 0 || isViewMode}
                        className={`pl-10 pr-4 py-2 rounded-md shadow-sm focus:ring-4 ${errors.selectedSupplies
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : selectedBrands.length === 0
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } transition-all duration-200`}
                      />
                      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${selectedBrands.length === 0 ? 'text-gray-300' : 'text-gray-400'
                        }`} />
                    </div>
                    {errors.selectedSupplies && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.selectedSupplies.message}
                      </p>
                    )}

                    {showSuppliesDropdown && filteredSupplies.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              Available Supplies ({filteredSupplies.length})
                            </span>
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {filteredSupplies.map((supply, index) => (
                            <div
                              key={supply.id}
                              className={`p-4 hover:bg-blue-50 transition-colors duration-200 ${index !== filteredSupplies.length - 1 ? 'border-b border-gray-100' : ''
                                }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-shrink">
                                  <Checkbox
                                    checked={
                                      tempSelectedSupplies.includes(supply.id) ||
                                      selectedSupplies.some(s => s.id === supply.id)
                                    }
                                    onCheckedChange={() => {
                                      if(selectedSupplies.some(s => s.id === supply.id)){
                                        return;
                                      }
                                      const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                      handleSupplyToggle(supply, syntheticEvent);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isViewMode || selectedSupplies.some(s => s.id === supply.id)}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 flex-shrink-0"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Package className="h-3 w-3 text-gray-400" />
                                      <p className="font-medium text-gray-900 text-sm">{supply.name}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-5">{supply.description}</p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-semibold text-blue-600 text-sm whitespace-nowrap">{formatCurrency(supply.price)}</p>
                                  <p className="text-xs text-gray-400">per unit</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItemIdForDetails(supply.id);
                                      setIsDetailsModalOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!isViewMode && <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{tempSelectedSupplies.length + selectedSupplies.length} selected</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTempSelectedSupplies([]);
                                setShowSuppliesDropdown(false);
                                setSearchTerm('');
                              }}
                              className="text-gray-600 hover:bg-gray-100 px-3 py-1 text-xs"
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
                        </div>}
                      </div>
                    )}
                    <ItemDetailsModal
                      open={isDetailsModalOpen}
                      itemId={selectedItemIdForDetails}
                      onClose={() => {
                        setIsDetailsModalOpen(false);
                        setSelectedItemIdForDetails(null);
                      }}
                    />
                    {showSuppliesDropdown && searchTerm && filteredSupplies.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-6 text-center">
                          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          {selectedBrands.length === 0 ? (
                            <>
                              <p className="text-amber-600 text-sm font-medium">Please select a brand first</p>
                              <p className="text-gray-400 text-xs mt-1">
                                You need to select at least one brand before searching for items
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-gray-500 text-sm">No supplies found matching "{searchTerm}"</p>
                              <p className="text-gray-400 text-xs mt-1">
                                Try adjusting your search terms or select different brands
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedSupplies.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          Selected Supplies
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {selectedSupplies.length}
                          </span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSelectedSuppliesExpanded(!isSelectedSuppliesExpanded)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-xs flex items-center gap-1"
                          >
                            <span>{isSelectedSuppliesExpanded ? 'Collapse' : 'Expand'}</span>
                            {isSelectedSuppliesExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                          {!isViewMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSupplies([]);
                                setValue('selectedSupplies', []);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                      </div>
                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${isSelectedSuppliesExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                          {selectedSupplies.map((supply) => (
                            <div
                              key={supply.id}
                              className="group p-3 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 transform hover:scale-[1.02]"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Package className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                    <p className="font-medium text-gray-900 text-sm truncate">{supply.name}</p>
                                  </div>
                                  {/* <p className="text-sm font-semibold text-blue-600">
                                    {formatCurrency(supply.price)}
                                  </p> */}
                                  <p className="text-xs text-gray-500 truncate">{supply.description}</p>
                                </div>
                                {!isViewMode && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSupplyRemove(supply.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {!isSelectedSuppliesExpanded && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700">
                            {selectedSupplies.length} supplies selected - Click expand to view details
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <BadgeIndianRupee className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Financial Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="bankName"
                      className={`${errors.bankName ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> Bank Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="bankName"
                      placeholder="Enter bank name"
                      {...register('bankName')}
                      disabled={isViewMode}
                      className={`${errors.bankName
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.bankName ? 'border-blue-300' : ''}`}
                    />
                    {errors.bankName && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.bankName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="bank_account_number"
                      className={`${errors.bank_account_number ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> Account Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="bank_account_number"
                      placeholder="Enter account number"
                      {...register('bank_account_number')}
                      disabled={isViewMode}
                      className={`${errors.bank_account_number
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.bank_account_number ? 'border-blue-300' : ''}`}
                    />
                    {errors.bank_account_number && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.bank_account_number.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="ifscCode"
                      className={`${errors.ifscCode ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> IFSC Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ifscCode"
                      placeholder="Enter IFSC code"
                      {...register('ifscCode')}
                      disabled={isViewMode}
                      className={`${errors.ifscCode
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.ifscCode ? 'border-blue-300' : ''}`}
                    />
                    {errors.ifscCode && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.ifscCode.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="ibanCode"
                      className={`${errors.ibanCode ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CreditCard className="h-4 w-4" /> IBAN Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ibanCode"
                      placeholder="Enter IBAN code"
                      {...register('ibanCode')}
                      disabled={isViewMode}
                      className={`${errors.ibanCode
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.ibanCode ? 'border-blue-300' : ''}`}
                    />
                    {errors.ibanCode && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.ibanCode.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="creditLimit"
                      className={`${errors.creditLimit ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <BadgeIndianRupee className="h-4 w-4" /> Credit Limit <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      placeholder="Enter credit limit"
                      {...register('creditLimit', { valueAsNumber: true })}
                      disabled={isViewMode}
                      className={`${errors.creditLimit
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.creditLimit ? 'border-blue-300' : ''}`}
                    />
                    {errors.creditLimit && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.creditLimit.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="paymentTerms"
                      className={`${errors.paymentTerms ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Payment Terms <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="paymentTerms"
                      placeholder="e.g., Net 30"
                      {...register('paymentTerms')}
                      disabled={isViewMode}
                      className={`${errors.paymentTerms
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.paymentTerms ? 'border-blue-300' : ''}`}
                    />
                    {errors.paymentTerms && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.paymentTerms.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Additional Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2 group md:col-span-2">
                    <Label
                      htmlFor="description"
                      className={`${errors.description ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Company Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Enter company description and services offered..."
                      {...register('description')}
                      disabled={isViewMode}
                      className={`${errors.description
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 min-h-24 resize-none ${watchedFields.description ? 'border-blue-300' : ''}`}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group md:col-span-2">
                    <Label
                      htmlFor="status"
                      className={`${errors.status ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <CheckCircle className="h-4 w-4" /> Status <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      onValueChange={(value) => setValue('status', value as 'Active' | 'Inactive' | 'Pending')}
                      value={watchedFields.status}
                      disabled={isViewMode}
                    >
                      <SelectTrigger
                        className={`${errors.status
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${getStatusColor(watchedFields.status)} hover:bg-blue-50`}
                      >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Active', 'Inactive', 'Pending'].map((status) => (
                          <SelectItem key={status} value={status} className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getStatusDotColor(status)}`}></span>
                              <span>{status}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.status.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="rating"
                      className={`${errors.rating ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Star className="h-4 w-4" /> Supplier Rating <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-3">
                      <StarRating
                        rating={watchedFields.rating}
                        onRatingChange={handleRatingChange}
                        readonly={isViewMode}
                      />
                    </div>
                    {errors.rating && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.rating.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group md:col-span-2">
                    <Label
                      htmlFor="notes"
                      className={`${errors.notes ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Additional Notes
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Enter additional notes..."
                      {...register('notes')}
                      disabled={isViewMode}
                      className={`${errors.notes
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 min-h-32 resize-none ${watchedFields.notes ? 'border-blue-300' : ''}`}
                    />
                    {errors.notes && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.notes.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {!isViewMode && <div className="flex justify-end pt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard/supplierManagement')}
                    disabled={isSubmitting || isLoading}
                    className="min-w-[120px] transition-colors duration-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="min-w-[120px] bg-blue-600 hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
                  >
                    {isSubmitting || isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : isEditing ? (
                      <>
                        <Edit3 className="h-4 w-4" />
                        <span>Update Supplier</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Save Supplier</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupplierForm;


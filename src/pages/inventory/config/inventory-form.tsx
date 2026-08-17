import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm, SubmitHandler, FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Search,
  Save,
  Package,
  Target,
  DollarSign,
  Youtube,
  Video,
  ChevronUp,
  ChevronDown,
  X,
  CirclePercent,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/Utils/types/supabaseClient';
import toast from 'react-hot-toast';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/Utils/formatters';
import { Textarea } from '@/components/ui/textarea';
import { ITaxMaster } from '@/Utils/constants';
import { initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Interfaces for types
interface ITemsConfig {
  id: string;
  name: string;
  control_type: 'Textbox' | 'Dropdown' | 'Textarea' | 'Multi Select Dropdown';
  data_type?: 'string' | 'number' | 'unit';
  is_mandatory: boolean;
  max_length?: number;
  collection_id?: string;
  item_unit_id?: string;
  sequence: number;
}

interface CollectionItem {
  id: string;
  display_name: string | null;
}

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  price?: number;
}

interface SelectedAlternative {
  id: string;
  item_name: string;
}

interface ImageMetadata {
  name: string;
  type: string;
  size: number;
  path: string;
}

interface VideoMetadata {
  name: string;
  type: string;
  size: number;
  path: string;
}

interface IUnit {
  id: string;
  name: string;
}

interface ICategoryMaster {
  id: string;
  name: string;
}

interface IUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_id: string | null;
}

type LookupRow = {
  id: string;
  [key: string]: any;
};

// Debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Base schema for static fields
const baseInventoryFormSchema = z.object({
  item_id: z
    .string()
    .min(1, 'Item ID is required')
    .max(50, 'Item ID must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Item ID must be alphanumeric with underscores or hyphens'),
  item_name: z
    .string()
    .min(1, 'Item Name is required')
    .max(100, 'Item Name must be less than 100 characters'),
  category_id: z.string().min(1, 'Item Category is required'),
  description: z
    .string()
    .min(1, 'Description is required'),
  reorder_level: z.number().min(0, 'Reorder level cannot be negative').nullable(),
  max_level: z.number().min(0, 'Maximum level cannot be negative').nullable(),
  selling_price: z.number().min(0, 'Selling price cannot be negative').nullable(),
  tax_percentage: z.record(z.string(), z.number().nullable()).nullable().optional(),
  image_1: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && ['image/jpeg', 'image/png'].includes(file.type)),
      'Image 1 must be a JPG or PNG file'
    )
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, 'Image 1 must be less than 5MB'),
  image_2: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && ['image/jpeg', 'image/png'].includes(file.type)),
      'Image 2 must be a JPG or PNG file'
    )
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, 'Image 2 must be less than 5MB'),
  video: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && file.type === 'video/mp4'),
      'Video must be an MP4 file'
    )
    .refine((file) => !file || file.size <= 50 * 1024 * 1024, 'Video must be less than 50MB'),
  youtube_link: z
    .string()
    .nullable()
    .refine((val) => {
      if (!val || val.trim() === '') return true; // allow null or empty
      try {
        const normalizedVal = val.startsWith('http') ? val : `https://${val}`;
        const url = new URL(normalizedVal);
        const hostname = url.hostname.toLowerCase();
        const pathname = url.pathname;

        // youtube.com (watch or shorts) or youtu.be
        if (hostname.endsWith('youtube.com')) {
          // Accept watch?v=VIDEO_ID or shorts/VIDEO_ID
          return url.searchParams.has('v') || pathname.startsWith('/shorts/');
        }
        if (hostname.endsWith('youtu.be')) {
          return pathname.length > 1; // must have /VIDEO_ID
        }

        return false; // invalid hostname
      } catch {
        return false; // invalid URL
      }
    }, 'Must be a valid YouTube link'),
  category_type: z.enum(['internal', 'external']).default('external'),
});

// Type for dynamic fields
type DynamicFields = Record<string, string | number | File | null | string[] | undefined>;

// Create dynamic schema
const createDynamicSchema = (configurators: ITemsConfig[]) => {
  const dynamicFields: Record<string, z.ZodTypeAny> = {};

  configurators.forEach((config) => {
    const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();
    let fieldSchema: z.ZodTypeAny;

    if (config.control_type === 'Textbox') {
      if (config.data_type === 'number' || config.data_type === 'unit') {
        fieldSchema = z
          .union([
            z.string().regex(/^\d*\.?\d*$/, `${config.name} must be a valid number`).optional(),
            z.number().optional(),
          ])
          .transform((val) => (typeof val === 'string' && val !== '' ? Number(val) : val))
          .refine(
            (val) => {
              if (config.is_mandatory && (val === undefined || val === null || (typeof val === 'string' && val === ''))) {
                return false;
              }
              return true;
            },
            { message: `${config.name} is required` }
          )
          .refine(
            (val) => val === undefined || val === null || (typeof val === 'number' && !isNaN(val) && val >= 0),
            `${config.name} must be a valid number and cannot be negative`
          );
      } else {
        fieldSchema = config.is_mandatory
          ? z
            .string()
            .min(1, `${config.name} is required`)
            .max(config.max_length || 255, `${config.name} must be less than ${config.max_length || 255} characters`)
          : z
            .string()
            .max(config.max_length || 255, `${config.name} must be less than ${config.max_length || 255} characters`)
            .optional();
      }
    } else if (config.control_type === 'Dropdown') {
      fieldSchema = config.is_mandatory
        ? z.string().min(1, `${config.name} is required`)
        : z.string().optional();
    }
    else if (config.control_type === 'Multi Select Dropdown') {
      fieldSchema = config.is_mandatory
        ? z.array(z.string()).min(1, `${config.name} is required`)
        : z.array(z.string()).optional();
    } else if (config.control_type === 'Textarea') {
      fieldSchema = config.is_mandatory
        ? z.string().min(1, `${config.name} is required`)
        : z.string().optional();
    } else {
      fieldSchema = z.any();
    }

    dynamicFields[fieldName] = fieldSchema;
  });

  return baseInventoryFormSchema.extend(dynamicFields);
};
const createTaxSchema = (labels: string[]) => {
  return z.object(
    Object.fromEntries(
      labels.map((label) => [
        label,
        z.preprocess(
          (val) => {
            if (val === '' || val === undefined || val === null) return null;
            const num = Number(val);
            return Number.isNaN(num) ? null : num;
          },
          z
            .number()
            .nullable()
            .refine((v) => v === null || v >= 0, `${label} percentage must not be negative`)
            .refine((v) => v === null || v <= 100, `${label} percentage must be less than or equal to 100`)
        ),
      ])
    )
  );
};

// Form values type
type InventoryFormValues = z.infer<typeof baseInventoryFormSchema> & DynamicFields & {
  tax_percentage?: Record<string, number | null> | null;
};

const InventoryForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id) && location.pathname.includes('edit');
  const isViewing = Boolean(id) && location.pathname.includes('view');
  const [isLoading, setIsLoading] = useState(false);
  const [_, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [selectedAlternativesWithNames, setSelectedAlternativesWithNames] = useState<SelectedAlternative[]>([]);
  const [alternativeSearch, setAlternativeSearch] = useState('');
  const [alternativeItems, setAlternativeItems] = useState<SelectOption[]>([]);
  const [isFetchingAlternatives, setIsFetchingAlternatives] = useState(false);
  const [showAlternativesDropdown, setShowAlternativesDropdown] = useState(false);
  const [tempSelectedAlternatives, setTempSelectedAlternatives] = useState<string[]>([]);
  const [isSelectedAlternativesExpanded, setIsSelectedAlternativesExpanded] = useState(true);
  const debouncedSearch = useDebounce(alternativeSearch, 300);
  const [configurators, setConfigurators] = useState<ITemsConfig[]>([]);
  const [collections, setCollections] = useState<Record<string, CollectionItem[]>>({});
  const [units, setUnits] = useState<IUnit[]>([]);
  const [categories, setCategories] = useState<ICategoryMaster[]>([]);
  const [formSchema, setFormSchema] = useState<z.ZodObject<any>>(baseInventoryFormSchema);
  const [image1Preview, setImage1Preview] = useState<string | null>(null);
  const [image2Preview, setImage2Preview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [initialVideoPreview, setInitialVideoPreview] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [initialAlternatives, setInitialAlternatives] = useState<SelectedAlternative[]>([]);
  const [initialFormValues, setInitialFormValues] = useState<InventoryFormValues | null>(null);
  const [initialImage1Preview, setInitialImage1Preview] = useState<string | null>(null);
  const [initialImage2Preview, setInitialImage2Preview] = useState<string | null>(null);
  const [existingAdditionalAttributes, setExistingAdditionalAttributes] = useState<Record<string, any>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  // const [categoryRetryCount, setCategoryRetryCount] = useState(0);
  const user = localStorage.getItem("userData");
  const userData: IUser | null = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || null;
  const [videoType, setVideoType] = useState('upload'); // 'upload' or 'youtube'
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>('');
  const [showZoom, setShowZoom] = useState(false);
  const [activeZoomImage, setActiveZoomImage] = useState<string | null>(null);
  const [allTaxes, setAllTaxes] = useState<ITaxMaster[]>([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [attributesReady, setAttributesReady] = useState(false);
  const [collectionsLookup, setCollectionsLookup] = useState<any[]>([]);
  const [attributeSearchTerms, setAttributeSearchTerms] = useState<Record<string, string | null>>({});
  const [attributeDropdownOpen, setAttributeDropdownOpen] = useState<Record<string, boolean>>({});
  const [attributeOptions, setAttributeOptions] = useState<Record<string, CollectionItem[]>>({});
  const attributeDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [tempSelectedAttributes, setTempSelectedAttributes] = useState<Record<string, string[]>>({});
  const [isExpandedAttributes, setIsExpandedAttributes] = useState<Record<string, boolean>>({});
  const [selectedAttributeOptions, setSelectedAttributeOptions] = useState<
    Record<string, CollectionItem[]>
  >({});

  // Initialize form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setValue,
    trigger,
    setFocus,
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      item_id: '',
      item_name: '',
      category_id: '',
      description: '',
      reorder_level: null,
      max_level: null,
      selling_price: null,
      tax_percentage: null,
      image_1: null,
      image_2: null,
      video: null,
      youtube_link: null,
      category_type: 'external',
    },
  });

  const watchedFields = watch();

  const handleMouseEnter = (imageSrc: string) => {
    setActiveZoomImage(imageSrc);
    setShowZoom(true);
  };

  const handleMouseLeave = () => {
    setShowZoom(false);
    setActiveZoomImage(null);
  };

  const getTaxError = (label: string) => {
    const taxErrors = errors.tax_percentage as Record<string, any> | undefined | null;
    return taxErrors?.[label];
  };

  // Update default values when configurators change
  useEffect(() => {
    // Do not reset defaults while editing or viewing an existing item
    if (isEditing || isViewing) return;

    const defaultValues: InventoryFormValues = {
      item_id: '',
      item_name: '',
      category_id: '',
      description: '',
      reorder_level: null,
      max_level: null,
      selling_price: null,
      tax_percentage: null,
      image_1: null,
      image_2: null,
      video: null,
      youtube_link: null,
      category_type: 'external',
    };

    configurators.forEach((config) => {
      const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();
      if (config.control_type === 'Textbox' && (config.data_type === 'number' || config.data_type === 'unit')) {
        defaultValues[fieldName] = config.is_mandatory ? '' : '0';
      } else if (config.control_type === 'Multi Select Dropdown') {
        defaultValues[fieldName] = [] as string[];
      } else {
        defaultValues[fieldName] = '';
      }
    });

    reset(defaultValues);
  }, [configurators, reset, isEditing, isViewing]);

  // Handle media change (images and video)
  const handleMediaChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'image_1' | 'image_2' | 'video',
    setPreview: (value: string | null) => void
  ) => {
    if (isViewing) return; // Prevent changes in view mode
    const file = e.target.files?.[0];
    setValue(field, file || null, { shouldDirty: true });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  // === ENSURE SELECTED CATEGORY IS ALWAYS IN LIST (CRITICAL FIX) ===
  useEffect(() => {
    if (!companyId || !(isEditing || isViewing) || !watchedFields.category_id) return;

    const selectedId = String(watchedFields.category_id);
    const alreadyInList = categories.some(c => c.id === selectedId);

    if (!alreadyInList) {
      supabase
        .from('category_master')
        .select('id, name')
        .eq('id', selectedId)
        .eq('company_id', companyId)
        .single()
        .then(({ data }) => {
          if (data) {
            // Ensure name is string, not null
            const safe = { ...data, name: data.name ?? "" };

            setCategories(prev =>
              prev.some(c => c.id === data.id)
                ? prev
                : [...prev, safe]
            );
          } else {
            setCategories(prev =>
              prev.some(c => c.id === selectedId)
                ? prev
                : [...prev, { id: selectedId, name: `(Deleted Category: ${selectedId})` }]
            );
          }
        });
    }
  }, [watchedFields.category_id, isEditing, isViewing, companyId, categories]);


  // Fetch data
  useEffect(() => {
    if (!companyId) return;

    const fetchConfigurators = async () => {
      try {
        const { data, error } = await supabase
          .from('item_configurator')
          .select('*')
          .eq('company_id', companyId)
          .order('sequence', { ascending: true });

        if (error) throw error;

        const configs = data as ITemsConfig[];
        setConfigurators(configs);
        console.log('Fetched configurators:', configs);
        setFormSchema(createDynamicSchema(configs));
        return configs;
      } catch (err: any) {
        console.error('Error fetching configurators:', err);
        toast.error('Failed to load additional attributes.');
        return [];
      }
    };

    const fetchCollections = async (configurators: ITemsConfig[]) => {
      try {
        const dropdownConfigs = configurators.filter(
          (c) =>
            (c.control_type === 'Dropdown' ||
              c.control_type === 'Multi Select Dropdown') &&
            c.collection_id
        );

        if (dropdownConfigs.length === 0) {
          setCollectionsLookup([]);
          setCollections({});
          return;
        }

        const collectionIds = [
          ...new Set(dropdownConfigs.map((c) => c.collection_id!)),
        ];

        const { data: lookupMasters, error } = await supabase
          .from('item_lookup_master')
          .select('id, key, value, type')
          .in('id', collectionIds)
          .eq('company_id', companyId);

        if (error) throw error;

        // Only store lookup metadata
        setCollectionsLookup(lookupMasters || []);
        console.log('Fetched collections lookup:', lookupMasters);
        setCollections({});

      } catch (err) {
        console.error('Error loading dropdown metadata:', err);
        setCollections({});
      }
    };

    const fetchUnits = async () => {
      try {
        const { data, error } = await supabase.from('units_master').select('id, name').eq('company_id', companyId);
        if (error) throw error;
        setUnits(data as IUnit[]);
      } catch (err: any) {
        console.error('Error fetching units:', err);
        toast.error('Failed to load units.');
      }
    };

    if ((isEditing || isViewing) && !attributesReady) return;

    const initFetch = async () => {
      const configs = await fetchConfigurators();
      await Promise.all([fetchCollections(configs), fetchUnits()]);
    };

    initFetch();
  }, [companyId, id, attributesReady]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(attributeDropdownRefs.current).forEach((fieldName) => {
        const ref = attributeDropdownRefs.current[fieldName];

        if (ref && !ref.contains(event.target as Node)) {
          setAttributeDropdownOpen((prev) => ({
            ...prev,
            [fieldName]: false,
          }));
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search attribute options
  const searchAttributeOptions = async (fieldName: string, search: string, lookupRecord: any, selectedValue?: string) => {
    if (!lookupRecord) return;

    const isTableType = lookupRecord.type === "table";

    // Require minimum 3 chars
    if (!search.trim() || search.length < 3) {
      setAttributeOptions(prev => ({ ...prev, [fieldName]: [] }));
      return;
    }

    try {
      // TABLE TYPE → Remote Search with safe fallback filters
      if (isTableType) {
        const tableName = lookupRecord.key;
        const columnName = lookupRecord.value;

        if (!tableName || !columnName) return;

        let data: any[] | null = null;
        let error: any = null;

        // Step 1: Try with both status and is_active
        let response = await supabase
          .from(tableName)
          .select(`id, ${columnName}`)
          .eq("company_id", companyId)
          .eq("is_active", true)
          .or('status.eq.true,status.eq.Active')
          .ilike(columnName, `%${search}%`)
          .limit(10);

        data = (response.data as any) || [];
        error = response.error;

        // Step 2: Try only is_active
        if (error) {
          response = await supabase
            .from(tableName)
            .select(`id, ${columnName}`)
            .eq("company_id", companyId)
            .eq("is_active", true)
            .ilike(columnName, `%${search}%`)
            .limit(10);

          data = (response.data as any) || [];
          error = response.error;
        }

        // Step 3: Try only status
        if (error) {
          response = await supabase
            .from(tableName)
            .select(`id, ${columnName}`)
            .eq("company_id", companyId)
            .or('status.eq.true,status.eq.Active')
            .ilike(columnName, `%${search}%`)
            .limit(10);

          data = (response.data as any) || [];
          error = response.error;
        }

        // Step 4: Fallback without filters
        if (error) {
          response = await supabase
            .from(tableName)
            .select(`id, ${columnName}`)
            .eq("company_id", companyId)
            .ilike(columnName, `%${search}%`)
            .limit(10);

          data = (response.data as any) || [];
          error = response.error;
        }

        if (error) {
          console.error(`Table search error for ${tableName}:`, error);
          setAttributeOptions(prev => ({ ...prev, [fieldName]: [] }));
          return;
        }

        let results = data || [];

        // Ensure selected value is included (edit mode)
        if (
          selectedValue &&
          !results.some(r => String(r.id) === String(selectedValue))
        ) {
          const { data: selectedRecord } = await supabase
            .from(tableName)
            .select(`id, ${columnName}`)
            .eq("id", selectedValue)
            .single();

          if (selectedRecord) {
            results.push(selectedRecord);
          }
        }

        setAttributeOptions(prev => {

          const existing = prev[fieldName] || [];

          const newResults = results.map((r: any) => ({
            id: r.id,
            display_name: r[columnName] || "(No Value)",
          }));

          // Merge without duplicates
          const merged = [
            ...existing,
            ...newResults.filter(
              newItem => !existing.some(
                ex => String(ex.id) === String(newItem.id)
              )
            )
          ];

          return {
            ...prev,
            [fieldName]: merged
          };
        });
      }

      else {
        // COLLECTION TYPE → Remote Search

        let { data, error } = await supabase
          .from("item_lookup_master")
          .select("id, value")
          .eq("company_id", companyId!)
          .eq("key", lookupRecord.key)
          .eq("type", "collection")
          .ilike("value", `%${search}%`)
          .order("order", { ascending: true })
          .limit(10);

        if (error) throw error;

        setAttributeOptions(prev => {

          const existing = prev[fieldName] || [];

          const newResults = (data || []).map((r: any) => ({
            id: r.id,
            display_name: r.value,
          }));

          const merged = [
            ...existing,
            ...newResults.filter(
              newItem => !existing.some(
                ex => String(ex.id) === String(newItem.id)
              )
            )
          ];

          return {
            ...prev,
            [fieldName]: merged
          };
        });
      }

      setAttributeDropdownOpen(prev => ({
        ...prev,
        [fieldName]: true,
      }));

    } catch (err) {
      console.error("Attribute search error:", err);
    }
  };

  useEffect(() => {
    if (!configurators.length) return;
    if (!(isEditing || isViewing)) return;

    configurators.forEach(async (config) => {
      if (
        (config.control_type !== "Dropdown" &&
          config.control_type !== "Multi Select Dropdown") ||
        !config.collection_id
      ) return;

      const fieldName = config.name.replace(/\s+/g, "_").toLowerCase();
      const savedValue = existingAdditionalAttributes?.[fieldName];

      // MULTI SELECT
      if (config.control_type === "Multi Select Dropdown") {

        const savedValues: string[] = savedValue || [];

        if (!Array.isArray(savedValues) || savedValues.length === 0) return;

        const lookupRecord = collectionsLookup?.find(
          (l) => String(l.id) === String(config.collection_id)
        );

        if (!lookupRecord) return;

        const isTableType = lookupRecord.type === "table";

        if (isTableType) {

          const { data } = await supabase
            .from(lookupRecord.key)
            .select(`id, ${lookupRecord.value}`)
            .in("id", savedValues);

          if (data) {

            const formatted = data.map((r: any) => ({
              id: r.id,
              display_name: r[lookupRecord.value],
            }));

            // Temporary search store
            setAttributeOptions(prev => ({
              ...prev,
              [fieldName]: formatted,
            }));

            // Permanent label store (CRITICAL)
            setSelectedAttributeOptions(prev => ({
              ...prev,
              [fieldName]: formatted,
            }));
          }
        } else {

          const { data } = await supabase
            .from("item_lookup_master")
            .select("id, value")
            .in("id", savedValues);

          if (data) {
            const formatted = data.map((r: any) => ({
              id: r.id,
              display_name: r.value,
            }));

            setAttributeOptions(prev => ({
              ...prev,
              [fieldName]: formatted,
            }));

            setSelectedAttributeOptions(prev => ({
              ...prev,
              [fieldName]: formatted,
            }));
          }
        }

        return;
      }

      if (!savedValue) return;

      const lookupRecord = collectionsLookup?.find(
        (l) => l.id === config.collection_id
      );

      if (!lookupRecord) return;

      const isTableType = lookupRecord.type === "table";

      try {
        if (isTableType) {
          const { data } = await supabase
            .from(lookupRecord.key)
            .select(`id, ${lookupRecord.value}`)
            .eq("id", savedValue)
            .single<LookupRow>();

          if (data) {
            const option = {
              id: data.id,
              display_name: data[lookupRecord.value]
            };

            setAttributeOptions(prev => ({
              ...prev,
              [fieldName]: [option]
            }));

            // DIRECTLY set display name from fetched data
            setAttributeSearchTerms(prev => ({
              ...prev,
              [fieldName]: option.display_name
            }));
          }
        } else {
          const { data } = await supabase
            .from("item_lookup_master")
            .select("id, value")
            .eq("id", savedValue)
            .single();

          if (data) {
            const option = {
              id: data.id,
              display_name: data.value
            };

            setAttributeOptions(prev => ({
              ...prev,
              [fieldName]: [option]
            }));

            // DIRECTLY set display name
            setAttributeSearchTerms(prev => ({
              ...prev,
              [fieldName]: option.display_name
            }));
          }
        }

      } catch (err) {
        console.error("Failed loading selected dropdown value", err);
      }
    });
  }, [existingAdditionalAttributes, collectionsLookup, configurators]);

  // Fetch categories
  useEffect(() => {
    // This effect now only runs for the "Create New Item" page.
    // Edit/View mode category fetching is handled sequentially within the item fetch effect.
    if (!companyId || isEditing || isViewing) return;

    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('category_master')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .eq('status', true);
        if (error) throw error;
        setCategories(data as ICategoryMaster[]);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        toast.error('Failed to load categories.');
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [companyId, isEditing, isViewing]);

  // Add this near the top, after your states
  const handleYoutubeChange = useCallback((value: string) => {
    setYoutubeUrl(value);
    const id = extractVideoId(value);
    setYoutubeVideoId(id);
    setValue('youtube_link', value, { shouldValidate: true });
  }, [setValue]);

  // Fetch item details for editing or viewing
  useEffect(() => {
    if ((isEditing || isViewing) && id) {
      setIsLoading(true);
      const fetchItem = async () => {
        try {
          let data: any = null;

          if (id === 'pending') {
            const searchParams = new URLSearchParams(window.location.search);
            const requestId = searchParams.get('request_id');
            
            if (!requestId) throw new Error('Request ID is missing');

            const { data: requestData, error: requestError } = await supabase
                .from('approval_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (requestError) throw requestError;
            if (!requestData) throw new Error('Request not found');

            const parsedPayload = typeof requestData.payload === 'string'
                ? JSON.parse(requestData.payload)
                : requestData.payload;

            const operations = parsedPayload?.operations || [];
            const itemOp = operations.find((op: any) => op.table === 'item_mgmt');
            
            if (itemOp) {
                if (requestData.entity_id) {
                    const { data: dbData, error: dbError } = await supabase
                        .from('item_mgmt')
                        .select('*')
                        .eq('id', requestData.entity_id)
                        .single();
                    if (!dbError && dbData) {
                        data = { ...dbData, ...(itemOp.data || {}) };
                    } else {
                        data = itemOp.data || {};
                    }
                } else {
                    data = itemOp.data || {};
                }
            } else {
                throw new Error('Item data not found in approval request payload');
            }
          } else {
            const { data: dbData, error } = await supabase
              .from('item_mgmt')
              .select('*, category_master:category_master ( id, name )')
              .eq('id', id)
              .single();

            if (error) throw error;
            data = dbData;
          }

          if (!data) throw new Error('Item not found');

          const itemData: any = data;
          const itemCategoryId = itemData.category_id;

          // Block validation until categories are fully ready
          setCategoriesReady(false);
          setCategoriesLoading(true);

          let finalCategories: ICategoryMaster[] = [];

          if (companyId) {
            try {
              let categoryQuery = supabase
                .from('category_master')
                .select('id, name')
                .eq('company_id', companyId);

              if (itemCategoryId) {
                // Include both active categories + the exact one used by this item (even if inactive)
                categoryQuery = categoryQuery.or(
                  `and(is_active.eq.true,status.eq.true),id.eq.${itemCategoryId}`
                );
              } else {
                categoryQuery = categoryQuery.eq('is_active', true).eq('status', true);
              }

              const { data: categoriesData, error: categoriesError } = await categoryQuery;
              if (categoriesError) throw categoriesError;

              finalCategories = categoriesData as ICategoryMaster[];

              // Guarantee the current item's category is always in the list
              if (itemData.category_master && itemCategoryId) {
                const currentCatId = String(itemData.category_master.id);
                const exists = finalCategories.some(c => c.id === currentCatId);
                if (!exists) {
                  finalCategories.push({
                    id: currentCatId,
                    name: itemData.category_master.name || `(Deleted Category: ${currentCatId})`,
                  });
                }
              }
            } catch (catErr) {
              console.error('Failed to load categories:', catErr);
              toast.error('Could not load categories');
              // Still proceed — at minimum show the current item's category
              if (itemData.category_master) {
                finalCategories = [{
                  id: String(itemData.category_master.id),
                  name: itemData.category_master.name || `(Category: ${itemCategoryId})`,
                }];
              }
            } finally {
              setCategories(finalCategories);
              setCategoriesLoading(false);
              setCategoriesReady(true); // NOW safe to validate
            }
          }

          // Set category value BEFORE reset()
          if (itemCategoryId) {
            setValue('category_id', String(itemCategoryId), { shouldValidate: false });
          }

          // Populate tax fields
          if (itemData.tax_percentage) {
            Object.entries(itemData.tax_percentage).forEach(([label, value]) => {
              setValue(`tax_percentage.${label}`, value as number | null);
            });
          }

          // Build form values
          const formValues: InventoryFormValues = {
            item_id: itemData.item_id || '',
            item_name: itemData.item_name || '',
            category_id: itemCategoryId != null ? String(itemCategoryId) : '',
            description: itemData.description || '',
            reorder_level: itemData.reorder_level ?? null,
            max_level: itemData.max_level ?? null,
            selling_price: itemData.selling_price ?? null,
            tax_percentage: itemData.tax_percentage ?? null,
            image_1: null,
            image_2: null,
            video: null,
            youtube_link: null,
            category_type: itemData.category_type === 'internal' ? 'internal' : 'external',
            ...(itemData.addtional_attributes as Record<string, any> || {}),
          };

          // Handle dynamic attributes
          configurators.forEach((config) => {
            const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();

            if (config.control_type === 'Dropdown' && config.collection_id) {
              const savedId = formValues[fieldName]; // This is the lookup record ID

              if (savedId) {
                const collectionItems = collections[config.collection_id] || [];
                const isValid = collectionItems.some(item => item.id === savedId);

                if (!isValid) {
                  console.warn(`Saved lookup ID ${savedId} not in current list for ${fieldName}, keeping anyway`);
                }
              }
            }

            // Ensure number fields are strings for input control
            if ((config.data_type === 'number' || config.data_type === 'unit') && formValues[fieldName] != null) {
              formValues[fieldName] = String(formValues[fieldName]);
            }
          });

          // Set images
          if (itemData.image) {
            const imageMetadata = itemData.image as { image_1?: ImageMetadata; image_2?: ImageMetadata };
            if (imageMetadata.image_1?.path) {
              const { data: publicUrl } = supabase.storage.from('item-images').getPublicUrl(imageMetadata.image_1.path);
              setImage1Preview(publicUrl.publicUrl);
              setInitialImage1Preview(publicUrl.publicUrl);
            }
            if (imageMetadata.image_2?.path) {
              const { data: publicUrl } = supabase.storage.from('item-images').getPublicUrl(imageMetadata.image_2.path);
              setImage2Preview(publicUrl.publicUrl);
              setInitialImage2Preview(publicUrl.publicUrl);
            }
          }

          // Handle video / YouTube
          if (itemData.youtube_link) {
            formValues.youtube_link = itemData.youtube_link;
            formValues.video = null;
            setVideoType('youtube');
            setYoutubeUrl(itemData.youtube_link);
            handleYoutubeChange(itemData.youtube_link);
          } else if (itemData.video) {
            const videoMetadata = itemData.video as VideoMetadata;
            formValues.youtube_link = null;
            formValues.video = null;
            setVideoType('upload');
            if (videoMetadata.path) {
              const { data: publicUrl } = supabase.storage.from('item_video').getPublicUrl(videoMetadata.path);
              setVideoPreview(publicUrl.publicUrl);
              setInitialVideoPreview(publicUrl.publicUrl);
            }
          } else {
            formValues.youtube_link = null;
            formValues.video = null;
            setVideoType('upload');
          }

          // Handle alternative items
          if (Array.isArray(itemData.alternative_items_list) && itemData.alternative_items_list.length > 0) {
            const altItemIds = itemData.alternative_items_list.map((alt: any) =>
              typeof alt === 'string' ? alt : alt.item_id
            );
            const { data: altItems, error: altError } = await supabase
              .from('item_mgmt')
              .select('id, item_name')
              .eq('company_id', companyId!)
              .in('id', altItemIds);

            if (altError) throw altError;

            const altMap = new Map(altItems.map((item: any) => [item.id, item.item_name]));
            const alternatives = altItemIds.map((item_id: string) => ({
              id: item_id,
              item_name: altMap.get(item_id) || item_id,
            }));
            setSelectedAlternativesWithNames(alternatives);
            setInitialAlternatives(alternatives);
          }

          // Store existing additional attributes FIRST
          setExistingAdditionalAttributes(itemData.addtional_attributes || {});
          setAttributesReady(true); // 👈 VERY IMPORTANT

          // Reset form AFTER attributes are stored
          setInitialFormValues(formValues);
          reset(formValues);

          // Reset
          setInitialFormValues(formValues);
          reset(formValues);

          setIsLoading(false);
        } catch (err: any) {
          console.error('Error fetching item:', err);
          toast.error(err.message || 'Failed to load item data.');
          setIsLoading(false);
        }
      };

      fetchItem();
    }
  }, [id, isEditing, isViewing, reset, configurators, collections, companyId, setValue]);

  // Defer validation of category_id until categories are ready
  useEffect(() => {
    if (categoriesReady && watchedFields.category_id) {
      trigger('category_id');
    }
  }, [categoriesReady, watchedFields.category_id, trigger]);

  useEffect(() => {
    if (!isEditing && !isViewing) {
      setCategoriesReady(true); // Create mode: always ready
    }
  }, [isEditing, isViewing]);

  // Fetch alternative items
  useEffect(() => {
    if (isViewing) return; // Skip fetching alternatives in view mode
    const fetchAlternativeItems = async () => {
      if (!debouncedSearch.trim() || debouncedSearch.trim().length < 3) {
        setAlternativeItems([]);
        setIsFetchingAlternatives(false);
        setShowAlternativesDropdown(false);
        return;
      }

      setIsFetchingAlternatives(true);
      try {
        let query = supabase
          .from('item_mgmt')
          .select('id, item_name, description, selling_price')
          .eq('is_active', true)
          .eq("is_temporary", false)
          .eq('company_id', companyId!)
          .or(`item_name.ilike.%${debouncedSearch.trim()}%,description.ilike.%${debouncedSearch.trim()}%`)
          .limit(10);

        if (id) {
          query = query.neq('id', id);
        }

        const { data, error } = await query;

        if (error) throw error;

        const options: SelectOption[] = data.map((item: any) => ({
          value: item.id,
          label: item.item_name,
          description: item.description || 'No description',
          price: item.selling_price ? parseFloat(item.selling_price) : 0,
        }));

        setAlternativeItems(options);
        setShowAlternativesDropdown(true);
      } catch (err: any) {
        console.error('Error fetching alternative items:', err);
        toast.error('Failed to load alternative items.');
        setAlternativeItems([]);
        setShowAlternativesDropdown(false);
      } finally {
        setIsFetchingAlternatives(false);
      }
    };

    fetchAlternativeItems();
  }, [debouncedSearch, id, isViewing]);

  useEffect(() => {
    if (!companyId) return;

    const fetchAllTaxes = async () => {
      try {
        const { data, error } = await supabase
          .from("tax_master")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true);

        if (error) throw error;

        setAllTaxes(data);
                  console.log('Fetched item data:', data);

      } catch (err) {
        console.error('Error fetching all taxes:', err)
        toast.error("Failed to load taxes");
      }
    };

    fetchAllTaxes();
  }, [companyId]);

  // Update schema for taxes
  useEffect(() => {
    if (allTaxes.length === 0 && !initialFormValues) return;
    const activeLabels = allTaxes.map(t => t.label).filter((l): l is string => l !== null);
    const itemTaxLabels = Object.keys(initialFormValues?.tax_percentage ?? {}).filter((l): l is string => l !== null);
    const allLabels = [...new Set([...activeLabels, ...itemTaxLabels])];
    const taxSchema = createTaxSchema(allLabels);
    setFormSchema((prev) =>
      prev.extend({
        tax_percentage: taxSchema.optional(),
      })
    );
  }, [allTaxes, initialFormValues]);

  // Set default tax values
  useEffect(() => {
    if (!allTaxes.length) return;

    const isInitialTaxEmpty =
      !initialFormValues?.tax_percentage ||
      Object.keys(initialFormValues.tax_percentage).length === 0;

    // Create mode - set all default tax values
    if (!isEditing && !isViewing) {
      allTaxes.forEach(tax => {
        if (tax.label) {
          setValue(`tax_percentage.${tax.label}`, tax.value ?? null, {
            shouldValidate: false,
            shouldDirty: false
          });
        }
      });
      return;
    }

    // Editing mode but tax_percentage is empty => treat like create mode
    if (isEditing && isInitialTaxEmpty) {
      allTaxes.forEach(tax => {
        if (tax.label) {
          setValue(`tax_percentage.${tax.label}`, tax.value ?? null, {
            shouldValidate: false,
            shouldDirty: false
          });
        }
      });
      return;
    }

    // Editing mode with existing taxes - only fill missing ones
    if (isEditing && !isInitialTaxEmpty) {
      const currentTaxValues = watchedFields.tax_percentage || {};
      allTaxes.forEach(tax => {
        if (tax.label && !(tax.label in currentTaxValues)) {
          setValue(`tax_percentage.${tax.label}`, tax.value ?? null, {
            shouldValidate: false,
            shouldDirty: false
          });
        }
      });
    }
  }, [allTaxes, isEditing, isViewing, initialFormValues, setValue, watchedFields.tax_percentage]);

  // Handle alternative toggle
  const handleAlternativeToggle = (alternative: SelectOption, e: React.MouseEvent) => {
    if (isViewing) return; // Prevent changes in view mode
    e.stopPropagation();
    const isSelected = tempSelectedAlternatives.includes(alternative.value);
    if (isSelected) {
      setTempSelectedAlternatives(tempSelectedAlternatives.filter((id) => id !== alternative.value));
    } else {
      setTempSelectedAlternatives([...tempSelectedAlternatives, alternative.value]);
    }
  };

  const fetchAlternativeItemsData = async (tempAlternativeIDs: string[]) => {
    if (!companyId) return;
    try {
      const idsToFetch = tempAlternativeIDs.filter(
        id => !selectedAlternativesWithNames.some(existing => existing.id === id)
      );

      if (idsToFetch.length === 0) return [];

      const { data, error } = await supabase
        .from('item_mgmt')
        .select('id, item_name')
        .eq('company_id', companyId)
        .in('id', idsToFetch);

      if (error) {
        console.error('Error fetching alternative items:', error.message);
        toast.error('Failed to fetch alternative items.');
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        item_name: item.item_name || 'Unnamed Item',
      }));
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Unexpected error occurred while fetching alternative items.');
      return [];
    }
  };

  // Confirm alternatives
  const handleConfirmAlternatives = async () => {
    if (isViewing) return; // Prevent changes in view mode
    const newSelectedAlternativesIDs = [...new Set([...tempSelectedAlternatives, ...selectedAlternativesWithNames.map(s => s.id)])];
    const newlyFetchedAlternatives = await fetchAlternativeItemsData(tempSelectedAlternatives) || [];

    const newSelectedAlternatives = [
      ...selectedAlternativesWithNames.filter(alt =>
        newSelectedAlternativesIDs.includes(alt.id)
      ),
      ...newlyFetchedAlternatives,
    ];

    setSelectedAlternativesWithNames(newSelectedAlternatives);
    setAlternativeSearch('');
    setShowAlternativesDropdown(false);
    setTempSelectedAlternatives([]);
  };

  // Remove alternative
  const handleAlternativeRemove = (alternativeId: string) => {
    if (isViewing) return; // Prevent changes in view mode
    setSelectedAlternativesWithNames((prev) => prev.filter((alt) => alt.id !== alternativeId));
  };

  // Check duplicate item_id
  const checkDuplicateItemId = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('item_mgmt')
        .select('item_id')
        .eq('company_id', companyId!)
        .eq('item_id', itemId);

      if (error) {
        throw error;
      }

      return data && data.length > 0;
    } catch (err: any) {
      console.error('Error checking duplicate item_id:', err);
      return false;
    }
  };

  // Check for unsaved changes
  const hasUnsavedChanges = (): boolean => {
    if (isViewing) return false; // No unsaved changes in view mode
    if (isDirty) return true;

    const currentAlternativesJson = JSON.stringify(selectedAlternativesWithNames.map((alt) => alt.id).sort());
    const initialAlternativesJson = JSON.stringify(initialAlternatives.map((alt) => alt.id).sort());
    if (currentAlternativesJson !== initialAlternativesJson) return true;

    if (
      image1Preview !== initialImage1Preview ||
      image2Preview !== initialImage2Preview ||
      videoPreview !== initialVideoPreview
    ) return true;

    if (initialFormValues) {
      const currentValues = watchedFields;
      for (const key in initialFormValues) {
        const initialValue = initialFormValues[key as keyof InventoryFormValues];
        const currentValue = currentValues[key as keyof InventoryFormValues];
        const normalizedInitial = initialValue === null || initialValue === undefined ? '' : String(initialValue);
        const normalizedCurrent = currentValue === null || currentValue === undefined ? '' : String(currentValue);
        if (normalizedInitial !== normalizedCurrent) {
          return true;
        }
      }
    }

    return false;
  };

  const handleDeleteVideo = async (filePath: string) => {
    try {
      const bucketName = 'item_video';
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting video:', error.message);
      } else {
        console.log('Video deleted successfully:', data);
      }
    } catch (error) {
      console.error('Error deleting video from supabase:', error);
    }
  };

  // Form submission
 const onSubmit: SubmitHandler<InventoryFormValues> = async (data) => {
  if (isViewing) return;

  if (isEditing && id) {
    const isLocked = await checkEntityLock(id);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }
  }

  setFormStatus('submitting');
  setIsLoading(true);

  try {
    if (!companyId) {
      throw new Error('Company ID is not available. Please ensure you are logged in.');
    }

    if (!userData?.id) {
      throw new Error('User data not found. Please login again.');
    }

    if (!isEditing) {
      const isDuplicate = await checkDuplicateItemId(data.item_id);

      if (isDuplicate) {
        throw new Error('Item ID already exists. Please use a unique ID.');
      }
    }

    let addtionalAttributes: Record<string, any> = isEditing
      ? { ...existingAdditionalAttributes }
      : {};

    configurators.forEach((config) => {
      const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();

      if (config.control_type === 'Multi Select Dropdown') {
        addtionalAttributes[fieldName] = data[fieldName] || [];
      } else if (
        (config.data_type === 'number' || config.data_type === 'unit') &&
        data[fieldName] != null
      ) {
        addtionalAttributes[fieldName] = Number(data[fieldName]);
      } else {
        addtionalAttributes[fieldName] = data[fieldName];
      }
    });

    const imageMetadata: {
      image_1?: ImageMetadata;
      image_2?: ImageMetadata;
    } = {};

    let videoMetadata: VideoMetadata | null = null;

    let existingImageMetadata: {
      image_1?: ImageMetadata;
      image_2?: ImageMetadata;
    } | null = null;

    let existingVideoMetadata: VideoMetadata | null = null;

    if (isEditing && id) {
      const { data: itemData, error: fetchError } = await supabase
        .from('item_mgmt')
        .select('image, video')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      existingImageMetadata = itemData.image as {
        image_1?: ImageMetadata;
        image_2?: ImageMetadata;
      } | null;

      existingVideoMetadata = itemData.video as VideoMetadata | null;
    }

    

    if (data.image_1 instanceof File) {
      if (isEditing && existingImageMetadata?.image_1?.path) {
        const { error: deleteError } = await supabase.storage
          .from('item-images')
          .remove([existingImageMetadata.image_1.path]);

        if (deleteError) {
          console.error('Error deleting old image_1:', deleteError);
          toast.error('Failed to delete old image.');
        }
      }

      const fileExt = data.image_1.name.split('.').pop();
      const fileName = `${data.item_id}_image1_${Date.now()}.${fileExt}`;
      const filePath = `${data.item_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, data.image_1);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      imageMetadata.image_1 = {
        name: data.image_1.name,
        type: data.image_1.type,
        size: data.image_1.size,
        path: filePath,
      };
    } else if (existingImageMetadata?.image_1) {
      imageMetadata.image_1 = existingImageMetadata.image_1;
    }

   

    if (data.image_2 instanceof File) {
      if (isEditing && existingImageMetadata?.image_2?.path) {
        const { error: deleteError } = await supabase.storage
          .from('item-images')
          .remove([existingImageMetadata.image_2.path]);

        if (deleteError) {
          console.error('Error deleting old image_2:', deleteError);
          toast.error('Failed to delete old image.');
        }
      }

      const fileExt = data.image_2.name.split('.').pop();
      const fileName = `${data.item_id}_image2_${Date.now()}.${fileExt}`;
      const filePath = `${data.item_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, data.image_2);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      imageMetadata.image_2 = {
        name: data.image_2.name,
        type: data.image_2.type,
        size: data.image_2.size,
        path: filePath,
      };
    } else if (existingImageMetadata?.image_2) {
      imageMetadata.image_2 = existingImageMetadata.image_2;
    }

    

    if (data.video instanceof File) {
      if (isEditing && existingVideoMetadata?.path) {
        const { error: deleteError } = await supabase.storage
          .from('item_video')
          .remove([existingVideoMetadata.path]);

        if (deleteError) {
          console.error('Error deleting old video:', deleteError);
          toast.error('Failed to delete old video.');
        }
      }

      const fileExt = data.video.name.split('.').pop();
      const fileName = `${data.item_id}_video_${Date.now()}.${fileExt}`;
      const filePath = `${data.item_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item_video')
        .upload(filePath, data.video);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      videoMetadata = {
        name: data.video.name,
        type: data.video.type,
        size: data.video.size,
        path: filePath,
      };
    } else if (existingVideoMetadata) {
      videoMetadata = existingVideoMetadata;
    }

   

    const payload: any = {
      item_id: data.item_id,
      item_name: data.item_name,
      category_id: data.category_id,
      description: data.description,
      reorder_level: data.reorder_level ?? null,
      max_level: data.max_level ?? null,
      selling_price: data.selling_price ?? null,
      tax_percentage: data.tax_percentage
        ? Object.fromEntries(
            Object.entries(data.tax_percentage).filter(
              ([_, v]) => v !== null
            )
          )
        : null,
      addtional_attributes: addtionalAttributes,
      alternative_items_list: selectedAlternativesWithNames.map((alt) => ({
        item_id: alt.id,
      })),
      image:
        Object.keys(imageMetadata).length > 0
          ? imageMetadata
          : null,
      video: null,
      youtube_link: null,
      company_id: companyId,
      category_type: data.category_type,
    };

    

    if (videoType === 'upload') {
      payload.video = videoMetadata;
      payload.youtube_link = null;
    } else if (videoType === 'youtube') {
      payload.video = null;
      payload.youtube_link = youtubeUrl.trim() || null;

      if (videoMetadata?.path) {
        await handleDeleteVideo(videoMetadata.path);
      }
    }

    

    if (
      !isEditing &&
      (!payload.item_name ||
        !payload.category_id ||
        !payload.description)
    ) {
      throw new Error('All mandatory fields are required');
    }

    

    const systemLogs = {
      company_id: companyId,
      transaction_date: new Date().toISOString(),
      module: 'Item Master',
      scope: isEditing ? 'Edit' : 'Add',
      key: data.item_id,
      log: isEditing
        ? `Item ${data.item_id} updated.`
        : `Item ${data.item_id} created.`,
      action_by: userData.id,
      created_at: new Date().toISOString(),
    };

    

    const action_payload = {
      validations: [
        {
          type: 'unique',
          table: 'item_mgmt',
          column: 'item_id',
          value: payload.item_id,
          company_id: companyId,
          ...(isEditing ? { ignore_id: id } : {})
        }
      ],
      operations: [
        {
          table: 'item_mgmt',
          type: isEditing ? 'update' : 'insert',
          data: payload,
          ...(isEditing
            ? {
                match: {
                  id: id,
                  company_id: companyId,
                },
              }
            : {}),
        },
        {
          table: 'system_log',
          type: 'insert',
          data: systemLogs,
        },
      ],
    };

    

    const approvalResponse = await initiateApprovalRequest({
      module_name: 'Item Master',
      action_name: isEditing ? 'Edit' : 'Add',
      company_id: companyId,
      requested_by: userData.id,
      action_payload,
      entity_id: isEditing ? id : null,
    });

    if (!approvalResponse?.success) {
      throw new Error(
        approvalResponse?.message ||
          'Approval initiation failed'
      );
    }

    

    if (approvalResponse.requires_approval) {
      setFormStatus('success');

      toast.success(
        'Your action has been submitted and is currently pending approval.',
        {
          position: 'top-center',
        }
      );

      setTimeout(() => {
        navigate(-1);
      }, 1000);

      return;
    }

    

    if (isEditing && id) {
      const { error: updateError } = await supabase
        .from('item_mgmt')
        .update(payload)
        .eq('id', id)
        .eq('company_id', companyId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from('item_mgmt')
        .insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    

    const { error: systemLogError } = await supabase
      .from('system_log')
      .insert(systemLogs);

    if (systemLogError) {
      throw new Error(systemLogError.message);
    }

    
    setFormStatus('success');

    toast.success(
      isEditing
        ? 'Item updated successfully!'
        : 'Item created successfully!',
      {
        position: 'top-center',
      }
    );

    setTimeout(() => {
      navigate(-1);
    }, 1000);

  } catch (err: any) {
    console.error('Error submitting form:', err);

    setFormStatus('error');

    toast.error(
      err?.message || 'Failed to save item.',
      {
        position: 'top-center',
      }
    );
  } finally {
    setIsLoading(false);
  }
};

  // Handle form submission
  const handleFormSubmit = async (data: InventoryFormValues) => {
    if (isViewing) return; // Prevent submission in view mode
    const isValid = await trigger();
    if (!isValid) {
      const firstErrorField = Object.keys(errors)[0] as keyof InventoryFormValues;
      if (firstErrorField) {
        setFocus(firstErrorField);
        const errorElement = document.getElementById(firstErrorField as string);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }
    await onSubmit(data);
  };

  // Handle cancel
  const handleCancel = () => {
    if (isViewing) {
      navigate(-1); // Directly navigate back in view mode
      return;
    }
    if (hasUnsavedChanges()) {
      setShowCancelDialog(true);
    } else {
      clearFormAndNavigate();
    }
  };

  // Clear form and navigate
  const clearFormAndNavigate = () => {
    reset({
      item_id: '',
      item_name: '',
      category_id: '',
      description: '',
      reorder_level: null,
      max_level: null,
      selling_price: null,
      image_1: null,
      image_2: null,
      video: null,
    });
    setInitialFormValues(null);
    setSelectedAlternativesWithNames([]);
    setInitialAlternatives([]);
    setAlternativeSearch('');
    setImage1Preview(null);
    setImage2Preview(null);
    setVideoPreview(null);
    setInitialImage1Preview(null);
    setInitialImage2Preview(null);
    setInitialVideoPreview(null);
    setFormStatus('idle');
    setExistingAdditionalAttributes({});
    navigate(-1);
  };

  // Confirm cancel
  const confirmCancel = () => {
    setShowCancelDialog(false);
    clearFormAndNavigate();
  };

  // Stay on form
  const stayOnForm = () => {
    setShowCancelDialog(false);
  };

  // Render dynamic field
  const renderDynamicField = (config: ITemsConfig) => {
    const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();
    const error = errors[fieldName as keyof InventoryFormValues] as FieldError | undefined;

    if (config.control_type === 'Textbox') {
      const inputType = config.data_type === 'number' || config.data_type === 'unit' ? 'number' : 'text';
      return (
        <div className="space-y-2 group">
          <Label
            htmlFor={fieldName}
            className={`${error ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
          >
            <Package className="h-4 w-4" /> {config.name}{' '}
            {config.is_mandatory && <span className="text-red-500">*</span>}
            {config.data_type === 'unit' && config.item_unit_id && (
              <span>({units.find((unit) => unit.id === config.item_unit_id)?.name || ''})</span>
            )}
          </Label>
          <Input
            id={fieldName}
            type={inputType}
            placeholder={`Enter ${config.name}`}
            {...register(fieldName, {
              setValueAs: (value) =>
                (config.data_type === 'number' || config.data_type === 'unit') && value !== ''
                  ? String(value)
                  : value,
            })}
            disabled={isViewing}
            className={`${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields[fieldName] && !isViewing ? 'border-blue-300' : ''}`}
          />
          {error?.message && (
            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              {error.message}
            </p>
          )}
        </div>
      );
    } else if (config.control_type === 'Dropdown' && config.collection_id) {

      const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();
      const currentValue = watchedFields[fieldName] as string | undefined;

      const lookupRecord = collectionsLookup?.find(
        (l) => l.id === config.collection_id
      );

      const searchTerm = attributeSearchTerms[fieldName] || "";

      // Attribute options
      const options =
        searchTerm.trim().length >= 3
          ? (attributeOptions[fieldName] || [])
          : [];

      const selectedOption = options.find(
        (o) => String(o.id) === String(currentValue)
      );

      return (
        <div className="space-y-2 relative">
          <Label
            htmlFor={fieldName}
            className={`${error ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
          >
            <Package className="h-4 w-4" />
            {config.name}
            {config.is_mandatory && <span className="text-red-500">*</span>}
          </Label>

          <div className="relative">
            <Input
              placeholder={`Search ${config.name}...`}
              value={selectedOption?.display_name ?? searchTerm}
              onChange={(e) => {
                const value = e.target.value;

                setAttributeSearchTerms(prev => ({
                  ...prev,
                  [fieldName]: value,
                }));

                // Clear selected value while typing
                setValue(fieldName, "", { shouldDirty: true });

                const shouldOpen = value.trim().length >= 3;

                setAttributeDropdownOpen(prev => ({
                  ...prev,
                  [fieldName]: shouldOpen,
                }));

                if (shouldOpen && lookupRecord) {
                  searchAttributeOptions(
                    fieldName,
                    value,
                    lookupRecord,
                    currentValue
                  );
                } else {
                  // clear results if less than 3 chars
                  setAttributeOptions(prev => ({
                    ...prev,
                    [fieldName]: [],
                  }));
                }
              }}
              disabled={isViewing}
              className={`${error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields[fieldName] && !isViewing ? 'border-blue-300' : ''}`}
            />

            {/* Dropdown */}
            {attributeDropdownOpen[fieldName] &&
              searchTerm.trim().length >= 3 && (
                <div
                  ref={(el) => {
                    attributeDropdownRefs.current[fieldName] = el;
                  }}
                  className="absolute left-0 top-full mt-2 w-full bg-white border border-gray-200 rounded-md shadow-2xl max-h-60 overflow-y-auto z-[9999]"
                >
                  {options.length > 0 ? (
                    options.map(option => (
                      <div
                        key={option.id}
                        className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150"
                        onClick={() => {
                          setValue(fieldName, option.id, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });

                          setAttributeSearchTerms(prev => ({
                            ...prev,
                            [fieldName]: option.display_name,
                          }));

                          setAttributeDropdownOpen(prev => ({
                            ...prev,
                            [fieldName]: false,
                          }));

                          setAttributeOptions(prev => ({
                            ...prev,
                            [fieldName]: [],
                          }));
                        }}
                      >
                        {option.display_name}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-500 text-sm">
                      No results found
                    </div>
                  )}
                </div>
              )}
          </div>

          {error?.message && (
            <p className="text-sm text-red-500 mt-1">
              {error.message}
            </p>
          )}
        </div>
      );
    }
    else if (config.control_type === 'Multi Select Dropdown' && config.collection_id) {

      const fieldName = config.name.replace(/\s+/g, '_').toLowerCase();
      const searchTerm = attributeSearchTerms[fieldName] || "";
      const selectedValues = Array.isArray(watchedFields[fieldName]) ? watchedFields[fieldName] : [];
      const tempSelected = tempSelectedAttributes[fieldName] || [];
      const isExpanded = isExpandedAttributes[fieldName] || false;

      const options = attributeOptions[fieldName] || [];

      return (
        <div className="space-y-2 relative">

          <Label
            htmlFor={fieldName}
            className={`${error ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
          >
            <Package className="h-4 w-4" />
            {config.name}
            {config.is_mandatory && <span className="text-red-500">*</span>}
          </Label>

          {/* Search Input */}
          <Input
            placeholder={`Search ${config.name}...`}
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setAttributeSearchTerms(prev => ({ ...prev, [fieldName]: value, }));
              const lookupRecord = collectionsLookup?.find((l) => l.id === config.collection_id);

              if (value.trim().length >= 3 && lookupRecord) {
                searchAttributeOptions(fieldName, value, lookupRecord);
                setAttributeDropdownOpen(prev => ({ ...prev, [fieldName]: true, }));
              } else {
                setAttributeDropdownOpen(prev => ({ ...prev, [fieldName]: false, }));
                setAttributeOptions(prev => ({ ...prev, [fieldName]: [], }));
              }
            }}
            onFocus={() =>
              setAttributeDropdownOpen(prev => ({ ...prev, [fieldName]: true, }))
            }
            disabled={isViewing}
            className={`${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
          />

          {/* Dropdown */}
          {attributeDropdownOpen[fieldName] &&
            searchTerm.trim().length >= 3 && (
              <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1">

                <div className="max-h-72 overflow-y-auto">
                  {options.length > 0 ? (
                    options.map(option => {
                      const isChecked = tempSelected.includes(option.id) || selectedValues.includes(option.id);
                      return (
                        <div
                          key={option.id}
                          className="p-3 hover:bg-blue-50 flex items-center gap-3"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {
                              let updated;

                              if (tempSelected.includes(option.id)) {
                                updated = tempSelected.filter(id => id !== option.id);
                              } else {
                                updated = [...tempSelected, option.id];
                              }

                              // Save label immediately
                              setSelectedAttributeOptions(prev => {
                                const existing = prev[fieldName] || [];

                                if (existing.some(o => String(o.id) === String(option.id))) {
                                  return prev;
                                }

                                return {
                                  ...prev,
                                  [fieldName]: [
                                    ...existing,
                                    {
                                      id: option.id,
                                      display_name: option.display_name,
                                    },
                                  ],
                                };
                              });

                              setTempSelectedAttributes(prev => ({
                                ...prev,
                                [fieldName]: updated,
                              }));
                            }}
                          />

                          <span className="text-sm font-medium">{option.display_name}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-sm text-gray-500 text-center">No results found</div>
                  )}
                </div>

                {/* Confirm Footer */}
                {!isViewing && (
                  <div className="p-3 border-t flex justify-between">

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTempSelectedAttributes(prev => ({ ...prev, [fieldName]: [], }));
                        setAttributeDropdownOpen(prev => ({ ...prev, [fieldName]: false, }));
                      }}
                    >
                      Cancel
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        const merged = [
                          ...new Set([
                            ...tempSelected,
                            ...selectedValues
                          ])
                        ];

                        // Save labels permanently
                        const permanentLabels = merged.map(id => {
                          const fromSearch = attributeOptions[fieldName]?.find(o => String(o.id) === String(id));
                          const existing = selectedAttributeOptions[fieldName]?.find(o => String(o.id) === String(id));

                          return fromSearch || existing || { id, display_name: id };
                        });

                        setSelectedAttributeOptions(prev => ({ ...prev, [fieldName]: permanentLabels }));
                        setValue(fieldName, merged, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });

                        setTempSelectedAttributes(prev => ({
                          ...prev,
                          [fieldName]: [],
                        }));

                        setAttributeDropdownOpen(prev => ({ ...prev, [fieldName]: false, }));
                        setAttributeSearchTerms(prev => ({ ...prev, [fieldName]: "", }));
                      }}
                    >
                      Confirm Selection
                    </Button>

                  </div>
                )}
              </div>
            )}

          {/* Selected List */}
          {selectedValues.length > 0 && (
            <div className="space-y-2">

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Selected {config.name} ({selectedValues.length})</span>

                <Button
                  type='button'
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setIsExpandedAttributes(prev => ({ ...prev, [fieldName]: !isExpanded, }))
                  }
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
              </div>

              {isExpanded && (
                <div className="max-h-42 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                  <div className="grid grid-cols-2 gap-2">

                    {selectedValues.map(id => {
                      const option =
                        selectedAttributeOptions[fieldName]?.find(o => String(o.id) === String(id)) ||
                        attributeOptions[fieldName]?.find(o => String(o.id) === String(id));

                      return (
                        <div
                          key={id}
                          className="flex justify-between items-center bg-blue-50 p-2 rounded"
                        >
                          <span className="text-sm">{option?.display_name || id}</span>

                          {!isViewing && (
                            <X
                              size={14}
                              className="cursor-pointer text-red-500"
                              onClick={() => {
                                const updated = selectedValues.filter(v => v !== id);

                                setValue(fieldName, updated, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              }}
                            />
                          )}
                        </div>
                      );
                    })}

                  </div>
                </div>
              )}
            </div>
          )}

          {error?.message && (
            <p className="text-sm text-red-500">{error.message}</p>
          )}
        </div>
      );
    }
    else if (config.control_type === 'Textarea') {
      return (
        <div className="space-y-2 group">
          <Label
            htmlFor={fieldName}
            className={`${error ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
          >
            <Package className="h-4 w-4" /> {config.name}{' '}
            {config.is_mandatory && <span className="text-red-500">*</span>}
          </Label>
          <Textarea
            id={fieldName}
            placeholder={`Enter ${config.name}`}
            {...register(fieldName)}
            disabled={isViewing}
            className={`${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 resize-y min-h-[80px] ${watchedFields[fieldName] && !isViewing ? 'border-blue-300' : ''}`}
          />
          {error?.message && (
            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              {error.message}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const filteredAlternatives = alternativeItems.filter(
    (alt) => !selectedAlternativesWithNames.some((selected) => selected.id === alt.value)
  );

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string) => {
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      const hostname = parsedUrl.hostname.toLowerCase();
      const pathname = parsedUrl.pathname;

      // youtu.be/VIDEO_ID
      if (hostname.endsWith('youtu.be')) {
        return pathname.slice(1);
      }

      // youtube.com/watch?v=VIDEO_ID
      if (hostname.endsWith('youtube.com')) {
        // watch?v=VIDEO_ID
        const v = parsedUrl.searchParams.get('v');
        if (v) return v;

        // shorts/VIDEO_ID
        const shortsMatch = pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) return shortsMatch[1];
      }

      return null;
    } catch {
      return null;
    }
  };

  const isInitialTaxEmpty =
    !initialFormValues?.tax_percentage ||
    Object.keys(initialFormValues.tax_percentage).length === 0;

  const displayTaxes = isViewing
    ? Object.keys(watchedFields.tax_percentage ?? {}) : isInitialTaxEmpty && isEditing
      ? allTaxes.map(t => t.label)
      : [...new Set([...allTaxes.map(t => t.label), ...Object.keys(watchedFields.tax_percentage ?? {})])];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <PendingApprovalBanner />
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isViewing ? 'View Item' : isEditing ? 'Update Item' : 'Add New Item'}
              </h1>
              <p className="text-gray-600">
                {isViewing ? 'View inventory item details' : 'Customize your inventory items and stock details'}
              </p>
            </div>
          </div>
        </div>

        <form className="grid gap-y-5" onSubmit={handleSubmit(handleFormSubmit)}>
          <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                <Package className="h-5 w-5" /> Basic Information
              </CardTitle>
              <CardDescription className="text-blue-600">
                Essential item details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label
                    htmlFor="item_id"
                    className={`${errors.item_id ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Package className="h-4 w-4" /> Item ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_id"
                    placeholder="Enter unique item identifier"
                    {...register('item_id')}
                    disabled={isViewing}
                    className={`${errors.item_id
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                      } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.item_id && !isViewing ? 'border-blue-300' : ''}`}
                  />
                  {errors.item_id?.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.item_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="item_name"
                    className={`${errors.item_name ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Package className="h-4 w-4" /> Item Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_name"
                    placeholder="Enter descriptive item name"
                    {...register('item_name')}
                    disabled={isViewing}
                    className={`${errors.item_name
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                      } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.item_name && !isViewing ? 'border-blue-300' : ''}`}
                  />
                  {errors.item_name?.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.item_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="category_id"
                    className={`${errors.category_id && categoriesReady
                      ? 'text-red-500'
                      : 'text-gray-700'
                      } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Package className="h-4 w-4" /> Item Category <span className="text-red-500">*</span>
                  </Label>

                  <Select
                    value={watchedFields.category_id ? String(watchedFields.category_id) : ''}
                    onValueChange={(v) => setValue('category_id', v, { shouldValidate: true, shouldDirty: true })}
                    disabled={isViewing || categoriesLoading}
                  >
                    <SelectTrigger
                      id="category_id"
                      className={`w-full ${errors.category_id && categoriesReady
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } ${watchedFields.category_id && categoriesReady && !isViewing ? 'border-blue-300' : ''}`}
                    >
                      <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Select a category"} />
                    </SelectTrigger>

                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem key={`cat-${category.id}`} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-gray-500 text-sm">
                          {categoriesLoading ? "Loading..." : "No categories available"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Only show error if categories are ready AND there's an actual error */}
                  {categoriesReady && errors.category_id?.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.category_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="category_type"
                    className={`${errors.category_type ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Package className="h-4 w-4" /> Mark this item as <span className="text-red-500">*</span>
                  </Label>

                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="external_type"
                        value="external"
                        checked={watchedFields.category_type === 'external'}
                        onChange={() =>
                          setValue('category_type', 'external', { shouldDirty: true })
                        }
                        disabled={isViewing}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="external_type" className="text-sm">
                        External
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="internal_type"
                        value="internal"
                        checked={watchedFields.category_type === 'internal'}
                        onChange={() =>
                          setValue('category_type', 'internal', { shouldDirty: true })
                        }
                        disabled={isViewing}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="internal_type" className="text-sm">
                        Internal
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="description"
                    className={`${errors.description ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Package className="h-4 w-4" /> Description <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    id="description"
                    placeholder="Detailed description of the item..."
                    {...register('description')}
                    disabled={isViewing}
                    rows={4}
                    className={`
                      pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 resize-vertical min-h-[100px] w-full text-sm
                      ${errors.description
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'}
                      ${watchedFields.description && !isViewing ? 'border-blue-300' : ''}
                      ${isViewing ? 'text-gray-400' : 'text-black'}
                    `}
                  />
                  {errors.description?.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                <Target className="h-5 w-5" /> Stock, Pricing & Media
              </CardTitle>
              <CardDescription className="text-blue-600">
                Inventory levels, pricing configuration, and media uploads
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="reorder_level"
                        className={`${errors.reorder_level ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Target className="h-4 w-4" /> Reorder Level
                      </Label>
                      <Input
                        id="reorder_level"
                        type="number"
                        placeholder="10"
                        {...register('reorder_level', { valueAsNumber: true })}
                        disabled={isViewing}
                        className={`${errors.reorder_level
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.reorder_level && !isViewing ? 'border-blue-300' : ''}`}
                      />
                      {errors.reorder_level?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.reorder_level.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 group">
                      <Label
                        htmlFor="max_level"
                        className={`${errors.max_level ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Target className="h-4 w-4" /> Maximum Level
                      </Label>
                      <Input
                        id="max_level"
                        type="number"
                        placeholder="100"
                        {...register('max_level', { valueAsNumber: true })}
                        disabled={isViewing}
                        className={`${errors.max_level
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.max_level && !isViewing ? 'border-blue-300' : ''}`}
                      />
                      {errors.max_level?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.max_level.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="selling_price"
                        className={`${errors.selling_price ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <DollarSign className="h-4 w-4" /> Selling Price
                      </Label>
                      <Input
                        id="selling_price"
                        type="number"
                        step="0.01"
                        placeholder="299.99"
                        {...register('selling_price', { valueAsNumber: true })}
                        disabled={isViewing}
                        className={`${errors.selling_price
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.selling_price && !isViewing ? 'border-blue-300' : ''}`}
                      />
                      {errors.selling_price?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.selling_price.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="image_1"
                        className={`${errors.image_1 ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Package className="h-4 w-4" /> Image 1 (JPG/PNG, max 5MB)
                      </Label>
                      {!isViewing && (
                        <Input
                          id="image_1"
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => handleMediaChange(e, 'image_1', setImage1Preview)}
                          disabled={isViewing}
                          className={`${errors.image_1
                            ? 'text-red-500 border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                        />
                      )}
                      {image1Preview && (
                        <div className="mt-2">
                          {isViewing ? (
                            <div className="relative">
                              <div
                                className="relative w-32 h-32 border border-gray-200 rounded-md overflow-hidden cursor-pointer"
                                onMouseEnter={() => handleMouseEnter(image1Preview)}
                                onMouseLeave={handleMouseLeave}
                              >
                                <img
                                  src={image1Preview}
                                  alt="Image 1"
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Full Image Zoom Modal */}
                              {showZoom && activeZoomImage === image1Preview && (
                                <div className="absolute left-36 top-0 w-80 h-80 border-2 border-blue-500 rounded-lg overflow-hidden bg-white shadow-2xl z-50">
                                  <img
                                    src={image1Preview}
                                    alt="Image 1 Full View"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <img
                              src={image1Preview}
                              alt="Image 1 Preview"
                              className="h-32 w-32 object-cover rounded-md border border-gray-200"
                            />
                          )}
                        </div>
                      )}
                      {errors.image_1?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.image_1.message as string}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 group">
                      <Label
                        htmlFor="image_2"
                        className={`${errors.image_2 ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Package className="h-4 w-4" /> Image 2 (JPG/PNG, max 5MB)
                      </Label>
                      {!isViewing && (
                        <Input
                          id="image_2"
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => handleMediaChange(e, 'image_2', setImage2Preview)}
                          disabled={isViewing}
                          className={`${errors.image_2
                            ? 'text-red-500 border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                        />
                      )}
                      {image2Preview && (
                        <div className="mt-2">
                          {isViewing ? (
                            <div className="relative">
                              <div
                                className="relative w-32 h-32 border border-gray-200 rounded-md overflow-hidden cursor-pointer"
                                onMouseEnter={() => handleMouseEnter(image2Preview)}
                                onMouseLeave={handleMouseLeave}
                              >
                                <img
                                  src={image2Preview}
                                  alt="Image 2"
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Full Image Zoom Modal */}
                              {showZoom && activeZoomImage === image2Preview && (
                                <div className="absolute left-36 top-0 w-80 h-80 border-2 border-blue-500 rounded-lg overflow-hidden bg-white shadow-2xl z-50">
                                  <img
                                    src={image2Preview}
                                    alt="Image 2 Full View"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <img
                              src={image2Preview}
                              alt="Image 2 Preview"
                              className="h-32 w-32 object-cover rounded-md border border-gray-200"
                            />
                          )}
                        </div>
                      )}
                      {errors.image_2?.message && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.image_2.message as string}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="space-y-2 group">
                        <Label className='group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium'>
                          <Package className="h-4 w-4" /> Video Type
                        </Label>
                        <div className="flex items-center gap-5">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="uploadvideo"
                              value="upload"
                              checked={videoType === 'upload'}
                              onChange={() => setVideoType('upload')}
                              disabled={isViewing}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="uploadvideo" className="text-sm">Upload a Video</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="youtubevideo"
                              value="youtube"
                              checked={videoType === 'youtube'}
                              onChange={() => setVideoType('youtube')}
                              disabled={isViewing}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="youtubevideo" className="text-sm">YouTube Video Link</Label>
                          </div>
                        </div>
                      </div>

                      {videoType === 'upload' && (
                        <div className="space-y-2 group mt-4">
                          <Label
                            htmlFor="video"
                            className={`${errors.video ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Video className="h-4 w-4" /> Upload a Video (MP4, max 50MB)
                          </Label>
                          <Input
                            id="video"
                            type="file"
                            accept="video/mp4"
                            onChange={(e) => handleMediaChange(e, 'video', setVideoPreview)}
                            disabled={isViewing}
                            className={`${errors.video
                              ? 'text-red-500 border-red-300 focus:border-red-500 focus:ring-red-200'
                              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
                          />
                          {videoPreview ? (
                            <video
                              src={videoPreview}
                              controls={true}
                              className="mt-2 h-32 w-full max-w-md object-contain rounded-md border border-gray-200"
                            />
                          ) : (
                            <div className="mt-2 h-40 w-full max-w-md flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
                              <p className="text-gray-500 text-sm">No Video Available</p>
                            </div>
                          )}
                          {errors.video?.message && (
                            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.video.message as string}
                            </p>
                          )}
                        </div>
                      )}

                      {videoType === 'youtube' && (
                        <div className="space-y-2 group mt-4">
                          <Label
                            htmlFor="youtube"
                            className={`${errors.youtube_link ? 'text-red-500' : 'text-gray-700'} text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Youtube className="h-4 w-4" /> YouTube Video Link
                          </Label>
                          <Input
                            id="youtube"
                            type="text"
                            value={youtubeUrl}
                            onChange={(e) => handleYoutubeChange(e.target.value)}
                            placeholder="Enter YouTube video link"
                            disabled={isViewing}
                            className="border-gray-200 focus:border-blue-500 focus:ring-blue-200 pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200"
                          />
                          {youtubeVideoId ? (
                            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                              <iframe
                                title="YouTube Video"
                                width="100%"
                                height="100%"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                            </div>
                          ) : (
                            youtubeUrl && (
                              <div className="mt-2 h-32 w-full max-w-md flex items-center justify-center bg-gray-100 rounded-md border border-gray-200">
                                <p className="text-red-500 text-sm">Invalid YouTube link</p>
                              </div>
                            )
                          )}
                          {errors.youtube_link?.message && (
                            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.youtube_link.message as string}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {!isViewing && (
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1 group relative">
                          <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium">
                            <Search className="h-4 w-4" /> Search Alternative Items
                          </Label>
                          <div className="relative">
                            <Input
                              id="alternative_search"
                              placeholder="Search for alternative items by name or description..."
                              value={alternativeSearch}
                              onChange={(e) => setAlternativeSearch(e.target.value)}
                              onFocus={() => debouncedSearch.trim().length >= 3 && setShowAlternativesDropdown(true)}
                              disabled={isViewing}
                              className="pl-10 pr-4 py-2 rounded-lg shadow-sm border-blue-200 focus:border-blue-500 focus:ring-blue-200 focus:ring-4 transition-colors duration-200"
                            />
                            {isFetchingAlternatives ? (
                              <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 animate-spin" />
                            ) : (
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
                            )}
                          </div>
                          {showAlternativesDropdown && filteredAlternatives.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-blue-200 rounded-lg shadow-2xl flex flex-col max-h-80 z-20">
                              <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">
                                    Available Alternatives ({filteredAlternatives.length})
                                  </span>
                                </div>
                              </div>
                              <div className="flex-1 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                                {filteredAlternatives.map((alternative, index) => (
                                  <div
                                    key={alternative.value}
                                    className={`p-3 hover:bg-blue-50 transition-colors duration-200 ${index !== filteredAlternatives.length - 1 ? 'border-b border-blue-100' : ''}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            checked={
                                              tempSelectedAlternatives.includes(alternative.value) ||
                                              selectedAlternativesWithNames.some((s) => s.id === alternative.value)
                                            }
                                            onCheckedChange={() => {
                                              const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                              handleAlternativeToggle(alternative, syntheticEvent);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            disabled={isViewing}
                                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                          />
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <Package className="h-3 w-3 text-blue-400" />
                                              <p className="font-medium text-blue-900 text-sm">{alternative.label}</p>
                                            </div>
                                            <p className="text-xs text-blue-500 ml-5">{alternative.description}</p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-semibold text-blue-600 text-sm">{formatCurrency(alternative.price ?? 0)}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end gap-2 p-3 border-t border-blue-200 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setTempSelectedAlternatives([]);
                                    setAlternativeSearch('');
                                    setShowAlternativesDropdown(false);
                                  }}
                                  disabled={isViewing}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleConfirmAlternatives}
                                  disabled={isViewing || tempSelectedAlternatives.length === 0}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  Confirm
                                </Button>
                              </div>
                            </div>
                          )}
                          {showAlternativesDropdown && filteredAlternatives.length === 0 && !isFetchingAlternatives && (
                            <div className="absolute top-full left-0 mt-1 z-20 w-full bg-white border border-blue-200 rounded-lg shadow-xl p-4">
                              <p className="text-gray-500 text-sm">No alternative items found</p>
                            </div>
                          )}
                        </div>

                        {/* Selected alternatives list (overlay) */}
                        {selectedAlternativesWithNames.length > 0 && (
                          <div className="space-y-2 relative z-10">
                            <div className="flex items-center justify-between">
                              <Label className="text-gray-700 flex items-center gap-1 font-medium">
                                <Package className="h-4 w-4" /> Selected Alternatives
                              </Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsSelectedAlternativesExpanded(!isSelectedAlternativesExpanded);
                                }}
                                disabled={isViewing}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {isSelectedAlternativesExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </div>

                            {isSelectedAlternativesExpanded && (
                              <div className="relative w-full mt-1 border border-blue-200 rounded-lg shadow-xl bg-blue-50">
                                <div className="p-3 max-h-43 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
                                  {selectedAlternativesWithNames.map((alternative) => (
                                    <div
                                      key={alternative.id}
                                      className="flex items-center justify-between p-2 bg-white rounded-md mb-2 last:mb-0 shadow-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Package className="h-3 w-3 text-blue-400" />
                                        <p className="text-sm text-blue-900">{alternative.item_name}</p>
                                      </div>
                                      {!isViewing && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleAlternativeRemove(alternative.id)}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {configurators.length > 0 && (
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                  <Package className="h-5 w-5" /> Additional Attributes
                </CardTitle>
                <CardDescription className="text-blue-600">
                  Custom fields defined for this item
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {configurators.map((config) => (
                    <div key={config.id}>{renderDynamicField(config)}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {displayTaxes.length > 0 && (
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                  <Target className="h-5 w-5" /> Tax Configuration
                </CardTitle>
                <CardDescription className="text-blue-600">
                  Manage the tax configuration for this item
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {displayTaxes.map(label => {
                        const tax = allTaxes.find(t => t.label === label);
                        const displayLabel = tax ? tax.label : label;
                        return (
                          <div key={label} className="space-y-2 group">
                            <Label className="text-gray-700 group-hover:text-blue-700 flex items-center gap-1 font-medium">
                              <CirclePercent className="h-4 w-4" /> {displayLabel} (%)
                            </Label>

                            <Input
                              type="number"
                              id={`tax_${label}`}
                              step="0.01"
                              disabled={isViewing}
                              placeholder={`Enter ${displayLabel} value`}
                              {...register(`tax_percentage.${label}`, { valueAsNumber: true })}
                              className="border-gray-200 focus:border-blue-500 focus:ring-blue-200 pl-3 pr-3 py-2 rounded-md shadow-sm"
                            />

                            {/* Show validation errors */}
                            {getTaxError(label ?? "") && (
                              <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {getTaxError(label ?? "")?.message}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isViewing && (
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting || isLoading}
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {isSubmitting || isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEditing ? 'Update Item' : 'Create Item'}
              </Button>
            </div>
          )}
        </form>

        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                You have unsaved changes. Are you sure you want to cancel and discard them?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={stayOnForm} className="border-blue-200 text-blue-600 hover:bg-blue-50">
                Stay
              </Button>
              <Button variant="destructive" onClick={confirmCancel}>
                Discard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default InventoryForm;

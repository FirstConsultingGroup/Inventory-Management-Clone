import { useForm, Controller } from "react-hook-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle, Loader2, Store, AlertCircle, Phone, Mail, MapPin, CreditCard, User, Check, X, Plus, RefreshCw, ChevronDown, Database, ChevronRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { IUser, IStore } from "@/Utils/constants";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { v4 as uuidv4 } from "uuid";
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from "@/Utils/commonFun";

interface ExtendedUser extends IUser {
  role: {
    id: string | null;
    role_name: string;
  };
}

// ---------------------------------------------------------------------------
// Location type — mirrors location_master row shape
// ---------------------------------------------------------------------------
interface ILocation {
  id: string;
  location_id: string | null;
  location_name: string | null;
}

type LocationType = "SHELF" | "CABINET";

interface LocationRow {
  tempId: string;
  id?: string;
  loc_type: LocationType;
  short_name: string;
  description: string;
}

interface LinkRow {
  tempId: string;
  id?: string;
  shelfRef: string;
  cabinetRef: string;
}

interface AvailableStorage {
  id?: string;
  shelfName: string;
  cabinetName: string;
}

const createTempId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const createStoreSchema = (centralStoreExists: boolean, isEditing: boolean) =>
  z
    .object({
      code: z
        .string()
        .min(1, "Store id is required")
        .length(6, "Store id must be exactly 6 characters")
        .trim(),
      name: z
        .string()
        .min(1, "Store Name is required")
        .max(100, "Store Name cannot exceed 100 characters")
        .trim(),
      address: z
        .string()
        .min(1, "Street Address is required")
        .max(200, "Street Address cannot exceed 200 characters")
        .trim(),
      city: z
        .string()
        .min(1, "City is required")
        .max(100, "City cannot exceed 100 characters")
        .trim(),
      state: z
        .string()
        .min(1, "State/Province is required")
        .max(100, "State/Province cannot exceed 100 characters")
        .trim(),
      postalCode: z
        .string()
        .min(1, "Postal Code is required")
        .max(20, "Postal Code cannot exceed 20 characters")
        .trim(),
      country: z
        .string()
        .min(1, "Country is required")
        .max(100, "Country cannot exceed 100 characters")
        .trim(),
      phone: z
        .string()
        .min(1, "Phone number is required")
        .max(20, "Phone number cannot exceed 20 characters")
        .trim(),
      email: z
        .string()
        .min(1, "Email is required")
        .email("Please enter a valid email address")
        .refine((val) => val === val.toLowerCase(), {
          message: "Email must not contain uppercase letters"
        }),
      type: z
        .enum(["Central Store", "Branch Store"], {
          required_error: "Store type is required",
        })
        .refine(
          (value) => {
            if (!isEditing && value === "Central Store" && centralStoreExists) {
              return false;
            }
            return true;
          },
          {
            message: "Only one Central Store is allowed. A Central Store already exists.",
          }
        ),
      parent_id: z.string().optional(),
      location_id: z.string().min(1, "Location is required"),
      bank_name: z.string().max(100, "Bank name cannot exceed 100 characters").optional().or(z.literal("")),
      bank_account_number: z.string().max(50, "Bank account number cannot exceed 50 characters").optional().or(z.literal("")),
      bank_ifsc_code: z.string().max(20, "IFSC code cannot exceed 20 characters").optional().or(z.literal("")),
      bank_iban_code: z.string().max(34, "IBAN code cannot exceed 34 characters").optional().or(z.literal("")),
      tax_code: z
        .string()
        .min(1, "Tax code is required")
        .max(50, "Tax code cannot exceed 50 characters")
        .trim(),
      store_manager_id: z.string().min(1, "Store manager is required"),
      direct_purchase_allowed: z.boolean(),
      internal: z.boolean(),
      external: z.boolean(),
    })
    .refine(
      (data) => {
        if (data.type === "Central Store") {
          return !data.parent_id || data.parent_id.trim() === "";
        }
        if (data.type === "Branch Store") {
          return data.parent_id && data.parent_id.trim() !== "";
        }
        return true;
      },
      {
        message: "Parent store is required for Branch Store",
        path: ["parent_id"],
      }
    )
    .superRefine((data, ctx) => {
      if (data.bank_account_number && !data.bank_ifsc_code && !data.bank_iban_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one of IFSC Code or IBAN Code is required when Bank Account Number is provided",
          path: ["bank_ifsc_code"],
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one of IFSC Code or IBAN Code is required when Bank Account Number is provided",
          path: ["bank_iban_code"],
        });
      }
    });

type StoreFormData = z.infer<ReturnType<typeof createStoreSchema>>;

// Helper to safely extract ID from value
const extractId = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return (value as { id: string }).id;
  return "";
};

// Interface for user data stored in local storage
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
  full_name: string;
}

export default function AddStoreForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supabaseClient = supabase as any;
  const [managers, setManagers] = useState<ExtendedUser[]>([]);
  const [store, setStore] = useState<IStore | null>(null);
  const [parentStores, setParentStores] = useState<IStore[]>([]);
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [centralStoreExists, setCentralStoreExists] = useState(false);
  const [isCheckingCentralStore, setIsCheckingCentralStore] = useState(!id);
   const user = localStorage.getItem('userData');
  const userData = user ? JSON.parse(user) : null;
  const [roleId, setRoleId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Store ID validation state
  const [storeIdValidationStatus, setStoreIdValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [storeIdValidationMessage, setStoreIdValidationMessage] = useState<string>('');
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isEditing = Boolean(id);
  const currentStoreId = store?.id ?? id ?? null;
  const hasStoreContext = Boolean(currentStoreId && companyId);

  // -------------------------------------------------------------------
  // NEW: location state — mirrors the category pattern from item form
  // -------------------------------------------------------------------
  const [locations, setLocations] = useState<ILocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsReady, setLocationsReady] = useState(false);

  // Shelves & cabinets state
  const [masterRows, setMasterRows] = useState<LocationRow[]>([]);
  const [linkRows, setLinkRows] = useState<LinkRow[]>([]);
  const [deletedMasterIds, setDeletedMasterIds] = useState<string[]>([]);
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([]);
  const [masterErrors, setMasterErrors] = useState<Record<string, string>>({});
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [validatedMasterRows, setValidatedMasterRows] = useState<LocationRow[]>([]);
  const [showLocations, setShowLocations] = useState(false); // Start collapsed
  const [availableStorages, setAvailableStorages] = useState<AvailableStorage[]>([]);
  const [usedLinkIds, setUsedLinkIds] = useState<Set<string>>(new Set());
  const [linkedMasterTempIds, setLinkedMasterTempIds] = useState<Set<string>>(new Set());
  const [isSavingMasters, setIsSavingMasters] = useState(false);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);


  const shelfOptions = useMemo(
    () => validatedMasterRows.filter(row => row.loc_type === "SHELF"),
    [validatedMasterRows]
  );

  const cabinetOptions = useMemo(
    () => validatedMasterRows.filter(row => row.loc_type === "CABINET"),
    [validatedMasterRows]
  );

  const loadLocationData = useCallback(async () => {
    if (!companyId || !currentStoreId) return;
    setIsLoadingLocations(true);
    try {
      const [{ data: masterData, error: masterError }, { data: linkData, error: linkError }] =
        await Promise.all([
          supabaseClient
            .from("inventory_loc_master")
            .select("id, loc_type, short_name, description")
            .eq("company_id", companyId)
            .eq("store_id", currentStoreId)
            .order("loc_type", { ascending: true }),
          supabaseClient
            .from("inventory_loc_mgmt")
            .select(`
              id,
              shelf_id,
              cabinet_id,
              shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey(id, short_name),
              cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey(id, short_name)
            `)
            .eq("company_id", companyId)
            .eq("store_Id", currentStoreId),
        ]);

      if (masterError) throw masterError;
      if (linkError) throw linkError;

      const mappedMasters: LocationRow[] =
        (masterData || []).map((item: any) => ({
          tempId: createTempId(),
          id: item.id,
          loc_type: (item.loc_type as LocationType) ?? "SHELF",
          short_name: item.short_name ?? "",
          description: item.description ?? "",
        })) ?? [];

      const idToTemp = new Map<string, string>(
        mappedMasters.filter((row) => row.id).map((row) => [row.id!, row.tempId])
      );

      const mappedLinks: LinkRow[] =
        (linkData || []).map((item: any) => ({
          tempId: createTempId(),
          id: item.id,
          shelfRef: item.shelf_id ? idToTemp.get(item.shelf_id) ?? "" : "",
          cabinetRef: item.cabinet_id ? idToTemp.get(item.cabinet_id) ?? "" : "",
        })) ?? [];

      let usedIds = new Set<string>();
      if (linkData && linkData.length > 0) {
        const linkIds = linkData.map((l: any) => l.id);
        const { data: inventoryLinks } = await supabaseClient
          .from("inventory_mgmt")
          .select("link_loc")
          .in("link_loc", linkIds)
          .not("link_loc", "is", null);

        if (inventoryLinks) {
          usedIds = new Set(inventoryLinks.map((row: any) => row.link_loc));
        }
      }
      setUsedLinkIds(usedIds);

      const linkedTempIds = new Set<string>();
      (linkData || []).forEach((link: any) => {
        if (link.shelf_id && idToTemp.has(link.shelf_id)) {
          linkedTempIds.add(idToTemp.get(link.shelf_id)!);
        }
        if (link.cabinet_id && idToTemp.has(link.cabinet_id)) {
          linkedTempIds.add(idToTemp.get(link.cabinet_id)!);
        }
      });
      setLinkedMasterTempIds(linkedTempIds);

      const availableLinks: AvailableStorage[] =
        (linkData || []).map((item: any) => ({
          id: item.id,
          shelfName: item.shelf?.short_name ?? "",
          cabinetName: item.cabinet?.short_name ?? "",
        }));

      setMasterRows(mappedMasters);
      setLinkRows(mappedLinks);
      setAvailableStorages(availableLinks);
      setValidatedMasterRows(mappedMasters.filter(row => row.short_name.trim() !== ""));
      setDeletedMasterIds([]);
      setDeletedLinkIds([]);
    } catch (error: any) {
      console.error("Failed to load shelf/cabinet data:", error);
      toast.error(error?.message ?? "Failed to load shelves & cabinets");
    } finally {
      setIsLoadingLocations(false);
    }
  }, [supabaseClient, companyId, currentStoreId]);

  useEffect(() => {
    if (hasStoreContext) {
      loadLocationData();
    }
  }, [hasStoreContext, loadLocationData]);

  const addMasterRow = () => {
    setMasterRows((prev) => [
      ...prev,
      {
        tempId: createTempId(),
        loc_type: "SHELF",
        short_name: "",
        description: "",
      },
    ]);
  };

  const removeMasterRow = (row: LocationRow) => {
    setMasterRows((prev) => prev.filter((item) => item.tempId !== row.tempId));
    setLinkRows((prev) =>
      prev.filter(
        (link) => link.shelfRef !== row.tempId && link.cabinetRef !== row.tempId
      )
    );
    if (row.id) {
      setDeletedMasterIds((prev) => [...prev, row.id!]);
    }
  };

  const addLinkRow = useCallback(() => {
    setLinkRows((prev) => [
      ...prev,
      {
        tempId: createTempId(),
        id: undefined,
        shelfRef: "",
        cabinetRef: "",
      },
    ]);
  }, []);

  const removeLinkRow = (row: LinkRow) => {
    setLinkRows((prev) => prev.filter((item) => item.tempId !== row.tempId));
    if (row.id) {
      setDeletedLinkIds((prev) => [...prev, row.id!]);
    }
  };

  const validateMasterRows = () => {
    const errors: Record<string, string> = {};
    const seenShortNames = new Set<string>();
    const validTempIds = new Set<string>();

    masterRows.forEach((row) => {
      const trimmed = row.short_name.trim().toUpperCase();

      if (!trimmed) {
        errors[row.tempId] = "Short name is required.";
        return;
      }

      if (seenShortNames.has(trimmed)) {
        errors[row.tempId] = "Short name must be unique.";
        return;
      }

      seenShortNames.add(trimmed);
      validTempIds.add(row.tempId);
    });

    setMasterErrors(errors);

    // Update validated masters
    const isFullyValid = Object.keys(errors).length === 0;
    setValidatedMasterRows(isFullyValid ? masterRows : masterRows.filter(r => validTempIds.has(r.tempId)));

    return isFullyValid;
  };

  // Remove broken links
  useEffect(() => {
    const validTempIds = new Set(
      masterRows
        .filter(row => row.short_name.trim())
        .map(row => row.tempId)
    );

    setLinkRows(prev => {
      const validLinks = prev.filter(link =>
        link.shelfRef && validTempIds.has(link.shelfRef) &&
        link.cabinetRef && validTempIds.has(link.cabinetRef)
      );

      if (validLinks.length < prev.length) {
        const removed = prev.length - validLinks.length;
        toast.error(
          `${removed} link${removed > 1 ? 's were' : ' was'} removed because a shelf or cabinet name was cleared or duplicated.`,
          { icon: <AlertCircle className="h-4 w-4" /> }
        );
      }

      return validLinks;
    });
  }, [masterRows]);

  const validateLinkRows = () => {
    const errors: Record<string, string> = {};
    const comboSet = new Set<string>();
    const validShelves = new Set(shelfOptions.map((row) => row.tempId));
    const validCabinets = new Set(cabinetOptions.map((row) => row.tempId));

    linkRows.forEach((row) => {
      if (!row.shelfRef) {
        errors[row.tempId] = "Shelf is required.";
        return;
      }
      if (!row.cabinetRef) {
        errors[row.tempId] = "Cabinet is required.";
        return;
      }
      if (!validShelves.has(row.shelfRef)) {
        errors[row.tempId] = "Selected shelf no longer exists.";
        return;
      }
      if (!validCabinets.has(row.cabinetRef)) {
        errors[row.tempId] = "Selected cabinet no longer exists.";
        return;
      }
      const comboKey = `${row.shelfRef}-${row.cabinetRef}`;
      if (comboSet.has(comboKey)) {
        errors[row.tempId] = "Duplicate link detected.";
        return;
      }
      comboSet.add(comboKey);
    });

    setLinkErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check linked locations
  const getLinkedTempIds = useCallback(() => {
    const current = new Set<string>();
    linkRows.forEach((link) => {
      if (link.shelfRef) current.add(link.shelfRef);
      if (link.cabinetRef) current.add(link.cabinetRef);
    });
    return new Set([...current, ...linkedMasterTempIds]);
  }, [linkRows, linkedMasterTempIds]);

  // Save only Shelves & Cabinets (Master rows)
  const saveShelvesAndCabinets = async () => {
    if (!currentStoreId || !companyId) {
      toast.error("Store must be saved first before managing locations.");
      return false;
    }

    const isValid = validateMasterRows();
    if (!isValid) {
      toast.error("Please fix errors in shelves/cabinets before saving.");
      return false;
    }

    setIsSavingMasters(true);
    try {
      // Delete removed masters
      if (deletedMasterIds.length > 0) {
        await supabaseClient
          .from("inventory_loc_master")
          .delete()
          .in("id", deletedMasterIds);

        // Also delete any links that referenced deleted masters
        await supabaseClient
          .from("inventory_loc_mgmt")
          .delete()
          .eq("store_Id", currentStoreId)
          .or(
            `shelf_id.in.(${deletedMasterIds.join(",")}),cabinet_id.in.(${deletedMasterIds.join(",")})`
          );
      }

      const newRows = masterRows.filter((r) => !r.id);
      const existingRows = masterRows.filter((r) => r.id);

      // Update existing
      if (existingRows.length > 0) {
        await supabaseClient
          .from("inventory_loc_master")
          .upsert(
            existingRows.map((r) => ({
              id: r.id!,
              store_id: currentStoreId,
              company_id: companyId,
              loc_type: r.loc_type,
              short_name: r.short_name.trim(),
              description: r.description?.trim() || null,
            })),
            { onConflict: "id" }
          );
      }

      // Insert new
      if (newRows.length > 0) {
        const { data } = await supabaseClient
          .from("inventory_loc_master")
          .insert(
            newRows.map((r) => ({
              store_id: currentStoreId,
              company_id: companyId,
              loc_type: r.loc_type,
              short_name: r.short_name.trim(),
              description: r.description?.trim() || null,
            }))
          )
          .select("id");

        // Update temp rows with real IDs
        data?.forEach((row: any, idx: number) => {
          const tempId = newRows[idx].tempId;
          const found = masterRows.find((r) => r.tempId === tempId);
          if (found) found.id = row.id;
        });
      }

      // Clear deletions & update validated list
      setDeletedMasterIds([]);
      setValidatedMasterRows(masterRows.filter((r) => r.short_name.trim()));

      toast.success("Shelves & cabinets saved successfully!");
      await loadLocationData();
      return true;
    } catch (err: any) {
      console.error("Save shelves failed:", err);
      toast.error("Failed to save shelves & cabinets: " + (err.message || ""));
      return false;
    } finally {
      setIsSavingMasters(false);
    }
  };

  // Save only Links (inventory_loc_mgmt)
  const saveShelfCabinetLinks = async () => {
    if (!currentStoreId || !companyId) {
      toast.error("Store must be saved first before managing locations.");
      return false;
    }

    const isValid = validateLinkRows();
    if (!isValid) {
      toast.error("Please fix duplicate or missing links before saving.");
      return false;
    }

    if (linkRows.length === 0) {
      return true;
    }

    setIsSavingLinks(true);
    try {
      // Build map of tempId → real DB ID from validated masters
      const dbIdByTempId = new Map<string, string>();
      validatedMasterRows.forEach((row) => {
        if (row.id) dbIdByTempId.set(row.tempId, row.id);
      });

      const payload = linkRows
        .map((row) => {
          const shelfId = dbIdByTempId.get(row.shelfRef);
          const cabinetId = dbIdByTempId.get(row.cabinetRef);
          if (!shelfId || !cabinetId) return null;

          const base = {
            store_Id: currentStoreId,
            shelf_id: shelfId,
            cabinet_id: cabinetId,
            company_id: companyId,
          };

          return row.id
            ? { ...base, id: row.id }
            : { ...base, id: uuidv4() };
        })
        .filter(Boolean) as any[];


      if (payload.length === 0) {
        toast.error("No valid links to save.");
        return false;
      }

      // Upsert all (update existing, insert new)
      const { error } = await supabaseClient
        .from("inventory_loc_mgmt")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      // Delete any manually removed links
      if (deletedLinkIds.length > 0) {
        await supabaseClient
          .from("inventory_loc_mgmt")
          .delete()
          .in("id", deletedLinkIds);
      }

      setDeletedLinkIds([]);
      toast.success("Shelf - Cabinet links saved successfully!");
      await loadLocationData();
      return true;
    } catch (err: any) {
      console.error("Save links failed:", err);
      toast.error("Failed to save links: " + (err.message || ""));
      return false;
    } finally {
      setIsSavingLinks(false);
    }
  };

  // Get default values based on central store existence
  const getDefaultValues = useCallback((): StoreFormData => ({
    code: "",
    name: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    type: (!isEditing && centralStoreExists) ? "Branch Store" : "Central Store",
    parent_id: "",
    location_id: "",                // NEW
    bank_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_iban_code: "",
    tax_code: "",
    store_manager_id: "",
    direct_purchase_allowed: false,
    internal: false,
    external: false,
  }), [centralStoreExists, isEditing]);

  // Create schema with current state
  const storeSchema = createStoreSchema(centralStoreExists, isEditing);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: getDefaultValues(),
  });

  const watchedStoreType = watch("type");
  const watchedBankAccountNumber = watch("bank_account_number");
  const watchedBankIfscCode = watch("bank_ifsc_code");
  const watchedBankIbanCode = watch("bank_iban_code");
  const watchedStoreCode = watch("code");

  // Clear errors for IFSC and IBAN when either is provided and bank account number is present,
  // or when bank account number is cleared
  useEffect(() => {
    if (!watchedBankAccountNumber || watchedBankIfscCode || watchedBankIbanCode) {
      clearErrors(["bank_ifsc_code", "bank_iban_code"]);
    }
  }, [watchedBankAccountNumber, watchedBankIfscCode, watchedBankIbanCode, clearErrors]);

  // Fetch company_id from local storage on component mount
  useEffect(() => {
    try {
      const userDataString = localStorage.getItem("userData");
      if (userDataString) {
        const userData: UserData = userDataString? JSON.parse(userDataString) : null;
        if (userData.company_id) {
          setCompanyId(userData.company_id);
          setUserId(userData?.id);
          setRoleId(userData.role_id);
        } else {
          throw new Error("Company ID not found in user data");
        }
      } else {
        throw new Error("User data not found in local storage");
      }
    } catch (error) {
      console.error("Error fetching company_id from local storage:", error);
      toast.error("Failed to load user data. Please log in again.", {
        position: "top-right",
      });
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if(!userId){
      return;
    }
    const fetchPermissions = async () => {
      
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Store Management', userData?.user_id);
        console.log("permissions",res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.user_id, roleId]);

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

  // Check if a Central Store already exists
  const checkCentralStoreExists = useCallback(async () => {
    if (isEditing || !companyId) return;

    setIsCheckingCentralStore(true);
    try {
      const { data, error } = await supabase
        .from("store_mgmt")
        .select("id")
        .eq('company_id', companyId)
        .eq("type", "Central Store")
        .eq("is_active", true)
        .limit(1);

      if (error) {
        console.error("Error checking central stores:", error);
        throw error;
      }

      const exists = data && data.length > 0;
      setCentralStoreExists(exists);
      setInitialCheckComplete(true);

      // Reset form with correct default type
      const defaultType = exists ? "Branch Store" : "Central Store";
      reset({
        ...getDefaultValues(),
        type: defaultType
      });

      clearErrors("type");
    } catch (error) {
      console.error("Error checking central stores:", error);
      setCentralStoreExists(true);
      setInitialCheckComplete(true);
      reset({
        ...getDefaultValues(),
        type: "Branch Store"
      });
      clearErrors("type");
      toast.error("Failed to check store configuration. Please try again.", {
        position: "top-right",
      });
    } finally {
      setIsCheckingCentralStore(false);
    }
  }, [isEditing, companyId, reset, getDefaultValues, clearErrors]);

  // Effect to handle store type validation after initial check
  useEffect(() => {
    if (isEditing || !initialCheckComplete) return;

    // If central store exists and user tries to select it, show error
    if (centralStoreExists && watchedStoreType === "Central Store") {
      setError("type", {
        type: "manual",
        message: "Only one Central Store is allowed in the system. A Central Store already exists.",
      });
      // Force change to Branch Store
      setValue("type", "Branch Store");
    } else {
      clearErrors("type");
    }

    // Clear parent_id for Central Store
    if (watchedStoreType === "Central Store") {
      setValue("parent_id", "");
      clearErrors("parent_id");
    }
  }, [watchedStoreType, centralStoreExists, isEditing, initialCheckComplete, setValue, setError, clearErrors]);

  // Store ID validation function
  const validateStoreIdUniqueness = useCallback(async (storeCode: string) => {
    if (!storeCode || storeCode.length !== 6 || !companyId) {
      return;
    }

    // Skip validation for editing mode with the same store code
    if (isEditing && store && store.code === storeCode) {
      setStoreIdValidationStatus('valid');
      setStoreIdValidationMessage('Current store ID');
      clearErrors('code');
      return;
    }

    setStoreIdValidationStatus('validating');
    setStoreIdValidationMessage('Checking availability...');

    try {
      const { data, error } = await supabase
        .from("store_mgmt")
        .select("id, code")
        .eq('company_id', companyId)
        .eq("code", storeCode)
        .eq("is_active", true)
        .limit(1);

      if (error) {
        console.error("Error validating store ID:", error);
        setStoreIdValidationStatus('idle');
        setStoreIdValidationMessage('');
        return;
      }

      const exists = data && data.length > 0;

      if (exists) {
        setStoreIdValidationStatus('invalid');
        setStoreIdValidationMessage('Store ID already exists');
        setError("code", {
          type: "manual",
          message: "This store ID is already in use",
        });
      } else {
        setStoreIdValidationStatus('valid');
        setStoreIdValidationMessage('Store ID is available');
        clearErrors('code');
      }
    } catch (error) {
      console.error("Error during store ID validation:", error);
      setStoreIdValidationStatus('idle');
      setStoreIdValidationMessage('');
    } finally {
      // Validation complete - status is already set above
    }
  }, [companyId, isEditing, store, setError, clearErrors]);

  // Debounced store ID validation
  useEffect(() => {
    // Clear existing timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Reset validation state when store code changes
    if (watchedStoreCode && watchedStoreCode.length > 0) {
      setStoreIdValidationStatus('idle');
      setStoreIdValidationMessage('');
    }

    // Only validate if we have a complete store code (6 characters)
    if (watchedStoreCode && watchedStoreCode.length === 6 && !isEditing) {
      validationTimeoutRef.current = setTimeout(() => {
        validateStoreIdUniqueness(watchedStoreCode);
      }, 500); // 500ms debounce
    }

    // Cleanup timeout on unmount
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [watchedStoreCode, validateStoreIdUniqueness, isEditing]);

  useEffect(() => {
    if (!companyId || isEditing) return;   // edit path is handled inside loadStore

    const fetchLocations = async () => {
      setLocationsLoading(true);
      try {
        const { data, error } = await supabase
          .from("location_master")
          .select("id, location_id, location_name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .eq("status", true);

        if (error) throw error;
        setLocations((data || []) as ILocation[]);
      } catch (err: any) {
        console.error("Error fetching locations:", err);
        toast.error("Failed to load locations.");
      } finally {
        setLocationsLoading(false);
        setLocationsReady(true);   // create mode: ready immediately after fetch
      }
    };

    fetchLocations();
  }, [companyId, isEditing]);


  // Load store data if editing
  useEffect(() => {
    if (!id || !companyId) {
      if (!isEditing && companyId) {
        checkCentralStoreExists();
      }
      return;
    }

    setIsLoadingStore(true);
    const loadStore = async () => {
      try {
        const { data, error } = await supabase
          .from("store_mgmt")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        setStore(data);
        if (data) {
          const validTypes = ["Central Store", "Branch Store"] as const;
          const storeType = validTypes.includes(data.type as any) ? data.type : "Branch Store";

          const storeLocationId = data.location_id;
          setLocationsReady(false);
          setLocationsLoading(true);

          let finalLocations: ILocation[] = [];
          try {
            let locationQuery = supabase
              .from("location_master")
              .select("id, location_id, location_name")
              .eq("company_id", companyId);

            if (storeLocationId) {
              // Include active locations OR the exact one used by this store
              locationQuery = locationQuery.or(
                `and(is_active.eq.true,status.eq.true),id.eq.${storeLocationId}`
              );
            } else {
              locationQuery = locationQuery
                .eq("is_active", true)
                .eq("status", true);
            }

            const { data: locData, error: locError } = await locationQuery;
            if (locError) throw locError;

            finalLocations = (locData || []) as ILocation[];

            // Safety net: if the assigned location is still missing (e.g. row
            // was hard-deleted), push a labelled fallback so the dropdown
            // doesn't silently show nothing.
            if (storeLocationId) {
              const exists = finalLocations.some(loc => loc.id === storeLocationId);
              if (!exists) {
                finalLocations.push({
                  id: storeLocationId,
                  location_id: null,
                  location_name: `(Deleted Location: ${storeLocationId})`,
                });
              }
            }
          } catch (locErr) {
            console.error("Failed to load locations:", locErr);
            toast.error("Could not load locations.");
            // Fallback: still show current if available
            if (storeLocationId) {
              finalLocations = [{
                id: storeLocationId,
                location_id: null,
                location_name: `(Location: ${storeLocationId})`,
              }];
            }
          } finally {
            setLocations(finalLocations);
            setLocationsLoading(false);
            setLocationsReady(true);   // NOW safe to validate
          }

          // Set location_id BEFORE reset so the dropdown picks it up
          if (storeLocationId) {
            setValue("location_id", String(storeLocationId), { shouldValidate: false });
          }

          reset({
            code: data.code || "",
            name: data.name || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            postalCode: data.postal_code || "",
            country: data.country || "",
            phone: data.phone || "",
            email: data.email || "",
            type: storeType as "Central Store" | "Branch Store",
            parent_id: extractId(data.parent_id) || "",
            location_id: storeLocationId ? String(storeLocationId) : "",
            bank_name: data.bank_name || "",
            bank_account_number: data.bank_account_number || "",
            bank_ifsc_code: data.bank_primary_code || "",
            bank_iban_code: data.bank_secondary_code || "",
            tax_code: data.tax_code || "",
            store_manager_id: extractId(data.store_manager_id) || "",
            direct_purchase_allowed: data.direct_purchase_allowed || false,
            internal: data.internal === true,
            external: data.external === true,
          });
        }
      } catch (error) {
        console.error("Error loading store:", error);
        toast.error("Failed to load store data", { position: "top-right" });
      } finally {
        setIsLoadingStore(false);
      }
    };
    loadStore();
  }, [id, reset, companyId, checkCentralStoreExists, isEditing, setValue]);

  // Load parent stores
  useEffect(() => {
    const loadParentStores = async () => {
      if (!companyId) return;
      try {
        const { data, error } = await supabase
          .from("store_mgmt")
          .select("*")
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order("name");

        if (error) throw error;

        let filteredStores = data || [];
        if (isEditing && store) {
          filteredStores = filteredStores.filter(
            (parent) => parent.id !== store.id
          );
        }
        setParentStores(filteredStores);
      } catch (error) {
        console.error("Error loading parent stores:", error);
      }
    };

    loadParentStores();
  }, [isEditing, store, companyId]);

  // Load store managers
  useEffect(() => {
    const loadManagers = async () => {
      if (!companyId) return;
      try {
        // Step 1: Fetch all roles to find the "Store Manager" role ID
        const { data: rolesData, error: rolesError } = await supabase
          .from("role_master")
          .select("id, name")
          .eq('is_active', true)
          .eq('company_id', companyId);

        if (rolesError) throw rolesError;

        // Find the "Store Manager" role
        const storeManagerRole = rolesData.find((role: any) => role.name === "Store Manager");
        if (!storeManagerRole) {
          throw new Error("Store Manager role not found in role_master table");
        }

        // Create a role lookup map
        const roleMap = rolesData.reduce((acc: any, role: any) => {
          acc[role.id] = role.name;
          return acc;
        }, {});

        // Fetch active store managers
        let query = supabase
          .from("user_mgmt")
          .select("*")
          .eq("company_id", companyId)
          .eq("role_id", storeManagerRole.id)
          .eq("is_active", true);

        query = query.eq("status", "active");

        let { data: usersData, error: usersError } = await query;

        if (usersError) throw usersError;

        if (isEditing && id) {
          // Fetch store's manager
          const { data: storeData, error: storeError } = await supabase
            .from("store_mgmt")
            .select("store_manager_id")
            .eq("id", id)
            .single();

          if (storeError) throw storeError;

          if (storeData?.store_manager_id) {
            const alreadyIncluded = usersData?.some(
              (u) => u.id === storeData.store_manager_id
            );

            if (!alreadyIncluded) {
              // Fetch this specific manager even if inactive
              const { data: managerUser, error: managerError } = await supabase
                .from("user_mgmt")
                .select("*")
                .eq("id", storeData.store_manager_id)
                .single();

              if (managerError) throw managerError;
              if (managerUser) {
                usersData = [...(usersData || []), managerUser];
              }
            }
          }
        }

        // Map users with role info
        const mappedManagers: ExtendedUser[] = (usersData || []).map(
          (user: IUser) => {
            const roleId = user.role_id ?? "";
            return {
              ...user,
              role: {
                id: user.role_id,
                role_name: roleMap[roleId] ?? "No Role",
              },
            };
          }
        );

        setManagers(mappedManagers);
      } catch (error) {
        console.error("Error loading managers:", error);
        toast.error("Failed to load store managers.", { position: "top-right" });
        setManagers([]);
      }
    };

    loadManagers();
  }, [companyId, id]);

  // Handle form submission
 const onSubmit = async (data: StoreFormData) => {
 
  if (isEditing && id) {
    const isLocked = await checkEntityLock(id);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }
  }

  if (!userId) {
  toast.error("User not found. Please login again.");
  navigate("/login");
  return;
}
  if (!companyId) {
    toast.error("Company ID is missing. Please log in again.");
    navigate("/login");
    return;
  }

  
  if (!isEditing && storeIdValidationStatus === "validating") {
    return;
  }

  if (!isEditing && storeIdValidationStatus === "invalid") {
    setError("code", {
      type: "manual",
      message: "Please choose a different store ID",
    });
    return;
  }

  
  if (data.type === "Central Store" && !isEditing && centralStoreExists) {
    setError("type", {
      type: "manual",
      message:
        "Only one Central Store is allowed. A Central Store already exists.",
    });
    return;
  }

  const cleanedData: any = {
    code: data.code,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    postal_code: data.postalCode,
    country: data.country,
    phone: data.phone,
    email: data.email,
    type: data.type,
    parent_id: data.type === "Central Store" ? null : data.parent_id,
    location_id: data.location_id || null,
    bank_name: data.bank_name,
    bank_account_number: data.bank_account_number,
    bank_primary_code: data.bank_ifsc_code,
    bank_secondary_code: data.bank_iban_code,
    tax_code: data.tax_code,
    store_manager_id: data.store_manager_id,
    direct_purchase_allowed: data.direct_purchase_allowed,
    internal: data.internal,
    external: data.external,
    company_id: companyId,
  };

  
  Object.keys(cleanedData).forEach((key) => {
    if (cleanedData[key] === undefined) {
      delete cleanedData[key];
    }
  });

  try {
    const now = new Date().toISOString();

    const systemLog = {
      company_id: companyId,
      transaction_date: now,
      module: "Store Management",
      scope: isEditing ? "Edit" : "Add",
      key: data.code,
      log: `Store ${data.code} ${
        isEditing ? "updated" : "created"
      }.`,
      action_by: userId,
      created_at: now,
    };

   
    const action_payload = {
      validations: [
        {
          type: 'unique',
          table: 'store_mgmt',
          column: 'code',
          value: cleanedData.code,
          company_id: companyId,
          ...(isEditing ? { ignore_id: id } : {})
        }
      ],
      operations: [
        {
          table: "store_mgmt",
          type: isEditing ? "update" : "insert",
          data: {
            ...cleanedData,
            ...(isEditing
              ? { modified_at: now }
              : {
                  created_at: now,
                  modified_at: now,
                }),
          },
          ...(isEditing ? { match: { id: id! } } : {}),
        },
        {
          table: "system_log",
          type: "insert",
          data: systemLog,
        },
      ],
    };

    
console.log("========== Approval Debug ==========");
console.log("Company ID:", companyId);
console.log("User ID:", userId);
console.log("Module Name:", "Stores");
console.log("Action Name:", isEditing ? "Edit" : "Add");
console.log("Action Payload:", action_payload);
    console.log("Before approval call");
    const approvalResponse = await initiateApprovalRequest({
      module_name: "Stores",
      action_name: isEditing ? "Edit" : "Add",
      company_id: companyId,
      requested_by: userId,
      action_payload,
      entity_id: isEditing ? id : null,
    });
console.log("After approval call");
console.log("Approval Response:", approvalResponse);
    if (approvalResponse?.success) {
      if (approvalResponse.requires_approval) {
        toast.success(
          "Your action has been submitted and is currently pending approval."
        );

        navigate("/dashboard/storeManagement");
        return;
      }

     

      if (isEditing) {
        const { error } = await supabaseClient
          .from("store_mgmt")
          .update({
            ...cleanedData,
            modified_at: now,
          })
          .eq("id", id!);

        if (error) throw error;

        const { error: logError } = await supabase
          .from("system_log")
          .insert(systemLog);

        if (logError) throw logError;

        toast.success("Store updated successfully!");
      } else {
        const { error } = await supabaseClient
          .from("store_mgmt")
          .insert({
            ...cleanedData,
            created_at: now,
            modified_at: now,
          });

        if (error) throw error;

        const { error: logError } = await supabase
          .from("system_log")
          .insert(systemLog);

        if (logError) throw logError;

        toast.success("Store created successfully!");
      }

      navigate("/dashboard/storeManagement");
    } else {
      throw new Error(
        approvalResponse?.message || "Approval initiation failed"
      );
    }
  } catch (error: any) {
    console.error("Database error:", error);

    let errorMessage = `Failed to ${
      isEditing ? "update" : "create"
    } store`;

    if (error.code === "23505") {
      if (error.message?.includes("code")) {
        errorMessage =
          "Store id already exists. Please use a different code.";

        setError("code", {
          type: "manual",
          message: "This store id is already in use",
        });
      } else if (error.message?.includes("email")) {
        errorMessage =
          "Email address already exists. Please use a different email.";

        setError("email", {
          type: "manual",
          message: "This email is already in use",
        });
      }
    } else if (
      error.message?.toLowerCase().includes("central store")
    ) {
      setError("type", {
        type: "manual",
        message: "Only one Central Store is allowed in the system.",
      });

      errorMessage =
        "Only one Central Store is allowed in the system.";

      checkCentralStoreExists();
    } else if (error.code === "PGRST204") {
      errorMessage =
        "Database schema error: Invalid column name.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    toast.error(errorMessage, {
      position: "top-right",
    });

    const firstErrorField = Object.keys(errors)[0];

    if (firstErrorField && formRef.current) {
      const invalidElement = formRef.current.querySelector(
        `[name="${firstErrorField}"]`
      );

      if (invalidElement) {
        invalidElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        (invalidElement as HTMLElement).focus();
      }
    }
  }
};

  const handleCancel = () => {
    reset(getDefaultValues());
    navigate("/dashboard/storeManagement");
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

  // UI Control Logic
  const isStoreTypeDisabled = isEditing;
  const isCentralStoreDisabled = !isEditing && centralStoreExists;
  const isBranchStoreDisabled = !isEditing && (!centralStoreExists || isCheckingCentralStore);
  const isParentStoreDisabled =
    isEditing && store
      ? watchedStoreType === "Central Store"
      : isCheckingCentralStore || watchedStoreType === "Central Store";

  return (
    <>
      {isCheckingCentralStore && !isEditing ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div className="text-lg text-gray-600">
              Checking store configuration...
            </div>
          </div>
        </div>
      ) : isEditing && isLoadingStore ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div className="text-lg text-gray-600">Loading store data...</div>
          </div>
        </div>
      ) : (
        <TooltipProvider>
          <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Header Section */}
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
                    <Store className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {isEditing ? "Update Store" : "Add New Store"}
                    </h1>
                    <p className="text-gray-600">
                      {isEditing
                        ? "Update store information and settings"
                        : "Create a new store location for your inventory management"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Store Information Form Card */}
              <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-800">
                    Store Information
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    Fill in the store details below to{" "}
                    {isEditing ? "update the existing" : "create a new"} store
                    location. Fields marked with <span className="text-red-500">*</span> are required.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 p-6">
                  <form
                    ref={formRef}
                    onSubmit={(e) => {
    console.log("FORM SUBMITTED");
    handleSubmit(onSubmit)(e);
  }}
                    className="space-y-6"
                  >
                    {/* Basic Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <Store className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="code"
                            className={`${errors.code ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Store className="h-4 w-4" /> Store Id <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="code"
                            control={control}
                            render={({ field }) => (
                              <div className="relative">
                                <Input
                                  {...field}
                                  id="code"
                                  placeholder="Enter 6-character store id"
                                  maxLength={6}
                                  className={`${errors.code
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : storeIdValidationStatus === 'valid'
                                      ? "border-green-300 focus:border-green-500 focus:ring-green-200"
                                      : storeIdValidationStatus === 'invalid'
                                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                        : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                    } pl-3 pr-10 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                    }`}
                                  disabled={isEditing}
                                />
                                {/* Validation Status Icon */}
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                  {storeIdValidationStatus === 'validating' && (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                  )}
                                  {storeIdValidationStatus === 'valid' && (
                                    <Check className="h-4 w-4 text-green-500" />
                                  )}
                                  {storeIdValidationStatus === 'invalid' && (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </div>
                            )}
                          />
                          <ErrorMessage message={errors.code?.message} />
                          {/* Validation Status Message */}
                          {storeIdValidationMessage && !errors.code && (
                            <p className={`text-sm flex items-center gap-1 mt-1 ${storeIdValidationStatus === 'valid'
                              ? 'text-green-600'
                              : storeIdValidationStatus === 'invalid'
                                ? 'text-red-500'
                                : 'text-blue-500'
                              }`}>
                              {storeIdValidationStatus === 'valid' && <Check className="h-3 w-3" />}
                              {storeIdValidationStatus === 'invalid' && <X className="h-3 w-3" />}
                              {storeIdValidationStatus === 'validating' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {storeIdValidationMessage}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="name"
                            className={`${errors.name ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Store className="h-4 w-4" /> Store Name <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="name"
                                placeholder="Enter store name"
                                maxLength={100}
                                className={`${errors.name
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.name?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="phone"
                            className={`${errors.phone ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Phone className="h-4 w-4" /> Phone Number <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="phone"
                                placeholder="Enter phone number"
                                maxLength={20}
                                className={`${errors.phone
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.phone?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="email"
                            className={`${errors.email ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Mail className="h-4 w-4" /> Email Address <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="email"
                                type="email"
                                placeholder="Enter email address"
                                className={`${errors.email
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.email?.message} />
                        </div>
                      </div>
                    </div>

                    {/* Address Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Address Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group md:col-span-2">
                          <Label
                            htmlFor="address"
                            className={`${errors.address ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <MapPin className="h-4 w-4" /> Street Address <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="address"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="address"
                                placeholder="Enter street address"
                                className={`${errors.address
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.address?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="city"
                            className={`${errors.city ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                          >
                            City <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="city"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="city"
                                placeholder="Enter city"
                                className={`${errors.city
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.city?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="state"
                            className={`${errors.state ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                          >
                            State/Province <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="state"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="state"
                                placeholder="Enter state"
                                className={`${errors.state
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.state?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="postalCode"
                            className={`${errors.postalCode ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                          >
                            Postal Code <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="postalCode"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="postalCode"
                                placeholder="Enter postal code"
                                className={`${errors.postalCode
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.postalCode?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="country"
                            className={`${errors.country ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 font-medium`}
                          >
                            Country <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="country"
                                placeholder="Enter country"
                                className={`${errors.country
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.country?.message} />
                        </div>

                        {/* Location dropdown — optional, placed here so it sits
                          alongside the other address-related fields */}
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="location_id"
                            className={`${errors.location_id && locationsReady
                              ? "text-red-500"
                              : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <MapPin className="h-4 w-4" /> Location <span className="text-red-500">*</span>
                          </Label>

                          <Controller
                            name="location_id"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                                disabled={locationsLoading}
                              >
                                <SelectTrigger
                                  id="location_id"
                                  className={`w-full ${errors.location_id && locationsReady
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                    } ${field.value && locationsReady ? "border-blue-300" : ""}`}
                                >
                                  <SelectValue
                                    placeholder={
                                      locationsLoading
                                        ? "Loading locations..."
                                        : "Select a location"
                                    }
                                  />
                                </SelectTrigger>

                                <SelectContent>
                                  {locations.length > 0 ? (
                                    locations.map((loc) => (
                                      <SelectItem key={loc.id} value={loc.id}>
                                        {loc.location_name || loc.location_id || loc.id}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="p-2 text-gray-500 text-sm">
                                      {locationsLoading
                                        ? "Loading..."
                                        : "No locations available"}
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />

                          {locationsReady && errors.location_id?.message && (
                            <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.location_id.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Store Configuration Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Store Configuration
                      </h3>
                      <div className="grid grid-cols-3 gap-4 items-start">
                        <div className="space-y-2">
                          <Label className="text-gray-700 flex items-center gap-1 font-medium">
                            <Store className="h-4 w-4" /> Store Type <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                  <input
                                    type="radio"
                                    id="centralStore"
                                    value="Central Store"
                                    checked={field.value === "Central Store"}
                                    onChange={() => field.onChange("Central Store")}
                                    disabled={isStoreTypeDisabled || isCentralStoreDisabled}
                                    className="h-4 w-4"
                                  />
                                )}
                              />
                              <Label htmlFor="centralStore" className="text-sm">Central Store</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                  <input
                                    type="radio"
                                    id="branchStore"
                                    value="Branch Store"
                                    checked={field.value === "Branch Store"}
                                    onChange={() => field.onChange("Branch Store")}
                                    disabled={isStoreTypeDisabled || isBranchStoreDisabled}
                                    className="h-4 w-4"
                                  />
                                )}
                              />
                              <Label htmlFor="branchStore" className="text-sm">Branch Store</Label>
                            </div>
                          </div>
                          <ErrorMessage message={errors.type?.message} />
                          {isStoreTypeDisabled && (
                            <p className="text-sm text-gray-500">
                              Central and Branch Store type cannot be changed
                            </p>
                          )}
                          {isCentralStoreDisabled && !isEditing && (
                            <p className="text-sm text-gray-500">
                              Only Branch Store can be created as a Central Store already exists
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="parent_id"
                            className={`${errors.parent_id ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <Store className="h-4 w-4" /> Parent Store{" "}
                            {watchedStoreType === "Branch Store" ? <span className="text-red-500">*</span> : ""}
                          </Label>
                          <Controller
                            name="parent_id"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                                disabled={isParentStoreDisabled}
                              >
                                <SelectTrigger
                                  className={`${errors.parent_id
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                    } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                    }`}
                                >
                                  <SelectValue placeholder="Select parent store" />
                                </SelectTrigger>
                                <SelectContent>
                                  {parentStores?.map((parentStore: IStore) => (
                                    <SelectItem
                                      key={parentStore.id}
                                      value={parentStore.id}
                                    >
                                      {parentStore.name} ({parentStore.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <ErrorMessage message={errors.parent_id?.message} />
                        </div>

                        {/* Checkboxes */}
                        <div className="flex flex-col gap-3 pt-4">

                          {/* Direct Purchase */}
                          <div className="flex items-center space-x-2">
                            <Controller
                              name="direct_purchase_allowed"
                              control={control}
                              render={({ field }) => (
                                <Checkbox
                                  id="directPurchase"
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                            <Label htmlFor="directPurchase" className="cursor-pointer">
                              Direct Purchase Allowed
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Controller
                              name="internal"
                              control={control}
                              render={({ field }) => (
                                <Checkbox
                                  id="store-category-internal"
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked === true);
                                  }}
                                />
                              )}
                            />
                            <Label htmlFor="store-category-internal" className="cursor-pointer">
                              Internal
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Controller
                              name="external"
                              control={control}
                              render={({ field }) => (
                                <Checkbox
                                  id="store-category-external"
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked === true);
                                  }}
                                />
                              )}
                            />
                            <Label htmlFor="store-category-external" className="cursor-pointer">
                              External
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Financial Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="bank_name"
                            className={`${errors.bank_name ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <CreditCard className="h-4 w-4" /> Bank Name
                          </Label>
                          <Controller
                            name="bank_name"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="bank_name"
                                placeholder="Enter bank name"
                                maxLength={100}
                                className={`${errors.bank_name
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.bank_name?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="bank_account_number"
                            className={`${errors.bank_account_number
                              ? "text-red-500"
                              : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <CreditCard className="h-4 w-4" /> Bank Account #
                          </Label>
                          <Controller
                            name="bank_account_number"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="bank_account_number"
                                placeholder="Enter account number"
                                maxLength={50}
                                className={`${errors.bank_account_number
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage
                            message={errors.bank_account_number?.message}
                          />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="bank_ifsc_code"
                            className={`${errors.bank_ifsc_code
                              ? "text-red-500"
                              : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <CreditCard className="h-4 w-4" /> IFSC Code
                          </Label>
                          <Controller
                            name="bank_ifsc_code"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="bank_ifsc_code"
                                placeholder="Enter IFSC code"
                                maxLength={20}
                                className={`${errors.bank_ifsc_code
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                                onChange={(e) =>
                                  field.onChange(e.target.value.toUpperCase())
                                }
                              />
                            )}
                          />
                          <p className="text-sm text-gray-500">
                            Required for suppliers with Indian bank accounts.
                          </p>
                          <ErrorMessage message={errors.bank_ifsc_code?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="bank_iban_code"
                            className={`${errors.bank_iban_code
                              ? "text-red-500"
                              : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <CreditCard className="h-4 w-4" /> IBAN Code
                          </Label>
                          <Controller
                            name="bank_iban_code"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="bank_iban_code"
                                placeholder="Enter IBAN code"
                                maxLength={34}
                                className={`${errors.bank_iban_code
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                                onChange={(e) =>
                                  field.onChange(e.target.value.toUpperCase())
                                }
                              />
                            )}
                          />
                          <p className="text-sm text-gray-500">
                            Required for international bank accounts outside India.
                          </p>
                          <ErrorMessage
                            message={errors.bank_iban_code?.message}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <User className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Additional Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="tax_code"
                            className={`${errors.tax_code ? "text-red-500" : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <CreditCard className="h-4 w-4" /> Tax Code <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="tax_code"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                id="tax_code"
                                placeholder="Enter tax code"
                                maxLength={50}
                                className={`${errors.tax_code
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                  } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                  }`}
                              />
                            )}
                          />
                          <ErrorMessage message={errors.tax_code?.message} />
                        </div>
                        <div className="space-y-2 group">
                          <Label
                            htmlFor="store_manager_id"
                            className={`${errors.store_manager_id
                              ? "text-red-500"
                              : "text-gray-700"
                              } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                          >
                            <User className="h-4 w-4" /> Store Manager <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="store_manager_id"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger
                                  className={`${errors.store_manager_id
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                                    } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                                    }`}
                                >
                                  <SelectValue placeholder="Select store manager" />
                                </SelectTrigger>
                                <SelectContent>
                                  {managers.length === 0 ? (
                                    <p className="text-sm text-gray-500 px-2 py-1">
                                      No store managers found
                                    </p>
                                  ) : (
                                    managers.map((manager: IUser) => (
                                      <SelectItem
                                        key={manager.id}
                                        value={manager.id}
                                      >
                                        {`${manager.first_name} ${manager.last_name}`}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <ErrorMessage message={errors.store_manager_id?.message} />
                        </div>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="pt-6 border-t flex justify-end gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200 px-6 py-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg px-6 py-2"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {isEditing ? "Updating..." : "Creating..."}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            {isEditing ? "Update Store" : "Create Store"}
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Location Management Card */}
              <Card className="shadow-sm border-gray-200 accordion-section">
                <CardHeader
                  className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
                  onClick={() => setShowLocations((prev) => !prev)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="h-6 w-6 text-blue-600" />
                      <CardTitle className="text-xl text-gray-900">Storage Location Management</CardTitle>
                    </div>
                    {showLocations ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </CardHeader>

                {showLocations && (
                  <CardContent className="pt-0 space-y-6 fade-in">
                    {/* Header with Description and Refresh Button */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Manage Storage Locations</h3>
                        <p className="text-sm text-gray-500">
                          Configure storage locations and define shelf-cabinet relationships for inventory management.
                        </p>
                      </div>
                      {hasStoreContext && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadLocationData();
                          }}
                          disabled={!hasStoreContext || isLoadingLocations}
                          className="transition-transform duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLocations ? "animate-spin" : ""}`} />
                          Refresh Data
                        </Button>
                      )}
                    </div>


                    {/* Available Storage Spaces */}
                    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div>
                        <p className="text-lg font-semibold">Available Storage Spaces</p>
                        <p className="text-sm text-muted-foreground">
                          Currently available shelf-cabinet storage spaces for this store.
                        </p>
                      </div>

                      <Separator />

                      {availableStorages.length === 0 && (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No storage spaces found.
                        </div>
                      )}

                      {/* List of available storage links */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableStorages.map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4 shadow-sm"
                          >
                            {/* Storage Icon */}
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                              <Database className="h-4 w-4 text-blue-600" />
                            </div>

                            {/* Shelf - Cabinet Name */}
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {link.shelfName || "Unnamed Shelf"} — {link.cabinetName || "Unnamed Cabinet"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Manage shelves and cabinets section */}
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-8">
                      {isLoadingLocations && hasStoreContext ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading shelves & cabinets...
                        </div>
                      ) : (
                        <>
                          {/* === Shelves & Cabinets Section === */}
                          <section className="space-y-4 border rounded-lg p-5 bg-gray-50">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <p className="text-base font-semibold">Shelves & Cabinets</p>
                                <p className="text-sm text-muted-foreground">
                                  Add or edit storage locations. Short names must be unique.
                                </p>
                              </div>
                              <Button type="button" variant="secondary" size="sm" onClick={addMasterRow}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Row
                              </Button>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                              {masterRows.length === 0 && (
                                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                  No shelves or cabinets yet. Click "Add Row" to begin.
                                </div>
                              )}

                              {masterRows.map((row) => (
                                <div key={row.tempId} className="rounded-lg border bg-white p-4 shadow-sm">
                                  <div className="grid gap-4 md:grid-cols-[140px_160px_minmax(0,1fr)_40px] md:items-end">
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                                      <Select
                                        value={row.loc_type}
                                        onValueChange={(value: LocationType) =>
                                          setMasterRows((prev) =>
                                            prev.map((item) =>
                                              item.tempId === row.tempId ? { ...item, loc_type: value } : item
                                            )
                                          )
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="SHELF">Shelf</SelectItem>
                                          <SelectItem value="CABINET">Cabinet</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <p className="text-xs font-medium uppercase text-muted-foreground">
                                        Short Name <span className="text-red-500">*</span>
                                      </p>
                                      <Input
                                        value={row.short_name}
                                        maxLength={20}
                                        placeholder="e.g. SH-01"
                                        onChange={(e) => {
                                          const value = e.target.value.toUpperCase();
                                          setMasterRows((prev) =>
                                            prev.map((item) =>
                                              item.tempId === row.tempId ? { ...item, short_name: value } : item
                                            )
                                          );
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <p className="text-xs font-medium uppercase text-muted-foreground">
                                        Description <span className="lowercase">(optional)</span>
                                      </p>
                                      <Input
                                        value={row.description}
                                        placeholder="Enter description"
                                        onChange={(e) =>
                                          setMasterRows((prev) =>
                                            prev.map((item) =>
                                              item.tempId === row.tempId ? { ...item, description: e.target.value } : item
                                            )
                                          )
                                        }
                                      />
                                    </div>

                                    <div className="flex justify-end">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span tabIndex={0}>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              disabled={getLinkedTempIds().has(row.tempId)}
                                              className={getLinkedTempIds().has(row.tempId)
                                                ? "text-destructive hover:bg-destructive/10 opacity-50 cursor-pointer"
                                                : "text-red-600 hover:text-red-700 hover:bg-red-50"
                                              }
                                              onClick={() => {
                                                if (!getLinkedTempIds().has(row.tempId)) {
                                                  removeMasterRow(row);
                                                }
                                              }}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </span>
                                        </TooltipTrigger>

                                        {getLinkedTempIds().has(row.tempId) && (
                                          <TooltipContent side="top" className="bg-gray-900 text-white">
                                            <p className="text-xs">
                                              Cannot delete: This {row.loc_type.toLowerCase()} is linked to one or more storage spaces
                                            </p>
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    </div>
                                  </div>
                                  {masterErrors[row.tempId] && (
                                    <p className="text-xs text-red-600 mt-2">{masterErrors[row.tempId]}</p>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Save Shelves & Cabinets Button */}
                            <div className="flex justify-end pt-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                type="button"
                                onClick={saveShelvesAndCabinets}
                                disabled={!hasPermission('Create Storage Spaces') || masterRows.length === 0 || isSavingMasters || isLoadingLocations}
                              >
                                {isSavingMasters ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Save Shelves & Cabinets
                                  </>
                                )}
                              </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasPermission('Create Storage Spaces')
                                    ? 'Save Shelves & Cabinets'
                                    : 'You do not have permission to create storage space'}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </section>

                          {/* === Link Shelves to Cabinets Section === */}
                          <section className="space-y-4 border rounded-lg p-5 bg-gray-50">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <p className="text-base font-semibold">Link Shelves to Cabinets</p>
                                <p className="text-sm text-muted-foreground">
                                  Map shelves to cabinets. Only saved locations are available.
                                </p>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                type="button"
                                onClick={addLinkRow}
                                disabled={shelfOptions.length === 0 || cabinetOptions.length === 0}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Link
                              </Button>
                            </div>

                            <Separator />

                            {shelfOptions.length === 0 || cabinetOptions.length === 0 ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                Save at least one shelf and one cabinet above before creating links.
                              </div>
                            ) : linkRows.length === 0 ? (
                              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No links created. Use "Add Link" to connect shelves and cabinets.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {linkRows.map((row) => {
                                  const isUsedInInventory = row.id ? usedLinkIds.has(row.id) : false;
                                  return (
                                    <div
                                      key={row.tempId}
                                      className="rounded-lg border bg-white p-4 shadow-sm"
                                    >
                                      <div className="flex flex-col md:flex-row gap-4 items-center">
                                        {/* Shelf Select */}
                                        <div className="flex-1 space-y-1">
                                          <p className="text-xs font-medium uppercase text-muted-foreground">Shelf</p>
                                          <Select
                                            value={row.shelfRef}
                                            onValueChange={(value) =>
                                              setLinkRows((prev) =>
                                                prev.map((item) =>
                                                  item.tempId === row.tempId ? { ...item, shelfRef: value } : item
                                                )
                                              )
                                            }
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder="Select shelf" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {shelfOptions.map((s) => (
                                                <SelectItem key={s.tempId} value={s.tempId}>
                                                  {s.short_name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Cabinet Select */}
                                        <div className="flex-1 space-y-1">
                                          <p className="text-xs font-medium uppercase text-muted-foreground">Cabinet</p>
                                          <Select
                                            value={row.cabinetRef}
                                            onValueChange={(value) =>
                                              setLinkRows((prev) =>
                                                prev.map((item) =>
                                                  item.tempId === row.tempId ? { ...item, cabinetRef: value } : item
                                                )
                                              )
                                            }
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder="Select cabinet" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {cabinetOptions.map((c) => (
                                                <SelectItem key={c.tempId} value={c.tempId}>
                                                  {c.short_name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        {/* Delete Button with Tooltip */}
                                        <div className="self-end md:self-center">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span tabIndex={0}>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  disabled={isUsedInInventory}
                                                  className={isUsedInInventory ? "cursor-not-allowed opacity-60 mt-4" : "hover:bg-red-50 mt-4"}
                                                  onClick={() => !isUsedInInventory && removeLinkRow(row)}
                                                >
                                                  <X className="h-4 w-4 text-red-600" />
                                                </Button>
                                              </span>
                                            </TooltipTrigger>

                                            {isUsedInInventory && (
                                              <TooltipContent side="top" className="bg-gray-900 text-white">
                                                <p className="text-xs">
                                                  Cannot delete: This link is used in inventory records
                                                </p>
                                              </TooltipContent>
                                            )}
                                          </Tooltip>
                                        </div>
                                      </div>

                                      {linkErrors[row.tempId] && (
                                        <p className="text-xs text-red-600 mt-2">{linkErrors[row.tempId]}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Save Links Button */}
                            <div className="flex justify-end pt-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                              <Button
                                type="button"
                                onClick={saveShelfCabinetLinks}
                                disabled={!hasPermission('Create Storage Spaces') || linkRows.length === 0 || isSavingLinks}
                              >
                                {isSavingLinks ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Save Links
                                  </>
                                )}
                              </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasPermission('Create Storage Spaces')
                                    ? ' Save Links'
                                    : 'You do not have permission to create storage space'}
                                </TooltipContent>
                              </Tooltip>
                              
                            </div>
                          </section>
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </TooltipProvider>
      )}
    </>
  );
}

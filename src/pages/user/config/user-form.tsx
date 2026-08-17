import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { components } from 'react-select';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  ArrowLeft,
  User,
  Mail,
  Key,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Loader2,
  UserCog,
  Users,
  EyeOff,
  Eye,
  Copy,
  Check,
  Camera,
  Trash2,
  Unlock,
  Building2,
  MapPin,
  Info,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import toast from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactSelect from 'react-select';
import { supabase } from "@/Utils/types/supabaseClient";
import { Checkbox } from '@/components/ui/checkbox';
import { getLocalDateTime, loadModulePermissions, initiateApprovalRequest } from '@/Utils/commonFun';
import { IUser, IRole } from '@/Utils/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Store } from "lucide-react";
import { useDispatch } from "react-redux";
import { setUser } from "@/redux/features/userSlice";

// Interface for image metadata
interface ImageMetadata {
  name: string;
  type: string;
  size: number;
  path: string;
}

// Schema definition
const nameRegex = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;
const userFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .regex(nameRegex, { message: "First name can contain only letters" }),

  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .regex(nameRegex, { message: "Last name can contain only letters" }),

  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" })
    .refine((val) => val === val.toLowerCase(), {
      message: "Email must not contain uppercase letters"
    }),

  role: z.string().min(1, { message: "Please select a role" }),

  department: z.string().min(1, { message: "Please select a department" }),

  employee_location_id: z.string().min(1, { message: "Please select a location" }),

  employee_id: z
    .string()
    .trim()
    .min(1, { message: "Employee ID is required" }),

  locations: z.array(z.string()).min(1, { message: "Please select at least one location" }),

  stores: z.array(z.string()).min(1, {
    message: "Please select at least one store"
  }),



  approve_authorizations: z.array(
    z.object({
      moduleId: z.string().min(1),
      actionId: z.string().min(1),
    })
  ).optional(),


  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" })
    .refine((val) => /[A-Z]/.test(val), {
      message: "Password must contain at least one uppercase letter",
    })
    .refine((val) => /\d/.test(val), {
      message: "Password must contain at least one number",
    })
    .refine((val) => /[^A-Za-z0-9]/.test(val), {
      message: "Password must contain at least one special character",
    })
    .optional(),

  status: z.enum(["active", "inactive"], {
    required_error: "Please select a status",
  }),

  image: z
    .any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && ['image/jpeg', 'image/png'].includes(file.type)),
      'Image must be a JPG or PNG file'
    )
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, 'Image must be less than 5MB'),
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Simple Modal Component
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </span>
            ) : 'Delete User'}
          </Button>
        </div>
      </div>
    </div>
  );
};



export const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = Boolean(id);
  const isViewMode = location.pathname.includes('/view');
  const [isLoading, setIsLoading] = useState(false);
  const [_, setError] = useState('');
  const [formStatus, setFormStatus] = useState('idle');
  const [_currentStatus, setCurrentStatus] = useState<'active' | 'inactive'>('active');
  const [allRoles, setAllRoles] = useState<IRole[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [copyPassword, setCopyPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [__, setInitialImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [employeeIdConfig, setEmployeeIdConfig] = useState<{
    autoGenerate: boolean;
    prefix: string;
    startingSequence: number;
  } | null>(null);

  const user = localStorage.getItem("userData");
  const userData = JSON.parse(user || '{}');
  const [userLocationIds, setUserLocationIds] = useState<string[]>([]);
  const [lockedLocationIds, setLockedLocationIds] = useState<string[]>([]);
  const [stores, setStores] = useState<any[]>([]);

  const [permissionTree, setPermissionTree] = useState<any[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [expandedParents, setExpandedParents] = useState<string[]>([]);
  const [assignedLocationIds, setAssignedLocationIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>("");

  const dispatch = useDispatch();

  const allOption = {
    value: "ALL",
    label: "Select All",
    isDisabled: false,
    tooltip: "",
  };

  const locationOptions = [
    allOption,
    ...allLocations.map(location => {
      const isAssigned = assignedLocationIds.includes(location.id);
      const isLocked = lockedLocationIds.includes(location.id);

      return {
        value: location.id,
        label: location.location_name,
        isDisabled: isAssigned || isLocked,
        tooltip: isAssigned
          ? "This location is assigned to a store and can't be removed"
          : isLocked
            ? "This location is locked by a Workflow"
            : "",
      };
    }),
  ];
  console.log("assignedLocationIds", assignedLocationIds);
  console.log(
    allLocations.map(loc => ({
      name: loc.location_name,
      assigned: assignedLocationIds.includes(loc.id)
    }))
  );
  console.log(
    allLocations.map(loc => ({
      id: loc.id,
      name: loc.location_name,
      assigned: assignedLocationIds.includes(loc.id),
    }))
  );
  console.log(locationOptions, "'locationOptions")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    setError: setFormError,
    clearErrors,
  } = useForm<UserFormValues>({
    resolver: zodResolver(
      (isEditing && resetPassword)
        ? userFormSchema
        : isEditing
          ? userFormSchema.omit({ password: true })
          : userFormSchema
    ),
    mode: "onChange",
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      department: '',
      employee_location_id: '',
      employee_id: '',
      locations: [],
      stores: [],

      password: '',
      status: 'active',
      image: null,
    },
  });

  console.log("all values =", watch());
  const watchedFields = watch();
  const passwordValue = watchedFields.password ?? '';
  const isUserLocked =
    isEditing &&
    !isViewMode &&
    currentUser?.status === 'inactive' &&
    currentUser?.failed_attempts === 3 &&
    userData.role_name === "Super Admin";


  const selectedLocations = watch("locations");
  const selectedStoreIds = watch("stores") || [];
  const selectedRoleId = watch('role') || '';

useEffect(() => {
  if (!selectedRoleId) return;
  
  const fetchRoleData = async () => {
    const { data, error } = await supabase
        .from('role_master')
        .select('id,name')
        .eq('id', selectedRoleId)
        .single();

    if (error) {
      console.error("Error fetching role data:", error);
    } else {
      console.log("Successfully fetched role data:", data);
      setSelectedRole(data.name);
    }
  };

  fetchRoleData();
      
}, [selectedRoleId]);


  useEffect(() => {
    const selectedStoreLocations = stores
      .filter(store =>
        selectedStoreIds.includes(String(store.id))
      )
      .map(store => store.location_id)
      .filter(Boolean);

    setAssignedLocationIds(selectedStoreLocations);
  }, [selectedStoreIds, stores]);

  useEffect(() => {
    console.log("Selected Locations:", selectedLocations);

    const fetchStores = async () => {
      if (!selectedLocations?.length) {
        setStores([]);
        return;
      }

      const { data, error } = await supabase
        .from("store_mgmt")
        .select("id, name, location_id")
        .in("location_id", selectedLocations)
        .eq("is_active", true);

      //        if (data) {
      //   setAssignedLocationIds(
      //     data
      //       .map(store => store.location_id)
      //       .filter((id): id is string => id !== null)
      //   );
      // }

      if (error) {
        console.error(error);
        return;
      }

      console.log("Stores:", data);

      setStores(data || []);
    };

    fetchStores();
  }, [selectedLocations]);
  // Handle image change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('image', file, { shouldDirty: true });
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setImageRemoved(false);
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setValue('image', null, { shouldDirty: true });
    setImagePreview(null);
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!id) return;
      const { data: user } = await supabase
        .from("user_mgmt")
        .select("role_id, company_id")
        .eq("id", id)
        .single();

      try {
        if (!user?.role_id) return;
        // User permissions
        const { data: userPermissions } = await supabase
          .from("module_permissions")
          .select(`
          id,
          permissions,
          parent_modules!parentmodule_id (
            id,
            module_name
          ),
          main_modules!module_id (
            id,
            module_name,
            available_actions
          )
        `)
          .eq("company_id", user.company_id)
          .eq("user_id", id);

        // Role permissions
        const { data: rolePermissions } = await supabase
          .from("module_permissions")
          .select(`
          id,
          permissions,
          parent_modules!parentmodule_id (
            id,
            module_name
          ),
          main_modules!module_id (
            id,
            module_name,
            available_actions
          )
        `)
          .eq("company_id", user.company_id)
          .eq("role_id", user.role_id);

        // Action names
        const { data: actions } = await supabase
          .from("available_actions")
          .select("id, action_name");

        const actionMap = new Map(
          actions?.map(action => [
            action.id,
            action.action_name,
          ]) || []
        );

        // IMPORTANT:
        // Role first, User second
        // User permissions override role permissions
        const allPermissions = [
          ...(rolePermissions || []),
          ...(userPermissions || []),
        ];

        const moduleMap = new Map();

        allPermissions.forEach((item: any) => {
          const moduleKey = `${item.parent_modules.id}-${item.main_modules.id}`;

          if (!moduleMap.has(moduleKey)) {
            moduleMap.set(moduleKey, {
              parentModuleId: item.parent_modules.id,
              parentModule: item.parent_modules.module_name,

              moduleId: item.main_modules.id,
              moduleName: item.main_modules.module_name,

              permissions: new Map(),
            });
          }

          const moduleEntry = moduleMap.get(moduleKey);

          item.permissions?.forEach((permission: any) => {
            if (!permission.isAllowed) return;

            moduleEntry.permissions.set(permission.action_id, {
              actionId: permission.action_id,
              actionName: actionMap.get(permission.action_id) || "Unknown Action",
              isAllowed: permission.isAllowed,
              requiredWorkflow:
                permission.requiredworkflow ?? false,
            });
          });
        });

        const flatModules = Array.from(moduleMap.values())
          .map((module: any) => ({
            parentModuleId: module.parentModuleId,
            parentModule: module.parentModule,

            moduleId: module.moduleId,
            moduleName: module.moduleName,

            permissions: Array.from(module.permissions.values()),
          }))
          .filter((module: any) => module.permissions.length > 0);

        const treeMap = new Map();

        flatModules.forEach((module: any) => {
          if (!treeMap.has(module.parentModuleId)) {
            treeMap.set(module.parentModuleId, {
              parentModuleId: module.parentModuleId,
              parentModule: module.parentModule,
              modules: [],
            });
          }

          treeMap.get(module.parentModuleId).modules.push({
            moduleId: module.moduleId,
            moduleName: module.moduleName,
            permissions: module.permissions,
          });
        });

        const permissionTree = Array.from(treeMap.values()).filter(
          (parent: any) => parent.modules.length > 0
        );
        console.log("Permission Tree", permissionTree);

        setPermissionTree(permissionTree);
      } catch (error) {
        console.error("Error fetching permissions", error);
      }
    };

    if (id) {
      fetchPermissions();
    }
  }, [id]);


  useEffect(() => {
    if (!isEditing || (isEditing && resetPassword)) {
      const newPwd = generateDefaultPassword();
      setValue("password", newPwd, { shouldValidate: true, shouldDirty: true });
    } else {
      setValue("password", "", { shouldValidate: false, shouldDirty: true });
    }
  }, [resetPassword, setValue, isEditing]);

  // ─── Fetch active roles ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchRoles = async () => {
      const { data } = await supabase
        .from('role_master')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .eq('status', true)
        .order('name', { ascending: true });
      if (data) setAllRoles(data);
    };
    fetchRoles();
  }, [userData.company_id]);

  // ─── Fetch active departments ─────────────────────────────────────────────
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from('department_master')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .eq('status', true)
        .order('department_name', { ascending: true });
      if (data) setAllDepartments(data);
    };
    fetchDepartments();
  }, [userData.company_id]);

  // ─── Fetch active locations ───────────────────────────────────────────────
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from('location_master')
        .select('*')
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .eq('status', true)
        .order('location_name', { ascending: true });

      if (data) setAllLocations(data);
    };

    fetchLocations();
  }, [userData.company_id]);

  // ─── ENSURE INACTIVE SELECTED ROLE IS ALWAYS IN LIST ─────────────────────
  useEffect(() => {
    if (!isEditing && !isViewMode) return;
    const selectedRoleId = watch('role');
    if (!selectedRoleId) return;
    const alreadyInList = allRoles.some(r => r.id === selectedRoleId);
    if (!alreadyInList) {
      supabase
        .from('role_master')
        .select('*')
        .eq('id', selectedRoleId)
        .eq('company_id', userData.company_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setAllRoles(prev => prev.some(r => r.id === data.id) ? prev : [...prev, data]);
          } else {
            setAllRoles(prev =>
              prev.some(r => r.id === selectedRoleId) ? prev : [...prev, { id: selectedRoleId, name: `(Inactive Role)` } as IRole]
            );
          }
        });
    }
  }, [watch('role'), isEditing, isViewMode, userData.company_id, allRoles]);

  // ─── ENSURE INACTIVE SELECTED DEPARTMENT IS ALWAYS IN LIST ───────────────
  useEffect(() => {
    if (!isEditing && !isViewMode) return;
    const selectedDeptId = watch('department');
    if (!selectedDeptId) return;
    const alreadyInList = allDepartments.some(d => d.id === selectedDeptId);
    if (!alreadyInList) {
      supabase
        .from('department_master')
        .select('*')
        .eq('id', selectedDeptId)
        .eq('company_id', userData.company_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setAllDepartments(prev => prev.some(d => d.id === data.id) ? prev : [...prev, data]);
          } else {
            setAllDepartments(prev =>
              prev.some(d => d.id === selectedDeptId) ? prev : [...prev, { id: selectedDeptId, department_name: `(Inactive Department)` }]
            );
          }
        });
    }
  }, [watch('department'), isEditing, isViewMode, userData.company_id, allDepartments]);

  // ─── ENSURE INACTIVE SELECTED EMPLOYEE LOCATION IS ALWAYS IN LIST ─────────
  useEffect(() => {
    if (!isEditing && !isViewMode) return;
    const selectedLocId = watch('employee_location_id');
    if (!selectedLocId) return;
    const alreadyInList = allLocations.some(l => l.id === selectedLocId);
    if (!alreadyInList) {
      supabase
        .from('location_master')
        .select('*')
        .eq('id', selectedLocId)
        .eq('company_id', userData.company_id)
        .single()
        .then(({ data }) => {
          if (data) {
            setAllLocations(prev => prev.some(l => l.id === data.id) ? prev : [...prev, data]);
          } else {
            setAllLocations(prev =>
              prev.some(l => l.id === selectedLocId) ? prev : [...prev, { id: selectedLocId, location_name: `(Inactive Location)` }]
            );
          }
        });
    }
  }, [watch('employee_location_id'), isEditing, isViewMode, userData.company_id, allLocations]);

  // ─── ENSURE INACTIVE MULTI-SELECT LOCATIONS ARE ALWAYS IN LIST ────────────
  useEffect(() => {
    if (!isEditing && !isViewMode) return;
    const locationsArray = watch('locations') as string[] | undefined;
    if (!locationsArray || !Array.isArray(locationsArray) || locationsArray.length === 0) return;

    const activeLocationIds = new Set(allLocations.map(loc => loc.id));
    const missingIds = locationsArray.filter(locId => locId && !activeLocationIds.has(locId));

    if (missingIds.length === 0) return;

    supabase
      .from('location_master')
      .select('id, location_name')
      .eq('company_id', userData.company_id)
      .in('id', missingIds)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAllLocations(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const newOnes = data.filter((d: any) => !existingIds.has(d.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
        // For any IDs not found in DB, add a placeholder
        const fetchedIds = new Set((data || []).map((d: any) => d.id));
        const notFound = missingIds.filter(mid => !fetchedIds.has(mid));
        if (notFound.length > 0) {
          setAllLocations(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const placeholders = notFound
              .filter(mid => !existingIds.has(mid))
              .map(mid => ({ id: mid, location_name: `(Inactive Location)` }));
            return placeholders.length > 0 ? [...prev, ...placeholders] : prev;
          });
        }
      });
  }, [watch('locations'), isEditing, isViewMode, userData.company_id, allLocations]);

  // ─── Fetch employee ID config ─────────────────────────────────────────────
  useEffect(() => {
    const fetchEmployeeIdConfig = async () => {
      try {
        const { data: companyData, error } = await supabase
          .from('company_master')
          .select('employee_id_config')
          .eq('id', userData.company_id)
          .single();

        if (error) { console.error('Error fetching employee ID config:', error); return; }

        if (companyData?.employee_id_config) {
          try {
            const config = typeof companyData.employee_id_config === 'string'
              ? JSON.parse(companyData.employee_id_config)
              : companyData.employee_id_config;
            if (config && typeof config === 'object') {
              setEmployeeIdConfig({
                autoGenerate: config.autoGenerate ?? false,
                prefix: config.prefix ?? 'EMP',
                startingSequence: config.startingSequence ?? 1,
              });
            }
          } catch (parseError) {
            console.error('Error parsing employee_id_config:', parseError);
          }
        } else {
          setEmployeeIdConfig({ autoGenerate: false, prefix: 'EMP', startingSequence: 1 });
        }
      } catch (error) {
        console.error('Error in fetchEmployeeIdConfig:', error);
      }
    };
    if (userData.company_id) fetchEmployeeIdConfig();
  }, [userData.company_id]);

  // ─── Auto-generate employee ID ────────────────────────────────────────────
  useEffect(() => {
    const populateEmployeeId = async () => {
      if (!isEditing && employeeIdConfig?.autoGenerate && !watch('employee_id')) {
        try {
          const { data: existingUsers, error } = await supabase
            .from('user_mgmt')
            .select('employee_id')
            .eq('company_id', userData.company_id)
            .not('employee_id', 'is', null);

          let generatedId: string;
          if (error) {
            generatedId = `${employeeIdConfig.prefix}${String(employeeIdConfig.startingSequence).padStart(4, '0')}`;
          } else {
            const prefix = employeeIdConfig.prefix;
            const existingNumbers: number[] = [];
            if (existingUsers && existingUsers.length > 0) {
              existingUsers.forEach((u: any) => {
                if (u.employee_id && typeof u.employee_id === 'string' && u.employee_id.startsWith(prefix)) {
                  const num = parseInt(u.employee_id.substring(prefix.length), 10);
                  if (!isNaN(num)) existingNumbers.push(num);
                }
              });
            }
            let nextNumber = employeeIdConfig.startingSequence;
            if (existingNumbers.length > 0) {
              const maxNumber = Math.max(...existingNumbers);
              nextNumber = Math.max(maxNumber + 1, employeeIdConfig.startingSequence);
            }
            generatedId = `${prefix}${String(nextNumber).padStart(4, '0')}`;
          }
          if (generatedId) setValue('employee_id', generatedId, { shouldValidate: false, shouldDirty: true });
        } catch (error) {
          console.error('Error populating employee ID:', error);
        }
      }
    };
    if (employeeIdConfig && !isEditing) populateEmployeeId();
  }, [employeeIdConfig, isEditing, setValue, watch, userData.company_id]);

  useEffect(() => {
    if (isEditing && id) getUserDetails();
  }, [id, isEditing]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-amber-500';
      default: return 'text-gray-600';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const buildResetPayload = (data: any, locationsArray: string[]) => ({
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    email: data.email ?? '',
    role: data.role_id ?? '',
    department: data.department_id ?? '',
    employee_location_id: data.employee_location_id ?? '',
    stores: data.stores || [],
    employee_id: data.employee_id ?? '',
    locations: locationsArray,

    status: (data.status ?? 'active') as "active" | "inactive",
    image: null,
  });

  // ─── Fetch user details ───────────────────────────────────────────────────
  const getUserDetails = async () => {
    try {
      if (!id) throw new Error("No ID provided");
      setIsLoading(true);

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
        const userOp = operations.find((op: any) => op.table === 'user_mgmt');

        if (userOp) {
            if (requestData.entity_id) {
                const { data: dbData, error: dbError } = await supabase
                    .from('user_mgmt')
                    .select('*')
                    .eq('id', requestData.entity_id)
                    .single();
                if (!dbError && dbData) {
                    data = { ...dbData, ...(userOp.data || {}) };
                } else {
                    data = userOp.data || {};
                }
            } else {
                data = userOp.data || {};
            }
        } else {
            throw new Error('User data not found in approval request payload');
        }
      } else {
          const { data: dbData, error } = await supabase
            .from('user_mgmt')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            console.error('Error fetching user:', error);
            console.log("FULL USER DATA =>", userData);

            setError('Failed to fetch user data');
            toast.error('Failed to fetch user data');
            return;
          }
          data = dbData;
      }
      console.log('Fetched user data:', data);

      if (data) {
        const mappedUser: any = {
          id: data.id,
          email: data.email ?? '',
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          role_id: data.role_id ?? '',
          status: (data.status ?? 'active') as IUser['status'],
          is_active: data.is_active ?? true,
          modified_at: data.modified_at ?? '',
          created_at: data.created_at ?? '',
          company_id: data.company_id ?? '',
          last_login_date: data.last_login_date ?? null,
          image: data.image ?? null,
          failed_attempts: data.failed_attempts ?? null,


        };
        setCurrentUser(mappedUser);

        if (data.image) {
          const imageMetadata = data.image as any;
          if (imageMetadata.path) {
            const { data: publicUrl } = supabase.storage.from('profile-picture').getPublicUrl(imageMetadata.path);
            setImagePreview(publicUrl.publicUrl);
            setInitialImagePreview(publicUrl.publicUrl);
          }
        }

        const locationsArray: string[] = (Array.isArray(data.locations) ? data.locations : []).filter(
          (loc: any): loc is string => typeof loc === 'string'
        )

        const userData = data as any;

        let storesArray: string[] = [];

        try {
          if (typeof userData.stores === "string") {
            storesArray = JSON.parse(userData.stores);
          } else if (Array.isArray(userData.stores)) {
            storesArray = userData.stores.map((id: any) => String(id));
          }
        } catch (err) {
          console.error("Error parsing stores:", err);
        }

        // reset(buildResetPayload(data, locationsArray));


        reset({
          ...buildResetPayload(data, locationsArray),
          stores: storesArray,
        });

        setUserLocationIds(locationsArray);
        setCurrentStatus((data.status ?? 'active') as "active" | "inactive");
      }

      console.log("watch stores", watch("stores"));
      console.log("stores list", stores);
    } catch (error: any) {
      console.error('Fetch user error:', error);
      setError('Failed to fetch user data');
      toast.error('Failed to fetch user data');
    } finally {
      setIsLoading(false);
    }
  };

  //const selectedStoreIds = watch("stores") || [];

  const [lockedStores, setLockedStores] = useState<
    Record<
      string,
      {
        isAssignedTo: boolean;
        isApprovalUser: boolean;
      }
    >
  >({});

  const lockedStoreIds = Object.keys(lockedStores);

  // useEffect(() => {
  //   const fetchLockedStores = async () => {
  //     if (!id || selectedStoreIds.length === 0) {
  //       setLockedStoreIds([]);
  //       return;
  //     }

  //     const results = await Promise.all(
  //       selectedStoreIds.map(async (storeId: string) => {
  //         const isLocked = await checkStoreLocked(
  //           storeId,
  //           id,
  //           userData.company_id
  //         );

  //         return isLocked ? storeId : null;
  //       })
  //     );

  //     const locked = results.filter(Boolean) as string[];

  //     console.log("Locked Stores:", locked);

  //     setLockedStoreIds(locked);
  //   };

  //   fetchLockedStores();
  // }, [id, selectedStoreIds, userData.company_id]);


  useEffect(() => {
    const fetchLockedStores = async () => {
      if (!id || id === 'pending' || selectedStoreIds.length === 0) {
        setLockedStores({});
        return;
      }

      const results = await Promise.all(
        selectedStoreIds.map(async (storeId: string) => {
          const lockInfo = await checkStoreLocked(
            storeId,
            id,
            userData.company_id
          );

          return {
            storeId,
            lockInfo,
          };
        })
      );

      const lockedMap: Record<
        string,
        {
          isAssignedTo: boolean;
          isApprovalUser: boolean;
        }
      > = {};

      results.forEach(({ storeId, lockInfo }) => {
        if (
          lockInfo &&
          (lockInfo.is_assigned_to ||
            lockInfo.is_approval_user)
        ) {
          lockedMap[storeId] = {
            isAssignedTo: lockInfo.is_assigned_to,
            isApprovalUser: lockInfo.is_approval_user,
          };
        }
      });

      console.log("Locked Stores:", lockedMap);

      setLockedStores(lockedMap);
    };

    fetchLockedStores();
  }, [id, selectedStoreIds, userData.company_id]);



  type StoreLockInfo = {
    is_assigned_to: boolean;
    is_approval_user: boolean;
  };

  const checkStoreLocked = async (
    storeId: string,
    userId: string,
    companyId: string
  ): Promise<StoreLockInfo | null> => {
    const { data, error } = await supabase.rpc(
      "get_locked_store_for_user" as any,
      {
        p_company_id: companyId,
        p_store_id: storeId,
        p_user_id: userId,
      }
    );

    console.log("LOCKED data", data);

    if (error) {
      console.error(error);
      return null;
    }

    return (data?.[0] as StoreLockInfo) ?? null;
  };

  // const CustomStoreMultiValueRemove = (props: any) => {
  // };




  useEffect(() => {
    const fetchStores = async () => {
      if (!userLocationIds.length) return;

      try {
        const { data: stores } = await supabase
          .from('store_mgmt')
          .select('id, name, location_id')
          .in('location_id', userLocationIds);

        if (!stores?.length) return;
        const storeIds = stores.map(store => store.id);

        const { data: workflows, error: workflowError } = await supabase
          .from('workflow_config')
          .select('store_id, approval_users')
          .in('store_id', storeIds);

        if (workflowError) {
          console.error('Error fetching workflows:', workflowError);
          return;
        }

        if (id && workflows.length > 0) {
          const matchingWorkflows = workflows?.filter(wf => Array.isArray(wf.approval_users) && wf.approval_users.includes(id)) || [];
          const matchingStoreIds = matchingWorkflows.map(wf => wf.store_id);
          const matchingStores = stores.filter(store => matchingStoreIds.includes(store.id));
          const lockedLocationIds = matchingStores.flatMap(store =>
            store.location_id ? [store.location_id] : []
          );
          if (lockedLocationIds.length > 0) {
            setLockedLocationIds(lockedLocationIds);
          }
        }

      } catch (error) {
        console.error('Error fetching stores:', error);
      }
    };

    fetchStores();
  }, [userLocationIds]);

  //  useEffect(() => {
  //   console.log("current user role id", watch('role'))
  //   if (!watch('role')) return;
    
  //   const{data:role } = supabase
  //       .from('role_master')
  //       .select('id,name')
  //       .eq('id', currentUser.role_id)
  //       .eq('company_id', userData.company_id)
  //       .single()

  //         console.log("role data",role)
        
  // }, [])

  const generateEmployeeId = async (): Promise<string | null> => {
    if (!employeeIdConfig?.autoGenerate) return null;
    try {
      const { data: existingUsers, error } = await supabase
        .from('user_mgmt')
        .select('employee_id')
        .eq('company_id', userData.company_id)
        .not('employee_id', 'is', null);

      if (error) return `${employeeIdConfig.prefix}${String(employeeIdConfig.startingSequence).padStart(4, '0')}`;

      const prefix = employeeIdConfig.prefix;
      const existingNumbers: number[] = [];
      if (existingUsers && existingUsers.length > 0) {
        existingUsers.forEach((u: any) => {
          if (u.employee_id && typeof u.employee_id === 'string' && u.employee_id.startsWith(prefix)) {
            const num = parseInt(u.employee_id.substring(prefix.length), 10);
            if (!isNaN(num)) existingNumbers.push(num);
          }
        });
      }
      let nextNumber = employeeIdConfig.startingSequence;
      if (existingNumbers.length > 0) {
        nextNumber = Math.max(Math.max(...existingNumbers) + 1, employeeIdConfig.startingSequence);
      }
      return `${prefix}${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating employee ID:', error);
      return `${employeeIdConfig.prefix}${String(employeeIdConfig.startingSequence).padStart(4, '0')}`;
    }
  };

  const checkEmployeeIdExists = async (employeeId: string, excludeUserId?: string): Promise<boolean> => {
    if (!employeeId || !employeeId.trim()) return false;
    try {
      let query = supabase
        .from('user_mgmt')
        .select('id, employee_id')
        .eq('company_id', userData.company_id)
        .eq('employee_id', employeeId.trim())
        .eq('is_active', true);
      if (excludeUserId) query = query.neq('id', excludeUserId);
      const { data, error } = await query;
      if (error) { console.error('Error checking employee ID:', error); return false; }
      return (data && data.length > 0);
    } catch (error) {
      console.error('Unexpected error checking employee ID:', error);
      return false;
    }
  };

  const validateEmployeeIdUniqueness = async (employeeId: string): Promise<boolean | string> => {
    if (!isEditing && employeeIdConfig?.autoGenerate) return true;
    if (!employeeId || !employeeId.trim()) return true;
    if (isEditing && currentUser?.employee_id === employeeId) return true;
    const exists = await checkEmployeeIdExists(employeeId, isEditing ? id : undefined);
    if (exists) return `Employee ID "${employeeId}" already exists for this company`;
    return true;
  };

  const handleEmployeeIdBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const employeeId = e.target.value?.trim();
    if (!isEditing && employeeIdConfig?.autoGenerate) return;
    if (!employeeId) return;
    if (isEditing && currentUser?.employee_id === employeeId) { clearErrors('employee_id'); return; }
    const exists = await checkEmployeeIdExists(employeeId, isEditing ? id : undefined);
    if (exists) {
      setFormError('employee_id', { type: 'manual', message: `Employee ID "${employeeId}" already exists for this company` }, { shouldFocus: true });
    } else {
      clearErrors('employee_id');
    }
  };

  const onSubmit = async (data: UserFormValues) => {
    setError('');
    setFormStatus('submitting');
    try {
      setIsLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const currentAccessToken = session?.access_token;

      const selectedRole = allRoles.find((role) => role.id === data.role);
      if (!selectedRole) throw new Error('Selected role not found');

      let finalEmployeeId: string | null = null;
      if (!isEditing) {
        if (employeeIdConfig?.autoGenerate) {
          finalEmployeeId = await generateEmployeeId();
        } else {
          finalEmployeeId = data.employee_id && data.employee_id.trim() ? data.employee_id.trim() : null;
        }
      } else {
        finalEmployeeId = data.employee_id && data.employee_id.trim() ? data.employee_id.trim() : null;
      }

      if (!finalEmployeeId || !finalEmployeeId.trim()) {
        setFormError('employee_id', { type: 'manual', message: 'Employee ID is required' });
        throw new Error('Employee ID is required');
      }

      const employeeIdExists = await checkEmployeeIdExists(finalEmployeeId, isEditing ? id : undefined);
      if (employeeIdExists) {
        setFormError('employee_id', { type: 'manual', message: `Employee ID "${finalEmployeeId}" already exists for this company` });
        throw new Error(`Employee ID "${finalEmployeeId}" already exists for this company`);
      }

      let checkQuery = supabase.from('user_mgmt').select('id, email').or(`email.eq.${data.email}`);
      if (isEditing && id) checkQuery = checkQuery.neq('id', id);
      const { data: existingUsers, error: checkError } = await checkQuery;
      if (checkError) throw checkError;
      if (existingUsers && existingUsers.length > 0) {
        if (existingUsers[0].email === data.email) throw new Error('Email already exists');
      }

      let imageMetadata: ImageMetadata | null = null;
      let existingImageMetadata: ImageMetadata | null = null;

      if (isEditing && id) {
        const { data: userData2, error: fetchError } = await supabase.from('user_mgmt').select('image').eq('id', id).single();
        if (fetchError) throw fetchError;
        existingImageMetadata = userData2.image as ImageMetadata | null;
      }

      if (imageRemoved && existingImageMetadata?.path) {
        try {
          const res = await fetch(`${supabaseUrl}functions/v1/delete-profile-image`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
            body: JSON.stringify({ filePath: existingImageMetadata.path })
          });
          const result = await res.json();
          if (!res.ok) console.error('Error deleting image:', result.error || result.message);
          imageMetadata = null;
        } catch (err: any) {
          console.error('Error while deleting image:', err.message || err);
        }
      } else if (data.image instanceof File) {
        if (existingImageMetadata?.path) {
          try {
            const res = await fetch(`${supabaseUrl}functions/v1/delete-profile-image`, {
              method: "POST",
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
              body: JSON.stringify({ filePath: existingImageMetadata.path })
            });
            const result = await res.json();
            if (!res.ok) console.error('Error deleting old image:', result.error || result.message);
          } catch (err: any) {
            console.error('Error while deleting old image:', err.message || err);
          }
        }
        const fileExt = data.image.name.split('.').pop();
        const fileName = `${data.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('profile-picture').upload(fileName, data.image);
        if (uploadError) throw new Error(uploadError.message);
        imageMetadata = { name: data.image.name, type: data.image.type, size: data.image.size, path: fileName };
      } else if (existingImageMetadata && !imageRemoved) {
        imageMetadata = existingImageMetadata;
      }
      const actionName = isEditing ? "Edit" : "Add";
      const moduleKey = 'Users';
      const operations: any[] = [];
      const validations: any[] = [];

      if (finalEmployeeId) {
        validations.push({
          type: 'unique',
          table: 'user_mgmt',
          column: 'employee_id',
          value: finalEmployeeId,
          ignore_id: isEditing ? id : undefined
        });
      }

      let updatePayload: any = null;
      let createPayload: any = null;

      if (isEditing) {
        const newPassword = resetPassword ? data.password : undefined;

        const userLocalTime = new Date();
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const modified_at = userLocalTime.toLocaleString('en-US', {
          timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const [datePart, timePart] = modified_at.split(', ');
        const [month, day, year] = datePart.split('/');
        const isoTimestamp = `${year}-${month}-${day}T${timePart}.000`;

        updatePayload = {
          company_id: userData.company_id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role_id: selectedRole.id,
          department_id: data.department ?? null,
          employee_location_id: data.employee_location_id ?? null,
          employee_id: finalEmployeeId,
          locations: data.locations && data.locations.length > 0 ? data.locations : null,
          stores: data.stores?.length ? data.stores : null,
          status: data.status,
          is_active: true,
          modified_at: isoTimestamp,
          image: imageMetadata,
        };

        if (newPassword || data.email !== currentUser?.email) {
            operations.push({
              type: "auth_user_update",
              user_id: id,
              data: {
                email: data.email,
                password: newPassword,
                user_metadata: { first_name: data.firstName, last_name: data.lastName }
              }
            });
        }

        operations.push({
          type: "update",
          table: "user_mgmt",
          match: { id: id },
          data: updatePayload
        });

        operations.push({
          type: "insert",
          table: "system_log",
          data: {
            company_id: userData.company_id,
            transaction_date: new Date().toISOString(),
            module: 'User Management',
            scope: 'Edit',
            key: `${data.email}`,
            log: `User: ${data.email} updated.`,
            action_by: userData.id,
            created_at: new Date().toISOString(),
          }
        });

      } else {
        createPayload = {
          company_id: userData.company_id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role_id: selectedRole.id,
          department_id: data.department ?? null,
          employee_location_id: data.employee_location_id ?? null,
          employee_id: finalEmployeeId,
          locations: data.locations && data.locations.length > 0 ? data.locations : null,
          stores: data.stores?.length ? data.stores : null,
          status: data.status,
          is_active: true,
          created_at: new Date().toISOString(),
          image: imageMetadata,
          default_password: true,
          id: "{{new_user_id}}"
        };

        operations.push({
           type: "auth_user_create",
           data: {
              email: data.email,
              password: data.password,
              email_confirm: true,
              user_metadata: { first_name: data.firstName, last_name: data.lastName }
           },
           return_id_as: "new_user_id"
        });

        operations.push({
           type: "insert",
           table: "user_mgmt",
           data: createPayload
        });

        operations.push({
          type: "insert",
          table: "system_log",
          data: {
            company_id: userData.company_id,
            transaction_date: new Date().toISOString(),
            module: 'User Management',
            scope: 'Add',
            key: `${data.email}`,
            log: `User: ${data.email} created.`,
            action_by: userData.id,
            created_at: new Date().toISOString(),
          }
        });
      }

      // Submit via generic framework
      const res = await initiateApprovalRequest({
          module_name: moduleKey,
          action_name: actionName,
          company_id: userData.company_id,
          requested_by: userData.id,
          action_payload: { operations, validations }
      });

      if (res.requires_approval === false) {
          // No approval workflow exists. Continue the process normally like before!
          if (isEditing) {
              const newPassword = resetPassword ? data.password : undefined;
              const edgeRes = await fetch(`${supabaseUrl}functions/v1/update-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAccessToken}` },
                body: JSON.stringify({ id, email: data.email, password: newPassword }),
              });
              if (!edgeRes.ok) throw new Error('Failed to update auth user');
              if (!id) throw new Error("No ID provided");

              const { error: updateError } = await supabase.from('user_mgmt').update(updatePayload).eq('id', id);
              if (updateError) throw updateError;

              const loggedInUser = JSON.parse(localStorage.getItem("userData") || "{}");
              if (loggedInUser?.id === id) {
                  const updatedUserData = {
                    ...loggedInUser,
                    stores: updatePayload.stores ?? [],
                    locations: updatePayload.locations ?? [],
                  };
                  localStorage.setItem("userData", JSON.stringify(updatedUserData));
                  dispatch(setUser(updatedUserData));
              }

              await supabase.from('system_log').insert({
                company_id: userData.company_id,
                transaction_date: new Date().toISOString(),
                module: 'User Management',
                scope: 'Edit',
                key: `${data.email}`,
                log: `User: ${data.email} updated.`,
                action_by: userData.id,
                created_at: new Date().toISOString(),
              });

              toast.success('User updated successfully!');
          } else {
              const edgeRes = await fetch(`${supabaseUrl}functions/v1/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAccessToken}` },
                body: JSON.stringify({ email: data.email, password: data.password }),
              });
              const edgeData = await edgeRes.json();
              if (!edgeRes.ok) throw new Error(edgeData.error || 'Failed to create auth user');

              const userId = edgeData.user_id;
              if (userId) {
                createPayload.id = userId; // Override placeholder ID
                const { error: createError } = await supabase.from('user_mgmt').insert(createPayload);
                if (createError) throw createError;

                await supabase.from('system_log').insert({
                  company_id: userData.company_id,
                  transaction_date: new Date().toISOString(),
                  module: 'User Management',
                  scope: 'Add',
                  key: `${data.email}`,
                  log: `User: ${data.email} created.`,
                  action_by: userData.id,
                  created_at: new Date().toISOString(),
                });

                toast.success('User created successfully!');
              }
          }
      } else {
          toast.success('Your action has been submitted and is currently pending approval.');
      }

      setFormStatus('success');
      setTimeout(() => navigate('/dashboard/users'), 1500);
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(error.message || 'An error occurred');
      setFormStatus('error');
      toast.error(error.message || 'Failed to save user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!isEditing || !id) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('user_mgmt').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast.success('User deleted successfully!');
      navigate('/dashboard/users');
    } catch (error: any) {
      console.error('Delete user error:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleFormSubmit = async (data: UserFormValues) => {
    console.log(" SUBMIT FIRED", data);
    await onSubmit(data);
  };

  if (isLoading && isEditing && !currentUser) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading user data...</p>
      </div>
    );
  }



  function generateDefaultPassword() {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const specialChars = "!@#$%^&*()_+[]{}|;:,.<>?";
    const mandatory = [
      uppercase[Math.floor(Math.random() * uppercase.length)],
      lowercase[Math.floor(Math.random() * lowercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specialChars[Math.floor(Math.random() * specialChars.length)],
    ];
    const allChars = uppercase + lowercase + numbers;
    const remaining = Array.from({ length: 6 }, () => allChars[Math.floor(Math.random() * allChars.length)]);
    const fullPassword = [...mandatory, ...remaining];
    for (let i = fullPassword.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fullPassword[i], fullPassword[j]] = [fullPassword[j], fullPassword[i]];
    }
    return fullPassword.join("");
  }

  const handleCopyPwd = () => {
    if (!passwordValue) return;
    navigator.clipboard.writeText(passwordValue).catch(console.error);
    setCopyPassword(true);
    setTimeout(() => setCopyPassword(false), 3000);
  };

  const handleUnlockUser = async () => {
    if (!id || !currentUser) return;
    const timestamp = new Date().toISOString();
    try {
      const { error } = await supabase.from('user_mgmt').update({ status: 'active', failed_attempts: null }).eq('id', id).single();
      if (error) throw error;
      await supabase.from('system_log').insert({
        company_id: userData.company_id,
        transaction_date: timestamp,
        module: 'User Management',
        scope: 'Account Unlock',
        key: `${currentUser?.email}`,
        log: `User account: ${currentUser?.email} unlocked.`,
        action_by: userData.id,
        created_at: timestamp,
      });
      toast.success("User account unlocked successfully!");
      await getUserDetails();
    } catch (err) {
      console.error("Error unlocking user account:", err);
    } finally {
      setIsDialogOpen(false);
    }
  };

  const pageTitle = isViewMode ? "View User" : isEditing ? "Update User" : "Add New User";
  const pageDescription = isViewMode
    ? "View user details and account information"
    : isEditing
      ? 'Update user details and manage account status'
      : 'Create or update inventory user details';

  const CustomLocMultiValueRemove = (props: any) => {
    if(isViewMode) return;

    const isApproverLocked = lockedLocationIds.includes(props.data.value);
    const isStoreAssigned = assignedLocationIds.includes(props.data.value);

    if (!isApproverLocked && !isStoreAssigned) {
      return <components.MultiValueRemove {...props} />;
    }

    let message = "";

    if (isApproverLocked) {
      message = "Cannot remove. User is assigned as an approver for this location.";
    } else if (isStoreAssigned) {
      message = "Cannot remove. This location is assigned to a store.";
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="px-1 flex items-center text-[#8f9093] cursor-not-allowed">
            <X className="h-3 w-3 stroke-[3]" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const CustomStoreMultiValueRemove = (props: any) => {
  if(isViewMode) return;
    const isWorkflowLocked = lockedStoreIds.includes(String(props.data.value));

    if (!isWorkflowLocked) {
      return <components.MultiValueRemove {...props} />;
    }

    let message = "";

    if (isWorkflowLocked) {
      message = "Cannot remove. Active workflows exist for this store.";
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="px-1 flex items-center text-[#8f9093] cursor-not-allowed">
            <X className="h-3 w-3 stroke-[3]" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <PendingApprovalBanner />
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
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
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
                  <p className="text-gray-600">{pageDescription}</p>
                </div>
              </div>
            </div>
            {isUserLocked && (
              <Button className="transition-colors flex items-center gap-2 me-5" onClick={() => setIsDialogOpen(true)}>
                <Unlock className="h-4 w-4" /> Unlock Account
              </Button>
            )}
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Account Unlock</DialogTitle>
              <DialogDescription>Are you sure you want to unlock this user account?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>No</Button>
              </DialogClose>
              <Button className="transition-colors flex items-center" onClick={handleUnlockUser}>Yes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteUser}
          title="Are you sure?"
          description={`This action cannot be undone. This will permanently delete the user account for ${currentUser?.first_name} ${currentUser?.last_name} and remove all associated data.`}
          isLoading={isDeleting}
        />

        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">User Information</CardTitle>
            <CardDescription className="text-blue-600">
              {!isViewMode && (
                isEditing
                  ? 'Update the user details below'
                  : 'Fill in the user details below to create a new account'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(
              handleFormSubmit,
              (errors) => console.log("VALIDATION ERRORS", errors)
            )} className="space-y-6">

              {/* Profile Photo */}
              <div className="space-y-2 group">
                <Label className={`${errors.image ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                  <Camera className="h-4 w-4" /> Profile Photo
                  {!isViewMode && <span className="text-gray-400 font-normal">(JPG/PNG, max 5MB)</span>}
                </Label>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {imagePreview ? (
                      <div className="relative w-32 h-32 border-2 border-gray-200 rounded-full overflow-hidden">
                        <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center bg-gray-50">
                        <Camera className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    {!isViewMode && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex gap-2">
                        <label htmlFor="image" className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors duration-200">
                          <Camera className="h-4 w-4" />
                          <input id="image" type="file" accept=".jpg,.jpeg,.png" onChange={handleImageChange} className="hidden" ref={fileInputRef} />
                        </label>
                        {imagePreview && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors duration-200"
                                aria-label="Remove profile photo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Remove profile photo</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.image?.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors.image.message as string}
                    </p>
                  )}
                  {!isViewMode && (
                    <p className="text-xs text-gray-500 text-center max-w-xs">
                      Upload a professional photo. Recommended: Square image, at least 200x200 pixels.
                    </p>
                  )}
                </div>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="firstName" className={`${errors.firstName ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <User className="h-4 w-4" /> First Name {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    {...register('firstName')}
                    disabled={isViewMode}
                    className={`${errors.firstName ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.firstName ? 'border-blue-300' : ''}`}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="lastName" className={`${errors.lastName ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <User className="h-4 w-4" /> Last Name {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    {...register('lastName')}
                    disabled={isViewMode}
                    className={`${errors.lastName ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.lastName ? 'border-blue-300' : ''}`}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email & Employee Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="email" className={`${errors.email ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <Mail className="h-4 w-4" /> Email Address {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    {...register('email')}
                    disabled={isViewMode}
                    className={`${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.email ? 'border-blue-300' : ''}`}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.email.message}
                    </p>
                  )}
                </div>

                {/* ✅ Employee Location — shows inactive selected location in edit/view */}
                <div className="space-y-2 group">
                  <Label htmlFor="employee_location_id" className={`${errors.employee_location_id ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <MapPin className="h-4 w-4" /> Employee Location {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    onValueChange={(value) => setValue('employee_location_id', value, { shouldValidate: true, shouldDirty: true })}
                    value={watch('employee_location_id') || ''}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={`${errors.employee_location_id ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${watchedFields.employee_location_id ? 'border-blue-300' : ''}`}>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {allLocations.length > 0 ? (
                        allLocations
                          .filter(loc => loc.id && loc.location_name)
                          .map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.location_name}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="_none" disabled>No active locations available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.employee_location_id && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.employee_location_id.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Employee ID */}
              <div className="space-y-2 group">
                <Label htmlFor="employee_id" className={`${errors.employee_id ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                  <User className="h-4 w-4" /> Employee ID {!isViewMode && <span className="text-red-500">*</span>}
                  {!isViewMode && employeeIdConfig?.autoGenerate && (
                    <span className="text-xs text-gray-500 font-normal ml-2">(Auto-generated)</span>
                  )}
                  {!isViewMode && !employeeIdConfig?.autoGenerate && (
                    <span className="text-xs text-gray-500 font-normal ml-2">(Manual entry)</span>
                  )}
                </Label>
                <Input
                  id="employee_id"
                  placeholder={employeeIdConfig?.autoGenerate && !isEditing ? "Will be auto-generated" : "Enter employee ID"}
                  {...register('employee_id', {
                    validate: validateEmployeeIdUniqueness,
                    onBlur: handleEmployeeIdBlur,
                  })}
                  disabled={isViewMode || isEditing || (employeeIdConfig?.autoGenerate && !isEditing)}
                  value={watch('employee_id') || ''}
                  readOnly={isViewMode || isEditing || (employeeIdConfig?.autoGenerate && !isEditing)}
                  className={`${errors.employee_id ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${watchedFields.employee_id ? 'border-blue-300' : ''} ${(isViewMode || isEditing || (employeeIdConfig?.autoGenerate && !isEditing)) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {errors.employee_id && (
                  <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />{errors.employee_id.message}
                  </p>
                )}
                {employeeIdConfig?.autoGenerate && !isEditing && !isViewMode && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {watch('employee_id')
                      ? `Employee ID has been auto-generated: ${watch('employee_id')}`
                      : 'Employee ID will be automatically generated when you create this user.'}
                  </p>
                )}
                {!employeeIdConfig?.autoGenerate && !isViewMode && !isEditing && (
                  <p className="text-xs text-gray-500">Enter a unique employee ID for this user (required).</p>
                )}
                {(isViewMode || isEditing) && (
                  <p className="text-xs text-gray-500">
                    Employee ID cannot be modified {isViewMode ? 'in view mode' : 'when editing'}.
                  </p>
                )}
              </div>

              {/* Password */}
              {!isViewMode && (!isEditing || (isEditing && resetPassword)) && (
                <div className="space-y-2 group">
                  <Label htmlFor="password" className={`${errors.password ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <Key className="h-4 w-4" /> Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-full">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password"
                        {...register('password')}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className={`${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-10 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${passwordValue ? 'border-blue-300' : ''}`}
                      />
                      {(isFocused || passwordValue) && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleCopyPwd}
                          disabled={!passwordValue}
                          className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Copy password"
                        >
                          {copyPassword ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p>{copyPassword ? 'Copied!' : 'Copy to Clipboard'}</p></TooltipContent>
                    </Tooltip>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.password.message}
                    </p>
                  )}
                </div>
              )}

              {/* ✅ Role & Department — both show inactive selected value in edit/view */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="role" className={`${errors.role ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <UserCog className="h-4 w-4" /> Role {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    onValueChange={(value) => setValue('role', value)}
                    value={watch('role')}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={`${errors.role ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${watchedFields.role ? 'border-blue-300' : ''}`}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRoles.length > 0 ? (
                        allRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>No active roles available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.role.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="department" className={`${errors.department ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <Building2 className="h-4 w-4" /> Department {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    onValueChange={(value) => setValue('department', value)}
                    value={watch('department') || ''}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={`${errors.department ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${watchedFields.department ? 'border-blue-300' : ''}`}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDepartments.length > 0 &&
                        allDepartments.filter(dept => dept.id && dept.department_name).map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.department.message}
                    </p>
                  )}
                </div>
              </div>

              {/* ✅ Locations multi-select — shows inactive assigned locations in edit/view */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 group">
                  <Label htmlFor="locations" className={`${errors.locations ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <MapPin className="h-4 w-4" /> Locations to Authorize {!isViewMode && <span className="text-red-500">*</span>}
                  </Label>
                  <ReactSelect
                    isMulti
                    isDisabled={isViewMode}
                    components={{
                      MultiValueRemove: CustomLocMultiValueRemove,
                    }}
                    options={locationOptions}
                    isOptionDisabled={(option) => option.isDisabled}

                    value={(() => {
                      const locationsArray = watch('locations') || [];
                      if (!Array.isArray(locationsArray)) return [];
                      return locationsArray.map(locationId => {
                        const isAssigned =
                          assignedLocationIds.includes(locationId);
                        const location = allLocations.find(loc => loc.id === locationId);
                        if (!location) return { value: locationId, label: `Location ${locationId}`, isDisabled: isAssigned };
                        return { value: location.id, label: location.location_name, isDisabled: isAssigned };
                      }).filter(Boolean);
                    })()}
                    onChange={(selectedOptions) => {
                      const selected = selectedOptions || [];
                      if (selected.some(option => option.value === "ALL")) {
                        setValue("locations", allLocations.map(location => location.id),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          }
                        );
                        return;
                      }
                      const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];

                      // Prevent removal of locked locations
                      lockedLocationIds.forEach(id => {
                        if (!selectedIds.includes(id)) {
                          selectedIds.push(id);
                        }
                      });

                      setValue('locations', selectedIds, { shouldDirty: true, shouldValidate: true });
                    }}
                    placeholder={isViewMode ? "No locations assigned" : "Select locations..."}
                    className="basic-multi-select"
                    classNamePrefix="select"
                    noOptionsMessage={() => "No active locations available"}
                    isSearchable={!isViewMode}
                    isClearable={false}
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    styles={{
                      control: (provided: any) => ({
                        ...provided,
                        minHeight: '40px',
                        borderColor: errors.locations ? '#f87171' : '#e5e7eb',
                        backgroundColor: isViewMode ? '#f9fafb' : 'white',
                        '&:hover': { borderColor: errors.locations ? '#f87171' : '#3b82f6' },
                        boxShadow: errors.locations ? '0 0 0 1px #f87171' : 'none',
                      }),
                      indicatorsContainer: (provided: any) => ({ ...provided, height: '40px' }),
                      valueContainer: (provided: any) => ({ ...provided, padding: '0 6px', maxHeight: '100px', overflowY: 'auto' }),
                      input: (provided: any) => ({ ...provided, margin: '0px', padding: '0' }),
                      multiValue: (provided: any) => ({ ...provided, backgroundColor: '#dbeafe', margin: '2px' }),
                      multiValueLabel: (provided: any) => ({ ...provided, color: '#1e40af', fontSize: '0.875rem' }),
                      multiValueRemove: (provided: any) => ({
                        ...provided,
                        color: '#1e40af',
                        display: isViewMode ? 'none' : 'flex',
                        '&:hover': { backgroundColor: '#3b82f6', color: 'white' },
                      }),
                    }}
                  />
                  {errors.locations && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.locations.message}
                    </p>
                  )}
                  {!isViewMode && (
                    <p className="text-sm text-gray-500">Select one or more locations this user can access</p>
                  )}
                </div>


                <div className="space-y-2 group">
                  <Label htmlFor="role" className={`${errors.role ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <Store className="h-4 w-4" />
                    Store <span className="text-red-500">*</span>
                  </Label>



                  <ReactSelect

                    isDisabled={isViewMode || selectedLocations.length === 0}
                    isMulti
                    components={{
                      MultiValueRemove: CustomStoreMultiValueRemove,
                    }}
                    options={[
                      { value: "ALL", label: "Select All Stores" },
                      ...stores.map(store => ({
                        value: String(store.id),
                        label: store.name,
                        isDisabled: lockedStoreIds.includes(String(store.id)),
                      })),
                    ]}


                    value={(watch("stores") || []).map(storeId => {
                      const store = stores.find(
                        s => String(s.id) === String(storeId)
                      );

                      return {
                        value: String(storeId),
                        label: store?.name || String(storeId),
                      };
                    })}
                    onChange={(selectedOptions) => {
                      const selected = selectedOptions || [];

                      if (selected.some(option => option.value === "ALL")) {
                        setValue(
                          "stores",
                          stores.map(store => store.id),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          }
                        );

                        return;
                      }

                      const selectedIds = selected.map(option => option.value);

                      // Prevent removal of locked stores
                      lockedStoreIds.forEach(id => {
                        if (!selectedIds.includes(String(id))) {
                          selectedIds.push(String(id));
                        }
                      });

                      setValue("stores", selectedIds, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    placeholder="Select Stores..."
                    closeMenuOnSelect={false}

                    styles={{
                      control: (provided: any) => ({
                        ...provided,
                        minHeight: '40px',
                        borderColor: errors.stores ? '#f87171' : '#e5e7eb',
                        backgroundColor: isViewMode ? '#f9fafb' : 'white',
                        '&:hover': {
                          borderColor: errors.stores ? '#f87171' : '#3b82f6'
                        },
                        boxShadow: errors.stores ? '0 0 0 1px #f87171' : 'none',
                      }),

                      indicatorsContainer: (provided: any) => ({
                        ...provided,
                        height: '40px',
                      }),

                      valueContainer: (provided: any) => ({
                        ...provided,
                        padding: '0 6px',
                        maxHeight: '100px',
                        overflowY: 'auto',
                      }),

                      input: (provided: any) => ({
                        ...provided,
                        margin: '0px',
                        padding: '0',
                      }),

                      // Selected chips
                      multiValue: (provided: any) => ({
                        ...provided,
                        backgroundColor: '#dbeafe',
                        margin: '2px',
                      }),

                      multiValueLabel: (provided: any) => ({
                        ...provided,
                        color: '#1e40af',
                        fontSize: '0.875rem',
                      }),

                      multiValueRemove: (provided: any) => ({
                        ...provided,
                        color: '#1e40af',
                        display: isViewMode ? 'none' : 'flex',
                        '&:hover': {
                          backgroundColor: '#3b82f6',
                          color: 'white',
                        },
                      }),

                      // Dropdown selected option
                      option: (provided: any, state: any) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#3b82f6'
                          : state.isFocused
                            ? '#dbeafe'
                            : 'white',
                        color: state.isSelected ? 'white' : '#111827',
                      }),
                    }}

                    className="basic-multi-select"
                    classNamePrefix="select"
                    isSearchable={!isViewMode}
                    isClearable={false}
                    hideSelectedOptions={false}
                    noOptionsMessage={() => "No stores available"}
                  />

                  {errors.stores && (
                    <p className="text-sm text-red-500">
                      {errors.stores.message}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-2 group">
                  <Label htmlFor="status" className={`${errors.status ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}>
                    <UserCog className="h-4 w-4" /> Status
                  </Label>
                  <Select
                    onValueChange={(value) => {
                      setValue('status', value as 'active' | 'inactive');
                      setCurrentStatus(value as 'active' | 'inactive');
                    }}
                    value={watchedFields.status}
                    disabled={isViewMode}
                  >
                    <SelectTrigger className={`${errors.status ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${getStatusColor(watchedFields.status)}`}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {['active', 'inactive'].map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getStatusDotColor(status)}`}></span>
                            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.status && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />{errors.status.message}
                    </p>
                  )}
                </div>
              </div>

             { ((isViewMode || isEditing) && selectedRole !== 'Administrator' && selectedRole !== 'Super Admin') && (
                <Card>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setShowPermissions(!showPermissions)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <ShieldCheck className="h-5 w-5 text-blue-600" />
                      <span className='text-slate-600'> Module Permissions</span>
                    </CardTitle>

                    {showPermissions ? (
                      <ChevronDown className="h-7 w-7 p-1 hover:bg-slate-100 rounded-full text-gray-500" />
                    ) : (
                      <ChevronRight className="h-7 w-7 p-1 hover:bg-slate-100 rounded-full text-gray-500" />
                    )}
                  </div>
                </CardHeader>

                {showPermissions && (
                  <CardContent className="pt-0">

                    {permissionTree.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 text-gray-700 border rounded-lg">
                        No permissions assigned for this user
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">

                        <div className="grid grid-cols-12 bg-[#fdfdfd] border-b px-4 py-3 font-medium text-gray-700">
                          <div className="col-span-3">
                            Modules
                          </div>

                          <div className="col-span-9">
                            Permitted Actions
                          </div>
                        </div>

                        {permissionTree.map((parent: any) => (
                          <div
                            key={parent.parentModuleId}
                            className="border-b last:border-b-0"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedParents(prev =>
                                  prev.includes(parent.parentModuleId)
                                    ? prev.filter(
                                      id => id !== parent.parentModuleId
                                    )
                                    : [...prev, parent.parentModuleId]
                                )
                              }
                              className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                {expandedParents.includes(
                                  parent.parentModuleId
                                ) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}

                                <span className="font-semibold text-gray-800">
                                  {parent.parentModule}
                                </span>

                                <span className="text-sm text-gray-500">
                                  {parent.modules.length} modules
                                </span>
                              </div>
                            </button>

                            {expandedParents.includes(
                              parent.parentModuleId
                            ) && (
                                <div>
                                  {parent.modules.map((module: any) => (
                                    <div
                                      key={module.moduleId}
                                      className="grid grid-cols-12 px-4 py-3 border-t"
                                    >
                                      <div className="col-span-3">
                                        <span className="font-medium text-gray-700">
                                          {module.moduleName}
                                        </span>
                                      </div>

                                      <div className="col-span-9 flex flex-wrap gap-2">
                                        {module.permissions.length > 0 ? (
                                          module.permissions.map(
                                            (permission: any) => (
                                              <span
                                                key={permission.actionId}
                                                className={`px-3 py-1 rounded-md text-xs font-medium border
                                  ${permission.requiredWorkflow
                                                    ? "bg-green-100 text-green-700 border-green-200"
                                                    : "bg-blue-100 text-blue-700 border-blue-200"
                                                  }`}
                                              >
                                                {permission.actionName}
                                              </span>
                                            )
                                          )
                                        ) : (
                                          <span className="text-sm text-gray-400">
                                            No actions
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
              )}


              {/* Footer Actions */}
              {!isViewMode && (
                <div className="pt-4 flex items-center">
                  {isEditing && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={resetPassword}
                        onCheckedChange={() => setResetPassword(prev => !prev)}
                        className="border-gray-300 text-blue-600 cursor-pointer focus:ring-blue-500"
                      />
                      <Label className="text-sm hover:text-blue-600 transition-colors cursor-pointer">Reset Password</Label>
                    </div>
                  )}

                  <div className="ml-auto flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/dashboard/users')}
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || isLoading || formStatus === 'success'}
                      className={`${formStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg`}
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
                          {isEditing ? (
                            <><CheckCircle className="h-4 w-4" /> Update User</>
                          ) : (
                            <><UserPlus className="h-4 w-4" /> Create User</>
                          )}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

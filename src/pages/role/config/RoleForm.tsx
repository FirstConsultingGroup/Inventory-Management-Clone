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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { getLocalDateTime, initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';

interface IRole {
  id: string;
  role_id: string | null;
  name: string | null;
  description: string | null;
  status: boolean | null;
  is_active: boolean | null;
  company_id: string;
  created_at: string;
}

const createRoleSchema = () =>
  z.object({
    role_id: z
      .string()
      .min(1, "Role ID is required")
      .max(50, "Role ID cannot exceed 50 characters")
      .trim()
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Role ID can only contain letters, numbers, hyphens, and underscores"
      ),
    name: z
      .string()
      .min(1, "Role name is required")
      .max(100, "Role name cannot exceed 100 characters")
      .trim(),
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),
    status: z.boolean(),
  });

type RoleFormData = z.infer<ReturnType<typeof createRoleSchema>>;

interface UserData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  status: string;
  company_id: string;
  role_name: string;
  full_name: string;
}

const RoleForm = () => {
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const navigate = useNavigate();
  const [_, setRole] = useState<IRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingUserRole, setIsLoadingUserRole] = useState(true);

  const formRef = useRef<HTMLFormElement>(null);

  const actualMode =
    mode || (id && (id === "edit" || id === "view" || id === "add") ? id : undefined);
  const actualId = actualMode === id ? undefined : id;

  const isEditing =
    Boolean(actualId) &&
    (actualMode === "edit" || window.location.pathname.includes("/edit/"));
  const isViewing =
    Boolean(actualId) &&
    (actualMode === "view" || window.location.pathname.includes("/view/"));

  // const isAdmin =
  //   userRole?.toLowerCase() === "super admin" ||
  //   userRole?.toLowerCase() === "administrator";

  const getDefaultValues = useCallback(
    (): RoleFormData => ({
      role_id: "",
      name: "",
      description: "",
      status: true,
    }),
    []
  );

  const roleSchema = createRoleSchema();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: getDefaultValues(),
  });

  // Load user data
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
          throw new Error("User data not found");
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        toast.error("Failed to load user data. Please log in again.", {
          position: "top-center",
        });
        navigate("/login");
      } finally {
        setIsLoadingUserRole(false);
      }
    };
    loadUserData();
  }, [navigate]);

  // // Access check
  // useEffect(() => {
  //   if (isLoadingUserRole) return;
  //   if (!isAdmin && (isEditing || (!actualId && !actualMode))) {
  //     toast.error("Only administrators can create or edit roles.", {
  //       position: "top-center",
  //     });
  //     navigate("/dashboard/role-master");
  //   }
  // }, [isAdmin, isEditing, actualId, actualMode, navigate, isLoadingUserRole]);

  // Load role if editing/viewing
  useEffect(() => {
    if (!actualId || !companyId) return;

    setIsLoadingRole(true);
    const loadRole = async () => {
      try {
        let data: any = null;
        if (actualId === 'pending') {
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
            const roleOp = operations.find((op: any) => op.table === 'role_master');
            
            if (roleOp) {
                if (requestData.entity_id) {
                    const { data: dbData, error: dbError } = await supabase
                        .from('role_master')
                        .select('*')
                        .eq('id', requestData.entity_id)
                        .single();
                    if (!dbError && dbData) {
                        data = { ...dbData, ...(roleOp.data || {}) };
                    } else {
                        data = roleOp.data || {};
                    }
                } else {
                    data = roleOp.data || {};
                }
            } else {
                throw new Error('Role data not found in approval request payload');
            }
        } else {
            const { data: dbData, error } = await supabase
              .from("role_master")
              .select("*")
              .eq("id", actualId)
              .eq("company_id", companyId)
              .single();

            if (error) throw error;
            data = dbData;
        }

        setRole(data as any);
        if (data) {
          reset({
            role_id: data.role_id || "",
            name: data.name || "",
            description: data.description || "",
            status: data.status ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading role:", error);
        toast.error("Failed to load role data", { position: "top-center" });
        navigate("/dashboard/role-master");
      } finally {
        setIsLoadingRole(false);
      }
    };
    loadRole();
  }, [actualId, reset, companyId, navigate]);

  // Validate uniqueness of role_id and name on submit
  const validateUniqueness = async (data: RoleFormData): Promise<boolean> => {
    let hasError = false;

    // --- Role ID uniqueness (add mode only, since it's locked in edit) ---
    if (!isEditing) {
      try {
        const { data: existingById, error } = await supabase
          .from("role_master")
          .select("id")
          .eq("company_id", companyId!)
          .eq("is_active", true)
          .ilike("role_id", data.role_id.trim())
          .limit(1);

        if (error) throw error;

        if (existingById && existingById.length > 0) {
          setError("role_id", {
            type: "manual",
            message: "This Role ID is already in use",
          });
          hasError = true;
        }
      } catch {
        toast.error("Failed to validate Role ID. Please try again.", {
          position: "top-center",
        });
        return false;
      }
    }

    // --- Role name uniqueness (both add and edit) ---
    try {
      let nameQuery = supabase
        .from("role_master")
        .select("id")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .ilike("name", data.name.trim())
        .limit(1);

      // Exclude the current record when editing
      if (isEditing && actualId) {
        nameQuery = nameQuery.neq("id", actualId);
      }

      const { data: existingByName, error } = await nameQuery;

      if (error) throw error;

      if (existingByName && existingByName.length > 0) {
        setError("name", {
          type: "manual",
          message: "This role name is already in use",
        });
        hasError = true;
      }
    } catch {
      toast.error("Failed to validate role name. Please try again.", {
        position: "top-center",
      });
      return false;
    }

    if (hasError) {
      toast.error("Please fix the highlighted errors before submitting.", {
        position: "top-center",
      });
      const firstErrorField = hasError ? (errors.role_id ? "role_id" : "name") : null;
      if (firstErrorField && formRef.current) {
        const el = formRef.current.querySelector<HTMLElement>(
          `#${firstErrorField}`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus();
      }
      return false;
    }

    return true;
  };

  const onSubmit = async (data: RoleFormData) => {
    if (isEditing && actualId) {
      const isLocked = await checkEntityLock(actualId);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }

    if (!companyId) {
      toast.error("Company ID is missing. Please log in again.", {
        position: "top-center",
      });
      navigate("/login");
      return;
    }

    // if (!isAdmin) {
    //   toast.error("Only administrators can perform this action.", {
    //     position: "top-center",
    //   });
    //   return;
    // }

    // Run uniqueness checks before saving
    const isUnique = await validateUniqueness(data);
    if (!isUnique) return;

    // NOTE: No restriction on activating/deactivating roles — status can be toggled freely

    try {
      if (isEditing) {
      if(!userId) return;

        const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status,
    };

        const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Role Master",
          scope: "Edit",
          key: "",
          log: `Role: ${data.name} (${data.role_id}) updated.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'role_master',
            column: 'name',
            value: data.name.trim(),
            company_id: companyId,
            ignore_id: actualId
          }
        ],
        operations: [
          {
            table: 'role_master',
            type: 'update',
            data: payload,
            match: { id: id! }
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Role Master',
        action_name: 'Edit',
        company_id: companyId,
        requested_by: userId,
        action_payload,
        entity_id: isEditing ? actualId : null
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');

        } else {
          const { error } = await supabase
          .from("role_master")
          .update(payload)
          .eq("id", actualId!)
          .eq("company_id", companyId);

        if (error) throw error;

        await supabase.from("system_log").insert(systemLogs);

        toast.success("Role updated successfully", { position: "top-center" });
        }}

      } else {
      if(!userId) return;

        const payload = {
              role_id: data.role_id.trim(),
      name: data.name.trim(),
      description: data.description?.trim() || null,
      status: data.status,
      company_id: companyId,
      is_active: true,
            created_at: getLocalDateTime(),
            };
        
                const systemLogs = {
                 company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Role Master",
          scope: "Add",
          key: "",
          log: `Role: ${data.name} (${data.role_id}) created.`,
          action_by: userId,
          created_at: new Date().toISOString(),
                };

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'role_master',
            column: 'role_id',
            value: data.role_id.trim(),
            company_id: companyId
          },
          {
            type: 'unique',
            table: 'role_master',
            column: 'name',
            value: data.name.trim(),
            company_id: companyId
          }
        ],
        operations: [
          {
            table: 'role_master',
            type: 'insert',
            data: payload,
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };

      // Initiate Approval using the reusable common function
      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Role Master',
        action_name: 'Add',
        company_id: companyId,
        requested_by: userId,
        action_payload: action_payload,
        entity_id: isEditing ? actualId : null
      });

       if (approvalResponse?.success) {
         if (approvalResponse.requires_approval) {
            toast.success('Your action has been submitted and is currently pending approval.');
        
         } else {
          const { error } = await supabase.from("role_master").insert(payload);

        if (error) throw error;

        await supabase.from("system_log").insert(systemLogs);

        toast.success("Role created successfully", { position: "top-center" });
         }}

      }
      navigate("/dashboard/role-master");
    } catch (error: any) {
      console.error("Database error:", error);

      // Handle DB-level unique constraint violations as a fallback
      let errorMessage = `Failed to ${isEditing ? "update" : "create"} role`;
      if (error.code === "23505") {
        if (error.message.includes("role_id")) {
          errorMessage = "Role ID already exists. Please use a different ID.";
          setError("role_id", { type: "manual", message: "This Role ID is already in use" });
        } else if (error.message.includes("name")) {
          errorMessage = "Role name already exists. Please use a different name.";
          setError("name", { type: "manual", message: "This role name is already in use" });
        }
      }

      toast.error(errorMessage, { position: "top-center" });
    }
  };

  const handleCancel = () => {
    reset(getDefaultValues());
    navigate("/dashboard/role-master");
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

  const getPageTitle = () => {
    if (isViewing) return "View Role";
    if (isEditing) return "Update Role";
    return "Add New Role";
  };

  const getPageDescription = () => {
    if (isViewing) return "View role details and configuration";
    if (isEditing) return "Update role information and settings";
    return "Create a new role for access control";
  };

  if (isLoadingUserRole) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {(isEditing || isViewing) && isLoadingRole ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div className="text-lg text-gray-600">Loading role data...</div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-8">
            <PendingApprovalBanner />
            {/* Header */}
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
                  <ShieldCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
                  <p className="text-gray-600">{getPageDescription()}</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form
              ref={formRef}
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-y-5"
            >
              <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" /> Role Information
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    {isViewing
                      ? "View the role details below."
                      : `Fill in the role details below to ${isEditing ? "update the existing" : "create a new"} role.`}
                    {!isViewing && (
                      <span>
                        {" "}
                        Fields marked with <span className="text-red-500">*</span> are required.
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Role ID */}
                      <div className="space-y-2 group">
                        <Label
                          htmlFor="role_id"
                          className={`${
                            errors.role_id ? "text-red-500" : "text-gray-700"
                          } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                        >
                          <ShieldCheck className="h-4 w-4" /> Role ID{" "}
                          {!isViewing && <span className="text-red-500">*</span>}
                        </Label>
                        <Controller
                          name="role_id"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="role_id"
                              placeholder="Enter role ID (e.g., ROLE-001)"
                              maxLength={50}
                              disabled={isEditing || isViewing}
                              className={`${
                                errors.role_id
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                                field.value ? "border-blue-300" : ""
                              } ${isEditing || isViewing ? "bg-gray-50" : ""}`}
                            />
                          )}
                        />
                        <ErrorMessage message={errors.role_id?.message} />
                        {!isViewing && (
                          <p className="text-sm text-gray-500">
                            {isEditing
                              ? "Role ID cannot be changed after creation"
                              : "Unique identifier for the role (letters, numbers, hyphens, underscores)"}
                          </p>
                        )}
                      </div>

                      {/* Role Name */}
                      <div className="space-y-2 group">
                        <Label
                          htmlFor="name"
                          className={`${
                            errors.name ? "text-red-500" : "text-gray-700"
                          } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                        >
                          <ShieldCheck className="h-4 w-4" /> Role Name{" "}
                          {!isViewing && <span className="text-red-500">*</span>}
                        </Label>
                        <Controller
                          name="name"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="name"
                              placeholder="Enter role name (e.g., Administrator)"
                              maxLength={100}
                              disabled={isViewing}
                              className={`${
                                errors.name
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                                field.value ? "border-blue-300" : ""
                              } ${isViewing ? "bg-gray-50" : ""}`}
                            />
                          )}
                        />
                        <ErrorMessage message={errors.name?.message} />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="description"
                        className={`${
                          errors.description ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <ShieldCheck className="h-4 w-4" /> Description
                      </Label>
                      <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            id="description"
                            placeholder="Enter a description for this role (optional)"
                            maxLength={500}
                            rows={4}
                            disabled={isViewing}
                            className={`${
                              errors.description
                                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full resize-none ${
                              field.value ? "border-blue-300" : ""
                            } ${isViewing ? "bg-gray-50" : ""}`}
                          />
                        )}
                      />
                      <ErrorMessage message={errors.description?.message} />
                      {!isViewing && (
                        <p className="text-sm text-gray-500">
                          Optional description of the role's responsibilities and permissions
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Status</Label>
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="status"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="status"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isViewing}
                            />
                          )}
                        />
                        <Label htmlFor="status" className="text-sm">
                          Active (Role can be assigned to users)
                        </Label>
                      </div>
                      {!isViewing && (
                        <p className="text-sm text-gray-500">
                          Inactive roles cannot be assigned to new users, but existing assignments remain
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Actions */}
              {!isViewing && (
                <div className="flex justify-end gap-4">
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
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg px-6 py-2 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isEditing ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {isEditing ? "Update Role" : "Create Role"}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RoleForm;
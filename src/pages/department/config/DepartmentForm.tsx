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
  Building2,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { getLocalDateTime, initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";
import { PendingApprovalBanner } from "@/components/common/PendingApprovalBanner";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

// Department interface
interface IDepartment {
  id: string;
  department_id: string;
  department_name: string;
  info: string | null;
  status: boolean;
  company_id: string;
  created_at: string;
  modified_at: string;
}

// Validation schema for the department form
const createDepartmentSchema = (isEditing: boolean, currentDepartmentId?: string) =>
  z.object({
    department_id: z
      .string()
      .min(1, "Department ID is required")
      .max(50, "Department ID cannot exceed 50 characters")
      .trim()
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Department ID can only contain letters, numbers, hyphens, and underscores"
      )
      .refine(async (value) => {
        if (
          isEditing &&
          currentDepartmentId &&
          value.toLowerCase() === currentDepartmentId.toLowerCase()
        ) {
          return true;
        }
        return true;
      }),
    department_name: z
      .string()
      .min(1, "Department name is required")
      .max(100, "Department name cannot exceed 100 characters")
      .trim(),
    info: z
      .string()
      .max(500, "Info cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),
    status: z.boolean(),
  });

type DepartmentFormData = z.infer<ReturnType<typeof createDepartmentSchema>>;

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
  role_name: string;
  full_name: string;
}

const DepartmentForm = () => {
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const navigate = useNavigate();
  const [isLoadingDepartment, setIsLoadingDepartment] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [department, setDepartment] = useState<IDepartment | null>(null);


  const formRef = useRef<HTMLFormElement>(null);

  const actualMode =
    mode ||
    (id && (id === "edit" || id === "view" || id === "add") ? id : undefined);
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
    (): DepartmentFormData => ({
      department_id: "",
      department_name: "",
      info: "",
      status: true,
    }),
    []
  );

  const departmentSchema = createDepartmentSchema(isEditing, department?.department_id);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: getDefaultValues(),
  });

  // Fetch company_id and user info from local storage on component mount
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
      } finally {
        setIsLoadingRole(false);
      }
    };

    loadUserData();
  }, [navigate]);

  // // Check if user is admin - only run after role is loaded
  // useEffect(() => {
  //   if (isLoadingRole) return;

  //   if (!isAdmin && (isEditing || (!actualId && !actualMode))) {
  //     toast.error("Only administrators can create or edit departments.", {
  //       position: "top-center",
  //     });
  //     navigate("/dashboard/department-master");
  //   }
  // }, [isAdmin, isEditing, actualId, actualMode, navigate, isLoadingRole]);

  // Load department data if editing or viewing
  useEffect(() => {
    if (!actualId || !companyId) return;

    setIsLoadingDepartment(true);
    const loadDepartment = async () => {
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
            const departmentOp = operations.find((op: any) => op.table === 'department_master');
            
            if (departmentOp) {
                if (requestData.entity_id) {
                    const { data: dbData, error: dbError } = await supabase
                        .from('department_master')
                        .select('*')
                        .eq('id', requestData.entity_id)
                        .single();
                    if (!dbError && dbData) {
                        data = { ...dbData, ...(departmentOp.data || {}) };
                    } else {
                        data = departmentOp.data || {};
                    }
                } else {
                    data = departmentOp.data || {};
                }
            } else {
                throw new Error('Department data not found in approval request payload');
            }
        } else {
            const { data: dbData, error } = await supabase
              .from("department_master")
              .select("*")
              .eq("id", actualId)
              .eq("company_id", companyId)
              .single();

            if (error) throw error;
            data = dbData;
        }

        setDepartment(data as any);
        if (data) {
          reset({
            department_id: data.department_id || "",
            department_name: data.department_name || "",
            info: data.info || "",
            status: data.status ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading department:", error);
        toast.error("Failed to load department data", { position: "top-center" });
        navigate("/dashboard/department-master");
      } finally {
        setIsLoadingDepartment(false);
      }
    };
    loadDepartment();
  }, [actualId, reset, companyId, navigate]);

  // Handle form submission
  const onSubmit = async (data: DepartmentFormData) => {
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

    if (!isEditing) {
      try {
        const { data: existingDept, error: checkError } = await supabase
          .from("department_master")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .ilike("department_id", data.department_id.trim())
          .limit(1);

        if (checkError) {
          toast.error("Failed to validate department ID. Please try again.", {
            position: "top-center",
          });
          return;
        }

        if (existingDept && existingDept.length > 0) {
          setError("department_id", {
            type: "manual",
            message: "This department ID is already in use",
          });
          toast.error(
            "Department ID already exists. Please use a different ID.",
            { position: "top-center" }
          );
          if (formRef.current) {
            const departmentIdField = formRef.current.querySelector(
              '[name="department_id"]'
            );
            if (departmentIdField) {
              departmentIdField.scrollIntoView({ behavior: "smooth", block: "center" });
              (departmentIdField as HTMLElement).focus();
            }
          }
          return;
        }
      } catch (error) {
        toast.error("Failed to validate department ID. Please try again.", {
          position: "top-center",
        });
        return;
      }
    }

    try {
      if (isEditing) {
        if(!userId) return;

        const payload = {
      department_name: data.department_name.trim(),
      info: data.info?.trim() || null,
      status: data.status,
      modified_at: getLocalDateTime(),
    };

        const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Department Master",
          scope: "Edit",
          key: "",
          log: `Department: ${data.department_name} (${data.department_id}) updated.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'department_master',
            column: 'department_id',
            value: data.department_id.trim(),
            company_id: companyId,
            ignore_id: actualId
          }
        ],
        operations: [
          {
            table: 'department_master',
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
        module_name: 'Department Master',
        action_name: 'Edit',
        company_id: companyId,
        requested_by: userId,
        action_payload,
        entity_id: actualId
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');

        } else {
           const { error } = await supabase
          .from("department_master")
          .update(payload)
          .eq("id", actualId!)
          .eq("company_id", companyId);

        if (error) throw error;


        const { error: systemLogError } = await supabase
          .from("system_log")
          .insert(systemLogs);

        if (systemLogError) throw systemLogError;

        toast.success("Department updated successfully", { position: "top-center" });
        }
      }

      } else {
        if(!userId) return;

        const payload = {
      department_id: data.department_id.trim(),
      department_name: data.department_name.trim(),
      info: data.info?.trim() || null,
      status: data.status,
      company_id: companyId,
      created_at: getLocalDateTime(),
      modified_at: getLocalDateTime(),
    };

        const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Department Master",
          scope: "Add",
          key: "",
          log: `Department: ${data.department_name} (${data.department_id}) created.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'department_master',
            column: 'department_id',
            value: data.department_id.trim(),
            company_id: companyId
          }
        ],
        operations: [
          {
            table: 'department_master',
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
        module_name: 'Department Master',
        action_name: 'Add',
        company_id: companyId,
        requested_by: userId,
        action_payload: action_payload,
        entity_id: null
      });

       if (approvalResponse?.success) {
         if (approvalResponse.requires_approval) {
            toast.success('Your action has been submitted and is currently pending approval.');
        
         } else {
          const { error } = await supabase.from("department_master").insert(payload);

        if (error) throw error;

        const { error: systemLogError } = await supabase
          .from("system_log")
          .insert(systemLogs);

        if (systemLogError) throw systemLogError;

        toast.success("Department created successfully", { position: "top-center" });
         }}
      }

      navigate("/dashboard/department-master");
    } catch (error: any) {
      console.error("Database error:", error);

      let errorMessage = `Failed to ${isEditing ? "update" : "create"} department`;

      if (error.code === "23505") {
        if (error.message.includes("department_id")) {
          errorMessage = "Department ID already exists. Please use a different ID.";
          setError("department_id", {
            type: "manual",
            message: "This department ID is already in use",
          });
        }
      }

      toast.error(errorMessage, { position: "top-center" });

      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField && formRef.current) {
        const invalidElement = formRef.current.querySelector(
          `[name="${firstErrorField}"]`
        );
        if (invalidElement) {
          invalidElement.scrollIntoView({ behavior: "smooth", block: "center" });
          (invalidElement as HTMLElement).focus();
        }
      }
    }
  };

  const handleCancel = () => {
    reset(getDefaultValues());
    navigate("/dashboard/department-master");
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
    if (isViewing) return "View Department";
    if (isEditing) return "Update Department";
    return "Add New Department";
  };

  const getPageDescription = () => {
    if (isViewing) return "View department details and configuration";
    if (isEditing) return "Update department information and settings";
    return "Create a new department for organizational structure";
  };

  if (isLoadingRole) {
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
      {(isEditing || isViewing) && isLoadingDepartment ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div className="text-lg text-gray-600">Loading department data...</div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-8">
            <PendingApprovalBanner />
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
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {getPageTitle()}
                  </h1>
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
              {/* Form Card */}
              <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> Department Information
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    {isViewing
                      ? "View the department details below."
                      : `Fill in the department details below to ${
                          isEditing ? "update the existing" : "create a new"
                        } department.`}
                    {!isViewing && (
                      <span>
                        {" "}
                        Fields marked with <span className="text-red-500">*</span> are
                        required.
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 group">
                        <Label
                          htmlFor="department_id"
                          className={`${
                            errors.department_id ? "text-red-500" : "text-gray-700"
                          } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                        >
                          <Building2 className="h-4 w-4" /> Department ID{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                          name="department_id"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="department_id"
                              placeholder="Enter department ID (e.g., DEPT-001)"
                              maxLength={50}
                              disabled={isEditing || isViewing}
                              className={`${
                                errors.department_id
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                                field.value ? "border-blue-300" : ""
                              } ${isViewing ? "bg-gray-50" : ""}`}
                            />
                          )}
                        />
                        <ErrorMessage message={errors.department_id?.message} />
                        {!isViewing && (
                          <p className="text-sm text-gray-500">
                            {isEditing
                              ? "Department ID cannot be changed after creation"
                              : "User-defined unique identifier for the department"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 group">
                        <Label
                          htmlFor="department_name"
                          className={`${
                            errors.department_name ? "text-red-500" : "text-gray-700"
                          } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                        >
                          <Building2 className="h-4 w-4" /> Department Name{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                          name="department_name"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="department_name"
                              placeholder="Enter department name"
                              maxLength={100}
                              disabled={isViewing}
                              className={`${
                                errors.department_name
                                  ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                              } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                                field.value ? "border-blue-300" : ""
                              } ${isViewing ? "bg-gray-50" : ""}`}
                            />
                          )}
                        />
                        <ErrorMessage message={errors.department_name?.message} />
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <Label
                        htmlFor="info"
                        className={`${
                          errors.info ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Building2 className="h-4 w-4" /> Additional Information
                      </Label>
                      <Controller
                        name="info"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            id="info"
                            placeholder="Enter additional information about the department (optional)"
                            maxLength={500}
                            rows={4}
                            disabled={isViewing}
                            className={`${
                              errors.info
                                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full resize-none ${
                              field.value ? "border-blue-300" : ""
                            } ${isViewing ? "bg-gray-50" : ""}`}
                          />
                        )}
                      />
                      <ErrorMessage message={errors.info?.message} />
                      {!isViewing && (
                        <p className="text-sm text-gray-500">
                          Optional free-text field for additional department details
                        </p>
                      )}
                    </div>

                    {/* ✅ Status — freely editable in add/edit mode, disabled only in view mode */}
                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Status</Label>
                      <div className="flex items-center space-x-2">
                         <Tooltip>
        <TooltipTrigger asChild>
          <span>
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
                    </span>
        </TooltipTrigger>
      </Tooltip>
                        <Label htmlFor="status" className="text-sm">
                          Active (Department can be assigned to users)
                        </Label>
                      </div>
                      {!isViewing && (
                        <p className="text-sm text-gray-500">
                          Inactive departments cannot be assigned to users, but existing
                          user assignments remain
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
                        {isEditing ? "Update Department" : "Create Department"}
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

export default DepartmentForm;

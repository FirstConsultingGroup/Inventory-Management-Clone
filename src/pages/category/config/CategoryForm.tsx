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
import { ArrowLeft, CheckCircle, Loader2, Tag, AlertCircle, Check, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";

import { getLocalDateTime, initiateApprovalRequest, checkEntityLock } from "@/Utils/commonFun";
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';

interface ICategory {
  id: string;
  name: string;
  description: string | null;
  status: boolean;
  company_id: string;
  created_at: string;
  modified_at: string;
}

const createCategorySchema = () =>
  z.object({
    name: z
      .string()
      .min(1, "Category name is required")
      .max(100, "Category name cannot exceed 100 characters")
      .trim()
      .refine(async () => true), // uniqueness handled separately
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),
    status: z.boolean(),
  });

type CategoryFormData = z.infer<ReturnType<typeof createCategorySchema>>;

interface UserData {
  id: string;
  email: string;
  company_id: string;
  [key: string]: any;
}

const CategoryForm = () => {
  const { id, mode } = useParams<{ id: string; mode?: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<ICategory | null>(null);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const actualMode = mode || (id && (id === 'edit' || id === 'view' || id === 'add') ? id : undefined);
  const actualId = actualMode === id ? undefined : id;

  const isEditing = Boolean(actualId) && (actualMode === 'edit' || window.location.pathname.includes('/edit/'));
  const isViewing = Boolean(actualId) && (actualMode === 'view' || window.location.pathname.includes('/view/'));

  const legacyEditId = !mode && id && id !== 'add' && id !== 'edit' && id !== 'view' ? id : undefined;
  const effectiveId = actualId || legacyEditId;
  const effectiveIsEditing = isEditing || Boolean(legacyEditId);

  // Category name validation state
  const [nameValidationStatus, setNameValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [nameValidationMessage, setNameValidationMessage] = useState<string>('');
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getDefaultValues = useCallback((): CategoryFormData => ({
    name: "",
    description: "",
    status: true,
  }), []);

  const categorySchema = createCategorySchema();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: getDefaultValues(),
  });

  const watchedCategoryName = watch("name");

  // Load user data
  useEffect(() => {
    try {
      const userDataString = localStorage.getItem("userData");
      if (userDataString) {
        const userData: UserData = JSON.parse(userDataString);
        if (userData.company_id) {
          setCompanyId(userData.company_id);
          setUserId(userData.id);
        } else {
          throw new Error("Company ID not found");
        }
      } else {
        throw new Error("User data not found");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Failed to load user data. Please log in again.", { position: "top-center" });
      navigate("/login");
    }
  }, [navigate]);

  // Category name uniqueness validation (skip in view mode)
  const validateCategoryNameUniqueness = useCallback(async (categoryName: string) => {
    if (!categoryName || !companyId || isViewing) return;

    if (effectiveIsEditing && category && category.name.toLowerCase() === categoryName.toLowerCase()) {
      setNameValidationStatus('valid');
      setNameValidationMessage('Current category name');
      clearErrors('name');
      return;
    }

    setNameValidationStatus('validating');
    setNameValidationMessage('Checking availability...');

    try {
      const { data, error } = await supabase
        .from("category_master")
        .select("id, name")
        .eq('company_id', companyId)
        .eq('is_active', true)
        .ilike("name", categoryName)
        .limit(1);

      if (error) {
        setNameValidationStatus('idle');
        setNameValidationMessage('');
        return;
      }

      if (data && data.length > 0) {
        setNameValidationStatus('invalid');
        setNameValidationMessage('Category name already exists');
        setError("name", { type: "manual", message: "This category name is already in use" });
      } else {
        setNameValidationStatus('valid');
        setNameValidationMessage('Category name is available');
        clearErrors('name');
      }
    } catch {
      setNameValidationStatus('idle');
      setNameValidationMessage('');
    }
  }, [companyId, effectiveIsEditing, isViewing, category, setError, clearErrors]);

  // Debounced name validation
  useEffect(() => {
    if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);

    if (watchedCategoryName && watchedCategoryName.length > 0) {
      setNameValidationStatus('idle');
      setNameValidationMessage('');
    }

    if (watchedCategoryName && watchedCategoryName.trim().length > 0) {
      validationTimeoutRef.current = setTimeout(() => {
        validateCategoryNameUniqueness(watchedCategoryName.trim());
      }, 500);
    }

    return () => {
      if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    };
  }, [watchedCategoryName, validateCategoryNameUniqueness]);

  // Load category data if editing or viewing
  useEffect(() => {
    if (!effectiveId || !companyId) return;

    setIsLoadingCategory(true);
    const loadCategory = async () => {
      try {
        let data: any = null;
        if (effectiveId === 'pending') {
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
            const categoryOp = operations.find((op: any) => op.table === 'category_master');
            
            if (categoryOp) {
                if (requestData.entity_id) {
                    const { data: dbData, error: dbError } = await supabase
                        .from('category_master')
                        .select('*')
                        .eq('id', requestData.entity_id)
                        .single();
                    if (!dbError && dbData) {
                        data = { ...dbData, ...(categoryOp.data || {}) };
                    } else {
                        data = categoryOp.data || {};
                    }
                } else {
                    data = categoryOp.data || {};
                }
            } else {
                throw new Error('Category data not found in approval request payload');
            }
        } else {
            const { data: dbData, error } = await supabase
              .from("category_master")
              .select("*")
              .eq("id", effectiveId)
              .eq("company_id", companyId)
              .single();

            if (error) throw error;
            data = dbData;
        }

        setCategory(data as any);
        if (data) {
          reset({
            name: data.name || "",
            description: data.description || "",
            status: data.status ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading category:", error);
        toast.error("Failed to load category data", { position: "top-center" });
        navigate("/dashboard/category-master");
      } finally {
        setIsLoadingCategory(false);
      }
    };
    loadCategory();
  }, [effectiveId, reset, companyId, navigate]);

 
const onSubmit = async (data: CategoryFormData) => {
  if (isViewing) return;

  if (effectiveIsEditing && effectiveId) {
    const isLocked = await checkEntityLock(effectiveId);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }
  }

  try {
    
    const userDataString = localStorage.getItem("userData");

    if (!userDataString) {
      toast.error("User data not found. Please login again.", {
        position: "top-center",
      });
      navigate("/login");
      return;
    }

    const userData: UserData = JSON.parse(userDataString);

    if (!userData?.id || !userData?.company_id) {
      toast.error("Invalid user data. Please login again.", {
        position: "top-center",
      });
      navigate("/login");
      return;
    }

    
    if (nameValidationStatus === "invalid") {
      setError("name", {
        type: "manual",
        message: "Please choose a different category name",
      });
      return;
    }

    
    if (!effectiveIsEditing) {
      
      const payload = {
        name: data.name.trim(),
        description: data.description?.trim() || "",
        status: data.status,
        company_id: userData.company_id,
        created_at: getLocalDateTime(),
        modified_at: getLocalDateTime(),
      };

     
      const systemLog = {
        company_id: userData.company_id,
        transaction_date: new Date().toISOString(),
        module: "Category Master",
        scope: "Add",
        key: "",
        log: `Category: ${data.name.trim()} created.`,
        action_by: userData.id,
        created_at: new Date().toISOString(),
      };

     
      const action_payload = {
        validations: [
          {
            type: "unique",
            table: "category_master",
            column: "name",
            value: data.name.trim(),
            company_id: userData.company_id,
          },
        ],
        operations: [
          {
            table: "category_master",
            type: "insert",
            data: payload,
          },
          {
            table: "system_log",
            type: "insert",
            data: systemLog,
          },
        ],
      };

     
      const approvalResponse = await initiateApprovalRequest({
        module_name: "Category Master",
        action_name: "Add",
        company_id: userData.company_id,
        requested_by: userData.id,
        action_payload: action_payload,
        entity_id: null,
      });

     
      if (approvalResponse?.success) {
        
        if (approvalResponse.requires_approval) {
          toast.success(
            "Your action has been submitted and is currently pending approval.",
            {
              position: "top-center",
            }
          );

          handleCancel();
          return;
        }

       
        const { error: insertError } = await supabase
          .from("category_master")
          .insert(payload);

        if (insertError) throw insertError;

       
        const { error: systemLogError } = await supabase
          .from("system_log")
          .insert(systemLog);

        if (systemLogError) throw systemLogError;

        toast.success("Category created successfully!", {
          position: "top-center",
        });

        handleCancel();
      } else {
        throw new Error(
          approvalResponse?.message || "Approval initiation failed"
        );
      }

      return;
    }

   
    const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || "",
      status: data.status,
      modified_at: getLocalDateTime(),
    };

   
    const systemLogs = {
      company_id: userData.company_id,
      transaction_date: new Date().toISOString(),
      module: "Category Master",
      scope: "Edit",
      key: "",
      log: `Category: ${data.name.trim()} updated.`,
      action_by: userData.id,
      created_at: new Date().toISOString(),
    };

   
    const action_payload = {
      validations: [
        {
          type: "unique",
          table: "category_master",
          column: "name",
          value: data.name.trim(),
          company_id: userData.company_id,
          ignore_id: effectiveId,
        },
      ],
      operations: [
        {
          table: "category_master",
          type: "update",
          data: payload,
          match: {
            id: effectiveId!,
          },
        },
        {
          table: "system_log",
          type: "insert",
          data: systemLogs,
        },
      ],
    };

    
    const approvalResponse = await initiateApprovalRequest({
      module_name: "Category Master",
      action_name: "Edit",
      company_id: userData.company_id,
      requested_by: userData.id,
      action_payload: action_payload,
      entity_id: effectiveId,
    });

    
    if (approvalResponse?.success) {
      
      if (approvalResponse.requires_approval) {
        toast.success(
          "Your action has been submitted and is currently pending approval.",
          {
            position: "top-center",
          }
        );

        handleCancel();
        return;
      }

      
      const { error: updateError } = await supabase
        .from("category_master")
        .update(payload)
        .eq("id", effectiveId!)
        .eq("company_id", userData.company_id);

      if (updateError) throw updateError;

      
      const { error: systemLogError } = await supabase
        .from("system_log")
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

      toast.success("Category updated successfully!", {
        position: "top-center",
      });

      handleCancel();
    } else {
      throw new Error(
        approvalResponse?.message || "Approval initiation failed"
      );
    }
  } catch (error: any) {
    console.error("Error submitting category form:", error);

    toast.error(
      `Failed to ${
        effectiveIsEditing ? "update" : "create"
      } category: ${error?.message || "Unknown error"}`,
      {
        position: "top-center",
      }
    );
  }
};




  const handleCancel = () => {
    reset(getDefaultValues());
    navigate("/dashboard/category-master");
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
    if (isViewing) return "View Category";
    if (effectiveIsEditing) return "Update Category";
    return "Add New Category";
  };

  const getPageDescription = () => {
    if (isViewing) return "View category details and configuration";
    if (effectiveIsEditing) return "Update category information and settings";
    return "Create a new category for inventory item classification";
  };

  if ((effectiveIsEditing || isViewing) && isLoadingCategory) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <div className="text-lg text-gray-600">Loading category data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
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
              <Tag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
              <p className="text-gray-600">{getPageDescription()}</p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">Category Information</CardTitle>
            <CardDescription className="text-blue-600">
              {isViewing
                ? "View the category details below."
                : `Fill in the category details below to ${effectiveIsEditing ? "update the existing" : "create a new"} category.`}
              {!isViewing && (
                <span> Fields marked with <span className="text-red-500">*</span> are required.</span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Tag className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Category Name */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="name"
                      className={`${errors.name ? "text-red-500" : "text-gray-700"} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Tag className="h-4 w-4" /> Category Name {!isViewing && <span className="text-red-500">*</span>}
                    </Label>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <div className="relative">
                          <Input
                            {...field}
                            id="name"
                            placeholder="Enter category name"
                            maxLength={100}
                            disabled={isViewing}
                            className={`${
                              errors.name
                                ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                : nameValidationStatus === 'valid'
                                  ? "border-green-300 focus:border-green-500 focus:ring-green-200"
                                  : nameValidationStatus === 'invalid'
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                                    : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                            } pl-3 pr-10 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""} ${isViewing ? "bg-gray-50" : ""}`}
                          />
                          {!isViewing && (
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                              {nameValidationStatus === 'validating' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                              {nameValidationStatus === 'valid' && <Check className="h-4 w-4 text-green-500" />}
                              {nameValidationStatus === 'invalid' && <X className="h-4 w-4 text-red-500" />}
                            </div>
                          )}
                        </div>
                      )}
                    />
                    <ErrorMessage message={errors.name?.message} />
                    {!isViewing && nameValidationMessage && !errors.name && (
                      <p className={`text-sm flex items-center gap-1 mt-1 ${
                        nameValidationStatus === 'valid' ? 'text-green-600'
                        : nameValidationStatus === 'invalid' ? 'text-red-500'
                        : 'text-blue-500'
                      }`}>
                        {nameValidationStatus === 'valid' && <Check className="h-3 w-3" />}
                        {nameValidationStatus === 'invalid' && <X className="h-3 w-3" />}
                        {nameValidationStatus === 'validating' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {nameValidationMessage}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="description"
                      className={`${errors.description ? "text-red-500" : "text-gray-700"} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Tag className="h-4 w-4" /> Description
                    </Label>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="description"
                          placeholder="Enter category description (optional)"
                          maxLength={500}
                          rows={4}
                          disabled={isViewing}
                          className={`${
                            errors.description
                              ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                              : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full resize-none ${field.value ? "border-blue-300" : ""} ${isViewing ? "bg-gray-50" : ""}`}
                        />
                      )}
                    />
                    <ErrorMessage message={errors.description?.message} />
                    {!isViewing && (
                      <p className="text-sm text-gray-500">
                        Optional description to help identify the category's purpose
                      </p>
                    )}
                  </div>

                  {/* ✅ Status — freely editable in add/edit mode, disabled only in view mode */}
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
                        Active (Category can be used for new items)
                      </Label>
                    </div>
                    {!isViewing && (
                      <p className="text-sm text-gray-500">
                        Inactive categories cannot be selected when creating new items, but existing items will retain their category
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              {!isViewing && (
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
                        {effectiveIsEditing ? "Updating..." : "Creating..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {effectiveIsEditing ? "Update Category" : "Create Category"}
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CategoryForm;

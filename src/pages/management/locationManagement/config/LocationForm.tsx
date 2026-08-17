import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/Utils/types/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import toast from 'react-hot-toast';
import { ArrowLeft, Building, MapPin, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun'; 
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';

// Define the form schema matching your Supabase table
const locationSchema = z.object({
  location_id: z.string().min(1, 'Location ID is required'),
  location_name: z.string().min(1, 'Location Name is required'),
  status: z.boolean(),
  additional_info: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function LocationForm() {
  const navigate = useNavigate();
  const { id, mode } = useParams<{ id: string; mode?: string }>();

  // Handle both URL patterns
  const actualMode = mode || (id && (id === 'edit' || id === 'view' || id === 'add') ? id : undefined);
  const actualId = actualMode === id ? undefined : id;

  const isEditMode = Boolean(actualId) && (actualMode === 'edit' || window.location.pathname.includes('/edit/'));
  const isViewMode = Boolean(actualId) && (actualMode === 'view' || window.location.pathname.includes('/view/'));

  const [initialLoading, setInitialLoading] = useState(isEditMode || isViewMode);

  const formRef = useRef<HTMLFormElement>(null);

  // Get default values
  const getDefaultValues = useCallback((): LocationFormData => ({
    location_id: '',
    location_name: '',
    status: true,
    additional_info: '',
  }), []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: getDefaultValues(),
  });

  // Get company_id from localStorage
  const userData = localStorage.getItem('userData');
  const company_id = userData ? JSON.parse(userData).company_id : null;
  const user_id = userData ? JSON.parse(userData).id : null;

  const [isIncludedInUsersAuthLoc,setIsIncludedInUsersAuthLoc]=useState<any[]>([]);

  useEffect(() => {
    if ((isEditMode || isViewMode) && actualId) {
      fetchLocation();
    }
  }, [actualId, isEditMode, isViewMode]);

  const fetchLocation = async () => {
    if (!actualId || !company_id) return;

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
          const locationOp = operations.find((op: any) => op.table === 'location_master');
          
          if (locationOp) {
              if (requestData.entity_id) {
                  const { data: dbData, error: dbError } = await supabase
                      .from('location_master')
                      .select('*')
                      .eq('id', requestData.entity_id)
                      .single();
                  if (!dbError && dbData) {
                      data = { ...dbData, ...(locationOp.data || {}) };
                  } else {
                      data = locationOp.data || {};
                  }
              } else {
                  data = locationOp.data || {};
              }
          } else {
              throw new Error('Location data not found in approval request payload');
          }
      } else {
          const { data: dbData, error } = await supabase
            .from('location_master')
            .select('*')
            .eq('id', actualId)
            .eq('company_id', company_id)
            .single();

          if (error) throw error;
          data = dbData;
      }

      if (data) {
        reset({
          location_id: data.location_id || '',
          location_name: data.location_name || '',
          status: data.status ?? true,
          additional_info: data.additional_info || '',
        });
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      toast.error('Failed to load location data', { position: 'top-center' });
      navigate('/dashboard/location-master');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
        const fetchEmployeeLocation = async () => {
          if (!company_id) return;

    try {
      const { data, error } = await supabase
        .from('user_mgmt')
        .select('locations')
        .eq('company_id', company_id)

      if (error) throw error;

      if (data) {
        const authorizedLocations= data.flatMap(authLoc => authLoc.locations)
        const isIncludedInAuthLoc = authorizedLocations.filter(id => id===actualId)
        setIsIncludedInUsersAuthLoc(isIncludedInAuthLoc)
      }
    } catch (error) {
      console.error('Error fetching employee location:', error);
    } 
  };

  fetchEmployeeLocation();
  }, [])
  

  
const onSubmit = async (data: LocationFormData) => {
  if (isViewMode) return;

  if (isEditMode && actualId) {
    const isLocked = await checkEntityLock(actualId);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }
  }

  if (!company_id || !user_id) {
    toast.error('User or company information not found. Please login again.', {
      position: 'top-center',
    });
    return;
  }

  try {
    
    if (isEditMode && actualId) {
      
      const payload = {
        location_name: data.location_name,
        status: data.status,
        additional_info: data.additional_info || null,
      };

      
      const systemLogs = {
        company_id: company_id,
        transaction_date: new Date().toISOString(),
        module: 'Location Master',
        scope: 'Edit',
        key: data.location_id,
        log: `Location: ${data.location_name} (${data.location_id}) updated.`,
        action_by: user_id,
        created_at: new Date().toISOString(),
      };

      
      const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'location_master',
            column: 'location_id',
            value: data.location_id,
            company_id: company_id,
            ignore_id: actualId
          }
        ],
        operations: [
          {
            table: 'location_master',
            type: 'update',
            data: payload,
            match: {
              id: actualId,
            },
          },
          {
            table: 'system_log',
            type: 'insert',
            data: systemLogs,
          },
        ],
      };

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Location Master',
        action_name: 'Edit',
        company_id: company_id,
        requested_by: user_id,
        action_payload: action_payload,
        entity_id: actualId,
      });

      if (!approvalResponse?.success) {
        throw new Error(
          approvalResponse?.message || 'Approval initiation failed'
        );
      }

      
      if (approvalResponse.requires_approval) {
        toast.success(
          'Your action has been submitted and is currently pending approval.',
          {
            position: 'top-center',
          }
        );

        handleCancel();
        return;
      }

     
     
      const { error: updateError } = await supabase
        .from('location_master')
        .update(payload)
        .eq('id', actualId)
        .eq('company_id', company_id);

      if (updateError) throw updateError;

     
      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

      toast.success('Location updated successfully', {
        position: 'top-center',
      });

      handleCancel();
      return;
    }

    
    const {
      data: existingLocation,
      error: existingLocationError,
    } = await supabase
      .from('location_master')
      .select('id')
      .eq('location_id', data.location_id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (existingLocationError) {
      throw existingLocationError;
    }

    if (existingLocation) {
      toast.error('Location ID already exists', {
        position: 'top-center',
      });
      return;
    }

   
    const payload = {
      location_id: data.location_id,
      location_name: data.location_name,
      status: data.status,
      additional_info: data.additional_info || null,
      company_id: company_id,
      is_active: true,
    };

    
    const systemLogs = {
      company_id: company_id,
      transaction_date: new Date().toISOString(),
      module: 'Location Master',
      scope: 'Add',
      key: data.location_id,
      log: `Location: ${data.location_name} (${data.location_id}) created.`,
      action_by: user_id,
      created_at: new Date().toISOString(),
    };

    
    const action_payload = {
      validations: [
        {
          type: 'unique',
          table: 'location_master',
          column: 'location_id',
          value: data.location_id,
          company_id: company_id
        }
      ],
      operations: [
        {
          table: 'location_master',
          type: 'insert',
          data: payload,
        },
        {
          table: 'system_log',
          type: 'insert',
          data: systemLogs,
        },
      ],
    };

    
    const approvalResponse = await initiateApprovalRequest({
      module_name: 'Location Master',
      action_name: 'Add',
      company_id: company_id,
      requested_by: user_id,
      action_payload: action_payload,
    });

    if (!approvalResponse?.success) {
      throw new Error(
        approvalResponse?.message || 'Approval initiation failed'
      );
    }

    
    if (approvalResponse.requires_approval) {
      toast.success(
        'Your action has been submitted and is currently pending approval.',
        {
          position: 'top-center',
        }
      );

      handleCancel();
      return;
    }

    
    const { error: insertError } = await supabase
      .from('location_master')
      .insert(payload);

    if (insertError) throw insertError;

    
    const { error: systemLogError } = await supabase
      .from('system_log')
      .insert(systemLogs);

    if (systemLogError) throw systemLogError;

    toast.success('Location created successfully', {
      position: 'top-center',
    });

    handleCancel();

  } catch (error: any) {
    console.error('Error saving location:', error);

    toast.error(
      `Failed to ${isEditMode ? 'update' : 'create'} location: ${
        error?.message || 'Unknown error'
      }`,
      {
        position: 'top-center',
      }
    );

    
    const firstErrorField = Object.keys(errors)[0];

    if (firstErrorField && formRef.current) {
      const invalidElement = formRef.current.querySelector(
        `[name="${firstErrorField}"]`
      );

      if (invalidElement) {
        invalidElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        (invalidElement as HTMLElement).focus();
      }
    }
  }
};



  const handleCancel = () => {
    reset(getDefaultValues());
    navigate('/dashboard/location-master');
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

  // Get page title based on mode
  const getPageTitle = () => {
    if (isViewMode) return "View Location";
    if (isEditMode) return "Update Location";
    return "Add New Location";
  };

  // Get page description based on mode
  const getPageDescription = () => {
    if (isViewMode) return "View location details and configuration";
    if (isEditMode) return "Update location information and settings";
    return "Create a new location for your organization";
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <div className="text-lg text-gray-600">Loading location data...</div>
        </div>
      </div>
    );
  }

  return (
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
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {getPageTitle()}
              </h1>
              <p className="text-gray-600">
                {getPageDescription()}
              </p>
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
                <Building className="h-5 w-5" /> Location Information
              </CardTitle>
              <CardDescription className="text-blue-600">
                {isViewMode
                  ? "View the location details below."
                  : `Fill in the location details below to ${isEditMode ? "update the existing" : "create a new"} location.`}
                {!isViewMode && <span> Fields marked with <span className="text-red-500">*</span> are required.</span>}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Basic Information Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="location_id"
                      className={`${errors.location_id ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <MapPin className="h-4 w-4" /> Location ID <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="location_id"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="location_id"
                          placeholder="Enter unique location ID"
                          disabled={isEditMode || isViewMode}
                          className={`${errors.location_id
                            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                            : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                            } ${isViewMode ? "bg-gray-50" : ""}`}
                        />
                      )}
                    />
                    <ErrorMessage message={errors.location_id?.message} />
                    {!isViewMode && (
                      <p className="text-sm text-gray-500">
                        {isEditMode
                          ? "Location ID cannot be changed after creation"
                          : "User-defined unique identifier for the location"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="location_name"
                      className={`${errors.location_name ? "text-red-500" : "text-gray-700"
                        } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Building className="h-4 w-4" /> Location Name <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="location_name"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="location_name"
                          placeholder="Enter location name"
                          disabled={isViewMode}
                          className={`${errors.location_name
                            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                            : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                            } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${field.value ? "border-blue-300" : ""
                            } ${isViewMode ? "bg-gray-50" : ""}`}
                        />
                      )}
                    />
                    <ErrorMessage message={errors.location_name?.message} />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="additional_info"
                    className={`${errors.additional_info ? "text-red-500" : "text-gray-700"
                      } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                  >
                    <Building className="h-4 w-4" /> Additional Information
                  </Label>
                  <Controller
                    name="additional_info"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        id="additional_info"
                        placeholder="Enter any additional information about this location (optional)"
                        rows={4}
                        disabled={isViewMode}
                        className={`${errors.additional_info
                          ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                          : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full resize-none ${field.value ? "border-blue-300" : ""
                          } ${isViewMode ? "bg-gray-50" : ""}`}
                      />
                    )}
                  />
                  <ErrorMessage message={errors.additional_info?.message} />
                  {!isViewMode && (
                    <p className="text-sm text-gray-500">
                      Optional free-text field for additional location details
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">Status</Label>
                  <div className="flex items-center space-x-2">
                    <TooltipProvider>
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
                                  disabled={isViewMode || isIncludedInUsersAuthLoc.length > 0}
                                />
                              )}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isIncludedInUsersAuthLoc.length > 0 ?
                            "Cannot edit. This location is linked with user's authorized locations list."
                            : "Edit Status"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Label htmlFor="status" className="text-sm">
                      Active (Location is available for use)
                    </Label>
                  </div>
                  {!isViewMode && (
                    <p className="text-sm text-gray-500">
                      Inactive locations will not be available for selection
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          {!isViewMode && (
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
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {isEditMode ? "Update Location" : "Create Location"}
                  </>
                )}
              </Button>
            </div>
          )}

          {isViewMode && (
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors duration-200 px-6 py-2"
              >
                Back
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

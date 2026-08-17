import { ArrowLeft, LayoutTemplate, Save, X, Plus, Trash2, Pencil, Tag, List, Type, ListOrdered, Ruler, Hash, AlertCircle, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/Utils/types/supabaseClient';
import { IUnit } from '@/Utils/constants';
import { initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Define type for item lookup master
interface IItemLookup {
  id: string;
  key: string;
  value: string;
  company_id: string;
  alias_name: string;
}

// Zod schema for individual field
const fieldSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  controlType: z.enum(['Textbox', 'Dropdown', 'Textarea', 'Multi Select Dropdown'], {
    required_error: 'Control type is required',
  }),
  collectionName: z.string().optional(),
  dataType: z.enum(['text', 'number', 'unit']).nullable().optional(),
  order: z.number().min(1),
  maxLength: z.number().min(0),
  measurementType: z.string().optional(),
  isMandatory: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if ((data.controlType === 'Dropdown' || data.controlType === 'Multi Select Dropdown') && !data.collectionName) {
    ctx.addIssue({
      path: ['collectionName'],
      message: 'Collection name is required for Dropdown',
      code: z.ZodIssueCode.custom,
    });
  }
  if (data.controlType === 'Textbox' && !data.dataType) {
    ctx.addIssue({
      path: ['dataType'],
      message: 'Data type is required for Textbox',
      code: z.ZodIssueCode.custom,
    });
  }
});

type FieldFormValues = z.infer<typeof fieldSchema>;

const ItemConfigForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [userData, setUserData] = useState<any>(null);
  const [units, setUnits] = useState<IUnit[]>([]);
  const [lookups, setLookups] = useState<IItemLookup[]>([]); // Changed from collections to lookups
  
  const [addedFields, setAddedFields] = useState<FieldFormValues[]>([]);
  const [showForm, setShowForm] = useState(true);

  // Get user data from localStorage
  useEffect(() => {
    let isMounted = true;
    
    const loadUserData = () => {
      const user = localStorage.getItem('userData');
      if (user && isMounted) {
        try {
          const parsedUserData = JSON.parse(user);
          setUserData(parsedUserData);
        } catch (error) {
          console.error("Error parsing user data:", error);
        }
      } else if (!user && isMounted) {
        // Retry after a short delay in case it's still loading
        const retryTimer = setTimeout(() => {
          if (isMounted) {
            const retryUser = localStorage.getItem('userData');
            if (retryUser) {
              try {
                const parsedUserData = JSON.parse(retryUser);
                setUserData(parsedUserData);
              } catch (error) {
                console.error("Error parsing user data on retry:", error);
              }
            }
          }
        }, 500);
        
        return () => clearTimeout(retryTimer);
      }
    };
    
    loadUserData();
    
    // Listen for storage changes in case user data is updated elsewhere
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userData' && isMounted) {
        if (e.newValue) {
          try {
            const parsedUserData = JSON.parse(e.newValue);
            setUserData(parsedUserData);
          } catch (error) {
            console.error("Error parsing user data from storage event:", error);
          }
        } else {
          setUserData(null);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Additional effect to handle cases where userData becomes available after initial render
  useEffect(() => {
    if (!userData && localStorage.getItem('userData')) {
      const user = localStorage.getItem('userData');
      try {
        const parsedUserData = JSON.parse(user!);
        setUserData(parsedUserData);
      } catch (error) {
        console.error("Error parsing user data in secondary effect:", error);
      }
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      label: '',
      description: '',
      controlType: undefined,
      collectionName: undefined,
      dataType: undefined,
      order: 0,
      maxLength: 0,
      measurementType: undefined,
      isMandatory: false,
    },
  });

  const watchedFields = watch();

  useEffect(() => {
    if (isEditMode) {
      getFieldDetails();
      setShowForm(true);
    }
  }, [id]);

  useEffect(() => {
  
    // Use a ref to track if we've already fetched data
    let isMounted = true;
    
    const fetchUnits = async () => {
      try { 
        const { data: units, error: unitsError } = await supabase
          .from('units_master')
          .select('*')
          .eq('company_id', userData.company_id);

        if (unitsError) {
          console.error("Units fetch error:", unitsError);
          throw unitsError;
        }
        
        // Only update state if component is still mounted
        if (isMounted) {
          // Ensure we're setting the correct type
          setUnits(units as IUnit[] || []);
        }
      } catch (error: any) {
        console.error("Fetch Units Error =>", error.message || error);
        toast.error("Failed to fetch units: " + (error.message || "Unknown error"));
      }
    };

    const fetchLookups = async () => {
      try {
        
        // Check if userData is available
        if (!userData) return;
        
        
        // Check if company_id is available
        if (!userData.company_id) return;
        
        // Fetch all lookups for the company
        const { data: lookupsData, error: lookupsError } = await supabase
          .from('item_lookup_master')
          .select('*')
          .eq('company_id', userData.company_id);

        if (lookupsError) {
          console.error("Lookups fetch error:", lookupsError);
          toast.error("Failed to fetch lookups: " + (lookupsError.message || "Unknown error"));
          return;
        }

        // Filter out invalid entries and deduplicate by key
        // Make sure we have valid IDs, keys, and values
        const validLookups = (lookupsData || [])
          .filter(lookup => {
            // More permissive filtering - only exclude truly invalid entries
            const hasId = lookup.id != null && String(lookup.id).trim() !== '';
            const hasKey = lookup.key != null && String(lookup.key).trim() !== '';
            // const hasValue = lookup.value != null; // Value can be empty
            
            const isValid = hasId && hasKey; // Only require ID and Key, value can be empty
            return isValid;
          })
          .map(lookup => ({
            id: String(lookup.id),
            key: String(lookup.key),
            value: String(lookup.value || ''),
            alias_name: String(lookup.alias_name || ''),
            company_id: String(lookup.company_id || '')
          }));

        // Deduplicate by key - keep only the first occurrence of each key
        const uniqueLookups = validLookups.filter((lookup, index, self) => {
          const isFirstOccurrence = index === self.findIndex(t => t.key === lookup.key);
          return isFirstOccurrence;
        });

        // Only update state if component is still mounted
        if (isMounted) {
          setLookups(uniqueLookups);
        }
      } catch (error: any) {
        console.error("Fetch Lookups Error =>", error.message || error);
        toast.error("Failed to fetch lookups: " + (error.message || "Unknown error"));
      }
    };

    // Only fetch if userData is available
    if (userData && userData.company_id) {
      fetchUnits();
      fetchLookups(); // Changed from fetchCollections to fetchLookups
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [userData]); // Added userData to dependency array
  
  const getFieldDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('item_configurator')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) {
        console.error('Fetch error =>', error);
        throw error;
      }

      if (data) {
        reset({
          label: data.name,
          description: data.description || '',
          controlType: data.control_type as 'Textbox' | 'Dropdown' | 'Textarea' | 'Multi Select Dropdown',
          collectionName: data.collection_id ?? undefined,
          dataType: data.data_type as 'text' | 'number' | 'unit' | undefined,
          order: data.sequence,
          maxLength: data.max_length || 0,
          measurementType: data.item_unit_id || undefined,
          isMandatory: data.is_mandatory || false,
        });
      }
    } catch (error: any) {
      console.error('Fetch error =>', error);
      toast.error('Failed to fetch field data: ' + (error.message || 'Unknown error'));
    }
  };

  const handleAddField = async (data: FieldFormValues) => {
    const isValid = await trigger();
    if (!isValid) return;

    const newField = { ...data };

    // Check duplicate NAME in preview list
    if (addedFields.some(field => field.label.trim().toLowerCase() === newField.label.trim().toLowerCase())) {
      toast.error(`Field name "${newField.label}" already exists in the preview list.`);
      return;
    }

    // Check duplicate DISPLAY ORDER in preview list
    if (addedFields.some(field => field.order === newField.order)) {
      toast.error(`Display order ${newField.order} already exists in the preview list. Please choose a different number.`);
      return;
    }

    // Check duplicate NAME in database
    const { data: existingNames, error: nameError } = await supabase
      .from('item_configurator')
      .select('name')
      .eq('company_id', userData.company_id)
      .ilike('name', newField.label);

    if (nameError) {
      console.error('Error checking existing names:', nameError);
      throw nameError;
    }

    if (existingNames && existingNames.length > 0) {
      toast.error(`Item config name "${newField.label}" already exists. Please choose a different name.`);
      return;
    }

    // Check duplicate DISPLAY ORDER in database
    const { data: existingSequences, error: selectError } = await supabase
      .from('item_configurator')
      .select('sequence')
      .eq('company_id', userData.company_id)
      .eq('sequence', newField.order);

    if (selectError) {
      console.error('Error checking existing sequences:', selectError);
      throw selectError;
    }

    if (existingSequences && existingSequences.length > 0) {
      toast.error(`Display order ${newField.order} already exists. Please choose a different number.`);
      return;
    }

    setAddedFields(prev => [...prev, newField]);
    handleResetForm();
  };

  const createFieldConfigs = async () => {
    try {
      if (!userData?.id) {
        toast.error('User data not found. Please login again.');
        return;
      }

      if (addedFields.length === 0) {
        toast.error('Please add at least one field before saving.');
        return;
      }

      const newSequences = addedFields.map(field => field.order);
      const newNames = addedFields.map(field => field.label);

      // Check duplicate SEQUENCE in DB
      const { data: existingSequences, error: selectError } = await supabase
        .from('item_configurator')
        .select('sequence')
        .eq('company_id', userData.company_id)
        .in('sequence', newSequences);

      if (selectError) throw selectError;

      if (existingSequences && existingSequences.length > 0) {
        const existing = existingSequences.map(seq => seq.sequence).join(', ');
        toast.error(`Display order ${existing} already exist. Please choose a different number.`);
        return;
      }

      // Check duplicate NAME in DB
      const { data: existingNames, error: nameError } = await supabase
        .from('item_configurator')
        .select('name')
        .eq('company_id', userData.company_id)
        .in('name', newNames);

      if (nameError) throw nameError;

      if (existingNames && existingNames.length > 0) {
        const existing = existingNames.map(n => n.name).join(', ');
        toast.error(`Item config name(s) already exist: ${existing}`);
        return;
      }

      const payload: any = addedFields.map((field) => ({
        name: field.label,
        description: field.description || '',
        control_type: field.controlType,
        collection_id: (field.controlType === 'Dropdown' || field.controlType === 'Multi Select Dropdown') ? field.collectionName : null,
        data_type: field.controlType === 'Textbox' ? field.dataType : null,
        sequence: field.order,
        max_length: field.controlType === 'Textbox' && field.dataType === 'text' ? field.maxLength : 0,
        item_unit_id: field.dataType === 'unit' ? field.measurementType : null,
        company_id: userData.company_id || null,
        is_mandatory: field.isMandatory || false,
      }));

      const systemLogs = addedFields.map((field) => ({
        company_id: userData.company_id,
        transaction_date: new Date().toISOString(),
        module: 'Item Configurator',
        scope: 'Add',
        key: '',
        log: `Field: ${field.label} created.`,
        action_by: userData?.id,
        created_at: new Date().toISOString(),
      }));

      const validations: any[] = [];
      addedFields.forEach(field => {
         validations.push({
            type: 'unique',
            table: 'item_configurator',
            column: 'name',
            value: field.label,
            company_id: userData.company_id
         });
         validations.push({
            type: 'unique',
            table: 'item_configurator',
            column: 'sequence',
            value: field.order,
            company_id: userData.company_id
         });
      });

      const action_payload = {
        validations,
        operations: [
          ...payload.map((p: any) => ({
            table: 'item_configurator',
            type: 'insert',
            data: p
          })),
          ...systemLogs.map(log => ({
            table: 'system_log',
            type: 'insert',
            data: log
          }))
        ]
      };

      // Initiate Approval using the reusable common function
      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Item Configurator',
        action_name: 'Add',
        company_id: userData.company_id,
        requested_by: userData.id,
        action_payload: action_payload
      });
      
      if (approvalResponse?.success) {
         if (approvalResponse.requires_approval) {
            toast.success('Your action has been submitted and is currently pending approval.');
            setAddedFields([]);
            handleResetForm();
            navigate('/dashboard/itemConfigurator');
         } else {
            // Direct Execution (No active workflow found for this user/store)
            const { error: insertError } = await supabase
              .from('item_configurator')
              .insert(payload);

            if (insertError) throw insertError;
            
            const { error: systemLogError } = await supabase
              .from('system_log')
              .insert(systemLogs);

            if (systemLogError) throw systemLogError;
            
            toast.success('Item fields created successfully!');
            setAddedFields([]);
            handleResetForm();
            navigate('/dashboard/itemConfigurator');
         }
      } else {
         throw new Error(approvalResponse?.message || 'Approval initiation failed');
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error('Failed to create item fields: ' + (error.message || 'Unknown error'));
    }
  };

  const updateFieldConfig = async (data: FieldFormValues) => {
    if (id) {
      const isLocked = await checkEntityLock(id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }

    try {
      // Check duplicate DISPLAY ORDER
      const { data: existingSequences, error: selectError } = await supabase
        .from('item_configurator')
        .select('id, sequence')
        .eq('company_id', userData.company_id)
        .eq('sequence', data.order)
        .neq('id', id!);

      if (selectError) throw selectError;

      if (existingSequences && existingSequences.length > 0) {
        toast.error(`Display order ${data.order} is already used. Please choose a different number.`);
        return;
      }

      // Check duplicate NAME
      const { data: existingNames, error: nameError } = await supabase
        .from('item_configurator')
        .select('id, name')
        .eq('company_id', userData.company_id)
        .ilike('name', data.label)
        .neq('id', id!);

      if (nameError) throw nameError;

      if (existingNames && existingNames.length > 0) {
        toast.error(`Item config name "${data.label}" is already used. Please choose a different name.`);
        return;
      }

      const payload = {
        name: data.label,
        description: data.description || '',
        control_type: data.controlType,
        collection_id: (data.controlType === 'Dropdown' || data.controlType === 'Multi Select Dropdown') ? data.collectionName : null,
        data_type: data.controlType === 'Textbox' ? data.dataType : null,
        sequence: data.order,
        max_length: data.controlType === 'Textbox' && data.dataType === 'text' ? data.maxLength : 0,
        item_unit_id: data.dataType === 'unit' ? data.measurementType : null,
        is_mandatory: data.isMandatory || false,
      };

      const systemLogs = {
        company_id: userData.company_id,
        transaction_date: new Date().toISOString(),
        module: 'Item Configurator',
        scope: 'Edit',
        key: '',
        log: `Field: ${data.label} updated.`,
        action_by: userData.id,
        created_at: new Date().toISOString(),
      };

      const validations = [
        {
          type: 'unique',
          table: 'item_configurator',
          column: 'name',
          value: data.label,
          ignore_id: id,
          company_id: userData.company_id
        },
        {
          type: 'unique',
          table: 'item_configurator',
          column: 'sequence',
          value: data.order,
          ignore_id: id,
          company_id: userData.company_id
        }
      ];

      const action_payload = {
        validations,
        operations: [
          {
            table: 'item_configurator',
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
        module_name: 'Item Configurator',
        action_name: 'Edit',
        company_id: userData.company_id,
        requested_by: userData.id,
        entity_id: id,
        action_payload
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');
          handleResetForm();
          navigate('/dashboard/itemConfigurator');
        } else {
          const { error } = await supabase
            .from('item_configurator')
            .update(payload)
            .eq('id', id!);

          if (error) throw error;

          const { error: systemLogError } = await supabase
            .from('system_log')
            .insert(systemLogs);

          if (systemLogError) throw systemLogError;

          toast.success('Item field updated successfully!');
          handleResetForm();
          navigate('/dashboard/itemConfigurator');
        }
      }
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast.error('Failed to update item field: ' + (error.message || 'Unknown error'));
    }
  };

  const handleResetForm = () => {
    reset({
      label: '',
      description: '',
      controlType: undefined,
      collectionName: undefined,
      dataType: undefined,
      order: 0,
      maxLength: 0,
      measurementType: undefined,
      isMandatory: false,
    });
  };

  const removeAddedField = (index: number) => {
    setAddedFields((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FieldFormValues) => {
    if (isEditMode && id) {
      const isLocked = await checkEntityLock(id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }

    if (isEditMode) {
      await updateFieldConfig(data);
    } else {
      await handleAddField(data);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <LayoutTemplate className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {isEditMode ? 'Update Item Field' : 'Add New Fields'}
                </h1>
                <p className="text-gray-600">
                  {isEditMode ? 'Edit your item field configuration' : 'Create multiple item fields at once'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {(isEditMode || showForm) && (
          <Card className="shadow-md border-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-blue-800">
                    {isEditMode ? 'Update Field Configuration' : 'Add Field Configuration'}
                  </CardTitle>
                  <CardDescription className="text-blue-600">
                    {isEditMode ? 'Edit your field configuration' : 'Define how your field should appear and behave'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2 group">
                    <Label
                      htmlFor="label"
                      className={`${errors.label ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Tag className="h-4 w-4" /> Field Label <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="label"
                      placeholder="e.g. Email Address"
                      {...register('label')}
                      className={`${errors.label
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                      } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${
                        watchedFields.label ? 'border-blue-300' : ''
                      }`}
                    />
                    {errors.label && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.label.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="description"
                      className={`${errors.description ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <FileText className="h-4 w-4" /> Description
                    </Label>
                    <Input
                      id="description"
                      placeholder="e.g. Enter a brief description of the field"
                      {...register('description')}
                      className={`${errors.description
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                      } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${
                        watchedFields.description ? 'border-blue-300' : ''
                      }`}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      htmlFor="isMandatory"
                      className={`${errors.isMandatory ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <Tag className="h-4 w-4" /> Mandatory Field
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isMandatory"
                        {...register('isMandatory')}
                        checked={watchedFields.isMandatory}
                        onCheckedChange={(checked) => setValue('isMandatory', checked === true)}
                      />
                      <Label htmlFor="isMandatory" className="text-sm text-gray-600">
                        Mark this field as mandatory
                      </Label>
                    </div>
                    {errors.isMandatory && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.isMandatory.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group">
                    <Label
                      className={`${errors.controlType ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                    >
                      <List className="h-4 w-4" /> Control Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={watchedFields.controlType || ''}
                      onValueChange={(value) => {
                        setValue('controlType', value as FieldFormValues['controlType']);
                        setValue('collectionName', undefined);
                        setValue('dataType', undefined);
                        setValue('measurementType', undefined);
                      }}
                    >
                      <SelectTrigger
                        className={`${errors.controlType
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                          watchedFields.controlType ? 'border-blue-300' : ''
                        }`}
                      >
                        <SelectValue placeholder="Select Control Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Textbox">Textbox</SelectItem>
                        <SelectItem value="Dropdown">Dropdown</SelectItem>
                        <SelectItem value="Textarea">Textarea</SelectItem>
                        <SelectItem value="Multi Select Dropdown">Multi Select Dropdown</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.controlType && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.controlType.message}
                      </p>
                    )}
                  </div>

                  {(watchedFields.controlType === 'Dropdown' || watchedFields.controlType === 'Multi Select Dropdown') && (
                    <div className="space-y-2 group animate-fadeIn">
                      <Label
                        className={`${errors.collectionName ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <ListOrdered className="h-4 w-4" /> Collection Name <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={watchedFields.collectionName || ''}
                        onValueChange={(value) => setValue('collectionName', value as FieldFormValues['collectionName'])}
                      >
                        <SelectTrigger
                          className={`${errors.collectionName
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                            watchedFields.collectionName ? 'border-blue-300' : ''
                          }`}
                        >
                          <SelectValue placeholder="Select Collection Name" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookups.length === 0 ? (
                            <SelectItem value="no-values" disabled>
                              No collection name available
                            </SelectItem>
                          ) : (
                            (() => {
                              // Track used IDs to prevent duplicates
                              const usedIds = new Set<string>();
                              
                              return lookups
                                .map((lookup) => {
                                  // Handle potential null/undefined values
                                  const id = lookup.id != null ? String(lookup.id) : '';
                                  
                                  // Skip items with empty IDs
                                  if (!id || id.trim() === '') {
                                    return null;
                                  }
                                  
                                  // Skip items with duplicate IDs
                                  if (usedIds.has(id)) {
                                    return null;
                                  }
                                  
                                  // Mark ID as used
                                  usedIds.add(id);
                                  
                                  // Use a fallback value if somehow we still have an empty string
                                  const safeId = id.trim() || `fallback-${Math.random()}`;
                                  
                                  return (
                                    <SelectItem key={safeId} value={safeId}>
                                      {lookup.alias_name?.trim() || lookup.key || 'Unnamed Option'}
                                    </SelectItem>
                                  );
                                })
                                .filter(item => item !== null); // Remove null items
                            })()
                          )}
                        </SelectContent>
                      </Select>
                      {errors.collectionName && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.collectionName.message}
                        </p>
                      )}
                    </div>
                  )}

                  {watchedFields.controlType === 'Textbox' && (
                    <div className="space-y-2 group animate-fadeIn">
                      <Label
                        className={`${errors.dataType ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Type className="h-4 w-4" /> Data Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={watchedFields.dataType || ''}
                        onValueChange={(value) => {
                          setValue('dataType', value as FieldFormValues['dataType']);
                          setValue('measurementType', undefined);
                        }}
                      >
                        <SelectTrigger
                          className={`${errors.dataType
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                            watchedFields.dataType ? 'border-blue-300' : ''
                          }`}
                        >
                          <SelectValue placeholder="Select Data Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="unit">Unit</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.dataType && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.dataType.message}
                        </p>
                      )}
                    </div>
                  )}

                  {watchedFields.dataType === 'unit' && (
                    <div className="space-y-2 group animate-fadeIn">
                      <Label
                        className={`${errors.measurementType ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Ruler className="h-4 w-4" /> Measurement Type
                      </Label>
                      <Select
                        value={watchedFields.measurementType || ''}
                        onValueChange={(value) => setValue('measurementType', value as FieldFormValues['measurementType'])}
                      >
                        <SelectTrigger
                          className={`${errors.measurementType
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                          } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 w-full ${
                            watchedFields.measurementType ? 'border-blue-300' : ''
                          }`}
                        >
                          <SelectValue placeholder="Select Measurement Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.measurementType && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.measurementType.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 group">
                      <Label
                        htmlFor="order"
                        className={`${errors.order ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <ListOrdered className="h-4 w-4" /> Display Order
                      </Label>
                      <Input
                        id="order"
                        type="number"
                        {...register('order', { valueAsNumber: true })}
                        className={`${errors.order
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${
                          watchedFields.order ? 'border-blue-300' : ''
                        }`}
                      />
                      {errors.order && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.order.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 group">
                      <Label
                        htmlFor="maxLength"
                        className={`${errors.maxLength ? 'text-red-500' : 'text-gray-700'} group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`}
                      >
                        <Hash className="h-4 w-4" /> Max Length
                        {(watchedFields.controlType === 'Dropdown' || watchedFields.controlType === 'Multi Select Dropdown' || watchedFields.dataType !== 'text') && (
                          <span className="text-xs text-gray-500 ml-1">(Not applicable)</span>
                        )}
                      </Label>
                      <Input
                        id="maxLength"
                        type="number"
                        disabled={watchedFields.controlType === 'Dropdown' || watchedFields.controlType === 'Multi Select Dropdown' || watchedFields.dataType !== 'text'}
                        {...register('maxLength', { valueAsNumber: true })}
                        className={`${errors.maxLength && watchedFields.controlType !== 'Dropdown' && watchedFields.dataType === 'text'
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                        } pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200 ${
                          watchedFields.controlType === 'Dropdown' || watchedFields.controlType === 'Multi Select Dropdown' || watchedFields.dataType !== 'text'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : watchedFields.maxLength
                            ? 'border-blue-300'
                            : ''
                        }`}
                        placeholder={
                          watchedFields.controlType === 'Dropdown' || watchedFields.controlType === 'Multi Select Dropdown' || watchedFields.dataType !== 'text'
                            ? 'N/A'
                            : 'Enter max length'
                        }
                      />
                      {errors.maxLength && watchedFields.controlType !== 'Dropdown' && watchedFields.controlType !== 'Multi Select Dropdown' && watchedFields.dataType === 'text' && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.maxLength.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard/itemConfigurator')}
                    className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2 text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : isEditMode ? 'Update Field' : 'Add Field'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {!isEditMode && addedFields.length > 0 && (
          <Card className="shadow-md border-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-xl font-semibold text-green-800">Added Fields Preview</CardTitle>
                    <CardDescription className="text-green-600 mt-1">
                      Review and manage your configured fields before saving
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(!showForm)}
                  className="text-gray-600 hover:bg-gray-100"
                >
                  {showForm ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Hide Form
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Show Form
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6 max-h-[250px] overflow-y-auto">
                {addedFields.map((field, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-5 bg-green-50 relative"
                    role="region"
                    aria-label={`Field ${field.label}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-gray-700">Field Label</Label>
                            <p className="text-sm font-bold text-gray-900">{field.label}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-gray-700">Description</Label>
                            <p className="text-sm font-bold text-gray-900">{field.description || 'None'}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-gray-700">Mandatory</Label>
                            <p className="text-sm font-bold text-gray-900">{field.isMandatory ? 'Yes' : 'No'}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-gray-700">Control Type</Label>
                            <p className="text-sm font-bold text-gray-900">{field.controlType}</p>
                          </div>
                          {(field.controlType === 'Dropdown' || field.controlType === 'Multi Select Dropdown') && field.collectionName && (
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold text-gray-700">Collection Name</Label>
                              <p className="text-sm font-bold text-gray-900">
                                {
                                  lookups.find((lookup) => lookup.id === field.collectionName)?.alias_name
                                  ||
                                  lookups.find((lookup) => lookup.id === field.collectionName)?.key
                                  ||
                                  'Unknown'
                                }
                              </p>
                            </div>
                          )}
                          {field.controlType === 'Textbox' && field.dataType && (
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold text-gray-700">Data Type</Label>
                              <p className="text-sm font-bold text-gray-900 capitalize">{field.dataType}</p>
                            </div>
                          )}
                          {field.measurementType && field.dataType === 'unit' && (
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold text-gray-700">Measurement Type</Label>
                              <p className="text-sm font-bold text-gray-900 capitalize">
                                {units.find((unit) => unit.id === field.measurementType)?.name || 'Unknown'}
                              </p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold text-gray-700">Display Order</Label>
                            <p className="text-sm font-bold text-gray-900">{field.order}</p>
                          </div>
                          {field.controlType === 'Textbox' && field.dataType === 'text' && (
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold text-gray-700">Max Length</Label>
                              <p className="text-sm font-bold text-gray-900">{field.maxLength}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            reset(field);
                            setShowForm(true);
                            removeAddedField(index);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          aria-label={`Edit field ${field.label}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeAddedField(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          aria-label={`Remove field ${field.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-gray-600">
                  Total Fields: <span className="font-semibold">{addedFields.length}</span>
                </div>
                <Button
                  onClick={createFieldConfigs}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 flex items-center gap-2 px-6 py-2"
                  aria-label="Save all configured fields"
                >
                  <Save className="h-5 w-5" />
                  {isSubmitting ? 'Saving...' : 'Save All Fields'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ItemConfigForm;
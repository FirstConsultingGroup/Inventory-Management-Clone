import { useParams, useNavigate } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  UserPlus,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/Utils/types/supabaseClient';
import { Database } from '@/Utils/types/database.types';
import { initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Database types
type CustomerInsert = Database['public']['Tables']['customer_mgmt']['Insert'];

// Form field configuration interface
interface FormFieldConfig {
  name: keyof CustomerFormValues;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  options?: { value: string; label: string }[];
  validation?: z.ZodTypeAny;
  gridCols?: 1 | 2;
}

// Dynamic form configuration
const formFieldsConfig: FormFieldConfig[] = [
  {
    name: 'fullname',
    label: 'Full Name',
    type: 'text',
    placeholder: 'Enter full name',
    required: true,
    icon: User,
    validation: z.string().min(1, 'Full name is required').max(100, 'Full name must be less than 100 characters'),
    gridCols: 2,
  },
  {
    name: 'phone',
    label: 'Phone Number',
    type: 'tel',
    placeholder: '10 digits',
    required: true,
    icon: Phone,
    validation: z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits'),
    gridCols: 2,
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'example@example.com',
    icon: Mail,
    validation: z.string().email('Invalid email format').optional().or(z.literal('')).refine((val) => val === val!.toLowerCase(), {
    message: "Email must not contain uppercase letters"
  }),
    gridCols: 2,
  },
  {
    name: 'type',
    label: 'Customer Type',
    type: 'select',
    required: true,
    icon: User,
    options: [
      { value: 'Retail', label: 'Retail' },
      { value: 'Wholesale', label: 'Wholesale' },
      { value: 'VIP', label: 'VIP' },
    ],
    validation: z.enum(['Retail', 'Wholesale', 'VIP'], {
      required_error: 'Please select a customer type',
    }),
    gridCols: 2,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    icon: CheckCircle,
    options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' },
    ],
    validation: z.enum(['true', 'false'], {
      required_error: 'Please select a status',
    }),
    gridCols: 2,
  },
  {
    name: 'notifications',
    label: 'Email Alert',
    type: 'checkbox',
    icon: Mail,
    validation: z.boolean().default(false),
    gridCols: 2,
  },
  {
    name: 'address',
    label: 'Address',
    type: 'textarea',
    placeholder: 'Enter customer address',
    icon: MapPin,
    validation: z.string().max(500, 'Address must be less than 500 characters').optional().or(z.literal('')),
    gridCols: 1,
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Additional notes about the customer',
    icon: Calendar,
    validation: z.string().max(1000, 'Notes must be less than 1000 characters').optional().or(z.literal('')),
    gridCols: 1,
  },
];

// Dynamic schema generation
const createFormSchema = () => {
  const schemaFields: Record<string, z.ZodTypeAny> = {};
  
  formFieldsConfig.forEach(field => {
    if (field.validation) {
      schemaFields[field.name] = field.validation;
    }
  });
  
  return z.object(schemaFields);
};

const customerFormSchema = createFormSchema();
type CustomerFormValues = z.infer<typeof customerFormSchema>;

// Generate customer ID
function generateCustomerId(lastNumber = 1): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const serial = String(lastNumber).padStart(4, '0');
  return `CUST-${dd}${mm}${yy}-${serial}`;
}

// Dynamic field renderer component
const FormFieldRenderer: React.FC<{
  field: FormFieldConfig;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  clearValidationErrors: () => void;
}> = ({ field, register, errors, watch, setValue, clearValidationErrors }) => {
  const IconComponent = field.icon;
  const fieldError = errors[field.name];
  const fieldValue = watch(field.name);

  const baseInputClasses = `${
    fieldError 
      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
  } transition-all duration-200`;

  const labelClasses = `${
    fieldError ? 'text-red-500' : 'text-gray-700'
  } group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-1 font-medium`;

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <Input
            id={field.name}
            type={field.type}
            placeholder={field.placeholder}
            {...register(field.name)}
            onChange={() => {
              if (fieldError) {
                clearValidationErrors();
              }
            }}
            className={`${baseInputClasses} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
          />
        );

      case 'select':
        return (
          <Select 
            value={fieldValue} 
            onValueChange={(value) => {
              setValue(field.name, value);
              if (fieldError) {
                clearValidationErrors();
              }
            }}
          >
            <SelectTrigger className={`${baseInputClasses} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            {...register(field.name)}
            onChange={() => {
              if (fieldError) {
                clearValidationErrors();
              }
            }}
            className={`w-full resize-none min-h-[100px] ${baseInputClasses} pl-3 pr-3 py-2 rounded-md shadow-sm focus:ring-4 transition-all duration-200`}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={fieldValue}
              onCheckedChange={(checked) => {
                setValue(field.name, checked as boolean);
              }}
              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <Label htmlFor={field.name} className="text-sm text-gray-600">
              Enable email notifications for this customer
            </Label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`space-y-2 group ${field.gridCols === 1 ? 'md:col-span-2' : ''}`}>
      <Label htmlFor={field.name} className={labelClasses}>
        {IconComponent && <IconComponent className="h-4 w-4" />} 
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </Label>
      {renderField()}
      {fieldError && (
        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
          <AlertCircle className="h-3 w-3" />
          {fieldError.message}
        </p>
      )}
    </div>
  );
};

export default function CustomerForm() {
  const userData = localStorage.getItem('userData');
  const user = userData ? JSON.parse(userData) : null;
  const companyId = user?.company_id;
  const userId = user?.id;

  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(false);
  const [_, setError] = useState('');
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>('');

  // Create default values dynamically
  const createDefaultValues = (): CustomerFormValues => {
    const defaults: any = {};
    formFieldsConfig.forEach(field => {
      if (field.type === 'checkbox') {
        defaults[field.name] = false;
      } else if (field.name === 'type') {
        defaults[field.name] = 'Retail';
      } else if (field.name === 'status') {
        defaults[field.name] = 'true';
      } else {
        defaults[field.name] = '';
      }
    });
    return defaults;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    trigger,
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: createDefaultValues(),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  // Generate customer ID for new customers
  useEffect(() => {
    const fetchAndSetNextCustomerId = async () => {
      if (isEditing) return;
      if (!companyId) return;
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const todayPrefix = `CUST-${dd}${mm}${yy}-`;
      
      const { data, error } = await supabase
        .from('customer_mgmt')
        .select('customer_id')
        .eq('company_id', companyId)
        .like('customer_id', `${todayPrefix}%`)
        .order('customer_id', { ascending: false })
        .limit(1);
      
      let nextSerial = 1;
      if (!error && data && data.length > 0 && data[0].customer_id) {
        const match = data[0].customer_id.match(/-(\d{4})$/);
        if (match) {
          nextSerial = parseInt(match[1], 10) + 1;
        }
      }
      
      // Store the generated ID for later use
      localStorage.setItem('nextCustomerId', generateCustomerId(nextSerial));
    };
    
    fetchAndSetNextCustomerId();
  }, [isEditing, companyId]);

  // Fetch customer data for editing
  useEffect(() => {
    if (isEditing && id) {
      setIsLoading(true);
      const fetchCustomer = async () => {
        try {
          const { data, error } = await supabase
            .from('customer_mgmt')
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single();

          if (error || !data) throw new Error('Failed to fetch customer');

          // Map database fields to form fields
          const formData: any = {};
          formFieldsConfig.forEach(field => {
            switch (field.name) {
              case 'fullname':
                formData[field.name] = data.fullname || '';
                break;
              case 'phone':
                formData[field.name] = data.phone || '';
                break;
              case 'email':
                formData[field.name] = data.email || '';
                break;
              case 'type':
                formData[field.name] = data.type || 'Retail';
                break;
              case 'status':
                formData[field.name] = data.status ? 'true' : 'false';
                break;
              case 'notifications':
                formData[field.name] = data.notifications || false;
                break;
              case 'address':
                formData[field.name] = data.address || '';
                break;
              case 'notes':
                formData[field.name] = data.notes || '';
                break;
              default:
                formData[field.name] = '';
            }
          });

          reset(formData);
          setCurrentCustomerId(data.customer_id);
        } catch (err) {
          setError('Failed to load customer data');
        } finally {
          setIsLoading(false);
        }
      };
      fetchCustomer();
    }
  }, [id, isEditing, reset, companyId]);

  // Helper function to clear validation errors
  const clearValidationErrors = () => {
    setError('');
  };

  // Function to handle form submission with proper validation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any existing validation errors
    clearValidationErrors();
    
    // Trigger validation for all fields
    const isValid = await trigger();
    
    if (!isValid) {
      setError('Please fix the validation errors before submitting.');
      return;
    }
    
    // If validation passes, submit the form
    handleSubmit(onSubmit)(e);
  };

  const onSubmit: SubmitHandler<CustomerFormValues> = async (data) => {
    console.log('Form submitted with data:', data);
    setError('');

    if (isEditing && id) {
      const isLocked = await checkEntityLock(id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }
    }
    
    try {
      setIsLoading(true);

      // Map form data to database fields
      const customerPayload: CustomerInsert = {
        fullname: data.fullname,
        phone: data.phone,
        email: data.email || null,
        address: data.address || '',
        type: data.type,
        notes: data.notes || null,
        status: data.status === 'true',
        notifications: data.notifications,
        company_id: companyId,
        created_by: userId,
        modified_at: isEditing ? new Date().toISOString() : undefined,
        modified_by: isEditing ? userId : undefined,
      };


      if (isEditing && id) {
         // Create system log
        const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: 'Customer Management',
          scope: 'Edit',
          key: `${currentCustomerId}`,
          log: `Customer: ${currentCustomerId} updated.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'customer_mgmt',
            column: 'phone',
            value: data.phone,
            company_id: companyId,
            ignore_id: id
          },
          ...(data.email ? [{
            type: 'unique',
            table: 'customer_mgmt',
            column: 'email',
            value: data.email,
            company_id: companyId,
            ignore_id: id
          }] : [])
        ],
        operations: [
          {
            table: 'customer_mgmt',
            type: 'update',
            data: customerPayload,
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
        module_name: 'Customers',
        action_name: 'Edit',
        company_id: companyId,
        requested_by: userId,
        action_payload,
        entity_id: id
      });

      if (approvalResponse?.success) {
        if (approvalResponse.requires_approval) {
          toast.success('Your action has been submitted and is currently pending approval.');

        } else {

          const { data: updatedCustomer, error } = await supabase
          .from('customer_mgmt')
          .update(customerPayload)
          .eq('id', id)
          .eq('company_id', companyId)
          .select()
          .single();
        
        if (error || !updatedCustomer) throw error || new Error('Customer update failed');

        const { error: systemLogError } = await supabase
          .from('system_log')
          .insert(systemLogs);

        if (systemLogError) throw systemLogError;
        toast.success('Customer updated successfully!');

        }}

      } else {
        // Get the generated customer ID
        const nextCustomerId = localStorage.getItem('nextCustomerId') || generateCustomerId();

         // Create system log
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

        const action_payload = {
        validations: [
          {
            type: 'unique',
            table: 'customer_mgmt',
            column: 'phone',
            value: data.phone,
            company_id: companyId
          },
          ...(data.email ? [{
            type: 'unique',
            table: 'customer_mgmt',
            column: 'email',
            value: data.email,
            company_id: companyId
          }] : [])
        ],
        operations: [
          {
            table: 'customer_mgmt',
            type: 'insert',
            data: {
              ...customerPayload,
              customer_id: nextCustomerId,
              created_at: new Date().toISOString(),
            },
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
        module_name: 'Customers',
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
          const { data: newCustomer, error } = await supabase
          .from('customer_mgmt')
          .insert([{
            ...customerPayload,
            customer_id: nextCustomerId,
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();
        
        if (error || !newCustomer) throw error || new Error('Customer creation failed');

        const { error: systemLogError } = await supabase
          .from('system_log')
          .insert(systemLogs);

        if (systemLogError) throw systemLogError;
        toast.success('Customer created successfully!');
         }}

        // Clear the stored customer ID
        localStorage.removeItem('nextCustomerId');
      }

      setTimeout(() => navigate('/dashboard/customer-management'), 1000);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      setError(error.message || 'Failed to save customer. Please check all fields and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && isEditing) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading customer data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
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
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditing ? 'Update Customer' : 'Create New Customer'}
              </h1>
              <p className="text-gray-600">Create or update customer information</p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">Customer Information</CardTitle>
            <CardDescription className="text-blue-600">
              {isEditing ? 'Update the customer details below' : 'Fill in the customer details below to create a new customer'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formFieldsConfig.map((field) => (
                  <FormFieldRenderer
                    key={field.name}
                    field={field}
                    register={register}
                    errors={errors}
                    watch={watch}
                    setValue={setValue}
                    clearValidationErrors={clearValidationErrors}
                  />
                ))}
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  * Required fields
                </div>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard/customer-management')}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className= "text-white transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {(isSubmitting || isLoading) ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {isEditing ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        {isEditing ? 'Update Customer' : 'Create Customer'}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

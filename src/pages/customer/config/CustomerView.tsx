import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
//   Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building,
  MessageSquare,
  Bell,
  BellOff,
  Clock
} from 'lucide-react';
import { supabase } from "@/Utils/types/supabaseClient";
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { toast } from 'react-hot-toast';
import { useApprovalDocument } from '@/hooks/useApprovalDocument';

// Types
interface Customer {
  id: string;
  customer_id: string;
  fullname: string;
  phone: string;
  email: string | null;
  address: string | null;
  type: 'Retail' | 'Wholesale' | 'VIP';
  status: boolean;
  notifications: boolean;
  notes: string | null;
  created_at: string;
  modified_at: string | null;
  created_by: string;
  modified_by: string | null;
  company_id: string;
}

interface InfoFieldProps {
  label: string;
  value: string | number | boolean | null;
  icon: React.ComponentType<{ className?: string }>;
  type?: 'text' | 'email' | 'phone' | 'textarea' | 'badge' | 'boolean';
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
}

// Custom Badge Component
const CustomBadge: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' 
}> = ({ children, variant = 'default' }) => {
  const variantStyles = {
    default: 'bg-blue-100 text-blue-800 border-blue-200',
    secondary: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    destructive: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]}`}>
      {children}
    </span>
  );
};

const InfoField: React.FC<InfoFieldProps> = ({ 
  label, 
  value, 
  icon: Icon, 
  type = 'text',
}) => {
  const renderValue = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-500 italic">Not provided</span>;
    }

    switch (type) {
      case 'email':
        return (
          <a 
            href={`mailto:${value}`} 
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {value}
          </a>
        );
      case 'phone':
        return (
          <a 
            href={`tel:${value}`} 
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {value}
          </a>
        );
      case 'textarea':
        return (
          <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded-md border min-h-[100px]">
            {value || <span className="text-gray-500 italic">No additional information</span>}
          </div>
        );
      case 'badge':
        const badgeVariants = {
          'Retail': 'default',
          'Wholesale': 'secondary', 
          'VIP': 'destructive'
        };
        return (
          <CustomBadge variant={badgeVariants[value as keyof typeof badgeVariants] as any}>
            {value}
          </CustomBadge>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            {value ? (
              <>
                <Bell className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">Enabled</span>
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 text-gray-500" />
                <span className="text-gray-500">Disabled</span>
              </>
            )}
          </div>
        );
      default:
        return <span className="font-medium">{value}</span>;
    }
  };

  return (
    <div className="space-y-2 group">
      <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <div className="pl-6">
        {renderValue()}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: boolean }> = ({ status }) => {
  return (
    <CustomBadge 
      variant={status ? 'success' : 'destructive'}
    >
      {status ? (
        <>
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3 mr-1" />
          Inactive
        </>
      )}
    </CustomBadge>
  );
};

export default function CustomerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Get user data from localStorage
  const userData = localStorage.getItem('userData');
  const user = userData ? JSON.parse(userData) : null;
  const companyId = user?.company_id;

  const {
      data: customer,
      isPending,
      actionName,
      requestDetails,
      isLoading,
      error
  } = useApprovalDocument<Customer>({
      id: id === 'pending' ? undefined : id,
      tableName: 'customer_mgmt'
  });

  let displayCustomer = customer;
  if (isPending && customer && 'operations' in (customer as any)) {
      const ops = (customer as any).operations;
      const customerOp = ops?.find((op: any) => op.table === 'customer_mgmt');
      if (customerOp && customerOp.data) {
          displayCustomer = { ...customer, ...customerOp.data } as Customer;
      }
  }

//   const formatDate = (dateString: string | null) => {
//     if (!dateString) return 'N/A';
//     return new Date(dateString).toLocaleDateString('en-US', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <p className="text-lg font-medium text-gray-700">Loading customer details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
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
              <div className="p-2 rounded-lg bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Error</h1>
                <p className="text-gray-600">Unable to load customer details</p>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {error || 'Customer Not Found'}
                </h3>
                <p className="text-gray-600 mb-6">
                  The customer you're looking for doesn't exist or you don't have permission to view it.
                </p>
                <Button 
                  onClick={() => navigate(-1)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Customer Management
                </Button>
              </div>
            </CardContent>
          </Card>
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
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">Customer Details</h1>
              <p className="text-gray-600">View comprehensive customer information</p>
            </div>
          </div>
        </div>

        {/* Customer Information Card */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
          <CardContent className="pt-6 space-y-8">
            <div className="space-y-12">
              {/* Basic Information */}
              <div>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoField 
                    label="Full Name" 
                    value={displayCustomer?.fullname || null}
                    icon={User}
                  />
                  <InfoField 
                    label="Phone Number" 
                    value={displayCustomer?.phone || null}
                    icon={Phone}
                    type="phone"
                  />
                  <InfoField 
                    label="Email Address" 
                    value={displayCustomer?.email || null}
                    icon={Mail}
                    type="email"
                  />
                  <InfoField 
                    label="Customer Type" 
                    value={displayCustomer?.type || null}
                    icon={Building}
                    type="badge"
                  />
                  <div className="space-y-2 group">
                    <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Status
                    </Label>
                    <div className="pl-6">
                      <StatusBadge status={displayCustomer?.status ?? false} />
                    </div>
                  </div>
                  <InfoField 
                    label="Email Notifications" 
                    value={displayCustomer?.notifications ?? null}
                    icon={Bell}
                    type="boolean"
                  />
                </div>
              </div>

              {/* Address Information */}
              <div>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-800">Address Information</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <InfoField 
                    label="Address" 
                    value={displayCustomer?.address || null}
                    icon={MapPin}
                    type="textarea"
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-800">Additional Information</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <InfoField 
                    label="Notes" 
                    value={displayCustomer?.notes || null}
                    icon={MessageSquare}
                    type="textarea"
                  />
                </div>
              </div>

              {/* System Information */}
              {/* <div>
                <div className="flex items-center gap-2 mb-6 border-b pb-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-800">System Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4" />
                      Created Date
                    </Label>
                    <div className="pl-6">
                      <span className="font-medium">{formatDate(displayCustomer?.created_at || null)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <Label className="text-gray-700 group-hover:text-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4" />
                      Last Modified
                    </Label>
                    <div className="pl-6">
                      <span className="font-medium">{formatDate(displayCustomer?.modified_at || null)}</span>
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
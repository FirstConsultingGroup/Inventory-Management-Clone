import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import toast from 'react-hot-toast';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { Badge } from '@/components/ui/badge';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';

// Customer interface matching the database structure
interface Customer {
  id: string;
  customer_id: string;
  fullname: string;
  phone: string;
  email?: string;
  address?: string;
  type: 'Corporate' | 'Premium' | 'Regular';
  notes?: string;
  status: boolean; // true = Active, false = Inactive
  notifications: boolean;
  created_at: string;
  created_by: string;
  modified_by: string;
  modified_at: string;
  is_active: boolean; // true = not deleted, false = deleted
}

type SortField = 'customer_id' | 'fullname' | 'phone' | 'email' | 'address' | 'type' | 'status' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  column: SortField;
  order: SortOrder;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface DataResponse {
  data: any[];
  pagination: any;
}

const SortIndicator = ({ column, sortConfig }: { column: SortField, sortConfig: SortConfig | null }) => {
  if (!sortConfig || sortConfig.column !== column) {
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  }
  if (sortConfig.order === 'asc') {
    return <ArrowUp className="h-4 w-4 text-gray-400" />;
  }
  return <ArrowDown className="h-4 w-4 text-gray-400" />;
};

export const CustomerManagement: React.FC = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem("userData");
  const userData = user ? JSON.parse(user) : null;

  // State variables
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'created_at', order: 'desc' });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [statusOptions, setStatusOptions] = useState<Array<{ value: 'active' | 'inactive'; label: string }>>([]);
  const [customersWithActiveInvoices, setCustomersWithActiveInvoices] = useState<Set<string>>(new Set());
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';


  // Refs to track previous values (same pattern as ItemConfigurator)
  const prevSearchTerm = useRef(searchTerm);
  const prevStatusFilter = useRef(statusFilter);
  const prevCustomerTypeFilter = useRef(customerTypeFilter);
  const prevSortConfig = useRef(sortConfig);
  const isInitialLoad = useRef(true);

  const fetchCustomers = useCallback(async (page: number = currentPage) => {
    if (!userData) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('customer_mgmt')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .eq('company_id', userData?.company_id || userData?.id);

      // Apply search filter (same pattern as ItemConfigurator)
      if (searchTerm.trim()) {
        query = query.or(`fullname.ilike.%${searchTerm.trim()}%,customer_id.ilike.%${searchTerm.trim()}%,phone.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%,address.ilike.%${searchTerm.trim()}%`);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        const statusValue = statusFilter === 'active';
        query = query.eq('status', statusValue);
      }

      // Apply customer type filter
      if (customerTypeFilter !== 'all') {
        const typeValue = customerTypeFilter.charAt(0).toUpperCase() + customerTypeFilter.slice(1);
        query = query.eq('type', typeValue);
      }

      // Apply sorting
      if (sortConfig) {
        query = query.order(sortConfig.column, { ascending: sortConfig.order === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error: supabaseError, count } = await query;

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      setCustomers(data as Customer[]);

      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      setPagination({
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage
      });

    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      setCustomers([]);
      setPagination(prev => ({ ...prev, currentPage: page, totalPages: 0, totalItems: 0 }));
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [userData, itemsPerPage, searchTerm, statusFilter, customerTypeFilter, sortConfig]);

  // Load distinct status options from Supabase (derived from customer_mgmt.status)
  useEffect(() => {
    if (!userData) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('customer_mgmt')
          .select('status')
          .eq('is_active', true)
          .eq('company_id', userData?.company_id || userData?.id);

        if (error) {
          console.error('Error fetching status options:', error);
          toast.error('Failed to load status options');
          return;
        }

        const uniqueStatuses = Array.from(new Set((data as { status: boolean }[]).map(r => r.status)));
        const options = uniqueStatuses
          .map((b) => ({ value: b ? 'active' as const : 'inactive' as const, label: b ? 'Active' : 'Inactive' }))
          // Ensure stable order: Active first, then Inactive
          .sort((a, b) => ((a.value === 'active') ? 0 : 1) - ((b.value === 'active') ? 0 : 1));
        setStatusOptions(options);
      } catch (e) {
        console.error('Unexpected error fetching status options:', e);
        toast.error('Unexpected error loading status options');
      }
    })();
  }, [userData?.company_id, userData?.id]);

  // Fetch active invoices to check which customers have active invoices
  useEffect(() => {
    if (!userData) return;
    (async () => {
      try {
        // Step 1: Get all invoices with status using RPC (same pattern as InvoiceManagement)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_sales_invoices_paginated', {
          company_id_param: userData?.company_id || userData?.id,
          search_query: '',
          status_filter: 'all',
          date_from: undefined,
          date_to: undefined,
          page: 1,
          limit_param: -1, // Get all invoices
          sort_field: 'invoice_date',
          sort_order: 'desc'
        });

        if (rpcError) {
          console.error('Error fetching active invoices from RPC:', rpcError);
          return;
        }

        // Step 2: Get customer_id mapping from sales_invoice table
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('sales_invoice')
          .select('id, customer_id')
          .eq('company_id', userData?.company_id || userData?.id)
          .not('customer_id', 'is', null);

        if (invoiceError) {
          console.error('Error fetching invoice customer mapping:', invoiceError);
          return;
        }

        // Step 3: Create a map of invoice id to customer_id
        const invoiceToCustomerMap = new Map<string, string>();
        if (invoiceData) {
          invoiceData.forEach((invoice: { id: string; customer_id: string | null }) => {
            if (invoice.customer_id) {
              invoiceToCustomerMap.set(invoice.id, invoice.customer_id);
            }
          });
        }

        // Step 4: Match RPC invoices with customer_id and filter by status
        const customerIdsWithActiveInvoices = new Set<string>();
        if (rpcData) {
          const response = rpcData as unknown as DataResponse;
          const invoices = response?.data || [];
          
          invoices.forEach((invoice: any) => {
            const status = invoice.status;
            const invoiceId = invoice.id;
            
            // Get customer_id from the map
            const customerId = invoiceToCustomerMap.get(invoiceId);
            
            // If invoice has pending or overdue status and has a customer_id, add to set
            if (customerId && status && (status === 'pending' || status === 'overdue')) {
              customerIdsWithActiveInvoices.add(customerId);
            }
          });
        }
        
        console.log('Customers with active invoices:', Array.from(customerIdsWithActiveInvoices));
        setCustomersWithActiveInvoices(customerIdsWithActiveInvoices);
      } catch (e) {
        console.error('Unexpected error fetching active invoices:', e);
      }
    })();
  }, [userData?.company_id, userData?.id]);

  // Handle search and filter changes with debouncing (same pattern as ItemConfigurator)
  useEffect(() => {
    const searchChanged = prevSearchTerm.current !== searchTerm;
    const statusFilterChanged = prevStatusFilter.current !== statusFilter;
    const typeFilterChanged = prevCustomerTypeFilter.current !== customerTypeFilter;
    const sortChanged = JSON.stringify(prevSortConfig.current) !== JSON.stringify(sortConfig);

    // Update refs
    prevSearchTerm.current = searchTerm;
    prevStatusFilter.current = statusFilter;
    prevCustomerTypeFilter.current = customerTypeFilter;
    prevSortConfig.current = sortConfig;

    // Skip initial load to prevent double fetching
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // Reset to page 1 only if search/filter changed, not sort
    if (searchChanged || statusFilterChanged || typeFilterChanged) {
      setCurrentPage(1);
      const handler = setTimeout(() => {
        fetchCustomers(1);
      }, 300); // Debounce search
      return () => clearTimeout(handler);
    }

    // For sort changes, use current page and fetch immediately
    if (sortChanged) {
      fetchCustomers(currentPage);
    }
  }, [searchTerm, statusFilter, customerTypeFilter, sortConfig, fetchCustomers]);

  // Handle pagination changes
  useEffect(() => {
    if (!isInitialLoad.current) {
      fetchCustomers(currentPage);
    }
  }, [currentPage]);

  // Handle items per page changes
  useEffect(() => {
    if (!isInitialLoad.current) {
      setCurrentPage(1);
      fetchCustomers(1);
    }
  }, [itemsPerPage]);

  // Initial load
  useEffect(() => {
    if (isInitialLoad.current) {
      fetchCustomers(1);
    }
  }, []);

  const exportCustomersToCSV = async () => {
    await exportSupabaseTableToCSV<Customer>({
      reportTitle: 'Customer Management',
      headers: ['Customer ID', 'Full Name', 'Phone', 'Email', 'Address', 'Type', 'Status', 'Notifications', 'Date Added', 'Notes'],
      rowMapper: (customer: Customer) => [
        `"${customer.customer_id}"`,
        `"${customer.fullname}"`,
        `"${customer.phone}"`,
        `"${customer.email || ''}"`,
        `"${customer.address || ''}"`,
        `"${customer.type}"`,
        `"${customer.status ? 'Active' : 'Inactive'}"`,
        `"${customer.notifications ? 'Yes' : 'No'}"`,
        `"${new Date(customer.created_at).toLocaleDateString()}"`,
        `"${customer.notes || ''}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('customer_mgmt')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', userData?.company_id || userData?.id);

        if (searchTerm.trim()) {
          const sanitizedQuery = searchTerm.replace(/[%_]/g, '');
          query = query.or(`fullname.ilike.%${sanitizedQuery.trim()}%,customer_id.ilike.%${sanitizedQuery.trim()}%,phone.ilike.%${sanitizedQuery.trim()}%,email.ilike.%${sanitizedQuery.trim()}%,address.ilike.%${sanitizedQuery.trim()}%`);
        }

        if (statusFilter !== 'all') {
          const statusValue = statusFilter === 'active';
          query = query.eq('status', statusValue);
        }

        if (customerTypeFilter !== 'all') {
          const typeValue = customerTypeFilter.charAt(0).toUpperCase() + customerTypeFilter.slice(1);
          query = query.eq('type', typeValue);
        }

        if (sortConfig) {
          query = query.order(sortConfig.column, { ascending: sortConfig.order === 'asc' });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Customer[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export customers: ${err.message}`),
    });
  };

  const deleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const isLocked = await checkEntityLock(customerToDelete.id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }

      // Create system log
      const systemLogs = {
        company_id: userData?.company_id,
        transaction_date: new Date().toISOString(),
        module: 'Customer Management',
        scope: 'Delete',
        key: `${customerToDelete.customer_id}`,
        log: `Customer: ${customerToDelete.customer_id} deleted.`,
        action_by: userData?.id,
        created_at: new Date().toISOString(),
      };

       const action_payload = {
                operations: [
                    {
                        table: 'customer_mgmt',
                        type: 'delete',
                        match: { id: customerToDelete.id, company_id: userData?.company_id ?? userData?.id ?? '' }
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
                action_name: 'Delete',
                company_id: userData?.company_id || '',
                requested_by: userData?.id || '',
                action_payload,
                entity_id: customerToDelete.id
            });

            if (approvalResponse?.success) {
                if (approvalResponse.requires_approval) {
                    toast.success('Your action has been submitted and is currently pending approval.');
              
                } else {
                   const { error: supabaseError } = await supabase
        .from('customer_mgmt')
        .update({ 
          is_active: false,
          modified_at: new Date().toISOString(),
          modified_by: userData?.id
        })
        .eq('id', customerToDelete.id)
        .eq('company_id', userData?.company_id ?? userData?.id ?? '');

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;
      
      toast.success("Customer deleted successfully!");
                }}

      fetchCustomers(currentPage);
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);

    } catch (error: unknown) {
      console.error('Error deleting customer:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete customer';
      toast.error(message);
    }
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleSort = (column: SortField) => {
    setSortConfig(prev => {
      if (prev && prev.column === column) {
        return { column, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { column, order: 'asc' };
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    if (newItemsPerPage !== itemsPerPage) {
      setItemsPerPage(newItemsPerPage);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCustomerTypeFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleEditClick = (customer: Customer) => {
    navigate(`/dashboard/customer-management/edit/${customer.id}`);
  };

  const handleViewClick = (customer: Customer) => {
    navigate(`/dashboard/customer-management/view/${customer.id}`);
  };

  const getStatusBadgeColor = (status: boolean) => {
    return status 
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-red-100 text-red-800 border-red-300';
  };

  const getCustomerTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Wholesale':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'VIP':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Retail':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(
          appCode,
          'Customer Master',
          userData.user_id
        );

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };

    fetchPermissions();
  }, [userData?.user_id]);
  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find(
      (p: any) =>
        p.action_id?.actionName?.toLowerCase() ===
        actionName.toLowerCase()
    );

    return perm ? perm.isAllowed : false;
  };

  return (
    <TooltipProvider>
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="min-h-[85vh] shadow-sm">
            <CardHeader className="rounded-t-lg border-b pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Customer Management
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage your customer information and relationships
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                 <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        variant="outline"
        onClick={exportCustomersToCSV}
        className="transition-colors"
        disabled={
          !hasPermission("Export") ||
          customers.length === 0
        }
      >
        <Download className="mr-2 h-4 w-4" />
        <span>Export CSV</span>
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {!hasPermission("Export")
      ? "You do not have permission to export"
      : customers.length === 0
        ? "No customers available to export"
        : "Export Customers"}
  </TooltipContent>
</Tooltip>
                  <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        onClick={() =>
          hasPermission("Add") &&
          navigate('/dashboard/customer-management/add')
        }
        className="transition-colors"
        disabled={!hasPermission("Add")}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Customer
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {hasPermission("Add")
      ? "Add Customer"
      : "You do not have permission to create customers"}
  </TooltipContent>
</Tooltip>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Select
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value)}
                      >
                        <SelectTrigger className="w-full sm:w-[140px]">
                          <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                      <Select
                        value={customerTypeFilter}
                        onValueChange={(value) => setCustomerTypeFilter(value)}
                      >
                        <SelectTrigger className="w-full sm:w-[140px]">
                          <SelectValue placeholder="Filter by Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="wholesale">Wholesale</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearFilters}
                      className="text-gray-700 hover:bg-gray-50"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  <p>Error: {error}</p>
                </div>
              )}

              <div className="rounded-lg overflow-hidden border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('customer_id')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-start ps-2`}
                        >
                          Customer ID
                          <SortIndicator column="customer_id" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('fullname')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-start`}
                        >
                          Name
                          <SortIndicator column="fullname" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('phone')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-start`}
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          Phone
                          <SortIndicator column="phone" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('email')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-start`}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                          <SortIndicator column="email" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('address')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-start`}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Address
                          <SortIndicator column="address" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('type')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 w-full justify-start`}
                        >
                          Type
                          <SortIndicator column="type" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('status')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 w-full justify-center`}
                        >
                          Status
                          <SortIndicator column="status" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('created_at')}
                          className={`h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 w-full justify-start`}
                        >
                          Date Added
                          <SortIndicator column="created_at" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={`loading-${index}`} className="hover:bg-gray-50">
                          {Array(9).fill(0).map((_, idx) => (
                            <TableCell key={`loading-cell-${idx}`} className="text-center py-3">
                              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mx-auto"></div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : customers.length > 0 ? (
                      customers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="font-medium py-3">
                            <p className="ps-2">{customer.customer_id}</p>
                          </TableCell>
                          <TableCell className="font-medium">
                            {customer.fullname}
                          </TableCell>
                          <TableCell className="text-left">
                            {customer.phone}
                          </TableCell>
                          <TableCell>
                            {customer.email ? (
                              <span className="truncate block max-w-[180px]">{customer.email}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.address ? (
                              <div className="truncate max-w-xs" title={customer.address}>
                                {customer.address}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`font-medium ${getCustomerTypeBadgeColor(customer.type)}`}
                            >
                              {customer.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`font-medium ${getStatusBadgeColor(customer.status)}`}
                            >
                              {customer.status ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left text-sm">
                            {formatDate(customer.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        variant="outline"
        size="icon"
        disabled={!hasPermission("View")}
        onClick={() =>
          hasPermission("View") &&
          handleViewClick(customer)
        }
        className={
          !hasPermission("View")
            ? "opacity-50 cursor-not-allowed"
            : ""
        }
        aria-label={`View customer ${customer.fullname}`}
      >
        <Eye className="h-4 w-4" />
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {hasPermission("View")
      ? "View Customer Details"
      : "You do not have permission to view"}
  </TooltipContent>
</Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                              <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        variant="outline"
        size="icon"
        disabled={!hasPermission("Edit")}
        onClick={() =>
          hasPermission("Edit") &&
          handleEditClick(customer)
        }
        className={
          !hasPermission("Edit")
            ? "opacity-50 cursor-not-allowed"
            : ""
        }
        aria-label={`Edit customer ${customer.fullname}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {hasPermission("Edit")
      ? "Edit Customer"
      : "You do not have permission to edit"}
  </TooltipContent>
</Tooltip>
                              </TooltipProvider>
                             <Tooltip>
  <TooltipTrigger asChild>
    <span className="inline-flex">
      <Button
        variant="outline"
        size="icon"
        className={`text-destructive hover:bg-destructive/10 ${
          !hasPermission("Delete") ||
          customersWithActiveInvoices.has(customer.id)
            ? "cursor-not-allowed opacity-50"
            : ""
        }`}
        disabled={
          !hasPermission("Delete") ||
          customersWithActiveInvoices.has(customer.id)
        }
        onClick={() =>
          hasPermission("Delete") &&
          !customersWithActiveInvoices.has(customer.id) &&
          openDeleteDialog(customer)
        }
        aria-label={`Delete customer ${customer.fullname}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {!hasPermission("Delete")
      ? "You do not have permission to delete"
      : customersWithActiveInvoices.has(customer.id)
        ? "Cannot delete customer with active invoices"
        : "Delete Customer"}
  </TooltipContent>
</Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-gray-50">
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center py-6">
                            <Users className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">
                              {searchTerm || statusFilter !== 'all' || customerTypeFilter !== 'all' ? 'No matching customers found' : "No customers added yet"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {searchTerm || statusFilter !== 'all' || customerTypeFilter !== 'all'
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Click "Add Customer" to get started.'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Show</p>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => handleItemsPerPageChange(Number(value))}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue placeholder={itemsPerPage.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">entries</p>
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Showing {pagination.totalItems > 0 ? ((pagination.currentPage - 1) * pagination.itemsPerPage) + 1 : 0} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                      Page {pagination.currentPage} of {pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages || pagination.totalPages === 0 || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Dialog for Delete */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>Are you sure you want to delete the customer "{customerToDelete?.fullname}"?</DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => setCustomerToDelete(null)}>
                    No
                  </Button>
                </DialogClose>
                <Button variant="destructive" onClick={deleteCustomer}>
                  Yes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};
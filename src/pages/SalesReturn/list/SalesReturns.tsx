import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit,
  Printer,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/Utils/types/supabaseClient';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import { ISystemMessageConfig } from '@/Utils/constants';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import generateSalesReturnPDF from '../config/SalesReturnPrintTemplate';
import { loadModulePermissions } from '@/Utils/commonFun';

type SortField = 'return_number' | 'return_date' | 'items_returned';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

interface SalesReturnDisplay {
  id: string;
  returnNumber: string;
  linkedInvoiceNumber: string;
  returnDate: string;
  status: string;
  statusValue: string;
  itemsReturned: number;
  createdBy: string;
}

// Explicit status style map — matches PurchaseRequisitions approach
const statusStyles: Record<string, string> = {
  RETURN_CREATED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVAL_PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  APPROVER_COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  SALES_RETURN_CANCELLED: 'bg-red-100 text-red-800 border-red-300',
};

// Explicit human-readable labels
const statusLabels: Record<string, string> = {
  RETURN_CREATED: 'Return Created',
  APPROVAL_PENDING: 'Approval Pending',
  APPROVER_COMPLETED: 'Approver Completed',
  SALES_RETURN_CANCELLED: 'Return Cancelled',
  RETURN_COMPLETED: 'Return Completed',
};

// Fallback for unknown statuses: derive a color from the string
const getFallbackStyle = (statusValue: string): string => {
  if (!statusValue) return 'bg-gray-100 text-gray-800 border-gray-300';
  const lower = statusValue.toLowerCase();
  if (lower.includes('approv') && lower.includes('complet')) return 'bg-green-100 text-green-800 border-green-300';
  if (lower.includes('approv') && lower.includes('pending')) return 'bg-amber-100 text-amber-800 border-amber-300';
  if (lower.includes('approv')) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (lower.includes('cancel') || lower.includes('reject')) return 'bg-red-100 text-red-800 border-red-300';
  if (lower.includes('creat')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (lower.includes('progress')) return 'bg-blue-100 text-blue-800 border-blue-300';
  return 'bg-gray-100 text-gray-700 border-gray-300';
};

const getStatusStyle = (statusValue: string): string =>
  statusStyles[statusValue] ?? getFallbackStyle(statusValue);

const getStatusLabel = (statusValue: string): string =>
  statusLabels[statusValue] ??
  statusValue
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const SORT_FIELD_MAP: Record<SortField, string> = {
  return_number: 'sales_return_number',
  return_date: 'return_date',
  items_returned: 'total_items',
};

const SalesReturns: React.FC = () => {

    const [modulePermissions, setModulePermissions] = useState<any[]>([]);

  const userData = useSelector(selectUser);
  const companyId = userData?.company_id || null;
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';
  const companyData = userData?.company_data;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'return_date',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [salesReturns, setSalesReturns] = useState<SalesReturnDisplay[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusOptions, setStatusOptions] = useState<ISystemMessageConfig[]>([]);

        useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Sales Returns', userData.user_id);
        console.log(res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.user_id, userData?.role_id]);

 const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

    // Fetch status options
    useEffect(() => {
    if (!companyId) return;

    const fetchStatusOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq('company_id', companyId)
          .eq('category_id', 'SALES_RETURN');
        if (error) {
          console.error('Error fetching status options:', error);
          return;
        }
        setStatusOptions(data);
      } catch (error) {
        console.error('Unexpected error fetching status options:', error);
      }
    };
    fetchStatusOptions();
  }, [companyId]);

  const fetchSalesReturns = async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('sales_return')
        .select(
          `
          id,
          sales_return_number,
          return_date,
          total_items,
          created_at,
          return_status,
          system_message_config!sales_return_return_status_fkey (id, category_id, sub_category_id),
          sales_invoice!sales_return_linked_invoice_id_fkey (invoice_number),
          user_mgmt!sales_return_created_by_fkey (first_name, last_name)
          `,
          { count: 'exact' }
        )
        .range(from, to);

      if (searchTerm.trim()) {
        query = query.ilike('sales_return_number', `%${searchTerm.trim()}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('return_status', statusFilter);
      }

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(SORT_FIELD_MAP[sortConfig.field], {
          ascending: sortConfig.direction === 'asc',
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const mappedData: SalesReturnDisplay[] = (data || []).map((row: any) => ({
        id: row.id,
        returnNumber: row.sales_return_number,
        linkedInvoiceNumber: row.sales_invoice?.invoice_number ?? '-',
        returnDate: row.return_date,
        status: row.system_message_config?.id ?? 'UNKNOWN',
        statusValue: row.system_message_config?.sub_category_id ?? 'Unknown',
        itemsReturned: row.total_items ?? 0,
        createdBy: `${row.user_mgmt?.first_name ?? ''} ${row.user_mgmt?.last_name ?? ''}`.trim(),
      }));

      setSalesReturns(mappedData);
      setTotalItems(count || 0);
    } catch (err) {
      console.error('Error fetching sales returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesReturns();
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, sortConfig.field, sortConfig.direction]);

  // Export to CSV
  const exportSalesReturnsToCSV = async () => {
    await exportSupabaseTableToCSV<SalesReturnDisplay>({
      reportTitle: 'Sales Returns',
      headers: [
        'Sales Return Number',
        'Linked Invoice Number',
        'Return Date',
        'Return Status',
        'Items Returned',
        'Created By',
      ],
      rowMapper: (item: SalesReturnDisplay) => [
        `"${item.returnNumber}"`,
        `"${item.linkedInvoiceNumber}"`,
        `"${formatDate(item.returnDate)}"`,
        `"${getStatusLabel(item.statusValue)}"`,
        `"${item.itemsReturned}"`,
        `"${item.createdBy}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('sales_return')
          .select(`
            *,
            system_message_config!sales_return_return_status_fkey (id, category_id, sub_category_id),
            sales_invoice!sales_return_linked_invoice_id_fkey (invoice_number),
            user_mgmt!sales_return_created_by_fkey (first_name, last_name)
          `)
          .eq('company_id', companyId!);

        if (searchTerm.trim()) {
          query = query.ilike('sales_return_number', `%${searchTerm.trim()}%`);
        }
        if (statusFilter !== 'all') {
          query = query.eq('return_status', statusFilter);
        }
        if (sortConfig.field && sortConfig.direction) {
          query = query.order(SORT_FIELD_MAP[sortConfig.field], {
            ascending: sortConfig.direction === 'asc',
          });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((row: any) => ({
          id: row.id,
          returnNumber: row.sales_return_number,
          linkedInvoiceNumber: row.sales_invoice?.invoice_number ?? '-',
          returnDate: row.return_date,
          status: row.system_message_config?.id ?? 'UNKNOWN',
          statusValue: row.system_message_config?.sub_category_id ?? 'Unknown',
          itemsReturned: row.total_items ?? 0,
          createdBy: `${row.user_mgmt?.first_name ?? ''} ${row.user_mgmt?.last_name ?? ''}`.trim(),
        }));
      },
      onError: (err: any) => {
        console.error(`Failed to export sales returns: ${err.message}`);
      },
    });
  };

  const handlePrintSalesReturn = async (salesReturnId: string) => {
    try {
      const { data: sr, error: srError } = await supabase
        .from('sales_return')
        .select(`
          id,
          sales_return_number,
          return_date,
          sales_invoice:linked_invoice_id (
            invoice_number,
            invoice_date,
            customer_name,
            billing_address,
            contact_number,
            store:store_id (name)
          ),
          user_mgmt:created_by (first_name, last_name)
        `)
        .eq('id', salesReturnId)
        .single();

      if (srError) throw srError;

      const { data: items, error: itemsError } = await supabase
        .from('sales_return_items')
        .select(`
          returned_qty,
          return_reason,
          item_mgmt:item_id (item_id, item_name),
          store_mgmt:next_store_id (name),
          inventory_loc_mgmt:storage_location_id (
            shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey (short_name),
            cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey (short_name)
          )
        `)
        .eq('sales_return_id', salesReturnId);

      if (itemsError) throw itemsError;

      const mappedItems = (items ?? []).map((item, index) => {
        const shelfName = item.inventory_loc_mgmt?.shelf?.short_name;
        const cabinetName = item.inventory_loc_mgmt?.cabinet?.short_name;
        const locationName =
          shelfName && cabinetName
            ? `${shelfName} - ${cabinetName}`
            : shelfName || cabinetName || '-';

        return {
          id: `${index}`,
          itemNumber: item.item_mgmt?.item_id ?? '',
          name: item.item_mgmt?.item_name ?? '',
          returnQuantity: item.returned_qty ?? 0,
          reason: item.return_reason ?? '',
          nextStore: item.store_mgmt?.name ?? '',
          location_name: locationName,
        };
      });

      generateSalesReturnPDF({
        companyInfo: {
          name: companyData?.name ?? '',
          phone: companyData?.phone ?? '',
          address: [companyData?.city, companyData?.state, companyData?.country, companyData?.postal_code]
            .filter(Boolean)
            .join(', '),
        },
        id: sr.id,
        returnNumber: sr.sales_return_number ?? '',
        returnDate: sr.return_date ?? new Date().toISOString(),
        customer: {
          name: sr.sales_invoice?.customer_name ?? '',
          contact: sr.sales_invoice?.contact_number ?? '',
          address: sr.sales_invoice?.billing_address ?? '',
        },
        linkedInvoice: sr.sales_invoice
          ? {
              invoiceNumber: sr.sales_invoice.invoice_number ?? '',
              invoiceDate: sr.sales_invoice.invoice_date ?? '',
              storeName: sr.sales_invoice.store?.name ?? '',
            }
          : undefined,
        items: mappedItems,
        totals: {
          totalReturnedQuantity: mappedItems.reduce((sum, i) => sum + (i.returnQuantity || 0), 0),
        },
      });
    } catch (err) {
      console.error('Error printing sales return:', err);
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleSort = (field: SortField) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.field === field && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.field === field && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ field: direction ? field : null, direction });
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="h-4 w-4 text-blue-600" />;
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  const handleView = (id: string) => navigate(`/dashboard/SalesReturnForm/view/${id}`);
  const handleEdit = (id: string) => navigate(`/dashboard/SalesReturnForm/edit/${id}`);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Sales Returns
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage and track customer return requests
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        variant="outline"
                                        onClick={exportSalesReturnsToCSV}
                                        className="transition-colors"
                                        disabled={salesReturns.length === 0 || !hasPermission('Export')}
                                      >
                                        <Download className="mr-2 h-4 w-4" />
                                  <span>Export CSV</span>
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
              
                                  <TooltipContent>
                                    {hasPermission('Export')
                                      ? 'Export CSV'
                                      : 'You do not have permission to export Sales Return'}
                                  </TooltipContent>
                                </Tooltip>
              
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        onClick={() => navigate("/dashboard/salesReturnForm/create")}
                                        className="transition-colors"
                                        disabled={!hasPermission('Add')}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create Sales Return
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
              
                                  <TooltipContent>
                                    {hasPermission('Add')
                                      ? 'Create Sales Return'
                                      : 'You do not have permission to Create Sales Return'}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full sm:w-1/3">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by Sales Return Number #..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-[220px]">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {getStatusLabel(status.sub_category_id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="transition-colors w-full sm:w-auto"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-gray-50 border-gray-200">
                    <TableHead className="font-semibold w-[180px]">
                      <button
                        onClick={() => handleSort('return_number')}
                        className="flex items-center gap-1 cursor-pointer hover:text-blue-600 ps-2"
                      >
                        Sales Return Number #
                        {getSortIcon('return_number')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold w-[180px]">Linked Invoice Number</TableHead>
                    <TableHead className="font-semibold w-[140px]">
                      <button
                        onClick={() => handleSort('return_date')}
                        className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                      >
                        Return Date
                        {getSortIcon('return_date')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">
                      <button
                        onClick={() => handleSort('items_returned')}
                        className="flex items-center gap-1 justify-end cursor-pointer hover:text-blue-600 w-full"
                      >
                        Items Returned
                        {getSortIcon('items_returned')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold">Created By</TableHead>
                    <TableHead className="font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    Array(itemsPerPage)
                      .fill(0)
                      .map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse ml-2" /></TableCell>
                          <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell><div className="h-6 w-24 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell className="text-right"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></TableCell>
                          <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : salesReturns.length > 0 ? (
                    salesReturns.map((ret) => (
                      <TableRow key={ret.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium py-3">
                          <p className="ps-2">{ret.returnNumber}</p>
                        </TableCell>
                        <TableCell>{ret.linkedInvoiceNumber}</TableCell>
                        <TableCell>{formatDate(ret.returnDate)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`font-medium capitalize ${getStatusStyle(ret.statusValue)}`}
                          >
                            {getStatusLabel(ret.statusValue)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{ret.itemsReturned}</TableCell>
                        <TableCell>{ret.createdBy}</TableCell>

                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button 
                                    variant="outline" size="icon" 
                                    onClick={() => handleView(ret.id)}
                                    disabled={!hasPermission('View')}                                   
                                    >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasPermission('View')
                                    ? 'View sales return'
                                    : 'You do not have permission to view return'}
                                    </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleEdit(ret.id)}
                                      disabled={!hasPermission('Edit') || ret.statusValue === 'RETURN_COMPLETED'}                                  
                                    >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasPermission('Edit')
                                    ? 'Edit sales return'
                                    : 'You do not have permission to edit return'}
                                    </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigate(`/dashboard/salesReturnApprovalView/${ret.id}`)}
                                    disabled={!hasPermission('View Approvals')}
                                  >
                                    <FileCheck className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasPermission('View Approvals')
                                    ? 'View Return Approvals'
                                    : 'You do not have permission to view return approvals'}
                                    </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handlePrintSalesReturn(ret.id)}
                                  disabled={!hasPermission('Print')}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasPermission('Print')
                                    ? 'Print Return Note'
                                    : 'You do not have permission to Print Return Note'}
                                    </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center py-6">
                          <FileText className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">No sales returns found</p>
                          <p className="text-sm text-gray-500">
                            {searchTerm || statusFilter !== 'all'
                              ? 'Try adjusting your search or filters'
                              : 'Create a new sales return to get started'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Show</p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
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
                  Showing {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                  {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                    Page {currentPage} of {totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalesReturns;
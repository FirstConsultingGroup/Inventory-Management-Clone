import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Filter,
  Edit,
  Download,
  BadgeIndianRupee,
  Printer
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/Utils/types/supabaseClient";
import { IUser } from "@/Utils/constants";
import generateInvoicePDF from "../config/InvoicePrintTemplate";
import { exportSupabaseTableToCSV } from "@/Utils/csvExport";
import { format } from "date-fns";
import { formatCurrency } from "@/Utils/formatters";
import { loadModulePermissions } from "@/Utils/commonFun";

// Types based on your CSV structure
interface InvoiceItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  tax_percentage?: Record<string, number>;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  contact_number: string;
  invoice_date: string;
  net_amount: number;
  status: "paid" | "pending" | "overdue";
  items: InvoiceItem[];
  billing_address?: string;
  email?: string;
  total_items: number;
  invoice_amount: number;
  discount_amount: number;
  tax_amount: any;
  company: {
    id: string;
    name: string;
    address: string;
    contact_number: string;
  };
  freight_charges: number | null | undefined;
  total_discount_percentage: number | null | undefined;
  total_discount_amount: number | null | undefined;
}

interface PaginationInfo {
  total: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type SortOrder = 'asc' | 'desc' | null;
interface SortConfig {
  field: string | null;
  order: SortOrder;
}

interface ExtendedUser extends IUser {
  company_data?: any;
}

export default function SalesInvoiceList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'invoice_date', order: 'desc' });
  const [filterStatus, _] = useState('all');
  const [dateFilter, setDateFilter] = useState<[string, string]>(["", ""]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [loading, setLoading] = useState(true);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);


  // Get user data and company ID
  const user = localStorage.getItem('userData');
  const userData: ExtendedUser | null = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || null;
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.id) {
        const res = await loadModulePermissions(appCode, 'Sales Invoice', userData.id);
        console.log(res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.id, userData?.role_id]);

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };


  // Format date to "MMM DD, YYYY"
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Fetch invoices from Supabase
  const fetchInvoices = async () => {
    if (!companyId) {
      toast.error('Company ID not found. Please login again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_sales_invoices_paginated', {
        company_id_param: companyId,
        search_query: searchQuery || undefined,
        status_filter: filterStatus === 'all' ? undefined : filterStatus,
        date_from: dateFilter[0] || undefined,
        date_to: dateFilter[1] || undefined,
        page: currentPage,
        limit_param: itemsPerPage,
        sort_field: sortConfig.field || 'invoice_date',
        sort_order: sortConfig.order || 'desc'
      });

      if (error) throw error;

      const response = data as any;
      setInvoices(response?.data || []);
      setPagination(response?.pagination || {
        total: 0,
        totalPages: 0,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false
      });
    } catch (err: any) {
      toast.error('Failed to load invoices');
      console.error(err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [searchQuery, filterStatus, dateFilter, currentPage, itemsPerPage, sortConfig, companyId]);

  // Export CSV
  const exportInvoicesToCSV = async () => {
    await exportSupabaseTableToCSV<SalesInvoice>({
      reportTitle: 'Sales Invoices',
      rpcName: 'get_sales_invoices_paginated',
      rpcParams: {
        company_id_param: companyId,
        search_query: searchQuery || undefined,
        status_filter: filterStatus === 'all' ? undefined : filterStatus,
        date_from: dateFilter[0] || undefined,
        date_to: dateFilter[1] || undefined,
        page: 1,
        limit_param: -1,
        sort_field: sortConfig.field || 'invoice_date',
        sort_order: sortConfig.order || 'desc'
      },
      headers: ['Invoice #', 'Customer', 'Date', 'Amount', 'Contact'],
      rowMapper: (i) => [
        i.invoice_number,
        i.customer_name,
        format(new Date(i.invoice_date), 'dd MMM yyyy'),
        formatCurrency(i.net_amount),
        i.contact_number
      ],
      supabaseClient: supabase,
      onError: (err) => toast.error(`Export failed: ${err.message}`)
    });
  };

  // Print Existing Invoice (your original)
  const handlePrintInvoice = async (invoice: SalesInvoice, options: { isBlank?: boolean; hideDiscountAndGross?: boolean; hideItemId?: boolean; hideLocation?: boolean } = {}) => {
    console.log('Print invoice called with options:', options);
    console.log('Invoice items============>:', invoice.items);
    const companyInfo = userData?.company_data;

    // === FETCH LOCATION SHORT NAMES FROM inventory_loc_master ===
    const itemLocationMap: Record<string, string> = {};
    const itemNumberMap: Record<string, string> = {};

    if (invoice.items.length > 0 && !options.isBlank) {
      const itemIds = invoice.items.map(i => i.id);

      // Step 1: Get loc_id JSON and item_id from sales_invoice_items with item_mgmt join
      const { data: invoiceItems } = await supabase
        .from('sales_invoice_items')
        .select(`
          id, 
          loc_id,
          item_mgmt:item_id (
            item_id
          )
        `)
        .in('id', itemIds);

      if (invoiceItems && invoiceItems.length > 0) {
        // Build item number map
        invoiceItems.forEach(row => {
          if (row.item_mgmt && row.item_mgmt.item_id) {
            itemNumberMap[row.id] = row.item_mgmt.item_id;
          }
        });

        // Extract all link_loc IDs from loc_id JSON
        const linkLocIds: string[] = [];

        invoiceItems.forEach(row => {
          const locArray = row.loc_id;
          if (Array.isArray(locArray)) {
            locArray.forEach((entry: any) => {
              if (entry.id) linkLocIds.push(entry.id);
            });
          }
        });

        if (linkLocIds.length > 0) {
          // Step 2: Get cabinet_id and shelf_id from inventory_loc_mgmt
          const { data: links } = await supabase
            .from('inventory_loc_mgmt')
            .select('id, cabinet_id, shelf_id')
            .in('id', linkLocIds);

          if (links && links.length > 0) {
            // Collect all master IDs (cabinet + shelf)
            const masterIds: string[] = [];
            links.forEach(link => {
              if (link.cabinet_id) masterIds.push(link.cabinet_id);
              if (link.shelf_id) masterIds.push(link.shelf_id);
            });

            if (masterIds.length > 0) {
              // Step 3: Get short_name from inventory_loc_master
              const { data: masters } = await supabase
                .from('inventory_loc_master')
                .select('id, short_name')
                .in('id', masterIds);

              const masterMap = Object.fromEntries(
                (masters || []).map(m => [m.id, m.short_name || 'LOC'])
              );

              // Build display string: "CAB-01 - SH-05 (6), MAIN - RACK-02 (4)"
              invoiceItems.forEach(row => {
                const locArray = row.loc_id;
                if (Array.isArray(locArray) && locArray.length > 0) {
                  const parts = locArray.map((entry: any) => {
                    const link = links.find(l => l.id === entry.id);
                    if (!link) return 'Unknown';

                    const cabinet = link.cabinet_id ? masterMap[link.cabinet_id] : null;
                    const shelf = link.shelf_id ? masterMap[link.shelf_id] : null;

                    const names = [cabinet, shelf].filter(Boolean);
                    const locationText = names.length > 0 ? names.join(' - ') : 'Unknown';
                    return entry.qty > 0 ? `${locationText} (${entry.qty})` : locationText;
                  });

                  itemLocationMap[row.id] = parts.filter(Boolean).join(', ') || '-';
                }
              });
            }
          }
        }
      }
    }
    // === END FETCH ===

    const invoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customer: {
        name: invoice.customer_name,
        contact: invoice.contact_number,
        address: invoice.billing_address || '',
      },
      companyInfo,
      items: invoice.items.map(item => ({
        id: item.id,
        itemNumber: itemNumberMap[item.id] || item.item_id || '',
        name: item.item_name || '',
        quantity: item.quantity || 0,
        unitPrice: item.unit_price || 0,
        grossAmount: (item.quantity || 0) * (item.unit_price || 0),
        netAmount: (item.quantity || 0) * (item.unit_price || 0),
        discount_percentage: item.discount_percentage || 0,
        tax_percentage: item.tax_percentage,
        location_name: itemLocationMap[item.id] || (options.isBlank ? '' : '-'),
      })),
      date: invoice.invoice_date,
      taxLabels: Object.keys(invoice.tax_amount || {}),
      totals: {
        grossAmount: invoice.invoice_amount,
        itemsItotalDiscount: invoice.discount_amount,
        totalTaxAmount: invoice.tax_amount,
        netAmount: invoice.net_amount,
        taxTotals: invoice.tax_amount,
        totalDiscountAmount: invoice.total_discount_amount,
        totalDiscountPercentage: invoice.total_discount_percentage,
        freightCharges: invoice.freight_charges || 0,
      },
    };

    generateInvoicePDF(invoiceData as any, options);
  };



  const handleViewDetails = (invoice: SalesInvoice) => navigate(`/dashboard/invoice/view/${invoice.id}`);
  const handleEditInvoice = (invoice: SalesInvoice) => navigate(`/dashboard/invoice/edit/${invoice.id}`);

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return prev.order === 'asc' ? { field, order: 'desc' } : { field: null, order: null };
      }
      return { field, order: 'asc' };
    });
    setCurrentPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortConfig.field !== field || !sortConfig.order) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    return sortConfig.order === 'asc'
      ? <ArrowUp className="h-4 w-4 text-blue-600" />
      : <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  if (!companyId) {
    return (
      <div className="p-6 text-center">
        <Card className="max-w-md mx-auto p-8">
          <FileText className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Company not found. Please log in again.</CardDescription>
          <Button onClick={() => navigate('/login')} className="mt-4">Go to Login</Button>
        </Card>
      </div>
    );
  }

  // Action Buttons in Table Row
  const renderActionButtons = (invoice: SalesInvoice) => (
    <div className="flex justify-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button variant="outline" size="icon"
                onClick={() => handleViewDetails(invoice)}
                disabled={!hasPermission('View')}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasPermission('View')
              ? 'View invoice'
              : 'You do not have permission to view invoices'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button variant="outline" size="icon"
                onClick={() => handleEditInvoice(invoice)}
                disabled={!hasPermission('Edit')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasPermission('Edit')
              ? 'Edit invoice'
              : 'You do not have permission to edit invoices'}
          </TooltipContent>
        </Tooltip>

        {/* NEW: Print Blank Invoice Button (left of original) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePrintInvoice(invoice, { hideDiscountAndGross: true })}
                disabled={!hasPermission('Print')}
                className="border-dashed border-blue-500 hover:bg-blue-50"
              >
                <Printer className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasPermission('Print')
              ? 'Print Inventory Transfer Slip'
              : 'You do not have permission to Print Inventory Transfer Slip'}
          </TooltipContent>
        </Tooltip>

        {/* ORIGINAL: Print This Invoice */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button variant="outline" size="icon"
                onClick={() => handlePrintInvoice(invoice, { hideItemId: true, hideLocation: true })}
                disabled={!hasPermission('Print')}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {hasPermission('Print')
              ? 'Print Invoice Slip'
              : 'You do not have permission to Print Invoice Slip'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <BadgeIndianRupee className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">Sales Invoices</CardTitle>
                  <CardDescription>Manage and print your sales invoices</CardDescription>
                </div>
              </div>

              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        onClick={exportInvoicesToCSV}
                        className="transition-colors"
                        disabled={invoices.length === 0 || !hasPermission('Export')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span>Export CSV</span>
                      </Button>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent>
                    {hasPermission('Export')
                      ? 'Export CSV'
                      : 'You do not have permission to export invoices'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        onClick={() => navigate('/dashboard/invoice/add')}
                        className="transition-colors"
                        disabled={!hasPermission('Add')}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Invoice
                      </Button>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent>
                    {hasPermission('Add')
                      ? 'Create New Invoice'
                      : 'You do not have permission to Create New Invoice'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invoice, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Input type="date" className="w-[150px]" value={dateFilter[0]} onChange={(e) => { setDateFilter([e.target.value, dateFilter[1]]); setCurrentPage(1); }} />
                <span className="text-gray-500">to</span>
                <Input type="date" className="w-[150px]" value={dateFilter[1]} onChange={(e) => { setDateFilter([dateFilter[0], e.target.value]); setCurrentPage(1); }} />
              </div>
              <Button variant="outline" onClick={() => { setSearchQuery(""); setDateFilter(["", ""]); setCurrentPage(1); }}>
                Clear Filters
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><button onClick={() => handleSort('invoice_number')} className="flex items-center gap-1 font-semibold hover:text-blue-600">Invoice # {getSortIcon('invoice_number')}</button></TableHead>
                    <TableHead><button onClick={() => handleSort('customer_name')} className="flex items-center gap-1 font-semibold hover:text-blue-600">Customer {getSortIcon('customer_name')}</button></TableHead>
                    <TableHead><button onClick={() => handleSort('invoice_date')} className="flex items-center gap-1 font-semibold hover:text-blue-600">Date {getSortIcon('invoice_date')}</button></TableHead>
                    <TableHead className="text-right"><button onClick={() => handleSort('net_amount')} className="flex items-center gap-1 font-semibold hover:text-blue-600 justify-end">Amount {getSortIcon('net_amount')}</button></TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(10).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        {Array(6).fill(0).map((_, j) => <TableCell key={j}><div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div></TableCell>)}
                      </TableRow>
                    ))
                  ) : invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-gray-50">
                        <TableCell className="font-semibold">
                          <a href="#" onClick={(e) => { e.preventDefault(); handleViewDetails(invoice); }} className="text-blue-600 hover:underline">
                            {invoice.invoice_number}
                          </a>
                        </TableCell>
                        <TableCell>{invoice.customer_name}</TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(invoice.net_amount)}</TableCell>
                        <TableCell>{invoice.contact_number}</TableCell>
                        <TableCell>{renderActionButtons(invoice)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No invoices found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center py-4 gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Show
                <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(+v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>{[5, 10, 20, 50].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
                entries
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {pagination.totalPages || 1}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={!pagination.hasPrevPage || loading}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={!pagination.hasNextPage || loading}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
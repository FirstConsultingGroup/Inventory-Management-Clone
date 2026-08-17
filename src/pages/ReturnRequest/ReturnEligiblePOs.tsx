import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Package,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/Utils/types/supabaseClient";
import { IUser } from "@/Utils/constants";
import toast from "react-hot-toast";
import { loadModulePermissions } from '@/Utils/commonFun';
interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  supplier_email: string;
  order_status: string;
  order_status_name: string;
  received_on: string;
  created_by_name: string;
  returnable_items: number;
  total_items: number;
  total_value: number;
}

interface PaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

type SortField = 'po_number' | 'supplier_name' | 'order_status' | 'received_on' | 'returnable_items';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

const ReturnEligiblePOs: React.FC = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem("userData");
  const userData: IUser | null = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'received_on',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [_, setEligibleStatusIds] = useState<string[]>([]);

  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 0,
    total: 0,
    itemsPerPage: 10
  });
  const [__, setStatusOptions] = useState<any[]>([]);
  const isFetchingRef = useRef(false);
  const userDataRef = useRef(userData);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
    const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  // Update ref when userData changes
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  // Fetch status options
  useEffect(() => {
    if (!companyId) return;

    const fetchStatusOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq('company_id', companyId)
          .eq("category_id", 'PURCHASE_ORDER');
        
        if (error) {
          console.error('Error fetching status options:', error);
          toast.error('Failed to fetch status options. Please try again.');
          return;
        }

        setStatusOptions(data);
        
        // Set eligible status IDs for export
        const eligible = data.filter(s => 
          s.sub_category_id === 'ORDER_RECEIVED' || 
          s.sub_category_id === 'ORDER_PARTIALLY_RECEIVED'
        );
        setEligibleStatusIds(eligible.map(s => s.id));
      } catch (error) {
        console.error('Unexpected error fetching status options:', error);
        toast.error('An unexpected error occurred while fetching status options.');
      }
    };
    fetchStatusOptions();
  }, [companyId]);

  // Fetch purchase orders using RPC
  useEffect(() => {
    if (!companyId) return;

    const fetchPurchaseOrders = async () => {
      if (!userDataRef.current || isFetchingRef.current) return;

      isFetchingRef.current = true;
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_return_eligible_pos_from_inventory', {
          p_company_id: companyId,
          p_search_term: searchTerm.trim() || undefined,
          p_status_filter: statusFilter,
          p_date_from: dateFromFilter || undefined,
          p_date_to: dateToFilter || undefined,
          p_sort_field: sortConfig.field || 'received_on',
          p_sort_direction: sortConfig.direction || 'desc',
          p_page: currentPage,
          p_page_size: itemsPerPage
        });

        if (error) {
          console.error('Error fetching purchase orders:', error);
          toast.error('Failed to fetch purchase orders. Please try again.');
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }

        const totalCount = data && data.length > 0 ? data[0].total_count : 0;
        
        setFilteredPOs(data || []);
        setPagination({
          currentPage,
          totalPages: Math.ceil(totalCount / itemsPerPage),
          total: totalCount,
          itemsPerPage
        });

      } catch (error) {
        console.error('Unexpected error fetching purchase orders:', error);
        toast.error('An unexpected error occurred while fetching purchase orders.');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    if (userDataRef.current) {
      fetchPurchaseOrders();
    }
  }, [searchTerm, statusFilter, dateFromFilter, dateToFilter, sortConfig, currentPage, itemsPerPage, companyId]);

  // Export to CSV
  const exportReturnEligiblePOsToCSV = async () => {
    try {
      const { data, error } = await supabase.rpc('get_return_eligible_pos_from_inventory', {
        p_company_id: companyId as string,
        p_search_term: searchTerm.trim() || undefined,
        p_status_filter: statusFilter,
        p_date_from: dateFromFilter || undefined,
        p_date_to: dateToFilter || undefined,
        p_sort_field: sortConfig.field || 'received_on',
        p_sort_direction: sortConfig.direction || 'desc',
        p_page: 1,
        p_page_size: -1 // Get all records for export
      });

      if (error) throw error;

      // Generate CSV
      const headers = ['PO Number', 'Supplier Name', 'Status', 'Received Date', 'Created By', 'Returnable Items'];
      const csvRows = [headers.join(',')];

      data?.forEach((po: PurchaseOrder) => {
        const row = [
          `"${po.po_number}"`,
          `"${po.supplier_name || ''}"`,
          `"${po.order_status_name?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) || ''}"`,
          `"${format(new Date(po.received_on), 'dd MMM yyyy')}"`,
          `"${po.created_by_name || ''}"`,
          `"${po.returnable_items}"`
        ];
        csvRows.push(row.join(','));
      });

      // Download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `return_eligible_pos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      toast.success('CSV exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV. Please try again.');
    }
  };

  const handleSort = (field: SortField) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.field === field) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }
    setSortConfig({ field: direction ? field : null, direction });
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const handleViewPO = (poId: string) => {
    navigate(`/dashboard/return-eligible-view/${poId}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setCurrentPage(1);
    setSortConfig({ field: 'received_on', direction: 'desc' });
  };

  const getStatusBadge = (statusName: string) => {
    const statusStyles = {
      'ORDER_RECEIVED': 'bg-green-100 text-green-800 border-green-300',
      'ORDER_PARTIALLY_RECEIVED': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };

    return statusStyles[statusName as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800 border-gray-300';
  };
  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.id) {
        const res = await loadModulePermissions(
          appCode,
          'Returns Eligible',
          userData.id
        );

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };

    fetchPermissions();
  }, [userData?.id]);
  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find(
      (p: any) =>
        p.action_id?.actionName?.toLowerCase() ===
        actionName.toLowerCase()
    );

    return perm ? perm.isAllowed : false;
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <RotateCcw className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Return-Eligible Purchase Orders
                  </CardTitle>
                  <CardDescription className="mt-1">
                    View and manage purchase orders that have returnable items from inventory
                  </CardDescription>
                </div>
              </div>
            <TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">
        <Button
          variant="outline"
          onClick={exportReturnEligiblePOsToCSV}
          className="transition-colors me-2"
          disabled={
            !hasPermission('Export') ||
            filteredPOs.length === 0
          }
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </span>
    </TooltipTrigger>

    <TooltipContent>
      <p>
        {!hasPermission('Export')
          ? "You don't have permission to export purchase orders"
          : filteredPOs.length === 0
          ? "No data available to export"
          : "Export CSV"}
      </p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full sm:w-1/3">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by PO Number or Supplier Name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ORDER_RECEIVED">Received</SelectItem>
                      <SelectItem value="ORDER_PARTIALLY_RECEIVED">Partially Received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="date"
                    className="w-[150px]"
                    value={dateFromFilter}
                    onChange={(e) => {
                      setDateFromFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Date From"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    className="w-[150px]"
                    value={dateToFilter}
                    onChange={(e) => {
                      setDateToFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Date To"
                  />
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
                    <TableHead className="font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('po_number')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                      >
                        PO Number
                        {getSortIcon('po_number')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('supplier_name')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Supplier Name
                        {getSortIcon('supplier_name')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      <button
                        type="button"
                        onClick={() => handleSort('order_status')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto justify-center hover:text-blue-600"
                      >
                        Status
                        {getSortIcon('order_status')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('received_on')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                      >
                        Received Date
                        {getSortIcon('received_on')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-center">Created By</TableHead>
                    <TableHead className="font-semibold text-center">
                      <button
                        type="button"
                        onClick={() => handleSort('returnable_items')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto justify-center hover:text-blue-600"
                      >
                        Returnable Items
                        {getSortIcon('returnable_items')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(itemsPerPage).fill(0).map((_, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-45 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredPOs.length > 0 ? (
                    filteredPOs.map((po) => (
                      <TableRow key={po.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {po.po_number}
                        </TableCell>
                        <TableCell>
                          {po.supplier_name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getStatusBadge(po.order_status_name)}>
                            {po.order_status_name?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(po.received_on), "PPP")}
                        </TableCell>
                        <TableCell className="text-center">
                          {po.created_by_name || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {po.returnable_items}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <TooltipProvider>
                             <TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleViewPO(po.id)}
          disabled={!hasPermission('View')}
          className={`hover:bg-blue-50 hover:text-blue-600 ${
            !hasPermission('View')
              ? 'cursor-not-allowed opacity-50'
              : ''
          }`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </span>
    </TooltipTrigger>

    <TooltipContent>
      <p>
        {hasPermission('View')
          ? 'View Purchase Order'
          : "You don't have permission to view purchase orders"}
      </p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-gray-50">
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center py-6">
                          <Package className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">No return-eligible purchase orders found.</p>
                          <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Show
                </p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
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
                <p className="text-sm text-muted-foreground">
                  entries
                </p>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Showing {pagination.total > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} entries
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                    Page {currentPage} of {pagination.totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages || 1))}
                    disabled={currentPage === pagination.totalPages || pagination.totalPages === 0}
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

export default ReturnEligiblePOs;
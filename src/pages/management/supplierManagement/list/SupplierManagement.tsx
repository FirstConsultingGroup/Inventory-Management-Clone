import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Filter,
  UserRound,
  Download,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { ISupplierManagement } from "@/Utils/constants";
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';

type SortField = 'supplier_id' | 'supplier_name' | 'email' | 'phone' | 'contact_person' | 'status';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

export default function SupplierManagement() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<ISupplierManagement[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive" | "Pending">("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isFetching, setIsFetching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<ISupplierManagement>();
  const [totalItems, setTotalItems] = useState(0);
  const [uniqueContacts, setUniqueContacts] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    direction: null,
  });
  // Get company_id from localStorage userData
  const user = localStorage.getItem('userData');
  const userData = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || '';
  const [purchaseOrderSupplierIds, setPurchaseOrderSupplierIds] = useState<string[]>([]);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

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
    } else if (sortConfig.direction === 'desc') {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }

    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const fetchSuppliers = async () => {
    setIsFetching(true);
    // Get company_id from localStorage userData
    const user = localStorage.getItem('userData');
    const userData = user ? JSON.parse(user) : null;
    const companyId = userData?.company_id || '';

    try {
      let query = supabase
        .from("supplier_mgmt")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .eq("company_id", companyId) // <-- Only fetch suppliers for this company
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (searchQuery) {
        const sanitizedQuery = searchQuery.replace(/[%_]/g, '');
        const searchConditions = [
          `supplier_name.ilike.%${sanitizedQuery}%`,
          `supplier_id.ilike.%${sanitizedQuery}%`,
        ];
        query = query.or(searchConditions.join(','));
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (contactFilter !== "all") {
        query = query.eq("contact_person", contactFilter);
      }

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, {
          ascending: sortConfig.direction === 'asc',
        });
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setSuppliers(data as ISupplierManagement[]);
      setTotalItems(count || 0);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Failed to fetch suppliers");
    } finally {
      setIsFetching(false);
    }
  };

  const exportSuppliersToCSV = async () => {
    const user = JSON.parse(localStorage.getItem('userData') || '{}');

    await exportSupabaseTableToCSV<ISupplierManagement>({
      reportTitle: 'Suppliers Data',
      headers: ['Supplier ID', 'Supplier Name', 'Email', 'Phone Number', 'Contact Person', 'Status'],
      rowMapper: (supplier: any) => [
        `"${supplier.supplier_id}"`,
        `"${supplier.supplier_name}"`,
        `"${supplier.email}"`,
        `"${supplier.phone}"`,
        `"${supplier.contact_person}"`,
        `"${supplier.status}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('supplier_mgmt')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', user?.company_id || '');

        if (searchQuery) {
          const sanitizedQuery = searchQuery.replace(/[%_]/g, '');
          const searchConditions = [
            `supplier_name.ilike.%${sanitizedQuery}%`,
            `supplier_id.ilike.%${sanitizedQuery}%`,
          ];
          query = query.or(searchConditions.join(','));
        }

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        if (contactFilter !== 'all') {
          query = query.eq('contact_person', contactFilter);
        }

        if (sortConfig.field && sortConfig.direction) {
          query = query.order(sortConfig.field, {
            ascending: sortConfig.direction === 'asc',
          });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ISupplierManagement[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export suppliers: ${err.message}`),
    });
  };

  const fetchUniqueContacts = async () => {
    // Get company_id from localStorage userData
    const user = localStorage.getItem('userData');
    const userData = user ? JSON.parse(user) : null;
    const companyId = userData?.company_id || '';

    try {
      const { data, error } = await supabase
        .from("supplier_mgmt")
        .select("contact_person")
        .eq("is_active", true)
        .eq("company_id", companyId) // <-- Only fetch contacts for this company
        .order("contact_person", { ascending: true })
        .limit(100);

      if (error) throw error;

      const contacts = Array.from(
        new Set(
          data
            .map((item: any) => item.contact_person)
            .filter(Boolean)
        )
      ) as string[];

      setUniqueContacts(contacts);
    } catch (error) {
      console.error("Error fetching unique contacts:", error);
      toast.error("Failed to fetch contacts");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setContactFilter("all");
    setCurrentPage(1);
    setSortConfig({ field: null, direction: null });
  };

  const debouncedFetchSuppliers = debounce(fetchSuppliers, 300);

  useEffect(() => {
    debouncedFetchSuppliers();
    fetchUniqueContacts();
    return () => {
      debouncedFetchSuppliers.cancel();
    };
  }, [searchQuery, statusFilter, contactFilter, currentPage, itemsPerPage, sortConfig]);

  useEffect(() => {
    const newTotalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    } else if (totalItems === 0) {
      setCurrentPage(1);
    }
  }, [totalItems, itemsPerPage, currentPage]);

  useEffect(() => {
    const fetchAllPOsupplierIds = async () => {
      if (!companyId) return;
      try {
        const { data, error } = await supabase
          .rpc('get_supplier_ids_from_purchase_orders', { p_company_id: companyId });

        if (error) throw error;

        if (data) {
          setPurchaseOrderSupplierIds(data as string[]);
        }
      } catch (error) {
        console.error("Error fetchAllPOsupplierIds:", error);
        // toast.error("Failed to fetch supplier ids.", { position: "top-right" });
        setPurchaseOrderSupplierIds([]);
      }
    }

    fetchAllPOsupplierIds();
  }, [companyId])

  const handleDelete = async () => {
    if (!supplierToDelete) return;

    const isLocked = await checkEntityLock(supplierToDelete.id); 
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      setIsDialogOpen(false);
      setSupplierToDelete(undefined);
      return;
    }

    setIsDeleting(true);
    try {
      const { data: supplierExists, error: supplierError } = await supabase
        .from("supplier_mgmt")
        .select("id")
        .eq("id", supplierToDelete.id)
        .single();

      if (supplierError || !supplierExists) {
        throw new Error("Supplier not found");
      }

       // Creating system log
      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: 'Supplier Management',
        scope: 'Delete',
        key: `${supplierToDelete.supplier_id}`,
        log: `Supplier ${supplierToDelete.supplier_id} deleted.`,
        action_by: userData?.id,
        created_at: new Date().toISOString(),
      }

      const action_payload = {
                      operations: [
                          {
                              table: 'supplier_mgmt',
                              type: 'delete',
                              match: { id: supplierToDelete.id, company_id: userData?.company_id ?? userData?.id ?? '' }
                          },
                          {
                              table: 'system_log',
                              type: 'insert',
                              data: systemLogs
                          }
                      ]
                  };

                  const { data: items } = await supabase
        .from("supplier_items")
        .select('*')
        .eq("supplier_id", supplierToDelete.id);

        if(items && items?.length > 0){
          action_payload.operations.push({
             table: 'supplier_items',
                              type: 'delete',
                              match: { supplier_id: supplierToDelete.id, company_id: userData?.company_id ?? userData?.id ?? '' } as any
          })
        }
      
                  const approvalResponse = await initiateApprovalRequest({
                      module_name: 'Suppliers',
                      action_name: 'Delete',
                      company_id: userData?.company_id || '',
                      requested_by: userData?.id || '',
                      entity_id: supplierToDelete.id,
                      action_payload
                  });
      
                  if (approvalResponse?.success) {
                      if (approvalResponse.requires_approval) {
                          toast.success('Your action has been submitted and is currently pending approval.');
                    
                      } else {
                        const { error: supplierUpdateError } = await supabase
        .from("supplier_mgmt")
        .update({ is_active: false })
        .eq("id", supplierToDelete.id);

      if (supplierUpdateError) throw supplierUpdateError;

      const { error: itemsUpdateError } = await supabase
        .from("supplier_items")
        .update({ is_active: false })
        .eq("supplier_id", supplierToDelete.id);

      if (itemsUpdateError) throw itemsUpdateError;

      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== supplierToDelete.id));
      setTotalItems((prev) => prev - 1);
      fetchUniqueContacts();

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;
      toast.success("Supplier deleted successfully", { position: "top-right" });
                      }}

    } catch (error) {
      console.error("Error deleting supplier or items:", error);
      toast.error("Failed to delete supplier or related items");
    } finally {
      setIsDialogOpen(false);
      setSupplierToDelete(undefined);
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (supplier: ISupplierManagement) => {
    setSupplierToDelete(supplier);
    setIsDialogOpen(true);
  };

  const handleEdit = (supplier: ISupplierManagement) => {
    navigate(`/dashboard/supplier/edit/${supplier.id}`);
  };

  const handleView = (supplier: ISupplierManagement) => {
    navigate(`/dashboard/supplier/view/${supplier.id}`);
  };

  const statusStyles: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    inactive: "bg-red-100 text-red-800 border-red-300",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    default: "bg-gray-100 text-gray-800 border-gray-300",
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(
          appCode,
          'Supplier Management',
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
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Supplier Management
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage your suppliers and their business information
                  </CardDescription>
                </div>
              </div>
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        variant="outline"
                        onClick={exportSuppliersToCSV}
                        className="transition-colors me-2"
                        disabled={
                          suppliers.length === 0 ||
                          !hasPermission('Export')
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span>Export CSV</span>
                      </Button>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent>
                    {hasPermission('Export')
                      ? 'Export Suppliers'
                      : 'You do not have permission to export suppliers'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        onClick={() => navigate("/dashboard/supplier/add")}
                        className="transition-colors"
                        disabled={!hasPermission('Add')}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Supplier
                      </Button>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent>
                    {hasPermission('Add')
                      ? 'Add Supplier'
                      : 'You do not have permission to add suppliers'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by supplier name or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      const sanitizedQuery = e.target.value.replace(/[%_]/g, '');
                      setSearchQuery(sanitizedQuery);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-2 flex-1 lg:flex-none">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select
                      value={statusFilter}
                      onValueChange={(value: "all" | "Active" | "Inactive" | "Pending") => {
                        setStatusFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full lg:w-[180px]">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-1 lg:flex-none">
                    <UserRound className="h-4 w-4 text-gray-500" />
                    <Select
                      value={contactFilter}
                      onValueChange={(value) => {
                        setContactFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-full lg:w-[180px]">
                        <SelectValue placeholder="All Contacts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Contacts</SelectItem>
                        {uniqueContacts.map((contact) => (
                          <SelectItem key={contact} value={contact}>
                            {contact}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="px-3 py-2 text-sm"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border shadow-sm">
              <Table aria-label="Supplier Management Table">
                <TableHeader>
                  <TableRow className="hover:bg-gray-50 border-gray-200">
                    <TableHead className="font-semibold w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleSort('supplier_id')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                        aria-label={`Sort by Supplier ID ${sortConfig.field === 'supplier_id' ? sortConfig.direction : 'asc'}`}
                      >
                        Supplier ID
                        {getSortIcon('supplier_id')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold w-1/4">
                      <button
                        type="button"
                        onClick={() => handleSort('supplier_name')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                        aria-label={`Sort by Supplier Name ${sortConfig.field === 'supplier_name' ? sortConfig.direction : 'asc'}`}
                      >
                        Supplier Name
                        {getSortIcon('supplier_name')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort('email')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        aria-label={`Sort by Email ${sortConfig.field === 'email' ? sortConfig.direction : 'asc'}`}
                      >
                        Email
                        {getSortIcon('email')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('phone')}
                        className="h-8 flex items-center justify-end me-auto gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        aria-label={`Sort by Phone ${sortConfig.field === 'phone' ? sortConfig.direction : ''}`}
                      >
                        Phone #
                        {getSortIcon('phone')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      <button
                        type="button"
                        onClick={() => handleSort('contact_person')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto justify-center hover:text-blue-600"
                        aria-label={`Sort by Contact Person ${sortConfig.field === 'contact_person' ? sortConfig.direction : 'asc'}`}
                      >
                        Contact Person
                        {getSortIcon('contact_person')}
                      </button>
                    </TableHead>
                    <TableHead className="font-semibold text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto justify-center hover:text-blue-600"
                        aria-label={`Sort by Status ${sortConfig.field === 'status' ? sortConfig.direction : 'asc'}`}
                      >
                        Status
                        {getSortIcon('status')}
                      </button>
                    </TableHead>
                    <TableHead className="text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetching ? (
                    Array(itemsPerPage)
                      .fill(0)
                      .map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-3">
                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mx-auto"></div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mx-auto"></div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mx-auto"></div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-center gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : suppliers.length > 0 ? (
                    suppliers.map((supplier) => {
                      const isSupplierUsedInPO = purchaseOrderSupplierIds.includes(supplier.id);
                      console.log(`${supplier.id}: ${isSupplierUsedInPO}`)
                      return (
                        <TableRow key={supplier.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-3">
                            <p className="ps-2">{supplier.supplier_id || supplier.id || "N/A"}</p>
                          </TableCell>
                          <TableCell className="font-medium"><p className="ps-2">{supplier.supplier_name || "N/A"} </p></TableCell>
                          <TableCell>{supplier.email || "N/A"}</TableCell>
                          <TableCell className='text-left'>{supplier.phone || "N/A"}</TableCell>
                          <TableCell >{supplier.contact_person || "N/A"}</TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`font-medium capitalize ${statusStyles[supplier.status!.toLowerCase()] || statusStyles.default
                                }`}
                            >
                              {supplier.status || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleView(supplier)}
                                      disabled={!hasPermission('View')}
                                      className={
                                        !hasPermission('View')
                                          ? 'opacity-50 cursor-not-allowed'
                                          : ''
                                      }
                                      aria-label={`View supplier ${supplier.supplier_name || supplier.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {hasPermission('View')
                                    ? 'View Supplier'
                                    : 'You do not have permission to view suppliers'}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleEdit(supplier)}
                                      disabled={!hasPermission('Edit')}
                                      className={
                                        !hasPermission('Edit')
                                          ? 'opacity-50 cursor-not-allowed'
                                          : ''
                                      }
                                      aria-label={`Edit supplier ${supplier.supplier_name || supplier.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {hasPermission('Edit')
                                    ? 'Edit Supplier'
                                    : 'You do not have permission to edit suppliers'}
                                </TooltipContent>
                              </Tooltip>
                              {isSupplierUsedInPO ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10 opacity-50 cursor-not-allowed"
                                        disabled
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>

                                  <TooltipContent>
                                    <p>
                                      Cannot delete this supplier. Purchase orders are associated with this supplier.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className={`text-destructive hover:bg-destructive/10 ${!hasPermission('Delete')
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                          }`}
                                        onClick={() => openDeleteDialog(supplier)}
                                        disabled={!hasPermission('Delete')}
                                        aria-label={`Delete supplier ${supplier.supplier_name || supplier.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>

                                  <TooltipContent>
                                    {hasPermission('Delete')
                                      ? 'Delete Supplier'
                                      : 'You do not have permission to delete suppliers'}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow className="hover:bg-gray-50">
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center py-6">
                          <Building2 className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">
                            {totalItems === 0 ? "No suppliers available" : "No suppliers found"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {totalItems === 0
                              ? "Add a new supplier to get started"
                              : "Try adjusting your search or filter"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

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
                  Showing {suppliers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
                  {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || isFetching}
                    aria-label="Previous page"
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
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || isFetching || totalPages === 0}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this supplier?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setSupplierToDelete(undefined)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="Confirm delete supplier"
              >
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  FileText,
  Printer,
  PackageCheckIcon,
} from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import toast from 'react-hot-toast';
import { ISystemMessageConfig } from '@/Utils/constants';
import { Badge } from '@/components/ui/badge';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import generateQuotationPDF from '../config/QuotationPrintTemplate';

interface QuotationType {
  id: string;
  quotation_number: string;
  quotation_date:string;
  supplier_id: {
        id: string;
        supplier_name: string | null;
    };
  status: string | null;
  pending_action:string | null;
  approval_status:string | null;
  status_id:{
        id: string;
        sub_category_id: string | null;
        value: string | null;
  };
  company_id: string;
  created_by: {
    id:string;
    first_name:string;
    last_name:string;
  }
  created_at: string;
  total_items: number;
}

type SortField = 'quotation_number' | 'total_items' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

interface QuotationItemProps {
  id?: string;
  item_id: string | null;
  item_name: string;
  req_qty: number | null;
  cost_price: number | 0 | null;
}

export const Quotations: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [quotations, setQuotations] = useState<QuotationType[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<ISystemMessageConfig[]>([]);
  const [quotationItems, setQuotationItems] = useState<QuotationItemProps[]>([]);
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const userData = useSelector(selectUser);
  const userId = userData?.id;
  const companyId = userData?.company_id || null;
  const companyData = userData?.company_data;
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.id) {
        const res = await loadModulePermissions(
          appCode,
          'Quotations',
          userData.id
        );

        console.log(res);

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };

    fetchPermissions();
  }, [userData?.id, userData?.role_id]);

  
  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find(
      (p: any) =>
        p.action_id?.actionName?.toLowerCase() ===
        actionName.toLowerCase()
    );

    return perm ? perm.isAllowed : false;
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      if (userData?.role_id) {
        try {
          const { data: roleData, error } = await supabase
            .from('role_master')
            .select('name')
            .eq('id', userData.role_id)
            .eq('is_active', true)
            .single();

          if (error) throw error;

          console.log('Fetched Role Name:', roleData?.name);
          setUserRole(roleData?.name || null);
        } catch (error) {
          console.error('Error fetching role:', error);
        }
      }
    };

    fetchUserRole();
  }, [userData]);

  console.log('Current User Role:', userRole);

    useEffect(() => {
      if (!quotationId || !companyId) return;
  
      const fetchQuotationItems = async () => {
        setLoading(true)
        try {
              const { data:quotation_items, error:qItemsError } = await supabase
              .from('quotation_details')
              .select(`item_mgmt:item_id(id,item_id,item_name),
                req_qty,cost_price`)
              .eq('quotation_id', quotationId)
              .eq('company_id', companyId);
  
            if (qItemsError || !quotation_items) throw new Error('Failed to fetch quotation items');
  
            console.log('quotation_items',quotation_items);
  
            const mappedItems = quotation_items.map((item)=>{
              return {...item.item_mgmt,req_qty:item.req_qty,cost_price:item.cost_price}
            })
  
            setQuotationItems(mappedItems);
  
        } catch (error) {
          console.error("Error fetching quotation:", error);
          toast.error("Failed to fetch quotation data", { position: "top-center" });
        }finally{
          setLoading(false)
        }
      };
      fetchQuotationItems();
    }, [quotationId, companyId]);


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

      useEffect(() => {
    if (!companyId) return;

    const fetchStatusOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq('company_id', companyId)
          .eq('category_id', 'QUOTATION');
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

  const handleEditQuotation = async(quotationId:string)=>{
    const {data:requestId} = await supabase
    .from('approval_requests')
    .select('id')
    .eq('entity_id',quotationId);

    console.log('requestId',requestId)
    console.log(quotationId)

    if(requestId){
      navigate(`/dashboard/QuotationForm/edit/${quotationId}?draft_correction=true&request_id=${requestId[0].id}`)
    }else {
      navigate(`/dashboard/QuotationForm/edit/${quotationId}`)
    }

  }

  const fetchQuotations =async()=>{
    setLoading(true)
    try {
        let query = supabase
        .from('quotation_master')
        .select(`*,
          created_by(id,first_name,last_name),
          supplier_id(id,supplier_name),
          status_id(id,sub_category_id,value)
          `,{count: 'exact'})
        .eq('company_id',companyId!)
        .or(`approval_status.eq.APPROVED,created_by.eq.${userId}`);

      if (statusFilter !== 'all') {
        query = query.eq('status_id', statusFilter);
      }

        if(searchQuery.trim()){
          query.ilike('quotation_number',`%${searchQuery.trim()}%`)
        }

      const startIndex = (currentPage - 1) * itemsPerPage;
      query = query.range(startIndex, startIndex + itemsPerPage - 1);

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });
      }
      const { data: qoutationsData, error: qoutationsError, count } = await query;
      console.log('qoutationsData:', qoutationsData);

      if (qoutationsError) {
        throw qoutationsError;
      }
      setQuotations(qoutationsData as unknown as QuotationType[]);
      setTotalItems(count || 0)
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
        
    } catch (error:any) {
        console.log("Error fetching quotations",error);
        toast.error(error.message)
    }finally{
      setLoading(false)
    }
  }

    useEffect(() => {
    fetchQuotations();
  }, [userId,searchQuery,itemsPerPage,statusFilter,currentPage,sortConfig]);

  const handleFilterReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: 'created_at', direction: 'desc' });
    toast.success('Filters cleared successfully!');
  };

    const exportQuotationsToCSV = async () => {
      setIsExporting(true);
    await exportSupabaseTableToCSV<QuotationType>({
      reportTitle: 'Supplier Quotations',
      headers: ['Quotation Number', 'Quotation Date', 'Supplier Name', 'Total Items', 'Status', 'Created By'],
      rowMapper: (quotation: QuotationType) => [
        `"${quotation.quotation_number}"`,
        `"${new Date(quotation.created_at).toLocaleDateString()}"`,
        `"${quotation.supplier_id.supplier_name || ''}"`,
        `"${quotation.total_items || 0}"`,
        `"${quotation.status_id?.value || "Pending Approval"}"`,
        `"${`${quotation.created_by.first_name} ${''} ${quotation.created_by.last_name}`}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
        .from('quotation_master')
        .select(`*,
          created_by(id,first_name,last_name),
          supplier_id(id,supplier_name),
          status_id(id,sub_category_id,value)
          `,{count: 'exact'})
        .eq('company_id',companyId!)
        .or(`approval_status.eq.APPROVED,created_by.eq.${userId}`);

      if (statusFilter !== 'all') {
        query = query.eq('status_id', statusFilter);
      }

        if(searchQuery.trim()){
          query.ilike('quotation_number',`%${searchQuery.trim()}%`)
        }

      const startIndex = (currentPage - 1) * itemsPerPage;
      query = query.range(startIndex, startIndex + itemsPerPage - 1);

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });
      }

        const { data, error } = await query;
        if (error) throw error;
        return data as unknown as QuotationType[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export quotations: ${err.message}`),
    });
    setIsExporting(false);
  };

    const handleReceiveQuotation = async () => {
      if (!companyId || !userId) return;
  
      try {

        if(!quotationId) return;

          if (quotationId) {
                    const isLocked = await checkEntityLock(quotationId);
                    if (isLocked) {
                        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
                        return;
                    }
                }

        const quotationData = quotations.find((q)=> q.id === quotationId);
        const quotationNumber = quotationData?.quotation_number;

        const receivedStatus = statusOptions.find(status => status.value === "Quotation Received");
        const receivedStatusId = receivedStatus?.id;
        
        const systemLogs = {
          company_id: companyId,
          transaction_date: new Date().toISOString(),
          module: "Quotation",
          scope:  'Receive Quotation',
          key: `${quotationNumber}`,
          log: `Quotation ${quotationNumber} Received.`,
          action_by: userId,
          created_at: new Date().toISOString(),
        };

        const action_payload = {
        operations: [
          {
           table: 'quotation_master',
           type:'update',
           data: { status_id: receivedStatusId},
           match: { id: quotationId}
          },
          ...quotationItems.map(item => ({
            table: 'quotation_details',
            type: 'update',
            match: { id: item.id },
            data: { cost_price: item.cost_price }
          })),
           {
            table: 'system_log',
            type: 'insert',
            data: systemLogs
          }
        ]
      };
    
           const approvalResponse = await initiateApprovalRequest({
                      module_name: 'Quotations',
                      action_name: 'Receive Quotation',
                      company_id: companyId ?? '',
                      requested_by: userId ?? '',
                      side_effects_payload: action_payload,
                      entity_id: quotationId,
                      table_name: 'quotation_master',
                      resubmit_request_id:null
                  });
  
        if (approvalResponse?.success) {
          if (approvalResponse.requires_approval) {      
          toast.success('Your action has been submitted and is currently pending approval.');
          } else {
             await supabase
              .from('quotation_master')
              .update({ status_id: receivedStatusId} as any)
              .eq('id', quotationId);
              
              for (const item of quotationItems){
                await supabase
                .from('quotation_details')
              .update({ cost_price: item.cost_price })
              .eq('quotation_id', quotationId)
              .eq('item_d',item.id!);
            }
            
            const { error: systemLogError } = await supabase
            .from('system_log')
            .insert(systemLogs);
            
            if (systemLogError) throw systemLogError;
            
            toast.success('Quotation Received successfully!');
            fetchQuotations();
          }
  
        }
        } catch (error: any) {
        console.error("Quotation submit error:", error);
        toast.error(error.message || "Failed to save or update quotation");
      }finally{
        setIsReceiveDialogOpen(false)
                    setQuotationId(null)
                    setQuotationItems([])
      }
  };

   const handlePrintQuotation = async (quotationId: string) => {
      try {
        const { data: quotation, error: quotationError } = await (supabase as any)
          .from('quotation_master')
          .select(`
            id,
            quotation_number,
            quotation_date,
            supplier_id(id,supplier_name),
            status:status_id(id, sub_category_id, value)
          `)
          .eq('id', quotationId)
          .single();
  
        if (quotationError) throw quotationError;
  
        const { data: Items, error: quotationItemsError } = await supabase
          .from('quotation_details')
          .select(`
            req_qty,
            cost_price,
            item_mgmt:item_id (item_id, item_name)
          `)
          .eq('quotation_id', quotationId);
  
        if (quotationItemsError) throw quotationItemsError;

        const mappedItems = Items.map((item)=>{
              return {...item.item_mgmt,
                req_qty:item.req_qty,
                cost_price:item.cost_price,
                amount: item.req_qty && item.cost_price ? Number(item.req_qty * item.cost_price) : 0
              }
            })  
  
        generateQuotationPDF({
          companyInfo: {
            name: companyData?.name ?? '',
            phone: companyData?.phone ?? '',
            email: companyData?.email ?? '',
            info: [companyData?.city, companyData?.state, companyData?.country, companyData?.postal_code],
            address: [companyData?.address]
              .filter(Boolean)
              .join(', '),
          },
          id: quotationId,
          quotationNumber: quotation.quotation_number ?? '',
          quotationDate: quotation.quotation_date ?? new Date().toISOString(),
          supplier: quotation.supplier_id.supplier_name ?? '',
          status: quotation.status.value ?? '',
          items: mappedItems,
          grandTotal: mappedItems.reduce((sum, item) => sum + (item.amount || 0), 0),
        });
      } catch (err) {
        console.error('Error printing quotation:', err);
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
    const getStatusBadgeColor = (status?: string) => {
        if (!status) return 'bg-yellow-100 text-yellow-700 border border-yellow-300';

        if (status.includes('Quotation Received'))
            return 'bg-green-100 text-green-700';

        if (status.includes('Quotation Issued'))
            return 'bg-blue-100 text-blue-700';

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
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Quotations
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage supplier quotations and compare offers
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* Export Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="outline"
                          onClick={exportQuotationsToCSV}
                          disabled={
                            quotations.length === 0 ||
                            loading ||
                            isExporting ||
                            !hasPermission('Export')
                          }
                        >
                          <Download
                            className={`mr-2 h-4 w-4 ${isExporting ? 'animate-spin' : ''
                              }`}
                          />
                          <span>
                            {isExporting ? 'Exporting...' : 'Export CSV'}
                          </span>
                        </Button>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent>
                      {hasPermission('Export')
                        ? 'Export Quotations'
                        : 'You do not have permission to export quotations'}
                    </TooltipContent>
                  </Tooltip>

                  {/* Add Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            onClick={() => navigate("/dashboard/Quotation/create")}
                            disabled={loading || !hasPermission('Add')}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Quotation
                          </Button>
                        </div>
                      </TooltipTrigger>

                      <TooltipContent>
                        {hasPermission('Add')
                          ? 'Add Quotation'
                          : 'You do not have permission to add quotations'}
                      </TooltipContent>
                    </Tooltip>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Filters */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full sm:w-1/3">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by Quotation Number..."
                      value={searchQuery}
                      onChange={(e) => {
                        console.log('searchQuery',e.target.value)
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-[250px]">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => {
                        setStatusFilter(value);
                        setCurrentPage(1);
                      }}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                        {statusOptions.map(status => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleFilterReset}
                    className="transition-colors w-full sm:w-auto"
                    disabled={loading}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg overflow-hidden border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold w-[150px]">
                        <button
                          type="button"
                          onClick={() => handleSort('quotation_number')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600 ps-2"
                        >
                          Quotation Number
                          {getSortIcon('quotation_number')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('created_at')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        >
                          Date
                          {getSortIcon('created_at')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">Supplier Name</TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('total_items')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer justify-start hover:text-blue-600"
                        >
                          Total Items
                          {getSortIcon('total_items')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-3"><div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-60 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : quotations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center py-6">
                            <Building2 className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">
                              {searchQuery.trim()
                                ? 'No quotations found matching your search'
                                : 'No quotations available'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {searchQuery.trim()
                                ? 'Try adjusting your search terms or filters'
                                : 'Create a new quotations to get started'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      quotations.map((quotation) => (
                        <TableRow key={quotation.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-3">
                            <div className="ps-2">
                              <p className="text-sm">{quotation.quotation_number}</p>
                            </div>
                          </TableCell>
                         <TableCell className="text-left">
                            <p className="text-sm">{formatDate(quotation.created_at)}</p>
                          </TableCell>
                          <TableCell className="min-w-[250px] whitespace-normal break-words">
                            <div className="max-w-md">
                              <p className="text-sm">{quotation.supplier_id.supplier_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right w-[50px]">
                            <p className="text-sm">{quotation.total_items}</p>
                          </TableCell>
                          <TableCell className="text-center ms-1">
                            <Badge
                              variant="outline"
                              className={getStatusBadgeColor(quotation.status_id?.value!)}
                            >
                              {quotation.status_id?.value ? `${quotation.status_id?.value}` : "Pending Approval"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              {/* View Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      disabled={loading || !hasPermission('View')}
                                      onClick={() => navigate(`/dashboard/Quotation/view/${quotation.id}`)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {hasPermission('View')
                                    ? 'View Quotation'
                                    : 'You do not have permission to view Quotations'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Edit Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      disabled={loading || !hasPermission('Edit') || ["Quotation Issued","Quotation Received"].includes(quotation.status_id?.value ?? "Pending Approval")}
                                      onClick={() => handleEditQuotation(quotation.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {!hasPermission('Edit')
                                      ? 'You do not have permission to edit Quotations' :
                                      ["Quotation Issued","Quotation Received"].includes(quotation.status_id?.value ?? "Pending Approval") ?
                                      'Issued or Received Quotations cannot be edited'
                                      : 'Edit Quotation'}
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={()=>handlePrintQuotation(quotation.id)}
                                  disabled={loading || !hasPermission('Print')}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasPermission('Print')
                                    ? 'Print Quotation'
                                    : 'You do not have permission to Print Quotation'}
                                    </TooltipContent>
                              </Tooltip>

                               <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                    variant="outline"
                                    size="icon"
                                    className='border border-green-300'
                                  disabled={loading || !hasPermission('Receive Quotation') || quotation.status_id?.value !=="Quotation Issued"}
                                  onClick={()=>{
                                    setIsReceiveDialogOpen(true)
                                    setQuotationId(quotation.id)
                                  }}
                                  >
                                    <PackageCheckIcon className=" text-green-600" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {!hasPermission('Receive Quotation')
                                    ? 'You do not have permission to Receive Quotation' : 
                                    quotation.status_id?.value !=="Quotation Issued" ? 'Only issued quotations can be received'
                                    : 'Receive Quotation'}
                                    </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
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
                    disabled={loading}
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
                    Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || loading}
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
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
                      disabled={currentPage === totalPages || loading || totalPages === 0}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isReceiveDialogOpen} onOpenChange={(open) => {
                    setIsReceiveDialogOpen(open)
                    if(!open){
                      setQuotationId(null)
                      setQuotationItems([])
                    }
                    }}>
            <DialogContent className="md:max-w-[50vw]">
              <DialogHeader>
                <DialogTitle>Receive Quotation</DialogTitle>
                <DialogDescription>
                Update cost price before receiving quotation
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md shadow border overflow-hidden my-3">
            <Table>
              <TableHeader>
                <TableRow className="text-md">
                  <TableHead className="w-[160px] ps-5">Item Code</TableHead>
                  <TableHead className="h-11 w-[200px]">Item Name</TableHead>
                  <TableHead className="text-center w-[300px]">Req Qty</TableHead>
                  <TableHead className="text-center w-[300px]">Cost Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotationItems.map((item: QuotationItemProps) => {

                  return (
                    <TableRow key={item.id} className="text-md bg-white">
                      <TableCell className=" ps-5">{item.item_id}</TableCell>
                      <TableCell className="">{item.item_name}</TableCell>
                      <TableCell className="text-center">{item.req_qty}</TableCell>
                      <TableCell className="text-center">
                          <Input
                            value={item.cost_price || 0}
                            className=" text-center mx-auto w-[200px]"
                            type="number"
                            min={0}
                            onChange={(e) => {
                              const newPrice = Number(e.target.value)
                              const updatedItems = quotationItems.map((qItem) =>qItem.id === item.id ? { ...qItem, cost_price: newPrice } : qItem)
                              setQuotationItems(updatedItems)
                            }}
                          />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => {
                    setIsReceiveDialogOpen(false)
                    setQuotationId(null)
                    setQuotationItems([])
                    }}
                     disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={loading}
                  onClick={()=>handleReceiveQuotation()}
                >
                  Receive Quotation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};
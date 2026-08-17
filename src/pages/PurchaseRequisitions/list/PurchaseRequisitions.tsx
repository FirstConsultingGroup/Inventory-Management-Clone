import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Edit,
  Printer,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck,
  ChevronDown,
  Package,
  CalendarDays,

  MapPin,
  CheckCircle2,
  Layers3,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/Utils/types/supabaseClient';
import { ISystemMessageConfig } from '@/Utils/constants';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import generatePurchaseRequisitionPDF from '../config/PurchaseReqPrintTemplate';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import { loadModulePermissions } from '@/Utils/commonFun';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import ViewItems from './ViewItems';
import ClosedRequisitions from './ClosedRequisitions';
import PurchaseRequisitionForm from '../config/PurchaseRequisitionForm';


interface PurchaseReqDisplay {
  store: any;
  categoryType: string;
  id: string;
  prNumber: string;
  prDate: string;
  status: string;
  statusValue: string;
  totalItems: number;
  createdBy: string;

  availableQty: number;
  stockStatus: string;
  isTemporary: boolean;
}

type StoreOptions = {
  id: string;
  name: string;
}

type CategoryTypeFilter = 'all' | 'internal' | 'external';
type LoadingSection = 'all' | 'inStock' | 'outStock' | 'temporary' | 'closed';

const PurchaseRequisitions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
const [activeTab, setActiveTab] = useState(
  location.state?.activeTab ?? "requisition"
);
  const userData = useSelector(selectUser);
  const companyId = userData?.company_id || null;
  const userId = userData?.id;
  const roleId = userData?.role_id || null;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [inStockPurchaseRequisitions, setInStockPurchaseRequisitions] = useState<PurchaseReqDisplay[]>([]);
  const [outOfStockPurchaseRequisitions, setOutOfStockPurchaseRequisitions] = useState<PurchaseReqDisplay[]>([]);
  const [temporarySpareParts, setTemporarySpareParts] = useState<PurchaseReqDisplay[]>([]);
  const [closedPurchaseRequisitions, setClosedPurchaseRequisitions] = useState<PurchaseReqDisplay[]>([]);

  const [inStockTotalItems, setInStockTotalItems] = useState<number>(0);
  const [outStockTotalItems, setOutStockTotalItems] = useState<number>(0);
  const [temporaryTotalItems, setTemporaryTotalItems] = useState<number>(0);
  const [closedTotalItems, setClosedTotalItems] = useState<number>(0);

  const [inStockLoading, setInStockLoading] = useState(true);
  const [outStockLoading, setOutStockLoading] = useState(true);
  const [temporaryLoading, setTemporaryLoading] = useState(true);
  const [closedLoading, setClosedLoading] = useState(true);
  const loadingTarget = React.useRef<LoadingSection>('all');

  const applySectionLoading = (target: LoadingSection, isLoading: boolean) => {
    if (target === 'all' || target === 'inStock') setInStockLoading(isLoading);
    if (target === 'all' || target === 'outStock') setOutStockLoading(isLoading);
    if (target === 'all' || target === 'temporary') setTemporaryLoading(isLoading);
    if (target === 'all' || target === 'closed') setClosedLoading(isLoading);
  };

  const [_loading, setIsLoading] = useState(false);
  const [statusOptions, setStatusOptions] = useState<ISystemMessageConfig[]>([]);
  const [storeOptions, setStoreOptions] = useState<StoreOptions[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userInitialized, setUserInitialized] = useState(false);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<CategoryTypeFilter>('all');
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);


  const [inStockPage, setInStockPage] = useState(1);
  const [inStockItemsPerPage, setInStockItemsPerPage] = useState(10);

  const [outStockPage, setOutStockPage] = useState(1);
  const [outStockItemsPerPage, setOutStockItemsPerPage] = useState(10);

  const [temporaryPage, setTemporaryPage] = useState(1);
  const [temporaryItemsPerPage, setTemporaryItemsPerPage] = useState(10);

  const [closedPage, setClosedPage] = useState(1);
  const [closedItemsPerPage, setClosedItemsPerPage] = useState(10);


  const [viewItems, setViewItems] = useState(false);

const [closedRequisitionPageView,setClosedRequisitionPageView]=useState(false)

useEffect(() => {
  if (location.state?.activeTab) {
    setActiveTab(location.state.activeTab);
  }
}, [location.state]);

useEffect(() => {
    if (activeTab === 'items') {
      setViewItems(true);
    } 
    else if(activeTab === 'closedReq'){
      setClosedRequisitionPageView(true);
    }else {
      setViewItems(false);
      setClosedRequisitionPageView(false);
    }
}, [activeTab]);

 const dummyItems = [
  {
    id: "ITEM-001",
    itemName: "Engine Oil Filter",

    permanentInStock: [
      {
        id: "1",
        prNumber: "PR-200726-0003",
        date: "20 Jul 2026",
        categoryType: "External",
        store: "LogiNest Abu Dhabi",
        totalItems: 1,
        status: "APPROVED",
        createdBy: "Super Admin",
      },
      {
        id: "2",
        prNumber: "PR-200726-0012",
        date: "22 Jul 2026",
        categoryType: "Internal",
        store: "Main Workshop",
        totalItems: 3,
        status: "PENDING",
        createdBy: "Purchase Manager",
      },
    ],

    permanentOutOfStock: [
      {
        id: "3",
        prNumber: "PR-200726-0018",
        date: "24 Jul 2026",
        categoryType: "External",
        store: "Service Center A",
        totalItems: 2,
        status: "CLOSED",
        createdBy: "Store Manager",
      },
    ],
  },

  {
    id: "ITEM-002",
    itemName: "Brake Pad Set",

    permanentInStock: [
      {
        id: "4",
        prNumber: "PR-200726-0020",
        date: "25 Jul 2026",
        categoryType: "Internal",
        store: "Main Workshop",
        totalItems: 4,
        status: "APPROVED",
        createdBy: "Inventory Admin",
      },
    ],

    permanentOutOfStock: [
      {
        id: "5",
        prNumber: "PR-200726-0025",
        date: "26 Jul 2026",
        categoryType: "External",
        store: "Service Center B",
        totalItems: 2,
        status: "PENDING",
        createdBy: "Store Manager",
      },
    ],
  },

  {
    id: "ITEM-003",
    itemName: "Air Filter",

    permanentInStock: [
      {
        id: "6",
        prNumber: "PR-200726-0030",
        date: "27 Jul 2026",
        categoryType: "Internal",
        store: "Spare Parts Warehouse",
        totalItems: 6,
        status: "APPROVED",
        createdBy: "Purchase Officer",
      },
      {
        id: "7",
        prNumber: "PR-200726-0033",
        date: "28 Jul 2026",
        categoryType: "External",
        store: "Branch Workshop",
        totalItems: 1,
        status: "CLOSED",
        createdBy: "Store Manager",
      },
    ],

    permanentOutOfStock: [
      {
        id: "8",
        prNumber: "PR-200726-0036",
        date: "29 Jul 2026",
        categoryType: "External",
        store: "Service Center B",
        totalItems: 3,
        status: "PENDING",
        createdBy: "Purchase Manager",
      },
      {
        id: "9",
        prNumber: "PR-200726-0039",
        date: "30 Jul 2026",
        categoryType: "Internal",
        store: "Main Workshop",
        totalItems: 2,
        status: "APPROVED",
        createdBy: "Inventory Admin",
      },
    ],
  },

  {
    id: "ITEM-004",
    itemName: "Spark Plug",

    permanentInStock: [
      {
        id: "10",
        prNumber: "PR-200726-0040",
        date: "31 Jul 2026",
        categoryType: "External",
        store: "Main Workshop",
        totalItems: 8,
        status: "APPROVED",
        createdBy: "Super Admin",
      },
      {
        id: "11",
        prNumber: "PR-200726-0042",
        date: "01 Aug 2026",
        categoryType: "Internal",
        store: "Service Center A",
        totalItems: 5,
        status: "PENDING",
        createdBy: "Purchase Manager",
      },
    ],

    permanentOutOfStock: [
      {
        id: "12",
        prNumber: "PR-200726-0045",
        date: "02 Aug 2026",
        categoryType: "External",
        store: "Branch Workshop",
        totalItems: 3,
        status: "CLOSED",
        createdBy: "Store Manager",
      },
    ],
  },

  {
    id: "ITEM-005",
    itemName: "Battery 12V",

    permanentInStock: [
      {
        id: "13",
        prNumber: "PR-200726-0050",
        date: "03 Aug 2026",
        categoryType: "Internal",
        store: "Main Workshop",
        totalItems: 3,
        status: "APPROVED",
        createdBy: "Inventory Admin",
      },
      {
        id: "14",
        prNumber: "PR-200726-0053",
        date: "04 Aug 2026",
        categoryType: "External",
        store: "LogiNest Abu Dhabi",
        totalItems: 2,
        status: "PENDING",
        createdBy: "Purchase Manager",
      },
    ],

    permanentOutOfStock: [
      {
        id: "15",
        prNumber: "PR-200726-0056",
        date: "05 Aug 2026",
        categoryType: "External",
        store: "Service Center A",
        totalItems: 4,
        status: "CLOSED",
        createdBy: "Store Manager",
      },
      {
        id: "16",
        prNumber: "PR-200726-0059",
        date: "06 Aug 2026",
        categoryType: "Internal",
        store: "Spare Parts Warehouse",
        totalItems: 1,
        status: "APPROVED",
        createdBy: "Super Admin",
      },
    ],
  },
];



  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  // Check the user is 'Super Admin'
  useEffect(() => {
    if (!companyId || !roleId) return;

    const initializeUser = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('role_master')
          .select('id')
          .eq('company_id', companyId)
          .eq('name', 'Super Admin')
          .eq('is_active', true)
          .single();

        if (error) throw error;

        setIsSuperAdmin(roleId === data.id);
      } catch (err) {
        console.error('Error initializing user:', err);
      } finally {
        setUserInitialized(true);
      }
    };

    initializeUser();
  }, [companyId, roleId]);

  // Fetch status options
  useEffect(() => {
    if (!companyId) return;

    const fetchStatusOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('system_message_config')
          .select('*')
          .eq('company_id', companyId)
          .eq("category_id", 'PURCHASE_REQUISITION');
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
  }, []);

  // Fetch store options
  useEffect(() => {
    if (!companyId) return;

    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from("store_mgmt")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true);

        if (error) {
          console.error("Failed to fetch stores", error);
          return;
        }

        const storeList = data ?? [];
        setStoreOptions(storeList);
      } catch (error) {
        console.error("Error fetching stores", error);
      }
    };

    fetchStores();
  }, [companyId]);

  // Fetch Purchase Requisitions
  useEffect(() => {
    if (!companyId || !userInitialized) return;

    const fetchPurchaseRequisitions = async () => {
      const target = loadingTarget.current;
      try {
        applySectionLoading(target, true);

        const { data, error } = await supabase.rpc(
          'get_purchase_requisitions_for_listing',
          {
            p_company_id: companyId,
            p_user_id: userId ?? '',
            p_is_super_admin: isSuperAdmin,
            p_status: statusFilter === 'all' ? null : statusFilter,
            p_store_id: storeFilter === 'all' ? null : storeFilter,
            p_category_type: categoryTypeFilter,
            p_search: searchTerm || null,

            p_in_stock_page: inStockPage,
            p_in_stock_limit: inStockItemsPerPage,

            p_out_stock_page: outStockPage,
            p_out_stock_limit: outStockItemsPerPage,

            p_temp_page: temporaryPage,
            p_temp_limit: temporaryItemsPerPage,

              p_closed_page: 1,
              p_closed_limit: 0
          } as any
        );

        if (error) throw error;

        const responseData = data as any;
        if (!responseData) {
          setInStockPurchaseRequisitions([]);
          setOutOfStockPurchaseRequisitions([]);
          setTemporarySpareParts([]);
          setClosedPurchaseRequisitions([]);
          return;
        }
        console.log("data from rpc",responseData)

        const formatReq = (req: any) => ({
          id: req.id,
          prNumber: req.purchase_req_number,
          prDate: req.purchase_req_date,
          status: req.status,
          statusValue: req.status_value,
          totalItems: req.total_items,
          createdBy: req.created_by,
          categoryType: req.category_type,
          store: req.store,
          availableQty: req.available_qty,
          stockStatus: req.stock_status,
          isTemporary: req.is_temporary,
        });

        setInStockPurchaseRequisitions((responseData.inStock?.data || []).map(formatReq));
        setInStockTotalItems(responseData.inStock?.totalCount || 0);

        setOutOfStockPurchaseRequisitions((responseData.outOfStock?.data || []).map(formatReq));
        setOutStockTotalItems(responseData.outOfStock?.totalCount || 0);

        setTemporarySpareParts((responseData.temporaryItems?.data || []).map(formatReq));
        setTemporaryTotalItems(responseData.temporaryItems?.totalCount || 0);

        //  setClosedPurchaseRequisitions((responseData.closed?.data || []).map(formatReq));
        // setClosedTotalItems(responseData.closed?.totalCount || 0);

        setClosedPurchaseRequisitions([]);
        setClosedTotalItems(0);

      } catch (err) {
        console.error('Unexpected error fetching purchase requisitions:', err);
      } finally {
        applySectionLoading(target, false);
        loadingTarget.current = 'all';
      }
    };

    fetchPurchaseRequisitions();

  }, [companyId, userId, isSuperAdmin, searchTerm, statusFilter, categoryTypeFilter, userInitialized, storeFilter, inStockPage, inStockItemsPerPage, outStockPage, outStockItemsPerPage, temporaryPage, temporaryItemsPerPage]);

  const inStockTotalPages = Math.ceil((inStockTotalItems || 0) / (inStockItemsPerPage || 1));
  const outStockTotalPages = Math.ceil((outStockTotalItems || 0) / (outStockItemsPerPage || 1));
  const temporaryTotalPages = Math.ceil((temporaryTotalItems || 0) / (temporaryItemsPerPage || 1));
  const closedTotalPages = Math.ceil((closedTotalItems || 0) / (closedItemsPerPage || 1));

  const hasAnyRequisitions = inStockPurchaseRequisitions.length > 0 || outOfStockPurchaseRequisitions.length > 0 || temporarySpareParts.length > 0 || closedPurchaseRequisitions.length > 0;

  const formatExportDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '';
      return format(date, 'dd-MMM-yyyy');
    } catch {
      return '';
    }
  };

  const csvCell = (value: string | number | null | undefined): string => {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const exportPurchaseReqsToCSV = async () => {
    await exportSupabaseTableToCSV<any>({
      reportTitle: 'Purchase Requisitions',

      headers: [
        'Purchase Requisition Number',
        'Requisition Date',
        'Category Type',
        'Store',
        'Total Items',
        'Status',
        'Created By'
      ],

      rowMapper: (req) => [
        csvCell(req.purchase_req_number),
        csvCell(formatExportDate(req.purchase_req_date)),
        csvCell(req.category_type),
        csvCell(req.store?.name),
        csvCell(req.total_items ?? 0),
        csvCell(
          req.status_value
            ?.replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? ''
        ),
        csvCell(req.created_by),
      ],

      supabaseClient: supabase,

      fetcher: async () => {

        if(closedRequisitionPageView == true){
          const { data :closedReq, error } = await supabase.rpc("get_closed_purchase_requisitions_for_listing" as any, {
                  p_company_id: companyId,
                  p_user_id: userId,
                  p_is_super_admin: isSuperAdmin,
                  p_status: statusFilter === 'all' ? null : statusFilter,
            p_store_id: storeFilter === 'all' ? null : storeFilter,
            p_category_type: categoryTypeFilter,
            p_search: searchTerm || null,
            p_closed_page: 1, p_closed_limit: 999999
                })

            const data = closedReq?.closed?.data || [];

        if (error) throw error;
 
        return data ?? [];
        } else{

           const { data: rawData, error } = await supabase.rpc(
          'get_purchase_requisitions_for_listing',
          {
            p_company_id: companyId ?? '',
            p_user_id: userId ?? '',
            p_is_super_admin: isSuperAdmin,
            p_status: statusFilter === 'all' ? null : statusFilter,
            p_store_id: storeFilter === 'all' ? null : storeFilter,
            p_category_type: categoryTypeFilter,
            p_search: searchTerm || null,
            p_in_stock_page: 1, p_in_stock_limit: 999999,
            p_out_stock_page: 1, p_out_stock_limit: 999999,
            p_temp_page: 1, p_temp_limit: 999999,
            p_closed_page: 1, p_closed_limit: 0
          } as any
          
        );
   
         const responseData = rawData as any;
         const data = responseData ? [
           ...(responseData.inStock?.data || []),
           ...(responseData.outOfStock?.data || []),
           ...(responseData.temporaryItems?.data || []),
          
         ] : [];

         if (error) throw error;
 
        return data ?? [];
        
        }
      },

      onError: (err) => {
        console.error('Failed to export purchase requisitions:', err);
      }
    });
  };

  const handleView = (id: string) => {
    navigate(`/dashboard/purchaseRequisition/view/${id}`, 
      {state: { fromPurchaseRequisition: true,
        activeTab: viewItems ? 'items' : 
        closedRequisitionPageView ? 'closedReq' : 'requisitions'}});
  };

  const handleApprovalView = (id: string) => {
    navigate(`/dashboard/purchaseRequisition/view-approvals/${id}`, 
      {state: {fromPurchaseRequisition: true, 
        activeTab: viewItems ? 'items' : 
        closedRequisitionPageView ? 'closedReq' : 'requisitions'}});
  };

  const handleEdit = (id: string) => {
    navigate(`/dashboard/purchaseRequisitionForm/edit/${id}`, 
      {state: {fromPurchaseRequisition: true, 
        activeTab: viewItems ? 'items' : 
        closedRequisitionPageView ? 'closedReq' : 'requisitions'}});
  };

  const handlePrint = async (id: string) => {
    const { data: pr } = await supabase
      .from("purchase_req_master")
      .select(`
                purchase_req_number,
                purchase_req_date,
                system_message_config!purchase_req_master_status_fkey (sub_category_id),
                user_mgmt:created_by(first_name, last_name),
                company:company_id(name, address, city, state, country, postal_code, phone, email)
            `)
      .eq("id", id)
      .single();

    const { data: items } = await supabase
      .from("purchase_req_details")
      .select(`
                req_qty,
                item_mgmt:item_id (item_id, item_name)
            `)
      .eq("purchase_req_id", id);

    generatePurchaseRequisitionPDF({
      prNumber: pr?.purchase_req_number ?? '',
      prDate: pr?.purchase_req_date ?? new Date().toISOString(),
      status: pr?.system_message_config?.sub_category_id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) ?? '',
      requestedBy: `${pr?.user_mgmt?.first_name ?? ''} ${pr?.user_mgmt?.last_name ?? ''}`,
      company: {
        name: pr?.company?.name ?? '',
        address: pr?.company?.address ?? '',
        city: pr?.company?.city ?? '',
        state: pr?.company?.state ?? '',
        country: pr?.company?.country ?? '',
        postalCode: pr?.company?.postal_code ?? '',
        phone: pr?.company?.phone ?? '',
        email: pr?.company?.email ?? '',
      },
      items: (items ?? []).map(i => ({
        itemCode: i.item_mgmt?.item_id ?? '',
        itemName: i.item_mgmt?.item_name ?? '',
        quantity: i.req_qty ?? 0,
      })),
    });

  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStoreFilter('all');
    setCategoryTypeFilter('all');

    loadingTarget.current = 'all'; setInStockPage(1); setOutStockPage(1); setTemporaryPage(1); setClosedPage(1);
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(
          appCode,
          'Purchase Requisitions',
          userData.user_id
        );

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
          console.log("Permissions", res.permissions)
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
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                     Requisitions
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage and track your requisition requests
                  </CardDescription>
                </div>
              </div>


              <div className="flex items-center gap-3">
               
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="outline"
                          onClick={exportPurchaseReqsToCSV}
                          className="transition-colors me-2"
                          disabled={
                            !hasPermission("Export") ||
                            !hasAnyRequisitions
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
                        : !hasAnyRequisitions
                          ? "No requisitions available to export"
                          : "Export Purchase Requisitions"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Link
                          to={
                            hasPermission("Add")
                              ? "/dashboard/purchaseRequisitionForm/create"
                              : "#"
                          }
                        >
                          <Button
                            className="transition-colors"
                            disabled={!hasPermission("Add")}
                          >
                            <Plus className="h-4 w-4" />
                            Create Requisition
                          </Button>
                        </Link>
                      </span>
                    </TooltipTrigger>

                    <TooltipContent>
                      {hasPermission("Add")
                        ? "Create Requisition"
                        : "You do not have permission to create requisitions"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CardContent >
            <div className="mb-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
  
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
      <Layers3 className="h-5 w-5 text-blue-600" />
    </div>

    <div>
      <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-800">
        Grouped By
      </h2>

      <p className="mt-0.5 text-xs text-slate-500">
        Choose how you want to view the requisitions
      </p>
    </div>
  </div>

 
  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
    <button
      onClick={() => {setViewItems(false); setClosedRequisitionPageView(false)}}
      className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
        !viewItems && !closedRequisitionPageView
          ? "bg-blue-50 text-blue-600 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <FileText className="h-4 w-4" />
      Requisitions
    </button>

    <button
      onClick={() => {setViewItems(true); setClosedRequisitionPageView(false)}}
      className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
        viewItems
          ? "bg-blue-50 text-blue-600 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <Package className="h-4 w-4" />
      Items
    </button>

  <button onClick={()=>{setClosedRequisitionPageView(true);
  setViewItems(false)}} 
       className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
        closedRequisitionPageView
          ? "bg-blue-50 text-blue-600 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
   >
      <CheckCircle2 className="h-4 w-4" />
      Closed Requisitions
    </button>
  </div>
</div>
            <div className="mb-6">
              
              <div className="flex flex-col sm:flex-row items-center gap-4">


                <div className="relative flex-1 w-full sm:w-1/3">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by Requisition #..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      loadingTarget.current = 'all'; setInStockPage(1); setOutStockPage(1); setTemporaryPage(1); setClosedPage(1);
                    }}
                    className="pl-10"
                  />
                </div>

                {/* Category Type Filtration */}
                <div className="flex items-center gap-2 w-full sm:w-[180px]">
                  <Select
                    value={categoryTypeFilter}
                    onValueChange={(value) => {
                      setCategoryTypeFilter(value as CategoryTypeFilter);
                      loadingTarget.current = 'all'; setInStockPage(1); setOutStockPage(1); setTemporaryPage(1); setClosedPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Category Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Category Types</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Store Filtration */}
                <div className="flex items-center gap-2 w-full sm:w-[180px]">
                  <Select
                    value={storeFilter}
                    onValueChange={(value) => {
                      setStoreFilter(value);
                      loadingTarget.current = 'all'; setInStockPage(1); setOutStockPage(1); setTemporaryPage(1); setClosedPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Stores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {storeOptions.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

             
                  {!closedRequisitionPageView && (
                       <div className="flex items-center gap-2 w-full sm:w-[180px]">
<Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      loadingTarget.current = 'all'; setInStockPage(1); setOutStockPage(1); setTemporaryPage(1); setClosedPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.sub_category_id
                            .replace(/_/g, ' ')
                            .toLowerCase()
                            .replace(/\b\w/g, c => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                    </div>
                  )}
                  
              

                <Button
                  variant="outline"
                  className="transition-colors w-full sm:w-auto"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {closedRequisitionPageView && userData?.company_id && userData?.id ?(
              <ClosedRequisitions
  companyId={userData?.company_id}
  userId={userData?.id}
  isSuperAdmin={isSuperAdmin}
  statusFilter={statusFilter}
  storeFilter={storeFilter}
  categoryTypeFilter={categoryTypeFilter}
  searchTerm={searchTerm}
  hasPermission={hasPermission}
  handleView={handleView}
  handleEdit={handleEdit}
  handlePrint={handlePrint}
  handleApprovalView={handleApprovalView}
/>
            ):

            viewItems ?(
            
           <ViewItems
  viewItems={viewItems}
  statusFilter={statusFilter}
  storeFilter={storeFilter}
  categoryTypeFilter={categoryTypeFilter}
  searchTerm={searchTerm}
  hasPermission={hasPermission}
  handleView={handleView}
  handleEdit={handleEdit}
  handlePrint={handlePrint}
  handleApprovalView={handleApprovalView}
/>   
            ):

             (

  <div className="space-y-8">
              {/* ===================== 1. PERMANENT ITEMS (IN STOCK) ===================== */}
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-green-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-green-700">
                        Permanent Items (In Stock)
                      </CardTitle>
                      <CardDescription>
                        Available permanent items requisitions
                      </CardDescription>
                    </div>

                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      {inStockTotalItems} Records
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="rounded-lg overflow-hidden border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-gray-50 border-gray-200">
                          <TableHead className="font-semibold w-[180px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2">
                              Purchase Requisition Order #

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold w-[150px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600">
                              Requisition Date

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">Category Type</TableHead>

                          <TableHead className="font-semibold">Store</TableHead>

                          <TableHead className="font-semibold text-right">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer justify-end hover:text-blue-600 w-full">
                              Total Items

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">Status</TableHead>

                          <TableHead className="font-semibold">Created By</TableHead>

                          <TableHead className="font-semibold text-center">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {inStockLoading ? (
                          Array(inStockItemsPerPage).fill(0).map((_, i) => (
                            <TableRow key={i}>
                              {Array(8).fill(0).map((__, j) => (
                                <TableCell key={j}><div className="h-4 w-full bg-gray-200 animate-pulse rounded" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : inStockPurchaseRequisitions.length > 0 ? (
                          inStockPurchaseRequisitions.map((item) => (
                            <TableRow key={item.id} className="hover:bg-gray-50">

                              <TableCell className="font-medium py-3">
                                <p className="ps-2">{item.prNumber}</p>
                              </TableCell>

                              <TableCell>
                                {item.prDate
                                  ? format(new Date(item.prDate), "dd MMM yyyy")
                                  : "-"}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.categoryType}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.store?.name || "-"}
                              </TableCell>

                              <TableCell className="text-right">
                                {item.totalItems}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.statusValue === "APPROVED"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : item.statusValue === "NEW"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : item.statusValue === "REJECTED"
                                          ? "bg-red-100 text-red-800 border-red-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                  }
                                >
                                  {item.statusValue}
                                </Badge>
                              </TableCell>

                              <TableCell>{item.createdBy}</TableCell>

                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">

                                  {/* View */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(item.id)}
                                          >
                                            <FileText className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View")
                                          ? "View Requisition"
                                          : "You do not have permission to view requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Edit */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(item.id)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Edit")
                                          ? "Edit Requisition"
                                          : "You do not have permission to edit requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* View Approvals */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(item.id)}
                                          >
                                            <FileCheck className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View Approvals")
                                          ? "View Approval Details"
                                          : "You do not have permission to view approvals"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Print */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(item.id)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Print")
                                          ? "Print Requisition"
                                          : "You do not have permission to print requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                </div>
                              </TableCell>

                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                              No in-stock requisitions found
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
                        value={inStockItemsPerPage.toString()}
                        onValueChange={(value) => {
                          loadingTarget.current = 'inStock';
                          setInStockItemsPerPage(Number(value));
                          setInStockPage(1);
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
                        Showing{" "}
                        {inStockTotalItems === 0
                          ? 0
                          : (inStockPage - 1) * inStockItemsPerPage + 1}
                        {" "}to{" "}
                        {Math.min(
                          inStockPage * inStockItemsPerPage,
                          inStockTotalItems
                        )}
                        {" "}of {inStockTotalItems} entries
                      </p>

                      <div className="flex items-center space-x-2">

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={inStockPage === 1}

                          onClick={() => {
                            loadingTarget.current = 'inStock';
                            setInStockPage((prev) => prev - 1);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                          Page {inStockPage} of {inStockTotalPages || 1}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            inStockPage === inStockTotalPages ||
                            inStockTotalPages === 0
                          }

                          onClick={() => {
                            loadingTarget.current = 'inStock';
                            setInStockPage((prev) => prev + 1);
                          }}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>

                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* ===================== 2. PERMANENT ITEMS (OUT OF STOCK) ===================== */}
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-red-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-red-700">
                        Permanent Items (Out Of Stock)
                      </CardTitle>

                      <CardDescription>
                        Out of stock permanent items requisitions
                      </CardDescription>
                    </div>

                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      {outStockTotalItems} Records
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="rounded-lg overflow-hidden border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-gray-50 border-gray-200">

                          <TableHead className="font-semibold w-[180px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2">
                              Purchase Requisition Order #

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold w-[150px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600">
                              Requisition Date

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">
                            Category Type
                          </TableHead>

                          <TableHead className="font-semibold">
                            Store
                          </TableHead>

                          <TableHead className="font-semibold text-right">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer justify-end hover:text-blue-600 w-full">
                              Total Items

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">
                            Status
                          </TableHead>

                          <TableHead className="font-semibold">
                            Created By
                          </TableHead>

                          <TableHead className="font-semibold text-center">
                            Actions
                          </TableHead>

                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {outStockLoading ? (
                          Array(outStockItemsPerPage).fill(0).map((_, i) => (
                            <TableRow key={i}>
                              {Array(8).fill(0).map((__, j) => (
                                <TableCell key={j}><div className="h-4 w-full bg-gray-200 animate-pulse rounded" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : outOfStockPurchaseRequisitions.length > 0 ? (
                          outOfStockPurchaseRequisitions.map((item) => (
                            <TableRow key={item.id} className="hover:bg-gray-50">

                              <TableCell className="font-medium py-3">
                                <p className="ps-2">{item.prNumber}</p>
                              </TableCell>

                              <TableCell>
                                {item.prDate
                                  ? format(new Date(item.prDate), "dd MMM yyyy")
                                  : "-"}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.categoryType}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.store?.name || "-"}
                              </TableCell>

                              <TableCell className="text-right">
                                {item.totalItems}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.statusValue === "APPROVED"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : item.statusValue === "NEW"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : item.statusValue === "REJECTED"
                                          ? "bg-red-100 text-red-800 border-red-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                  }
                                >
                                  {item.statusValue}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                {item.createdBy}
                              </TableCell>

                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">

                                  {/* View */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(item.id)}
                                          >
                                            <FileText className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View")
                                          ? "View Requisition"
                                          : "You do not have permission to view requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Edit */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(item.id)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Edit")
                                          ? "Edit Requisition"
                                          : "You do not have permission to edit requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* View Approvals */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(item.id)}
                                          >
                                            <FileCheck className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View Approvals")
                                          ? "View Approval Details"
                                          : "You do not have permission to view approvals"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Print */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(item.id)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Print")
                                          ? "Print Requisition"
                                          : "You do not have permission to print requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                </div>
                              </TableCell>

                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                              No out of stock requisitions found
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
                        value={outStockItemsPerPage.toString()}
                        onValueChange={(value) => {
                          loadingTarget.current = 'outStock';
                          setOutStockItemsPerPage(Number(value));
                          setOutStockPage(1);
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
                        Showing{" "}
                        {outOfStockPurchaseRequisitions.length === 0
                          ? 0
                          : (outStockPage - 1) * outStockItemsPerPage + 1}
                        {" "}to{" "}
                        {Math.min(
                          outStockPage * outStockItemsPerPage,
                          outOfStockPurchaseRequisitions.length
                        )}
                        {" "}of {outOfStockPurchaseRequisitions.length} entries
                      </p>

                      <div className="flex items-center space-x-2">

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={outStockPage === 1}
                          onClick={() => {
                            loadingTarget.current = 'outStock';
                            setOutStockPage((prev) => prev - 1);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                          Page {outStockPage} of {outStockTotalPages || 1}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            outStockPage === outStockTotalPages ||
                            outStockTotalPages === 0
                          }
                          onClick={() => {
                            loadingTarget.current = 'outStock';
                            setOutStockPage((prev) => prev + 1);
                          }}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>

                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* ===================== 3. TEMPORARY ITEMS REQUISIONS ===================== */}
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-yellow-700">
                        Temporary Items
                      </CardTitle>

                      <CardDescription>
                        Temporary items requisitions
                      </CardDescription>
                    </div>

                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                      {temporaryTotalItems} Records
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="rounded-lg overflow-hidden border shadow-sm">

                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-gray-50 border-gray-200">

                          <TableHead className="font-semibold w-[180px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2">
                              Purchase Requisition Order #

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold w-[150px]">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600">
                              Requisition Date

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">
                            Category Type
                          </TableHead>

                          <TableHead className="font-semibold">
                            Store
                          </TableHead>

                          <TableHead className="font-semibold text-right">
                            <button className="flex items-center gap-1 font-semibold cursor-pointer justify-end hover:text-blue-600 w-full">
                              Total Items

                            </button>
                          </TableHead>

                          <TableHead className="font-semibold">
                            Status
                          </TableHead>

                          <TableHead className="font-semibold">
                            Created By
                          </TableHead>

                          <TableHead className="font-semibold text-center">
                            Actions
                          </TableHead>

                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {temporaryLoading ? (
                          Array(temporaryItemsPerPage).fill(0).map((_, i) => (
                            <TableRow key={i}>
                              {Array(8).fill(0).map((__, j) => (
                                <TableCell key={j}><div className="h-4 w-full bg-gray-200 animate-pulse rounded" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : temporarySpareParts.length > 0 ? (
                          temporarySpareParts.map((item) => (
                            <TableRow key={item.id} className="hover:bg-gray-50">

                              <TableCell className="font-medium py-3">
                                <p className="ps-2">{item.prNumber}</p>
                              </TableCell>

                              <TableCell>
                                {item.prDate
                                  ? format(new Date(item.prDate), "dd MMM yyyy")
                                  : "-"}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.categoryType}
                              </TableCell>

                              <TableCell className="capitalize">
                                {item.store?.name || "-"}
                              </TableCell>

                              <TableCell className="text-right">
                                {item.totalItems}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.statusValue === "APPROVED"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : item.statusValue === "NEW"
                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                        : item.statusValue === "REJECTED"
                                          ? "bg-red-100 text-red-800 border-red-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                  }
                                >
                                  {item.statusValue}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                {item.createdBy}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">

                                  {/* View */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(item.id)}
                                          >
                                            <FileText className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View")
                                          ? "View Requisition"
                                          : "You do not have permission to view requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Edit */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(item.id)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Edit")
                                          ? "Edit Requisition"
                                          : "You do not have permission to edit requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* View Approvals */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(item.id)}
                                          >
                                            <FileCheck className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View Approvals")
                                          ? "View Approval Details"
                                          : "You do not have permission to view approvals"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Print */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(item.id)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Print")
                                          ? "Print Requisition"
                                          : "You do not have permission to print requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                </div>
                              </TableCell>

                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                              No temporary requisitions found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">

                    <div className="flex items-center gap-2">

                      <p className="text-sm text-muted-foreground">
                        Show
                      </p>

                      <Select
                        value={temporaryItemsPerPage.toString()}
                        onValueChange={(value) => {
                          loadingTarget.current = 'temporary';
                          setTemporaryItemsPerPage(Number(value));
                          setTemporaryPage(1);
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

                      <p className="text-sm text-muted-foreground">
                        entries
                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-sm text-muted-foreground hidden sm:block">

                        Showing{" "}

                        {temporarySpareParts.length === 0
                          ? 0
                          : (temporaryPage - 1) * temporaryItemsPerPage + 1}

                        {" "}to{" "}

                        {Math.min(
                          temporaryPage * temporaryItemsPerPage,
                          temporarySpareParts.length
                        )}

                        {" "}of {temporarySpareParts.length} entries

                      </p>

                      <div className="flex items-center space-x-2">

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={temporaryPage === 1}
                          onClick={() => {
                            loadingTarget.current = 'temporary';
                            setTemporaryPage((prev) => prev - 1);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                          Page {temporaryPage} of {temporaryTotalPages || 1}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            temporaryPage === temporaryTotalPages ||
                            temporaryTotalPages === 0
                          }
                          onClick={() => {
                            loadingTarget.current = 'temporary';
                            setTemporaryPage((prev) => prev + 1);
                          }}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>

                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* ===================== 4. CLOSED REQUISITIONS ===================== */}
             
            </div>

            )}

          


          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PurchaseRequisitions;
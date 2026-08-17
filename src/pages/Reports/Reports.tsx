import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  TooltipProvider
} from "@/components/ui/tooltip";
import { format } from 'date-fns';
import {
  CalendarIcon,
  ChartNoAxesCombined,
  Download,
  FileText,
  Printer,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { debounce } from 'lodash';
import { setPrintData, setReportConfigs } from '@/redux/features/PurchaseOrderReportPrintSlice';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/redux';
import { ICompany, ISalesInvoice, IStore } from '@/Utils/constants';
import { formatCurrency } from '@/Utils/formatters';
import { Badge } from '@/components/ui/badge';
import { loadModulePermissions } from '@/Utils/commonFun';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


// Type Definitions
interface Supplier {
  supplier_id: string;
  supplier_name: string;
  is_active: boolean;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  total_items: number;
  total_value: number;
  approval_status: any;
  supplier_name?: string;
  system_message_config?: {
    sub_category_id: string;
    id: string;
  };
}

// Sales Report Type Definitions
// type SalesStatus = 'Completed' | 'Pending' | 'Cancelled' | 'Processing' | 'Refunded';

// type SalesReportItem = {
//   id: string;
//   invoice_date: string | null;
//   invoice_number: string | null;
//   invoice_amount: number | null;
//   discount_amount: number | null;
//   tax_amount: number;
//   net_amount: number | null;
// };

type InventoryStockReport = {
  id: string;
  item_id: string;
  item_name: string;
  store_name: string;
  total_quantity: number;
  unit_price: number;
  total_count: number;
};

interface SalesReport {
  title: string;
  headers: readonly [
    'Date',
    'Invoice #',
    'Freight Charges',
    'Gross Amount',
    'Discount',
    'Tax Amount',
    'Net Amount',
  ];
  data: ISalesInvoice[];
}

interface StockReport {
  title: string;
  headers: readonly [
    'Item ID',
    'Item Name',
    'Store Name',
    'Item Quantity',
    'Unit Price',
    'Total Value',
  ];
  data: InventoryStockReport[];
}

// Purchase Order Report Type Definition
interface PurchaseOrderReport {
  title: string;
  headers: readonly [
    'PO Number',
    'Supplier',
    'Order Date',
    'Items',
    'Total Value',
    'Status'
  ];
  data: PurchaseOrder[];
}

// Combined Report Data Type
interface ReportData {
  'sales': SalesReport;
  'stock': StockReport;
  'purchase-order': PurchaseOrderReport;
}

// Type for report types
type ReportType = 'sales' | 'stock' | 'purchase-order';

type SortFieldSales = 'invoice_date' | 'invoice_number' | 'invoice_amount' | 'net_amount' | 'tax_amount' | 'discount_amount' | 'freight_charges';
type SortField = 'po_number' | 'supplier_name' | 'order_date' | 'total_items' | 'total_value' | 'order_status';
type SortFieldStock = 'item_id' | 'item_name' | 'store_name' | 'item_qty' | 'unit_price';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

interface SortConfigSales {
  field: SortFieldSales | null;
  direction: SortDirection;
}

interface SortConfigStock {
  field: SortFieldStock | null;
  direction: SortDirection;
}

interface Pagination {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface SalesPaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

// Summary Statistics Interface
interface SummaryStats {
  totalOrders: number;
  totalValue: number;
  pendingDelivery: number;
}

// Sales Summary Statistics Interface
interface SalesSummaryStats {
  totalSales: number;
  totalSalesValue: number;
}

// Sales Summary Statistics Interface
interface StockSummaryStats {
  totalStock: number;
  totalStockValue: number;
}

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | ''>('');
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [fullPurchaseOrders, setFullPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalOrders: 0,
    totalValue: 0,
    pendingDelivery: 0,
  });
  const [salesSummaryStats, setSalesSummaryStats] = useState<SalesSummaryStats>({
    totalSales: 0,
    totalSalesValue: 0,
  });
  const [stockSummaryStats, setStockSummaryStats] = useState<StockSummaryStats>({
    totalStock: 0,
    totalStockValue: 0,
  });
  const [statusMessages, setStatusMessages] = useState<{ [key: string]: string }>({});
  const [userData, setUserData] = useState<{
    user_id: string; company_id: string, company_data: ICompany 
} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [searchQuerySales, setSearchQuerySales] = useState('');
  const [currentPageSales, setCurrentPageSales] = useState(1);
  const [itemsPerPageSales, setItemsPerPageSales] = useState(10);
  const [salesPagination, setSalesPagination] = useState<SalesPaginationData>({
    currentPage: 1,
    totalPages: 0,
    total: 0,
    itemsPerPage: 10
  });
  const [searchQueryStock, setSearchQueryStock] = useState('');
  const [currentPageStock, setCurrentPageStock] = useState(1);
  const [itemsPerPageStock, setItemsPerPageStock] = useState(10);
  const [stockPagination, setStockPagination] = useState<SalesPaginationData>({
    currentPage: 1,
    totalPages: 0,
    total: 0,
    itemsPerPage: 10
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'order_date',
    direction: 'desc',
  });
  const [sortConfigSales, setSortConfigSales] = useState<SortConfigSales>({
    field: 'invoice_date',
    direction: 'desc',
  });
  const [sortConfigStock, setSortConfigStock] = useState<SortConfigStock>({
    field: null,
    direction: null,
  });
  const [allSales, setAllSales] = useState<ISalesInvoice[]>([])
  const [paginatedSales, setPaginatedSales] = useState<ISalesInvoice[]>([])
  const [paginatedStocks, setPaginatedStocks] = useState<InventoryStockReport[]>([])
  const [allStocks, setAllStocks] = useState<InventoryStockReport[]>([])
  const [allStores, setAllStores] = useState<IStore[]>([])
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';



  // Fetch report configurations for the company
  const fetchReportConfigs = useCallback(async () => {
    if (!userData?.company_id) return;

    try {
      console.log('Fetching report configs for company:', userData.company_id);

      let reportConfigData;
      const { data: companyFilteredData, error: reportConfigError } = await supabase
        .from('report_config')
        .select('*')
        .eq('company_id', userData.company_id)
        .order('report_category', { ascending: true });

      if (reportConfigError) {
        console.warn('Error loading company-filtered report configs:', reportConfigError);
        console.log('Falling back to loading all report configs...');

        // Fallback: Load all report configs if company filtering fails
        const { data: allReportConfigData, error: allReportConfigError } = await supabase
          .from('report_config')
          .select('*')
          .order('report_category', { ascending: true });

        if (allReportConfigError) {
          console.error('Error loading all report configs:', allReportConfigError);
          return;
        }

        reportConfigData = allReportConfigData;
      } else {
        reportConfigData = companyFilteredData;
      }

      if (reportConfigData && reportConfigData.length > 0) {
        // Process report configs by category and key
        const configs = {
          'purchase-order': {},
          'sales': {},
          'stock': {}
        };

        // Map the specific records by category and key
        const paymentDetailsConfig = reportConfigData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'PAYMENT_DETAILS'
        );
        const poRemarksConfig = reportConfigData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'REMARKS'
        );
        const poFooterConfig = reportConfigData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'FOOTER'
        );
        const salesRemarksConfig = reportConfigData.find(config =>
          config.report_category === 'SALES_REPORT' && config.report_config_key === 'REMARKS'
        );
        const salesFooterConfig = reportConfigData.find(config =>
          config.report_category === 'SALES_REPORT' && config.report_config_key === 'FOOTER'
        );
        const stockRemarksConfig = reportConfigData.find(config =>
          config.report_category === 'STOCK_REPORT' && config.report_config_key === 'REMARKS'
        );
        const stockFooterConfig = reportConfigData.find(config =>
          config.report_category === 'STOCK_REPORT' && config.report_config_key === 'FOOTER'
        );

        // Build configs object
        configs['purchase-order'] = {
          payment_details: paymentDetailsConfig?.report_config_value || '',
          remarks: poRemarksConfig?.report_config_value || '',
          report_footer: poFooterConfig?.report_config_value || ''
        };

        configs['sales'] = {
          remarks: salesRemarksConfig?.report_config_value || '',
          report_footer: salesFooterConfig?.report_config_value || ''
        };

        configs['stock'] = {
          remarks: stockRemarksConfig?.report_config_value || '',
          report_footer: stockFooterConfig?.report_config_value || ''
        };

        console.log('Processed report configs:', configs);

        // Store in Redux
        dispatch(setReportConfigs(configs));
      }
    } catch (error) {
      console.error('Error fetching report configs:', error);
    }
  }, [userData, dispatch]);

  const reportData: ReportData = {
    'sales': {
      title: 'Sales Report',
      headers: [
        'Date',
        'Invoice #',
        'Freight Charges',
        'Gross Amount',
        'Discount',
        'Tax Amount',
        'Net Amount',
      ] as const,
      data: allSales
    },
    'stock': {
      title: 'Stock Report',
      headers: [
        'Item ID',
        'Item Name',
        'Store Name',
        'Item Quantity',
        'Unit Price',
        'Total Value',
      ] as const,
      data: allStocks
    },
    'purchase-order': {
      title: 'Purchase Order Report',
      headers: [
        'PO Number',
        'Supplier',
        'Order Date',
        'Items',
        'Total Value',
        'Status'
      ] as const,
      data: fullPurchaseOrders
    }
  };

  // Type-safe helper function for getting report data
  const getReportData = <T extends ReportType>(reportType: T): ReportData[T] => {
    return reportData[reportType];
  };

  // Fetch summary statistics (totals without pagination)
  const fetchSummaryStats = useCallback(async () => {
    if (!userData?.company_id || selectedReportType !== 'purchase-order') return;

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const params: any = {
      p_company_id: userData.company_id,
      p_start_date: dateRange[0] ? formatDate(dateRange[0]) : null,
      p_end_date: dateRange[1] ? formatDate(dateRange[1]) : null,
      p_supplier_ids: selectedSuppliers.length > 0 ? selectedSuppliers : null,
      p_search_query: searchQuery.trim() ? searchQuery.trim() : null,
      p_sort_field: sortConfig.field || 'order_date',
      p_sort_direction: sortConfig.direction || 'desc',
      p_page: 1,
      p_limit: -1, // Get all records for summary stats
    };

    try {
      const { data, error }: any = await supabase.rpc('get_purchase_orders_for_report', params);

      if (error) {
        console.error('Error fetching summary stats:', error);
        return;
      }

      const allOrders = data?.data || [];
      const totalOrders = allOrders.length;
      const totalValue = allOrders.reduce((sum: number, po: PurchaseOrder) => sum + (po.total_value || 0), 0);
      const pendingDelivery = allOrders.filter(
        (po: PurchaseOrder) => po.system_message_config?.sub_category_id === 'ORDER_ISSUED'
      ).length;

      setSummaryStats({
        totalOrders,
        totalValue,
        pendingDelivery,
      });
    } catch (err) {
      console.error('Unexpected error fetching summary stats:', err);
    }
  }, [userData, dateRange, selectedSuppliers, searchQuery, sortConfig, selectedReportType]);

  // Debounced fetchData for paginated table
  const debouncedFetchData = useCallback(
    debounce(async (params: any) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const { data, error } = await supabase.rpc('get_purchase_orders_for_report', params);

        if (error) {
          console.error('Error calling RPC function:', error);
          setErrorMessage(`Failed to fetch purchase orders: ${error.message}`);
          setPurchaseOrders([]);
          setPagination({
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          });
          return;
        }

        setPurchaseOrders((data as any).data || []);
        setPagination({
          total: (data as any).total_count || 0,
          totalPages: (data as any).total_pages || 0,
          hasNextPage: (data as any).has_next_page || false,
          hasPrevPage: (data as any).has_prev_page || false,
        });

        // Fetch status messages
        const { data: statusData, error: statusError } = await supabase
          .from('system_message_config')
          .select('id, value')
          .eq('company_id', userData?.company_id!);

        if (statusError) {
          console.error('Error fetching status messages:', statusError);
        } else {
          const statusMap = statusData?.reduce((acc: any, item: any) => ({
            ...acc,
            [item.id]: item.value,
          }), {}) || {};
          setStatusMessages(statusMap);
        }
      } catch (err) {
        console.error('Unexpected error fetching data:', err);
        setErrorMessage('An unexpected error occurred while fetching data.');
        setPurchaseOrders([]);
        setPagination({
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        });
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [userData]
  );

  const handlePrintPreview = () => {
    // Make sure the latest data is in Redux before showing print preview
    const currentReportData = selectedReportType === 'purchase-order'
      ? { ...reportData, 'purchase-order': { ...reportData['purchase-order'], data: fullPurchaseOrders } }
      : selectedReportType === 'sales' ? { ...reportData, 'sales': { ...reportData['sales'], data: allSales } }
        : selectedReportType === 'stock' ? { ...reportData, 'stock': { ...reportData['stock'], data: allStocks } }
          : reportData;

    dispatch(setPrintData({
      reportData: currentReportData,
      selectedReportType: selectedReportType as ReportType,
      dateRange: dateRange,
      statusMessages: statusMessages
    }));

    // Navigate to the print preview page
    navigate('/dashboard/report/preview');
  };

  // Fetch full (unpaginated) purchase orders for PrintPreview
  const fetchFullPurchaseOrders = useCallback(async () => {
    if (!userData?.company_id || selectedReportType !== 'purchase-order') return;

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const params: any = {
      p_company_id: userData.company_id,
      p_start_date: dateRange[0] ? formatDate(dateRange[0]) : null,
      p_end_date: dateRange[1] ? formatDate(dateRange[1]) : null,
      p_supplier_ids: selectedSuppliers.length > 0 ? selectedSuppliers : null,
      p_search_query: searchQuery.trim() ? searchQuery.trim() : null,
      p_sort_field: sortConfig.field || 'order_date',
      p_sort_direction: sortConfig.direction || 'desc',
      p_page: 1,
      p_limit: -1, // Fetch all records
    };

    try {
      const { data, error }: any = await supabase.rpc('get_purchase_orders_for_report', params);

      if (error) {
        console.error('Error fetching full purchase orders:', error);
        setErrorMessage(`Failed to fetch purchase orders: ${error.message}`);
        setFullPurchaseOrders([]);
        return;
      }

      setFullPurchaseOrders(data?.data || []);
    } catch (err) {
      console.error('Unexpected error fetching full purchase orders:', err);
      setErrorMessage('An unexpected error occurred while fetching full purchase orders.');
      setFullPurchaseOrders([]);
    }
  }, [userData, dateRange, selectedSuppliers, searchQuery, sortConfig, selectedReportType]);

  // Fetch full sales in the given date range
  const fetchAllSales = useCallback(async () => {
    if (!userData?.company_id || selectedReportType !== 'sales') return;

    const formatToUTC: any = (dateString: Date) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-based
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    try {
      const fromDate = dateRange[0] ? formatToUTC(dateRange[0]) : null;
      const toDate = dateRange[1] ? formatToUTC(dateRange[1]) : null;

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('sales_invoice')
        .select('*')
        .eq('company_id', userData?.company_id)
        .gte('invoice_date', fromDate)
        .lte('invoice_date', toDate);

      if (invoiceError) {
        console.error('Error fetching all sales:', invoiceError);
        setErrorMessage(`Failed to fetch sales data: ${invoiceError.message}`);
        setAllSales([]);
        return;
      }
      const totalSales = invoiceData.length;
      const totalSalesValue = invoiceData.reduce((sum: number, invoice: ISalesInvoice) => sum + (invoice.net_amount || 0), 0)
      setSalesSummaryStats({ totalSales, totalSalesValue });

      setAllSales(invoiceData);
    } catch (err) {
      console.error('Unexpected error fetching sales:', err);
      setErrorMessage('An unexpected error occurred while fetching sales.');
      setAllSales([]);
    }
  }, [userData, dateRange, selectedReportType])

  // Fetch paginated sales data 
  const fetchAllPaginatedSales = useCallback(async (page?: number) => {
    if (!userData?.company_id || selectedReportType !== 'sales') return;

    const targetPage = page ?? currentPageSales;
    setIsLoading(true);
    setErrorMessage(null);

    const formatToUTC = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    try {
      const fromDate = dateRange[0] ? formatToUTC(dateRange[0]) : null;
      const toDate = dateRange[1] ? formatToUTC(dateRange[1]) : null;

      const from = (targetPage - 1) * itemsPerPageSales;
      const to = from + itemsPerPageSales - 1;

      let query = supabase
        .from('sales_invoice')
        .select('*', { count: 'exact' })
        .eq('company_id', userData.company_id);

      if (fromDate) query = query.gte('invoice_date', fromDate);
      if (toDate) query = query.lte('invoice_date', toDate);

      // Search filter
      if (searchQuerySales) {
        const sanitizedQuery = searchQuerySales.replace(/[%_]/g, '');
        const searchConditions = [
          `invoice_number.ilike.%${sanitizedQuery.trim()}%`,
        ];
        query = query.or(searchConditions.join(','));
      }

      // Sorting with deterministic tie-breaker
      const fieldMap: { [key in SortFieldSales]: string } = {
        invoice_date: 'invoice_date',
        invoice_number: 'invoice_number',
        invoice_amount: 'invoice_amount',
        net_amount: 'net_amount',
        tax_amount: 'tax_amount',
        discount_amount: 'discount_amount',
        freight_charges: 'freight_charges',
      };

      if (sortConfigSales.field && sortConfigSales.direction) {
        query = query
          .order(fieldMap[sortConfigSales.field], {
            ascending: sortConfigSales.direction === 'asc',
          })
          .order('id', { ascending: true });
      } else {
        query = query.order('id', { ascending: true });
      }

      // Pagination after stable sort
      query = query.range(from, to);

      const { data: invoiceData, error: invoiceError, count } = await query;

      if (invoiceError) {
        console.error('Error fetching paginated sales:', invoiceError);
        setErrorMessage(`Failed to fetch paginated sales data: ${invoiceError.message}`);
        setPaginatedSales([]);
        return;
      }
      setPaginatedSales(invoiceData);

      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / itemsPerPageSales);

      setSalesPagination({
        currentPage: targetPage,
        totalPages,
        total: totalItems,
        itemsPerPage: itemsPerPageSales,
      });
    } catch (err) {
      console.error('Unexpected error fetching paginated sales:', err);
      setErrorMessage('An unexpected error occurred while fetching paginated sales.');
      setPaginatedSales([]);
      setSalesPagination((prev) => ({
        ...prev,
        currentPage: targetPage,
        totalPages: 0,
        total: 0,
      }));
    } finally {
      setIsLoading(false)
    }
  }, [userData, dateRange, selectedReportType, currentPageSales, itemsPerPageSales, sortConfigSales, searchQuerySales]);

  // Sorting function for sales report
  const handleSortSales = (field: SortFieldSales) => {
    let direction: SortDirection = 'asc';

    if (sortConfigSales.field === field) {
      if (sortConfigSales.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfigSales.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }

    setSortConfigSales({ field: direction ? field : null, direction });
    setCurrentPageSales(1);
  };

  // Get icon function for sales report
  const getSortIconSales = (field: SortFieldSales) => {
    if (sortConfigSales.field !== field || !sortConfigSales.direction) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }

    return sortConfigSales.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    );
  };

  // Main fetchData function for paginated table
  const fetchData = useCallback(async () => {
    if (!userData?.company_id || selectedReportType !== 'purchase-order') return;

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const params: any = {
      p_company_id: userData.company_id,
      p_start_date: dateRange[0] ? formatDate(dateRange[0]) : null,
      p_end_date: dateRange[1] ? formatDate(dateRange[1]) : null,
      p_supplier_ids: selectedSuppliers.length > 0 ? selectedSuppliers : null,
      p_search_query: searchQuery.trim() ? searchQuery.trim() : null,
      p_sort_field: sortConfig.field || 'order_date',
      p_sort_direction: sortConfig.direction || 'desc',
      p_page: currentPage,
      p_limit: itemsPerPage === -1 ? -1 : itemsPerPage,
    };

    debouncedFetchData(params);
  }, [userData, dateRange, selectedSuppliers, searchQuery, sortConfig, currentPage, itemsPerPage, selectedReportType, debouncedFetchData]);

  // Function to format to UTC string
  function formatAsUTCString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  // Function to get formatted date range
  function getFormattedDateRange(dateRange: (Date | null)[]) {
    if (!dateRange[0] || !dateRange[1]) return null;

    const from = formatAsUTCString(dateRange[0]);

    const to = new Date(dateRange[1]);
    to.setDate(to.getDate() + 1);
    const toFormatted = formatAsUTCString(to);

    return {
      fromFormatted: from,
      toFormatted: toFormatted,
    };
  }

  // Fetch paginated inventory stock report
  const fetchPaginatedStock = useCallback(async (page?: number) => {
    if (!userData?.company_id || selectedReportType !== 'stock') return;

    const targetPage = page ?? currentPageStock;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let fromDate: string | null = null;
      let toDate: string | null = null;

      if (dateRange[0] && dateRange[1]) {
        const formatResult = getFormattedDateRange([dateRange[0], dateRange[1]]);
        fromDate = formatResult?.fromFormatted ?? null;
        toDate = formatResult?.toFormatted ?? null;
      }

      const { data, error } = await supabase.rpc("get_inventory_items_for_reports", {
        search_term: searchQueryStock.trim() ? searchQueryStock.trim() : undefined,
        sort_field: sortConfigStock.field || "item_name",
        sort_direction: sortConfigStock.direction || "asc",
        page_size: itemsPerPageStock,
        page_number: targetPage,
        company_id: userData.company_id,
        selected_stores: selectedStores?.length ? selectedStores : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      }
      );

      if (error) {
        console.error("Error fetching paginated stock:", error);
        setErrorMessage(`Failed to fetch stock data: ${error.message}`);
        setPaginatedStocks([]);
        setStockPagination((prev) => ({
          ...prev,
          currentPage: targetPage,
          totalPages: 0,
          total: 0,
        }));
        return;
      }

      if (data) {
        // console.log("Stock Data => ", data);
        setPaginatedStocks(data);

        const totalItems = data[0]?.total_count ?? 0;
        const totalPages = Math.ceil(totalItems / itemsPerPageStock);

        setStockPagination({
          currentPage: targetPage,
          totalPages,
          total: totalItems,
          itemsPerPage: itemsPerPageStock,
        });
      }
    } catch (err) {
      console.error("Unexpected error fetching stock:", err);
      setErrorMessage("An unexpected error occurred while fetching stock.");
      setPaginatedStocks([]);
      setStockPagination((prev) => ({
        ...prev,
        currentPage: targetPage,
        totalPages: 0,
        total: 0,
      }));
    } finally {
      setIsLoading(false);
    }
  }, [userData, dateRange, selectedReportType, selectedStores, searchQueryStock, currentPageStock, itemsPerPageStock, sortConfigStock]);

  // Fetch paginated inventory stock report
  const fetchAllInventoryStock = useCallback(async () => {
    if (!userData?.company_id || selectedReportType !== 'stock') return;

    try {
      let fromDate: string | null = null;
      let toDate: string | null = null;

      if (dateRange[0] && dateRange[1]) {
        const formatResult = getFormattedDateRange([dateRange[0], dateRange[1]]);
        fromDate = formatResult?.fromFormatted ?? null;
        toDate = formatResult?.toFormatted ?? null;
      }

      const { data, error } = await supabase.rpc("get_inventory_items_for_reports", {
        search_term: undefined,
        sort_field: "item_name",
        sort_direction: "asc",
        page_size: undefined,
        page_number: 1,
        company_id: userData.company_id,
        selected_stores: selectedStores?.length ? selectedStores : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      }
      );

      if (error) {
        console.error("Error fetching paginated stock:", error);
        setErrorMessage(`Failed to fetch stock data: ${error.message}`);
        setAllStocks([]);
        return;
      }

      if (data) {
        // console.log("All Stock Data => ", data);
        setAllStocks(data);
        const totalStock = data.reduce((sum: number, stock: InventoryStockReport) => sum + (stock.total_quantity || 0), 0);
        const totalStockValue = data.reduce((sum: number, stock: InventoryStockReport) => sum + ((stock.total_quantity * stock.unit_price) || 0), 0);
        setStockSummaryStats({ totalStock, totalStockValue });
      }
    } catch (err) {
      console.error("Unexpected error fetching stock:", err);
      setErrorMessage("An unexpected error occurred while fetching stock.");
      setAllStocks([]);
    }
  }, [userData, dateRange, selectedStores, searchQueryStock, sortConfigStock, currentPageStock, itemsPerPageStock, selectedReportType])

  // Sorting function for sales report
  const handleSortStock = (field: SortFieldStock) => {
    let direction: SortDirection = 'asc';

    if (sortConfigStock.field === field) {
      if (sortConfigStock.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfigStock.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }

    setSortConfigStock({ field: direction ? field : null, direction });
    setCurrentPageStock(1);
  };

  // Get icon function for sales report
  const getSortIconStock = (field: SortFieldStock) => {
    if (sortConfigStock.field !== field || !sortConfigStock.direction) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }

    return sortConfigStock.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    );
  };

  // Modified handleGenerateReport to fetch paginated data, full data, and summary stats
  const handleGenerateReport = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (selectedReportType === 'purchase-order') {
      await Promise.all([fetchData(), fetchFullPurchaseOrders(), fetchSummaryStats()]);
      setIsReportGenerated(true);
    } else if (selectedReportType === 'sales') {
      await Promise.all([fetchAllPaginatedSales(), fetchAllSales()]);
      setIsReportGenerated(true);
    } else if (selectedReportType === 'stock') {
      await Promise.all([fetchPaginatedStock(), fetchAllInventoryStock()]);
      setIsReportGenerated(true);
    } else {
      setIsReportGenerated(true);
      setIsLoading(false);
    }
  };

  // Type-safe export to CSV function
  const exportToCSV = useCallback(async () => {
    if (!selectedReportType || !isReportGenerated) return;

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let csvContent = '';
    let filename = '';

    if (selectedReportType === 'purchase-order') {
      const params: any = {
        p_company_id: userData?.company_id,
        p_start_date: dateRange[0] ? formatDate(dateRange[0]) : null,
        p_end_date: dateRange[1] ? formatDate(dateRange[1]) : null,
        p_supplier_ids: selectedSuppliers.length > 0 ? selectedSuppliers : null,
        p_search_query: searchQuery.trim() ? searchQuery.trim() : null,
        p_sort_field: sortConfig.field || 'order_date',
        p_sort_direction: sortConfig.direction || 'desc',
        p_page: 1,
        p_limit: -1,
      };

      try {
        const { data, error }: any = await supabase.rpc('get_purchase_orders_for_report', params);

        if (error) {
          console.error('Error fetching data for CSV:', error);
          setErrorMessage(`Failed to fetch data for CSV: ${error.message}`);
          return;
        }

        const headers = ['PO Number', 'Supplier', 'Order Date', 'Items', 'Total Value', 'Status'];
        const rows = (data?.data || []).map((item: PurchaseOrder) => [
          `"${item.po_number}"`,
          `"${item.supplier_name || ''}"`,
          `"${format(new Date(item.order_date), 'dd MMM yyyy')}"`,
          item.total_items,
          `"${formatCurrency(item.total_value)}"`,
          `"${statusMessages[item.system_message_config?.sub_category_id || 'Unknown'] || item.system_message_config?.sub_category_id?.replace(/_/g, ' ') || 'Unknown'}"`,
        ]);

        csvContent = [
          headers.join(','),
          ...rows.map((row: any) => row.join(','))
        ].join('\n');

        filename = `Purchase_Order_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      } catch (err) {
        console.error('Unexpected error exporting CSV:', err);
        setErrorMessage('An unexpected error occurred while exporting CSV.');
        return;
      }
    } else {
      // Handle other report types with proper typing
      const report = getReportData(selectedReportType);

      const headers = report.headers;
      const rows = report.data.map((item) => {
        if (selectedReportType === 'sales') {
          const salesItem = item as ISalesInvoice;
          return [
            `"${salesItem.invoice_number}"`,
            `"${format(new Date(salesItem.invoice_date!), 'dd MMM yyyy')}"`,
            `"${formatCurrency((salesItem as any)?.freight_charges ?? 0)}"`,
            `"${formatCurrency(salesItem.invoice_amount ?? 0)}"`,
            `"${formatCurrency(salesItem.discount_amount ?? 0)}"`,
            `"${formatCurrency(salesItem.tax_amount ?? 0)}"`,
            `"${formatCurrency(salesItem.net_amount ?? 0)}"`,
          ];
        } else if (selectedReportType === 'stock') {
          const stockItem = item as unknown as InventoryStockReport;
          return [
            `"${stockItem.item_id}"`,
            `"${stockItem.item_name}"`,
            `"${stockItem.store_name}"`,
            `"${stockItem.total_quantity}"`,
            `"${stockItem.unit_price}"`,
            `"${(stockItem.total_quantity * stockItem.unit_price)}"`,
          ];
        }
        return [];
      });

      csvContent = [
        headers.join(','),
        ...rows.map((row: any) => row.join(','))
      ].join('\n');

      filename = `${report.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    }

    // Create CSV with proper UTF-8 BOM encoding
    const BOM = '\uFEFF'; // UTF-8 BOM
    const csvWithBOM = BOM + csvContent;

    // Trigger CSV download with proper encoding
    const blob = new Blob([csvWithBOM], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [selectedReportType, isReportGenerated, userData, dateRange, selectedSuppliers, searchQuery, sortConfig, statusMessages]);

  // Fetch user data
  useEffect(() => {
    const mockUserData = JSON.parse(localStorage.getItem('userData') || '{}');
    setUserData(mockUserData);
  }, []);

  // Fetch report configs when userData is available
  useEffect(() => {
    if (userData?.company_id) {
      fetchReportConfigs();
    }
  }, [userData, fetchReportConfigs]);

  // Fetch suppliers when userData is available
  useEffect(() => {
    if (!userData?.company_id) return;

    const fetchSuppliers = async () => {
      try {
        const { data, error }: any = await supabase
          .from('supplier_mgmt')
          .select('supplier_id, supplier_name, is_active')
          .eq('is_active', true)
          .eq('company_id', userData.company_id);

        if (error) {
          console.error('Error fetching suppliers:', error);
          setErrorMessage('Failed to fetch suppliers. Please try again.');
          return;
        }
        setSuppliers(data || []);
      } catch (err) {
        console.error('Unexpected error fetching suppliers:', err);
        setErrorMessage('An unexpected error occurred while fetching suppliers.');
      }
    };

    fetchSuppliers();
  }, [userData]);

  // Fetch stores data when userData is available
  useEffect(() => {
    if (!userData?.company_id) return;

    const fetchStores = async () => {
      try {
        const { data, error }: any = await supabase
          .from('store_mgmt')
          .select('id, name, is_active')
          .eq('is_active', true)
          .eq('company_id', userData.company_id);

        if (error) {
          console.error('Error fetching suppliers:', error);
          setErrorMessage('Failed to fetch suppliers. Please try again.');
          return;
        }
        setAllStores(data || []);
      } catch (err) {
        console.error('Unexpected error fetching suppliers:', err);
        setErrorMessage('An unexpected error occurred while fetching suppliers.');
      }
    };

    fetchStores();
  }, [userData]);

  // Fetch data when relevant state changes
  useEffect(() => {
    if (isReportGenerated && selectedReportType === 'purchase-order') {
      fetchData();
      fetchFullPurchaseOrders();
      fetchSummaryStats();
    }
  }, [fetchData, fetchFullPurchaseOrders, fetchSummaryStats, isReportGenerated, selectedReportType]);

  useEffect(() => {
    if (isReportGenerated && selectedReportType === 'sales') {
      fetchAllPaginatedSales();
      fetchAllSales();
    }
  }, [fetchAllPaginatedSales, fetchAllSales, isReportGenerated, selectedReportType, sortConfigSales, searchQuerySales]);

  useEffect(() => {
    if (isReportGenerated && selectedReportType === 'stock') {
      fetchPaginatedStock();
      fetchAllInventoryStock();
    }
  }, [fetchPaginatedStock, fetchAllInventoryStock, isReportGenerated, selectedReportType, searchQueryStock, sortConfigStock]);

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
    if (sortConfig.field !== field || !sortConfig.direction) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }

    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600" />
    );
  };

  const handleDateRangeChange = (range: [Date | null, Date | null]) => {
    setDateRange(range);
    setIsReportGenerated(false);
    setCurrentPage(1);
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]
    );
    setIsReportGenerated(false);
    setCurrentPage(1);
  };

  const handleStoreChange = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
    setIsReportGenerated(false);
    setCurrentPageStock(1);
  };

  const handleSelectAllSuppliers = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(suppliers.map((s) => s.supplier_id));
    } else {
      setSelectedSuppliers([]);
    }
    setIsReportGenerated(false);
    setCurrentPage(1);
  };

  const handleSelectAllStores = (checked: boolean) => {
    if (checked) {
      setSelectedStores(allStores.map((s) => s.id));
    } else {
      setSelectedStores([]);
    }
    setIsReportGenerated(false);
    setCurrentPageStock(1);
  };

  const handleReportTypeChange = (value: string) => {
    // Validate the value is a valid report type
    const validReportTypes: ReportType[] = ['sales', 'stock', 'purchase-order'];

    if (validReportTypes.includes(value as ReportType)) {
      setSelectedReportType(value as ReportType);
    } else {
      setSelectedReportType('');
    }

    setIsReportGenerated(false);
    setPurchaseOrders([]);
    setFullPurchaseOrders([]);
    setSummaryStats({ totalOrders: 0, totalValue: 0, pendingDelivery: 0 });
    setErrorMessage(null);
    setCurrentPage(1);
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setCurrentPage(1);
    setSearchQuerySales('');
    setCurrentPageSales(1);
    setSearchQueryStock('');
    setCurrentPageStock(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const STATUS_STYLES = {
    ORDER_CREATED: 'bg-gray-100 text-gray-800 border-gray-300',
    APPROVER_COMPLETED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    ORDER_RECEIVED: 'bg-green-100 text-green-800 border-green-300',
    APPROVAL_PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ORDER_CANCELLED: 'bg-red-100 text-red-800 border-red-300',
    ORDER_PARTIALLY_RECEIVED: 'bg-lime-100 text-lime-800 border-lime-300',
    ORDER_ISSUED: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const getStatusBadge = (status: string, type: ReportType | string) => {
    const statusValue = status || 'Unknown';

    if (type === 'purchase-order') {
      switch (statusValue) {
        case 'ORDER_CREATED':
          return STATUS_STYLES.ORDER_CREATED;
        case 'APPROVER_COMPLETED':
          return STATUS_STYLES.APPROVER_COMPLETED;
        case 'ORDER_RECEIVED':
          return STATUS_STYLES.ORDER_RECEIVED;
        case 'APPROVAL_PENDING':
          return STATUS_STYLES.APPROVAL_PENDING;
        case 'ORDER_CANCELLED':
          return STATUS_STYLES.ORDER_CANCELLED;
        case 'ORDER_PARTIALLY_RECEIVED':
          return STATUS_STYLES.ORDER_PARTIALLY_RECEIVED;
        case 'ORDER_ISSUED':
          return STATUS_STYLES.ORDER_ISSUED;
        default:
          return STATUS_STYLES.ORDER_CREATED;
      }
    } else {
      return null;
    }
  };

  const isFormValid = dateRange[0] && dateRange[1] && selectedReportType && (selectedReportType === "purchase-order" ? selectedSuppliers.length > 0 : true) && (selectedReportType === 'stock' ? selectedStores.length > 0 : true);
  const isAllSuppliersSelected = selectedSuppliers.length === suppliers.length && suppliers.length > 0;
  const isAllStoresSelected = selectedStores.length === allStores.length && allStores.length > 0;
  const isIndeterminate = selectedSuppliers.length > 0 && selectedSuppliers.length < suppliers.length;
  const isStoreIndeterminate = selectedStores.length > 0 && selectedStores.length < allStores.length;


  useEffect(() => {
    const permissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(
          appCode, 'Reports', userData.user_id
        );
        if (res && res.permissions) {
          setModulePermissions(res.permissions)
        }

      }
    }
    permissions()
  }, [userData?.user_id])

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) =>
      p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase()
    );
    return perm ? perm.isAllowed : false;

  };
  return (
    <TooltipProvider>
      <div className="reports-page-container p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="min-h-[85vh] shadow-sm">
            <CardHeader className="rounded-t-lg border-b pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                    <ChartNoAxesCombined className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">Reports</CardTitle>
                    <CardDescription className="mt-1">Generate and analyze inventory reports</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {errorMessage && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
                  {errorMessage}
                </div>
              )}

              <Card className="mb-6 border border-blue-100 bg-blue-50 bg-opacity-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                      <FileText className="mr-2 h-5 w-5 text-blue-600" />
                      Configure Report
                    </h3>
                    <p className="text-gray-600 text-sm">Select parameters to generate your custom report</p>
                  </div>

                  <div className={`grid gap-4 items-end ${selectedReportType === 'purchase-order' || selectedReportType === 'stock' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Date Range <span className="text-red-500">*</span>
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!dateRange[0] ? 'text-gray-400' : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange[0] ? (
                              dateRange[1] ? (
                                <>
                                  {format(dateRange[0], 'dd MMM')} - {format(dateRange[1], 'dd MMM, yyyy')}
                                </>
                              ) : (
                                format(dateRange[0], 'dd MMM, yyyy')
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={{
                              from: dateRange[0] || undefined,
                              to: dateRange[1] || undefined,
                            }}
                            onSelect={(range) => {
                              handleDateRangeChange([range?.from || null, range?.to || null]);
                            }}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                   <div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Report Type <span className="text-red-500">*</span>
  </label>

  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Select
          value={selectedReportType}
          onValueChange={handleReportTypeChange}
        >
          <SelectTrigger className="w-full bg-white border-gray-300" disabled={!hasPermission('Purchase Order Report') &&
      !hasPermission('Sales Report') &&
      !hasPermission('Stock Report')}>
            <SelectValue placeholder="Select report type" />
          </SelectTrigger>

          <SelectContent>
            {hasPermission('Purchase Order Report') &&  <SelectItem
              value="purchase-order"
            >
              Purchase Order Report
            </SelectItem>}
           
{hasPermission('Sales Report') && <SelectItem
              value="sales"
              
            >
              Sales Report
            </SelectItem> }
            {hasPermission('Stock Report') && <SelectItem
              value="stock"
             
            >
              Stock Report
            </SelectItem>}

            
          </SelectContent>
        </Select>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      {!hasPermission('Purchase Order Report') &&
      !hasPermission('Sales Report') &&
      !hasPermission('Stock Report')
        ? 'You do not have permission to access reports'
        : 'Select report type'}
    </TooltipContent>

  </Tooltip>
</div>

                    {selectedReportType === 'purchase-order' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Supplier <span className="text-red-500">*</span></label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <Users className="mr-2 h-4 w-4" />
                              {selectedSuppliers.length === 0 ? (
                                <span className="text-gray-400">Select suppliers</span>
                              ) : selectedSuppliers.length === suppliers.length ? (
                                'All suppliers selected'
                              ) : selectedSuppliers.length === 1 ? (
                                suppliers.find((s) => s.supplier_id === selectedSuppliers[0])?.supplier_name
                              ) : (
                                `${selectedSuppliers.length} suppliers selected`
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                                <Checkbox
                                  id="select-all"
                                  checked={isAllSuppliersSelected}
                                  onCheckedChange={handleSelectAllSuppliers}
                                  className={isIndeterminate ? 'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600' : ''}
                                />
                                <label
                                  htmlFor="select-all"
                                  className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-blue-700"
                                >
                                  Select All
                                </label>
                              </div>
                              {suppliers.map((supplier) => (
                                <div key={supplier.supplier_id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={supplier.supplier_id}
                                    checked={selectedSuppliers.includes(supplier.supplier_id)}
                                    onCheckedChange={() => handleSupplierChange(supplier.supplier_id)}
                                  />
                                  <label
                                    htmlFor={supplier.supplier_id}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {supplier.supplier_name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {selectedReportType === 'stock' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Store <span className="text-red-500">*</span></label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <Users className="mr-2 h-4 w-4" />
                              {selectedStores.length === 0 ? (
                                <span className="text-gray-400">Select stores</span>
                              ) : selectedStores.length === allStores.length ? (
                                'All stores selected'
                              ) : selectedStores.length === 1 ? (
                                allStores.find((s) => s.id === selectedStores[0])?.name
                              ) : (
                                `${selectedStores.length} stores selected`
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                                <Checkbox
                                  id="select-all"
                                  checked={isAllStoresSelected}
                                  onCheckedChange={handleSelectAllStores}
                                  className={isStoreIndeterminate ? 'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600' : ''}
                                />
                                <label
                                  htmlFor="select-all"
                                  className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-blue-700"
                                >
                                  Select All
                                </label>
                              </div>
                              {allStores.map((store) => (
                                <div key={store.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={store.id}
                                    checked={selectedStores.includes(store.id)}
                                    onCheckedChange={() => handleStoreChange(store.id)}
                                  />
                                  <label
                                    htmlFor={store.id}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {store.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      onClick={handleGenerateReport}
                      disabled={!isFormValid || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Generating...
                        </>
                      ) : (
                        'Generate Report'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {isReportGenerated && selectedReportType && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        {selectedReportType === 'purchase-order' && <ShoppingCart className="h-6 w-6 text-blue-600" />}
                        {selectedReportType === 'sales' && <TrendingUp className="h-6 w-6 text-green-600" />}
                        {selectedReportType === 'stock' && <Package className="h-6 w-6 text-purple-600" />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">
                          {reportData[selectedReportType as keyof typeof reportData]?.title}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {dateRange[0] && dateRange[1] ? (
                            `${format(dateRange[0], 'MMM dd, yyyy')} - ${format(dateRange[1], 'MMM dd, yyyy')}`
                          ) : (
                            'All time'
                          )}
                          {selectedSuppliers.length > 0 &&
                            ` • ${selectedSuppliers.length === suppliers.length ? 'All' : selectedSuppliers.length} supplier${selectedSuppliers.length > 1 ? 's' : ''} selected`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handlePrintPreview}
                        className="flex items-center space-x-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Preview</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={exportToCSV}
                        className="flex items-center space-x-1 text-green-600 border-green-200 hover:bg-green-50"
                        disabled={isLoading || !isReportGenerated}
                      >
                        <Download className="h-4 w-4" />
                        <span>Export CSV</span>
                      </Button>
                    </div>
                  </div>

                  {selectedReportType === 'purchase-order' && (
                    <div className="mb-6 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search by PO number or supplier..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={handleFilterReset}
                            className="px-3 py-2 text-sm"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedReportType === 'sales' && (
                    <div className="mb-6 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search by invoice number..."
                            value={searchQuerySales}
                            onChange={(e) => {
                              setSearchQuerySales(e.target.value);
                              setCurrentPageSales(1);
                            }}
                            className="pl-10"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={handleFilterReset}
                            className="px-3 py-2 text-sm"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedReportType === 'stock' && (
                    <div className="mb-6 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search by Item ID or Item Name..."
                            value={searchQueryStock}
                            onChange={(e) => {
                              setSearchQueryStock(e.target.value);
                              setCurrentPageStock(1);
                            }}
                            className="pl-10"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={handleFilterReset}
                            className="px-3 py-2 text-sm"
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg overflow-hidden border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-gray-50 border-gray-200">
                          {selectedReportType === 'purchase-order' ? (
                            <>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSort('po_number')}
                                >
                                  PO Number
                                  {getSortIcon('po_number')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSort('supplier_name')}
                                >
                                  Supplier
                                  {getSortIcon('supplier_name')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSort('order_date')}
                                >
                                  Order Date
                                  {getSortIcon('order_date')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSort('total_items')}
                                >
                                  Items
                                  {getSortIcon('total_items')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSort('total_value')}
                                >
                                  Total Value
                                  {getSortIcon('total_value')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">Status</TableHead>
                            </>
                          ) : selectedReportType === 'stock' ? (
                            <>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortStock('item_id')}
                                >
                                  Item ID
                                  {getSortIconStock('item_id')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortStock('item_name')}
                                >
                                  Item Name
                                  {getSortIconStock('item_name')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortStock('store_name')}
                                >
                                  Store Name
                                  {getSortIconStock('store_name')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortStock('item_qty')}
                                >
                                  Item Quantity
                                  {getSortIconStock('item_qty')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortStock('unit_price')}
                                >
                                  Unit Price
                                  {getSortIconStock('unit_price')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold text-end"><p className='pe-2'>Total Value</p></TableHead>
                            </>
                          ) : selectedReportType === 'sales' ? (
                            <>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortSales('invoice_date')}
                                >
                                  Date
                                  {getSortIconSales('invoice_date')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortSales('invoice_number')}
                                >
                                  Invoice #
                                  {getSortIconSales('invoice_number')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 ps-2"
                                  onClick={() => handleSortSales('freight_charges')}
                                >
                                  Freight Charges
                                  {getSortIconSales('freight_charges')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600 text-end"
                                  onClick={() => handleSortSales('invoice_amount')}
                                >
                                  Gross Amount
                                  {getSortIconSales('invoice_amount')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600 text-end"
                                  onClick={() => handleSortSales('discount_amount')}
                                >
                                  Total Discount
                                  {getSortIconSales('discount_amount')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600 text-end"
                                  onClick={() => handleSortSales('tax_amount')}
                                >
                                  Tax Amount
                                  {getSortIconSales('tax_amount')}
                                </p>
                              </TableHead>
                              <TableHead className="font-semibold">
                                <p
                                  className="flex items-center justify-end gap-1 font-semibold cursor-pointer hover:text-blue-600"
                                  onClick={() => handleSortSales('net_amount')}
                                >
                                  Net Amount
                                  {getSortIconSales('net_amount')}
                                </p>
                              </TableHead>
                            </>
                          ) : (
                            reportData[selectedReportType as keyof typeof reportData]?.headers?.map((header: string) => (
                              <TableHead key={header} className="font-semibold text-gray-800 px-4 py-3 text-left">
                                <div className="flex items-center gap-1">
                                  {header}
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-gray-400"
                                  >
                                    <path d="m7 15 5 5 5-5"></path>
                                    <path d="m7 9 5-5 5 5"></path>
                                  </svg>
                                </div>
                              </TableHead>
                            ))
                          )}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {selectedReportType === 'purchase-order' && (
                          isLoading ? (
                            Array(itemsPerPage).fill(0).map((_, index) => (
                              <TableRow key={index} className="hover:bg-gray-50">
                                <TableCell className="py-3">
                                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                                </TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                              </TableRow>
                            ))
                          ) : purchaseOrders.length > 0 ? (
                            purchaseOrders.map((item, index) => (
                              <TableRow
                                key={item.id}
                                className={`hover:bg-blue-50 transition-colors duration-150 border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                  }`}
                              >
                                <TableCell className="font-medium text-gray-900 py-3">{item.po_number}</TableCell>
                                <TableCell className="text-gray-700 py-3">{item.supplier_name}</TableCell>
                                <TableCell className="text-gray-700 py-3">{format(new Date(item.order_date), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="text-gray-700 py-3 text-end px-4">{item.total_items}</TableCell>
                                <TableCell className="font-medium text-gray-900 py-3 text-end px-4">{formatCurrency(item.total_value)}</TableCell>
                                <TableCell>
                                  <Badge

                                    variant="outline"
                                    className={`font-medium ${getStatusBadge(

                                      item.system_message_config?.sub_category_id || "unknown",
                                      "purchase-order"
                                    )}`}
                                  >
                                    {item.system_message_config?.sub_category_id
                                      .replace(/_/g, ' ')
                                      .toLowerCase()
                                      .replace(/\b\w/g, c => c.toUpperCase())}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                <div className="flex flex-col items-center justify-center">
                                  <p className="text-base font-medium">No purchase orders found</p>
                                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                        {selectedReportType === 'sales' && (
                          isLoading ? (
                            Array(itemsPerPageSales).fill(0).map((_, index) => (
                              <TableRow key={index} className="hover:bg-gray-50">
                                <TableCell className="py-3">
                                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                                </TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                              </TableRow>
                            ))
                          ) : paginatedSales.length > 0 ? (
                            paginatedSales.map((item, index) => (
                              <TableRow
                                key={item.id}
                                className={`hover:bg-blue-50 transition-colors duration-150 border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                              >
                                <TableCell className="text-gray-700 px-4 py-3">{format(new Date(item.invoice_date!), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 font-medium">{item.invoice_number}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">{formatCurrency((item as any)?.freight_charges ?? 0)}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">{formatCurrency(item?.invoice_amount ?? 0)}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">
                                  {formatCurrency((item?.discount_amount ?? 0) + (item?.total_discount_amount ?? 0))}
                                </TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">{formatCurrency(item?.tax_amount ?? 0)}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end font-medium">{formatCurrency(item?.net_amount ?? 0)}</TableCell>
                              </TableRow>
                            ))) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                <div className="flex flex-col items-center justify-center">
                                  <p className="text-base font-medium">No sales invoices found</p>
                                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        {selectedReportType === 'stock' && (
                          isLoading ? (
                            Array(itemsPerPageStock).fill(0).map((_, index) => (
                              <TableRow key={index} className="hover:bg-gray-50">
                                <TableCell className="py-3">
                                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                                </TableCell>
                                <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                              </TableRow>
                            ))
                          ) : paginatedStocks.length > 0 ? (
                            paginatedStocks.map((stock, index) => (
                              <TableRow
                                key={stock.id}
                                className={`hover:bg-blue-50 transition-colors duration-150 border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                              >
                                <TableCell className="text-gray-700 px-4 py-3">{stock.item_id}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 font-medium">{stock.item_name}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3">{stock.store_name}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">{stock.total_quantity}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end">{formatCurrency(stock.unit_price ?? 0)}</TableCell>
                                <TableCell className="text-gray-700 px-4 py-3 text-end font-medium">{formatCurrency(((stock.total_quantity ?? 0) * (stock.unit_price ?? 0)))}</TableCell>
                              </TableRow>
                            ))) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                <div className="flex flex-col items-center justify-center">
                                  <p className="text-base font-medium">No inventory stocks found</p>
                                  <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  {selectedReportType === 'purchase-order' && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Show</p>
                        <Select
                          value={itemsPerPage.toString()}
                          onValueChange={(value) => {
                            setItemsPerPage(Number(value));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder={itemsPerPage.toString()} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="-1">All</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">entries</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground hidden sm:block">
                          Showing {pagination.total > 0 ? ((currentPage - 1) * (itemsPerPage === -1 ? pagination.total : itemsPerPage) + 1) : 0} to {Math.min(currentPage * (itemsPerPage === -1 ? pagination.total : itemsPerPage), pagination.total)} of {pagination.total} entries
                        </p>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentPage((prev) => Math.max(prev - 1, 1));
                            }}
                            disabled={!pagination.hasPrevPage || isLoading}
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
                            onClick={() => {
                              setCurrentPage((prev) => prev + 1);
                            }}
                            disabled={!pagination.hasNextPage || isLoading}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedReportType === 'purchase-order' && (
                    <div className="grid gap-4 md:grid-cols-2 mt-6">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-700">Total Orders</p>
                              <h4 className="text-2xl font-bold text-blue-900 mt-1">{summaryStats.totalOrders}</h4>
                              <p className="text-xs text-blue-600 mt-1">In selected period</p>
                            </div>
                            <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                              <ShoppingCart className="h-6 w-6 text-blue-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-700">Total Value</p>
                              <h4 className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(summaryStats.totalValue)}</h4>
                              <p className="text-xs text-green-600 mt-1">In selected period</p>
                            </div>
                            <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                              <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {isReportGenerated && selectedReportType === 'sales' && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Show
                    </p>
                    <Select
                      value={itemsPerPageSales.toString()}
                      onValueChange={(value) => {
                        setItemsPerPageSales(Number(value));
                        setCurrentPageSales(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={itemsPerPageSales.toString()} />
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
                      Showing {salesPagination.total > 0 ? ((currentPageSales - 1) * itemsPerPageSales) + 1 : 0} to {Math.min(currentPageSales * itemsPerPageSales, salesPagination.total)} of {salesPagination.total} entries
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageSales(prev => Math.max(prev - 1, 1))}
                        disabled={currentPageSales === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        Page {currentPageSales} of {salesPagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageSales(prev => Math.min(prev + 1, salesPagination.totalPages || 1))}
                        disabled={currentPageSales === salesPagination.totalPages || salesPagination.totalPages === 0}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isReportGenerated && selectedReportType === 'sales' && (
                <div className="grid gap-4 md:grid-cols-2 mt-6">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700">Total Sales</p>
                          <h4 className="text-2xl font-bold text-blue-900 mt-1">{salesSummaryStats.totalSales}</h4>
                          <p className="text-xs text-blue-600 mt-1">In selected period</p>
                        </div>
                        <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                          <ShoppingCart className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700">Total Sales Value</p>
                          <h4 className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(salesSummaryStats.totalSalesValue)}</h4>
                          <p className="text-xs text-green-600 mt-1">In selected period</p>
                        </div>
                        <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {isReportGenerated && selectedReportType === 'stock' && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Show
                    </p>
                    <Select
                      value={itemsPerPageStock.toString()}
                      onValueChange={(value) => {
                        setItemsPerPageStock(Number(value));
                        setCurrentPageStock(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={itemsPerPageStock.toString()} />
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
                      Showing {stockPagination.total > 0 ? ((currentPageStock - 1) * itemsPerPageStock) + 1 : 0} to {Math.min(currentPageStock * itemsPerPageStock, stockPagination.total)} of {stockPagination.total} entries
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageStock(prev => Math.max(prev - 1, 1))}
                        disabled={currentPageStock === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        Page {currentPageStock} of {stockPagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageStock(prev => Math.min(prev + 1, stockPagination.totalPages || 1))}
                        disabled={currentPageStock === stockPagination.totalPages || stockPagination.totalPages === 0}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isReportGenerated && selectedReportType === 'stock' && (
                <div className="grid gap-4 md:grid-cols-2 mt-6">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700">Total Inventory Stock</p>
                          <h4 className="text-2xl font-bold text-blue-900 mt-1">{stockSummaryStats.totalStock}</h4>
                          <p className="text-xs text-blue-600 mt-1">In selected period</p>
                        </div>
                        <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                          <ShoppingCart className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700">Total Stock Value</p>
                          <h4 className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(stockSummaryStats.totalStockValue)}</h4>
                          <p className="text-xs text-green-600 mt-1">In selected period</p>
                        </div>
                        <div className="p-3 bg-white bg-opacity-70 rounded-lg shadow-sm">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Reports;
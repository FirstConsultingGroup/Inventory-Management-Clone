import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Printer, X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/Utils/formatters';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectPrintData,
  selectSelectedReportType,
  selectDateRange,
  selectStatusMessages,
  selectReportConfigs
} from '@/redux/features/PurchaseOrderReportPrintSlice';
import { selectUser } from '@/redux/features/userSlice';
import React from 'react';

// Interfaces based on PurchaseOrderView
interface ItemMgmt {
  item_id: string | null;
  item_name: string;
  description: string | null;
}

interface SupplierMgmt {
  supplier_name: string | null;
  email: string | null;
  address: string | null;
}

interface StoreMgmt {
  name: string;
  address: string | null;
}

interface PurchaseOrderItem {
  id: string;
  item_id: string;
  order_qty: number | null;
  order_price: number | null;
  item_mgmt: ItemMgmt;
}

interface PurchaseOrderViewData {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  total_items: number;
  total_value: number;
  payment_details: string | null;
  remarks: string | null;
  items: PurchaseOrderItem[];
  supplier: SupplierMgmt | null;
  store: StoreMgmt | null;
  order_status: string;
}

// Sales Invoice Interfaces
interface SalesInvoiceItem {
  tax_percentage: any;
  id: string;
  item_id: string;
  quantity: number | null;
  unit_price: number | null;
  discount_percentage: number | null;
  total: number;
  item_mgmt: ItemMgmt;
}

interface SalesInvoiceViewData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  // Additional overall discount & freight fields to match InvoiceView
  total_discount_amount?: number | null;
  total_discount_percentage?: number | null;
  freight_charges?: number | null;
  customer_name?: string;
  items: SalesInvoiceItem[];
  total_items: number;
  total_value: number;
  billing_address: string;
  email: string;
  contact_number: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  total_items: number;
  total_value: number;
  supplier_name?: string;
  system_message_config?: {
    sub_category_id: string;
    id: string;
  };
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  // Additional overall discount & freight fields to match InvoiceView
  total_discount_amount?: number | null;
  total_discount_percentage?: number | null;
  freight_charges?: number | null;
  customer_name?: string;
}

type StockItem = {
  id: string;
  item_uuid: string;
  item_id: string;
  item_name: string;
  item_category: string;
  description: string;
  selling_price: number;
  unit_price: number;
  total_quantity: number;
  store_id: string;
  store_name: string;
  purchase_order_id: string;
  stock_date: string;
  expiry_date: string | null;
  total_count: number;
};

type GroupedStockItem = {
  item_uuid: string;
  item_id: string;
  item_name: string;
  item_category: string;
  description: string;
  selling_price: number;
  total_count: number;
  stores: {
    store_id: string;
    store_name: string;
    unit_price: number;
    quantity: number;
  }[];
};

const PrintPreview: React.FC = () => {
  const navigate = useNavigate();

  // Redux selectors
  const reportData = useSelector(selectPrintData);
  const selectedReportType = useSelector(selectSelectedReportType);
  const dateRange = useSelector(selectDateRange);
  const statusMessages = useSelector(selectStatusMessages);
  const reportConfigs = useSelector(selectReportConfigs);
  const userData = useSelector(selectUser);
  const companyData = userData?.company_data;

  // Local state
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPurchaseOrder, setCurrentPurchaseOrder] = useState<PurchaseOrderViewData | null>(null);
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrderViewData[]>([]);
  const [currentSalesInvoice, setCurrentSalesInvoice] = useState<SalesInvoiceViewData | null>(null);
  const [allSalesInvoices, setAllSalesInvoices] = useState<SalesInvoiceViewData[]>([]);
  const [allInventoryStocks, setAllInventoryStocks] = useState<GroupedStockItem[]>([]);
  const [totalStockQty, setTotalStockQty] = useState(0);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [loading, setLoading] = useState(false);

  // Get the data array based on report type
  const getData = () => {
    if (selectedReportType === 'purchase-order' && reportData) {
      return reportData['purchase-order']?.data || [];
    }
    if (selectedReportType === 'sales' && reportData) {
      return reportData['sales']?.data || [];
    }
    if (selectedReportType === 'stock' && reportData) {
      return reportData['stock']?.data || [];
    }
    if (selectedReportType && reportData && selectedReportType in reportData) {
      return (reportData[selectedReportType as keyof typeof reportData] as any)?.data || [];
    }
    return [];
  };

  // Declare data, totalPages, and currentItem before useEffect
  const data = getData();
  console.log("Stock data =>", data);

  const totalPages = data.length;
  const currentItem = data[currentPage - 1];

  // Group stock by item names
  const groupStockByItem = (data: StockItem[]): GroupedStockItem[] => {
    const grouped: Record<string, GroupedStockItem> = {};

    data.forEach(item => {
      if (!grouped[item.item_uuid]) {
        grouped[item.item_uuid] = {
          item_uuid: item.item_uuid,
          item_id: item.item_id,
          item_name: item.item_name,
          item_category: item.item_category,
          description: item.description,
          selling_price: item.selling_price,
          total_count: item.total_count,
          stores: [],
        };
      }

      // If same store exists, merge quantity instead of pushing duplicate
      const existingStore = grouped[item.item_uuid].stores.find(
        s => s.store_id === item.store_id && s.unit_price === item.unit_price
      );

      if (existingStore) {
        existingStore.quantity += item.total_quantity;
      } else {
        grouped[item.item_uuid].stores.push({
          store_id: item.store_id,
          store_name: item.store_name,
          unit_price: item.unit_price,
          quantity: item.total_quantity,
        });
      }
    });

    return Object.values(grouped);
  };

  useEffect(() => {
    const groupedData = groupStockByItem(data);
    setAllInventoryStocks(groupedData);
    setTotalStockQty(data.reduce((sum: number, stock: StockItem) => sum + (stock.total_quantity || 0), 0))
    setTotalStockValue(data.reduce((sum: number, stock: StockItem) => sum + ((stock.total_quantity * stock.unit_price) || 0), 0))
  }, [data]);

  // Redirect if no data is available
  useEffect(() => {
    if (!reportData || !selectedReportType) {
      navigate(-1);
      toast.error('No report data available. Please generate a report first.');
      return;
    }
  }, [reportData, selectedReportType, navigate]);

  // Fetch all purchase orders for printing when component mounts
  useEffect(() => {
    if (selectedReportType === 'purchase-order' && data.length > 0 && allPurchaseOrders.length === 0) {
      fetchAllPurchaseOrdersForPrint();
    }
    if (selectedReportType === 'sales' && data.length > 0 && allSalesInvoices.length === 0) {
      fetchAllSalesInvoicesForPrint();
    }
  }, [data, selectedReportType]);

  // Format date helper function
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Fetch detailed purchase order data when currentPage changes (for preview)
  useEffect(() => {
    if (selectedReportType === 'purchase-order') {
      fetchPurchaseOrder();
    } else if (selectedReportType === 'sales') {
      fetchSalesInvoice();
    }
  }, [currentItem?.id, selectedReportType]);

  const fetchPurchaseOrder = async () => {
    if (!currentItem?.id || selectedReportType !== 'purchase-order') return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('purchase_order')
        .select(`
          *,
          purchase_order_items (
            *,
            item_mgmt (item_name, description)
          ),
          supplier_mgmt (supplier_name, email, address),
          store_mgmt (name, address),
          system_message_config(sub_category_id)
        `)
        .eq('id', currentItem.id)
        .single();

      if (error) throw error;

      setCurrentPurchaseOrder({
        ...data,
        items: data.purchase_order_items || [],
        supplier: data.supplier_mgmt || null,
        store: data.store_mgmt || null,
        order_status: data.system_message_config?.sub_category_id || 'Unknown',
      } as any);
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      toast.error('Failed to load purchase order details');
      setCurrentPurchaseOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesInvoice = async () => {
    if (!currentItem?.id || selectedReportType !== 'sales') return;
    setLoading(true);

    try {
      const { data: invoiceData, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          item_mgmt (item_id, item_name, description)
        `)
        .eq('sales_invoice_id', currentItem.id);

      if (error) throw error;

      // Calculate totals from items
      const items = invoiceData.map(item => {
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discountPercentage = item.discount_percentage || 0;

        const subtotal = quantity * unitPrice;
        const discountAmount = (subtotal * discountPercentage) / 100;
        const totalAfterDiscount = subtotal - discountAmount;

        const taxes: Record<string, number> =
          item.tax_percentage &&
            typeof item.tax_percentage === "object" &&
            !Array.isArray(item.tax_percentage)
            ? Object.fromEntries(
              Object.entries(item.tax_percentage).map(([k, v]) => [
                k,
                Number(v ?? 0),
              ])
            )
            : {};

        const totalTaxPercentage = Object.values(taxes)
          .filter(v => typeof v === "number" && !isNaN(v) && v > 0)
          .reduce((sum, v) => sum + v, 0);

        const taxAmount = (totalAfterDiscount * totalTaxPercentage) / 100;
        const total = subtotal - discountAmount + taxAmount;

        return {
          id: item.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          total: total,
          item_mgmt: item.item_mgmt,
          tax_percentage: item.tax_percentage,
        };
      });

      const totalItems = items.length;
      const totalValue = items.reduce((sum, item) => sum + item.total, 0);

      setCurrentSalesInvoice({
        ...currentItem,
        items: items,
        total_items: totalItems,
        total_value: totalValue
      } as SalesInvoiceViewData);

    } catch (error) {
      console.error('Error fetching sales invoice:', error);
      toast.error('Failed to load sales invoice details');
      setCurrentSalesInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  const taxTotals = useMemo(() => {
    if (!currentSalesInvoice?.items) return {};

    const totals: Record<string, number> = {};

    currentSalesInvoice.items.forEach(item => {
      const gross = (item.quantity ?? 0) * (item.unit_price ?? 0);
      const discount = ((item.discount_percentage ?? 0) / 100) * gross;
      const afterDiscount = gross - discount;

      const taxes = item.tax_percentage && typeof item.tax_percentage === "object"
        ? item.tax_percentage
        : {};

      Object.entries(taxes).forEach(([label, percent]) => {
        if (typeof percent === "number" && percent > 0) {
          const taxAmount = (afterDiscount * percent) / 100;

          totals[label] = (totals[label] || 0) + taxAmount;
        }
      });
    });

    return totals;
  }, [currentSalesInvoice]);

  const calculateInvoiceTaxTotals = (items: any[]) => {
    const totals: Record<string, number> = {};

    items.forEach(item => {
      const qty = item.quantity ?? 0;
      const price = item.unit_price ?? 0;
      const discount = item.discount_percentage ?? 0;

      const gross = qty * price;
      const discountAmt = (gross * discount) / 100;
      const afterDiscount = gross - discountAmt;

      const taxes =
        item.tax_percentage && typeof item.tax_percentage === "object"
          ? item.tax_percentage
          : {};

      Object.entries(taxes).forEach(([label, percent]) => {
        if (typeof percent === "number" && percent > 0) {
          const taxAmount = (afterDiscount * percent) / 100;
          totals[label] = (totals[label] || 0) + taxAmount;
        }
      });
    });

    return totals;
  };

  const extractTaxLabels = (items: SalesInvoiceItem[]) => {
    const labelSet = new Set<string>();

    items.forEach(item => {
      if (item.tax_percentage && typeof item.tax_percentage === "object") {
        Object.keys(item.tax_percentage).forEach(label => labelSet.add(label));
      }
    });

    return Array.from(labelSet).sort();
  };

  const dynamicTaxLabels = useMemo(() => {
    return currentSalesInvoice?.items ? extractTaxLabels(currentSalesInvoice.items) : [];
  }, [currentSalesInvoice]);

  console.log("Sales invoice tax labels =>", dynamicTaxLabels);

  // Fetch detailed purchase order data for printing
  const fetchAllPurchaseOrdersForPrint = async () => {
    if (data.length === 0 || selectedReportType !== 'purchase-order') {
      console.log('No data to fetch for printing or not a purchase order report');
      return;
    }

    setLoading(true);
    try {
      const purchaseOrderIds = data.map((item: PurchaseOrder) => item.id);

      const { data: purchaseOrdersData, error } = await supabase
        .from('purchase_order')
        .select(`
          *,
          purchase_order_items (
            *,
            item_mgmt (item_name, description)
          ),
          supplier_mgmt (supplier_name, email, address),
          store_mgmt (name, address),
          system_message_config(sub_category_id)
        `)
        .in('id', purchaseOrderIds);

      if (error) throw error;

      const formattedPurchaseOrders = purchaseOrdersData.map((po: any) => ({
        ...po,
        items: po.purchase_order_items || [],
        supplier: po.supplier_mgmt || null,
        store: po.store_mgmt || null,
        order_status: po.system_message_config?.sub_category_id || 'Unknown',
      })) as PurchaseOrderViewData[];

      setAllPurchaseOrders(formattedPurchaseOrders);
    } catch (error) {
      console.error('Error fetching all purchase orders:', error);
      toast.error('Failed to load purchase orders for printing');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed sales invoices data for printing
  const fetchAllSalesInvoicesForPrint = async () => {
    if (data.length === 0 || selectedReportType !== 'sales') {
      console.log('No data to fetch for printing or not a sales report');
      return;
    }

    setLoading(true);
    try {
      const salesInvoiceIds = data.map((item: SalesInvoice) => item.id);

      const { data: salesInvoicesData, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          *,
          item_mgmt (item_id, item_name, description)
        `)
        .in('sales_invoice_id', salesInvoiceIds);

      if (error) throw error;

      // Group items by sales_invoice_id
      const groupedItems = salesInvoicesData.reduce((acc: any, item: any) => {
        if (!acc[item.sales_invoice_id]) {
          acc[item.sales_invoice_id] = [];
        }

        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const discountPercentage = item.discount_percentage || 0;

        const subtotal = quantity * unitPrice;
        const discountAmount = (subtotal * discountPercentage) / 100;
        const totalAfterDiscount = subtotal - discountAmount;
        const taxes: Record<string, number> =
          item.tax_percentage &&
            typeof item.tax_percentage === "object" &&
            !Array.isArray(item.tax_percentage)
            ? Object.fromEntries(
              Object.entries(item.tax_percentage).map(([k, v]) => [
                k,
                Number(v ?? 0),
              ])
            )
            : {};

        const totalTaxPercentage = Object.values(taxes)
          .filter(v => typeof v === "number" && !isNaN(v) && v > 0)
          .reduce((sum, v) => sum + v, 0);

        const taxAmount = (totalAfterDiscount * totalTaxPercentage) / 100;
        const total = subtotal - discountAmount + taxAmount;

        acc[item.sales_invoice_id].push({
          id: item.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          total: total,
          item_mgmt: item.item_mgmt,
          tax_percentage: item.tax_percentage,
        });
        return acc;
      }, {});

      const formattedSalesInvoices = data.map((invoice: SalesInvoice) => {
        const items = groupedItems[invoice.id] || [];
        const totalItems = items.length;
        const totalValue = items.reduce((sum: number, item: any) => sum + item.total, 0);

        return {
          ...invoice,
          items: items,
          total_items: totalItems,
          total_value: totalValue
        };
      }) as SalesInvoiceViewData[];

      setAllSalesInvoices(formattedSalesInvoices);
    } catch (error) {
      console.error('Error fetching all sales invoices:', error);
      toast.error('Failed to load sales invoices for printing');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleBackToReports = () => {
    navigate(-1);
  };

  // Simple print function that directly prints the current data
  const handleSimplePrint = async () => {
    console.log('Simple print function called');

    if (data.length === 0) {
      toast.error('No data to print');
      return;
    }

    // For purchase orders, fetch detailed data if not already loaded
    if (selectedReportType === 'purchase-order') {
      if (allPurchaseOrders.length === 0) {
        setLoading(true);
        try {
          await fetchAllPurchaseOrdersForPrint(); // Wait for the fetch to complete
        } catch (error) {
          setLoading(false);
          toast.error('Failed to load data for printing');
          return; // Exit if the fetch fails
        }
        setLoading(false);
      }

      if (allPurchaseOrders.length === 0) {
        toast.error('Failed to load data for printing');
        return;
      }

      console.log('Printing', allPurchaseOrders.length, 'purchase orders');

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      // Create the print content for purchase orders
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Purchase Orders</title>
            <style>
              @page { size: A4; margin: 5mm; }
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
              .page { page-break-after: always; padding: 8mm; }
              .page:last-child { page-break-after: auto; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; }
              .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            ${allPurchaseOrders.map((po) => `
              <div class="page">
                <div class="header">
                  <div>
                    <h1 style="color: #2563eb; margin: 0;">${companyData?.name}</h1>
                    <p style="margin: 5px 0; color: #666;">${companyData?.description}</p>
                    <p style="margin: 2px 0; color: #666;">${companyData?.address}</p>
                    <p style="margin: 2px 0; color: #666;">${companyData?.city}, ${companyData?.state}, ${companyData?.country}, ${companyData?.postal_code}</p>
                    <p style="margin: 2px 0; color: #666;">Phone: ${companyData?.phone}</p>
                  </div>
                  <div style="text-align: right;">
                    <h2 style="color: #1e40af; margin: 0;">PURCHASE ORDER</h2>
                    <p style="margin: 5px 0; color: #666;">PO #: ${po.po_number}</p>
                    <p style="margin: 5px 0; color: #666;">Date: ${formatDate(po.order_date)}</p>
                    <div class="status" style="background-color: ${getStatusColor(po.order_status || 'Unknown')}">
                      ${po.order_status?.replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, c => c.toUpperCase()) || 'Unknown'}
                    </div>
                  </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                  <div>
                    <h3 style="margin: 0 0 10px 0;">Supplier:</h3>
                    <div style="border-left: 4px solid #2563eb; padding-left: 15px;">
                      <p style="margin: 5px 0; font-weight: bold;">${po.supplier?.supplier_name || 'N/A'}</p>
                      <p style="margin: 5px 0; color: #666;">${po.supplier?.address || 'N/A'}</p>
                      <p style="margin: 5px 0; color: #666;">${po.supplier?.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <h3 style="margin: 0 0 10px 0;">Delivery To:</h3>
                    <div style="border-right: 4px solid #2563eb; padding-right: 15px;">
                      <p style="margin: 5px 0; font-weight: bold;">${po.store?.name || 'N/A'}</p>
                      <p style="margin: 5px 0; color: #666;">${po.store?.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                
                <table>
                  <thead>
                    <tr style="background-color: #eff6ff;">
                      <th>Item Name</th>
                      <th>Description</th>
                      <th style="text-align: right;">Quantity</th>
                      <th style="text-align: right;">Unit Price</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${po.items?.length > 0 ? po.items.map(item => `
                      <tr>
                        <td>${item.item_mgmt.item_name || 'N/A'}</td>
                        <td>${item.item_mgmt.description || '-'}</td>
                        <td style="text-align: right;">${item.order_qty || 0}</td>
                        <td style="text-align: right;">${formatCurrency(item.order_price && item.order_qty ? item.order_price / item.order_qty : 0)}</td>
                        <td style="text-align: right;">${formatCurrency(item.order_price ?? 0)}</td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; color: #666;">No items found</td></tr>'}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3"></td>
                      <td style="text-align: right; font-weight: bold;">Total Items:</td>
                      <td style="text-align: right; font-weight: bold;">${po.total_items || 0}</td>
                    </tr>
                    <tr style="border-top: 2px solid #ddd;">
                      <td colspan="3"></td>
                      <td style="text-align: right; font-weight: bold; font-size: 16px;">Total:</td>
                      <td style="text-align: right; font-weight: bold; font-size: 16px; color: #2563eb;">${formatCurrency(po.total_value ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
                
                <div style="margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">Additional Details</h3>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                      <p style="margin: 5px 0; color: #666;"><strong>Payment Details:</strong> ${reportConfigs['purchase-order']?.payment_details || po.payment_details || 'N/A'}</p>
                    </div>
                    <div>
                      <p style="margin: 5px 0; color: #666;"><strong>Remarks:</strong> ${reportConfigs['purchase-order']?.remarks || po.remarks || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                
                <div class="footer">
                  <p>${reportConfigs['purchase-order']?.report_footer}</p>
      
                </div>
              </div>
            `).join('')}
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };

    } else if (selectedReportType === 'sales') {
      // Handle sales invoices printing
      if (allSalesInvoices.length === 0) {
        setLoading(true);
        try {
          await fetchAllSalesInvoicesForPrint();
        } catch (error) {
          setLoading(false);
          toast.error('Failed to load data for printing');
          return;
        }
        setLoading(false);
      }

      if (allSalesInvoices.length === 0) {
        toast.error('Failed to load data for printing');
        return;
      }

      console.log('Printing', allSalesInvoices.length, 'sales invoices');

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      // Create the print content for sales invoices
      const printContent =
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Sales Invoices</title>
            <style>
              @page {size: A4; margin: 15mm; }
              body {
                margin: 0;
                padding: 0;
                font-family: 'Helvetica Neue', Arial, sans-serif;
                color: #333; 
              }
              .page {
                page-break-after: always; 
              }
              .page:last-child {
              page-break-after: auto; 
              }
              .header {
                padding: 20px;
                border-bottom: 2px solid #e5e7eb;
                margin-bottom: 25px;
                border-radius: 8px 8px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .header .left-column {
                text-align: left; 
              }
              .header .right-column {
                text-align: right; 
              }
              .header h1 {
                color: #1e40af;
                font-size: 28px;
                font-weight: 800;
                margin: 0;
                letter-spacing: -0.025em; 
              }
              .header h2 {
                color: #1e3a8a;
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 8px; 
              }
              .header .company-details, .header .invoice-details {
                color: #6b7280;
                font-size: 14px;
                margin-top: 8px; 
              }
              .header .invoice-details p {
                margin: 4px 0; 
              }
              .customer-details {
                margin: 15px 0;
                padding: 15px;
                background-color: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-size: 12px;
                color: #4b5563;
                display: flex;
                justify-content: space-between;
              }
              .customer-details p {
                margin: 5px 0; 
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-size: 13px; 
              }
              th, td {
                border: 1px solid #e5e7eb;
                padding: 10px;
                font-size: 13px; 
              }
              th {
                background-color: #f9fafb;
                font-weight: 600;
                color: #1f2937; 
              }
              th:nth-child(1), th:nth-child(2) {
                text-align: left;
              }
              th:not(:first-child):not(:nth-child(2)), td:not(:first-child):not(:nth-child(2)) {
                text-align: right;
              }
              tbody tr:nth-child(even) {
                background-color: #f9fafb; 
              }
              tbody tr:hover {
                background-color: #eff6ff;
                transition: background-color 0.2s ease; 
              }
              tfoot tr {
                border-top: 2px solid #e5e7eb; 
              }
              tfoot td {
                font-weight: 600;
                color: #1f2937; 
              }
              tfoot tr:last-child td:last-child {
                color: #1e40af;
                font-size: 14px; 
              }
              .footer {
                margin-top: 25px;
                text-align: center;
                font-size: 12px;
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
                padding-top: 15px; 
              }
              @media print {
                .header {
                  background: none;
                  border-bottom: 1px solid #e5e7eb; 
                }
                .customer-details {
                  background: none;
                  border: 1px solid #e5e7eb; 
                }
                tbody tr:hover {
                  background-color: transparent; 
                }
              }
            </style>
          </head>
          <body>
            ${allSalesInvoices.map((invoice) => `
      <div class="page">
        <div class="header">
          <div class="left-column">
            <h1>${companyData?.name}</h1>
            <div class="company-details">
              ${companyData?.description}<br>
              ${companyData?.address}<br>
              ${companyData?.city}, ${companyData?.state}, ${companyData?.country}, ${companyData?.postal_code}<br>
              Phone: ${companyData?.phone}
            </div>
          </div>
          <div class="right-column">
            <h2>SALES INVOICE</h2>
            <div class="invoice-details">
              <p>Invoice #: ${invoice.invoice_number}</p>
              <p>Date: ${formatDate(invoice.invoice_date)}</p>
            </div>
          </div>
        </div>

        <div class="customer-details">
            <div>
              ${invoice.customer_name ? `<p><strong>Customer:</strong> ${invoice.customer_name}</p>` : ''}
              ${invoice.billing_address ? `<p><strong>Address:</strong> ${invoice.billing_address}</p>` : ''}
            </div>
            <div>
              ${invoice.contact_number ? `<p><strong>Phone:</strong> ${invoice.contact_number}</p>` : ''}
              ${invoice.email ? `<p><strong>Email:</strong> ${invoice.email}</p>` : ''}
            </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              ${extractTaxLabels(invoice.items ?? [])
            .map(label => `<th>${label}</th>`)
            .join("")}
              <th>Discount %</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items?.length > 0
            ? invoice.items
              .map((item) => {
                const taxes =
                  item.tax_percentage && typeof item.tax_percentage === "object"
                    ? item.tax_percentage
                    : {};

                const taxLabels = extractTaxLabels(invoice.items ?? []);

                const base = (item.quantity || 0) * (item.unit_price || 0);
                const discountPct = item.discount_percentage || 0;
                const discountAmount = (base * discountPct) / 100;
                const baseAfterDiscount = base - discountAmount;

                const taxCells = taxLabels
                  .map((label) => {
                    const taxPercent = taxes[label] || 0;
                    const taxAmount = (baseAfterDiscount * taxPercent) / 100;

                    return `
                  <td>
                    ${taxPercent > 0
                        ? `<div style="display:flex; flex-direction:column; align-items:flex-end;">
                            <span>${taxPercent}%</span>
                            <span style="font-size:11px; color:#2563eb;">+${formatCurrency(taxAmount)}</span>
                          </div>`
                        : `-`
                      }
                  </td>`;
                  })
                  .join("");

                return `
              <tr>
                <td>${item?.item_mgmt?.item_id || "-"}</td>
                <td>${item?.item_mgmt?.item_name || "-"}</td>
                <td>${item.quantity || 0}</td>
                <td>${formatCurrency(item.unit_price ?? 0)}</td>
                ${taxCells}
                <td>
                  ${item.discount_percentage! > 0
                    ? `
                          <div style="display:flex; flex-direction:column; align-items:flex-end;">
                            <span>${item.discount_percentage}%</span>
                            <span style="font-size:11px; color:#16a34a;">-${formatCurrency(
                      ((item.quantity || 0) * (item.unit_price || 0) * (item.discount_percentage || 0)) / 100
                    )}</span>
                          </div>
                          `
                    : `-`
                  }
                </td>
                <td>${formatCurrency(item.total ?? 0)}</td>
              </tr>
            `;
              })
              .join("")
            : `
              <tr>
                <td colspan="${6 + extractTaxLabels(invoice.items ?? []).length}" style="text-align:center; color:#6b7280;">
                  No items found
                </td>
              </tr>`
          }
          </tbody>
        </table>

        <!-- Totals -->
        <div style="width: 100%; display: flex; justify-content: flex-end; margin-top: 10px;">

          <!-- TOTALS BOX (50% WIDTH) -->
          <div style="font-size: 13px; width: 50%;">

            <div style="
              display: grid;
              grid-template-columns: 1fr 150px;
              row-gap: 8px;
              column-gap: 10px;
              padding: 15px;
              border: 1px solid #e5e7eb;
              background: #f9fafb;
              border-radius: 6px;
            ">

              <!-- Gross Total -->
              <div style="color:#1f2937;">Gross Total:</div>
              <div style="text-align:right; font-weight:600;">
                ${formatCurrency(invoice.invoice_amount || 0)}
              </div>

              <!-- Total items discount -->
              <div style="color:#1f2937;">Total Items Discount:</div>
              <div style="text-align:right; color:#16a34a; font-weight:600;">
                -${formatCurrency(invoice.discount_amount || 0)}
              </div>

              ${typeof invoice.total_discount_amount === 'number'
            ? `
              <div style="color:#1f2937; border-top:1px solid #d1d5db; padding-top:6px;">
                Total Discount Amount (${invoice.total_discount_percentage ?? 0}%):
              </div>
              <div style="text-align:right; border-top:1px solid #d1d5db; padding-top:6px; color:#16a34a; font-weight:600;">
                -${formatCurrency(invoice.total_discount_amount ?? 0)}
              </div>`
            : ''
          }

              <!-- Subtotal after all discounts (before tax & freight) -->
              <div style="border-top:1px solid #d1d5db; padding-top:6px;">Subtotal (After Discounts):</div>
              <div style="text-align:right; border-top:1px solid #d1d5db; padding-top:6px; font-weight:600;">
                ${formatCurrency(
            (invoice.invoice_amount || 0) -
            (invoice.discount_amount || 0) -
            (invoice.total_discount_amount || 0)
          )}
              </div>

              <!-- Dynamic Per-Tax Totals -->
              ${(() => {
            const taxTotals = calculateInvoiceTaxTotals(invoice.items || []);
            const labels = extractTaxLabels(invoice.items || []);

            return labels
              .map(label => `
                    <div style="color:#4b5563; font-size: 11px;">${label}:</div>
                    <div style="text-align:right; font-size: 11px;">
                      ${formatCurrency(taxTotals[label] || 0)}
                    </div>
                  `)
              .join("");
          })()}

              <!-- Total Tax Amount -->
              <div style="color:#1f2937; border-top:1px solid #d1d5db; padding-top:6px;">Total Tax Amount:</div>
              <div style="text-align:right; border-top:1px solid #d1d5db; padding-top:6px; color:#2563eb; font-weight:600;">
                +${formatCurrency(invoice.tax_amount || 0)}
              </div>

              ${typeof invoice.freight_charges === 'number'
            ? `
              <div style="color:#1f2937; border-top:1px solid #d1d5db; padding-top:6px;">
                Freight Charges:
              </div>
              <div style="text-align:right; border-top:1px solid #d1d5db; padding-top:6px; color:#2563eb; font-weight:600;">
                +${formatCurrency(invoice.freight_charges ?? 0)}
              </div>`
            : ''
          }

              <!-- Net Total -->
              <div style="color:#1f2937; font-size:15px; padding-top:8px; border-top:2px solid #1e3a8a;">
                <b>Grand Total:</b>
              </div>
              <div style="
                text-align:right;
                color:#1e3a8a;
                font-size:15px;
                padding-top:8px;
                border-top:2px solid #1e3a8a;
                font-weight:700;
              ">
                ${formatCurrency(invoice.net_amount || 0)}
              </div>
            </div>
          </div>
        </div>
        
        <div style="margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0;">Additional Details</h4>
          <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
            <div>
              <p style="margin: 5px 0; color: #666; font-size: 12px;"><strong>Remarks:</strong> ${reportConfigs['sales']?.remarks || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>${reportConfigs['sales']?.report_footer || 'Thank you for your business!'}</p>
          
        </div>
      </div>
    `).join('')}
          </body>
        </html>`
        ;

      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };

    } else if (selectedReportType === 'stock') {
      if (allInventoryStocks.length === 0) {
        toast.error('No stock data available to print');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inventory Stock Report</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #333;
          }
          .page {
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: auto;
          }
          .header {
            padding: 20px;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 25px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header .left-column { text-align: left; }
          .header .right-column { text-align: right; }
          .header h1 {
            color: #1e40af;
            font-size: 28px;
            font-weight: 800;
            margin: 0;
          }
          .header h2 {
            color: #1e3a8a;
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 8px;
          }
          .header .company-details, .header .stock-details {
            color: #6b7280;
            font-size: 14px;
            margin-top: 8px; 
          }
          .header .stock-details p {
            margin: 4px 0; 
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 13px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 10px;
            font-size: 13px;
          }
          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #1f2937;
          }
          td:first-child { width: 40px; } /* empty column */
          tbody tr:nth-child(even) { background-color: #f9fafb; }
          tbody tr:hover { background-color: #eff6ff; transition: background-color 0.2s ease; }
          .totals-row {
            background-color: #e0f2fe;
            font-weight: bold;
          }
          .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="left-column">
              <h1>${companyData?.name}</h1>
              <div class="company-details">
                ${companyData?.description || ''}<br>
                ${companyData?.address || ''}<br>
                ${companyData?.city || ''}, ${companyData?.state || ''}, ${companyData?.country || ''}, ${companyData?.postal_code || ''}<br>
                Phone: ${companyData?.phone || ''}
              </div>
            </div>
            <div class="right-column">
              <h2>INVENTORY STOCK REPORT</h2>
              <div class="stock-details">
                <p>Date: ${formatDate(new Date().toLocaleDateString())}</p>
              </div>
            </div>
          </div>

          <table>
            <tbody>
              ${allInventoryStocks.map(item => `
                <tr style="background:#f3f4f6;font-weight:bold;">
                  <td colspan="5">${item.item_id} - ${item.item_name}</td>
                </tr>
                <tr style="background:#eff6ff;">
                  <td></td>
                  <td><b>Store Name</b></td>
                  <td style="text-align:right;"><b>Quantity</b></td>
                  <td style="text-align:right;"><b>Unit Price</b></td>
                  <td style="text-align:right;"><b>Total Value</b></td>
                </tr>
                ${item.stores.map(store => `
                  <tr>
                    <td></td>
                    <td>${store.store_name}</td>
                    <td style="text-align:right;">${store.quantity}</td>
                    <td style="text-align:right;">${formatCurrency(store.unit_price)}</td>
                    <td style="text-align:right;">${formatCurrency(store.quantity * store.unit_price)}</td>
                  </tr>
                `).join('')}
              `).join('')}

              <tr class="totals-row">
                <td colspan="2" style="text-align:right;">Grand Total</td>
                <td style="text-align:right;">${totalStockQty}</td>
                <td></td>
                <td style="text-align:right;">${formatCurrency(totalStockValue)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">Additional Details</h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
              <div>
                <p style="margin: 5px 0; color: #666; font-size: 12px;"><strong>Remarks:</strong> ${reportConfigs['stock']?.remarks || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>${reportConfigs['stock']?.report_footer || 'Generated on ' + new Date().toLocaleDateString() + ' by GarageInventory Management System'}</p>
          </div>
        </div>
      </body>
    </html>
  `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    } else {
      // Handle other report types
      // const headers = reportData?.[selectedReportType as keyof typeof reportData]?.headers || [];

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      // let tableRows = '';
      // if (data.length > 0) {
      //   tableRows = data.map((item: any) => {
      //     let row = '<tr>';

      //     if (selectedReportType === 'stock') {
      //       row += `
      //         <td>${item.id}</td>
      //         <td>${item.name}</td>
      //         <td>${item.category}</td>
      //         <td>${item.inStock}</td>
      //         <td>${item.reserved}</td>
      //         <td>${item.available}</td>
      //         <td>${item.reorderLevel}</td>
      //         <td>${formatDate(item.lastUpdated)}</td>
      //       `;
      //     } else if (selectedReportType === 'supplier') {
      //       row += `
      //         <td>${item.id}</td>
      //         <td>${item.name}</td>
      //         <td>${item.totalOrders}</td>
      //         <td>${item.totalValue}</td>
      //         <td>${item.onTimeDelivery}</td>
      //         <td>${item.rating}</td>
      //         <td>${formatDate(item.lastOrder)}</td>
      //       `;
      //     }

      //     row += '</tr>';
      //     return row;
      //   }).join('');
      // } else {
      //   tableRows = `<tr><td colspan="${headers.length}" style="text-align: center; color: #666;">No data found</td></tr>`;
      // }
    }
  };

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ORDER_CREATED':
        return 'rgb(59, 130, 246)'; // blue
      case 'ORDER_ISSUED':
        return 'rgb(234, 179, 8)'; // yellow
      case 'ORDER_RECEIVED':
        return 'rgb(34, 197, 94)'; // green
      case 'ORDER_PARTIALLY_RECEIVED':
        return 'rgb(249, 115, 22)'; // orange
      case 'ORDER_CANCELLED':
        return 'rgb(239, 68, 68)'; // red
      default:
        return 'rgb(107, 114, 128)'; // gray
    }
  };

  // Early return if no data
  if (!reportData || !selectedReportType) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Data Available</h3>
          <p className="text-gray-600 mb-4">Please generate a report first.</p>
          <Button onClick={() => navigate(-1)}>
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-preview-wrapper fixed inset-0 bg-gray-50 z-50 overflow-y-auto overflow-x-hidden">
      <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
        {/* Header with back button and actions */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToReports}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSimplePrint} disabled={loading || data.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print All
            </Button>
            <Button variant="outline" onClick={handleBackToReports}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Enhanced Header Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
          <div className="border-b border-gray-200 px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{companyData?.name}</h1>
                  <p className="text-gray-600 text-sm">{companyData?.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {/* <p className="text-gray-700 text-sm font-medium">System ID</p>
                  <p className="text-gray-500 text-xs">IMS2025</p> */}
                </div>
              </div>
            </div>
          </div>
          <div className="px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {reportData[selectedReportType as keyof typeof reportData]?.title || 'Report'}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Report Type: {selectedReportType.charAt(0).toUpperCase() + selectedReportType.slice(1).replace('-', ' ')}
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Total Records: {totalPages}
                  </span>
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Date Range
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {dateRange && dateRange[0] && dateRange[1]
                      ? `${formatDate(dateRange[0])} – ${formatDate(dateRange[1])}`
                      : 'All Time'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on report type */}
        {selectedReportType === 'purchase-order' ? (
          currentPurchaseOrder ? (
            <div className="space-y-8">
              <div className="relative">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                  <div className="min-h-[29.7cm] p-8">
                    {/* Header Section */}
                    <div className="flex justify-between items-start mb-8 border-b pb-6 print:pb-4">
                      <div>
                        <h1 className="text-2xl font-bold text-blue-600">{companyData?.name}</h1>
                        <p className="text-gray-600 mt-1 text-sm">{companyData?.description}</p>
                        <p className="text-gray-600 text-sm">{companyData?.address}</p>
                        <p className="text-gray-600 text-sm">{companyData?.city}, {companyData?.state}, {companyData?.country}, {companyData?.postal_code}</p>
                        <p className="text-gray-600 text-sm">Phone: {companyData?.phone}</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-blue-800">PURCHASE ORDER</h2>
                        <p className="text-gray-600 mt-1 text-sm">PO #: {currentPurchaseOrder.po_number}</p>
                        <p className="text-gray-600 text-sm">Date: {formatDate(currentPurchaseOrder.order_date)}</p>
                        <Badge
                          style={{
                            backgroundColor: getStatusColor(currentPurchaseOrder.order_status || 'Unknown'),
                            color: 'white',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.25rem',
                            marginTop: '0.5rem',
                            fontSize: '0.75rem',
                          }}
                        >
                          {statusMessages[currentPurchaseOrder.order_status || 'Unknown'] ||
                            currentPurchaseOrder.order_status
                              ?.replace(/_/g, ' ')
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown'}
                        </Badge>
                      </div>
                    </div>

                    {/* Supplier and Store Section */}
                    <div className="grid grid-cols-2 gap-8 mb-8 print:gap-6">
                      <div>
                        <h3 className="text-gray-800 font-semibold mb-2 text-sm">Supplier:</h3>
                        <div className="border-l-4 border-blue-600 pl-4">
                          <p className="text-gray-800 font-medium text-base">{currentPurchaseOrder.supplier?.supplier_name || 'N/A'}</p>
                          <p className="text-gray-600 text-sm">{currentPurchaseOrder.supplier?.address || 'N/A'}</p>
                          <p className="text-gray-600 text-sm">{currentPurchaseOrder.supplier?.email || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h3 className="text-gray-800 font-semibold mb-2 text-sm">Delivery To:</h3>
                        <div className="border-r-4 border-blue-600 pr-4">
                          <p className="text-gray-800 font-medium text-base">{currentPurchaseOrder.store?.name || 'N/A'}</p>
                          <p className="text-gray-600 text-sm">{currentPurchaseOrder.store?.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8 print:mb-6">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-blue-50 border-y">
                            <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Item Name</th>
                            <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Description</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Quantity</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Unit Price</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={5} className="py-3 px-4 text-center text-gray-600">Loading items...</td>
                            </tr>
                          ) : currentPurchaseOrder?.items?.length > 0 ? (
                            currentPurchaseOrder.items.map((item, index) => (
                              <tr key={index} className="border-b">
                                <td className="py-3 px-4 text-gray-800 text-sm">{item.item_mgmt.item_name || 'N/A'}</td>
                                <td className="py-3 px-4 text-gray-600 text-sm">{item.item_mgmt.description || '-'}</td>
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.order_qty || 0}</td>
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">
                                  {formatCurrency(item.order_price && item.order_qty ? item.order_price / item.order_qty : 0)}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">
                                  {formatCurrency(item.order_price ?? 0)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-3 px-4 text-center text-gray-600">No items found</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right font-semibold text-sm">Total Items:</td>
                            <td className="py-3 px-4 text-right font-semibold text-sm">{currentPurchaseOrder?.total_items || 0}</td>
                          </tr>
                          <tr className="border-t-2">
                            <td colSpan={3} className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right font-bold text-base">Total:</td>
                            <td className="py-3 px-4 text-right font-bold text-base text-blue-600">
                              {formatCurrency(currentPurchaseOrder?.total_value ?? 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Additional Details */}
                    <div className="mb-8 print:mb-6">
                      <h3 className="text-gray-800 font-semibold mb-2 text-sm">Additional Details</h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-gray-600 text-sm"><strong>Payment Details:</strong> ${reportConfigs['purchase-order']?.payment_details || currentPurchaseOrder?.payment_details || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm"><strong>Remarks:</strong> ${reportConfigs['purchase-order']?.remarks || currentPurchaseOrder?.remarks || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Section */}
                    <div className="mt-12 border-t pt-8 print:pt-6">
                      <div className="text-center text-gray-500 text-xs">
                        <p>{reportConfigs['purchase-order']?.report_footer}</p>
                        {/* <p>For any queries, please contact at {companyData?.email}</p> */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Navigation Arrows */}
                {!isMobile && totalPages > 1 && (
                  <div>
                    <button
                      onClick={handlePrevious}
                      disabled={currentPage === 1 || loading}
                      className="absolute left-[-50px] top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 text-gray-600 p-3 rounded-full shadow-md hover:bg-gray-50 hover:shadow-lg disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-sm transition-all duration-200"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentPage === totalPages || loading}
                      className="absolute right-[-50px] top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 text-gray-600 p-3 rounded-full shadow-md hover:bg-gray-50 hover:shadow-lg disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-sm transition-all duration-200"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop Pagination Details */}
              {!isMobile && totalPages > 1 && (
                <div className="text-center text-sm text-gray-600 mt-4">
                  Page {currentPage} of {totalPages}
                </div>
              )}

              {/* Mobile Navigation */}
              {isMobile && totalPages > 1 && (
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1 || loading}
                    className="bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-full shadow-sm hover:bg-gray-100 hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {currentPurchaseOrder?.po_number || `Item ${currentPage}`}
                    </div>
                  </div>
                  <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages || loading}
                    className="bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-full shadow-sm hover:bg-gray-100 hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
              <div className="text-gray-500">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Loading Purchase Order</h3>
                <p className="text-sm">{loading ? 'Loading...' : 'No data available for the selected purchase order.'}</p>
              </div>
            </div>
          )
        ) : selectedReportType === 'sales' ? (
          currentSalesInvoice ? (
            <div className="space-y-8">
              <div className="relative">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                  <div className="min-h-[29.7cm] p-8">
                    {/* Header Section */}
                    <div className="flex justify-between items-start mb-8 border-b pb-6 print:pb-4">
                      <div>
                        <h1 className="text-2xl font-bold text-blue-600">{companyData?.name}</h1>
                        <p className="text-gray-600 mt-1 text-sm">{companyData?.description}</p>
                        <p className="text-gray-600 text-sm">{companyData?.address}</p>
                        <p className="text-gray-600 text-sm">{companyData?.city}, {companyData?.state}, {companyData?.country}, {companyData?.postal_code}</p>
                        <p className="text-gray-600 text-sm">Phone: {companyData?.phone}</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-blue-800">SALES INVOICE</h2>
                        <p className="text-gray-600 mt-1 text-sm">Invoice #: {currentSalesInvoice.invoice_number}</p>
                        <p className="text-gray-600 text-sm">Date: {formatDate(currentSalesInvoice.invoice_date)}</p>
                        {currentSalesInvoice.customer_name && (
                          <p className="text-gray-600 text-sm">Customer: <b>{currentSalesInvoice.customer_name}</b></p>
                        )}
                      </div>
                    </div>

                    {/* Invoice Summary Section */}
                    <div className="grid grid-cols-2 gap-8 mb-8 print:gap-6">
                      <div>
                        <h3 className="text-gray-800 font-semibold mb-2 text-sm">Invoice Summary:</h3>
                        <div className="border-l-4 border-blue-600 pl-4">
                          <p className="text-gray-600 text-sm">
                            Gross Amount:{' '}
                            <span className="font-medium">
                              {formatCurrency(currentSalesInvoice.invoice_amount)}
                            </span>
                          </p>
                          <p className="text-gray-600 text-sm">
                            Total Items Discount:{' '}
                            <span className="font-medium text-green-600">
                              -{formatCurrency(currentSalesInvoice.discount_amount)}
                            </span>
                          </p>
                          {typeof currentSalesInvoice.total_discount_amount === 'number' && (
                            <p className="text-gray-600 text-sm">
                              Total Discount Amount ({currentSalesInvoice.total_discount_percentage ?? 0}
                              %):{' '}
                              <span className="font-medium text-green-600">
                                -{formatCurrency(currentSalesInvoice.total_discount_amount ?? 0)}
                              </span>
                            </p>
                          )}
                          <p className="text-gray-600 text-sm">
                            Total Tax Amount:{' '}
                            <span className="font-medium text-blue-600">
                              +{formatCurrency(currentSalesInvoice.tax_amount)}
                            </span>
                          </p>
                          {typeof currentSalesInvoice.freight_charges === 'number' && (
                            <p className="text-gray-600 text-sm">
                              Freight Charges:{' '}
                              <span className="font-medium text-blue-600">
                                +{formatCurrency(currentSalesInvoice.freight_charges ?? 0)}
                              </span>
                            </p>
                          )}
                          <p className="text-gray-800 text-sm mt-1">
                            Net Amount:{' '}
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(currentSalesInvoice.net_amount)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h3 className="text-gray-800 font-semibold mb-2 text-sm">Customer Details:</h3>
                        <div className="border-r-4 border-blue-600 pr-4">
                          <p className="text-gray-600 text-sm"><span className="font-medium">{currentSalesInvoice.billing_address}</span></p>
                          <p className="text-gray-600 text-sm">Email: <span className="font-medium">{currentSalesInvoice?.email ?? '--'}</span></p>
                          <p className="text-gray-600 text-sm">Phone: <span className="font-medium">{currentSalesInvoice.contact_number}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8 print:mb-6">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-blue-50 border-y">
                            <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Item ID</th>
                            <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Item Name</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Quantity</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Unit Price</th>
                            {dynamicTaxLabels.map(label => (
                              <th key={label} className="py-2 px-4 text-right text-blue-800 font-medium text-sm">{label}</th>
                            ))}
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Discount</th>
                            <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={6} className="py-3 px-4 text-center text-gray-600">Loading items...</td>
                            </tr>
                          ) : currentSalesInvoice?.items?.length > 0 ? (
                            currentSalesInvoice.items.map((item, index) => (
                              <tr key={index} className="border-b">
                                <td className="py-3 px-4 text-gray-800 text-sm">{item.item_mgmt.item_id || '-'}</td>
                                <td className="py-3 px-4 text-gray-600 text-sm">{item.item_mgmt.item_name || '-'}</td>
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.quantity || 0}</td>
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">{formatCurrency(item.unit_price ?? 0)}</td>

                                {dynamicTaxLabels.map((label) => {
                                  const taxes =
                                    item.tax_percentage && typeof item.tax_percentage === "object"
                                      ? item.tax_percentage
                                      : {};

                                  const taxPercent = taxes[label] || 0;

                                  const qty = item.quantity ?? 0;
                                  const price = item.unit_price ?? 0;
                                  const discountPct = item.discount_percentage ?? 0;

                                  const base = qty * price;
                                  const discountAmount = (base * discountPct) / 100;
                                  const baseAfterDiscount = base - discountAmount;

                                  const taxAmountForLabel = (baseAfterDiscount * taxPercent) / 100;

                                  return (
                                    <td key={label} className="py-3 px-4 text-right text-gray-800 text-sm">
                                      {taxPercent > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-xs font-semibold">{taxPercent}%</span>
                                          <span className="text-[11px] text-blue-600 mt-1">
                                            +{formatCurrency(taxAmountForLabel)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Discount Column */}
                                <td className="py-3 px-4 text-right text-gray-800 text-sm">
                                  {item?.discount_percentage! > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-xs font-semibold">{item.discount_percentage}%</span>
                                      <span className="text-[11px] text-green-600 mt-1">
                                        -{formatCurrency(
                                          ((item.quantity || 0) * (item.unit_price || 0) * (item.discount_percentage || 0)) / 100
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right text-gray-800 text-sm">
                                  {formatCurrency(item.total ?? 0)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-3 px-4 text-center text-gray-600">No items found</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={dynamicTaxLabels.length + 4} className="py-3 px-4"></td>
                            <td className="py-3 px-4 text-right font-semibold text-sm">Total Items:</td>
                            <td className="py-3 px-4 text-right font-semibold text-sm">
                              {currentSalesInvoice?.total_items || 0}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Totals Summary Box */}
                      <div className="flex justify-end mt-2 pb-4 border-b-1">
                        <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 rounded-lg p-5">

                          {/* Gross Total */}
                          <div className="flex justify-between py-1 text-sm">
                            <span>Gross Total:</span>
                            <span className="font-semibold">
                              {formatCurrency(currentSalesInvoice?.invoice_amount ?? 0)}
                            </span>
                          </div>

                          {/* Total items discount */}
                          <div className="flex justify-between py-1 text-sm">
                            <span>Total Items Discount:</span>
                            <span className="font-semibold text-green-600">
                              -{formatCurrency(currentSalesInvoice?.discount_amount ?? 0)}
                            </span>
                          </div>

                          {/* Overall invoice discount */}
                          {typeof currentSalesInvoice?.total_discount_amount === 'number' && (
                            <div className="flex justify-between py-1 text-sm border-t mt-1">
                              <span>
                                Total Discount Amount (
                                {currentSalesInvoice?.total_discount_percentage ?? 0}%):
                              </span>
                              <span className="font-semibold text-green-600">
                                -{formatCurrency(currentSalesInvoice?.total_discount_amount ?? 0)}
                              </span>
                            </div>
                          )}

                          {/* Subtotal after all discounts (before tax & freight) */}
                          <div className="flex justify-between py-2 mt-1 border-t text-sm">
                            <span>Subtotal (After Discounts):</span>
                            <span className="font-semibold">
                              {formatCurrency(
                                (currentSalesInvoice?.invoice_amount ?? 0) -
                                (currentSalesInvoice?.discount_amount ?? 0) -
                                (currentSalesInvoice?.total_discount_amount ?? 0)
                              )}
                            </span>
                          </div>

                          {/* Dynamic Tax Totals */}
                          {dynamicTaxLabels.map((label) => (
                            <div key={label} className="flex justify-between py-1 text-xs text-gray-600">
                              <span>{label}:</span>
                              <span>{formatCurrency(taxTotals[label] || 0)}</span>
                            </div>
                          ))}

                          {/* Total Tax */}
                          <div className="flex justify-between py-2 mt-1 border-t text-sm">
                            <span>Total Tax Amount:</span>
                            <span className="font-semibold text-blue-600">
                              +{formatCurrency(currentSalesInvoice?.tax_amount ?? 0)}
                            </span>
                          </div>

                          {/* Freight Charges */}
                          {typeof currentSalesInvoice?.freight_charges === 'number' && (
                            <div className="flex justify-between py-2 mt-1 border-t text-sm">
                              <span>Freight Charges:</span>
                              <span className="font-semibold text-blue-600">
                                +{formatCurrency(currentSalesInvoice?.freight_charges ?? 0)}
                              </span>
                            </div>
                          )}

                          {/* Grand Total */}
                          <div className="flex justify-between py-3 mt-2 border-t text-base font-bold text-blue-900">
                            <span>Grand Total:</span>
                            <span>{formatCurrency(currentSalesInvoice?.net_amount ?? 0)}</span>
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mb-8 print:mb-6">
                      <h3 className="text-gray-800 font-semibold mb-2 text-sm">Additional Details</h3>
                      <div className="grid grid-cols-1 gap-8">
                        <div>
                          <p className="text-gray-600 text-sm"><strong>Remarks:</strong> ${reportConfigs['sales']?.remarks || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Section */}
                    <div className="mt-12 border-t pt-8 print:pt-6">
                      <div className="text-center text-gray-500 text-xs">
                        <p>{reportConfigs['sales']?.report_footer}</p>
                        {/* <p>For any queries, please contact at {companyData?.email}</p> */}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Navigation Arrows for Sales Invoice */}
                {!isMobile && totalPages > 1 && (
                  <div>
                    <button
                      onClick={handlePrevious}
                      disabled={currentPage === 1 || loading}
                      className="absolute left-[-50px] top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 text-gray-600 p-3 rounded-full shadow-md hover:bg-gray-50 hover:shadow-lg disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-sm transition-all duration-200"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentPage === totalPages || loading}
                      className="absolute right-[-50px] top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 text-gray-600 p-3 rounded-full shadow-md hover:bg-gray-50 hover:shadow-lg disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-sm transition-all duration-200"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop Pagination Details for Sales Invoice */}
              {!isMobile && totalPages > 1 && (
                <div className="text-center text-sm text-gray-600 mt-4">
                  Page {currentPage} of {totalPages}
                </div>
              )}

              {/* Mobile Navigation for Sales Invoice */}
              {isMobile && totalPages > 1 && (
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1 || loading}
                    className="bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-full shadow-sm hover:bg-gray-100 hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {currentSalesInvoice?.invoice_number || `Item ${currentPage}`}
                    </div>
                  </div>
                  <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages || loading}
                    className="bg-gray-50 border border-gray-200 text-gray-600 p-3 rounded-full shadow-sm hover:bg-gray-100 hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
              <div className="text-gray-500">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Loading Sales Invoice</h3>
                <p className="text-sm">{loading ? 'Loading...' : 'No data available for the selected sales invoice.'}</p>
              </div>
            </div>
          )
        ) : selectedReportType === 'stock' ? (
          // Other Report Types (Stock, Supplier, etc.)
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="min-h-[29.7cm] p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-8 border-b pb-6">
                <div>
                  <h1 className="text-2xl font-bold text-blue-600">{companyData?.name}</h1>
                  <p className="text-gray-600 mt-1 text-sm">{companyData?.description}</p>
                  <p className="text-gray-600 text-sm">{companyData?.address}</p>
                  <p className="text-gray-600 text-sm">{companyData?.city}, {companyData?.state}, {companyData?.country}, {companyData?.postal_code}</p>
                  <p className="text-gray-600 text-sm">Phone: {companyData?.phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-blue-800">
                    {reportData[selectedReportType as keyof typeof reportData]?.title || 'Report'}
                  </h2>
                  <p className="text-gray-600 mt-1 text-sm">Generated: {formatDate(new Date())}</p>
                  <p className="text-gray-600 text-sm">
                    {dateRange && dateRange[0] && dateRange[1]
                      ? `${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`
                      : 'All Time'}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="mb-8">
                <table className="w-full border-collapse">
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-3 px-4 text-center text-gray-600">Loading items...</td>
                      </tr>
                    ) : allInventoryStocks.length > 0 ? (
                      <>
                        {allInventoryStocks.map((item, index) => (
                          <React.Fragment key={index}>
                            {/* Item row */}
                            <tr className="bg-gray-100 border-b">
                              <td className="py-3 px-4 font-semibold text-gray-900 text-sm" colSpan={5}>
                                {item.item_id} - {item.item_name}
                              </td>
                            </tr>

                            {/* Store details header for this item */}
                            <tr className="bg-blue-50 border-y">
                              <td className="py-2 px-4"></td>
                              <td className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Store Name</td>
                              <td className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Quantity</td>
                              <td className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Unit Price</td>
                              <td className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Total Value</td>
                            </tr>

                            {/* Store rows */}
                            {item.stores.map((store, sIndex) => (
                              <tr key={sIndex} className="border-b">
                                <td className="py-2 px-4"></td>
                                <td className="py-2 px-4 text-gray-900 text-sm">{store.store_name}</td>
                                <td className="py-2 px-4 text-right text-gray-900 text-sm">{store.quantity}</td>
                                <td className="py-2 px-4 text-right text-gray-900 text-sm">
                                  {formatCurrency(store.unit_price)}
                                </td>
                                <td className="py-2 px-4 text-right text-gray-900 text-sm font-semibold">
                                  {formatCurrency((store.quantity * store.unit_price))}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}

                        {/* Totals Row */}
                        <tr className="bg-blue-100 font-semibold border-t-2">
                          <td className="py-3 px-4 text-right" colSpan={2}>
                            Grand Total
                          </td>
                          <td className="py-3 px-4 text-right">{totalStockQty}</td>
                          <td></td>
                          <td className="py-3 px-4 text-right">{formatCurrency(totalStockValue)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 px-4 text-center text-gray-600">
                          No data available for this report
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Additional Details */}
              <div className="mb-8 print:mb-6">
                <h3 className="text-gray-800 font-semibold mb-2 text-sm">Additional Details</h3>
                <div className="grid grid-cols-1 gap-8">
                  <div>
                    <p className="text-gray-600 text-sm"><strong>Remarks:</strong> ${reportConfigs['stock']?.remarks || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-12 border-t pt-8">
                <div className="text-center text-gray-500 text-xs">
                  <p>{reportConfigs['stock']?.report_footer || `Generated on ${formatDate(new Date())} by GarageInventory Management System`}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Other Report Types (Stock, Supplier, etc.)
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="min-h-[29.7cm] p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-8 border-b pb-6">
                <div>
                  <h1 className="text-2xl font-bold text-blue-600">{companyData?.name}</h1>
                  <p className="text-gray-600 mt-1 text-sm">{companyData?.description}</p>
                  <p className="text-gray-600 text-sm">{companyData?.address}</p>
                  <p className="text-gray-600 text-sm">{companyData?.city}, {companyData?.state}, {companyData?.country}, {companyData?.postal_code}</p>
                  <p className="text-gray-600 text-sm">Phone: {companyData?.phone}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-blue-800">
                    {reportData[selectedReportType as keyof typeof reportData]?.title || 'Report'}
                  </h2>
                  <p className="text-gray-600 mt-1 text-sm">Generated: {formatDate(new Date())}</p>
                  <p className="text-gray-600 text-sm">
                    {dateRange && dateRange[0] && dateRange[1]
                      ? `${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}`
                      : 'All Time'}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-50 border-y">
                      {(reportData[selectedReportType as keyof typeof reportData]?.headers || []).map((header: string, index: number) => (
                        <th key={index} className="py-2 px-4 text-left text-blue-800 font-medium text-sm">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.length > 0 ? (
                      data.map((item: any, index: number) => (
                        <tr key={index} className="border-b">
                          {selectedReportType === 'supplier' && (
                            <>
                              <td className="py-3 px-4 text-gray-800 text-sm">{item.id}</td>
                              <td className="py-3 px-4 text-gray-800 text-sm">{item.name}</td>
                              <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.totalOrders}</td>
                              <td className="py-3 px-4 text-right text-gray-800 text-sm">{formatCurrency(item.totalValue)}</td>
                              <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.onTimeDelivery}%</td>
                              <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.rating}</td>
                              <td className="py-3 px-4 text-gray-800 text-sm">{formatDate(item.lastOrder)}</td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={(reportData[selectedReportType as keyof typeof reportData]?.headers || []).length} className="py-8 px-4 text-center text-gray-600">
                          No data available for this report
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-12 border-t pt-8">
                <div className="text-center text-gray-500 text-xs">
                  <p>Generated on {formatDate(new Date())} by GarageInventory Management System</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintPreview;
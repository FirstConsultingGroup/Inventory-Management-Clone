// store/slices/printSlice.ts
import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store';
import { ISalesInvoice } from '@/Utils/constants';

// Types for print data
export type SalesStatus = 'Completed' | 'Pending' | 'Cancelled' | 'Processing' | 'Refunded';
export type ReportType = 'sales' | 'stock' | 'purchase-order';

export type SalesReportItem = ISalesInvoice

export interface StockReportItem {
  id: string;
  item_id: string;
  item_name: string;
  store_name: string;
  total_quantity: number;
  unit_price: number;
  total_count: number;
}

export interface PurchaseOrder {
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

export interface SalesReport {
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

export interface StockReport {
  title: string;
  headers: readonly [
    'Item ID',
    'Item Name',
    'Store Name',
    'Item Quantity',
    'Unit Price',
    'Total Value',
  ];
  data: StockReportItem[];
}

export interface PurchaseOrderReport {
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

export interface ReportConfig {
  payment_details?: string;
  remarks?: string;
  report_footer?: string;
}

export interface ReportData {
  'sales': SalesReport;
  'stock': StockReport;
  'purchase-order': PurchaseOrderReport;
}

export interface PrintState {
  reportData: ReportData | null;
  selectedReportType: ReportType | '';
  dateRange: [Date | null, Date | null];
  lastUpdated: string | null;
  statusMessages: { [key: string]: string };
  reportConfigs: {
    'purchase-order': ReportConfig;
    'sales': ReportConfig;
    'stock': ReportConfig;
  };
}

const initialState: PrintState = {
  reportData: null,
  selectedReportType: '',
  dateRange: [null, null],
  lastUpdated: null,
  statusMessages: {},
  reportConfigs: {
    'purchase-order': {},
    'sales': {},
    'stock': {},
  },
};

const printSlice = createSlice({
  name: 'print',
  initialState,
  reducers: {
    setPrintData: (
      state,
      action: PayloadAction<{
        reportData: ReportData;
        selectedReportType: ReportType;
        dateRange: [Date | null, Date | null];
        statusMessages: { [key: string]: string };
      }>
    ) => {
      state.reportData = action.payload.reportData as any;
      state.selectedReportType = action.payload.selectedReportType;
      state.dateRange = action.payload.dateRange;
      state.statusMessages = action.payload.statusMessages;
      state.lastUpdated = new Date().toISOString();
    },
    clearPrintData: (state) => {
      state.reportData = null;
      state.selectedReportType = '';
      state.dateRange = [null, null];
      state.lastUpdated = null;
      state.statusMessages = {};
    },
    updateStatusMessages: (state, action: PayloadAction<{ [key: string]: string }>) => {
      state.statusMessages = action.payload;
    },
    setReportConfigs: (state, action: PayloadAction<{
      'purchase-order': ReportConfig;
      'sales': ReportConfig;
      'stock': ReportConfig;
    }>) => {
      state.reportConfigs = action.payload;
    },
  },
});

export const { setPrintData, clearPrintData, updateStatusMessages, setReportConfigs } = printSlice.actions;
export default printSlice.reducer;

// Memoized Selectors
const selectPrintState = (state: RootState) => state.print;

export const selectPrintData = createSelector(selectPrintState, (print) => print.reportData);
export const selectSelectedReportType = createSelector(selectPrintState, (print) => print.selectedReportType);
export const selectDateRange = createSelector(selectPrintState, (print) => print.dateRange);
export const selectStatusMessages = createSelector(selectPrintState, (print) => print.statusMessages);
export const selectLastUpdated = createSelector(selectPrintState, (print) => print.lastUpdated);
export const selectReportConfigs = createSelector(selectPrintState, (print) => print.reportConfigs);
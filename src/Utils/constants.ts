import { Database } from "./types/database.types";

type IRole = Database["public"]["Tables"]["role_master"]["Row"];
type IUser = Database["public"]["Tables"]["user_mgmt"]["Row"];
type IStore = Database["public"]["Tables"]["store_mgmt"]["Row"];
type ITemsConfig = Database["public"]["Tables"]["item_configurator"]["Row"];
type ICollection = Database["public"]["Tables"]["collection_master"]["Row"];
type ICompany = Database["public"]["Tables"]["company_master"]["Row"];
type IUnit = Database["public"]["Tables"]["units_master"]["Row"];
type ItemManagement = Database["public"]["Tables"]["item_mgmt"]["Row"];
type ISupplierManagement = Database["public"]["Tables"]["supplier_mgmt"]["Row"];
type ISupplierItems = Database["public"]["Tables"]["supplier_items"]["Row"];
type ICategoryMaster = Database["public"]["Tables"]["category_master"]["Row"];
type IPurchaseOrder = Database["public"]["Tables"]["purchase_order"]["Row"];
type IInventory = Database["public"]["Tables"]["inventory_mgmt"]["Row"];
type IPurchaseOrderItems = Database["public"]["Tables"]["purchase_order_items"]["Row"];
type IWorkflowConfig = Database["public"]["Tables"]["workflow_config"]["Row"];
type ISystemMessageConfig = Database["public"]["Tables"]["system_message_config"]["Row"];
type IStoreStockLevels = Database["public"]["Tables"]["store_stock_levels"]["Row"];
type IInventoryTransfer = Database["public"]["Tables"]["inventory_transfer"]["Row"];
type ISalesInvoice = Database["public"]["Tables"]["sales_invoice"]["Row"];
type ISalesInvoiceItems = Database["public"]["Tables"]["sales_invoice_items"]["Row"];
type IPurchaseReturn = Database["public"]["Tables"]["purchase_return"]["Row"];
type IPurchaseReturnItems = Database["public"]["Tables"]["purchase_return_items"]["Row"];
type ITaxMaster = Database["public"]["Tables"]["tax_master"]["Row"];
type IPurchaseRequisition = Database["public"]["Tables"]["purchase_req_master"]["Row"];
type IPurchaseReqItems = Database["public"]["Tables"]["purchase_req_details"]["Row"];

interface INotificationMessage {
  id: string;
  time: number;
  event: string;
  topic: string;
  message: string;
  title?: string;
  priority?: number;
  tags?: string[];
  click?: string;
  attachment?: {
    name: string;
    type: string;
    size: number;
    expires: number;
    url: string;
  };
}

// Company Administration Types
interface ISystemSettings {
  id?: string;
  company_id?: string;
  email_url: string;
  email_token: string;
  created_at?: string;
  modified_at?: string;
}

interface IReportConfig {
  id?: string;
  company_id?: string;
  report_type: string;
  payment_details?: string;
  remarks?: string;
  report_footer?: string;
  created_at?: string;
  modified_at?: string;
}

export type {
  IRole, IUser, IStore, ITemsConfig, ICollection, ICompany, IUnit, ItemManagement, ISupplierManagement, ISupplierItems,
  ICategoryMaster, IPurchaseOrder, IInventory, IPurchaseOrderItems, IWorkflowConfig, ISystemMessageConfig, IStoreStockLevels,
  IInventoryTransfer, ISalesInvoice, ISalesInvoiceItems, IPurchaseReturn, IPurchaseReturnItems, ISystemSettings, IReportConfig,
  INotificationMessage, ITaxMaster, IPurchaseRequisition, IPurchaseReqItems
};
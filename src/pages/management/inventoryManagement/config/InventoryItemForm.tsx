import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Package,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  X,
  ExternalLink,
  Clock,
  Building,
  User,
  FileText,
  Loader2,
  Send,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ICategoryMaster, IInventory, IInventoryTransfer, IPurchaseOrder, IStore, ISupplierManagement, ISystemMessageConfig, ItemManagement, IUser } from '@/Utils/constants';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/Utils/types/supabaseClient';
import { formatCurrency } from '@/Utils/formatters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { loadModulePermissions, initiateApprovalRequest } from '@/Utils/commonFun';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ItemRequestsModal from '../Modal/ItemRequestsModal';

interface TransferForm {
  sourceStore: string;
  destinationStore: string;
  quantity: string;
  destinationInvLoc: string;
  sourceInvLoc: string;
  notes: string;
}

type FormattedPurchaseOrder = IPurchaseOrder & {
  supplierData: ISupplierManagement;
  statusData: ISystemMessageConfig;
  storeData: IStore;
};

type FormattedItemMgmt = ItemManagement & {
  category: ICategoryMaster | null;
}


interface InvLocs {
  id: string;
  shelf_id: string | null;
  cabinet_id: string | null;
  shelf: any,
  cabinet: any,
}

type StockLvlData = IInventory & {
  item_data: ItemManagement;
  store_data: IStore;
  po_data: IPurchaseOrder;
  inv_loc_data: InvLocs | null;
}

type FormattedTransferHistory = IInventoryTransfer & {
  origin_store: IStore;
  destination_store: IStore;
  transfer_by: IUser | null;
  company_id: string | null;
  origin_location: any | null;
  destination_location: any | null;
}

type SortFieldPO = 'po_number' | 'order_date' | 'ordered_qty' | 'received_qty';
type SortDirectionPO = 'asc' | 'desc' | null;
type SortFieldTH = 'timestamp' | 'quantity';
type SortDirectionTH = 'asc' | 'desc' | null;

interface SortConfigPO {
  field: SortFieldPO | null;
  direction: SortDirectionPO;
}

interface SortConfigTH {
  field: SortFieldTH | null;
  direction: SortDirectionTH;
}

const InventoryItemForm: React.FC = () => {
  const { id } = useParams();
  const user = localStorage.getItem("userData");
  const userData = JSON.parse(user || '{}');
  const companyId = userData?.company_id || null;
  const navigate = useNavigate();
  const [stockLevelsExpanded, setStockLevelsExpanded] = useState(true);
  const [purchaseOrdersExpanded, setPurchaseOrdersExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'purchase-orders' | 'transfer-history'>('purchase-orders');
  const [transferPanelOpen, setTransferPanelOpen] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<IInventory | null>();
  const [isTransferring, _setIsTransferring] = useState(false);
  const [itemData, setItemData] = useState<FormattedItemMgmt | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [purchaseOrders, setPurchaseOrders] = useState<FormattedPurchaseOrder[]>([])
  const [stockLevelData, setStockLevelData] = useState<StockLvlData[]>([]);
  const [allStores, setAllStores] = useState<IStore[]>([])
  const [transferHistory, setTransferHistory] = useState<FormattedTransferHistory[]>([])
  const [currentPagePO, setCurrentPagePO] = useState<number>(1);
  const [itemsPerPagePO, setItemsPerPagePO] = useState<number>(5);
  const [totalItemsPO, setTotalItemsPO] = useState<number>(0);
  const totalPagesPO = Math.ceil(totalItemsPO / itemsPerPagePO);
  const [sortConfigPO, setSortConfigPO] = useState<SortConfigPO>({
    field: null,
    direction: null,
  });
  const [currentPageTH, setCurrentPageTH] = useState<number>(1);
  const [itemsPerPageTH, setItemsPerPageTH] = useState<number>(5);
  const [totalItemsTH, setTotalItemsTH] = useState<number>(0);
  const totalPagesTH = Math.ceil(totalItemsTH / itemsPerPageTH);
  const [sortConfigTH, setSortConfigTH] = useState<SortConfigTH>({
    field: 'timestamp',
    direction: 'desc',
  });
  const [itemRequestsModalOpen, setItemRequestsModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [currentPageSLD, setCurrentPageSLD] = useState<number>(1);
  const [itemsPerPageSLD, setItemsPerPageSLD] = useState<number>(5);
  const [totalItemsSLD, setTotalItemsSLD] = useState<number>(0);
  const totalPagesSLD = Math.ceil(totalItemsSLD / itemsPerPageSLD);
   const [modulePermissions, setModulePermissions] = useState<any[]>([]);
      const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';
  // const [sortConfigSLD, setSortConfigSLD] = useState<SortConfigTH>({
  //   field: 'timestamp',
  //   direction: 'desc',
  // });

  const statusStyles: Record<ISystemMessageConfig['sub_category_id'], string> = {
    ORDER_CREATED: 'bg-gray-100 text-gray-800 border-gray-300',
    APPROVER_COMPLETED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    ORDER_RECEIVED: 'bg-green-100 text-green-800 border-green-300',
    APPROVAL_PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ORDER_CANCELLED: 'bg-red-100 text-red-800 border-red-300',
    ORDER_PARTIALLY_RECEIVED: 'bg-lime-100 text-lime-800 border-lime-300',
    ORDER_ISSUED: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const [transferForm, setTransferForm] = useState<TransferForm>({
    sourceStore: '',
    destinationStore: '',
    quantity: '',
    destinationInvLoc: '',
    sourceInvLoc: '',
    notes: '',
  });

  const [invLocations, setInvLocations] = useState<InvLocs[]>([])

  // const [stockLevels, setStockLevels] = useState<StockLevel[]>(initialStockLevels);

  useEffect(() => {
    if (id) {
      const fetchItemData = async () => {
        setIsLoading(true)
        try {
          const { data: itemdata, error: itemError } = await supabase
            .from('item_mgmt')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .single();

          if (itemError) throw itemError;

          if (!itemdata) throw new Error("Item not found");

          let categoryData = null;

          if (itemdata.category_id) {
            const { data, error: categoryErr } = await supabase
              .from('category_master')
              .select('*')
              .eq('id', itemdata.category_id)
              .single();

            if (categoryErr) {
              console.error("Failed to fetch category:", categoryErr.message);
            } else {
              categoryData = data;
            }
          }
          setItemData({
            ...itemdata,
            category: categoryData,
          });
          setIsLoading(false)
        } catch (error) {
          console.error("Fetching item data error:", error);
        }
      };
      fetchItemData();
    }
  }, [id])

  useEffect(() => {
    if (!id) return;

    const fetchPurchaseOrders = async () => {
      try {
        const { data: purchaseItems, error: purchaseItemsErr } = await supabase
          .from('purchase_order_items')
          .select('*')
          .eq('company_id', companyId)
          .eq('item_id', id);

        if (purchaseItemsErr) throw purchaseItemsErr;
        if (!purchaseItems?.length) return;

        const purchaseOrderIds = purchaseItems.map(item => item.purchase_order_id);

        let query = supabase
          .from("purchase_order")
          .select(`
            id,
            po_number,
            order_date,
            order_status,
            total_items,
            total_value,
            received_qty,
            is_active,
            supplier_mgmt(*),
            system_message_config(*),
            store_mgmt(*)
          `, { count: 'exact' })
          .eq('company_id', companyId)
          .in('id', purchaseOrderIds)
          .eq('is_active', true)

        if (sortConfigPO.field && sortConfigPO.direction) {
          const fieldMap: { [key in SortFieldPO]: string } = {
            po_number: 'po_number',
            order_date: 'order_date',
            ordered_qty: 'total_items',
            received_qty: 'received_qty',
          };
          query = query.order(fieldMap[sortConfigPO.field], { ascending: sortConfigPO.direction === 'asc' });
        }

        // Pagination (server-side)
        const from = (currentPagePO - 1) * itemsPerPagePO;
        const to = from + itemsPerPagePO - 1;
        query = query.range(from, to);

        const { data: purchaseOrderData, error: purchaseOrdersErr, count } = await query;

        if (purchaseOrdersErr) throw purchaseOrdersErr;

        if (purchaseOrderData.length > 0) {
          const formattedOrders: FormattedPurchaseOrder[] = (purchaseOrderData || []).map((order: any) => {
            const { supplier_mgmt, system_message_config, store_mgmt, ...rest } = order;
            return {
              ...rest,
              supplierData: supplier_mgmt ?? 'Unknown',
              statusData: system_message_config ?? 'Unknown',
              storeData: store_mgmt,
            };
          });

          setTotalItemsPO(count || 0);
          setPurchaseOrders(formattedOrders);
          setPurchaseOrdersExpanded(true)
        }
      } catch (error) {
        console.error("Fetching purchase orders error:", error);
      }
    };

    fetchPurchaseOrders();
  }, [id, currentPagePO, itemsPerPagePO, sortConfigPO]);

  const fetchStockLevelData = async () => {
    if (!id) return;

    try {
      let query = supabase
        .from("inventory_mgmt")
        .select(`
          *,
          item_data:item_mgmt(*),
          store_data:store_mgmt(*),
          po_data:purchase_order(*),
          inv_loc_data:inventory_loc_mgmt (
            id,
            shelf_id,
            cabinet_id,
            shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey(id, short_name),
            cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey(id, short_name)
          )
        `, { count: 'exact' })
        .eq("company_id", companyId)
        .eq("item_id", id)
        .gt("item_qty", 0);


      // Pagination (server-side)
      const from = (currentPageSLD - 1) * itemsPerPageSLD;
      const to = from + itemsPerPageSLD - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      console.log(data)

      if (data && data.length > 0) {
        const cleanedData = data.filter(
          (d): d is typeof d & {
            item_data: ItemManagement;
            store_data: IStore;
            po_data: IPurchaseOrder;
            inv_loc_data: InvLocs;
          } => d.item_data !== null && d.store_data !== null && d.po_data !== null
        );

        setTotalItemsSLD(count || 0);
        setStockLevelData(cleanedData);
      }
    } catch (error) {
      console.error("Fetching inventory data error:", error);
    }
  };

  useEffect(() => {
    fetchStockLevelData();
  }, [id, currentPageSLD, itemsPerPageSLD]);

  const fetchPendingCount = async () => {
    if (!id) return;
    try {
      const { data, error, count } = await (supabase as any)
        .from('inv_transfer_requests')
        .select('id', { count: 'exact' })
        .eq('item_id', id)
        .eq('status', 'Pending')
        .eq('company_id', companyId);

      if (error) throw error;

      setPendingCount(typeof count === 'number' ? count : (data?.length || 0));
    } catch (err) {
      console.error('Failed to fetch pending transfer requests count:', err);
    }
  };

  useEffect(() => {
    fetchPendingCount();
  }, [id, itemRequestsModalOpen]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from('store_mgmt')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)

        if (error) throw error;

        if (data.length > 0) {
          setAllStores(data);
        }

      } catch (error) {
        console.error("Fetching inventory data error:", error);
      }
    }
    fetchStores();
  }, [])

  const fetchTransferData = async () => {
    if (!id) return;

    try {
      let query = supabase
        .from('inventory_transfer')
        .select(`
            id,
            orgin_store_id,
            destination_store_id,
            item_id,
            transfer_qty,
            transfer_date,
            created_at,
            created_by,
            company_id,
            notes,
            origin_inv_loc,
            destination_inv_loc,
            origin_store:store_mgmt!inventory_transfer_orgin_store_id_fkey(*),
            destination_store:store_mgmt!inventory_transfer_destination_store_id_fkey(*),
            transfer_by:user_mgmt(*),
            origin_location:inventory_loc_mgmt!inventory_transfer_origin_inv_loc_fkey (
              id,
              shelf_id,
              cabinet_id,
              shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey (id, short_name),
              cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey (id, short_name)
            ),
            destination_location:inventory_loc_mgmt!inventory_transfer_destination_inv_loc_fkey (
              id,
              shelf_id,
              cabinet_id,
              shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey (id, short_name),
              cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey (id, short_name)
            )
          `, { count: 'exact' })
        .eq('company_id', companyId)
        .eq('item_id', id);

      if (sortConfigTH.field && sortConfigTH.direction) {
        const fieldMap: { [key in SortFieldTH]: string } = {
          timestamp: 'transfer_date',
          quantity: 'transfer_qty',
        };
        query = query.order(fieldMap[sortConfigTH.field], { ascending: sortConfigTH.direction === 'asc' });
      }

      const from = (currentPageTH - 1) * itemsPerPageTH;
      const to = from + itemsPerPageTH - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setTotalItemsTH(count || 0);
        setTransferHistory(data);
      }
      // Refresh pending count after fetching transfer data
      await fetchPendingCount();
    } catch (error) {
      console.error("Fetching inventory transfer data error:", error);
    }
  }

  useEffect(() => {
    fetchTransferData();
  }, [id, currentPageTH, itemsPerPageTH, sortConfigTH])

  useEffect(() => {
    if (transferForm.destinationStore === '' || !companyId) return;

    const fetchInventoryLocations = async () => {
      try {
        const { data: invLocData, error: invLocErr } = await supabase
          .from('inventory_loc_mgmt')
          .select(`
            id,
            shelf_id,
            cabinet_id,
            shelf:inventory_loc_master!inventory_loc_mgmt_shelf_id_fkey(id, short_name),
            cabinet:inventory_loc_master!inventory_loc_mgmt_cabinet_id_fkey(id, short_name)
          `)
          .eq('company_id', companyId)
          .eq('store_Id', transferForm.destinationStore);

        if (invLocErr) throw invLocErr;

        setInvLocations(invLocData)
      } catch (error) {
        console.error("Fetching inventory locations data error:", error);
      }
    }

    fetchInventoryLocations();
  }, [transferForm.destinationStore, companyId])

  const handleSortPO = (field: SortFieldPO) => {
    let direction: SortDirectionPO = 'asc';
    if (sortConfigPO.field === field) {
      if (sortConfigPO.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfigPO.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }
    setSortConfigPO({ field: direction ? field : null, direction });
    setCurrentPagePO(1);
  };

  const handleSortTH = (field: SortFieldTH) => {
    let direction: SortDirectionTH = 'asc';
    if (sortConfigTH.field === field) {
      if (sortConfigTH.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfigTH.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }
    setSortConfigTH({ field: direction ? field : null, direction });
    setCurrentPageTH(1);
  };

  const getSortIconPO = (field: SortFieldPO) => {
    if (sortConfigPO.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfigPO.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    if (sortConfigPO.direction === 'desc') {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const getSortIconTH = (field: SortFieldTH) => {
    if (sortConfigTH.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfigTH.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    if (sortConfigTH.direction === 'desc') {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
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

  const handleTransferClick = (stock: StockLvlData) => {
    setTransferPanelOpen(stock.id);
    setTransferForm({
      sourceStore: stock.store_data.id,
      sourceInvLoc: stock.link_loc ? stock.link_loc : '',
      destinationStore: '',
      quantity: '',
      destinationInvLoc: '',
      notes: '',
    });
    setSelectedStock(stock)
  };

  console.log("selectedStock =>", selectedStock);
  console.log("transferForm =>", transferForm);


  const handleTransferSubmit = async (poId: string) => {
    if (!id) return;

    try {
      if (!transferForm.destinationStore || !transferForm.quantity) {
        toast.error('Please fill in all required fields');
        return;
      }

      const quantity = parseInt(transferForm.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Transfer quantity must be a positive number');
        return;
      }

      const sourceStore = stockLevelData.find((s) => (s.store_data.id === transferForm.sourceStore && s.purchase_order_id === poId));
      if (!sourceStore || sourceStore.item_qty === null || sourceStore.item_qty < quantity) {
        toast.error('Insufficient stock in source store');
        return;
      }

      const destinationStore = allStores.find((store) => store.id === transferForm.destinationStore);
      const now = new Date().toISOString();

      const operations = [{
        type: 'rpc',
        rpc_name: 'process_inventory_transfer',
        rpc_args: {
            p_company_id: companyId,
            p_item_id: id,
            p_source_store_id: transferForm.sourceStore,
            p_destination_store_id: transferForm.destinationStore,
            p_source_inv_loc: transferForm.sourceInvLoc || null,
            p_destination_inv_loc: transferForm.destinationInvLoc || null,
            p_quantity: quantity,
            p_po_id: selectedStock?.purchase_order_id || null,
            p_unit_price: selectedStock?.unit_price || 0,
            p_selling_price: selectedStock?.selling_price || 0,
            p_notes: transferForm.notes || null,
            p_action_by: userData.id
        }
      }];

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Inventory Management',
        action_name: 'Transfer Stock',
        company_id: companyId,
        requested_by: userData?.id,
        store_id: transferForm.destinationStore,
        action_payload: { operations }
      });

      if (approvalResponse?.success && approvalResponse.requires_approval) {
          toast.success('Your transfer request has been submitted and is currently pending approval.');
          setTransferForm({
            sourceStore: '',
            destinationStore: '',
            quantity: '',
            destinationInvLoc: '',
            sourceInvLoc: '',
            notes: '',
          });
          setTransferPanelOpen(null);
          setSelectedStock(null);
          return;
      } else if (approvalResponse && !approvalResponse.success) {
          toast.error(approvalResponse.message);
          return;
      }

      // Fallback: If no approval required, call the RPC directly
      const { error: rpcError } = await (supabase as any).rpc('process_inventory_transfer', operations[0].rpc_args);

      if (rpcError) throw rpcError;

      toast.success(`Transfer successful: ${quantity} items moved from ${sourceStore?.store_data?.name} to ${destinationStore?.name}.`);
      setTransferForm({
        sourceStore: '',
        destinationStore: '',
        quantity: '',
        destinationInvLoc: '',
        sourceInvLoc: '',
        notes: '',
      });
      setTransferPanelOpen(null);
      setSelectedStock(null);
      fetchStockLevelData();
      fetchTransferData();
    } catch (error) {
      console.error("Confirm transfer stock error:", error);
      toast.error('Failed to confirm transfer stock');
    }
  };

  function formatDateTime(input: string): string {
    const date = new Date(input);

    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // handle 0 => 12
    const formattedHours = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
  }

   useEffect(() => {
        const fetchPermissions = async () => {
          if (userData?.user_id) {
            const res = await loadModulePermissions(
              appCode,
              'Inventory Management',
              userData.user_id
            );
    
            if (res && res.permissions) {
              setModulePermissions(res.permissions);
              console.log("Response of permission",res.permissions)
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Item</h1>
              <p className="text-gray-600">View and manage inventory across all stores</p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Item Overview
            </CardTitle>
            <CardDescription className="text-blue-600">
              Item metadata and current information
            </CardDescription>
          </CardHeader>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Item ID</Label>
                  <div className="p-2 bg-gray-50 rounded-lg border">
                    <span className="font-mono text-sm text-gray-800">{itemData?.item_id}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Name</Label>
                  <div className="p-2 bg-gray-50 rounded-lg border">
                    <span className="text-sm text-gray-800">{itemData?.item_name}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Category</Label>
                  <div className="p-2 bg-gray-50 rounded-lg border">
                    <span className="text-sm text-gray-800">{itemData?.category?.name ?? '—'}</span>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium text-gray-500">Description</Label>
                  <div className="p-2 bg-gray-50 rounded-lg border">
                    <span className="text-sm text-gray-800">{itemData?.description}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Selling Price</Label>
                  <div className="p-2 bg-gray-50 rounded-lg border">
                    <span className="text-sm text-gray-800 font-semibold">{formatCurrency(Number(itemData?.selling_price))}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex items-center justify-end">
          <span className="relative inline-flex">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setItemRequestsModalOpen(true)}
            >
              Transfer Requests
            </Button>

            <span
              className="
                  absolute
                  -top-2
                  -right-2
                  min-w-[18px]
                  h-[18px]
                  px-1
                  flex
                  items-center
                  justify-center
                  rounded-full
                  text-[10px]
                  font-bold
                  leading-none
                  shadow-md
                  bg-red-500
                  text-white
                "
            >
              {pendingCount}
            </span>
          </span>
        </div>
        <ItemRequestsModal
          open={itemRequestsModalOpen}
          onOpenChange={setItemRequestsModalOpen}
          itemId={id || ''}
          fetchTransferData={fetchTransferData}
        />

        <Card className="border-none shadow-lg">
          <CardHeader
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Stock Levels
              </CardTitle>
              {stockLevelsExpanded ? (
                <ChevronUp
                  onClick={() => setStockLevelsExpanded(!stockLevelsExpanded)}
                  className="h-5 w-5 text-blue-600 cursor-pointer" />
              ) : (
                <ChevronDown
                  onClick={() => setStockLevelsExpanded(!stockLevelsExpanded)}
                  className="h-5 w-5 text-blue-600 cursor-pointer" />
              )}
            </div>
            <CardDescription className="text-blue-600">
              Store-wise inventory levels and transfer management
            </CardDescription>
          </CardHeader>
          {stockLevelsExpanded && (
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="border-b border-gray-200">
                      <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Store Name</TableHead>
                      <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Inventory Location</TableHead>
                      <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Location</TableHead>
                      <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Available Quantity</TableHead>
                      <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLevelData.length > 0 ?
                      (stockLevelData.map((stock) => (
                        <React.Fragment key={stock.id}>
                          <TableRow className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                            <TableCell className="py-4 px-4">
                              <div>
                                <div className="font-medium text-gray-900">{stock.store_data.name}</div>
                                <div className="text-xs text-gray-700">PO#: {stock.po_data.po_number}</div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4 text-sm">
                              {stock?.inv_loc_data?.shelf?.short_name && stock?.inv_loc_data?.cabinet?.short_name
                                ? <Badge variant="outline">{stock.inv_loc_data.shelf.short_name} — {stock.inv_loc_data.cabinet.short_name}</Badge>
                                : "—"}
                            </TableCell>
                            <TableCell className="py-4 px-4 text-sm">
                              {stock.store_data.city}, {stock.store_data.state}, {stock.store_data.country}
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <span
                                className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
                              >
                                {stock.item_qty} units
                              </span>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                             <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleTransferClick(stock)}
        disabled={!hasPermission("Transfer stock")}
        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 border-blue-200"
      >
        <ArrowRightLeft className="h-4 w-4 mr-2" />
        Transfer Stock
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {!hasPermission("Transfer stock")
      ? "You don't have permission to transfer stock"
      : "Transfer stock between stores"}
  </TooltipContent>
</Tooltip>
                            </TableCell>
                          </TableRow>
                          {transferPanelOpen === stock.id && (
                            <TableRow>
                              <TableCell colSpan={4} className="px-0 py-0">
                                <Card className="border-l-4 border-blue-400 p-6 mx-4 mb-4 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                                      <ArrowRightLeft className="h-5 w-5" />
                                      Transfer Stock
                                    </h3>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setTransferPanelOpen(null);
                                        setSelectedStock(null);
                                      }}
                                      className="text-gray-500 hover:text-gray-700 rounded-full"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-700">Source Store</Label>
                                      <Input
                                        value={allStores.find((s) => s.id === transferForm.sourceStore)?.name || ''}
                                        readOnly
                                        className="bg-gray-100 border-gray-300"
                                      />
                                    </div>
                                    {stock?.inv_loc_data?.shelf?.short_name && stock?.inv_loc_data?.cabinet?.short_name && (
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium text-gray-700">Source Inventory Location</Label>
                                        <Input
                                          value={`${stock.inv_loc_data?.shelf.short_name} — ${stock.inv_loc_data?.cabinet.short_name}`}
                                          readOnly
                                          className="bg-gray-100 border-gray-300"
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-700">Destination Store <span className='text-red-500'>*</span></Label>
                                      <Select
                                        value={transferForm.destinationStore}
                                        onValueChange={(value) =>
                                          setTransferForm((prev) => ({ ...prev, destinationStore: value }))
                                        }
                                      >
                                        <SelectTrigger className="border-gray-300 focus:border-blue-500 sm:w-full">
                                          <SelectValue placeholder="Select destination store" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allStores
                                            .filter((s) => s.id !== transferForm.sourceStore)
                                            .map((store) => (
                                              <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-700">Destination Inventory Location</Label>
                                      <Select
                                        value={transferForm.destinationInvLoc}
                                        disabled={!transferForm.destinationStore}
                                        onValueChange={(value) =>
                                          setTransferForm((prev) => ({ ...prev, destinationInvLoc: value }))
                                        }
                                      >
                                        <SelectTrigger className="border-gray-300 focus:border-blue-500 sm:w-full">
                                          <SelectValue placeholder="Select inventory location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {invLocations
                                            .map((loc) => (
                                              <SelectItem key={loc.id} value={loc.id}>
                                                {loc.shelf.short_name} — {loc.cabinet.short_name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-700">Transfer Quantity <span className='text-red-500'>*</span></Label>
                                      <Input
                                        type="number"
                                        placeholder="Enter quantity"
                                        value={transferForm.quantity}
                                        onChange={(e) =>
                                          setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))
                                        }
                                        className="border-gray-300 focus:border-blue-500"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                                      <Textarea
                                        placeholder="Add transfer notes..."
                                        value={transferForm.notes}
                                        onChange={(e) =>
                                          setTransferForm((prev) => ({ ...prev, notes: e.target.value }))
                                        }
                                        className="border-gray-300 focus:border-blue-500"
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-3 mt-3">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setTransferPanelOpen(null);
                                        setSelectedStock(null);
                                      }}
                                      disabled={isTransferring}
                                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => handleTransferSubmit(stock?.purchase_order_id ?? '')}
                                      disabled={isTransferring}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      {isTransferring ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Transferring...
                                        </>
                                      ) : (
                                        <>
                                          <Send className="h-4 w-4 mr-2" />
                                          Confirm Transfer
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </Card>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-24 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center py-6">
                              <Package className="h-8 w-8 text-gray-300 mb-2" />
                              <p className="text-sm font-medium">
                                This item is currently out of stock in all stores
                              </p>
                              <p className="text-xs text-gray-500">
                                Initiate a stock transfer to make this item available
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
                <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Show</p>
                    <Select
                      value={itemsPerPageSLD.toString()}
                      onValueChange={(value: string) => {
                        setItemsPerPageSLD(Number(value));
                        setCurrentPageSLD(1);
                      }}
                    >
                      <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={itemsPerPageSLD.toString()} />
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
                      Showing {stockLevelData.length > 0 ? (currentPageSLD - 1) * itemsPerPageSLD + 1 : 0} to{' '}
                      {Math.min(currentPageSLD * itemsPerPageSLD, totalItemsSLD)} of {totalItemsSLD} entries
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageSLD((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPageSLD === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                        Page {currentPageSLD} of {totalPagesSLD || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageSLD((prev) => Math.min(prev + 1, totalPagesSLD))}
                        disabled={currentPageSLD === totalPagesSLD || totalPagesSLD === 0}
                        aria-label="Next page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader
            className="cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setPurchaseOrdersExpanded(!purchaseOrdersExpanded)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-blue-800 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Purchase Orders & Transfer History
              </CardTitle>
              {purchaseOrdersExpanded ? (
                <ChevronUp className="h-5 w-5 text-blue-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <CardDescription className="text-blue-600">
              View purchase orders and transfer history for this item
            </CardDescription>
          </CardHeader>
          {purchaseOrdersExpanded && (
            <CardContent className="p-6">
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTab('purchase-orders')}
                  className={`px-4 py-2 font-medium text-sm transition-colors duration-200 border-b-2 ${activeTab === 'purchase-orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Purchase Orders
                </button>
                <button
                  onClick={() => setActiveTab('transfer-history')}
                  className={`px-4 py-2 font-medium text-sm transition-colors duration-200 border-b-2 ${activeTab === 'transfer-history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Transfer History
                </button>
              </div>

              {activeTab === 'purchase-orders' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-b border-gray-200">
                        <TableHead>
                          <p
                            onClick={() => handleSortPO('po_number')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 font-medium text-gray-700 hover:text-blue-600"
                          >
                            PO Number {getSortIconPO('po_number')}
                          </p>
                        </TableHead>
                        <TableHead>
                          <p
                            onClick={() => handleSortPO('order_date')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 font-medium text-gray-700 hover:text-blue-600"
                          >
                            Order Date {getSortIconPO('order_date')}
                          </p>
                        </TableHead>
                        <TableHead className="text-left py-3 px-2 font-medium text-gray-700">Supplier</TableHead>
                        <TableHead>
                          <p
                            onClick={() => handleSortPO('ordered_qty')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 font-medium text-gray-700 hover:text-blue-600"
                          >
                            Ordered Qty {getSortIconPO('ordered_qty')}
                          </p>
                        </TableHead>
                        <TableHead>
                          <p
                            onClick={() => handleSortPO('received_qty')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 font-medium text-gray-700 hover:text-blue-600"
                          >
                            Received Qty {getSortIconPO('received_qty')}
                          </p>
                        </TableHead>
                        <TableHead className="py-3 text-center font-medium text-gray-700">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.length > 0 ? (
                        purchaseOrders.map((po) => (
                          <TableRow key={po.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                            <TableCell className="py-4 px-2">
                              <button
                                onClick={() => navigate(`/dashboard/purchaseOrderView/${po.id}`)}
                                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              >
                                {po.po_number}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </TableCell>
                            <TableCell className="py-4 px-2 text-gray-700">{formatDate(po.order_date)}</TableCell>
                            <TableCell className="py-4 px-2">{po.supplierData.supplier_name}</TableCell>
                            <TableCell className="py-4 px-2 text-center text-gray-900">{po.total_items}</TableCell>
                            <TableCell className="py-4 px-2 text-center text-gray-900">{po.received_qty || '-'}</TableCell>
                            <TableCell className="py-4 px-2 text-center">
                              <Badge
                                variant="outline"
                                className={`font-medium capitalize ${statusStyles[po.statusData.sub_category_id]}`}
                              >
                                {po.statusData.sub_category_id
                                  .replace(/_/g, ' ')
                                  .toLowerCase()
                                  .replace(/\b\w/g, c => c.toUpperCase())}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-24 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center py-6">
                              <Package className="h-8 w-8 text-gray-300 mb-2" />
                              <p className="text-sm font-medium">
                                No purchase orders available
                              </p>
                              <p className="text-xs text-gray-500">
                                Create a new purchase order to get started
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Show</p>
                      <Select
                        value={itemsPerPagePO.toString()}
                        onValueChange={(value: string) => {
                          setItemsPerPagePO(Number(value));
                          setCurrentPagePO(1);
                        }}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder={itemsPerPagePO.toString()} />
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
                        Showing {purchaseOrders.length > 0 ? (currentPagePO - 1) * itemsPerPagePO + 1 : 0} to{' '}
                        {Math.min(currentPagePO * itemsPerPagePO, totalItemsPO)} of {totalItemsPO} entries
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPagePO((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPagePO === 1}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                          Page {currentPagePO} of {totalPagesPO || 1}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPagePO((prev) => Math.min(prev + 1, totalPagesPO))}
                          disabled={currentPagePO === totalPagesPO || totalPagesPO === 0}
                          aria-label="Next page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'transfer-history' && (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-b border-gray-200">
                        <TableHead>
                          <p
                            onClick={() => handleSortTH('timestamp')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 px-2 font-medium text-gray-700 hover:text-blue-600"
                          >
                            Timestamp {getSortIconTH('timestamp')}
                          </p>
                        </TableHead>
                        <TableHead className="text-left py-3 px-4 font-medium text-gray-700">From</TableHead>
                        <TableHead className="text-left py-3 px-4 font-medium text-gray-700">To</TableHead>
                        <TableHead>
                          <p
                            onClick={() => handleSortTH('quantity')}
                            className="flex items-center gap-1 cursor-pointer text-left py-3 px-2 font-medium text-gray-700 hover:text-blue-600"
                          >
                            Qty {getSortIconTH('quantity')}
                          </p>
                        </TableHead>
                        <TableHead className="text-left py-3 px-4 font-medium text-gray-700">User</TableHead>
                        <TableHead className="text-left py-3 px-4 font-medium text-gray-700">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferHistory.length > 0 ? (
                        transferHistory.map((transfer) => (
                          <TableRow key={transfer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                            <TableCell className="py-4 px-4 text-gray-700 flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {formatDateTime(transfer.transfer_date)}
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <div>
                                <div className="text-sm text-gray-900 font-semibold">{transfer.origin_store.name}</div>
                                <div className="text-xs text-gray-500">
                                  {transfer?.origin_location?.shelf?.short_name && transfer?.origin_location?.cabinet?.short_name
                                    ? `${transfer?.origin_location?.shelf?.short_name} — ${transfer?.origin_location?.cabinet?.short_name}`
                                    : '—'}
                                </div>
                              </div>
                              <span></span>
                            </TableCell>
                            <TableCell className="py-4 px-4">
                              <div>
                                <div className="text-sm text-gray-900 font-semibold">{transfer.destination_store.name}</div>
                                <div className="text-xs text-gray-500">
                                  {transfer?.destination_location?.shelf?.short_name && transfer?.destination_location?.cabinet?.short_name
                                    ? `${transfer?.destination_location?.shelf?.short_name} — ${transfer?.destination_location?.cabinet?.short_name}`
                                    : '—'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-4">{transfer.transfer_qty}</TableCell>
                            <TableCell className="py-4 px-4 text-gray-700 flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              {transfer.transfer_by?.first_name} {transfer.transfer_by?.last_name}
                            </TableCell>
                            <TableCell className="py-4 px-4 text-gray-700">{transfer.notes || '-'}</TableCell>
                          </TableRow>
                        ))) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-24 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center py-6">
                              <History className="h-8 w-8 text-gray-300 mb-2" />
                              <p className="text-sm font-medium">
                                No stock transfers recorded
                              </p>
                              <p className="text-xs text-gray-500">
                                Create a stock transfer to begin tracking movement
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Show</p>
                      <Select
                        value={itemsPerPageTH.toString()}
                        onValueChange={(value: string) => {
                          setItemsPerPageTH(Number(value));
                          setCurrentPageTH(1);
                        }}
                      >
                        <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder={itemsPerPageTH.toString()} />
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
                        Showing {transferHistory.length > 0 ? (currentPageTH - 1) * itemsPerPageTH + 1 : 0} to{' '}
                        {Math.min(currentPageTH * itemsPerPageTH, totalItemsTH)} of {totalItemsTH} entries
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageTH((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPageTH === 1}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                          Page {currentPageTH} of {totalPagesTH || 1}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageTH((prev) => Math.min(prev + 1, totalPagesTH))}
                          disabled={currentPageTH === totalPagesTH || totalPagesTH === 0}
                          aria-label="Next page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default InventoryItemForm;
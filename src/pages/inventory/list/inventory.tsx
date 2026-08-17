import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  Filter,
  Download,
  Eye,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from 'react-hot-toast';
import { supabase } from '@/Utils/types/supabaseClient';
import { IUser, ItemManagement, ICategoryMaster } from '@/Utils/constants';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { formatCurrency } from '@/Utils/formatters';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';

interface PaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

type SortOrder = 'asc' | 'desc' | null;
interface SortConfig {
  field: string | null;
  order: SortOrder;
}

// Extended inventory interface that includes the category information
interface ExtendedItems extends ItemManagement {
  category: {
    id: string | null;
    category_name: string;
  };
  available_stock: number; // Add available stock field
}

export const Inventory = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem("userData");
  const userData: IUser | null = user ? JSON.parse(user) : null;
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'item_name', order: 'asc' });
  const [inventory, setInventory] = useState<ExtendedItems[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 0,
    total: 0,
    itemsPerPage: 10
  });
  const [loading, setLoading] = useState(true);
  const [itemNameFilter, setItemNameFilter] = useState("all");
  const [_error, setError] = useState<string | null>(null);
  const [itemNames, setItemNames] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemManagement | null>(null);
  const [categories, setCategories] = useState<ICategoryMaster[]>([])
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [linkedItemIds, setLinkedItemIds] = useState<string[]>([]);

  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    const fetchPermissions = async () => {
        if (userData?.id) {
            const res = await loadModulePermissions(
                appCode,
                'Item Master',
                userData.id
            );

            console.log("Permissions Response:", res);

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

  const fetchInventory = useCallback(async (page?: number) => {
    if (!userData) return;

    const targetPage = page ?? currentPage;
    setLoading(true);
    setError(null);

    try {

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('category_master')
        .select('*')
        .eq('company_id', userData.company_id)

      if (categoriesError) {
        console.error("Roles fetch error:", categoriesError);
        throw categoriesError;
      }

      // Create a category lookup map with proper typing
      const categoryMap: Record<string, string> = {};
      categoriesData?.forEach((category: ICategoryMaster) => {
        categoryMap[category.id] = category.name || 'Unnamed Category';
      });

      const companyId = userData?.company_id;
      if (!companyId) {
        // Handle the case where companyId is undefined
        console.error('Company ID is not defined');
        return;
      }

      let query = supabase
        .from('item_mgmt')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .eq('company_id', companyId)
        .eq('is_temporary', false);

      if (searchQuery.trim()) {
        query = query.or(`item_name.ilike.%${searchQuery.trim()}%,item_id.ilike.%${searchQuery.trim()}%`);
      }

      if (itemNameFilter !== 'all') {
        query = query.eq('item_name', itemNameFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter)
      }

      // Apply backend sorting
      if (sortConfig.field && sortConfig.order) {
        query = query.order(sortConfig.field, { ascending: sortConfig.order === 'asc' });
      }

      const from = (targetPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error: supabaseError, count } = await query;

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      // Fetch available stock quantities from inventory_mgmt table
      const itemIds = (data || []).map((item: ItemManagement) => item.id);

      let stockQuantities: Record<string, number> = {};
      if (itemIds.length > 0) {
        try {
          const { data: stockData, error: stockError } = await supabase
            .from('inventory_mgmt')
            .select('item_id, item_qty')
            .eq('company_id', companyId)
            .in('item_id', itemIds);

          if (stockError) {
            console.error('Error fetching stock quantities:', stockError);
            // Continue without stock data rather than failing completely
          } else {
            // Aggregate quantities by item_id
            stockData?.forEach((stock: any) => {
              const itemId = stock.item_id;
              const quantity = stock.item_qty || 0;
              stockQuantities[itemId] = (stockQuantities[itemId] || 0) + quantity;
            });
          }
        } catch (stockErr) {
          console.error('Error in stock quantities fetch:', stockErr);
          // Continue without stock data rather than failing completely
        }
      }

      const mappedItems: ExtendedItems[] = (data || []).map((item: ItemManagement) => ({
        ...item,
        category: {
          id: item.category_id,
          category_name: item.category_id ? (categoryMap[item.category_id] || 'No category') : 'No category'
        },
        available_stock: stockQuantities[item.id] || 0
      }));

      setInventory(mappedItems || []);

      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      setPagination({
        currentPage: targetPage,
        totalPages,
        total: totalItems,
        itemsPerPage
      });

    } catch (err) {
      console.error('Error fetching item configs:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
      setInventory([]);
      setPagination(prev => ({ ...prev, currentPage: targetPage, totalPages: 0, total: 0 }));
      toast.error('Failed to fetch item configurations');
    } finally {
      setLoading(false);
    }
  }, [userData, itemsPerPage, searchQuery, itemNameFilter, sortConfig, categoryFilter]);

  const exportItemsToCSV = async () => {
    const user = JSON.parse(localStorage.getItem('userData') || '{}');

    await exportSupabaseTableToCSV<ExtendedItems>({
      reportTitle: 'Items Data',
      headers: ['Item ID', 'Item Name', 'Category', 'Selling Price', 'Available Stock'],
      rowMapper: (item: ExtendedItems) => [
        `"${item.item_id}"`,
        `"${item.item_name}"`,
        `"${item.category.category_name}"`,
        `"${item.selling_price}"`,
        `"${item.available_stock}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('item_mgmt')
          .select(`*,
            category:category_master!item_mgmt_category_id_fkey(name)`)
          .eq('is_active', true)
          .eq('company_id', user?.company_id || '')
          .eq('is_temporary',false)

        if (searchQuery) {
          const sanitizedQuery = searchQuery.replace(/[%_]/g, '');
          const searchConditions = [
            `item_name.ilike.%${sanitizedQuery.trim()}%`,
            `item_id.ilike.%${sanitizedQuery.trim()}%`
          ];
          query = query.or(searchConditions.join(','));
        }

        if (itemNameFilter !== 'all') {
          query = query.eq('item_name', itemNameFilter);
        }

        if (categoryFilter !== 'all') {
          query = query.eq('category_id', categoryFilter)
        }

        if (sortConfig.field && sortConfig.order) {
          query = query.order(sortConfig.field, { ascending: sortConfig.order === 'asc' });
        }

        const { data, error } = await query;
        if (error) throw error;

        // Fetch stock quantities for export
        const itemIds = (data || []).map((item: any) => item.id);
        let stockQuantities: Record<string, number> = {};

        if (itemIds.length > 0) {
          try {
            const { data: stockData, error: stockError } = await supabase
              .from('inventory_mgmt')
              .select('item_id, item_qty')
              .eq('company_id', user?.company_id || '')
              .in('item_id', itemIds);

            if (!stockError && stockData) {
              stockData.forEach((stock: any) => {
                const itemId = stock.item_id;
                const quantity = stock.item_qty || 0;
                stockQuantities[itemId] = (stockQuantities[itemId] || 0) + quantity;
              });
            }
          } catch (stockErr) {
            console.error('Error in stock quantities fetch for export:', stockErr);
            // Continue without stock data rather than failing completely
          }
        }

        // Map the data to include available stock
        return (data || []).map((item: any) => ({
          ...item,
          category: {
            id: item.category_id,
            category_name: item.category?.name || 'No category'
          },
          available_stock: stockQuantities[item.id] || 0
        })) as ExtendedItems[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export items: ${err.message}`),
    });
  };

  useEffect(() => {
    if (!userData?.company_id) return;

    const fetchItemNames = async () => {
      try {
        const { data: itemNamesData, error: itemsError } = await supabase
          .from("item_mgmt")
          .select('item_name')
          .eq('company_id', userData?.company_id)
          .eq('is_active', true)
          .eq('is_temporary', false);

        if (itemsError) throw itemsError;

        const itemNames = itemNamesData.map((item: any) => item.item_name);
        setItemNames(['all', ...itemNames]);
      } catch (error: any) {
        console.error('Error fetching data:', error.message);
        setError('Failed to fetch data');
      }
    }
    fetchItemNames()
  }, [])

  // Fetch dynamic currency symbol from Supabase company settings
  useEffect(() => {
    const fetchCurrency = async () => {
      try {
        if (!userData?.company_id) return;
        const { data, error } = await supabase
          .from('company_master')
          .select('currency')
          .eq('id', userData.company_id)
          .single();
        if (error) return; // keep default
        if (data?.currency) setCurrencySymbol(data.currency);
      } catch {
        // ignore and keep default
      }
    };
    fetchCurrency();
  }, [])

  useEffect(() => {
    if (!userData?.company_id) return;
    // Fetch all categories for the filter dropdown
    const fetchCategories = async (): Promise<void> => {
      try {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('category_master')
          .select('*')
          .eq('company_id', userData?.company_id)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (categoriesError) {
          console.error("Roles fetch error:", categoriesError);
          throw categoriesError;
        }

        setCategories(categoriesData || []);
      } catch (error: any) {
        console.error("Fetch categories Error =>", error.message || error);
        toast.error("Failed to fetch categories: " + (error.message || "Unknown error"));
      }
    };

    fetchCategories();
  }, [])

  useEffect(() => {
    fetchInventory();
  }, [itemsPerPage, searchQuery, itemNameFilter, sortConfig, categoryFilter]);

  useEffect(() => {
    if (currentPage !== pagination.currentPage) {
      fetchInventory(currentPage);
    }
  }, [currentPage]);

  useEffect(() => {
    const fetchLinkedItems = async () => {
      try {
        if (!inventory || inventory.length === 0) return;

        const itemIds = inventory.map((item) => item.id);

        // Fetch all supplier items that match the IDs
        const { data, error } = await supabase
          .from("supplier_items")
          .select("item_id")
          .eq('is_active', true)
          .in("item_id", itemIds);

        if (error) {
          console.error("Error fetching supplier links:", error.message);
          return;
        }

        const linkedIds = data.map((d) => d.item_id).filter((id): id is string => !!id);
        setLinkedItemIds(linkedIds);
      } catch (error: any) {
        console.error("Fetch linked item error =>", error.message || error);
      }
    };

    fetchLinkedItems();
  }, [inventory]);

  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        // Same field: cycle through asc -> desc -> null
        if (prev.order === 'asc') {
          return { field, order: 'desc' };
        } else if (prev.order === 'desc') {
          return { field: '', order: null };
        } else {
          return { field, order: 'asc' };
        }
      } else {
        // Different field: start with asc
        return { field, order: 'asc' };
      }
    });
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const getSortIcon = (field: string) => {
    if (sortConfig.field !== field || !sortConfig.order) {
      return <ArrowUpDown className="h-4 w-4 opacity-60 text-gray-400" />;
    }

    if (sortConfig.order === 'asc') {
      return <ArrowDown className="h-4 w-4 opacity-100 text-blue-600" />;
    } else {
      return <ArrowUp className="h-4 w-4 opacity-100 text-blue-600" />;
    }
  };

  const handleDeleteItem = async () => {
  if (!itemToDelete) return;

    const isLocked = await checkEntityLock(itemToDelete.id);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }

  const isLinkedToSupplier = linkedItemIds.includes(itemToDelete.id);

  if (isLinkedToSupplier) {
    toast.error(
      'This item is linked to a supplier and cannot be deleted.'
    );
    return;
  }

  try {
    if (!userData?.id) {
      throw new Error('User data not found. Please login again.');
    }

    if (!userData?.company_id) {
      throw new Error(
        'Company ID is not available. Please login again.'
      );
    }

    
    const payload = {
      is_active: false,
    };

    
    const systemLogs = {
      company_id: userData.company_id,
      transaction_date: new Date().toISOString(),
      module: 'Item Master',
      scope: 'Delete',
      key: itemToDelete.item_id,
      log: `Item ${itemToDelete.item_id} deleted.`,
      action_by: userData.id,
      created_at: new Date().toISOString(),
    };

    
    const action_payload = {
      operations: [
        {
          table: 'item_mgmt',
          type: 'update',
          data: payload,
          match: {
            id: itemToDelete.id,
            company_id: userData.company_id,
          },
        },
        {
          table: 'system_log',
          type: 'insert',
          data: systemLogs,
        },
      ],
    };

    
    const approvalResponse = await initiateApprovalRequest({
      module_name: 'Item Master',
      action_name: 'Delete',
      company_id: userData.company_id,
      requested_by: userData.id,
      action_payload,
      entity_id: itemToDelete.id,
    });

    if (!approvalResponse?.success) {
      throw new Error(
        approvalResponse?.message ||
          'Approval initiation failed'
      );
    }

    
    if (approvalResponse.requires_approval) {
      toast.success(
        'Your action has been submitted and is currently pending approval.',
        {
          position: 'top-center',
        }
      );

      setIsDialogOpen(false);
      setItemToDelete(null);

      return;
    }

    
    const { error: updateError } = await supabase
      .from('item_mgmt')
      .update(payload)
      .eq('id', itemToDelete.id)
      .eq('company_id', userData.company_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    
    const { error: systemLogError } = await supabase
      .from('system_log')
      .insert(systemLogs);

    if (systemLogError) {
      throw new Error(systemLogError.message);
    }

    toast.success('Item deleted successfully!', {
      position: 'top-center',
    });

    
    fetchInventory();

    
    setIsDialogOpen(false);
    setItemToDelete(null);

  } catch (error: any) {
    console.error('Error deleting item:', error);

    toast.error(
      `Failed to delete item: ${
        error?.message || 'Unknown error'
      }`,
      {
        position: 'top-center',
      }
    );

    setIsDialogOpen(false);
    setItemToDelete(null);
  }
};

  const openDeleteDialog = (item: ItemManagement) => {
    setItemToDelete(item);
    setIsDialogOpen(true);
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setItemNameFilter('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: 'item_name', order: 'asc' });
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
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Item Master
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage your inventory items, stock levels, and suppliers
                    </CardDescription>
                  </div>
                </div>
       <div className="flex gap-2">

  {/* Export CSV Button */}
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          variant="outline"
          onClick={exportItemsToCSV}
          className={`transition-colors me-2 ${
            !hasPermission('Export')
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
          disabled={inventory.length === 0 || !hasPermission('Export')}
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>
    </TooltipTrigger>

    {!hasPermission('Export') && (
      <TooltipContent>
        <p>You do not have export permission</p>
      </TooltipContent>
    )}
  </Tooltip>

  {/* Add Item Button */}
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          onClick={() => navigate('/dashboard/item-master/add')}
          className={`transition-colors ${
            !hasPermission('Add')
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
          }`}
          disabled={!hasPermission('Add')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
    </TooltipTrigger>

    {!hasPermission('Add') && (
      <TooltipContent>
        <p>You do not have add permission</p>
      </TooltipContent>
    )}
  </Tooltip>

</div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by item name or ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select
                      value={categoryFilter}
                      onValueChange={(value) => {
                        setCategoryFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name || 'Unnamed Category'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={itemNameFilter}
                      onValueChange={(value) => {
                        setItemNameFilter(value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by Item Names" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemNames.map((itemName) => (
                          <SelectItem key={itemName} value={itemName}>
                            {itemName === 'all' ? 'All Item Names' : itemName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="px-3 py-2 text-sm"
                    onClick={handleFilterReset}
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
                        <p
                          onClick={() => handleSort('item_id')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                        >
                          Item ID
                          {getSortIcon('item_id')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          onClick={() => handleSort('item_name')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        >
                          Item Name
                          {getSortIcon('item_name')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">Item Category</TableHead>
                      <TableHead className="font-semibold flex justify-end">
                        <p
                          onClick={() => handleSort('selling_price')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        >
                          Selling Price
                          {getSortIcon('selling_price')}
                        </p>
                      </TableHead>
                      <TableHead className="text-right font-semibold">Available Stock</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 min-w-[200px] w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 min-w-[220px] w-14 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell className="text-center"><div className="h-6 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : inventory?.length > 0 ? (
                      inventory?.map((item) => {
                        const isLinkedToSupplier = linkedItemIds.includes(item.id);
                        const disableDelete = item.available_stock > 0 || isLinkedToSupplier;

                        return (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium"><p className='ps-1'>{item.item_id}</p></TableCell>
                          <TableCell className="min-w-[180px] whitespace-normal break-words">{item.item_name}</TableCell>
                          <TableCell>{item.category.category_name}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.selling_price ?? 0, currencySymbol)}
                          </TableCell>
                          <TableCell className="text-right">{item.available_stock}</TableCell>
                 <TableCell className="text-right">
  <div className="flex justify-center gap-2">

    {/* View Button */}
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-block">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              hasPermission('View') &&
              navigate(`/dashboard/item-master/view/${item.id}`)
            }
            aria-label={`View item ${item.id}`}
            disabled={!hasPermission('View')}
            className={
              !hasPermission('View')
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TooltipTrigger>

      {!hasPermission('View') && (
        <TooltipContent>
          <p>You do not have view permission</p>
        </TooltipContent>
      )}
    </Tooltip>

    {/* Edit Button */}
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-block">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              hasPermission('Edit') &&
              navigate(`/dashboard/item-master/edit/${item.id}`)
            }
            disabled={!hasPermission('Edit')}
            className={
              !hasPermission('Edit')
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </TooltipTrigger>

      {!hasPermission('Edit') && (
        <TooltipContent>
          <p>You do not have edit permission</p>
        </TooltipContent>
      )}
    </Tooltip>

    {/* Delete Button */}
    {disableDelete || !hasPermission('Delete') ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block">
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
          {!hasPermission('Delete') ? (
            <p>You do not have delete permission</p>
          ) : item.available_stock > 0 ? (
            <p>Cannot delete items as available stock is greater than 0</p>
          ) : (
            <p>This item is linked to a supplier and cannot be deleted</p>
          )}
        </TooltipContent>
      </Tooltip>
    ) : (
      <Button
        variant="outline"
        size="icon"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => openDeleteDialog(item)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    )}

  </div>
</TableCell>
                        </TableRow>
                      )})
                    ) : (
                      <TableRow className="hover:bg-gray-50">
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center py-6">
                            <Package className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">No items found. Click 'Add Item' to create one.</p>
                            <p className="text-sm text-gray-500">Try adjusting your search or filter</p>
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

          {/* Confirmation Dialog for Delete */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>Are you sure you want to delete this item?</DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => setItemToDelete(null)}>
                    No
                  </Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDeleteItem}>
                  Yes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};
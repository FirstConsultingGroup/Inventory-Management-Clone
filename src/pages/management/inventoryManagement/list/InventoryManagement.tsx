import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Wrench, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/Utils/types/supabaseClient';
import { formatCurrency } from '@/Utils/formatters';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { loadModulePermissions } from '@/Utils/commonFun';


interface InventoryItem {
  id: string;
  item_uuid: string;
  item_id: string;
  item_name: string;
  item_category: string;
  description: string;
  selling_price: number;
  total_quantity: number;
  store_id: string;
  purchase_order_id: string;
  stock_date: string;
  expiry_date: string | null;
}

type SortField = 'item_id' | 'item_name' | 'item_category' | 'description' | 'selling_price' | 'total_quantity';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

const InventoryManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    direction: null,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const user = localStorage.getItem("userData");
  const userData = JSON.parse(user || '{}');
  const companyId = userData?.company_id || null;
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
    const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';
    const [pendingMap, setPendingMap] = useState<Record<string, number>>({});


 const fetchPendingCounts = useCallback(async () => {
  if (!companyId) return;

  const { data, error } = await supabase
    .from("inv_transfer_requests" as any)
    .select("item_id")
    .eq("status", "Pending")
    .eq("company_id", companyId);

  if (error) {
    console.error(error);
    return;
  }

  const map: Record<string, number> = {};

  (data || []).forEach((row: any) => {
    const key = row.item_id;
    if (key) {
      map[key] = (map[key] || 0) + 1;
    }
  });

  console.log("Pending counts map:", map);
  setPendingMap(map);
}, [companyId]);
useEffect(() => {
  fetchPendingCounts();
}, [fetchPendingCounts]);


  // Fetch inventory items using the RPC function
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_combined_inventory', {
        search_term: searchTerm.trim(),
        sort_field: sortConfig.field!,
        sort_direction: sortConfig.direction!,
        page_size: itemsPerPage,
        page_number: currentPage,
        company_id: companyId
      });

      if (error) throw error;

      console.log('RPC Response:', data); // Debug: Inspect RPC response

      if (data && data.length > 0) {
        // Map the RPC response to InventoryItem format
        const items: InventoryItem[] = data.map((item: any) => ({
          id: item.id,
          item_uuid: item.item_uuid,
          item_id: item.item_id || '',
          item_name: item.item_name || 'Unknown Item',
          item_category: item.item_category || 'Uncategorized',
          description: item.description || 'No description',
          selling_price: item.selling_price || 0,
          total_quantity: item.total_quantity || 0,
          store_id: item.store_id || '',
          purchase_order_id: item.purchase_order_id || '',
          stock_date: item.stock_date || '',
          expiry_date: item.expiry_date || null,
        }));

        setInventoryItems(items);
        // Total count is the same for all rows, so we can take it from the first row
        setTotalItems(data[0].total_count || 0);
      } else {
        setInventoryItems([]);
        setTotalItems(0);
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setError('Failed to fetch inventory items. Please try again.');
      setInventoryItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, sortConfig, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

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
    setCurrentPage(1); // Reset to first page when sorting changes
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  // Export inventory data
  const exportInventoryToCsv = async () => {
    await exportSupabaseTableToCSV<InventoryItem>({
      reportTitle: 'Inventory Data',
      headers: ['Item ID', 'Item Name', 'Item Category', 'Description', 'Selling Price', 'Total Quantity'],
      rowMapper: (item: InventoryItem) => [
        `"${item.item_id}"`,
        `"${item.item_name || ''}"`,
        `"${item.item_category || ''}"`,
        `"${item.description || ''}"`,
        `"${item.selling_price || 0}"`,
        `"${item.total_quantity || 0}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        const { data, error } = await supabase.rpc('get_combined_inventory', {
          search_term: searchTerm.trim(),
          sort_field: sortConfig.field!,
          sort_direction: sortConfig.direction!,
          page_size: -1,
          page_number: 1,
          company_id: companyId
        });
        if (error) throw error;
        return data || [];
      }
    });
  };

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
                      Inventory Management
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage your inventory items and their details
                    </CardDescription>
                  </div>
                </div>
               <Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        variant="outline"
        onClick={exportInventoryToCsv}
        className="transition-colors me-2"
        disabled={
          inventoryItems.length === 0 || !hasPermission("Export")
        }
      >
        <Download className="mr-2 h-4 w-4" />
        <span>Export CSV</span>
      </Button>
    </span>
  </TooltipTrigger>

  <TooltipContent>
    {!hasPermission("Export")
      ? "You don't have permission to export"
      : inventoryItems.length === 0
      ? "No inventory data available"
      : "Export inventory as CSV"}
  </TooltipContent>
</Tooltip>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by Item ID or Item Name..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg overflow-auto border shadow-sm">
                <Table aria-label="Inventory Table">
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold w-[100px]">
                        <button
                          type="button"
                          onClick={() => handleSort('item_id')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                          aria-label={`Sort by Item ID ${sortConfig.field === 'item_id' ? sortConfig.direction : 'asc'}`}
                        >
                          Item ID
                          {getSortIcon('item_id')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('item_name')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                          aria-label={`Sort by Item Name ${sortConfig.field === 'item_name' ? sortConfig.direction : 'asc'}`}
                        >
                          Item Name
                          {getSortIcon('item_name')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('item_category')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                          aria-label={`Sort by Item Category ${sortConfig.field === 'item_category' ? sortConfig.direction : 'asc'}`}
                        >
                          Item Category
                          {getSortIcon('item_category')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('description')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto ps-2 hover:text-blue-600"
                          aria-label={`Sort by Description ${sortConfig.field === 'description' ? sortConfig.direction : 'asc'}`}
                        >
                          Description
                          {getSortIcon('description')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('selling_price')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-end hover:text-blue-600"
                          aria-label={`Sort by Selling Price ${sortConfig.field === 'selling_price' ? sortConfig.direction : 'asc'}`}
                        >
                          Selling Price
                          {getSortIcon('selling_price')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('total_quantity')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-end hover:text-blue-600"
                          aria-label={`Sort by Total Quantity ${sortConfig.field === 'total_quantity' ? sortConfig.direction : 'asc'}`}
                        >
                          Total Quantity
                          {getSortIcon('total_quantity')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50">
                          <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                        </TableRow>
                      ))
                    ) : inventoryItems.length > 0 ? (
                      inventoryItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-[14px] py-3"><p className="ps-2">{item.item_id}</p></TableCell>
                          <TableCell className="text-[14px]"><p className="ps-2">{item.item_name}</p></TableCell>
                          <TableCell className="text-[14px]"><p className="ps-2">{item.item_category}</p></TableCell>
                          <TableCell className="text-[14px]"><p className="ps-2 max-w-xs truncate" title={item.description}>{item.description}</p></TableCell>
                          <TableCell className="text-right text-[14px]">{formatCurrency(item.selling_price)}</TableCell>
                          <TableCell className="text-right text-[14px]">{item.total_quantity}</TableCell>
    <TableCell className="text-center">
  <div className="flex justify-center items-center">
    {item.total_quantity > 0 ? (
      <Link
        to={`/dashboard/inventory/edit/${item.item_uuid}`}
        className="relative inline-block"
      >
        <Button
          variant="outline"
          size="icon"
          aria-label={`Edit inventory item ${item.item_id}`}
        >
          <Wrench className="h-4 w-4" />
        </Button>

        {(pendingMap[item.item_uuid] || 0) > 0 && (
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
              bg-red-500
              text-white
              text-[10px]
              font-bold
              leading-none
              shadow-md
            "
          >
            {pendingMap[item.item_uuid]}
          </span>
        )}
      </Link>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-block">
            <Button
              variant="outline"
              size="icon"
              disabled
              aria-label={`Cannot edit inventory item ${item.item_id} - out of stock`}
            >
              <Wrench className="h-4 w-4" />
            </Button>

            {(pendingMap[item.item_uuid] || 0) > 0 && (
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
                  bg-red-500
                  text-white
                  text-[10px]
                  font-bold
                  leading-none
                  shadow-md
                "
              >
                {pendingMap[item.item_uuid]}
              </span>
            )}
          </span>
        </TooltipTrigger>

        <TooltipContent>
          <p>Cannot edit item - Out of stock</p>
        </TooltipContent>
      </Tooltip>
    )}
  </div>
</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-gray-50">
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center py-6">
                            <Package className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">No inventory items found</p>
                            <p className="text-sm text-gray-500">Try adjusting your search</p>
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
                    onValueChange={handleItemsPerPageChange}
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
                    Showing {inventoryItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
                    {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || loading}
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
                      disabled={currentPage === totalPages || totalPages === 0 || loading}
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
        </div>
      </div>
    </TooltipProvider>
  );
};

export default InventoryManagement;
import { useEffect, useMemo, useState } from 'react';
import { Requisition } from './mockData';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FileCheck,
    Printer,
    CheckCircle,
    XCircle,
    MoreHorizontal,
    FilePlus,
    ShoppingCart,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/Utils/types/supabaseClient';
import generatePurchaseRequisitionPDF from '@/pages/PurchaseRequisitions/config/PurchaseReqPrintTemplate';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadModulePermissions } from '@/Utils/commonFun';

interface MainRequisitionsGridProps {
    data: Requisition[];
    onAction: (action: string, id: string) => void;
    onBulkAction: (action: string, selectedIds: string[]) => void;
    statusFilter: 'all' | 'completed' | 'rejected';
    onStatusFilterChange: (value: 'all' | 'completed' | 'rejected') => void;
}

type SortField = 'orderNumber' | 'date' | 'department' | 'store' | 'totalItems' | 'totalQtyInStores' | 'status';
type SortDirection = 'asc' | 'desc';

export function MainRequisitionsGrid({
    data,
    onAction,
    onBulkAction,
    statusFilter,
    onStatusFilterChange
}: MainRequisitionsGridProps) {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [totalQuantitiesInStores, setTotalQuantitiesInStores] = useState<Map<string, number>>(new Map());
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const sortedData = useMemo(() => {
        const sorted = [...data];
        sorted.sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sortField) {
                case 'orderNumber':
                    aValue = a.orderNumber ?? '';
                    bValue = b.orderNumber ?? '';
                    break;
                case 'date':
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
                    break;
                case 'department':
                    aValue = a.department ?? '';
                    bValue = b.department ?? '';
                    break;
                case 'store':
                    aValue = a.store ?? '';
                    bValue = b.store ?? '';
                    break;
                case 'totalItems':
                    aValue = a.totalItems ?? 0;
                    bValue = b.totalItems ?? 0;
                    break;
                case 'totalQtyInStores':
                    aValue = totalQuantitiesInStores.get(a.id) ?? 0;
                    bValue = totalQuantitiesInStores.get(b.id) ?? 0;
                    break;
                case 'status':
                    aValue = a.procurementStatus ?? a.status ?? '';
                    bValue = b.procurementStatus ?? b.status ?? '';
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }

            const compareResult = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' });
            return sortDirection === 'asc' ? compareResult : -compareResult;
        });

        return sorted;
    }, [data, sortDirection, sortField, totalQuantitiesInStores]);

    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [page, sortedData]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    useEffect(() => {
        setPage(1);
        setSelectedRows((prev) => new Set(Array.from(prev).filter((id) => data.some((item) => item.id === id))));
    }, [statusFilter, data]);

    // Fetch total quantities in stores for all requisitions
    useEffect(() => {
        const fetchTotalQuantities = async () => {
            if (data.length === 0) return;

            try {
                // Get logged-in user's company_id
                const userDataStr = localStorage.getItem('userData');
                if (!userDataStr) return;
                
                const userData = JSON.parse(userDataStr);
                const userCompanyId = userData?.company_id;
                
                if (!userCompanyId) return;

                const requisitionIds = data.map(req => req.id);
                
                // Fetch all items for these requisitions
                const { data: reqItems, error: reqItemsError } = await supabase
                    .from('purchase_req_details')
                    .select('purchase_req_id, item_id')
                    .in('purchase_req_id', requisitionIds);

                if (reqItemsError) throw reqItemsError;

                if (!reqItems || reqItems.length === 0) return;

                // Get unique item IDs
                const itemIds = [...new Set(reqItems.map(item => item.item_id))];

                // Fetch inventory quantities for these items from stores matching company_id
                const { data: inventoryData, error: inventoryError } = await supabase
                    .from('inventory_mgmt')
                    .select('item_id, item_qty, store_id, store_mgmt!inner(company_id)')
                    .in('item_id', itemIds)
                    .eq('store_mgmt.company_id', userCompanyId);

                if (inventoryError) throw inventoryError;

                // Calculate total quantity per item
                const itemTotalQtyMap = new Map<string, number>();
                
                if (inventoryData) {
                    inventoryData.forEach((inv: any) => {
                        const itemId = inv.item_id;
                        const qty = inv.item_qty || 0;
                        itemTotalQtyMap.set(itemId, (itemTotalQtyMap.get(itemId) || 0) + qty);
                    });
                }

                // Calculate total for each requisition
                const requisitionTotals = new Map<string, number>();
                
                reqItems.forEach(reqItem => {
                    const reqId = reqItem.purchase_req_id;
                    const itemId = reqItem.item_id;
                    const itemTotal = itemTotalQtyMap.get(itemId) || 0;
                    
                    requisitionTotals.set(reqId, (requisitionTotals.get(reqId) || 0) + itemTotal);
                });

                setTotalQuantitiesInStores(requisitionTotals);
            } catch (error) {
                console.error('Error fetching total quantities in stores:', error);
            }
        };

        fetchTotalQuantities();
    }, [data]);

    const toggleSelectAll = () => {
        const pageIds = paginatedData.map((item) => item.id);
        const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedRows.has(id));

        if (allPageSelected) {
            const next = new Set(selectedRows);
            pageIds.forEach((id) => next.delete(id));
            setSelectedRows(next);
        } else {
            const next = new Set(selectedRows);
            pageIds.forEach((id) => next.add(id));
            setSelectedRows(next);
        }
    };

    const getBadgeClasses = (procurementStatus?: string | null) => {
        if (procurementStatus === 'Completed') {
            return 'bg-green-50 text-green-700 border-green-200';
        }
        if (procurementStatus === 'Rejected') {
            return 'bg-red-50 text-red-700 border-red-200';
        }
        return 'bg-blue-50 text-blue-700 border-blue-200';
    };

    const getStatusLabel = (row: Requisition) => row.procurementStatus ?? row.status;

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortField(field);
        setSortDirection('asc');
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
            : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />;
    };

    const handleBulkAction = (action: string) => {
        onBulkAction(action, Array.from(selectedRows));
        setSelectedRows(new Set()); // clear selection after action
    };

    const allPageSelected = paginatedData.length > 0 && paginatedData.every((item) => selectedRows.has(item.id));
    const visibleFrom = data.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const visibleTo = Math.min(page * pageSize, data.length);

    const handlePreviousPage = () => {
        if (page > 1) {
            setPage(page - 1);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            setPage(page + 1);
        }
    };

    const isCompletionActionAvailable = statusFilter === 'all';

    const toggleSelectRow = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const handlePrint = async (id: string) => {
        try {
            console.log('Printing requisition with ID:', id);

            const { data: pr, error: prError } = await supabase
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

            if (prError) {
                console.error('Error fetching purchase requisition:', prError);
                return;
            }

            console.log('Purchase requisition data:', pr);

            const { data: items, error: itemsError } = await supabase
                .from("purchase_req_details")
                .select(`
                    req_qty,
                    item_mgmt:item_id (item_id, item_name)
                `)
                .eq("purchase_req_id", id);

            if (itemsError) {
                console.error('Error fetching requisition items:', itemsError);
                return;
            }

            console.log('Requisition items:', items);

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

            console.log('PDF generation completed');
        } catch (error) {
            console.error('Error in handlePrint:', error);
        }
    };
const [subModulePermissions, setSubModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Procurement Dashboard', userData.user_id);
        if (res && res.subModulePermissions) {
          setSubModulePermissions(res.subModulePermissions);
        }
      }
    };
    fetchPermissions();
  }, [appCode]);

  const hasSubModulePermission = (subModuleName: string) => {
    const perm = subModulePermissions.find((p: any) => p.sub_module_id?.subModuleName?.toLowerCase() === subModuleName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };
    return (
<>
{hasSubModulePermission('Purchase Requisitions - Sales')&&(
<Card className="">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className='space-y-1'>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-blue-500" />
                        Purchase Requisitions – Sales
                    </CardTitle>
                    <CardDescription>Approved sales-related requisitions pending action</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as 'all' | 'completed' | 'rejected')}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    {selectedRows.size > 0 && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Button size="sm" variant="secondary" onClick={() => handleBulkAction('create_quotation')}>
                                <FilePlus className="h-4 w-4 mr-2" />
                                Create Quotation ({selectedRows.size})
                            </Button>
                            <Button size="sm" className='bg-blue-600 hover:bg-blue-700 text-white' onClick={() => handleBulkAction('create_po')}>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Create PO ({selectedRows.size})
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={allPageSelected}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('orderNumber')}>
                                        Order #
                                        {getSortIcon('orderNumber')}
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('date')}>
                                        Date
                                        {getSortIcon('date')}
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('department')}>
                                        Department
                                        {getSortIcon('department')}
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('store')}>
                                        Store
                                        {getSortIcon('store')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('totalItems')}>
                                        Total Items
                                        {getSortIcon('totalItems')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('totalQtyInStores')}>
                                        Total Qty in Stores
                                        {getSortIcon('totalQtyInStores')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-center">
                                    <button type="button" className="mx-auto flex items-center justify-center gap-1.5 font-medium" onClick={() => toggleSort('status')}>
                                        Status
                                        {getSortIcon('status')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((row) => (
                                    <TableRow key={row.id} data-state={selectedRows.has(row.id) ? "selected" : undefined} className="hover:bg-blue-50/30 transition-colors">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedRows.has(row.id)}
                                                onCheckedChange={() => toggleSelectRow(row.id)}
                                                aria-label="Select row"
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-blue-600">{row.orderNumber}</TableCell>
                                        <TableCell>{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{row.department}</TableCell>
                                        <TableCell>{row.store}</TableCell>
                                        <TableCell className="text-right">{row.totalItems}</TableCell>
                                        <TableCell className="text-right">
                                            {totalQuantitiesInStores.get(row.id) ?? 0}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={getBadgeClasses(row.procurementStatus)}>
                                                {getStatusLabel(row)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                                                            <span className="sr-only">Open menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[180px]">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => onAction('view', row.id)}>
                                                            <FileCheck className="mr-2 h-4 w-4" /> View Requisition
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onAction('approvals', row.id)}>
                                                            <FileCheck className="mr-2 h-4 w-4" /> View Approvals
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePrint(row.id)}>
                                                            <Printer className="mr-2 h-4 w-4" /> Print
                                                        </DropdownMenuItem>
                                                        {isCompletionActionAvailable && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => onAction('complete', row.id)} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Complete
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => onAction('reject', row.id)} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                        Showing {visibleFrom}-{visibleTo} of {data.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={page === 1}>
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={page === totalPages}>
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
)}
</>
        
    );
}

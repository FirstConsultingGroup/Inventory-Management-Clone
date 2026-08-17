import { ReorderItem } from './mockData';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BellOff, Package, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/Utils/types/supabaseClient';
import { loadModulePermissions } from '@/Utils/commonFun';

interface ReorderItemsGridProps {
    data: ReorderItem[];
    onAction: (action: string, id: string, payload?: any) => Promise<void> | void;
}

type SortField = 'itemNumber' | 'itemName' | 'currentStock' | 'reorderLevel' | 'totalQtyInStores' | 'status';
type SortDirection = 'asc' | 'desc';

export function ReorderItemsGrid({ data, onAction }: ReorderItemsGridProps) {
    const [snoozeModalOpen, setSnoozeModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ReorderItem | null>(null);
    const [snoozeDate, setSnoozeDate] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [totalQuantitiesInStores, setTotalQuantitiesInStores] = useState<Map<string, number>>(new Map());
    const [sortField, setSortField] = useState<SortField>('itemName');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const handleSnoozeClick = (item: ReorderItem) => {
        setSelectedItem(item);
        // Default to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setSnoozeDate(tomorrow.toISOString().split('T')[0]);
        setSnoozeModalOpen(true);
    };

    // Fetch total quantities in stores for all reorder items
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

                // Get item IDs from the reorder items
                const itemIds = data.map(item => item.id);

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

                setTotalQuantitiesInStores(itemTotalQtyMap);
            } catch (error) {
                console.error('Error fetching total quantities in stores:', error);
            }
        };

        fetchTotalQuantities();
    }, [data]);

    const confirmSnooze = async () => {
        if (selectedItem && snoozeDate) {
            try {
                setIsSubmitting(true);
                await onAction('snooze', selectedItem.id, { date: snoozeDate });
                setSnoozeModalOpen(false);
                setSelectedItem(null);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const sortedData = useMemo(() => {
        const sorted = [...data];
        sorted.sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sortField) {
                case 'itemNumber':
                    aValue = a.itemNumber ?? '';
                    bValue = b.itemNumber ?? '';
                    break;
                case 'itemName':
                    aValue = a.itemName ?? '';
                    bValue = b.itemName ?? '';
                    break;
                case 'currentStock':
                    aValue = a.currentStock ?? 0;
                    bValue = b.currentStock ?? 0;
                    break;
                case 'reorderLevel':
                    aValue = a.reorderLevel ?? 0;
                    bValue = b.reorderLevel ?? 0;
                    break;
                case 'totalQtyInStores':
                    aValue = totalQuantitiesInStores.get(a.id) ?? 0;
                    bValue = totalQuantitiesInStores.get(b.id) ?? 0;
                    break;
                case 'status':
                    aValue = 'Low Stock';
                    bValue = 'Low Stock';
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
            ? <ArrowUp className="h-3.5 w-3.5 text-orange-600" />
            : <ArrowDown className="h-3.5 w-3.5 text-orange-600" />;
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
        {hasSubModulePermission('Purchase Requisitions - Reorder Items')&&(
<Card className="">
            <CardHeader>
                <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Purchase Requisitions – Reorder Items
                </CardTitle>
                <CardDescription>Items below reorder level requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('itemNumber')}>
                                        Item #
                                        {getSortIcon('itemNumber')}
                                    </button>
                                </TableHead>
                                <TableHead>
                                    <button type="button" className="flex items-center gap-1.5 font-medium" onClick={() => toggleSort('itemName')}>
                                        Item Name
                                        {getSortIcon('itemName')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('currentStock')}>
                                        In Stock
                                        {getSortIcon('currentStock')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('reorderLevel')}>
                                        Reorder Level
                                        {getSortIcon('reorderLevel')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('totalQtyInStores')}>
                                        Total Qty in Stores
                                        {getSortIcon('totalQtyInStores')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button type="button" className="ml-auto flex items-center justify-end gap-1.5 font-medium" onClick={() => toggleSort('status')}>
                                        Status
                                        {getSortIcon('status')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No reorder items pending.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedData.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-orange-50/30 transition-colors">
                                        <TableCell className="font-medium text-gray-600">{row.itemNumber}</TableCell>
                                        <TableCell>
                                            <a
                                                href={`/inventory/item/${row.itemNumber}`}
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onAction('view_item', row.id);
                                                }}
                                            >
                                                <Package className="h-4 w-4 text-gray-400" />
                                                {row.itemName}
                                            </a>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-red-600">{row.currentStock}</TableCell>
                                        <TableCell className="text-right text-gray-500">{row.reorderLevel}</TableCell>
                                        <TableCell className="text-right font-semibold text-blue-600">
                                            {totalQuantitiesInStores.get(row.id) ?? 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 shadow-none">
                                                Low Stock
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSnoozeClick(row)}
                                                className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                            >
                                                <BellOff className="mr-2 h-4 w-4" /> Snooze
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Snooze Dialog */}
            <Dialog open={snoozeModalOpen} onOpenChange={setSnoozeModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Snooze Reorder Alert</DialogTitle>
                        <DialogDescription>
                            Select a date to snooze this item alert. It will reappear after this date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="snooze-date" className="text-right">
                                Until
                            </Label>
                            <Input
                                id="snooze-date"
                                type="date"
                                className="col-span-3"
                                value={snoozeDate}
                                onChange={(e) => setSnoozeDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSnoozeModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={confirmSnooze} disabled={!snoozeDate || isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Confirm Snooze'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
        )}
        </>
        
    );
}

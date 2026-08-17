import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import { subMonths, isAfter, parseISO, isSameDay, isValid } from 'date-fns';

export interface ProcurementRequisition {
    id: string;
    orderNumber: string;
    date: string;
    totalItems: number;
    department: string;
    store: string;
    status: 'Approved' | 'Pending' | 'Rejected' | 'Completed';
    statusValue: string;
    type: 'Main' | 'Internal';
    category: string;
    categoryId: string;
    approverUser: string;
    createdBy: string;
    procurementStatus?: 'Completed' | 'Rejected' | null;
}

export interface ReorderItem {
    id: string;
    itemNumber: string;
    itemName: string;
    currentStock: number;
    reorderLevel: number;
    snoozeDate?: string | null;
    lastOperationAt?: string | null;
    isActive: boolean;
}

type DateFilter = '3m' | '1y' | 'all';
type RequisitionStatusFilter = 'all' | 'completed' | 'rejected';
type CategoryTypeFilter = 'all' | 'internal' | 'external';

export function useProcurement(categoryTypeFilter: CategoryTypeFilter = 'all') {
    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;
    const userId = userData?.id;
    const roleId = userData?.role_id || null;

    const [requisitions, setRequisitions] = useState<ProcurementRequisition[]>([]);
    const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState<DateFilter>('3m');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [mainStatusFilter, setMainStatusFilter] = useState<RequisitionStatusFilter>('all');
    const [internalStatusFilter, setInternalStatusFilter] = useState<RequisitionStatusFilter>('all');

    const getCompanyIdFromStorage = () => {
        try {
            const stored = localStorage.getItem('userData');
            if (!stored) return null;
            const parsed = JSON.parse(stored) as { company_id?: string | null };
            return parsed.company_id ?? null;
        } catch {
            return null;
        }
    };

    const resolvedCompanyId = companyId || getCompanyIdFromStorage();

    // Check if user is Super Admin
    useEffect(() => {
        if (!resolvedCompanyId || !roleId) return;

        const checkSuperAdmin = async () => {
            try {
                const { data, error } = await supabase
                    .from('role_master')
                    .select('id')
                    .eq('company_id', resolvedCompanyId)
                    .eq('name', 'Super Admin')
                    .eq('is_active', true)
                    .single();

                if (error) throw error;
                setIsSuperAdmin(roleId === data.id);
            } catch (err) {
                console.error('Error checking super admin status:', err);
            }
        };

        checkSuperAdmin();
    }, [resolvedCompanyId, roleId]);

    // Fetch Purchase Requisitions
    useEffect(() => {
        if (!resolvedCompanyId) return;

        const fetchRequisitions = async () => {
            try {
                setLoading(true);

                const { data: rawData, error } = await supabase.rpc(
                    'get_purchase_requisitions_for_listing',
                    {
                        p_company_id: resolvedCompanyId,
                        p_user_id: userId ?? '',
                        p_is_super_admin: isSuperAdmin,
                        p_status: null,
                        p_category_type: categoryTypeFilter,
                        p_search: null,
                        p_in_stock_page: 1, p_in_stock_limit: 999999,
                        p_out_stock_page: 1, p_out_stock_limit: 999999,
                        p_temp_page: 1, p_temp_limit: 999999,
                        p_closed_page: 1, p_closed_limit: 999999
                    } as any
                );

                if (error) throw error;

                const responseData = rawData as any;
                const data = responseData ? [
                    ...(responseData.inStock?.data || []),
                    ...(responseData.outOfStock?.data || []),
                    ...(responseData.temporaryItems?.data || []),
                    ...(responseData.closed?.data || [])
                ] : [];

                if (!Array.isArray(data) || data.length === 0) {
                    setRequisitions([]);
                    return;
                }

                const { data: departmentRows, error: departmentError } = await supabase
                    .from('department_master')
                    .select('id, department_name')
                    .eq('company_id', resolvedCompanyId)
                    .eq('status', true)
                    .eq('is_active', true);

                if (departmentError) throw departmentError;

                const departmentNameById = new Map<string, string>();
                (departmentRows ?? []).forEach((row: { id: string; department_name: string }) => {
                    departmentNameById.set(row.id, row.department_name);
                });

                const requisitionIds = data.map((req: any) => req.id).filter(Boolean);
                const procurementStatusById = new Map<string, 'Completed' | 'Rejected'>();

                if (requisitionIds.length > 0) {
                    const { data: procurementStatuses, error: procurementStatusError } = await supabase
                        .from('purchase_req_master')
                        .select('id, procurement_status')
                        .in('id', requisitionIds);

                    if (procurementStatusError) throw procurementStatusError;

                    (procurementStatuses ?? []).forEach((row: { id: string; procurement_status: string | null }) => {
                        const normalized = (row.procurement_status ?? '').toLowerCase();
                        if (normalized === 'completed') {
                            procurementStatusById.set(row.id, 'Completed');
                        } else if (normalized === 'rejected') {
                            procurementStatusById.set(row.id, 'Rejected');
                        }
                    });
                }

                const formatted: ProcurementRequisition[] = data.map((req: any) => {
                    const departmentData = (req.department ?? null) as
                        | { id?: string | null; department_name?: string | null; department_id?: string | null }
                        | null;
                    const resolvedDepartmentName = (
                        (departmentData?.id ? departmentNameById.get(departmentData.id) : undefined) ??
                        departmentData?.department_name ??
                        req.category ??
                        'General'
                    );

                    // Determine type based on category_type field (when using p_category_type parameter)
                    // or fallback to category field (when using p_category_id parameter)
                    const categoryType = req.category_type?.toLowerCase() || req.category?.toLowerCase() || '';
                    const type: 'Main' | 'Internal' = categoryType === 'internal' ? 'Internal' : 'Main';

                    // Map status values
                    let status: 'Approved' | 'Pending' | 'Rejected' | 'Completed' = 'Pending';
                    if (req.status_value === 'APPROVED') status = 'Approved';
                    else if (req.status_value === 'REJECTED') status = 'Rejected';
                    else if (req.status_value === 'CLOSED') status = 'Completed';
                    else if (req.status_value === 'NEW') status = 'Pending';

                    return {
                        id: req.id,
                        orderNumber: req.purchase_req_number,
                        date: req.purchase_req_date,
                        totalItems: req.total_items,
                        department: resolvedDepartmentName,
                        store: 'Main Store', // This field might need to be added to the database
                        status,
                        statusValue: req.status_value,
                        type,
                        category: req.category_type || req.category || '',
                        categoryId: '', // Not available in RPC response
                        approverUser: req.approver_user?.trim() || '',
                        createdBy: req.created_by || '',
                        procurementStatus: procurementStatusById.get(req.id) ?? null,
                    };
                });

                setRequisitions(formatted);
                
                // Debug logging
                console.log('Category Filter:', categoryTypeFilter);
                console.log('Total Requisitions:', formatted.length);
                console.log('Requisitions by type:', {
                    main: formatted.filter(r => r.type === 'Main').length,
                    internal: formatted.filter(r => r.type === 'Internal').length
                });
            } catch (err) {
                console.error('Error fetching requisitions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRequisitions();
    }, [resolvedCompanyId, userId, isSuperAdmin, categoryTypeFilter]);

    // Fetch Reorder Items (items below reorder level from inventory_mgmt)
    useEffect(() => {
        if (!resolvedCompanyId) return;

        const fetchReorderItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('inventory_mgmt')
                    .select(`
                        item_qty,
                        item_mgmt!inner(
                            id,
                            item_id,
                            item_name,
                            is_active,
                            reorder_level,
                            max_level
                        )
                    `)
                    .eq('company_id', resolvedCompanyId)
                    .eq('item_mgmt.is_active', true)
                    .eq('item_mgmt.company_id', resolvedCompanyId);

                if (error) throw error;

                if (!data) {
                    setReorderItems([]);
                    return;
                }

                // Group by item and calculate total stock
                const itemStockMap = new Map<string, {
                    itemNumber: string;
                    itemName: string;
                    totalStock: number;
                    reorderLevel: number;
                    lastOperationAt: string | null;
                }>();

                data.forEach((inv: any) => {
                    if (inv.item_mgmt) {
                        const itemId = inv.item_mgmt.id;
                        const existing = itemStockMap.get(itemId);

                        if (existing) {
                            existing.totalStock += inv.item_qty || 0;
                        } else {
                            itemStockMap.set(itemId, {
                                itemNumber: inv.item_mgmt.item_id,
                                itemName: inv.item_mgmt.item_name,
                                totalStock: inv.item_qty || 0,
                                reorderLevel: inv.item_mgmt.reorder_level || 0,
                                lastOperationAt: null,
                            });
                        }
                    }
                });

                const itemIds = Array.from(itemStockMap.keys());
                let snoozeMap = new Map<string, string>();

                if (itemIds.length > 0) {
                    const { data: operations, error: operationsError } = await (supabase as any)
                        .from('item_operations')
                        .select('item_id, snooze_until, created_at')
                        .eq('company_id', resolvedCompanyId)
                        .eq('is_active', true)
                        .in('item_id', itemIds)
                        .order('created_at', { ascending: false });

                    if (operationsError) throw operationsError;

                    const latestOperationMap = new Map<string, string>();

                    (operations as Array<{ item_id: string | null; snooze_until: string | null; created_at: string | null }> | null)?.forEach((op) => {
                        if (!op.item_id) return;

                        if (op.created_at && !latestOperationMap.has(op.item_id)) {
                            latestOperationMap.set(op.item_id, op.created_at);
                        }

                        if (!op.snooze_until) return;
                        const existing = snoozeMap.get(op.item_id);
                        if (!existing || new Date(op.snooze_until) > new Date(existing)) {
                            snoozeMap.set(op.item_id, op.snooze_until);
                        }
                    });

                    latestOperationMap.forEach((createdAt, itemId) => {
                        const item = itemStockMap.get(itemId);
                        if (item) {
                            item.lastOperationAt = createdAt;
                        }
                    });
                }

                // Filter items where total stock is below reorder level
                const lowStockItems: ReorderItem[] = Array.from(itemStockMap.entries())
                    .filter(([_, item]) => item.totalStock < item.reorderLevel)
                    .map(([id, item]) => ({
                        id,
                        itemNumber: item.itemNumber,
                        itemName: item.itemName,
                        currentStock: item.totalStock,
                        reorderLevel: item.reorderLevel,
                        snoozeDate: snoozeMap.get(id) || null,
                        lastOperationAt: item.lastOperationAt || null,
                        isActive: true,
                    }));

                setReorderItems(lowStockItems);
            } catch (err) {
                console.error('Error fetching reorder items:', err);
            }
        };

        fetchReorderItems();
    }, [resolvedCompanyId]);

    // Helper functions
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const matchesSearch = (values: Array<string | number | null | undefined>) => {
        if (!normalizedSearch) return true;
        return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
    };

    const checkDateFilter = (dateStr: string) => {
        if (dateFilter === 'all') return true;
        const date = parseISO(dateStr);
        if (!isValid(date)) return false;
        const now = new Date();
        if (dateFilter === '3m') return isAfter(date, subMonths(now, 3)) || isSameDay(date, subMonths(now, 3));
        if (dateFilter === '1y') return isAfter(date, subMonths(now, 12)) || isSameDay(date, subMonths(now, 12));
        return true;
    };

    const checkReorderDateFilter = (item: ReorderItem) => {
        if (dateFilter === 'all') return true;
        const referenceDate = item.snoozeDate || item.lastOperationAt;
        if (!referenceDate) return true;
        return checkDateFilter(referenceDate);
    };

    const shouldDisplayReorderItem = (item: ReorderItem) => {
        // If no snooze entry exists, always display.
        if (!item.snoozeDate) return true;

        // Display only when snooze date matches today's date.
        const snoozeDate = parseISO(item.snoozeDate);
        const today = new Date();
        return isSameDay(snoozeDate, today);
    };

    // Derived state - Main Requisitions
    const mainRequisitions = useMemo(() => {
        return requisitions
            .filter(r => {
                // When category filter is 'all', show only Main type
                // When category filter is 'external', show all (they're already filtered by backend)
                // When category filter is 'internal', this will be empty (correct behavior)
                if (categoryTypeFilter === 'all') {
                    return r.type === 'Main' && r.status === 'Approved';
                } else if (categoryTypeFilter === 'external') {
                    return r.status === 'Approved';
                } else {
                    return false; // Don't show anything in Main grid when internal filter is active
                }
            })
            .filter((r) => {
                if (mainStatusFilter === 'completed') return r.procurementStatus === 'Completed';
                if (mainStatusFilter === 'rejected') return r.procurementStatus === 'Rejected';
                return r.procurementStatus !== 'Completed' && r.procurementStatus !== 'Rejected';
            })
            .filter(r => checkDateFilter(r.date))
            .filter(r => matchesSearch([
                r.orderNumber,
                r.department,
                r.store,
                r.category,
                r.status,
                r.totalItems,
                r.createdBy,
                r.approverUser,
                r.procurementStatus,
            ]));
    }, [requisitions, dateFilter, searchQuery, mainStatusFilter, categoryTypeFilter]);

    // Derived state - Internal Requisitions
    const internalRequisitions = useMemo(() => {
        return requisitions
            .filter(r => {
                // When category filter is 'all', show only Internal type
                // When category filter is 'internal', show all (they're already filtered by backend)
                // When category filter is 'external', this will be empty (correct behavior)
                if (categoryTypeFilter === 'all') {
                    return r.type === 'Internal' && r.status === 'Approved';
                } else if (categoryTypeFilter === 'internal') {
                    return r.status === 'Approved';
                } else {
                    return false; // Don't show anything in Internal grid when external filter is active
                }
            })
            .filter((r) => {
                if (internalStatusFilter === 'completed') return r.procurementStatus === 'Completed';
                if (internalStatusFilter === 'rejected') return r.procurementStatus === 'Rejected';
                return r.procurementStatus !== 'Completed' && r.procurementStatus !== 'Rejected';
            })
            .filter(r => checkDateFilter(r.date))
            .filter(r => matchesSearch([
                r.orderNumber,
                r.department,
                r.store,
                r.category,
                r.status,
                r.totalItems,
                r.createdBy,
                r.approverUser,
                r.procurementStatus,
            ]));
    }, [requisitions, dateFilter, searchQuery, internalStatusFilter, categoryTypeFilter]);

    // Derived state - Active Reorder Items
    const activeReorderItems = useMemo(() => {
        return reorderItems
            .filter(i => i.isActive)
            .filter(i => i.currentStock < i.reorderLevel)
            .filter(shouldDisplayReorderItem)
            .filter(checkReorderDateFilter)
            .filter(i => matchesSearch([
                i.itemName,
                i.itemNumber,
                i.currentStock,
                i.reorderLevel,
            ]));
    }, [reorderItems, dateFilter, searchQuery]);

    // Update requisition status
    const updateRequisitionStatus = async (id: string, newStatus: 'Completed' | 'Rejected') => {
        try {
            const { error } = await supabase
                .from('purchase_req_master')
                .update({ procurement_status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            setRequisitions(prev => prev.map(r =>
                r.id === id ? { ...r, procurementStatus: newStatus } : r
            ));

            return { success: true };
        } catch (err) {
            console.error('Error updating requisition status:', err);
            return { success: false, error: err };
        }
    };

    // Snooze reorder item
    const snoozeReorderItem = async (id: string, snoozeDate: string) => {
        try {
            if (!resolvedCompanyId) {
                throw new Error('Company ID is required');
            }

            const { error } = await supabase
                .from('item_operations' as any)
                .insert({
                    item_id: id,
                    company_id: resolvedCompanyId,
                    snooze_until: new Date(`${snoozeDate}T00:00:00`).toISOString(),
                    is_active: true,
                });

            if (error) throw error;

            setReorderItems(prev => prev.map(i =>
                i.id === id ? { ...i, snoozeDate: new Date(`${snoozeDate}T00:00:00`).toISOString() } : i
            ));

            return { success: true };
        } catch (err) {
            console.error('Error snoozing reorder item:', err);
            return { success: false, error: err };
        }
    };

    return {
        requisitions,
        mainRequisitions,
        internalRequisitions,
        reorderItems: activeReorderItems,
        loading,
        dateFilter,
        setDateFilter,
        mainStatusFilter,
        setMainStatusFilter,
        internalStatusFilter,
        setInternalStatusFilter,
        searchQuery,
        setSearchQuery,
        updateRequisitionStatus,
        snoozeReorderItem,
    };
}


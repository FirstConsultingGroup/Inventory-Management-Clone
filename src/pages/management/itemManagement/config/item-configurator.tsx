import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Trash2, Plus, LayoutTemplate, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search, Download, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/Utils/types/supabaseClient';
import { ITemsConfig, IUser } from '@/Utils/constants';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { loadModulePermissions, initiateApprovalRequest } from '@/Utils/commonFun';
type ItemConfigData = ITemsConfig[];

interface PaginationData {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

type SortOrder = 'asc' | 'desc';

interface SortConfig {
    column: keyof ITemsConfig;
    order: SortOrder;
}

interface HeaderConfig {
    label: string;
    key: keyof ITemsConfig | null;
    sortable: boolean;
}

const tableHeaders: HeaderConfig[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Control Type', key: 'control_type', sortable: true },
    { label: 'Data Type', key: 'data_type', sortable: true },
    { label: 'Description', key: 'description', sortable: true },
    { label: 'Sequence', key: 'sequence', sortable: true },
    { label: 'Max Length', key: 'max_length', sortable: true },
    { label: 'Actions', key: null, sortable: false },
];

const SortIndicator = ({ column, sortConfig }: { column: keyof ITemsConfig, sortConfig: SortConfig | null }) => {
    if (!sortConfig || sortConfig.column !== column) {
        return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.order === 'asc') {
        return <ArrowUp className="h-4 w-4 text-gray-400" />;
    }
    return <ArrowDown className="h-4 w-4 text-gray-400" />;
};

export const ItemConfigurator = () => {
    const navigate = useNavigate();
    const user = localStorage.getItem("userData");
    const userData: IUser | null = user ? JSON.parse(user) : null;

    const [fields, setFields] = useState<ItemConfigData>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterControlType, setFilterControlType] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [pagination, setPagination] = useState<PaginationData>({
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: 10
    });
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'sequence', order: 'asc' });
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [fieldToDelete, setFieldToDelete] = useState<ITemsConfig | null>(null);
    const [modulePermissions, setModulePermissions] = useState<any[]>([]);

const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

    // Refs to track previous values
    const prevSearchTerm = useRef(searchTerm);
    const prevFilterControlType = useRef(filterControlType);
    const prevSortConfig = useRef(sortConfig);
    const isInitialLoad = useRef(true);

    
    const fetchItemConfigs = useCallback(async (page: number = currentPage) => {
        if (!userData) return;

        setLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('item_configurator')
                .select('*', { count: 'exact' })
                .eq('company_id', userData?.company_id || userData?.id);

            if (searchTerm.trim()) {
                query = query.or(`name.ilike.%${searchTerm.trim()}%,description.ilike.%${searchTerm.trim()}%`);
            }

            if (filterControlType) {
                query = query.or(`control_type.ilike.${filterControlType},control_type.ilike.${filterControlType.toLowerCase()},control_type.ilike.${filterControlType.toUpperCase()},control_type.ilike.${filterControlType.charAt(0).toUpperCase() + filterControlType.slice(1)}`);
            }

            if (sortConfig) {
                query = query.order(sortConfig.column, { ascending: sortConfig.order === 'asc' });
            } else {
                query = query.order('sequence', { ascending: true });
            }

            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data, error: supabaseError, count } = await query;

            if (supabaseError) {
                throw new Error(supabaseError.message);
            }

            setFields(data || []);

            const totalItems = count || 0;
            const totalPages = Math.ceil(totalItems / itemsPerPage);

            setPagination({
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage
            });

        } catch (err) {
            console.error('Error fetching item configs:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
            setFields([]);
            setPagination(prev => ({ ...prev, currentPage: page, totalPages: 0, totalItems: 0 }));
            toast.error('Failed to fetch item configurations');
        } finally {
            setLoading(false);
        }
    }, [userData, itemsPerPage, searchTerm, filterControlType, sortConfig]);

    const exportItemConfigsToCSV = async () => {
        const user = JSON.parse(localStorage.getItem('userData') || '{}');

        await exportSupabaseTableToCSV<ITemsConfig>({
            reportTitle: 'Item Configurator',
            headers: ['Name', 'Description', 'Control Type', 'Data Type', 'Item Unit', 'Sequence', 'Max Length', 'Collection Name', 'Is Mandatory'],
            rowMapper: (config: any) => [
                `"${config.name}"`,
                `"${config.description || null}"`,
                `"${config.control_type}"`,
                `"${config.data_type}"`,
                `"${config.item_unit?.name || null}"`,
                `"${config.sequence}"`,
                `"${config.max_length}"`,
                `"${config.collection?.alias_name || null}"`,
                `"${config.is_mandatory}"`,
            ],
            supabaseClient: supabase,
            fetcher: async () => {
                let query = supabase
                    .from('item_configurator')
                    .select(`*,
                        item_unit:units_master!item_configurator_item_unit_id_fkey(name),
                        collection:item_lookup_master!collection_id(alias_name)`)
                    .eq('company_id', user?.company_id || '');

                if (searchTerm) {
                    const sanitizedQuery = searchTerm.replace(/[%_]/g, '');
                    const searchConditions = [
                        `name.ilike.%${sanitizedQuery.trim()}%`,
                        `description.ilike.%${sanitizedQuery.trim()}%`
                    ];
                    query = query.or(searchConditions.join(','));
                }

                if (filterControlType) {
                    query = query.or(`control_type.ilike.${filterControlType},control_type.ilike.${filterControlType.toLowerCase()},control_type.ilike.${filterControlType.toUpperCase()},control_type.ilike.${filterControlType.charAt(0).toUpperCase() + filterControlType.slice(1)}`);
                }

                if (sortConfig) {
                    query = query.order(sortConfig.column, { ascending: sortConfig.order === 'asc' });
                } else {
                    query = query.order('sequence', { ascending: true });
                }

                const { data, error } = await query;
                if (error) throw error;
                return data as unknown as ITemsConfig[];
            },
            onError: (err: { message: any; }) => toast.error(`Failed to export item configs: ${err.message}`),
        });
    };

    // Handle search and filter changes with debouncing
    useEffect(() => {
        const searchChanged = prevSearchTerm.current !== searchTerm;
        const filterChanged = prevFilterControlType.current !== filterControlType;
        const sortChanged = JSON.stringify(prevSortConfig.current) !== JSON.stringify(sortConfig);

        // Update refs
        prevSearchTerm.current = searchTerm;
        prevFilterControlType.current = filterControlType;
        prevSortConfig.current = sortConfig;

        // Skip initial load to prevent double fetching
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }

        // Reset to page 1 only if search/filter changed, not sort
        if (searchChanged || filterChanged) {
            setCurrentPage(1);
            const handler = setTimeout(() => {
                fetchItemConfigs(1);
            }, 300); // Debounce search
            return () => clearTimeout(handler);
        }

        // For sort changes, use current page and fetch immediately
        if (sortChanged) {
            fetchItemConfigs(currentPage);
        }
    }, [searchTerm, filterControlType, sortConfig, fetchItemConfigs]);

    // Handle pagination changes
    useEffect(() => {
        if (!isInitialLoad.current) {
            fetchItemConfigs(currentPage);
        }
    }, [currentPage]);

    // Handle items per page changes
    useEffect(() => {
        if (!isInitialLoad.current) {
            setCurrentPage(1);
            fetchItemConfigs(1);
        }
    }, [itemsPerPage]);

    // Initial load
    useEffect(() => {
        if (isInitialLoad.current) {
            fetchItemConfigs(1);
        }
    }, []);

    const deleteFieldConfig = async () => {
        if (!fieldToDelete) return;
        try {
            const systemLog = {
                company_id: userData?.company_id,
                transaction_date: new Date().toISOString(),
                module: 'Item Configurator',
                scope: 'Delete',
                key: '',
                log: `Field: ${fieldToDelete.name} deleted.`,
                action_by: userData?.id,
                created_at: new Date().toISOString(),
            };

            const action_payload = {
                operations: [
                    {
                        table: 'item_configurator',
                        type: 'delete',
                        match: { id: fieldToDelete.id, company_id: userData?.company_id ?? userData?.id ?? '' }
                    },
                    {
                        table: 'system_log',
                        type: 'insert',
                        data: systemLog
                    }
                ]
            };

            const approvalResponse = await initiateApprovalRequest({
                module_name: 'Item Configurator',
                action_name: 'Delete',
                company_id: userData?.company_id || '',
                requested_by: userData?.id || '',
                action_payload
            });

            if (approvalResponse?.success) {
                if (approvalResponse.requires_approval) {
                    toast.success('Your action has been submitted and is currently pending approval.');
                    setIsDialogOpen(false);
                    setFieldToDelete(null);
                } else {
                    const { error: supabaseError } = await supabase
                        .from('item_configurator')
                        .delete()
                        .eq('id', fieldToDelete.id)
                        .eq('company_id', userData?.company_id ?? userData?.id ?? '');

                    if (supabaseError) {
                        throw new Error(supabaseError.message);
                    }

                    const { error: systemLogError } = await supabase
                        .from('system_log')
                        .insert(systemLog);

                    if (systemLogError) throw systemLogError;
                    
                    toast.success("Item field deleted successfully!");
                    fetchItemConfigs(currentPage); // Refetch data for current page
                    setIsDialogOpen(false);
                    setFieldToDelete(null);
                }
            }

        } catch (error: unknown) {
            console.error('Error deleting field:', error);
            const message = error instanceof Error ? error.message : 'Failed to delete field';
            toast.error(message);
        }
    };

    const openDeleteDialog = (field: ITemsConfig) => {
        setFieldToDelete(field);
        setIsDialogOpen(true);
    };

    const handleSort = (column: keyof ITemsConfig) => {
        setSortConfig(prev => {
            if (prev && prev.column === column) {
                return { column, order: prev.order === 'asc' ? 'desc' : 'asc' };
            }
            return { column, order: 'asc' };
        });
    };

    // Handle page changes
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== currentPage) {
            setCurrentPage(newPage);
        }
    };

    // Handle items per page change
    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        if (newItemsPerPage !== itemsPerPage) {
            setItemsPerPage(newItemsPerPage);
        }
    };

    // Clear all filters
    const clearFilters = () => {
        setFilterControlType(null);
        setSearchTerm('');
        setCurrentPage(1);
    };

    // Handle edit click - populate form with selected field data
    const handleEditClick = (field: ITemsConfig) => {
        navigate(`/dashboard/itemConfig/edit/${field.id}`);
    };

    // Get control type display name
    const getControlTypeDisplay = (controlType: string) => {
        switch (controlType?.toLowerCase()) {
            case 'textbox':
            case 'text':
                return 'Textbox';
            case 'dropdown':
            case 'select':
                return 'Dropdown';
            case 'number':
                return 'Number';
            case 'date':
                return 'Date';
            default:
                return controlType || 'Unknown';
        }
    };

    // Get control type badge color
    const getControlTypeBadgeColor = (controlType: string) => {
        switch (controlType?.toLowerCase()) {
            case 'textbox':
            case 'text':
                return 'bg-blue-100 text-blue-800 border border-blue-200';
            case 'dropdown':
            case 'select':
                return 'bg-purple-100 text-purple-800 border border-purple-200';
            case 'textarea':
                return 'bg-green-100 text-green-800 border border-green-200';
            case 'number':
                return 'bg-green-100 text-green-800 border border-green-200';
            case 'date':
                return 'bg-orange-100 text-orange-800 border border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border border-gray-200';
        }
    };
useEffect(() => {
        const fetchPermissions = async () => {
            if (userData?.id) {
                const res = await loadModulePermissions(
                    appCode,
                    'Item Configurator',
                    userData.id
                );

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
    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl space-y-6">
                <Card className="min-h-[85vh] shadow-sm">
                    <CardHeader className="rounded-t-lg border-b pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                                    <LayoutTemplate className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                        Item Attribute Configurator
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Customize your item fields and controls
                                    </CardDescription>
                                </div>
                            </div>
                            <div>
    <TooltipProvider>
        <div className="flex gap-2">
            
            {/* Export Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <Button
                            variant="outline"
                            onClick={exportItemConfigsToCSV}
                            className="transition-colors me-2"
                            disabled={
                                fields.length === 0 ||
                                !hasPermission('Export')
                            }
                        >
                            <Download className="mr-2 h-4 w-4" />
                            <span>Export CSV</span>
                        </Button>
                    </div>
                </TooltipTrigger>

                <TooltipContent>
                    {hasPermission('Export')
                        ? 'Export Item Configurations'
                        : 'You do not have permission to export'}
                </TooltipContent>
            </Tooltip>

            {/* Add Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <Button
                            onClick={() => navigate('/dashboard/itemConfig/add')}
                            className="transition-colors"
                            disabled={!hasPermission('Add')}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item Field
                        </Button>
                    </div>
                </TooltipTrigger>

                <TooltipContent>
                    {hasPermission('Add')
                        ? 'Add Item Field'
                        : 'You do not have permission to add'}
                </TooltipContent>
            </Tooltip>

        </div>
    </TooltipProvider>
</div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <div className="mb-6 space-y-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search fields..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                        <Filter className="h-4 w-4 text-gray-500" />
                                        <Select
                                            value={filterControlType || 'all'}
                                            onValueChange={(value) => setFilterControlType(value === 'all' ? null : value)}
                                        >
                                            <SelectTrigger className="w-full sm:w-[180px]">
                                                <SelectValue placeholder="Filter by Control Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Control Types</SelectItem>
                                                <SelectItem value="textbox">Textbox</SelectItem>
                                                <SelectItem value="dropdown">Dropdown</SelectItem>
                                                <SelectItem value="multi select dropdown">Multi Select Dropdown</SelectItem>
                                                <SelectItem value="textarea">Textarea</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={clearFilters}
                                        className="text-gray-700 hover:bg-gray-50"
                                    >
                                        Clear Filters
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
                                <p>Error: {error}</p>
                            </div>
                        )}

                        <div className="rounded-lg overflow-hidden border shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-gray-50 border-gray-200">
                                        {tableHeaders.map((header) => {
                                            // Determine alignment based on column type
                                            let headerAlignment = 'text-left';
                                            let justifyContent = 'justify-start';
                                            
                                            if (header.key === 'sequence' || header.key === 'max_length') {
                                                headerAlignment = 'text-right';
                                                justifyContent = 'justify-end';
                                            } else if (header.key === null) { // Actions column
                                                headerAlignment = 'text-center';
                                                justifyContent = 'justify-center';
                                            }
                                            
                                            return (
                                                <TableHead
                                                    key={header.label}
                                                    className={`font-semibold ${headerAlignment}`}
                                                >
                                                    <p
                                                        onClick={() => header.sortable && handleSort(header.key!)}
                                                        className={`h-8 flex items-center gap-1 font-semibold ${header.sortable ? 'cursor-pointer hover:text-blue-600' : ''} w-auto ${justifyContent}`}
                                                    >
                                                        {header.label}
                                                        {header.sortable && <SortIndicator column={header.key!} sortConfig={sortConfig} />}
                                                    </p>
                                                </TableHead>
                                            );
                                        })}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array(itemsPerPage).fill(0).map((_, index) => (
                                            <TableRow key={`loading-${index}`} className="hover:bg-gray-50">
                                                {Array(7).fill(0).map((_, idx) => (
                                                    <TableCell key={`loading-cell-${idx}`} className="text-center py-3">
                                                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : fields.length > 0 ? (
                                        fields.map((field) => (
                                            <TableRow
                                                key={field.id}
                                                className="hover:bg-gray-50"
                                            >
                                                <TableCell className="font-medium py-3">
                                                    {field.name}
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    <Badge
                                                        variant="outline"
                                                        className={`font-medium ${getControlTypeBadgeColor(field.control_type)}`}
                                                    >
                                                        {getControlTypeDisplay(field.control_type)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    {field.data_type ? (
                                                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs capitalize">
                                                            {field.data_type}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-left text-sm">
                                                    {field.description ? (
                                                        <div className="truncate max-w-xs" title={field.description}>
                                                            {field.description}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="text-xs">{field.sequence}</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {field.max_length ? (
                                                        <span className="text-xs">{field.max_length}</span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </TableCell>
                                              <TableCell className="text-center">
    <div className="flex justify-center gap-2">

        {/* Edit Button */}
        <Tooltip>
            <TooltipTrigger asChild>
                <div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditClick(field)}
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

            <TooltipContent>
                {hasPermission('Edit')
                    ? 'Edit Item Field'
                    : 'You do not have permission to edit'}
            </TooltipContent>
        </Tooltip>

        {/* Delete Button */}
        <Tooltip>
            <TooltipTrigger asChild>
                <div>
                    <Button
                        variant="outline"
                        size="icon"
                        className={`text-destructive hover:bg-destructive/10 ${
                            !hasPermission('Delete')
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                        }`}
                        onClick={() => openDeleteDialog(field)}
                        disabled={!hasPermission('Delete')}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TooltipTrigger>

            <TooltipContent>
                {hasPermission('Delete')
                    ? 'Delete Item Field'
                    : 'You do not have permission to delete'}
            </TooltipContent>
        </Tooltip>

    </div>
</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow className="hover:bg-gray-50">
                                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center py-6">
                                                    <LayoutTemplate className="h-12 w-12 text-gray-300 mb-2" />
                                                    <p className="text-base font-medium">
                                                        {searchTerm || filterControlType ? 'No matching fields found' : "No fields configured yet"}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {searchTerm || filterControlType
                                                            ? 'Try adjusting your search or filter criteria.'
                                                            : 'Click "Add Item Field" to get started.'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination controls */}
                        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">Show</p>
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={(value) => handleItemsPerPageChange(Number(value))}
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
                                    Showing {pagination.totalItems > 0 ? ((pagination.currentPage - 1) * pagination.itemsPerPage) + 1 : 0} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} entries
                                </p>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                                        disabled={pagination.currentPage === 1 || loading}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                                        Page {pagination.currentPage} of {pagination.totalPages || 1}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                                        disabled={pagination.currentPage === pagination.totalPages || pagination.totalPages === 0 || loading}
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
                            <DialogDescription>Are you sure you want to delete the field "{fieldToDelete?.name}"?</DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-end gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" onClick={() => setFieldToDelete(null)}>
                                    No
                                </Button>
                            </DialogClose>
                            <Button variant="destructive" onClick={deleteFieldConfig}>
                                Yes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
};
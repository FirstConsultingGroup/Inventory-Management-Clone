import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import toast from 'react-hot-toast';
import { IUser } from '@/Utils/constants';
import { Badge } from '@/components/ui/badge';

import { loadModulePermissions, initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Category interface based on category_master table
interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  company_id: string;
  status: boolean | null;
  items_count?: number;
}

type SortField = 'name' | 'description' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

export const CategoryManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category>();
  const [newCategory, setNewCategory] = useState({ name: '', description: '', is_active: true });
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const user = localStorage.getItem("userData");
  const userData: IUser | null = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || null;
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  const statusFilters = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.id) {
        const res = await loadModulePermissions(appCode, 'Category Master', userData.id);
        console.log(res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.id, userData?.role_id]);

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

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
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    } else if (sortConfig.direction === 'desc') {
      return <ArrowDown className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  };

  const validateForm = (formData: { name: string }) => {
    const errors: { name?: string } = {};
    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchCategories = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('category_master')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId!)
        .eq('is_active', true);

      if (debouncedSearchQuery.trim()) {
        const searchLower = debouncedSearchQuery.toLowerCase();
        query = query.or(`name.ilike.%${searchLower}%,description.ilike.%${searchLower}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter === 'active');
      }

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });
      }

      const startIndex = (currentPage - 1) * itemsPerPage;
      query = query.range(startIndex, startIndex + itemsPerPage - 1);

      const { data: categoriesData, error: categoriesError, count } = await query;

      if (categoriesError) throw new Error(categoriesError.message);

      const categoryIds = categoriesData?.map(category => category.id) || [];
      let itemCounts: { [key: string]: number } = {};
      if (categoryIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from('item_mgmt')
          .select('category_id', { count: 'exact' })
          .eq('company_id', companyId!)
          .eq('is_active', true)
          .in('category_id', categoryIds);

        if (itemError) throw new Error(itemError.message);

        itemCounts = (itemData || []).reduce((acc, item) => {
          acc[item.category_id!] = (acc[item.category_id!] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });
      }

      const categoriesWithItemCount = categoriesData?.map(category => ({
        ...category,
        items_count: itemCounts[category.id] || 0
      })) || [];

      setCategories(categoriesWithItemCount as Category[]);
      setTotalItems(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err: any) {
      toast.error(`Failed to fetch categories: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchQuery, statusFilter, itemsPerPage, sortConfig]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddCategorySubmit = async () => {
    if (!validateForm(newCategory)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('category_master')
        .insert({
          name: newCategory.name.trim(),
          description: newCategory.description.trim() || null,
          is_active: newCategory.is_active,
          company_id: companyId,
        });

      if (error) throw new Error(error.message);

      setIsAddDialogOpen(false);
      setNewCategory({ name: '', description: '', is_active: true });
      setFormErrors({});
      toast.success('Category added successfully!');
      fetchCategories();
    } catch (err: any) {
      toast.error(`Failed to add category: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

 const handleDeleteCategory = async () => {
if (!categoryToDelete) return;

try {
const isLocked = await checkEntityLock(categoryToDelete.id);
if (isLocked) {
  toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
  return;
}

const { data: items, error: itemsError } = await supabase
.from('item_mgmt')
.select('id')
.eq('company_id', companyId!)
.eq('is_active', true)
.eq('category_id', categoryToDelete.id)
.limit(1);


if (itemsError) {
  throw new Error(itemsError.message);
}

if (items && items.length > 0) {
  toast.error(
    'Cannot delete category. Items are associated with this category.'
  );

  setIsDeleteDialogOpen(false);
  setCategoryToDelete(undefined);
  return;
}


const payload = {
  is_active: false,
};


const systemLog = {
  company_id: companyId,
  transaction_date: new Date().toISOString(),
  module: 'Category Master',
  scope: 'Delete',
  key: '',
  log: `Category: ${categoryToDelete.name} deleted.`,
  action_by: userData?.id,
  created_at: new Date().toISOString(),
};


const action_payload = {
  operations: [
    {
      table: 'category_master',
      type: 'update',
      data: payload,
      match: {
        id: categoryToDelete.id,
        company_id: companyId,
      },
    },
    {
      table: 'system_log',
      type: 'insert',
      data: systemLog,
    },
  ],
};


const approvalResponse = await initiateApprovalRequest({
  module_name: 'Category Master',
  action_name: 'Delete',
  company_id: companyId || '',
  requested_by: userData?.id || '',
  action_payload,
  entity_id: categoryToDelete.id,
});


if (approvalResponse?.success) {
  
  if (approvalResponse.requires_approval) {
    toast.success(
      'Your action has been submitted and is currently pending approval.',
      {
        position: 'top-center',
      }
    );

    setIsDeleteDialogOpen(false);
    setCategoryToDelete(undefined);
    return;
  }

 
  const { error: deleteError } = await supabase
    .from('category_master')
    .update(payload)
    .eq('id', categoryToDelete.id)
    .eq('company_id', companyId!);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  
  const { error: systemLogError } = await supabase
    .from('system_log')
    .insert(systemLog);

  if (systemLogError) {
    throw new Error(systemLogError.message);
  }

  toast.success('Category deleted successfully!', {
    position: 'top-center',
  });

  
  setIsDeleteDialogOpen(false);
  setCategoryToDelete(undefined);

  fetchCategories();
} else {
  throw new Error(
    approvalResponse?.message || 'Approval initiation failed'
  );
}


} catch (error: any) {
console.error('Error deleting category:', error);

toast.error(
  `Failed to delete category: ${
    error?.message || 'Unknown error'
  }`,
  {
    position: 'top-center',
  }
);

setIsDeleteDialogOpen(false);
setCategoryToDelete(undefined);


}
};



  const handleFilterReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: 'created_at', direction: 'desc' });
    setFormErrors({});
    toast.success('Filters cleared successfully!');
  };

  const exportCategoriesCSV = async () => {
  setIsExporting(true);

  try {
    const fetchAllCategoriesForExport = async (): Promise<Category[]> => {
      let query = supabase
        .from('category_master')
        .select('*')
        .eq('company_id', companyId!)
        .eq('is_active', true);

     
      if (debouncedSearchQuery.trim()) {
        const searchLower = debouncedSearchQuery.trim().toLowerCase();

        query = query.or(
          `name.ilike.%${searchLower}%,description.ilike.%${searchLower}%`
        );
      }

      
      if (statusFilter !== 'all') {
        query = query.eq(
          'status',
          statusFilter === 'active'
        );
      }

     
      if (sortConfig.field && sortConfig.direction) {
        query = query.order(
          sortConfig.field,
          {
            ascending:
              sortConfig.direction === 'asc',
          }
        );
      } else {
        query = query.order(
          'created_at',
          {
            ascending: false,
          }
        );
      }

      const {
        data: categoriesData,
        error: categoriesError,
      } = await query;

      if (categoriesError) {
        throw new Error(categoriesError.message);
      }

      if (!categoriesData || categoriesData.length === 0) {
        return [];
      }

     
      const categoryIds = categoriesData.map(
        (category) => category.id
      );

      
      const {
        data: itemData,
        error: itemError,
      } = await supabase
        .from('item_mgmt')
        .select('category_id')
        .eq('company_id', companyId!)
        .eq('is_active', true)
        .in('category_id', categoryIds);

      if (itemError) {
        throw new Error(itemError.message);
      }

      
      const itemCounts = (itemData || []).reduce(
        (acc, item) => {
          acc[item.category_id!] =
            (acc[item.category_id!] || 0) + 1;

          return acc;
        },
        {} as { [key: string]: number }
      );

      
      return categoriesData.map((category) => ({
        ...category,
        items_count:
          itemCounts[category.id] || 0,
      })) as Category[];
    };

    await exportSupabaseTableToCSV<Category>({
      reportTitle: 'Category Master Report',

      headers: [
        'ID',
        'Name',
        'Description',
        'Status',
        'Items Count',
        'Company ID',
        'Created At',
      ],

      rowMapper: (category) => [
        `"${category.id}"`,
        `"${category.name}"`,
        `"${category.description || 'N/A'}"`,
        `"${category.status !== null
          ? category.status
            ? 'Active'
            : 'Inactive'
          : 'N/A'}"`,
        category.items_count || 0,
        `"${category.company_id}"`,
        `"${new Date(
          category.created_at
        ).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}"`,
      ],

      supabaseClient: supabase,

      fetcher: fetchAllCategoriesForExport,

      onError: (error) => {
        console.error(
          'Export error:',
          error
        );

        toast.error(
          `Failed to export categories: ${error.message}`
        );
      },
    });
  } catch (error: any) {
    console.error(
      'Failed to export categories:',
      error
    );

    toast.error(
      `Failed to export categories: ${
        error.message || 'Unknown error'
      }`
    );
  } finally {
    setIsExporting(false);
  }
};

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeColor = (status: boolean | null) => {
    if (status === true) return 'bg-green-100 text-green-800 border-green-300';
    if (status === false) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusDisplayText = (status: boolean | null) => {
    if (status === true) return 'Active';
    if (status === false) return 'Inactive';
    return 'Unknown';
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
                    <List className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Category Master
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage your inventory categories and their properties
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="outline"
                          onClick={exportCategoriesCSV}
                          className="transition-colors"
                          disabled={categories.length === 0 || loading || isExporting || !hasPermission('Export')}
                        >
                          <Download className={`mr-2 h-4 w-4 ${isExporting ? 'animate-spin' : ''}`} />
                          <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                        </Button>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent>
                      {hasPermission('Export')
                        ? 'Export CSV'
                        : 'You do not have permission to export categories'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          onClick={() => navigate('/dashboard/category-master/add')}
                          className="transition-colors"
                          disabled={loading || !hasPermission('Add')}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Category
                        </Button>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent>
                      {hasPermission('Add')
                        ? 'Add Category'
                        : 'You do not have permission to add categories'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Filters */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full sm:w-1/3">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by category name or description..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusFilters.map(filter => (
                          <SelectItem key={filter.value} value={filter.value}>
                            {filter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleFilterReset}
                    className="transition-colors w-full sm:w-auto"
                    disabled={loading}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg overflow-hidden border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold w-[250px]">
                        <button
                          type="button"
                          onClick={() => handleSort('name')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600 ps-2"
                        >
                          Name {getSortIcon('name')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('description')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        >
                          Description {getSortIcon('description')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('is_active')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-start hover:text-blue-600"
                        >
                          Status {getSortIcon('is_active')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('created_at')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-start hover:text-blue-600"
                        >
                          Created At {getSortIcon('created_at')}
                        </button>
                      </TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-3"><div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-65 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-25 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center py-6">
                            <List className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">
                              {searchQuery.trim() ? 'No categories found matching your search' : 'No categories available'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {searchQuery.trim() ? 'Try adjusting your search terms or filters' : 'Create a new category to get started'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.map((category) => (
                        <TableRow key={category.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-3">
                            <div className="ps-2">
                              <p className="font-medium">{category.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[250px] whitespace-normal break-words">
                            <div className="max-w-xs">
                              <p className="text-sm">
                                {category.description || (
                                  <span className="text-gray-400 italic">No description provided</span>
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`font-medium ${getStatusBadgeColor(category.status)}`}
                            >
                              {getStatusDisplayText(category.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            <p className="text-sm">{formatDate(category.created_at)}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              {/* View */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => navigate(`/dashboard/category-master/view/${category.id}`)}
                                      disabled={loading || !hasPermission('View')}
                                      className={!hasPermission('View') ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {hasPermission('View')
                                    ? 'View Category'
                                    : 'You do not have permission to view categories'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Edit */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => navigate(`/dashboard/category-master/edit/${category.id}`)}
                                      disabled={loading || !hasPermission('Edit')}
                                      className={!hasPermission('Edit') ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {hasPermission('Edit')
                                    ? 'Edit Category'
                                    : 'You do not have permission to edit categories'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Delete */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className={`text-destructive hover:bg-destructive/10 ${(!hasPermission('Delete') || (category.items_count && category.items_count > 0))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                        }`}
                                      disabled={
                                        !hasPermission('Delete') ||
                                        !!(category.items_count && category.items_count > 0)
                                      }
                                      onClick={() => {
                                        if (!hasPermission('Delete')) return;

                                        setCategoryToDelete(category);
                                        setIsDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent>
                                  {!hasPermission('Delete') ? (
                                    <p>You do not have permission to delete categories.</p>
                                  ) : category.items_count && category.items_count > 0 ? (
                                    <p>Cannot delete category. Items are associated with this category.</p>
                                  ) : (
                                    <p>Delete Category</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Show</p>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
                    disabled={loading}
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
                    Showing {categories.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                      Page {currentPage} of {totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
                      disabled={currentPage === totalPages || loading || totalPages === 0}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Category Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Category</DialogTitle>
                <DialogDescription>Enter the details for the new category.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name (Required)</label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Enter category name"
                    disabled={loading}
                  />
                  {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
                  <Input
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    placeholder="Enter category description"
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={newCategory.is_active}
                    onCheckedChange={(checked) => setNewCategory({ ...newCategory, is_active: !!checked })}
                    disabled={loading}
                  />
                  <label className="text-sm font-medium text-gray-700">Active Flag</label>
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => { setNewCategory({ name: '', description: '', is_active: true }); setFormErrors({}); }} disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button onClick={handleAddCategorySubmit} disabled={loading}>
                  Add Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this category? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => setCategoryToDelete(undefined)} disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDeleteCategory} disabled={loading}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};
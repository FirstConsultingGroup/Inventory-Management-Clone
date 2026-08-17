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
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
} from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import toast from 'react-hot-toast';
import { IUser } from '@/Utils/constants';
import { Badge } from '@/components/ui/badge';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';

// Department interface based on department_master table
interface Department {
  id: string;
  department_id: string;
  department_name: string;
  info: string | null;
  status: boolean;
  is_active: boolean;
  company_id: string;
  created_at: string;
  modified_at: string;
  users_count?: number;
}

type SortField = 'department_id' | 'department_name' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

export const DepartmentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

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
    const fetchPermissions = async () => {
      if (userData?.id) {
        const res = await loadModulePermissions(
          appCode,
          'Department Management',
          userData.id
        );

        console.log(res);

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };

    fetchPermissions();
  }, [userData?.id, userData?.role_id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (userData?.role_id) {
        try {
          const { data: roleData, error } = await supabase
            .from('role_master')
            .select('name')
            .eq('id', userData.role_id)
            .eq('is_active', true)
            .single();

          if (error) throw error;

          console.log('Fetched Role Name:', roleData?.name);
          setUserRole(roleData?.name || null);
        } catch (error) {
          console.error('Error fetching role:', error);
        }
      }
    };

    fetchUserRole();
  }, [userData]);

  console.log('Current User Role:', userRole);

  // const isAdmin = userRole?.toLowerCase() === 'super admin' || userRole?.toLowerCase() === 'administrator';

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find(
      (p: any) =>
        p.action_id?.actionName?.toLowerCase() ===
        actionName.toLowerCase()
    );

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

  const fetchDepartments = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('department_master')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId!)
        .eq('is_active', true);

      console.log('Company ID in fetchDepartments:', companyId);

      if (debouncedSearchQuery.trim()) {
        const searchLower = debouncedSearchQuery.toLowerCase();
        query = query.or(`department_id.ilike.%${searchLower}%,department_name.ilike.%${searchLower}%,info.ilike.%${searchLower}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter === 'active');
      }

      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });
      }

      const startIndex = (currentPage - 1) * itemsPerPage;
      query = query.range(startIndex, startIndex + itemsPerPage - 1);

      const { data: departmentsData, error: departmentsError, count } = await query;
      console.log('departmentsData:', departmentsData);

      if (departmentsError) {
        throw new Error(departmentsError.message);
      }

      const departmentIds = departmentsData?.map(dept => dept.id) || [];
      let userCounts: { [key: string]: number } = {};

      if (departmentIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from('user_mgmt')
          .select('department_id', { count: 'exact' })
          .eq('company_id', companyId!)
          .eq('status', 'active')
          .in('department_id', departmentIds);

        if (userError) {
          throw new Error(userError.message);
        }
        userCounts = (userData || []).reduce((acc, user) => {
          if (user.department_id) {
            acc[user.department_id] = (acc[user.department_id] || 0) + 1;
          }
          return acc;
        }, {} as { [key: string]: number });
      }

      const departmentsWithUserCount = departmentsData?.map(dept => ({
        ...dept,
        users_count: userCounts[dept.id] || 0
      })) || [];

      setDepartments(departmentsWithUserCount as Department[]);
      setTotalItems(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (err: any) {
      toast.error(`Failed to fetch departments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchQuery, statusFilter, itemsPerPage, sortConfig, companyId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return;

    try {
      const isLocked = await checkEntityLock(departmentToDelete.id);
      if (isLocked) {
        toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from('user_mgmt')
        .select('id')
        .eq('company_id', companyId!)
        .eq('status', 'active')
        .eq('department_id', departmentToDelete.id)
        .limit(1);

      if (usersError) {
        throw new Error(usersError.message);
      }

      if (users && users.length > 0) {
        toast.error('Cannot delete department. Users are assigned to this department.', {
          position: 'top-center',
        });
        setIsDeleteDialogOpen(false);
        setDepartmentToDelete(undefined);
        return;
      }

      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: 'Department Master',
        scope: 'Delete',
        key: '',
        log: `Department: ${departmentToDelete.department_name} (${departmentToDelete.department_id}) deleted.`,
        action_by: userData?.id,
        created_at: new Date().toISOString(),
      };

      const action_payload = {
                operations: [
                    {
                        table: 'department_master',
                        type: 'delete',
                        match: { id: departmentToDelete.id, company_id: userData?.company_id ?? userData?.id ?? '' }
                    },
                    {
                        table: 'system_log',
                        type: 'insert',
                        data: systemLogs
                    }
                ]
            };

            const approvalResponse = await initiateApprovalRequest({
                module_name: 'Department Master',
                action_name: 'Delete',
                company_id: userData?.company_id || '',
                requested_by: userData?.id || '',
                action_payload,
                entity_id: departmentToDelete.id
            });

            if (approvalResponse?.success) {
                if (approvalResponse.requires_approval) {
                    toast.success('Your action has been submitted and is currently pending approval.');
              
                } else {
                  const { error: deleteError } = await supabase
        .from('department_master')
        .update({ is_active: false, modified_at: new Date().toISOString() })
        .eq('id', departmentToDelete.id)
        .eq('company_id', companyId!);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

      toast.success('Department deleted successfully!', { position: 'top-center' });
                }}

      setIsDeleteDialogOpen(false);
      setDepartmentToDelete(undefined);
      fetchDepartments();
    } catch (err: any) {
      toast.error(`Failed to delete department: ${err.message}`, { position: 'top-center' });
      setIsDeleteDialogOpen(false);
      setDepartmentToDelete(undefined);
    }
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: 'created_at', direction: 'desc' });
    toast.success('Filters cleared successfully!');
  };

  const exportDepartmentsCSV = async () => {
    setIsExporting(true);

    const fetchAllDepartmentsForExport = async (): Promise<Department[]> => {
      try {
        const { data: departmentsData, error: departmentsError } = await supabase
          .from('department_master')
          .select('*')
          .eq('company_id', companyId!)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (departmentsError) {
          throw new Error(departmentsError.message);
        }

        if (!departmentsData || departmentsData.length === 0) {
          return [];
        }

        const departmentIds = departmentsData.map(dept => dept.id);
        const { data: userData, error: userError } = await supabase
          .from('user_mgmt')
          .select('department_id')
          .eq('company_id', companyId!)
          .eq('status', 'active')
          .in('department_id', departmentIds);

        if (userError) {
          throw new Error(userError.message);
        }

        const userCounts = (userData || []).reduce((acc, user) => {
          if (user.department_id) {
            acc[user.department_id] = (acc[user.department_id] || 0) + 1;
          }
          return acc;
        }, {} as { [key: string]: number });

        return departmentsData.map(dept => ({
          ...dept,
          users_count: userCounts[dept.id] || 0
        })) as Department[];
      } catch (error) {
        throw error;
      }
    };

    await exportSupabaseTableToCSV<Department>({
      reportTitle: 'Department Master Report',
      headers: [
        'Department ID',
        'Department Name',
        'Info',
        'Status',
        'Users Count',
        'Created At',
        'Modified At'
      ],
      rowMapper: (dept) => [
        `"${dept.department_id}"`,
        `"${dept.department_name}"`,
        `"${dept.info || 'N/A'}"`,
        `"${dept.status ? 'Active' : 'Inactive'}"`,
        dept.users_count || 0,
        `"${new Date(dept.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}"`,
        `"${new Date(dept.modified_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}"`
      ],
      supabaseClient: supabase,
      fetcher: fetchAllDepartmentsForExport,
      onError: (error) => {
        console.error('Export error:', error);
        toast.error(`Failed to export departments: ${error.message}`);
      },
    });

    setIsExporting(false);
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

  const getStatusBadgeColor = (status: boolean) => {
    return status
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-red-100 text-red-800 border-red-300';
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
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Department Master
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage organizational departments and their configurations
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* Export Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button
                          variant="outline"
                          onClick={exportDepartmentsCSV}
                          className={`transition-colors ${!hasPermission('Export')
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                            }`}
                          disabled={
                            departments.length === 0 ||
                            loading ||
                            isExporting ||
                            !hasPermission('Export')
                          }
                        >
                          <Download
                            className={`mr-2 h-4 w-4 ${isExporting ? 'animate-spin' : ''
                              }`}
                          />
                          <span>
                            {isExporting ? 'Exporting...' : 'Export CSV'}
                          </span>
                        </Button>
                      </div>
                    </TooltipTrigger>

                    <TooltipContent>
                      {hasPermission('Export')
                        ? 'Export Departments'
                        : 'You do not have permission to export departments'}
                    </TooltipContent>
                  </Tooltip>

                  {/* Add Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            onClick={() =>
                              navigate('/dashboard/department-master/add')
                            }
                            className={`transition-colors ${!hasPermission('Add')
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                              }`}
                            disabled={loading || !hasPermission('Add')}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Department
                          </Button>
                        </div>
                      </TooltipTrigger>

                      <TooltipContent>
                        {hasPermission('Add')
                          ? 'Add Department'
                          : 'You do not have permission to add departments'}
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
                      placeholder="Search by ID, name, or info..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => {
                        setStatusFilter(value);
                        setCurrentPage(1);
                      }}
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
                      <TableHead className="font-semibold w-[150px]">
                        <button
                          type="button"
                          onClick={() => handleSort('department_id')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600 ps-2"
                        >
                          Department ID
                          {getSortIcon('department_id')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('department_name')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        >
                          Department Name
                          {getSortIcon('department_name')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">Info</TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('status')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-start hover:text-blue-600"
                        >
                          Status
                          {getSortIcon('status')}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          type="button"
                          onClick={() => handleSort('created_at')}
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-full justify-start hover:text-blue-600"
                        >
                          Created At
                          {getSortIcon('created_at')}
                        </button>
                      </TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-3"><div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-60 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : departments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center py-6">
                            <Building2 className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">
                              {searchQuery.trim()
                                ? 'No departments found matching your search'
                                : 'No departments available'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {searchQuery.trim()
                                ? 'Try adjusting your search terms or filters'
                                : 'Create a new department to get started'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      departments.map((department) => (
                        <TableRow key={department.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium py-3">
                            <div className="ps-2">
                              <p className="font-mono text-sm">{department.department_id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <p>{department.department_name}</p>
                          </TableCell>
                          <TableCell className="min-w-[250px] whitespace-normal break-words">
                            <div className="max-w-md">
                              <p className="text-sm text-gray-600">
                                {department.info || (
                                  <span className="text-gray-400 italic">No information provided</span>
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`font-medium ${getStatusBadgeColor(department.status)}`}
                            >
                              {department.status ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            <p className="text-sm">{formatDate(department.created_at)}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              {/* View Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        navigate(`/dashboard/department-master/view/${department.id}`)
                                      }
                                      disabled={loading || !hasPermission('View')}
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

                                <TooltipContent>
                                  {hasPermission('View')
                                    ? 'View Department'
                                    : 'You do not have permission to view departments'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Edit Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        navigate(`/dashboard/department-master/edit/${department.id}`)
                                      }
                                      disabled={
                                        loading ||
                                        !hasPermission('Edit')
                                      }
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
                                  {!hasPermission('Edit')
                                      ? 'You do not have permission to edit departments'
                                      : 'Edit Department'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Delete Button */}
                              {department.users_count && department.users_count > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
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
                                    <p>
                                      {!hasPermission('Delete')
                                          ? 'You do not have permission to delete departments'
                                          : 'Cannot delete department. Users are assigned to this department.'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className={`text-destructive hover:bg-destructive/10 ${!hasPermission('Delete')
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                          }`}
                                        onClick={() => {
                                          setDepartmentToDelete(department);
                                          setIsDeleteDialogOpen(true);
                                        }}
                                        disabled={
                                          loading ||
                                          !hasPermission('Delete')
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>

                                  <TooltipContent>
                                    <p>
                                      {!hasPermission('Delete')
                                          ? 'You do not have permission to delete departments'
                                          : 'Delete Department'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
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
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
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
                    Showing {departments.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || loading}
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
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages || 1))}
                      disabled={currentPage === totalPages || loading || totalPages === 0}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the department "{departmentToDelete?.department_name}" ({departmentToDelete?.department_id})? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => setDepartmentToDelete(undefined)} disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDeleteDepartment}
                  disabled={loading}
                >
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
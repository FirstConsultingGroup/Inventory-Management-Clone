import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserRound,
  Filter,
  Users,
  Download,
  Lock,
  Eye,
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { supabase } from '../../../Utils/types/supabaseClient';
import { IUser, IRole } from '@/Utils/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { loadModulePermissions, initiateApprovalRequest, checkEntityLock } from '@/Utils/commonFun';

// Extended user interface that includes the role information
interface ExtendedUser extends IUser {
  role: {
    id: string | null;
    role_name: string;
  };
  department?: {
    id: string;
    department_name: string;
  };
}

// Sort configuration
type SortField = 'employee_id' | 'first_name' | 'email' | 'last_name';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

const statusColorMap = {
  active: 'bg-green-100 text-green-800 border-green-300',
  inactive: 'bg-amber-100 text-amber-800 border-amber-300',
};

export const UsersManagement = () => {
  const navigate = useNavigate();
  const user = localStorage.getItem('userData');
  const userData = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || '';
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'first_name',
    direction: 'asc'
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [users, setAllUsers] = useState<ExtendedUser[]>([]);
  const [roles, setRoles] = useState<IRole[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<IUser>();
  const [usersInActiveStores, setUsersInActiveStores] = useState<Set<string>>(new Set());
  const [usersInApprovalList, setUsersInApprovalList] = useState<Set<string>>(new Set());
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterDepartment, setFilterDepartment] = useState('all');

  const [modulePermissions, setModulePermissions] = useState<any[]>([]);
  

  useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Users', userData.user_id);
        console.log(res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.user_id, userData?.role_id]);

  const hasPermission = (actionName: string) => {
    const perm = modulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

  // Sort function
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

  // Get sort icon
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

  // Fetch only active roles for the filter dropdown
  const fetchRoles = async (): Promise<void> => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('role_master')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (rolesError) {
        console.error("Roles fetch error:", rolesError);
        throw rolesError;
      }

      setRoles(rolesData || []);
    } catch (error: any) {
      console.error("Fetch Roles Error =>", error.message || error);
      toast.error("Failed to fetch roles: " + (error.message || "Unknown error"));
    }
  };

  const fetchUsersInActiveStores = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('store_mgmt')
        .select('store_manager_id')
        .eq('is_active', true)
        .eq('company_id', companyId)
        .not('store_manager_id', 'is', null);

      if (error) {
        console.error('Error fetching users in active stores:', error);
        return;
      }

      if (data) {
        const userIds = new Set<string>(
          data.map(item => item.store_manager_id as string).filter(Boolean)
        );
        data.forEach((store: any) => {
          if (store.store_users) {
            store.store_users.forEach((userLink: { user_id: string }) => {
              userIds.add(userLink.user_id);
            });
          }
        });
        setUsersInActiveStores(userIds);
      }
    } catch (err: any) {
      console.error('Exception in fetchUsersInActiveStores:', err.message);
    }
  };

  useEffect(() => {
  const fetchApprovalUsers = async () => {
    try {
      const { data: workflows, error } = await supabase
        .from('workflow_config')
        .select('approval_users')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching approval users:', error);
        return;
      }

      if (workflows) {
        const allApprovalUserIds = workflows.flatMap(w => (w.approval_users as string[]) || []);
      setUsersInApprovalList(new Set(allApprovalUserIds));
      }
    } catch (err) {
      console.error('Failed to users in workflow approval users list:', err);
    }
  };

  fetchApprovalUsers();
}, []);


  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('department_master')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('department_name', { ascending: true });

      if (error) throw error;

      setDepartments(data || []);
    } catch (err: any) {
      console.error("Department fetch error:", err);
      toast.error("Failed to fetch departments");
    }
  };

  const fetchAllUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      // Fetch only active roles to build lookup map
      const { data: rolesData, error: rolesError } = await supabase
        .from('role_master')
        .select('*')
        .eq('is_active', true)
        .eq('company_id', companyId);

      if (rolesError) {
        console.error("Roles fetch error:", rolesError);
        throw rolesError;
      }

      // Create a role lookup map
      const roleMap: Record<string, string> = {};
      rolesData?.forEach((role: IRole) => {
        roleMap[role.id] = role.name || 'Unnamed Role';
      });

      let query = supabase
        .from('user_mgmt')
        .select(`
          *,
          department:department_master!user_mgmt_department_id_fkey(id,department_name)
        `, { count: 'exact' })
        .eq('is_active', true)
        .eq('company_id', companyId);

      query = query.order('status', { ascending: true });

      // Apply pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = currentPage * itemsPerPage - 1;
      query = query.range(startIndex, endIndex);

      // Apply search
      if (searchQuery.trim()) {
        query = query.or(
          `employee_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`
        );
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      // Apply role filter
      if (filterRole !== 'all') {
        query = query.eq('role_id', filterRole);
      }

      if (filterDepartment !== 'all') {
        query = query.eq('department_id', filterDepartment);
      }

      // Apply sorting
      if (sortConfig.field && sortConfig.direction) {
        query = query.order(sortConfig.field, { ascending: sortConfig.direction === 'asc' });
      } else {
        query = query.order('first_name', { ascending: true });
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Users fetch error:", error);
        throw error;
      }

      const mappedUsers: ExtendedUser[] = (data || []).map((user: IUser) => ({
        ...user,
        role: {
          id: user.role_id,
          role_name: user.role_id ? (roleMap[user.role_id] || 'No Role') : 'No Role'
        }
      }));

      setAllUsers(mappedUsers);
      setPagination({
        total: count || 0,
        totalPages: Math.ceil((count || 0) / itemsPerPage)
      });
    } catch (error: any) {
      console.error("Fetch Error =>", error.message || error);
      toast.error("Failed to fetch users: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const exportUsersToCSV = async () => {
    const user = JSON.parse(localStorage.getItem('userData') || '{}');

    await exportSupabaseTableToCSV<IUser>({
      reportTitle: 'Users Data',
      headers: ['Employee ID', 'First Name', 'Last Name', 'Email', 'Department', 'Role', 'Status'],
      rowMapper: (user: any) => [
        `"${user.employee_id}"`,
        `"${user.first_name}"`,
        `"${user.last_name}"`,
        `"${user.email}"`,
        `"${user.department?.department_name || 'No Department'}"`,
        `"${user.role_data.name}"`,
        `"${user.status}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('user_mgmt')
          .select(`*,
            role_data:role_master!user_mgmt_role_id_fkey(name),
            department:department_master!user_mgmt_department_id_fkey(id,department_name)`)
          .eq('is_active', true)
          .eq('company_id', user?.company_id || '');

        query = query.order('status', { ascending: true });

        if (searchQuery) {
          const sanitizedQuery = searchQuery.replace(/[%_]/g, '');
          const searchConditions = [
            `email.ilike.%${sanitizedQuery}%`,
            `first_name.ilike.%${sanitizedQuery}%`,
            `last_name.ilike.%${sanitizedQuery}%`
          ];
          query = query.or(searchConditions.join(','));
        }

        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        if (filterRole !== 'all') {
          query = query.eq('role_id', filterRole);
        }

        if (filterDepartment !== 'all') {
          query = query.eq('department_id', filterDepartment);
        }

        if (sortConfig.field && sortConfig.direction) {
          query = query.order(sortConfig.field, {
            ascending: sortConfig.direction === 'asc',
          });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as IUser[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export users: ${err.message}`),
    });
  };

  // Load roles and active store users on component mount
  useEffect(() => {
    fetchRoles();
    fetchUsersInActiveStores();
    fetchDepartments();
  }, []);

  // Refetch users when filters/pagination/sort change
  useEffect(() => {
    fetchAllUsers();
  }, [currentPage, itemsPerPage, sortConfig, searchQuery, filterStatus, filterRole, filterDepartment]);

  const deleteUser = async () => {
    if (!userToDelete) return;

    try {
      const isLocked = await checkEntityLock(userToDelete.id);
      if (isLocked) {
        toast.error("This user is currently locked because it has a pending approval request.", { position: "top-center" });
        setIsDialogOpen(false);
        setUserToDelete(undefined);
        return;
      }

      // 1. Fetch Module and Action IDs
      const { data: moduleData } = await supabase
        .from('main_modules')
        .select('id')
        .eq('module_name', 'Users')
        .single();

      const { data: actionData } = await supabase
        .from('available_actions')
        .select('id')
        .eq('action_name', 'Delete')
        .single();

      // 2. Check Workflow Configuration
      let workflowConfig = null;
      if (moduleData && actionData && companyId) {
        const { data: wfData } = await supabase
          .from('workflow_config')
          .select('*')
          .eq('module_id', moduleData.id)
          .eq('action_id', actionData.id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('level', { ascending: true });

        if (wfData && wfData.length > 0) {
          workflowConfig = wfData;
        }
      }

      // 3. Initiate Approval Request if Workflow exists
      if (workflowConfig && moduleData && actionData && userData) {
        const payload = {
          operations: [
            {
              table: 'user_mgmt',
              type: 'update',
              match: { id: userToDelete.id },
              data: { is_active: false }
            },
            {
              table: 'workflow_config',
              type: 'update',
              match: { assigned_to: userToDelete.id },
              data: { is_active: false }
            },
            {
              table: 'module_permissions',
              type: 'delete',
              match: { user_id: userToDelete.id }
            },
            {
              table: 'system_log',
              type: 'insert',
              data: {
                company_id: companyId,
                transaction_date: new Date().toISOString(),
                module: 'User Management',
                scope: 'Delete',
                key: userToDelete.email,
                log: `User: ${userToDelete.email} deleted.`,
                action_by: userData.id,
                created_at: new Date().toISOString()
              }
            }
          ]
        };

        await initiateApprovalRequest({
          module_name: 'Users',
          action_name: 'Delete',
          company_id: companyId,
          requested_by: userData.id,
          action_payload: payload,
          entity_id: userToDelete.id,
        });

        toast.success('User deletion request submitted for approval', { position: 'top-right' });
        fetchAllUsers();
        setIsDialogOpen(false);
        setUserToDelete(undefined);
        return;
      }

      // 4. Direct Delete if no workflow
      const { error } = await supabase
        .from('user_mgmt')
        .update({ is_active: false })
        .eq('id', userToDelete.id);

      if (error) throw error;

      // Delete user profile image if present
      if (
        userToDelete.image &&
        typeof userToDelete.image === "object" &&
        "path" in userToDelete.image
      ) {
        const filePath = (userToDelete.image as { path: string }).path;

        try {
          const res = await fetch(`${supabaseUrl}functions/v1/delete-profile-image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ filePath }),
          });

          if (!res.ok) {
            const errData = await res.json();
            console.error("Profile image delete failed:", errData);
          } else {
            console.log("Profile image deleted successfully");
          }
        } catch (imgErr) {
          console.error("Error deleting profile image:", imgErr);
        }
      }

      // Create system log entry
      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: 'User Management',
        scope: 'Delete',
        key: `${userToDelete.email}`,
        log: `User: ${userToDelete.email} deleted.`,
        action_by: userData.id,
        created_at: new Date().toISOString(),
      };

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;

      const { error: workFlowUpdateError } = await supabase
        .from('workflow_config')
        .update({ is_active: false })
        .eq('assigned_to', userToDelete.id);

        if(workFlowUpdateError) throw error;

      const { error: permissionDeletionError } = await supabase
        .from('module_permissions')
        .delete()
        .eq('user_id', userToDelete.id);

        if(permissionDeletionError) throw error;

      toast.success("User deleted successfully!", { position: 'top-right' });
      fetchAllUsers();
      setIsDialogOpen(false);
      setUserToDelete(undefined);
    } catch (error: any) {
      console.error("Delete error =>", error.message || error);
      toast.error("Failed to delete user");
      setIsDialogOpen(false);
      setUserToDelete(undefined);
    }
  };

  const openDeleteDialog = (user: IUser) => {
    setUserToDelete(user);
    setIsDialogOpen(true);
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterRole('all');
    setFilterDepartment('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: null, direction: null });
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-300';
    return statusColorMap[status as keyof typeof statusColorMap] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    User Management
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage your system users and their permissions
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        variant="outline"
                                        onClick={exportUsersToCSV}
                                        className="transition-colors"
                                        disabled={users.length === 0 || !hasPermission('Export')}
                                      >
                                        <Download className="mr-2 h-4 w-4" />
                  <span>Export CSV</span>
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
              
                                  <TooltipContent>
                                    {hasPermission('Export')
                                      ? 'Export CSV'
                                      : 'You do not have permission to export users'}
                                  </TooltipContent>
                                </Tooltip>
              
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Button
                                        onClick={() => navigate('/dashboard/users/add')}
                                        className="transition-colors"
                                        disabled={!hasPermission('Add')}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add User
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
              
                                  <TooltipContent>
                                    {hasPermission('Add')
                                      ? 'Add User'
                                      : 'You do not have permission to add users'}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap">
                <div className="relative flex-1 w-full sm:w-auto min-w-[300px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by Employee ID, Name or Email..."
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
                    value={filterStatus}
                    onValueChange={(value) => {
                      setFilterStatus(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterRole}
                    onValueChange={(value) => {
                      setFilterRole(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name || 'Unnamed Role'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterDepartment}
                    onValueChange={(value) => {
                      setFilterDepartment(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={handleFilterReset}
                    className="px-3 py-2 text-sm"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-gray-50 border-gray-200">
                    <TableHead className="font-semibold w-[140px]">
                      <p
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 px-2"
                        onClick={() => handleSort('employee_id')}
                      >
                        Employee ID
                        {getSortIcon('employee_id')}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold w-1/6">
                      <p
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        onClick={() => handleSort('first_name')}
                      >
                        First Name
                        {getSortIcon('first_name')}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold w-1/6">
                      <p
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        onClick={() => handleSort('last_name')}
                      >
                        Last Name
                        {getSortIcon('last_name')}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <p
                        className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                        onClick={() => handleSort('email')}
                      >
                        Email
                        {getSortIcon('email')}
                      </p>
                    </TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(itemsPerPage).fill(0).map((_, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell><div className='px-2'><div className="h-4 w-25 bg-gray-200 rounded animate-pulse"></div></div></TableCell>
                        <TableCell><div className="h-4 w-30 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-30 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell className="text-center"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                        <TableCell className="text-center"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-center gap-2">
                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => {
                      const isSuperAdmin = user.role.role_name === 'Super Admin';
                      const isStoreManagerInActiveStore = usersInActiveStores.has(user.id);
                      const isApprover = usersInApprovalList.has(user.id);
                      const isDeleteDisabled = isSuperAdmin || isStoreManagerInActiveStore || isApprover || !hasPermission('Delete');

                      return (
                        <TableRow key={user.id} className="hover:bg-gray-50">
                          <TableCell className='font-medium'>
                            <span className="font-medium px-2">
                              {user.employee_id || ''}
                            </span></TableCell>
                          <TableCell className="font-medium py-3">{user.first_name}</TableCell>
                          <TableCell className="font-medium py-3">{user.last_name || ''}</TableCell>
                          <TableCell>{user.email || 'No Email'}</TableCell>
                          <TableCell>
                            {user.department?.department_name || 'No Department'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-300 font-medium">
                              <UserRound className="h-3 w-3 mr-1" />
                              {user.role.role_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={`capitalize ${getStatusColor(user.status)} font-medium`}
                            >
                              {user.status || 'No Status'}
                            </Badge>
                            {user.status === 'inactive' && user.failed_attempts === 3 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="capitalize font-medium ms-1 bg-gray-100 text-gray-800 border-gray-300"
                                  >
                                    <Lock />
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Account is locked.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-center gap-2">
                              {/* View Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigate(`/dashboard/users/view/${user.id}`)}
                                    disabled={!hasPermission('View')}
                                    className={!hasPermission('View') ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                   {hasPermission('View')
                                    ? 'View user details'
                                    : 'You do not have permission to view users'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Edit Button */}
                               <Tooltip>
                                                              <TooltipTrigger asChild>
                                                                <div>
                                                                  <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => navigate(`/dashboard/users/edit/${user.id}`)}
                                disabled={!hasPermission('Edit')}
                                      className={!hasPermission('Edit') ? 'opacity-50 cursor-not-allowed' : ''}
                                                                  >
                                                                    <Edit className="h-4 w-4" />
                                                                  </Button>
                                                                </div>
                                                              </TooltipTrigger>
                                                              <TooltipContent>
                                                                {hasPermission('Edit')
                                                                  ? 'Edit User'
                                                                  : 'You do not have permission to edit users'}
                                                              </TooltipContent>
                                                            </Tooltip>

                              {/* Delete Button */}
                              {isDeleteDisabled ? (
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
                                      {isSuperAdmin
                                        ? 'Cannot delete Superadmin users.' :
                                        !hasPermission('Delete') ?
                                        'You do not have permission to delete users.' :
                                        isApprover ? 
                                        'User is assigned as approver for workflows' :
                                        'This user is an active store manager and cannot be deleted.'}
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
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => openDeleteDialog(user)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete User</p>
                                  </TooltipContent>
                                </Tooltip>
                               
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center py-6">
                          <UserRound className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-base font-medium">No users found</p>
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
                <p className="text-sm text-muted-foreground">Show</p>
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
                <p className="text-sm text-muted-foreground">entries</p>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Showing {pagination.total > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to{' '}
                  {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} entries
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
              <DialogDescription>
                Are you sure you want to delete this user?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setUserToDelete(undefined)}>
                  No
                </Button>
              </DialogClose>
              <Button variant="destructive" onClick={deleteUser}>
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
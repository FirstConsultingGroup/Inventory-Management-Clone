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
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Filter, Store, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronDown, ChevronRight as ChevronRightIcon, Building2, MapPin } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/Utils/types/supabaseClient';  // Import Supabase client
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
import { IUser, IStore } from '@/Utils/constants';
import { exportSupabaseTableToCSV } from '@/Utils/csvExport';
import { initiateApprovalRequest, loadModulePermissions, checkEntityLock } from '@/Utils/commonFun';

interface ExtendedUser extends IUser {
  role: {
    id: string | null;
    role_name: string;
  };
}

export interface ExtendedStore extends IStore {
  parent_store?: {
    id: string;
    name: string;
    type: string;
  } | null;
  store_manager?: {
    first_name: string;
    last_name: string;
  } | null;
  is_parent: boolean;
}

interface TreeNode {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  store_manager?: {
    first_name: string;
    last_name: string;
  } | null;
  children: TreeNode[];
}

// Sort configuration
type SortField = 'code' | 'name' | 'address' | 'type' | 'parent_store' | 'store_manager';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

export const StoreManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [stores, setStores] = useState<ExtendedStore[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
  });
  const [storeTypeFilter, setStoreTypeFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('all');
  const [parentStoreFilter, setParentStoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managers, setManagers] = useState<string[]>([]);
  const [storeNames, setStoreNames] = useState<string[]>([]);
  const [parentStores, setParentStores] = useState<ExtendedStore[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<IStore>();
  const [purchaseOrderStoreIds, setPurchaseOrderStoreIds] = useState<string[]>([]);
  const [authorizedStoreIds , setAuthorizedStoreIds] = useState<any[]>([]);
  
  // Tree view state
  const [storeTree, setStoreTree] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [modulePermissions, setModulePermissions] = useState<any[]>([]);

  
  const user = localStorage.getItem('userData');
  const userData = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || '';
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';


  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    direction: null,
  });

  const storeTypes = ['all', 'Central Store', 'Branch Store'];

  // Debounce search to avoid too many API calls
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

   useEffect(() => {
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Store Management', userData.user_id);
        console.log(res)
        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [userData?.user_id, userData?.role_id]);

    useEffect(() => {
          const fetchUserStores = async () => {
            if (!companyId) return;
  
      try {
        const { data, error } = await supabase
          .from('user_mgmt')
          .select('stores')
          .eq('company_id', companyId)
  
        if (error) throw error;
  
        if (data) {
          const authorizedStores = (data as any[])
            .flatMap(authStores => authStores.stores || []);
          setAuthorizedStoreIds(authorizedStores)
        }
      } catch (error) {
        console.error('Error fetching user stores:', error);
      } 
    };
  
    fetchUserStores();
    }, [])

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
    setCurrentPage(1); // Reset to first page when sorting
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

  // Recursive function to build tree nodes
  const buildNode = useCallback((store: ExtendedStore, childrenMap: { [key: string]: ExtendedStore[] }, expandedNodes: Set<string>): TreeNode => {
    const kids = childrenMap[store.id] || [];
    kids.sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: store.id,
      code: store.code || '',
      name: store.name,
      type: store.type,
      address: store.address || '',
      store_manager: store.store_manager,
      children: kids.map((child) => buildNode(child, childrenMap, expandedNodes)),
    };
  }, []);

  // Build tree structure with multiple levels
  const buildStoreTree = useCallback((allStores: ExtendedStore[]): TreeNode[] => {
    const childrenMap: { [key: string]: ExtendedStore[] } = {};

    allStores.forEach((store) => {
      if (store.parent_id) {
        if (!childrenMap[store.parent_id]) {
          childrenMap[store.parent_id] = [];
        }
        childrenMap[store.parent_id].push(store);
      }
    });

    const roots = allStores
      .filter((store) => !store.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((root) => buildNode(root, childrenMap, expandedNodes));

    return roots;
  }, [buildNode, expandedNodes]);

  // Function to get all expandable node IDs
  const getAllExpandableNodes = (nodes: TreeNode[]): string[] => {
    let ids: string[] = [];
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        ids.push(node.id);
        ids = ids.concat(getAllExpandableNodes(node.children));
      }
    });
    return ids;
  };

  // Fetch tree data
  const fetchTreeData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('store_mgmt')
        .select(`
          id,
          code,
          name,
          type,
          address,
          parent_id,
          store_manager_id,
          user_mgmt:store_manager_id(first_name, last_name)
        `)
        .eq('is_active', true)
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;

      // Fetch child stores to compute is_parent
      const { data: childStoresData, error: childStoresError } = await supabase
        .from('store_mgmt')
        .select('parent_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('parent_id', 'is', null);

      if (childStoresError) throw childStoresError;

      const parentStoreIds = new Set(childStoresData.map((store: any) => store.parent_id));

      const mappedStores: ExtendedStore[] = data.map((store: any) => ({
        ...store,
        store_manager: store.user_mgmt ? {
          first_name: store.user_mgmt.first_name,
          last_name: store.user_mgmt.last_name,
        } : null,
        is_parent: parentStoreIds.has(store.id),
      })) as ExtendedStore[];

      const tree = buildStoreTree(mappedStores);
      setStoreTree(tree);
    } catch (err: any) {
      console.error('Error fetching tree data:', err);
    }
  }, [companyId, buildStoreTree]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (expandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId);
    } else {
      newExpandedNodes.add(nodeId);
    }
    setExpandedNodes(newExpandedNodes);
  };

  // Render tree node
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    
    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center py-2 px-3 hover:bg-gray-50 rounded-md cursor-pointer ${
            level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''
          }`}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          <div className="flex items-center space-x-2 flex-1">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-gray-500" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
            
            <div className={`p-1.5 rounded ${node.type === 'Central Store' ? 'bg-blue-100' : 'bg-green-100'}`}>
              {node.type === 'Central Store' ? (
                <Building2 className={`h-4 w-4 ${node.type === 'Central Store' ? 'text-blue-600' : 'text-green-600'}`} />
              ) : (
                <Store className={`h-4 w-4 ${node.type === 'Central Store' ? 'text-blue-600' : 'text-green-600'}`} />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{node.name}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {node.code}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  node.type === 'Central Store' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {node.type}
                </span>
              </div>
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[200px]" title={node.address}>
                    {node.address || 'No address'}
                  </span>
                </div>
                {node.store_manager && (
                  <span>
                    Manager: {node.store_manager.first_name} {node.store_manager.last_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Recursive function to count descendants
  const countDescendants = (node: TreeNode): number => {
    return node.children.length + node.children.reduce((acc, child) => acc + countDescendants(child), 0);
  };

  // Fetch managers, store names, and parent stores for filters
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        // Fetch all roles to find the "Store Manager" role ID
        const { data: rolesData, error: rolesError } = await supabase
          .from("role_master")
          .select("id, name")
          .eq('is_active', true)
          .eq('company_id', companyId);

        if (rolesError) throw rolesError;

        const storeManagerRole = rolesData.find((role: any) => role.name === "Store Manager");
        if (!storeManagerRole) {
          throw new Error("Store Manager role not found in role_master table");
        }

        // Create a role lookup map
        const roleMap = rolesData.reduce((acc: any, role: any) => {
          acc[role.id] = role.name;
          return acc;
        }, {});

        // Fetch store managers
        const { data: usersData, error: usersError } = await supabase
          .from("user_mgmt")
          .select(`
            id,
            first_name,
            last_name,
            email,
            role_id,
            status
          `)
          .eq('company_id', companyId)
          .eq("is_active", true)
          .eq("role_id", storeManagerRole.id)

        if (usersError) throw usersError;

        const mappedManagers: any[] = usersData.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          status: user.status,
          is_active: user.is_active ?? true,
          created_at: user.created_at ?? '',
          modified_at: user.modified_at ?? '',
          company_id: user.company_id ?? '',
          last_login_date: user.last_login_date ?? '',
          role: {
            id: user.role_id ?? null,
            role_name: roleMap[user.role_id] ?? "No Role",
          },
        }));

        const managerNames = mappedManagers
          .map((manager: ExtendedUser) => `${manager.first_name} ${manager.last_name}`)
          .filter(Boolean);
        setManagers(['all', ...managerNames]);

        // Fetch all active stores for names and parent stores
        const { data: storesData, error: storesError } = await supabase
          .from("store_mgmt")
          .select(`
            id,
            name,
            type,
            parent_id
          `)
          .eq('company_id', companyId)
          .eq("is_active", true);

        if (storesError) throw storesError;

        const storeNames = storesData.map((store: any) => store.name);
        setStoreNames(['all', ...storeNames]);

        // Build unique parent stores array
        const parentStoresArr: any[] = [];
        storesData.forEach((store: any) => {
          if (store.parent_id) {
            const parentStore = storesData.find((s: any) => s.id === store.parent_id);
            if (parentStore && !parentStoresArr.some((p) => p.id === parentStore.id)) {
              parentStoresArr.push({
                id: parentStore.id,
                name: parentStore.name,
                type: parentStore.type,
              });
            }
          }
        });
        setParentStores([{ id: 'all', name: 'All Parent Stores', type: '' } as ExtendedStore, ...parentStoresArr]);
      } catch (error: any) {
        console.error('Error fetching filter data:', error.message);
        setError('Failed to fetch filter data');
      }
    };

    fetchFilterData();
  }, [companyId]);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Get company ID from userData in local storage
    const userDataString = localStorage.getItem('userData');
    let companyId = null;
    if (userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        companyId = userData.company_id;
      } catch (e) {
        setError('Invalid user data in local storage');
        setLoading(false);
        return;
      }
    }
    if (!companyId) {
      setStores([]);
      setPagination({ total: 0, totalPages: 0 });
      setLoading(false);
      setError('Company ID not found in user data');
      return;
    }

    try {
      // Get total count first (without joins for accurate counting)
      let countQuery = supabase
        .from('store_mgmt')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('company_id', companyId); // <-- Filter by company_id

      // Apply search filter for count
      if (debouncedSearchQuery.trim()) {
        countQuery = countQuery.or(
          `name.ilike.%${debouncedSearchQuery}%,code.ilike.%${debouncedSearchQuery}%`
        );
      }

      // Apply store type filter for count
      if (storeTypeFilter !== 'all') {
        countQuery = countQuery.eq('type', storeTypeFilter);
      }

      // Apply store name filter for count
      if (nameFilter !== 'all') {
        countQuery = countQuery.eq('name', nameFilter);
      }

      // Apply parent store filter for count
      if (parentStoreFilter !== 'all') {
        countQuery = countQuery.eq('parent_id', parentStoreFilter);
      }

      // Apply manager filter for count
      if (managerFilter !== 'all') {
        // First get the manager ID
        const { data: managersData, error: managersError } = await supabase
          .from('user_mgmt')
          .select('id, first_name, last_name')
          .eq('company_id', companyId)
          .eq('is_active', true);

        if (managersError) throw managersError;

        const managerId = managersData.find(
          (manager: any) => `${manager.first_name} ${manager.last_name}` === managerFilter
        )?.id;

        if (managerId) {
          countQuery = countQuery.eq('store_manager_id', managerId);
        }
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Now fetch the actual data with sorting and pagination
      let query = supabase
        .from('store_mgmt')
        .select(`
          *,
          parent_stores:parent_id(id, name, type),
          user_mgmt:store_manager_id(first_name, last_name)
        `)
        .eq('is_active', true)
        .eq('company_id', companyId); // <-- Filter by company_id

      // Apply search filter
      if (debouncedSearchQuery.trim()) {
        query = query.or(
          `name.ilike.%${debouncedSearchQuery}%,code.ilike.%${debouncedSearchQuery}%`
        );
      }

      // Apply store type filter
      if (storeTypeFilter !== 'all') {
        query = query.eq('type', storeTypeFilter);
      }

      // Apply store name filter
      if (nameFilter !== 'all') {
        query = query.eq('name', nameFilter);
      }

      // Apply parent store filter
      if (parentStoreFilter !== 'all') {
        query = query.eq('parent_id', parentStoreFilter);
      }

      // Apply manager filter
      if (managerFilter !== 'all') {
        // First get the manager ID
        const { data: managersData, error: managersError } = await supabase
          .from('user_mgmt')
          .select('id, first_name, last_name')
          .eq('company_id', companyId)
          .eq('is_active', true);

        if (managersError) throw managersError;

        const managerId = managersData.find(
          (manager: any) => `${manager.first_name} ${manager.last_name}` === managerFilter
        )?.id;

        if (managerId) {
          query = query.eq('store_manager_id', managerId);
        }
      }

      // Apply sorting
      if (sortConfig.field && sortConfig.direction) {
        const ascending = sortConfig.direction === 'asc';

        switch (sortConfig.field) {
          case 'code':
          case 'name':
          case 'address':
          case 'type':
            query = query.order(sortConfig.field, { ascending });
            break;
          case 'parent_store':
            // For parent store sorting, we need to use the referenced table
            query = query.order('parent_stores.name', {
              ascending,
              foreignTable: 'parent_stores',
              nullsFirst: !ascending
            });
            break;
          case 'store_manager':
            // For store manager sorting, we need to use the referenced table
            query = query.order('user_mgmt.first_name', {
              ascending,
              foreignTable: 'user_mgmt',
              nullsFirst: !ascending
            });
            break;
          default:
            query = query.order('name', { ascending: true });
        }
      } else {
        // Default sorting by name if no sort is applied
        query = query.order('name', { ascending: true });
      }

      // Apply pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = currentPage * itemsPerPage - 1;
      query = query.range(startIndex, endIndex);

      const { data, error } = await query;

      if (error) throw error;

      // Check which stores are parent stores (have children)
      const { data: childStoresData, error: childStoresError } = await supabase
        .from('store_mgmt')
        .select('parent_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('parent_id', 'is', null);

      if (childStoresError) throw childStoresError;

      const parentStoreIds = new Set(childStoresData.map((store: any) => store.parent_id));

      // Map the data to the Store interface
      const mappedStores = data.map((store: any) => ({
        ...store,
        is_parent: parentStoreIds.has(store.id),
        store_manager: store.user_mgmt ? {
          first_name: store.user_mgmt.first_name,
          last_name: store.user_mgmt.last_name,
        } : null,
        parent_store: store.parent_stores ? {
          id: store.parent_stores.id,
          name: store.parent_stores.name,
          type: store.parent_stores.type,
        } : null,
      })) as ExtendedStore[];

      setStores(mappedStores);
      setPagination({
        total: count || 0,
        totalPages: Math.ceil((count || 0) / itemsPerPage),
      });
    } catch (err: any) {
      console.error('Error fetching stores:', err);
      setError(err.message || 'An error occurred while fetching stores');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchQuery, storeTypeFilter, managerFilter, nameFilter, parentStoreFilter, itemsPerPage, sortConfig]);

  useEffect(() => {
    fetchStores();
    fetchTreeData();
  }, [fetchStores, fetchTreeData]);

  useEffect(() => {
    const fetchAllPOstoreIds = async () => {
      if (!companyId) return;
      try {
        const { data, error } = await supabase
          .rpc('get_store_ids_from_purchase_orders', { p_company_id: companyId });

        if (error) throw error;

        if (data) {
          setPurchaseOrderStoreIds(data as string[]);
        }
      } catch (error) {
        console.error("Error fetchAllPOstoreIds:", error);
        // toast.error("Failed to fetch store ids.", { position: "top-right" });
        setPurchaseOrderStoreIds([]);
      }
    }

    fetchAllPOstoreIds();
  }, [companyId])

  const exportStoresToCSV = async () => {

    await exportSupabaseTableToCSV<IStore>({
      reportTitle: 'Stores Data',
      headers: ['Store ID', 'Store Name', 'Address', 'Store Type', 'Parent Store', 'Store Manager'],
      rowMapper: (store: any) => [
        `"${store.code}"`,
        `"${store.name}"`,
        `"${store.address}"`,
        `"${store.type}"`,
        `"${store.parent_store?.name || ''}"`,
        `"${store.store_manager ? `${store.store_manager.first_name} ${store.store_manager.last_name}` : ''}"`,
      ],
      supabaseClient: supabase,
      fetcher: async () => {
        let query = supabase
          .from('store_mgmt')
          .select(`
            *,
            parent_store:parent_id(name),
            store_manager:user_mgmt!store_mgmt_store_manager_id_fkey(first_name, last_name)`)
          .eq('is_active', true)
          .eq('company_id', companyId);

        if (debouncedSearchQuery) {
          const sanitizedQuery = debouncedSearchQuery.replace(/[%_]/g, '');
          const searchConditions = [
            `name.ilike.%${sanitizedQuery}%`,
            `code.ilike.%${sanitizedQuery}%`
          ];
          query = query.or(searchConditions.join(','));
        }

        // Apply store type filter
        if (storeTypeFilter !== 'all') {
          query = query.eq('type', storeTypeFilter);
        }

        // Apply store name filter
        if (nameFilter !== 'all') {
          query = query.eq('name', nameFilter);
        }

        // Apply parent store filter
        if (parentStoreFilter !== 'all') {
          query = query.eq('parent_id', parentStoreFilter);
        }

        // Apply manager filter for count
        if (managerFilter !== 'all') {
          // First get the manager ID
          const { data: managersData, error: managersError } = await supabase
            .from('user_mgmt')
            .select('id, first_name, last_name')
            .eq('company_id', companyId)
            .eq('is_active', true);

          if (managersError) throw managersError;

          const managerId = managersData.find(
            (manager: any) => `${manager.first_name} ${manager.last_name}` === managerFilter
          )?.id;

          if (managerId) {
            query = query.eq('store_manager_id', managerId);
          }
        }

        if (sortConfig.field && sortConfig.direction) {
          const ascending = sortConfig.direction === 'asc';

          switch (sortConfig.field) {
            case 'code':
            case 'name':
            case 'address':
            case 'type':
              query = query.order(sortConfig.field, { ascending });
              break;
            case 'parent_store':
              // For parent store sorting, we need to use the referenced table
              query = query.order('parent_stores.name', {
                ascending,
                foreignTable: 'parent_stores',
                nullsFirst: !ascending
              });
              break;
            case 'store_manager':
              // For store manager sorting, we need to use the referenced table
              query = query.order('user_mgmt.first_name', {
                ascending,
                foreignTable: 'user_mgmt',
                nullsFirst: !ascending
              });
              break;
            default:
              query = query.order('name', { ascending: true });
          }
        } else {
          // Default sorting by name if no sort is applied
          query = query.order('name', { ascending: true });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as IStore[];
      },
      onError: (err: { message: any; }) => toast.error(`Failed to export stores: ${err.message}`),
    });
  };

  // Reset to page 1 when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, storeTypeFilter, managerFilter, nameFilter, parentStoreFilter, itemsPerPage]);

  const handleDeleteStore = async () => {
  if (!storeToDelete) return;

    const isLocked = await checkEntityLock(storeToDelete.id);
    if (isLocked) {
      toast.error("This record is currently locked because it has a pending approval request.", { position: "top-center" });
      return;
    }

  try {
    const payload = {
      is_active: false,
    };

    const systemLog = {
      company_id: companyId,
      transaction_date: new Date().toISOString(),
      module: 'Store Management',
      scope: 'Delete',
      key: storeToDelete.code,
      log: `Store ${storeToDelete.code} deleted.`,
      action_by: userData?.id,
      created_at: new Date().toISOString(),
    };

    const action_payload = {
      operations: [
        {
          table: 'store_mgmt',
          type: 'update',
          data: payload,
          match: {
            id: storeToDelete.id,
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
      module_name: 'Store Management',
      action_name: 'Delete',
      company_id: companyId || '',
      requested_by: userData?.id || '',
      action_payload,
      entity_id: storeToDelete.id,
    });

    if (approvalResponse?.success) {
      if (approvalResponse.requires_approval) {
        toast.success(
          'Your action has been submitted and is currently pending approval.',
          {
            position: 'top-center',
          }
        );

        setIsDialogOpen(false);
        setStoreToDelete(undefined);
        return;
      }

      const { error: deleteError } = await supabase
        .from('store_mgmt')
        .update(payload)
        .eq('id', storeToDelete.id)
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

      toast.success('Store deleted successfully!', {
        position: 'top-center',
      });

      fetchStores();
      fetchTreeData();

      setIsDialogOpen(false);
      setStoreToDelete(undefined);
    } else {
      throw new Error(
        approvalResponse?.message || 'Approval initiation failed'
      );
    }
  } catch (error: any) {
    console.error('Error deleting store:', error);

    toast.error(
      `Failed to delete store: ${
        error?.message || 'Unknown error'
      }`,
      {
        position: 'top-center',
      }
    );

    setIsDialogOpen(false);
    setStoreToDelete(undefined);
  }
};

  const openDeleteDialog = (store: IStore) => {
    setStoreToDelete(store);
    setIsDialogOpen(true);
  };

  const handleAddStore = () => {
    navigate('/dashboard/store/add');
  };

  const handleEditStore = (store: IStore) => {
    navigate(`/dashboard/store/edit/${store.id}`);
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setStoreTypeFilter('all');
    setManagerFilter('all');
    setNameFilter('all');
    setParentStoreFilter('all');
    setItemsPerPage(10);
    setCurrentPage(1);
    setSortConfig({ field: null, direction: null }); // Reset sorting
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
                    <Store className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Store Management
                    </CardTitle>
                    <CardDescription className="mt-1">
                      View your store details and storage capacity
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Button
                                          variant="outline"
                                          onClick={exportStoresToCSV}
                                          className="transition-colors"
                                          disabled={stores.length === 0 || !hasPermission('Export')}
                                        >
                                          <Download className="mr-2 h-4 w-4" />
                    <span>Export CSV</span>
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                
                                    <TooltipContent>
                                      {hasPermission('Export')
                                        ? 'Export CSV'
                                        : 'You do not have permission to export stores'}
                                    </TooltipContent>
                                  </Tooltip>
                
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Button
                                          onClick={handleAddStore}
                                          className="transition-colors"
                                          disabled={!hasPermission('Add')}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add Store
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                
                                    <TooltipContent>
                                      {hasPermission('Add')
                                        ? 'Add Store'
                                        : 'You do not have permission to add stores'}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md flex justify-between items-center">
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-700 hover:text-red-900"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-col items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search stores by name or ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-full justify-between flex-wrap">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={storeTypeFilter} onValueChange={(value) => {
                      setStoreTypeFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by store type" />
                      </SelectTrigger>
                      <SelectContent>
                        {storeTypes.map(strType => (
                          <SelectItem key={strType} value={strType}>
                            {strType === 'all' ? 'All Store Types' : strType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={managerFilter} onValueChange={(value) => {
                      setManagerFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map(manager => (
                          <SelectItem key={manager} value={manager}>
                            {manager === 'all' ? 'All Managers' : manager}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={nameFilter} onValueChange={(value) => {
                      setNameFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by name" />
                      </SelectTrigger>
                      <SelectContent>
                        {storeNames.map(name => (
                          <SelectItem key={name} value={name}>
                            {name === 'all' ? 'All Store Names' : name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={parentStoreFilter} onValueChange={(value) => {
                      setParentStoreFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filter by parent store" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
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
                      <TableHead className="font-semibold w-1/4">
                        <p
                          className="h-8 flex items-center text-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600 ps-2"
                          onClick={() => handleSort('code')}
                        >
                          Store ID
                          {getSortIcon('code')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                          onClick={() => handleSort('name')}
                        >
                          Store Name
                          {getSortIcon('name')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                          onClick={() => handleSort('address')}
                        >
                          Address
                          {getSortIcon('address')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                          onClick={() => handleSort('type')}
                        >
                          Store Type
                          {getSortIcon('type')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                          onClick={() => handleSort('parent_store')}
                        >
                          Parent Store
                          {getSortIcon('parent_store')}
                        </p>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <p
                          className="h-8 flex items-center gap-1 font-semibold cursor-pointer w-auto hover:text-blue-600"
                          onClick={() => handleSort('store_manager')}
                        >
                          Store Manager
                          {getSortIcon('store_manager')}
                        </p>
                      </TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="py-3">
                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                          </TableCell>
                          <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto"></div></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : stores.length === 0 ? (
                      <TableRow className="hover:bg-gray-50">
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center py-6">
                            <p className="text-base font-medium">No stores found</p>
                            <p className="text-sm text-gray-500">Try adjusting your search or filter</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stores.map((store) => {
                        const isStoreUsedInPO = purchaseOrderStoreIds.includes(store.id);
                        const isStoreLinked = authorizedStoreIds.includes(store.id);
                        const isDeleteDisabled = store.is_parent || isStoreUsedInPO || !hasPermission('Delete') || isStoreLinked;

                        return (
                          <TableRow key={store.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium py-3"><p className='ps-2'>{store.code}</p></TableCell>
                            <TableCell className="font-medium">{store.name}</TableCell>
                            <TableCell className="min-w-[200px] whitespace-normal break-words" title={store.address ?? undefined}>
                              {store.address}
                            </TableCell>
                            <TableCell>{store.type}</TableCell>
                            <TableCell>{store.parent_store?.name || 'None'}</TableCell>
                            <TableCell>
                              {store.store_manager
                                ? `${store.store_manager.first_name} ${store.store_manager.last_name}`
                                : 'None'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-center gap-2">
                                <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleEditStore(store)}
                                      disabled={!hasPermission('Edit')}
                                      className={!hasPermission('Edit') ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasPermission('Edit')
                                    ? 'Edit Store'
                                    : 'You do not have permission to edit stores'}
                                </TooltipContent>
                              </Tooltip>
                  
                                {isDeleteDisabled ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="text-destructive hover:bg-destructive/10 opacity-50 cursor-pointer"
                                          disabled
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
  {store.is_parent
    ? "Deletion is restricted: This store is connected to a branch store and cannot be removed."
    : !hasPermission("Delete")
    ? "You do not have permission to delete stores"
    : isStoreLinked
    ? "Cannot delete this store. Users are assigned to this store."
    : "Cannot delete this store. Purchase orders are associated with this store."}
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
                                    className="text-destructive cursor-pointer hover:bg-destructive/10"
                                    onClick={() => openDeleteDialog(store)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Delete store</p>
                                    </TooltipContent>
                                  </Tooltip>                                  
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

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
                      disabled={currentPage === 1 || loading}
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
                      disabled={currentPage === pagination.totalPages || loading || pagination.totalPages === 0}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Store Hierarchy Tree View */}
          <Card className="shadow-sm">
            <CardHeader className="rounded-t-lg border-b pb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">
                    Store Hierarchy
                  </CardTitle>
                  <CardDescription className="mt-1">
                    View the hierarchical structure of central stores and their branches
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">
              {storeTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-600">No store hierarchy available</p>
                  <p className="text-sm text-gray-500">Add central stores and branch stores to see the hierarchy</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-600">
                        Total Central Stores: <span className="font-semibold">{storeTree.length}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Branch Stores: <span className="font-semibold">{storeTree.reduce((acc, root) => acc + countDescendants(root), 0)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedNodes(new Set())}
                        className="text-xs"
                      >
                        Collapse All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedNodes(new Set(getAllExpandableNodes(storeTree)))}
                        className="text-xs"
                      >
                        Expand All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg bg-gray-50/50 p-4 max-h-[600px] overflow-y-auto">
                    <div className="space-y-1">
                      {storeTree.map(node => renderTreeNode(node))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmation Dialog for Delete */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this store?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={() => setStoreToDelete(undefined)}>
                    No
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDeleteStore}
                >
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
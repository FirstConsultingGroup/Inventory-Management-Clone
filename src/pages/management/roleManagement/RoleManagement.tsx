import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  CheckCircle,
  Lock,
  Filter,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/Utils/types/supabaseClient';
import toast from 'react-hot-toast';
import type { IUser } from '@/Utils/constants';

// Types

type PermKey =
  | 'listing' | 'view' | 'add' | 'edit' | 'delete'
  | 'export' | 'print' | 'approve' | 'reject' | 'other'
  | 'access' | 'generate';

type PermState = Record<string, boolean>;
type RoleMeta  = { id: string; name: string };
type DeptMeta  = { id: string; department_name: string };
type StoreMeta = { id: string; name: string; location_id: string | null };
type LocMeta   = { id: string; location_name: string };

type PermContext = {
  roleId:       string;
  departmentId: string | null;
  storeId:      string | null;
};

type SubItem  = { key: string; label: string; permissions: PermKey[] };
type SubGroup = { key: string; label: string; permissions?: PermKey[]; items?: SubItem[] };
type Module   = { key: string; label: string; groups: SubGroup[] };

const PERM_LABELS: Record<PermKey, string> = {
  listing: 'Listing', view: 'View', add: 'Add', edit: 'Edit',
  delete: 'Delete', export: 'Export', print: 'Print', approve: 'Approve',
  reject: 'Reject', other: 'Other', access: 'Access', generate: 'Generate',
};

const MODULE_TREE: Module[] = [
  {
    key: 'Dashboards', label: 'Dashboards',
    groups: [
      {
        key: 'Dashboard', label: 'Inventory Overview',
        items: [
          { key: 'inv_total',    label: 'Total Items & Value',  permissions: ['view'] },
          { key: 'inv_category', label: 'Stocks by Category',   permissions: ['view'] },
          { key: 'inv_alerts',   label: 'Inventory Alerts',     permissions: ['view'] },
          { key: 'inv_fast',     label: 'Fast Moving Items',    permissions: ['view'] },
          { key: 'inv_slow',     label: 'Slow Moving Items',    permissions: ['view'] },
        ],
      },
      {
        key: 'Procurement Overview', label: 'Procurement Overview',
        items: [
          { key: 'proc_po_val',      label: 'Purchase Orders & Value',               permissions: ['view'] },
          { key: 'proc_req_status',  label: 'Requisition Status',                    permissions: ['view'] },
          { key: 'proc_monthly_vol', label: 'Monthly Volume',                        permissions: ['view'] },
          { key: 'proc_top_dept',    label: 'Top Departments',                       permissions: ['view'] },
          { key: 'proc_pr_sales',    label: 'Purchase Requisitions - Sales',         permissions: ['view'] },
          { key: 'proc_pr_inhouse',  label: 'Purchase Requisitions - In-House',      permissions: ['view'] },
          { key: 'proc_pr_reorder',  label: 'Purchase Requisitions - Reorder Items', permissions: ['view'] },
        ],
      },
      {
        key: 'Sales Overview', label: 'Sales Overview',
        items: [
          { key: 'sales_total',     label: 'Total Sales',          permissions: ['view'] },
          { key: 'sales_avg_daily', label: 'Average Daily Sales',  permissions: ['view'] },
          { key: 'sales_highest',   label: 'Highest Sale',         permissions: ['view'] },
          { key: 'sales_trend',     label: 'Sales Turnover Trend', permissions: ['view'] },
        ],
      },
    ],
  },
  {
    key: 'Masters', label: 'Masters',
    groups: [
      { key: 'Category Master',       label: 'Category Master',   permissions: ['listing','view','add','edit','delete','export'] },
      { key: 'Location Master',       label: 'Location Master',   permissions: ['listing','view','add','edit','delete','export'] },
      { key: 'Department Management', label: 'Department Master', permissions: ['listing','view','add','edit','delete','export'] },
      { key: 'Role Master',           label: 'Role Master',       permissions: ['listing','view','add','edit','delete','export'] },
    ],
  },
  {
    key: 'Access Control', label: 'Access Control',
    groups: [
      { key: 'Users',           label: 'Users', permissions: ['listing','view','add','edit','delete','export'] },
      { key: 'Role Management', label: 'Roles', permissions: ['access'] },
    ],
  },
  {
    key: 'Item Management', label: 'Item Management',
    groups: [
      { key: 'Item Configurator', label: 'Item Configurator', permissions: ['listing','add','edit','delete','export'] },
      { key: 'Item Master',       label: 'Item Master',       permissions: ['listing','view','add','edit','delete','export'] },
    ],
  },
  {
    key: 'Inventory', label: 'Inventory',
    groups: [
      {
        key: 'Inventory Management', label: 'Inventory Operations',
        permissions: ['listing'],
        items: [
          { key: 'inv_item_overview', label: 'Manage Item - Item Overview',         permissions: ['access'] },
          { key: 'inv_stock_levels',  label: 'Manage Item - Stock Levels',          permissions: ['access'] },
          { key: 'inv_po_transfer',   label: 'Manage Item - PO & Transfer History', permissions: ['access'] },
        ],
      },
      { key: 'Supplier Management', label: 'Suppliers', permissions: ['listing','view','add','edit','delete','export'] },
      {
        key: 'Store Management', label: 'Stores',
        permissions: ['listing','add','edit','delete','export'],
        items: [{ key: 'store_hierarchy', label: 'Store Hierarchy', permissions: ['view'] }],
      },
    ],
  },
  {
    key: 'Procurement', label: 'Procurement',
    groups: [
      {
        key: 'Purchase Requisitions', label: 'Purchase Requisitions',
        permissions: ['listing','view','add','edit','export','print'],
        items: [{ key: 'pr_approval_view', label: 'PR Approval View', permissions: ['view'] }],
      },
      { key: 'Purchase Requisition Approvals', label: 'Requisition Approvals', permissions: ['view','approve','reject'] },
      {
        key: 'Quotations', label: 'Quotations',
        permissions: ['listing','view','add','edit','export','print'],
        items: [{ key: 'quot_receive', label: 'Receive Quotation', permissions: ['other'] }],
      },
      {
        key: 'Purchase Order Management', label: 'Purchase Orders',
        permissions: ['listing','view','add','edit','export','print','delete'],
        items: [
          { key: 'po_approval_view', label: 'PO Approval View',         permissions: ['view']  },
          { key: 'po_duplicate',     label: 'Duplicate Purchase Order', permissions: ['other'] },
        ],
      },
      { key: 'Purchase Order Approvals', label: 'PO Approvals',      permissions: ['view','approve','reject'] },
      { key: 'Returns Eligible',         label: 'Return Eligibility', permissions: ['listing','view','export','print'] },
      { key: 'Returns Management',       label: 'Return Requests',    permissions: ['listing','view','add','edit','delete','export'] },
      { key: 'Purchase Return Requests', label: 'Return Approvals',   permissions: ['view','approve','reject'] },
    ],
  },
  {
    key: 'Sales', label: 'Sales',
    groups: [
      { key: 'Sales Invoice',   label: 'Sales Invoices', permissions: ['listing','view','add','edit','export','print'] },
      { key: 'Customer Master', label: 'Customers',      permissions: ['listing','view','add','edit','delete','export'] },
      {
        key: 'Sales Returns', label: 'Sales Returns',
        permissions: ['listing','view','add','edit','delete','export','print'],
        items: [{ key: 'sr_approval_view', label: 'View Return Approvals', permissions: ['view'] }],
      },
      { key: 'Sales Return Approvals', label: 'Return Approvals', permissions: ['view','approve','reject'] },
    ],
  },
  {
    key: 'Administration', label: 'Administration',
    groups: [
      {
        key: 'Workflow Configuration', label: 'Workflow Management',
        items: [
          { key: 'wf_po',        label: 'Purchase Order Workflow',       permissions: ['access'] },
          { key: 'wf_pr_return', label: 'Purchase Return Workflow',      permissions: ['access'] },
          { key: 'wf_pr',        label: 'Purchase Requisition Workflow', permissions: ['access'] },
          { key: 'wf_sr',        label: 'Sales Return Workflow',         permissions: ['access'] },
        ],
      },
      {
        key: 'Reports', label: 'Reports',
        items: [
          { key: 'rpt_stock', label: 'Stock Report',          permissions: ['generate','print','export'] },
          { key: 'rpt_sales', label: 'Sales Report',          permissions: ['generate','print','export'] },
          { key: 'rpt_po',    label: 'Purchase Order Report', permissions: ['generate','print','export'] },
        ],
      },
      { key: 'Audit Trail', label: 'Audit Logs', permissions: ['listing','export'] },
      {
        key: 'Administration', label: 'Admin Panel',
        items: [
          { key: 'admin_company',       label: 'Company Information',       permissions: ['access'] },
          { key: 'admin_tax',           label: 'Tax Information',           permissions: ['access'] },
          { key: 'admin_discount',      label: 'Global Discount',           permissions: ['access'] },
          { key: 'admin_empid',         label: 'Employee ID Configuration', permissions: ['access'] },
          { key: 'admin_settings',      label: 'System Settings',           permissions: ['access'] },
          { key: 'admin_report_custom', label: 'Report Customization',      permissions: ['access'] },
        ],
      },
    ],
  },
];

function buildPermKey(groupKey: string, perm: PermKey, itemKey?: string): string {
  return itemKey ? `${groupKey}__${itemKey}__${perm}` : `${groupKey}__${perm}`;
}

function getAllKeys(): string[] {
  const keys: string[] = [];
  for (const mod of MODULE_TREE) {
    for (const grp of mod.groups) {
      grp.permissions?.forEach(p => keys.push(buildPermKey(grp.key, p)));
      grp.items?.forEach(item =>
        item.permissions.forEach(p => keys.push(buildPermKey(grp.key, p, item.key)))
      );
    }
  }
  return keys;
}

function getGroupKeys(grp: SubGroup): string[] {
  const keys: string[] = [];
  grp.permissions?.forEach(p => keys.push(buildPermKey(grp.key, p)));
  grp.items?.forEach(item =>
    item.permissions.forEach(p => keys.push(buildPermKey(grp.key, p, item.key)))
  );
  return keys;
}

function defaultPermState(): PermState {
  return getAllKeys().reduce((acc, k) => { acc[k] = false; return acc; }, {} as PermState);
}

const NONE = '__none__';

export const RoleManagement = () => {
  const navigate = useNavigate();

  const [roles,          setRoles]          = useState<RoleMeta[]>([]);
  const [departments,    setDepartments]    = useState<DeptMeta[]>([]);
  const [allStores,      setAllStores]      = useState<StoreMeta[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreMeta[]>([]);
  const [locations,      setLocations]      = useState<LocMeta[]>([]);
  const [refLoading,     setRefLoading]     = useState(true);

  const [filterDept,     setFilterDept]     = useState<string>(NONE);
  const [filterRole,     setFilterRole]     = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>(NONE);
  const [filterStore,    setFilterStore]    = useState<string>(NONE);

  const [activeCtx,           setActiveCtx]           = useState<PermContext | null>(null);
  const [permissions,         setPermissions]         = useState<PermState>(defaultPermState());
  const [originalPermissions, setOriginalPermissions] = useState<PermState>(defaultPermState());
  const [ctxLoading,          setCtxLoading]          = useState(false);

  const [hasChanges,      setHasChanges]      = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(MODULE_TREE.map(m => m.key))
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery,    setSearchQuery]    = useState('');

  const userDataString = localStorage.getItem('userData');
  const userData: IUser | null = userDataString ? JSON.parse(userDataString) : null;

  useEffect(() => { if (!userData) navigate('/dashboard'); }, [userData, navigate]);
  if (!userData) return null;

  // Load all reference data
  useEffect(() => {
    const load = async () => {
      setRefLoading(true);
      const [roleRes, deptRes, storeRes, locRes] = await Promise.all([
        supabase.from('role_master').select('id, name')
          .eq('company_id', userData.company_id).eq('is_active', true).order('name'),
        supabase.from('department_master').select('id, department_name')
          .eq('company_id', userData.company_id).eq('is_active', true).order('department_name'),
        supabase.from('store_mgmt').select('id, name, location_id')
          .eq('company_id', userData.company_id).eq('is_active', true).order('name'),
        supabase.from('location_master').select('id, location_name')
          .eq('company_id', userData.company_id).eq('is_active', true).order('location_name'),
      ]);

      if (roleRes.error)  toast.error('Failed to load roles');
      if (deptRes.error)  toast.error('Failed to load departments');
      if (storeRes.error) toast.error('Failed to load stores');
      if (locRes.error)   toast.error('Failed to load locations');

      const roleList: any[]  = roleRes.data  || [];
      const storeList: StoreMeta[] = (storeRes.data || []) as StoreMeta[];

      setRoles(roleList);
      setDepartments(deptRes.data || []);
      setAllStores(storeList);
      setFilteredStores(storeList);
      setLocations(locRes.data || [] as any);

      const firstNonAdmin = roleList.find(r => !isAdminRoleName(r.name));
      if (firstNonAdmin) setFilterRole(firstNonAdmin.id);
      setRefLoading(false);
    };
    load();
  }, [userData.company_id]);

  // Filter stores by selected location; reset store selection on location change
  useEffect(() => {
    if (filterLocation === NONE) {
      setFilteredStores(allStores);
    } else {
      setFilteredStores(allStores.filter(s => s.location_id === filterLocation));
    }
    setFilterStore(NONE);
  }, [filterLocation, allStores]);

  const isAdminRoleName = (name: string) => {
    const n = (name || '').trim().toLowerCase();
    return n === 'super admin' || n === 'administrator';
  };

  const selectedRoleName = roles.find(r => r.id === filterRole)?.name || '';
  const isAdminSelected  = isAdminRoleName(selectedRoleName);

  const loadPermissions = async (ctx: PermContext) => {
    setCtxLoading(true);
    try {
      let query = supabase
        .from('role_module_permissions_clone')
        .select('module_key, allowed, sub_modules')
        .eq('role_id',    ctx.roleId)
        .eq('company_id', userData.company_id);

      query = ctx.departmentId
        ? query.eq('department_id', ctx.departmentId)
        : query.is('department_id', null);

      query = ctx.storeId
        ? query.eq('store_id', ctx.storeId)
        : query.is('store_id', null);

      const { data, error } = await query;
      if (error) throw error;

      const state = defaultPermState();
      for (const p of data || []) {
        if (p.sub_modules && typeof p.sub_modules === 'object') {
          Object.entries(p.sub_modules as Record<string, boolean>).forEach(([k, v]) => {
            if (k in state) state[k] = v;
          });
        }
      }

      setPermissions(state);
      setOriginalPermissions({ ...state });
      setHasChanges(false);
      setActiveCtx(ctx);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load permissions');
    } finally {
      setCtxLoading(false);
    }
  };

  const handleLoad = () => {
    if (!filterRole) { toast.error('Please select a role'); return; }
    loadPermissions({
      roleId:       filterRole,
      departmentId: filterDept  === NONE ? null : filterDept,
      storeId:      filterStore === NONE ? null : filterStore,
    });
  };

  const getPermValue = (key: string): boolean => {
    if (isAdminSelected) return true;
    return permissions[key] ?? false;
  };

  const setPermValue = (key: string, value: boolean) => {
    if (!activeCtx || isAdminSelected) return;
    setPermissions(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(
        Object.keys({ ...originalPermissions, ...next }).some(
          k => (originalPermissions[k] ?? false) !== (next[k] ?? false)
        )
      );
      return next;
    });
  };

  const toggleGroupAll = (grp: SubGroup, value: boolean) => {
    if (!activeCtx || isAdminSelected) return;
    setPermissions(prev => {
      const next = { ...prev };
      getGroupKeys(grp).forEach(k => (next[k] = value));
      setHasChanges(true);
      return next;
    });
  };

  const isGroupAllChecked = (grp: SubGroup): boolean => {
    if (isAdminSelected) return true;
    const keys = getGroupKeys(grp);
    return keys.length > 0 && keys.every(k => getPermValue(k));
  };

  const isGroupPartial = (grp: SubGroup): boolean => {
    if (isAdminSelected) return false;
    const keys = getGroupKeys(grp);
    const n = keys.filter(k => getPermValue(k)).length;
    return n > 0 && n < keys.length;
  };

  const applyToAll = (value: boolean) => {
    if (!activeCtx || isAdminSelected) return;
    setPermissions(prev => {
      const next = { ...prev };
      getAllKeys().forEach(k => (next[k] = value));
      setHasChanges(true);
      return next;
    });
  };

  const handleSave = async () => {
    if (!activeCtx) return;
    setIsSaving(true);
    try {
      // 1. Group permissions by module key
      const moduleMap: Record<string, Record<string, boolean>> = {};
      for (const [key, val] of Object.entries(permissions)) {
        const modKey = key.split('__')[0];
        if (!moduleMap[modKey]) moduleMap[modKey] = {};
        moduleMap[modKey][key] = val;
      }

      // 2. Delete existing rows for this exact context
      let delQuery = supabase
        .from('role_module_permissions_clone')
        .delete()
        .eq('role_id',    activeCtx.roleId)
        .eq('company_id', userData.company_id);

      delQuery = activeCtx.departmentId
        ? delQuery.eq('department_id', activeCtx.departmentId)
        : delQuery.is('department_id', null);

      delQuery = activeCtx.storeId
        ? delQuery.eq('store_id', activeCtx.storeId)
        : delQuery.is('store_id', null);

      await delQuery;

      // 3. Insert updated rows and capture returned UUIDs
      const inserts = Object.entries(moduleMap).map(([modKey, subMods]) => ({
        role_id:       activeCtx.roleId,
        company_id:    userData.company_id,
        department_id: activeCtx.departmentId ?? null,
        store_id:      activeCtx.storeId      ?? null,
        module_key:    modKey,
        allowed:       Object.values(subMods).some(Boolean),
        sub_modules:   subMods,
      }));

      let insertedRowIds: string[] = [];

      if (inserts.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('role_module_permissions_clone')
          .insert(inserts)
          .select('id, allowed');

        if (insertError) throw insertError;

        insertedRowIds = (insertedRows ?? [])
          .filter((row: { id: string; allowed: boolean | null }) => row.allowed === true)
          .map((row: { id: string; allowed: boolean | null }) => row.id);
      }

      // 4. Sync user authorizations
      let userQuery = supabase
        .from('user_mgmt')
        .select('id, authorization')
        .eq('company_id', userData.company_id)
        .eq('role_id',    activeCtx.roleId)
        .eq('is_active',  true);

      if (activeCtx.departmentId) {
        userQuery = userQuery.eq('department_id', activeCtx.departmentId);
      }

      const { data: matchedUsers, error: userFetchError } = await userQuery;

      if (userFetchError) {
        console.error('Failed to fetch users for authorization sync:', userFetchError);
        toast.error('Permissions saved, but user authorization sync failed');
      } else if (matchedUsers && matchedUsers.length > 0) {
        const userUpdates = matchedUsers.map(user => {
          const existing: Record<string, unknown> =
            user.authorization &&
            typeof user.authorization === 'object' &&
            !Array.isArray(user.authorization)
              ? (user.authorization as Record<string, unknown>)
              : {};

          return supabase
            .from('user_mgmt')
            .update({
              authorization: {
                ...existing,
                role_permissions: insertedRowIds,
              },
            })
            .eq('id',         user.id)
            .eq('company_id', userData.company_id);
        });

        const results = await Promise.all(userUpdates);
        const failed  = results.filter(r => r.error);

        if (failed.length > 0) {
          console.error(
            `${failed.length} user authorization update(s) failed:`,
            failed.map(r => r.error),
          );
          toast.error('Permissions saved, but some user authorizations could not be synced');
        }
      }

      // 5. Audit log
      const roleName  = roles.find(r => r.id === activeCtx.roleId)?.name || activeCtx.roleId;
      const deptName  = activeCtx.departmentId
        ? departments.find(d => d.id === activeCtx.departmentId)?.department_name || '-'
        : 'All Departments';
      const storeName = activeCtx.storeId
        ? filteredStores.find(s => s.id === activeCtx.storeId)?.name || '-'
        : 'All Stores';

      await supabase.from('system_log').insert({
        company_id:       userData.company_id,
        transaction_date: new Date().toISOString(),
        module:           'Role Management',
        scope:            'Update Authorization',
        key:              roleName,
        log:              `Permissions updated for role: ${roleName} | Dept: ${deptName} | Store: ${storeName}`,
        action_by:        userData.id,
        created_at:       new Date().toISOString(),
      });

      setOriginalPermissions({ ...permissions });
      setHasChanges(false);
      toast.success('Permissions saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const roleSummary = useMemo(() => {
    if (!activeCtx) return null;
    const allKeys = getAllKeys();
    if (isAdminSelected) return { total: allKeys.length, granted: allKeys.length };
    const granted = allKeys.filter(k => permissions[k]).length;
    return { total: allKeys.length, granted };
  }, [permissions, activeCtx, isAdminSelected]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return MODULE_TREE;
    const q = searchQuery.toLowerCase();
    return MODULE_TREE
      .map(mod => ({
        ...mod,
        groups: mod.groups.filter(
          grp =>
            grp.label.toLowerCase().includes(q) ||
            grp.items?.some(item => item.label.toLowerCase().includes(q))
        ),
      }))
      .filter(mod => mod.groups.length > 0);
  }, [searchQuery]);

  const nonAdminRoles   = roles.filter(r => !isAdminRoleName(r.name));
  const adminRoles      = roles.filter(r => isAdminRoleName(r.name));
  const isTableDisabled = !activeCtx || isAdminSelected || ctxLoading;
  const pct = roleSummary?.total
    ? Math.round((roleSummary.granted / roleSummary.total) * 100)
    : 0;

  const ctxLabel = useMemo(() => {
    if (!activeCtx) return null;
    return {
      dept:     activeCtx.departmentId
                  ? departments.find(d => d.id === activeCtx.departmentId)?.department_name || '-'
                  : 'All Departments',
      role:     roles.find(r => r.id === activeCtx.roleId)?.name || '-',
      location: filterLocation !== NONE
                  ? locations.find(l => l.id === filterLocation)?.location_name || '-'
                  : 'All Locations',
      store:    activeCtx.storeId
                  ? filteredStores.find(s => s.id === activeCtx.storeId)?.name || '-'
                  : 'All Stores',
    };
  }, [activeCtx, roles, departments, filteredStores, locations, filterLocation]);

  if (refLoading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="min-h-[85vh] shadow-sm">
            <CardHeader className="rounded-t-lg border-b pb-6">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-72 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-lg border bg-gray-50">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
              <div className="rounded-lg border overflow-hidden">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 border-b bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">

          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Role Authorizations</CardTitle>
                <CardDescription className="mt-1">
                  Configure module access by role, department and store
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">

            {/* ── Filter Panel ── */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Select Permission Scope</span>
                <span className="text-xs text-gray-400 ml-1">- Role is required; Department, Location &amp; Store are optional</span>
              </div>

              <div className="flex flex-col sm:flex-row items-end gap-4">

                {/* 1. Department */}
                <div className="space-y-1 flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-600">
                    Department <span className="text-gray-400">(optional)</span>
                  </label>
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger className="bg-white w-full">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Role */}
                <div className="space-y-1 flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-600">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="bg-white w-full">
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nonAdminRoles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Location */}
                <div className="space-y-1 flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-600">
                    Location <span className="text-gray-400">(optional)</span>
                  </label>
                  <Select value={filterLocation} onValueChange={setFilterLocation}>
                    <SelectTrigger className="bg-white w-full">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>All Locations</SelectItem>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Store — filtered by selected location */}
                <div className="space-y-1 flex-1 min-w-0">
                  <label className="text-xs font-medium text-gray-600">
                    Store <span className="text-gray-400">(optional)</span>
                  </label>
                  <Select
                    value={filterStore}
                    onValueChange={setFilterStore}
                    disabled={filterLocation !== NONE && filteredStores.length === 0}
                  >
                    <SelectTrigger className="bg-white w-full">
                      <SelectValue
                        placeholder={
                          filterLocation !== NONE && filteredStores.length === 0
                            ? 'No stores for location'
                            : 'All Stores'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>All Stores</SelectItem>
                      {filteredStores.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Load button */}
                <div className="shrink-0">
                  <Button
                    onClick={handleLoad}
                    disabled={!filterRole || ctxLoading}
                    className="w-40 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {ctxLoading
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                      : 'Load Permissions'
                    }
                  </Button>
                </div>
              </div>

              {adminRoles.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 w-fit">
                  <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-600">{adminRoles.map(r => r.name).join(', ')}</span>
                    {' '}- always have full access and cannot be edited.
                  </p>
                </div>
              )}
            </div>

            {/* ── Empty state ── */}
            {!activeCtx && !ctxLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <ShieldCheck className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  Select a role and click <strong className="text-gray-600">Load Permissions</strong> to begin
                </p>
                <p className="text-xs mt-1 opacity-70">You can optionally filter by department, location or store</p>
              </div>
            )}

            {/* ── Active context summary ── */}
            {activeCtx && ctxLabel && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Department</p>
                  <p className="text-sm font-semibold text-gray-900">{ctxLabel.dept}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</p>
                  <p className="text-sm font-semibold text-gray-900">{ctxLabel.role}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Location</p>
                  <p className="text-sm font-semibold text-gray-900">{ctxLabel.location}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Store</p>
                  <p className="text-sm font-semibold text-gray-900">{ctxLabel.store}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Access Level</p>
                  {roleSummary && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        {roleSummary.granted} granted
                      </Badge>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                        {roleSummary.total - roleSummary.granted} denied
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-blue-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-blue-700 shrink-0 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Unsaved changes banner ── */}
            {hasChanges && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700">
                  You have unsaved changes. Click <strong>Save Changes</strong> to persist updates.
                </p>
              </div>
            )}

            {/* ── Permissions table ── */}
            {activeCtx && (
              <>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search modules / screens..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => applyToAll(true)} disabled={isTableDisabled}>
                      <CheckSquare className="h-4 w-4 mr-1.5" /> Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyToAll(false)} disabled={isTableDisabled}>
                      <Square className="h-4 w-4 mr-1.5" /> No Access
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border shadow-sm">
                  {ctxLoading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-sm">Loading permissions...</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-gray-50 border-gray-200 bg-gray-50">
                          <TableHead className="font-semibold text-gray-700 w-64 pl-4">Module / Screen</TableHead>
                          <TableHead className="font-semibold text-gray-700">Permissions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTree.map(mod => (
                          <>
                            <TableRow
                              key={`mod-${mod.key}`}
                              className="bg-gray-100 hover:bg-gray-200 cursor-pointer select-none border-gray-200"
                              onClick={() => setExpandedModules(prev => {
                                const next = new Set(prev);
                                next.has(mod.key) ? next.delete(mod.key) : next.add(mod.key);
                                return next;
                              })}
                            >
                              <TableCell className="py-3 pl-4" colSpan={2}>
                                <div className="flex items-center gap-2">
                                  {expandedModules.has(mod.key)
                                    ? <ChevronDown className="h-4 w-4 text-gray-500" />
                                    : <ChevronRight className="h-4 w-4 text-gray-500" />
                                  }
                                  <span className="text-sm font-semibold text-gray-800">{mod.label}</span>
                                  <span className="ml-2 text-xs text-gray-400">{mod.groups.length} screens</span>
                                </div>
                              </TableCell>
                            </TableRow>

                            {expandedModules.has(mod.key) && mod.groups.map(grp => (
                              <>
                                <TableRow
                                  key={`grp-${grp.key}`}
                                  className="hover:bg-blue-50/40 border-gray-100 transition-colors"
                                >
                                  <TableCell className="py-3 pl-8">
                                    <div className="flex items-center gap-1.5">
                                      {grp.items?.length ? (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedGroups(prev => {
                                            const next = new Set(prev);
                                            next.has(grp.key) ? next.delete(grp.key) : next.add(grp.key);
                                            return next;
                                          })}
                                          className="flex items-center gap-1.5 hover:text-blue-600 transition-colors text-left"
                                        >
                                          {expandedGroups.has(grp.key)
                                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                          }
                                          <span className="text-sm font-medium text-gray-700">{grp.label}</span>
                                        </button>
                                      ) : (
                                        <span className="text-sm font-medium text-gray-700 pl-5">{grp.label}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3 pl-4 pr-6">
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1">
                                        {grp.permissions
                                          ? grp.permissions.map(perm => {
                                              const key = buildPermKey(grp.key, perm);
                                              return (
                                                <label
                                                  key={perm}
                                                  className="flex items-center gap-1.5 cursor-pointer select-none group/perm"
                                                >
                                                  <Checkbox
                                                    checked={getPermValue(key)}
                                                    onCheckedChange={val => setPermValue(key, !!val)}
                                                    disabled={isTableDisabled}
                                                    className={isTableDisabled ? 'border-gray-200' : ''}
                                                  />
                                                  <span className="text-xs font-medium text-gray-600 group-hover/perm:text-blue-700 transition-colors">
                                                    {PERM_LABELS[perm]}
                                                  </span>
                                                </label>
                                              );
                                            })
                                          : <span className="text-xs text-gray-400 italic">Sub-screens only</span>
                                        }
                                      </div>
                                      {!isAdminSelected && getGroupKeys(grp).length > 1 && (
                                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer shrink-0 select-none ml-auto pr-4">
                                          <Checkbox
                                            checked={isGroupAllChecked(grp)}
                                            data-state={isGroupPartial(grp) ? 'indeterminate' : undefined}
                                            onCheckedChange={val => toggleGroupAll(grp, !!val)}
                                            disabled={isTableDisabled}
                                          />
                                          <span className="font-medium">All</span>
                                        </label>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {grp.items && expandedGroups.has(grp.key) && grp.items.map(item => (
                                  <TableRow
                                    key={`item-${item.key}`}
                                    className="bg-blue-50/30 hover:bg-blue-50/60 border-gray-100 transition-colors"
                                  >
                                    <TableCell className="py-2.5 pl-16">
                                      <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span className="text-sm text-gray-600">{item.label}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2.5 pl-4 pr-6">
                                      <div className="flex items-center gap-5">
                                        {item.permissions.map(perm => {
                                          const key = buildPermKey(grp.key, perm, item.key);
                                          return (
                                            <label
                                              key={perm}
                                              className="flex items-center gap-1.5 cursor-pointer select-none group/perm"
                                            >
                                              <Checkbox
                                                checked={getPermValue(key)}
                                                onCheckedChange={val => setPermValue(key, !!val)}
                                                disabled={isTableDisabled}
                                              />
                                              <span className="text-xs font-medium text-gray-600 group-hover/perm:text-blue-700 transition-colors">
                                                {PERM_LABELS[perm]}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            ))}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2 pb-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/administration')}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving || isAdminSelected}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSaving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                      : <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Save Changes</span>
                    }
                  </Button>
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
};
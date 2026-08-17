import { useProcurement } from '@/hooks/useProcurement';
import { MainRequisitionsGrid } from '@/components/dashboard/procurement/MainRequisitionsGrid';
import { ReorderItemsGrid } from '@/components/dashboard/procurement/ReorderItemsGrid';
import { InternalRequisitionsGrid } from '@/components/dashboard/procurement/InternalRequisitionsGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, LayoutDashboard, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { ProcurementCharts } from '@/components/dashboard/procurement/ProcurementCharts';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { loadModulePermissions } from '@/Utils/commonFun';

type DateFilter = '3m' | '1y' | 'all';
type CategoryFilter = 'all' | 'internal' | 'external';

export default function ProcurementOverview() {
    const navigate = useNavigate();
    const [isChartsOpen, setIsChartsOpen] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const {
        requisitions,
        mainRequisitions,
        internalRequisitions,
        reorderItems,
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
    } = useProcurement(categoryFilter);

    // --- Handlers ---

    const handleRequisitionAction = async (action: string, id: string) => {
        console.log(`Action: ${action} on ${id}`);

        if (action === 'complete') {
            const result = await updateRequisitionStatus(id, 'Completed');
            if (result.success) {
                toast.success('Requisition marked as Completed');
            } else {
                toast.error('Failed to update requisition status');
            }
        } else if (action === 'reject') {
            const result = await updateRequisitionStatus(id, 'Rejected');
            if (result.success) {
                toast.success('Requisition marked as Rejected');
            } else {
                toast.error('Failed to update requisition status');
            }
        } else if (action === 'view') {
            navigate(`/dashboard/purchaseRequisition/view/${id}`);
        } else if (action === 'approvals') {
            navigate(`/dashboard/purchaseReqApprovalView/${id}`);
        } else if (action === 'print') {
            toast('Print functionality - redirecting to details page...');
            navigate(`/dashboard/purchaseRequisition/view/${id}`);
        } else {
            toast(`Action ${action} triggered`);
        }
    };

    const handleReorderAction = async (action: string, id: string, payload?: any) => {
        if (action === 'snooze' && payload?.date) {
            const result = await snoozeReorderItem(id, payload.date);
            if (result.success) {
                toast.success(`Item snoozed until ${payload.date}`);
            } else {
                toast.error('Failed to snooze item');
            }
        } else if (action === 'view_item') {
            // Navigate to item details if route exists
            toast('Navigating to item details...');
            // navigate(`/dashboard/items/${id}`);
        }
    };

    const handleBulkAction = (action: string, selectedIds: string[]) => {
        if (action === 'create_quotation') {
            toast.success(`Creating quotation for ${selectedIds.length} requisitions...`);
            // Navigate to quotation creation with selected requisitions
            // navigate('/dashboard/quotations/create', { state: { requisitionIds: selectedIds } });
        } else if (action === 'create_po') {
            toast.success(`Creating purchase order for ${selectedIds.length} requisitions...`);
            // Navigate to PO creation with selected requisitions
            // navigate('/dashboard/purchase-orders/create', { state: { requisitionIds: selectedIds } });
        } else {
            toast.success(`${action} triggered for ${selectedIds.length} items`);
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
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8 animate-in fade-in duration-500">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <LayoutDashboard className="h-8 w-8 text-blue-600" />
                        Procurement Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Centralized management for Sales, Reorder, and Internal requisitions.
                    </p>
                </div>

                {/* Global Controls */}
                <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-2 rounded-lg shadow-sm border">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Global Search..."
                            className="pl-9 w-[200px] bg-gray-50 border-gray-200 focus:bg-white transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-[1px] bg-gray-200 hidden sm:block" />
                    <div className='flex items-center gap-2'>
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
                            <SelectTrigger className="w-[160px] border-gray-200">
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3m">Last 3 Months</SelectItem>
                                <SelectItem value="1y">Last 1 Year</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Category Filter Section */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">Filter by Category Type:</span>
                        <RadioGroup
                            value={categoryFilter}
                            onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
                            className="flex gap-6"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="all" id="cat-all" />
                                <Label htmlFor="cat-all" className="cursor-pointer font-normal">All Items</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="internal" id="cat-internal" />
                                <Label htmlFor="cat-internal" className="cursor-pointer font-normal">Internal</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="external" id="cat-external" />
                                <Label htmlFor="cat-external" className="cursor-pointer font-normal">External</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content */}
            <div className="grid gap-6">

                {/* Charts Section */}

                {(hasSubModulePermission('Purchase Orders & Value') || hasSubModulePermission('Requisition Status') || hasSubModulePermission('Top Departments') || hasSubModulePermission('Monthly Volume')) &&(
       <section className="bg-white border rounded-lg">
                    <div className={`flex items-center justify-between px-4 py-3 ${isChartsOpen ? 'border-b' : ''}`}>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Charts</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Showing data for: <span className="font-medium capitalize">{categoryFilter === 'all' ? 'All Items' : categoryFilter}</span>
                                {' '}({requisitions.length} requisitions)
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsChartsOpen((prev) => !prev)}
                            className="gap-2"
                        >
                            {isChartsOpen ? 'Collapse' : 'Expand'}
                            {isChartsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                    {isChartsOpen && (
                        loading ? (
                            <div className="text-center py-8 px-4">
                                <p className="text-gray-500">Loading procurement data...</p>
                            </div>
                        ) : (
                            <div className="p-4">
                                <ProcurementCharts 
                                    key={categoryFilter} 
                                    requisitions={requisitions} 
                                />
                            </div>
                        )
                    )}

                </section>
                )}
         

                {/* Section 1: Main Requisitions */}
                <section className="space-y-3">
                    <MainRequisitionsGrid
                        data={mainRequisitions}
                        onAction={handleRequisitionAction}
                        onBulkAction={handleBulkAction}
                        statusFilter={mainStatusFilter}
                        onStatusFilterChange={setMainStatusFilter}
                    />
                </section>

                   {/* Section 3: Internal Requisitions */}
                <section className="space-y-3">
                    <InternalRequisitionsGrid
                        data={internalRequisitions}
                        onAction={handleRequisitionAction}
                        onBulkAction={handleBulkAction}
                        statusFilter={internalStatusFilter}
                        onStatusFilterChange={setInternalStatusFilter}
                    />
                </section>
                {/* Section 2: Reorder Items */}
                <section className="space-y-3">
                    <ReorderItemsGrid
                        data={reorderItems}
                        onAction={handleReorderAction}
                    />
                </section>

             

            </div>
        </div>
    );
}

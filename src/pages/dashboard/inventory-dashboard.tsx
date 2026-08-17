import { useDashboardData } from '../../hooks/useDashboardData';
import { DashboardHeader, DashboardAlerts } from '../../components/dashboard';
import { Loader2, AlertTriangle, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { fetchInventoryOverviewMetrics, fetchCategoryStockData, fetchFastMovingItems, fetchSlowMovingItems } from '@/Utils/dashboardData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { loadModulePermissions } from '@/Utils/commonFun';

type CategoryFilter = 'all' | 'internal' | 'external';

export const InventoryDashboard = () => {
  const { data, loading, error, refetch, lastUpdated } = useDashboardData();
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [inventoryMetrics, setInventoryMetrics] = useState({
    totalItems: 0,
    totalValue: 0
  });
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [fastMovingItems, setFastMovingItems] = useState<any[]>([]);
  const [slowMovingItems, setSlowMovingItems] = useState<any[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [subModulePermissions, setSubModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currency = userData?.company_data?.currency || '₹';
    setCurrencySymbol(currency);
    
    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Inventory Dashboard', userData.user_id);
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

  useEffect(() => {
    const loadFilteredData = async () => {
      setMetricsLoading(true);
      try {
        const [metrics, categories, fastItems, slowItems] = await Promise.all([
          fetchInventoryOverviewMetrics(categoryFilter),
          fetchCategoryStockData(categoryFilter),
          fetchFastMovingItems(categoryFilter),
          fetchSlowMovingItems(categoryFilter)
        ]);
        
        setInventoryMetrics({
          totalItems: metrics.totalItems,
          totalValue: metrics.totalValue
        });
        setCategoryData(categories);
        setFastMovingItems(fastItems);
        setSlowMovingItems(slowItems);
      } catch (error) {
        console.error('Error loading filtered data:', error);
      } finally {
        setMetricsLoading(false);
      }
    };

    loadFilteredData();
  }, [categoryFilter]);

  const handleRefresh = async () => {
    await refetch();
    const [metrics, categories, fastItems, slowItems] = await Promise.all([
      fetchInventoryOverviewMetrics(categoryFilter),
      fetchCategoryStockData(categoryFilter),
      fetchFastMovingItems(categoryFilter),
      fetchSlowMovingItems(categoryFilter)
    ]);
    
    setInventoryMetrics({
      totalItems: metrics.totalItems,
      totalValue: metrics.totalValue
    });
    setCategoryData(categories);
    setFastMovingItems(fastItems);
    setSlowMovingItems(slowItems);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const inventoryAlerts = data?.inventoryAlerts || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardHeader 
          onRefresh={handleRefresh}
          loading={loading}
          lastUpdated={lastUpdated}
        />

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
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer font-normal">All Items</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="internal" id="internal" />
                  <Label htmlFor="internal" className="cursor-pointer font-normal">Internal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="external" id="external" />
                  <Label htmlFor="external" className="cursor-pointer font-normal">External</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {hasSubModulePermission('Total Items & Value') && (
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardContent className="px-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="rounded-full bg-blue-100 p-3">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Inventory Overview</p>
                  <p className="text-2xl font-bold text-gray-900">Total Items & Value</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metricsLoading ? '...' : inventoryMetrics.totalItems.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {categoryFilter === 'all' ? 'All items' : `${categoryFilter} only`}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metricsLoading ? '...' : `${currencySymbol}${inventoryMetrics.totalValue.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inventory value
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {hasSubModulePermission('Stocks by Category') && (
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardContent className="px-6 pt-6">
              <h3 className="text-lg font-semibold mb-4">Stocks by Category</h3>
              <div className="h-64">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        label={{ 
                          value: 'Total Stock Items', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { textAnchor: 'middle', fill: '#374151', fontSize: 14, fontWeight: 500 }
                        }}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No category data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>

        <DashboardAlerts 
          inventoryAlerts={inventoryAlerts}
          fastMovingItems={fastMovingItems}
          slowMovingItems={slowMovingItems}
          showInventoryAlerts={hasSubModulePermission('Inventory Alerts')}
          showFastMovingItems={hasSubModulePermission('Fast Moving Items')}
          showSlowMovingItems={hasSubModulePermission('Slow Moving Items')}
        />
      </div>
    </div>
  );
}

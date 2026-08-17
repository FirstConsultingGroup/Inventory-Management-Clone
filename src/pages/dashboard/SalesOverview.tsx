import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, AlertTriangle, RefreshCw, TrendingUp, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchSalesTurnoverData, fetchSalesByCategory, fetchTopSellingItems, fetchSalesMetrics } from '@/Utils/dashboardData';
import { loadModulePermissions } from '@/Utils/commonFun';

interface SalesData {
  day: string;
  sales: number;
}

interface CategoryData {
  name: string;
  value: number;
  fill: string;
}

interface TopSellingItem {
  name: string;
  sales: number;
  quantity: number;
}

interface SalesMetrics {
  totalTransactions: number;
  averageOrderValue: number;
  itemsPerTransaction: number;
  totalRevenue: number;
}

export default function SalesOverview() {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topItems, setTopItems] = useState<TopSellingItem[]>([]);
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics>({
    totalTransactions: 0,
    averageOrderValue: 0,
    itemsPerTransaction: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [subModulePermissions, setSubModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    // Get currency symbol from user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currency = userData?.company_data?.currency || '₹';
    setCurrencySymbol(currency);

    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Sales Dashboard', userData.user_id);
        console.log("permissions",res);
        
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [turnoverData, categorySales, topSellingItems, metrics] = await Promise.all([
        fetchSalesTurnoverData(),
        fetchSalesByCategory(),
        fetchTopSellingItems(10),
        fetchSalesMetrics()
      ]);
      
      setSalesData(turnoverData);
      setCategoryData(categorySales);
      setTopItems(topSellingItems);
      setSalesMetrics(metrics);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sales data';
      setError(errorMessage);
      console.error('Sales data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    await fetchData();
  };

  // Show loading state
  if (loading && salesData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading sales data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && salesData.length === 0) {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              Sales Overview
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your sales performance and trends
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Sales Metrics Cards */}
        {hasSubModulePermission('Total Sales') && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currencySymbol}{salesMetrics.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All-time sales
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {salesMetrics.totalTransactions.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed orders
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {currencySymbol}{salesMetrics.averageOrderValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per transaction
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Items per Order</CardTitle>
              <Package className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {salesMetrics.itemsPerTransaction}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Average quantity
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Sales Turnover Chart */}
        {hasSubModulePermission('Sales Turnover Trend') && (

        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Sales Turnover Trend</CardTitle>
            <p className="text-sm text-gray-500">Last Month Performance</p>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              {salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      label={{ 
                        value: 'Date', 
                        position: 'insideBottom', 
                        offset: -40,
                        style: { textAnchor: 'middle', fill: '#374151', fontSize: 14, fontWeight: 500 }
                      }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis 
                      label={{ 
                        value: `Sales (${currencySymbol})`, 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#374151', fontSize: 14, fontWeight: 500 }
                      }}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#d1d5db' }}
                      tickLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip 
                      labelFormatter={(iso: string) => {
                        try {
                          const d = new Date(iso);
                          return d.toLocaleDateString();
                        } catch (e) {
                          return iso;
                        }
                      }}
                      formatter={(value: any) => [`${currencySymbol}${value}`, 'Sales']}
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No sales data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Sales by Category and Top Items */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* Sales by Category - Pie Chart */}
        {hasSubModulePermission('Sales by Category') && (
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
              <p className="text-sm text-gray-500">Revenue distribution across categories</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`${currencySymbol}${value.toLocaleString()}`, 'Sales']}
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => {
                          const item = categoryData.find(d => d.name === value);
                          return item ? `${value} (${currencySymbol}${item.value.toLocaleString()})` : value;
                        }}
                      />
                    </PieChart>
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

          {/* Top Selling Items - Bar Chart */}
          {hasSubModulePermission('Top Selling Items') && (

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <p className="text-sm text-gray-500">Best performing products by revenue</p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {topItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={topItems} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        type="number"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        width={90}
                        axisLine={{ stroke: '#d1d5db' }}
                        tickLine={{ stroke: '#d1d5db' }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'sales') {
                            return [`${currencySymbol}${value.toLocaleString()}`, 'Sales'];
                          }
                          return [value, 'Quantity'];
                        }}
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No top selling items data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}

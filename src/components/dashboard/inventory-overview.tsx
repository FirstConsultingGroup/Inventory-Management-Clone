import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Tags, AlertTriangle, BadgeIndianRupee } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/Utils/formatters';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { fetchInventoryOverviewMetrics } from '@/Utils/dashboardData';

type CategoryFilter = 'all' | 'internal' | 'external';

export const InventoryOverview = () => {
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalValue: 0,
    totalCategories: 0,
    lowStockItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get currency symbol from user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currency = userData?.company_data?.currency || '₹';
    setCurrencySymbol(currency);
  }, []);

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      try {
        const data = await fetchInventoryOverviewMetrics(categoryFilter);
        setMetrics(data);
      } catch (error) {
        console.error('Error loading inventory overview metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [categoryFilter]);

  return (
    <>
      {/* Filter Radio Buttons */}
      <div className="col-span-full mb-4">
        <Card>
          <CardContent className="pt-6">
            <RadioGroup
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer">All Items</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="internal" id="internal" />
                <Label htmlFor="internal" className="cursor-pointer">Internal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="cursor-pointer">External</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <Card className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? '...' : metrics.totalItems.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {categoryFilter === 'all' ? 'All items' : `${categoryFilter} items only`}
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <BadgeIndianRupee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? '...' : formatCurrency(metrics.totalValue, currencySymbol)}
          </div>
          <p className="text-xs text-muted-foreground">
            Inventory value
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categories</CardTitle>
          <Tags className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? '...' : metrics.totalCategories}
          </div>
          <p className="text-xs text-muted-foreground">
            Active categories
          </p>
        </CardContent>
      </Card>

      <Card className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? '...' : metrics.lowStockItems}
          </div>
          <p className="text-xs text-destructive">
            Requires immediate attention
          </p>
        </CardContent>
      </Card>
    </>
  );
};

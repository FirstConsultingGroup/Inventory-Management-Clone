import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { fetchInventoryOverviewMetrics } from '@/Utils/dashboardData';

interface DashboardMetricsProps {
  metrics: {
    totalItems: number;
    totalValue: number;
    totalPurchaseOrders: number;
    totalPurchaseOrderValue: number;
  };
  currencySymbol: string;
}

type CategoryFilter = 'all' | 'internal' | 'external';

export const DashboardMetrics = ({ metrics: initialMetrics, currencySymbol }: DashboardMetricsProps) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [inventoryMetrics, setInventoryMetrics] = useState({
    totalItems: initialMetrics.totalItems,
    totalValue: initialMetrics.totalValue
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFilteredMetrics = async () => {
      if (categoryFilter === 'all') {
        setInventoryMetrics({
          totalItems: initialMetrics.totalItems,
          totalValue: initialMetrics.totalValue
        });
        return;
      }

      setLoading(true);
      try {
        const data = await fetchInventoryOverviewMetrics(categoryFilter);
        setInventoryMetrics({
          totalItems: data.totalItems,
          totalValue: data.totalValue
        });
      } catch (error) {
        console.error('Error loading filtered inventory metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFilteredMetrics();
  }, [categoryFilter, initialMetrics.totalItems, initialMetrics.totalValue]);

  return (
    <div className="space-y-4">
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

      {/* Single Inventory Card */}
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
                {loading ? '...' : inventoryMetrics.totalItems.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {categoryFilter === 'all' ? 'All items' : `${categoryFilter} only`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-green-600">
                {loading ? '...' : `${currencySymbol}${inventoryMetrics.totalValue.toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Inventory value
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface MovingItem {
  name: string;
  avgQuantity: number;
}

interface InventoryAlert {
  itemName: string;
  currentQty: number;
  reorderLevel: number;
  maxLevel: number;
  alertType: 'low_stock' | 'excess_stock';
  severity: 'high' | 'medium' | 'low';
}

interface DashboardAlertsProps {
  inventoryAlerts: InventoryAlert[];
  fastMovingItems: MovingItem[];
  slowMovingItems: MovingItem[];
  showInventoryAlerts?: boolean;
  showFastMovingItems?: boolean;
  showSlowMovingItems?: boolean;
}

export const DashboardAlerts = ({
  inventoryAlerts,
  fastMovingItems,
  slowMovingItems,
  showInventoryAlerts = true,
  showFastMovingItems = true,
  showSlowMovingItems = true,
}: DashboardAlertsProps) => {
  // Separate alerts
  const lowStockAlerts = inventoryAlerts.filter(a => a.alertType === "low_stock");
  const excessStockAlerts = inventoryAlerts.filter(a => a.alertType === "excess_stock");

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Inventory Alerts */}
      {showInventoryAlerts && (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Inventory Alerts
              {inventoryAlerts.length > 0 && (
                <span className="ml-2 text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                  {inventoryAlerts.length} Active
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-70 overflow-y-auto scrollbar-thin">
            {inventoryAlerts.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No inventory alerts available</p>
              </div>
            ) : (
              <>
                {/* Excess Stock Box */}
                {excessStockAlerts.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                    {/* <div className="flex items-center gap-2 font-semibold text-blue-800">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Excess Stock Alerts
                    </div> */}
                    {excessStockAlerts.map((alert, index) => (
                      <Alert key={`excess-${index}`} className="border-none bg-transparent p-0">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          <div className="font-medium">Excess Stock Alert</div>
                          <p className="text-sm">
                            {alert.itemName} - Current: {alert.currentQty}, Max Level:{" "}
                            {alert.maxLevel}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Low Stock Box */}
                {lowStockAlerts.length > 0 && (
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 space-y-2">
                    {/* <div className="flex items-center gap-2 font-semibold text-orange-800">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Low Stock Alerts
                    </div> */}
                    {lowStockAlerts.map((alert, index) => (
                      <Alert key={`low-${index}`} className="border-none bg-transparent p-0">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                          <div className="font-medium">Low Stock Alert</div>
                          <p className="text-sm">
                            {alert.itemName} - Current: {alert.currentQty}, Reorder Level:{" "}
                            {alert.reorderLevel}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fast Moving Items */}
      {showFastMovingItems && (
        <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Fast Moving Items
            </CardTitle>
            <p className="text-sm text-gray-500">Top 3 items (3-month average)</p>
          </CardHeader>
          <CardContent className="flex-1 max-h-70">
            <div className="h-full flex flex-col bg-green-50 rounded-lg border border-green-200 overflow-y-auto scrollbar-thin">
              {fastMovingItems.length > 0 ? ([...fastMovingItems]
                  .sort((a, b) => b.avgQuantity - a.avgQuantity)
                  .map((item, index) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center p-3 border-b border-green-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                    <div className="text-right font-bold text-green-700">{item.avgQuantity}/month</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">No fast moving items data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slow Moving Items */}
      {showSlowMovingItems && (
        <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Slow Moving Items
            </CardTitle>
            <p className="text-sm text-gray-500">Bottom 3 items by inventory movement</p>
          </CardHeader>
          <CardContent className="flex-1 max-h-70">
            <div className="h-full flex flex-col bg-red-50 rounded-lg border border-red-200 overflow-y-auto scrollbar-thin">
              {slowMovingItems.length > 0 ? (
                [...slowMovingItems]
                  .sort((a, b) => a.avgQuantity - b.avgQuantity)
                  .map((item, index) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center p-3 border-b border-red-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-full bg-red-100 text-sm font-medium text-red-700">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-700">{item.avgQuantity}/month</div>
                      <div className="text-xs text-red-600">Low movement</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">No slow moving items data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

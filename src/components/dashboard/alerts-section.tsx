import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Clock } from "lucide-react";

export const AlertsSection = () => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Inventory Alerts</h3>
      
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            5 items are below reorder point
          </AlertDescription>
        </Alert>

        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Expiring Soon</AlertTitle>
          <AlertDescription>
            3 items will expire within 30 days
          </AlertDescription>
        </Alert>

        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Excess Inventory</AlertTitle>
          <AlertDescription>
            2 items have over 90 days of supply
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
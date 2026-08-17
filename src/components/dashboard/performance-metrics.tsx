import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface PerformanceMetricsProps {
  dateRange: [Date | null, Date | null];
  category: string;
}

export const PerformanceMetrics = ({ 
  // dateRange, 
  // category 
}: PerformanceMetricsProps) => {
  const data = [
    { month: "Jan", turnover: 2.4 },
    { month: "Feb", turnover: 2.8 },
    { month: "Mar", turnover: 2.6 },
    { month: "Apr", turnover: 3.2 },
    { month: "May", turnover: 3.5 },
    { month: "Jun", turnover: 3.3 },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Performance Metrics</h3>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inventory Turnover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2x</div>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <Line
                    type="monotone"
                    dataKey="turnover"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Tooltip />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Days of Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45 days</div>
            <p className="text-xs text-muted-foreground">Optimal: 30-60 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fast Moving Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="text-sm">Widget A (42 units/month)</li>
              <li className="text-sm">Gadget B (38 units/month)</li>
              <li className="text-sm">Tool C (35 units/month)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Slow Moving Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="text-sm">Part X (3 units/month)</li>
              <li className="text-sm">Tool Y (4 units/month)</li>
              <li className="text-sm">Accessory Z (5 units/month)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryStockData {
  name: string;
  stock: number;
  fill: string;
}

interface DashboardChartsProps {
  categoryData: CategoryStockData[];
}

export const DashboardCharts = ({ categoryData }: DashboardChartsProps) => {
  return (
    <div>
      {/* Stock by Category Bar Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Stocks by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
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
    </div>
  );
};

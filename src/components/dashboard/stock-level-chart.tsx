import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StockLevelChartProps {
  category: string;
  location: string;
  supplier: string;
}

export const StockLevelChart = (
  { 
    // category, 
    // location, 
    // supplier 
  }: StockLevelChartProps) => {
  const data = [
    { category: 'Electronics', stock: 185 },
    { category: 'Tools', stock: 120 },
    { category: 'Parts', stock: 95 },
    { category: 'Accessories', stock: 75 },
  ];

  return (
    <div className="h-[400px]">
      <h3 className="mb-4 text-lg font-semibold">Stock Levels by Category</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Bar
            dataKey="stock"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
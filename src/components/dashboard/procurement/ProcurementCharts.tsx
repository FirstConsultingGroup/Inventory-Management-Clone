import { useMemo, useState, useEffect } from 'react';
import { Requisition } from './mockData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { FileCheck } from 'lucide-react';
import { fetchPurchaseOrderCount, fetchPurchaseOrderTotalValue } from '@/Utils/dashboardData';
import { loadModulePermissions } from '@/Utils/commonFun';

interface ProcurementChartsProps {
    requisitions: Requisition[];
}

export function ProcurementCharts({ requisitions }: ProcurementChartsProps) {
    const [purchaseOrderMetrics, setPurchaseOrderMetrics] = useState({
        totalOrders: 0,
        totalValue: 0
    });
    const [currencySymbol, setCurrencySymbol] = useState('₹');
    const [loading, setLoading] = useState(true);

    // Debug: Log requisitions when they change
    useEffect(() => {
        console.log('ProcurementCharts - Requisitions updated:', {
            total: requisitions.length,
            byType: {
                main: requisitions.filter(r => r.type === 'Main').length,
                internal: requisitions.filter(r => r.type === 'Internal').length
            },
            byStatus: requisitions.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        });
    }, [requisitions]);

    useEffect(() => {
        // Get currency symbol from user data
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const currency = userData?.company_data?.currency || '₹';
        setCurrencySymbol(currency);

        // Fetch purchase order metrics
        const loadPOMetrics = async () => {
            setLoading(true);
            try {
                const [count, value] = await Promise.all([
                    fetchPurchaseOrderCount(),
                    fetchPurchaseOrderTotalValue()
                ]);
                setPurchaseOrderMetrics({
                    totalOrders: count,
                    totalValue: value
                });
            } catch (error) {
                console.error('Error loading purchase order metrics:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPOMetrics();
    }, []);

    // --- Chart 1: Requisition Status Overview (Pie Chart) ---
    const statusData = useMemo(() => {
        const counts = requisitions.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return [
            { status: 'Approved', count: counts['Approved'] || 0, fill: "var(--color-approved)" },
            { status: 'Pending', count: counts['Pending'] || 0, fill: "var(--color-pending)" },
            { status: 'Rejected', count: counts['Rejected'] || 0, fill: "var(--color-rejected)" },
            { status: 'Completed', count: counts['Completed'] || 0, fill: "var(--color-completed)" },
        ].filter(d => d.count > 0);
    }, [requisitions]);

    const statusConfig = {
        count: { label: "Count" },
        approved: { label: "Approved", color: "hsl(142.1 76.2% 36.3%)" }, // Green
        pending: { label: "Pending", color: "hsl(47.9 95.8% 53.1%)" },  // Amber/Yellow
        rejected: { label: "Rejected", color: "hsl(346.8 77.2% 49.8%)" }, // Red
        completed: { label: "Completed", color: "hsl(221.2 83.2% 53.3%)" }, // Blue
    } satisfies ChartConfig;

    // --- Chart 2: Monthly Trends (Bar Chart) ---
    const monthlyData = useMemo(() => {
        const data: Record<string, number> = {};
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = format(d, 'MMM');
            data[key] = 0;
        }

        requisitions.forEach(r => {
            const month = format(parseISO(r.date), 'MMM');
            if (data[month] !== undefined) {
                data[month]++;
            }
        });

        return Object.entries(data).map(([month, count]) => ({ month, count, fill: "#3b82f6" }));
    }, [requisitions]);

    const monthlyConfig = {
        count: { label: "Requisitions", color: "#3b82f6" },
    } satisfies ChartConfig;

    // --- Chart 3: Department Usage (Horizontal Bar) ---
    const deptData = useMemo(() => {
        const counts = requisitions.reduce((acc, curr) => {
            acc[curr.department] = (acc[curr.department] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(counts)
            .map(([dept, count]) => ({
                dept,
                count,
                fill: `hsl(var(--chart-${Math.floor(Math.random() * 5) + 1}))`
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5
    }, [requisitions]);

    const deptConfig = {
        count: { label: "Requests" },
    } satisfies ChartConfig;

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
        <div className="space-y-4 mb-6">
            {/* Purchase Orders Card */}
            {hasSubModulePermission('Purchase Orders & Value')&&(
 <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="px-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="rounded-full bg-orange-100 p-3">
                            <FileCheck className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Purchase Orders</p>
                            <p className="text-2xl font-bold text-gray-900">Orders & Value</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500">Total Orders</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {loading ? '...' : purchaseOrderMetrics.totalOrders}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500">Total Value</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {loading ? '...' : `${currencySymbol}${purchaseOrderMetrics.totalValue.toLocaleString()}`}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            )}
           

            {/* First Row: 2 Graphs */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Chart 1: Status Distribution */}
                {hasSubModulePermission('Requisition Status')&& (
 <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Requisition Status</CardTitle>
                        <CardDescription>Current status breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4 pt-6 px-8">
                        <ChartContainer config={statusConfig} className="mx-auto aspect-square max-h-[340px] w-full">
                            <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent
                                        labelFormatter={(value) => `Status: ${value}`}
                                    />}
                                />
                                <Pie
                                    data={statusData}
                                    dataKey="count"
                                    nameKey="status"
                                    innerRadius={55}
                                    outerRadius={75}
                                    strokeWidth={2}
                                    stroke="#fff"
                                    label={({ cx, cy, midAngle, outerRadius, status, count, percent }) => {
                                        const RADIAN = Math.PI / 180;

                                        // Only show label if percentage is significant
                                        if (percent < 0.05) return null;

                                        // Position for outer label with better spacing
                                        const radius = outerRadius + 50;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                        // Determine text anchor based on position
                                        const textAnchor = x > cx ? 'start' : 'end';

                                        return (
                                            <g>
                                                <text
                                                    x={x}
                                                    y={y - 10}
                                                    fill="#1f2937"
                                                    textAnchor={textAnchor}
                                                    dominantBaseline="middle"
                                                    style={{
                                                        fontSize: '14px',
                                                        fontWeight: 700,
                                                        pointerEvents: 'none',
                                                    }}
                                                >
                                                    {status}
                                                </text>
                                                <text
                                                    x={x}
                                                    y={y + 8}
                                                    fill="#6b7280"
                                                    textAnchor={textAnchor}
                                                    dominantBaseline="middle"
                                                    style={{
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        pointerEvents: 'none',
                                                    }}
                                                >
                                                    {count} ({(percent * 100).toFixed(0)}%)
                                                </text>
                                            </g>
                                        );
                                    }}
                                    labelLine={{
                                        stroke: '#9ca3af',
                                        strokeWidth: 1,
                                        strokeDasharray: '3 3',
                                    }}
                                >
                                    {statusData.map((_, index) => (
                                        <Cell key={`cell-${index}`} />
                                    ))}
                                </Pie>
                                <ChartLegend
                                    content={<ChartLegendContent nameKey="status" />}
                                    className="mt-6 flex-wrap justify-center"
                                />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                )}
               
                {/* Chart 2: Monthly Volume */}
                {hasSubModulePermission('Monthly Volume')&& (
    <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                        <CardTitle>Monthly Volume</CardTitle>
                        <CardDescription>Requests over last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={monthlyConfig} className="max-h-[320px] w-full">
                            <BarChart accessibilityLayer data={monthlyData} margin={{ top: 30, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    tickMargin={12}
                                    axisLine={false}
                                    tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
                                    height={50}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 13 }}
                                    tickMargin={10}
                                    width={50}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    content={<ChartTooltipContent
                                        labelFormatter={(value) => `Month: ${value}`}
                                        formatter={(value) => [`${value} requisitions`, 'Count']}
                                    />}
                                />
                                <Bar
                                    dataKey="count"
                                    radius={[6, 6, 0, 0]}
                                    fill="#3b82f6"
                                    label={{
                                        position: 'top',
                                        fill: '#1f2937',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        offset: 8
                                    }}
                                />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                )}
            
            </div>

            {/* Second Row: 1 Graph */}
            <div className="grid gap-4">
                {/* Chart 3: Top Departments */}
                {hasSubModulePermission('Top Departments') && (
 <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                        <CardTitle>Top Departments</CardTitle>
                        <CardDescription>Most active departments by request volume</CardDescription>
                    </CardHeader>
                    <CardContent className="px-6">
                        <ChartContainer config={deptConfig} className="max-h-[340px] w-full">
                            <BarChart
                                accessibilityLayer
                                data={deptData}
                                layout="vertical"
                                margin={{ left: 20, right: 80, top: 20, bottom: 20 }}
                            >
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    type="number"
                                    dataKey="count"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 13 }}
                                    tickMargin={8}
                                />
                                <YAxis
                                    dataKey="dept"
                                    type="category"
                                    tickLine={false}
                                    tickMargin={12}
                                    axisLine={false}
                                    width={160}
                                    tick={{ fill: '#1f2937', fontSize: 14, fontWeight: 600 }}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    content={<ChartTooltipContent
                                        labelFormatter={(value) => `Department: ${value}`}
                                        formatter={(value) => [`${value} requests`, 'Total']}
                                    />}
                                />
                                <Bar
                                    dataKey="count"
                                    radius={[0, 6, 6, 0]}
                                    barSize={36}
                                    label={({ x, y, width, value }) => {
                                        return (
                                            <text
                                                x={x + width + 12}
                                                y={y + 18}
                                                fill="#1f2937"
                                                fontSize={14}
                                                fontWeight={700}
                                                textAnchor="start"
                                            >
                                                {value}
                                            </text>
                                        );
                                    }}
                                >
                                    {deptData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                )}
               
            </div>
        </div>
    );
}

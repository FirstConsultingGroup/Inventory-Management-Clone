import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SupplierDashboardProps {
  suppliers: { name: string; rating: number }[];
}

export default function SupplierDashboard({ suppliers }: SupplierDashboardProps) {
  const data = {
    labels: suppliers.map((s) => s.name),
    datasets: [
      {
        label: "Supplier Ratings",
        data: suppliers.map((s) => s.rating),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        tension: 0.1,
      },
    ],
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Supplier Performance</h2>
      <Line data={data} />
    </div>
  );
}
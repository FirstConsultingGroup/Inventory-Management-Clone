import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/Utils/formatters";

interface ProductTableProps {
  dateRange: [Date | null, Date | null];
  category: string;
  supplier: string;
  location: string;
}

export const ProductTable = ({
  // dateRange,
  // category,
  // supplier,
  // location,
}: ProductTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    // Get currency symbol from user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const currency = userData?.company_data?.currency || '$';
    setCurrencySymbol(currency);
  }, []);

  const products = [
    {
      productId: "P001",
      productName: "Widget A",
      category: "Electronics",
      quantityInStock: 150,
      unitPrice: 25.99,
      reorderPoint: 50,
      supplier: "SupplyCo",
      location: "Warehouse A",
      lastRestocked: "2024-04-15",
    },
    // Add more sample products here
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Product Inventory</h3>
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product ID</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total Value</TableHead>
              <TableHead>Reorder Point</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Last Restocked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.productId}>
                <TableCell>{product.productId}</TableCell>
                <TableCell>{product.productName}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{product.quantityInStock}</TableCell>
                <TableCell>{formatCurrency(product.unitPrice, currencySymbol)}</TableCell>
                <TableCell>
                  {formatCurrency(product.quantityInStock * product.unitPrice, currencySymbol)}
                </TableCell>
                <TableCell>{product.reorderPoint}</TableCell>
                <TableCell>{product.supplier}</TableCell>
                <TableCell>{product.lastRestocked}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
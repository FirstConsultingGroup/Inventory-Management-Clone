import { useState } from "react";
import {
  Package,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StockItem {
  poNumber: string;
  poDate: string;
  receivedOn: string;
  units: number;
  balance: number;
  unitPrice: number;
  sellingPrice: number;
  location: string;
  storeType: "Central Store" | "Branch Store";
}

interface PurchaseOrder {
  poNumber: string;
  poDate: string;
  expectedDelivery: string;
  orderedUnits: number;
  unitPrice: number;
  orderedBy: string;
}

const statusColorMap = {
  "Central Store": "bg-purple-100 text-purple-800 border-purple-300",
  "Branch Store": "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function WarehouseManagement() {
  const [itemId, setItemId] = useState("MARBALHD01");
  const [itemName, setItemName] = useState("Maruti Baleno headlight");
  const [description, setDescription] = useState("Maruti headlight baleno set");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [sourceStore, setSourceStore] = useState("");
  const [targetStore, setTargetStore] = useState("");
  const [isStockExpanded, setIsStockExpanded] = useState(true);
  const [isPurchaseOrdersExpanded, setIsPurchaseOrdersExpanded] = useState(true);

  const stockData: StockItem[] = [
    { poNumber: "PO202501", poDate: "01-May-2025", receivedOn: "01-May-2025", units: 5, balance: 2, unitPrice: 100.50, sellingPrice: 120.00, location: "Central Store", storeType: "Central Store" },
    { poNumber: "PO202505", poDate: "05-May-2025", receivedOn: "05-May-2025", units: 10, balance: 5, unitPrice: 102.00, sellingPrice: 125.00, location: "Central Store", storeType: "Central Store" },
    { poNumber: "", poDate: "", receivedOn: "", units: 5, balance: 2, unitPrice: 102.00, sellingPrice: 125.00, location: "Branch Store A", storeType: "Branch Store" },
    { poNumber: "", poDate: "", receivedOn: "", units: 5, balance: 3, unitPrice: 102.00, sellingPrice: 125.00, location: "Branch Store B", storeType: "Branch Store" },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    { poNumber: "PO202506", poDate: "02-May-2025", expectedDelivery: "10-May-2025", orderedUnits: 5, unitPrice: 102.50, orderedBy: "Aswin Johnson" },
  ];

  const filteredStockData = stockData.filter(item => {
    if (selectedStore === "all") return true;
    if (selectedStore === "central") return item.storeType === "Central Store";
    if (selectedStore === "branch") return item.storeType === "Branch Store";
    return true;
  });

  const totalStock = {
    units: filteredStockData.reduce((sum, item) => sum + item.units, 0),
    balance: filteredStockData.reduce((sum, item) => sum + item.balance, 0),
    value: filteredStockData.reduce((sum, item) => sum + (item.balance * item.unitPrice), 0),
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Warehouse Management
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage your inventory and stock transfers
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Item ID</label>
                  <Input value={itemId} onChange={(e) => setItemId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Item Name</label>
                  <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by PO number..."
                    value={""}
                    onChange={() => { }}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      <SelectItem value="central">Central Store</SelectItem>
                      <SelectItem value="branch">Branch Stores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setIsStockExpanded(!isStockExpanded)}>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  Stock
                </h2>
                {isStockExpanded ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4 text-indigo-600" />}
              </div>
              <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isStockExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              )}>
                <div className="rounded-lg overflow-hidden border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-gray-50 border-gray-200">
                        <TableHead className="font-bold">PO Number</TableHead>
                        <TableHead className="font-bold">PO Date</TableHead>
                        <TableHead className="font-bold">Received On</TableHead>
                        <TableHead className="font-bold">Units</TableHead>
                        <TableHead className="font-bold">Balance</TableHead>
                        <TableHead className="font-bold">Unit Price</TableHead>
                        <TableHead className="font-bold">Selling Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockData.length > 0 ? (
                        filteredStockData.map((item, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell>
                              {item.poNumber || (
                                <Badge
                                  variant="outline"
                                  className={cn("capitalize", statusColorMap[item.storeType] || "bg-gray-100 text-gray-800")}
                                >
                                  {item.location}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.poDate || ""}</TableCell>
                            <TableCell>{item.receivedOn || ""}</TableCell>
                            <TableCell>{item.units}</TableCell>
                            <TableCell>{item.balance}</TableCell>
                            <TableCell>₹{item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell>₹{item.sellingPrice.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow className="hover:bg-gray-50">
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center py-6">
                              <Package className="h-12 w-12 text-gray-300 mb-2" />
                              <p className="text-base font-medium">No stock found</p>
                              <p className="text-sm text-gray-500">Try adjusting your filter</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className="font-semibold bg-gray-50">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell>{totalStock.units}</TableCell>
                        <TableCell>{totalStock.balance}</TableCell>
                        <TableCell colSpan={2}>₹{totalStock.value.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setIsPurchaseOrdersExpanded(!isPurchaseOrdersExpanded)}>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  Purchase Orders
                </h2>
                {isPurchaseOrdersExpanded ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4 text-indigo-600" />}
              </div>
              <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isPurchaseOrdersExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              )}>
                <div className="rounded-lg overflow-hidden border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-gray-50 border-gray-200">
                        <TableHead className="font-bold">PO Number</TableHead>
                        <TableHead className="font-bold">PO Date</TableHead>
                        <TableHead className="font-bold">Expected Delivery</TableHead>
                        <TableHead className="font-bold">Ordered Units</TableHead>
                        <TableHead className="font-bold">Unit Price</TableHead>
                        <TableHead className="font-bold">Ordered By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.length > 0 ? (
                        purchaseOrders.map((order, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell>{order.poNumber}</TableCell>
                            <TableCell>{order.poDate}</TableCell>
                            <TableCell>{order.expectedDelivery}</TableCell>
                            <TableCell>{order.orderedUnits}</TableCell>
                            <TableCell>₹{order.unitPrice.toFixed(2)}</TableCell>
                            <TableCell>{order.orderedBy}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow className="hover:bg-gray-50">
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center py-6">
                              <Package className="h-12 w-12 text-gray-300 mb-2" />
                              <p className="text-base font-medium">No purchase orders found</p>
                              <p className="text-sm text-gray-500">Try adjusting your filter</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
              <div className="flex justify-center mt-8">
                <DialogTrigger asChild>
                  <Button className="transition-colors">
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Transfer Stock
                  </Button>
                </DialogTrigger>
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-indigo-700">Transfer Stock</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">From Store</label>
                      <Select value={sourceStore} onValueChange={setSourceStore}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source store" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="central">Central Store</SelectItem>
                          <SelectItem value="branch-a">Branch Store A</SelectItem>
                          <SelectItem value="branch-b">Branch Store B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">To Store</label>
                      <Select value={targetStore} onValueChange={setTargetStore}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target store" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="central">Central Store</SelectItem>
                          <SelectItem value="branch-a">Branch Store A</SelectItem>
                          <SelectItem value="branch-b">Branch Store B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <Input
                      type="number"
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                      placeholder="Enter quantity to transfer"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setIsTransferDialogOpen(false);
                    }}
                    className="transition-colors"
                  >
                    Confirm Transfer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
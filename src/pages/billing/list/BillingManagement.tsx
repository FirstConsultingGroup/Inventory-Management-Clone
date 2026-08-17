import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Filter,
  BadgeDollarSign,
  Edit,
  Download,
  Printer,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import generateBillingPrint from "../config/BillingPrintTemplate";

const mockBillings = [
  {
    id: "1",
    billing_number: "BIL-2025-001",
    customer_name: "Rahul Sharma",
    contact_number: "+91 98765 43210",
    billing_date: "2025-11-15",
    net_amount: 12500.0,
    status: "paid" as const,
    items: [
      { id: "i1", item_id: "P001", item_name: "Laptop Charger", quantity: 1, unit_price: 2500, discount_percentage: 0 },
      { id: "i2", item_id: "P002", item_name: "USB Cable", quantity: 2, unit_price: 500, discount_percentage: 10 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "2",
    billing_number: "BIL-2025-002",
    customer_name: "Priya Verma",
    contact_number: "+91 87654 32109",
    billing_date: "2025-11-14",
    net_amount: 8900.5,
    status: "pending" as const,
    items: [
      { id: "i3", item_id: "P003", item_name: "Wireless Mouse", quantity: 1, unit_price: 950, discount_percentage: 5 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "3",
    billing_number: "BIL-2025-003",
    customer_name: "Amit Patel",
    contact_number: "+91 76543 21098",
    billing_date: "2025-11-10",
    net_amount: 45200.0,
    status: "overdue" as const,
    items: [
      { id: "i4", item_id: "P004", item_name: "Gaming Laptop", quantity: 1, unit_price: 85000, discount_percentage: 47 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "4",
    billing_number: "BIL-2025-004",
    customer_name: "Sneha Reddy",
    contact_number: "+91 65432 10987",
    billing_date: "2025-11-08",
    net_amount: 3200.0,
    status: "paid" as const,
    items: [
      { id: "i5", item_id: "P005", item_name: "HDMI Cable", quantity: 2, unit_price: 800, discount_percentage: 20 },
      { id: "i6", item_id: "P006", item_name: "Adapter", quantity: 1, unit_price: 1200, discount_percentage: 0 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "5",
    billing_number: "BIL-2025-005",
    customer_name: "Vikram Singh",
    contact_number: "+91 54321 09876",
    billing_date: "2025-11-05",
    net_amount: 7800.0,
    status: "pending" as const,
    items: [
      { id: "i7", item_id: "P007", item_name: "External SSD 1TB", quantity: 1, unit_price: 7800, discount_percentage: 0 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "6",
    billing_number: "BIL-2025-006",
    customer_name: "Ananya Gupta",
    contact_number: "+91 43210 98765",
    billing_date: "2025-10-30",
    net_amount: 15999.0,
    status: "paid" as const,
    items: [
      { id: "i8", item_id: "P008", item_name: "Monitor 24\"", quantity: 1, unit_price: 15999, discount_percentage: 0 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "7",
    billing_number: "BIL-2025-007",
    customer_name: "Rohan Mehta",
    contact_number: "+91 32109 87654",
    billing_date: "2025-10-28",
    net_amount: 6700.0,
    status: "paid" as const,
    items: [
      { id: "i9", item_id: "P009", item_name: "Keyboard + Mouse Combo", quantity: 1, unit_price: 3500, discount_percentage: 10 },
      { id: "i10", item_id: "P010", item_name: "Webcam", quantity: 1, unit_price: 3500, discount_percentage: 5 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
  {
    id: "8",
    billing_number: "BIL-2025-008",
    customer_name: "Kavya Iyer",
    contact_number: "+91 21098 76543",
    billing_date: "2025-10-25",
    net_amount: 22000.0,
    status: "overdue" as const,
    items: [
      { id: "i11", item_id: "P011", item_name: "Printer Ink Cartridge", quantity: 4, unit_price: 5500, discount_percentage: 0 },
    ],
    company: { id: "c1", name: "TechMart India", address: "Mumbai, MH", contact_number: "+91 22 1234 5678" },
  },
];

interface BillingItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
}

interface Billing {
  id: string;
  billing_number: string;
  customer_name: string;
  contact_number: string;
  billing_date: string;
  net_amount: number;
  status: "paid" | "pending" | "overdue";
  items: BillingItem[];
  company: {
    id: string;
    name: string;
    address: string;
    contact_number: string;
  };
}

type SortField = 'billing_number' | 'customer_name' | 'billing_date' | 'net_amount' | 'contact_number' | 'status';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

const SortIndicator = ({ field, sortConfig }: { field: SortField; sortConfig: SortConfig }) => {
  if (sortConfig.field !== field) {
    return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
  }
  return sortConfig.order === 'asc' ? (
    <ArrowUp className="h-4 w-4 text-gray-400" />
  ) : (
    <ArrowDown className="h-4 w-4 text-gray-400" />
  );
};

export default function BillingListingPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'billing_date', order: 'desc' });
  const [filteredBillings, setFilteredBillings] = useState<Billing[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);

  // Format helpers
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // ───── Filtering & Sorting ─────
  useEffect(() => {
    let result = [...mockBillings];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.billing_number.toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        b.contact_number.includes(q)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(b => b.status === filterStatus);
    }

    // Date range
    if (dateFrom) result = result.filter(b => b.billing_date >= dateFrom);
    if (dateTo) result = result.filter(b => b.billing_date <= dateTo);

    // Sorting
    result.sort((a, b) => {
      const aVal = (a as any)[sortConfig.field];
      const bVal = (b as any)[sortConfig.field];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.order === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return sortConfig.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredBillings(result);
    setCurrentPage(1);
  }, [searchQuery, filterStatus, dateFrom, dateTo, sortConfig]);

  // Pagination
  useEffect(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    setBillings(filteredBillings.slice(start, end));
    setLoading(false);
  }, [filteredBillings, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredBillings.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Billing #', 'Customer', 'Date', 'Amount', 'Contact', 'Status'];
    const rows = filteredBillings.map(b => [
      b.billing_number,
      b.customer_name,
      formatDate(b.billing_date),
      b.net_amount.toFixed(2),
      b.contact_number,
      b.status.charAt(0).toUpperCase() + b.status.slice(1),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billings_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('CSV exported successfully!');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <TooltipProvider>
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="min-h-[85vh] shadow-sm">
            <CardHeader className="rounded-t-lg border-b pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 shadow-sm">
                    <BadgeDollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      Billing Management
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Manage your billing records and transactions
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={exportToCSV}
                    disabled={filteredBillings.length === 0}
                    className="transition-colors"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => navigate('/dashboard/billing/add')}
                    className="transition-colors"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Billing
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by billing #, customer, or contact..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-[150px]"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-[150px]"
                      />
                    </div>

                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg overflow-hidden border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('billing_number')}
                          className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                        >
                          Billing #
                          <SortIndicator field="billing_number" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('customer_name')}
                          className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                        >
                          Customer
                          <SortIndicator field="customer_name" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <button
                          onClick={() => handleSort('billing_date')}
                          className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600"
                        >
                          Date
                          <SortIndicator field="billing_date" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="text-right font-semibold">
                        <button
                          onClick={() => handleSort('net_amount')}
                          className="flex items-center gap-1 font-semibold cursor-pointer hover:text-blue-600 justify-end w-full"
                        >
                          Amount
                          <SortIndicator field="net_amount" sortConfig={sortConfig} />
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="text-center font-semibold">Status</TableHead>
                      <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      Array(itemsPerPage).fill(0).map((_, i) => (
                        <TableRow key={`loading-${i}`}>
                          {Array(7).fill(0).map((_, j) => (
                            <TableCell key={j}>
                              <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : billings.length > 0 ? (
                      billings.map((billing) => (
                        <TableRow key={billing.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            <button
                              onClick={() => navigate(`/dashboard/billing/view/${billing.id}`)}
                              className="text-blue-600 hover:underline"
                            >
                              {billing.billing_number}
                            </button>
                          </TableCell>
                          <TableCell>{billing.customer_name}</TableCell>
                          <TableCell>{formatDate(billing.billing_date)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(billing.net_amount)}
                          </TableCell>
                          <TableCell>{billing.contact_number}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${getStatusBadgeColor(billing.status)}`}>
                              {billing.status.charAt(0).toUpperCase() + billing.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => navigate(`/dashboard/billing/view/${billing.id}`)}>
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Billing</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => navigate(`/dashboard/billing/edit/${billing.id}`)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => generateBillingPrint(billing)}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Print</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <div className="flex flex-col items-center justify-center py-6">
                            <FileText className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-base font-medium">
                              {searchQuery || filterStatus !== 'all' || dateFrom || dateTo
                                ? 'No matching billings found'
                                : 'No billings created yet'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {searchQuery || filterStatus !== 'all' || dateFrom || dateTo
                                ? 'Try adjusting your search or filters.'
                                : 'Click "Create Billing" to get started.'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination - EXACT SAME AS CustomerManagement */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Show</p>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">entries</p>
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Showing{' '}
                    {filteredBillings.length > 0
                      ? ((currentPage - 1) * itemsPerPage) + 1
                      : 0}{' '}
                    to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredBillings.length)} of{' '}
                    {filteredBillings.length} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">
                      Page {currentPage} of {totalPages || 1}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
import React, { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    Package,
    ChevronDown,
    ChevronRight,
    FileText,
    Edit,
    FileCheck,
    Printer,
} from "lucide-react";
import { supabase } from "@/Utils/types/supabaseClient";
import { selectUser } from "@/redux/features/userSlice";
import { useSelector } from "react-redux";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ItemSuppliersModal } from "../Modal/ItemSuppliersModal";


interface Requisition {
    id: string;
    purchase_req_number: string;
    purchase_req_date: string;
    category_type: string;
    store: {
        id: string;
        name: string;
        code: string;
    }
    total_items: number;
    status: {
        id: string;
        value: string;
    }
    created_by: string;
}

interface Item {
    id: string;
    item_id: string;
    itemName: string;
    is_temporary: boolean;
    requested_qty: number;
    requisitions: {
        inStock: {
            total_count: number;
            data: Requisition[];
        }
        outOfStock: {
            total_count: number;
            data: Requisition[];
        }
    }
}

interface ItemsResponse {
    items: Item[];
    total_count: number;
}

interface ItemReqPagination {
    [itemId: string]: {
        inStock: {
            page: number;
            limit: number;
        };
        outOfStock: {
            page: number;
            limit: number;
        };
    };
}

interface ViewItemsProps {
    viewItems: boolean;
    statusFilter: string;
    storeFilter: string;
    categoryTypeFilter: string;
    searchTerm: string;
    hasPermission: (actionName: string) => boolean;
    handleView: (itemId: string) => void;
    handleEdit: (itemId: string) => void;
    handlePrint: (itemId: string) => void;
    handleApprovalView: (itemId: string) => void;
}


const ViewItems: React.FC<ViewItemsProps> = ({
    viewItems,
    statusFilter,
    storeFilter,
    categoryTypeFilter,
    searchTerm,
    hasPermission,
    handleView,
    handleEdit,
    handlePrint,
    handleApprovalView
}) => {
    if (!viewItems) {
        return null;
    }

    const userData = useSelector(selectUser);
    const companyId = userData?.company_id || null;

    const [items, setItems] = useState<Item[]>([]);
    const [totalItemsCount, setTotalItemsCount] = useState<number>(0);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const [itemsPage, setItemsPage] = useState(1);
    const [itemsLimit, setItemsLimit] = useState(10);

    const [showItemSuppliersModal, setShowItemSuppliersModal] = useState(false);
    const [suppliersItemId, setSuppliersItemId] = useState<string | null>(null);

const [itemsReqPagination, setItemsReqPagination] =useState<ItemReqPagination>({});
    const toggleExpand = (id: string) => {
        setExpandedItems((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
    }

    useEffect(() => {
        if (!companyId) return;

        const fetchPurchaseRequisitions = async () => {
            try {
                const { data, error } = await supabase.rpc(
                    'get_items_with_requisitions',
                    {
                        p_company_id: companyId,
                        p_status: statusFilter === 'all' ? undefined : statusFilter,
                        p_store_id: storeFilter === 'all' ? undefined : storeFilter,
                        p_category_type: categoryTypeFilter,
                        p_search: searchTerm || undefined,
                        p_item_page: itemsPage,
                        p_item_limit: itemsLimit,
                        p_req_pagination: itemsReqPagination,
                    })

                    console.log("RPC Response:", data);

                function mapItems(data: ItemsResponse): Item[] {
                    if (!Array.isArray(data.items)) return [];

                    return data.items.map((item: any) => ({
                        id: item.id,
                        item_id: item.item_id,
                        itemName: item.item_name,
                        is_temporary: item.is_temporary || false,
                        requested_qty: item.requested_qty || 0,
                        requisitions: {
                            inStock: {
                                total_count: item.requisitions?.inStock?.total_count ?? 0,
                                data: item.requisitions?.inStock?.data ?? [],
                            },

                            outOfStock: {
                                total_count: item.requisitions?.outOfStock?.total_count ?? 0,
                                data: item.requisitions?.outOfStock?.data ?? [],
                            },
                        },
                    }));
                }
                if (data && !error) {
                    const response = data as unknown as ItemsResponse;
                    setItems(mapItems(response));
                    setTotalItemsCount(response.total_count)
                }
            }
            catch (error) {
                console.error("Error fetching purchase requisitions:", error);
            }
        }

        fetchPurchaseRequisitions();
    }, [companyId, statusFilter, storeFilter, categoryTypeFilter, searchTerm, itemsPage, itemsLimit,itemsReqPagination]);


    const totalItemsPage = Math.ceil(totalItemsCount / itemsLimit);

   const handleItemsReqLimitChange = (itemId: string, stock: "inStock" | "outOfStock",limit: number) => {
    setItemsReqPagination(prev => ({
        ...prev,

        [itemId]: {
            inStock: {
                page:
            stock === "inStock"
            ? 1
            : prev[itemId]?.inStock?.page ?? 1,
             limit:
             stock === "inStock"
               ? limit
           : prev[itemId]?.inStock?.limit ?? 5,
            },
            outOfStock: {
                page:
                stock === "outOfStock"
                    ? 1
                    : prev[itemId]?.outOfStock?.page ?? 1,
                limit:
                 stock === "outOfStock"
                      ? limit
                   : prev[itemId]?.outOfStock?.limit ?? 5,
            },
        },
    }));
};

    const handleItemsReqPageChange = (itemId: string,stock: "inStock" | "outOfStock",newPage: number) => {
     setItemsReqPagination(prev => ({
        ...prev,
        [itemId]: {
            inStock: {
                page:
                stock === "inStock"
                 ? newPage
                 : prev[itemId]?.inStock?.page ?? 1,
                limit: prev[itemId]?.inStock?.limit ?? 5,
            },
            outOfStock: {
                page:
                 stock === "outOfStock"
                  ? newPage
                   : prev[itemId]?.outOfStock?.page ?? 1,
                limit: prev[itemId]?.outOfStock?.limit ?? 5,
            },
        },
    }));
};


    return (
        <>
        <div className="space-y-3">


            {items.map((item) => {

                const expanded = expandedItems.includes(item.id);

                const currentInStockPage =
         itemsReqPagination[item.id]?.inStock?.page ?? 1;

const currentOutOfStockPage =
    itemsReqPagination[item.id]?.outOfStock?.page ?? 1;

const inStockLimit =
    itemsReqPagination[item.id]?.inStock?.limit ?? 5;

const outOfStockLimit =
    itemsReqPagination[item.id]?.outOfStock?.limit ?? 5;

const totalInStockPages = Math.ceil(item.requisitions.inStock.total_count / inStockLimit);
const totalOutOfStockPages = Math.ceil(item.requisitions.outOfStock.total_count / outOfStockLimit);

const paginatedInStockRequisitions = item.requisitions.inStock.data;
const paginatedOutOfStockRequisitions = item.requisitions.outOfStock.data;

                return (

                    <div
                        key={item.id}
                        className="border rounded-lg overflow-hidden"
                    >

                        <button
                            className={`w-full flex justify-between items-center px-4 py-3 ${item.is_temporary ? 'bg-yellow-50 hover:bg-[#fffcf4]' : 'hover:bg-gray-50'}`}
                        >

                            <div className="flex flex-col items-start justify-center gap-1">

                                <p className="text-left flex items-center gap-1">
                                    <span className="font-medium">{item.itemName}</span>
                                    <span className="text-sm">({item.requested_qty} Qty)</span>
                                </p>

                                <p className="text-sm text-gray-500 text-left">
                                    {item.requisitions.inStock.total_count + item.requisitions.outOfStock.total_count} Requisitions
                                </p>

                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-blue-500 hover:bg-blue-50 underline hover:text-blue-600 px-2 py-1 rounded-md text-sm font-medium">
                                    <span onClick={()=> {
                                        setShowItemSuppliersModal(true)
                                        setSuppliersItemId(item.id)
                                     }}
                                    >
                                View Suppliers
                                    </span>
                                </div>
                                <div className="mr-4">
                                <Button className="bg-blue-400 border-2 border-blue-200 hover:bg-blue-500 text-white px-2 rounded-md text-sm font-medium">
                                    Add to Purchase Orders
                                </Button>
                                </div>


                            {expanded
                                ? <ChevronDown onClick={() => toggleExpand(item.id)} className="text-gray-600 font-bold text-md hover:bg-gray-200 p-1 rounded-full" />
                                : <ChevronRight onClick={() => toggleExpand(item.id)} className="text-gray-600 font-bold text-md hover:bg-gray-200 p-1 rounded-full" />
                            }
                            </div>

                        </button>

                        {expanded && (
                            <div className="border-t p-4 space-y-6">

                                <div>

                                    <Card className="shadow-sm">
                                        <CardHeader className="border-b bg-green-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg text-green-700">
                                                        Permanent Items (In Stock)
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Available permanent items requisitions
                                                    </CardDescription>
                                                </div>

                                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                                    {item.requisitions.inStock.total_count} Records
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-lg overflow-hidden border shadow-sm mt-2">

                                                <Table>

                                                    <TableHeader>
                                                        <TableRow>

                                                            <TableHead>
                                                                Purchase Requisition Order #
                                                            </TableHead>

                                                            <TableHead>
                                                                Requisition Date
                                                            </TableHead>

                                                            <TableHead>
                                                                Category Type
                                                            </TableHead>

                                                            <TableHead>
                                                                Store
                                                            </TableHead>

                                                            <TableHead className="text-right">
                                                                Total Items
                                                            </TableHead>

                                                            <TableHead>
                                                                Status
                                                            </TableHead>

                                                            <TableHead>
                                                                Created By
                                                            </TableHead>

                                                            <TableHead className="text-center">
                                                                Actions
                                                            </TableHead>

                                                        </TableRow>
                                                    </TableHeader>


                                                    <TableBody>

                                                        {paginatedInStockRequisitions.length > 0 ? (

                                                            paginatedInStockRequisitions.map((pr, index) => (

                                                                <TableRow key={pr.id || index}>

                                                                    <TableCell className="font-semibold text-blue-600">
                                                                        {pr.purchase_req_number}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.purchase_req_date}
                                                                    </TableCell>

                                                                    <TableCell className="capitalize">
                                                                        {pr.category_type}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.store.name}
                                                                    </TableCell>

                                                                    <TableCell className="text-right">
                                                                        {pr.total_items}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={
                                                                                pr.status.value === "APPROVED"
                                                                                    ? "bg-green-100 text-green-800 border-green-300"
                                                                                    : pr.status.value === "NEW"
                                                                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                                                                        : pr.status.value === "REJECTED"
                                                                                            ? "bg-red-100 text-red-800 border-red-300"
                                                                                            : "bg-blue-100 text-blue-800 border-blue-300"
                                                                            }
                                                                        >
                                                                            {pr.status.value}
                                                                        </Badge>
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.created_by}
                                                                    </TableCell>

                                                                    <TableCell>

                                                                        <div className="flex justify-center gap-2">

                                                                           {/* View */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(pr.id)}
                                          >
                                            <FileText className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View")
                                          ? "View Requisition"
                                          : "You do not have permission to view requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Edit */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(pr.id)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Edit")
                                          ? "Edit Requisition"
                                          : "You do not have permission to edit requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* View Approvals */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(pr.id)}
                                          >
                                            <FileCheck className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View Approvals")
                                          ? "View Approval Details"
                                          : "You do not have permission to view approvals"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Print */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(pr.id)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Print")
                                          ? "Print Requisition"
                                          : "You do not have permission to print requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                                                        </div>

                                                                    </TableCell>

                                                                </TableRow>

                                                            ))

                                                        ) : (

                                                            <TableRow>

                                                                <TableCell
                                                                    colSpan={8}
                                                                    className="text-center py-6"
                                                                >
                                                                    No permanent in-stock requisitions found
                                                                </TableCell>

                                                            </TableRow>

                                                        )}

                                                    </TableBody>

                                                </Table>

                                            </div>
                                            <div className="flex items-center justify-between mt-3">

                                                <div className="flex items-center gap-2">

                                                    <span className="text-sm text-muted-foreground">
                                                        Show
                                                    </span>


                                                    <Select
                                                        value={inStockLimit.toString()}
                                                        onValueChange={(value) => handleItemsReqLimitChange(item.id, 'inStock', Number(value))}
                                                    >

                                                        <SelectTrigger className="w-20 h-9">

                                                            <SelectValue />

                                                        </SelectTrigger>


                                                        <SelectContent>

                                                            <SelectItem value="5">
                                                                5
                                                            </SelectItem>

                                                            <SelectItem value="10">
                                                                10
                                                            </SelectItem>

                                                            <SelectItem value="20">
                                                                20
                                                            </SelectItem>

                                                            <SelectItem value="50">
                                                                50
                                                            </SelectItem>

                                                        </SelectContent>

                                                    </Select>


                                                    <span className="text-sm text-muted-foreground">
                                                        entries
                                                    </span>

                                                </div>


                                                <div className="flex gap-2">

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={currentInStockPage === 1}
                                                        onClick={() => handleItemsReqPageChange(item.id, 'inStock', currentInStockPage - 1)}
                                                    >
                                                        Previous
                                                    </Button>


                                                    <div className="px-3 py-1 border rounded text-sm">
                                                        Page {currentInStockPage} of{" "}
                                                        {totalInStockPages || 1}
                                                    </div>


                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            currentInStockPage ===
                                                            totalInStockPages ||
                                                            totalInStockPages === 0
                                                        }
                                                        onClick={() =>
                                                            handleItemsReqPageChange(item.id, 'inStock', currentInStockPage + 1)
                                                        }
                                                    >
                                                        Next
                                                    </Button>

                                                </div>

                                            </div>
                                        </CardContent>
                                    </Card>



                                </div>

                                <div>

                                    <Card className="shadow-sm">
                                        <CardHeader className="border-b bg-red-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg text-red-700">
                                                        Permanent Items (Out of Stock)
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Available permanent items requisitions
                                                    </CardDescription>
                                                </div>

                                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                                    {item.requisitions.outOfStock.total_count} Records
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-lg overflow-hidden border shadow-sm mt-2">

                                                <Table>

                                                    <TableHeader>
                                                        <TableRow>

                                                            <TableHead>
                                                                Purchase Requisition Order #
                                                            </TableHead>

                                                            <TableHead>
                                                                Requisition Date
                                                            </TableHead>

                                                            <TableHead>
                                                                Category Type
                                                            </TableHead>

                                                            <TableHead>
                                                                Store
                                                            </TableHead>

                                                            <TableHead className="text-right">
                                                                Total Items
                                                            </TableHead>

                                                            <TableHead>
                                                                Status
                                                            </TableHead>

                                                            <TableHead>
                                                                Created By
                                                            </TableHead>

                                                            <TableHead className="text-center">
                                                                Actions
                                                            </TableHead>

                                                        </TableRow>
                                                    </TableHeader>


                                                    <TableBody>

                                                        {paginatedOutOfStockRequisitions.length > 0 ? (

                                                            paginatedOutOfStockRequisitions.map((pr, index) => (

                                                                <TableRow key={pr.id || index}>

                                                                    <TableCell className="font-semibold text-blue-600">
                                                                        {pr.purchase_req_number}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.purchase_req_date}
                                                                    </TableCell>

                                                                    <TableCell className="capitalize">
                                                                        {pr.category_type}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.store.name}
                                                                    </TableCell>

                                                                    <TableCell className="text-right">
                                                                        {pr.total_items}
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={
                                                                                pr.status.value === "APPROVED"
                                                                                    ? "bg-green-100 text-green-800 border-green-300"
                                                                                    : pr.status.value === "NEW"
                                                                                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                                                                        : pr.status.value === "REJECTED"
                                                                                            ? "bg-red-100 text-red-800 border-red-300"
                                                                                            : "bg-blue-100 text-blue-800 border-blue-300"
                                                                            }
                                                                        >
                                                                            {pr.status.value}
                                                                        </Badge>
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {pr.created_by}
                                                                    </TableCell>

                                                                    <TableCell>

                                                                        <div className="flex justify-center gap-2">

  {/* View */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(pr.id)}
                                          >
                                            <FileText className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View")
                                          ? "View Requisition"
                                          : "You do not have permission to view requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Edit */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(pr.id)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Edit")
                                          ? "Edit Requisition"
                                          : "You do not have permission to edit requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* View Approvals */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(pr.id)}
                                          >
                                            <FileCheck className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("View Approvals")
                                          ? "View Approval Details"
                                          : "You do not have permission to view approvals"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  {/* Print */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(pr.id)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>

                                      <TooltipContent>
                                        {hasPermission("Print")
                                          ? "Print Requisition"
                                          : "You do not have permission to print requisitions"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                                                        </div>

                                                                    </TableCell>

                                                                </TableRow>

                                                            ))

                                                        ) : (

                                                            <TableRow>

                                                                <TableCell
                                                                    colSpan={8}
                                                                    className="text-center py-6"
                                                                >
                                                                    No permanent out-of-stock requisitions found
                                                                </TableCell>

                                                            </TableRow>

                                                        )}

                                                    </TableBody>

                                                </Table>

                                            </div>
                                            <div className="flex items-center justify-between mt-3">

                                                <div className="flex items-center gap-2">

                                                    <span className="text-sm text-muted-foreground">
                                                        Show
                                                    </span>


                                                    <Select
                                                        value={outOfStockLimit.toString()}
                                                        // onValueChange={(value) => {

                                                        //     setItemsLimit(Number(value));

                                                        //     setItemsPage(1);

                                                        // }}
                                                        onValueChange={(value) => handleItemsReqLimitChange(item.id, 'outOfStock', Number(value))}
                                                    >

                                                        <SelectTrigger className="w-20 h-9">

                                                            <SelectValue />

                                                        </SelectTrigger>


                                                        <SelectContent>

                                                            <SelectItem value="5">
                                                                5
                                                            </SelectItem>

                                                            <SelectItem value="10">
                                                                10
                                                            </SelectItem>

                                                            <SelectItem value="20">
                                                                20
                                                            </SelectItem>

                                                            <SelectItem value="50">
                                                                50
                                                            </SelectItem>

                                                        </SelectContent>

                                                    </Select>


                                                    <span className="text-sm text-muted-foreground">
                                                        entries
                                                    </span>

                                                </div>


                                                <div className="flex gap-2">

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            currentOutOfStockPage === 1
                                                        }
                                                        // onClick={() =>
                                                        //     handleOutOfStockPageChange(
                                                        //         item.id,
                                                        //         currentOutOfStockPage - 1
                                                        //     )
                                                        // }
                                                        onClick={() => handleItemsReqPageChange(item.id, 'outOfStock', currentOutOfStockPage - 1)}
                                                    >
                                                        Previous
                                                    </Button>


                                                    <div className="px-3 py-1 border rounded text-sm">
                                                        Page {currentOutOfStockPage} of{" "}
                                                        {totalOutOfStockPages || 1}
                                                    </div>


                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            currentOutOfStockPage ===
                                                            totalOutOfStockPages ||
                                                            totalOutOfStockPages === 0
                                                        }
                                                        onClick={() =>
                                                            handleItemsReqPageChange(item.id, 'outOfStock', currentOutOfStockPage + 1)
                                                        }
                                                    >
                                                        Next
                                                    </Button>

                                                </div>

                                            </div>
                                        </CardContent>
                                    </Card>

                                </div>

                            </div>
                        )}

                    </div>

                );

            })}




            <div className="flex items-center justify-between pt-4 border-t">


                <div className="flex items-center gap-2">

                    <span className="text-sm text-muted-foreground">
                        Show
                    </span>


                    <Select
                        value={itemsLimit.toString()}
                        onValueChange={(value) => {

                            setItemsLimit(Number(value));

                            setItemsPage(1);

                        }}
                    >

                        <SelectTrigger className="w-20 h-9">

                            <SelectValue />

                        </SelectTrigger>


                        <SelectContent>

                            <SelectItem value="5">
                                5
                            </SelectItem>

                            <SelectItem value="10">
                                10
                            </SelectItem>

                            <SelectItem value="20">
                                20
                            </SelectItem>

                            <SelectItem value="50">
                                50
                            </SelectItem>

                        </SelectContent>

                    </Select>


                    <span className="text-sm text-muted-foreground">
                        entries
                    </span>

                </div>


                <div className="flex items-center gap-2">

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={itemsPage === 1}
                        onClick={() =>
                            setItemsPage(itemsPage - 1)
                        }
                    >
                        Previous
                    </Button>


                    <div className="px-3 py-1 border rounded text-sm">
                        Page {itemsPage} of {totalItemsPage}
                    </div>


                    <Button
                        variant="outline"
                        size="sm"
                        disabled={
                            itemsPage === totalItemsPage
                        }
                        onClick={() =>
                            setItemsPage(itemsPage + 1)
                        }
                    >
                        Next
                    </Button>

                </div>

            </div>

        </div>
        <ItemSuppliersModal
        open={showItemSuppliersModal}
        onClose={() => setShowItemSuppliersModal(false)}
        suppliersItemId={suppliersItemId}
        />

</>
    );
};

export default ViewItems;

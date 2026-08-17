import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/chatButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/Utils/types/supabaseClient';
import { ChevronLeft, ChevronRight, Edit, FileCheck, FileText, Printer } from 'lucide-react';
import React, { useEffect, useState } from 'react'

interface Requisition {
  id: string;
  purchase_req_number: string;
  purchase_req_date: string;
  category_type: string;
  store: {
    id: string;
    code: string;
    name: string;
  } | null;
  total_items: number;
  status: string;
  status_value: string;
  created_by: string;
  department: {
    id: string;
    department_id: string;
    department_name: string;
  } | null;
  approval_status: string;
  created_at: string;
}


interface Item {
  id: string;
  itemName: string;
  permanentInStock: Requisition[];
  permanentOutOfStock: Requisition[];
}

interface ClosedRequisitionsProps {
  companyId: string;
  userId: string;
  isSuperAdmin: boolean;

  statusFilter?: string | null;
  storeFilter?: string | null;
  categoryTypeFilter?: string | null;
  searchTerm?: string | null;

   hasPermission: (permission: string) => boolean;

  
  handleView: (item: string) => void;
  handleEdit: (item: string) => void;
  handlePrint: (item: string) => void;
  handleApprovalView: (item: string) => void;
}
function ClosedRequisitions({
  companyId,
  userId,
  isSuperAdmin,

  statusFilter = null,
  storeFilter = null,
  categoryTypeFilter=null,
  searchTerm = null,
   hasPermission,
  handleView,
  handleEdit,
  handlePrint,
  handleApprovalView,
 }: ClosedRequisitionsProps) {

  const [closedRequisitions, setClosedRequisitions] = useState<Requisition[]>([])



  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)



  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const fetchClosedRequisitions = async () => {
    console.log("Ids", companyId, userId);
   

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_closed_purchase_requisitions_for_listing" as any, {
        p_company_id: companyId,
        p_user_id: userId,
        p_is_super_admin: isSuperAdmin,
       p_status:
      statusFilter === "all"
        ? null
        : statusFilter,

    p_store_id:
      storeFilter === "all"
        ? null
        : storeFilter,

    p_category_type:
      categoryTypeFilter === "all"
        ? "all"
        : categoryTypeFilter,

    p_search: searchTerm,
        p_closed_page: currentPage,
        p_closed_limit: itemsPerPage

      })

      if (error) {
        console.error("Error fetching closed requisitions:", error);
        setClosedRequisitions([]);
        setTotalCount(0);
        return;
      }

      console.log("Closed Requisitions Data:", data);

      const closedData = (data as any)?.closed;
      if (!closedData) {
        setClosedRequisitions([]);
        setTotalCount(0);
        return;
      }

      setClosedRequisitions(closedData.data || [])

      setTotalCount(closedData.total_count || 0)
    } catch (error) {
      console.error("Error fetching closed requisitions:", error);
      setClosedRequisitions([]);
      setTotalCount(0);
    }
    finally {
      setLoading(false);
    }
  }
  useEffect(() => {

    fetchClosedRequisitions();

  }, [
    companyId,
    userId,
    isSuperAdmin,
    status,
    storeFilter,
    categoryTypeFilter,
    searchTerm,
    currentPage,
    itemsPerPage,
  ]);


  

  const handleItemsPerPageChange = (value: string) => {
    const newLimit = Number(value);
    setItemsPerPage(newLimit)
    setCurrentPage(1)
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
     }
  }
  return (
    <div>


      <div>

        <div className="rounded-lg overflow-hidden border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-gray-50 border-gray-200">
                <TableHead className="font-semibold w-[180px]">
                  Purchase Requisition Order #
                </TableHead>

                <TableHead className="font-semibold w-[150px]">
                  Requisition Date
                </TableHead>

                <TableHead className="font-semibold">
                  Category Type
                </TableHead>

                <TableHead className="font-semibold">
                  Store
                </TableHead>

                <TableHead className="font-semibold text-right">
                  Total Items
                </TableHead>

                <TableHead className="font-semibold">
                  Status
                </TableHead>

                <TableHead className="font-semibold">
                  Created By
                </TableHead>

                <TableHead className="font-semibold text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {closedRequisitions.length > 0 ? (
                closedRequisitions.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-gray-50"
                  >
                   
                    <TableCell className="font-medium py-3">
                      <p className="ps-2">
                        {item.purchase_req_number}
                      </p>
                    </TableCell>

                   
                    <TableCell>
                     {item.purchase_req_date
                        ? new Date(
                            item.purchase_req_date
                          ).toLocaleDateString()
                        : "-"
                      }
                    </TableCell>

                  
                    <TableCell className="capitalize">
                    {item.category_type || "-"}
                    </TableCell>

                   
                    <TableCell className="capitalize">
                      {item.store?.name || "-"}
                    </TableCell>

                   
                    <TableCell className="text-right">
                       {item.total_items}

                    </TableCell>

                  
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 border-blue-300"
                      >
                       {item.status_value}
                      </Badge>
                    </TableCell>

                   
                    <TableCell>
                       {item.created_by || "-"}
                    </TableCell>

                  
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                       
                        <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View")}
                                            onClick={() => handleView(item.id)}
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
                       
                       <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Edit")}
                                            onClick={() => handleEdit(item.id)}
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
                       
                      <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("View Approvals")}
                                            onClick={() => handleApprovalView(item.id)}
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

                       
                         <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={!hasPermission("Print")}
                                            onClick={() => handlePrint(item.id)}
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
                    className="text-center py-6 text-muted-foreground"
                  >
                    No closed requisitions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 gap-4">


         

          <div className="flex items-center gap-2">

            <span className="text-sm text-muted-foreground">
              Show
            </span>


            <Select
              value={itemsPerPage.toString()}
              onValueChange={
                handleItemsPerPageChange
              }
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



          <div className="flex items-center space-x-2">




            <Button
              variant="outline"
              size="sm"
               disabled={currentPage === 1}
              onClick={
                handlePreviousPage
              }
            >
              Previous
            </Button>




            <div className="flex items-center justify-center text-sm font-medium bg-gray-100 px-3 py-1 rounded">

              Page {currentPage} of{" "}
              {totalPages || 1}

            </div>



            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={
                handleNextPage
              }
            >
              Next
            </Button>


          </div>

        </div>

      </div>

    </div>



  )
}

export default ClosedRequisitions

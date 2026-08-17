import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Info, MessageSquareWarning, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ItemRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  fetchTransferData: () => void;
}

interface TransferRequest {
  id: string;
  sourceStore: string;
  destinationStore: string;
  quantity: number;
  status: "pending" | "accepted" | "rejected";
  requestedBy: string;
  acceptedBy?: string;
  rejectedBy?: string;
  requestId?: string;
  notes?: string;
  rejectionReason?: string;
  sourceStoreId: string;
  destinationStoreId: string;
  companyId?: string;
}

export default function ItemRequestsModal({
  open,
  onOpenChange,
  itemId,
  fetchTransferData
}: ItemRequestsModalProps) {
  const [pendingRequests, setPendingRequests] = useState<TransferRequest[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
const [rejectionReason, setRejectionReason] = useState("");
const [rejectedRequests, setRejectedRequests] = useState<TransferRequest[]>([]);
const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
const [selectedAcceptRequest, setSelectedAcceptRequest] =useState<TransferRequest | null>(null);


  const fetchTransferRequests = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("inv_transfer_requests")
        .select(`*,
          source_store:store_mgmt!origin_store_id(id,name),
          destination_store:store_mgmt!destination_store_id(id,name),
          requester:user_mgmt!requested_by(id,first_name,last_name),
          accepted_by:user_mgmt!accepted_by(id,first_name,last_name),
          rejected_by:user_mgmt!rejected_by(id,first_name,last_name)
        `)
        .eq("item_id", itemId);

      if (error) throw error;

      const mappedRequests: TransferRequest[] = (data || []).map((req: any) => ({
        id: req.id,
        requestId: req.request_id,
        sourceStoreId: req.origin_store_id,
        destinationStoreId: req.destination_store_id,
        companyId: req.company_id,
        sourceStore: req.source_store?.name ?? "-",
        destinationStore: req.destination_store?.name ?? "-",
        quantity: req.transfer_qty,
        status: req.status,
        requestedBy: `${req.requester?.first_name ?? ""} ${req.requester?.last_name ?? ""}`.trim(),
        acceptedBy: `${req.accepted_by?.first_name ?? ""} ${req.accepted_by?.last_name ?? ""}`.trim(),
        rejectedBy: `${req.rejected_by?.first_name ?? ""} ${req.rejected_by?.last_name ?? ""}`.trim(),
        notes: req.notes ?? "",
        rejectionReason: req.rejection_reason ?? "",
      }));

      console.log("Fetched transfer requests:", mappedRequests);

      setPendingRequests(mappedRequests.filter((r) => String(r.status).toLowerCase() === "pending"));
      setAcceptedRequests(mappedRequests.filter((r) => String(r.status).toLowerCase() === "accepted"));
      setRejectedRequests(mappedRequests.filter((r) => String(r.status).toLowerCase() === "rejected"));
    } catch (error) {
      console.error("Error fetching transfer requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!itemId || !open) {
      setPendingRequests([]);
      setAcceptedRequests([]);
      setRejectedRequests([]);
      return;
    }

    fetchTransferRequests();
  }, [itemId, open]);

  const acceptRequest = async (reqId: string) => {
    setLoading(true);
    try {
      const request = pendingRequests.find((req) => req.id === reqId);
      if (!request) {
        toast.error("Request not found.");
        return;
      }

      const user = localStorage.getItem("userData");
      const userData = user ? JSON.parse(user) : null;

      // 1. Fetch available stock in origin store
      const { data: originStockRows, error: originError } = await supabase
        .from('inventory_mgmt')
        .select('*')
        .eq('item_id', itemId)
        .eq('store_id', request.sourceStoreId)
        .gt('item_qty', 0)
        .order('stock_date', { ascending: true });

      if (originError) throw originError;

      const totalAvailable = originStockRows?.reduce((sum, row) => sum + (row.item_qty || 0), 0) || 0;
      if (totalAvailable < request.quantity) {
        toast.error('Insufficient stock in source store to fulfill this request.');
        return;
      }

      let remainingQuantity = request.quantity;
      const now = new Date().toISOString();

      // 2. Perform cumulative stock transfer
      for (const originRow of originStockRows || []) {
        if (remainingQuantity <= 0) break;

        const deductQty = Math.min(originRow.item_qty ?? 0, remainingQuantity);
        remainingQuantity -= deductQty;

        // Update origin stock
        const { error: updateOriginError } = await supabase
          .from('inventory_mgmt')
          .update({ item_qty: (originRow.item_qty ?? 0) - deductQty })
          .eq('id', originRow.id);

        if (updateOriginError) throw updateOriginError;

        // Check destination stock
        const { data: destStockRow, error: _destStockError } = await supabase
          .from('inventory_mgmt')
          .select('*')
          .eq('item_id', itemId)
          .eq('store_id', request.destinationStoreId)
          .eq('purchase_order_id', originRow.purchase_order_id as string)
          .is('link_loc', null)
          .maybeSingle();

        if (destStockRow) {
          const { error: updateDestError } = await supabase
            .from('inventory_mgmt')
            .update({ item_qty: (destStockRow.item_qty || 0) + deductQty })
            .eq('id', destStockRow.id);
          if (updateDestError) throw updateDestError;
        } else {
          const { error: insertDestError } = await supabase
            .from('inventory_mgmt')
            .insert({
              item_id: itemId,
              store_id: request.destinationStoreId,
              purchase_order_id: originRow.purchase_order_id,
              item_qty: deductQty,
              unit_price: originRow.unit_price,
              selling_price: originRow.selling_price,
              stock_date: now,
              created_at: now,
              company_id: request.companyId,
              link_loc: null,
            });
          if (insertDestError) throw insertDestError;
        }

        // Record the transfer
        const { error: transferError } = await supabase
          .from('inventory_transfer')
          .insert({
            orgin_store_id: request.sourceStoreId,
            destination_store_id: request.destinationStoreId,
            item_id: itemId,
            transfer_qty: deductQty,
            transfer_date: now,
            created_by: userData?.id,
            created_at: now,
            notes: request.notes || `Accepted Transfer Request`,
            company_id: request.companyId,
            origin_inv_loc: originRow.link_loc || null,
            destination_inv_loc: null,
          });

        if (transferError) throw transferError;
      }

      // 3. Update transfer request status
      const { error } = await (supabase as any)
        .from("inv_transfer_requests")
        .update({
          status: "Accepted",
          accepted_by: userData?.id || null
        })
        .eq("id", reqId);

      if (error) throw error;

      toast.success("Request accepted and stock transferred.");
      await fetchTransferRequests();
      await fetchTransferData();
    } catch (err: any) {
      console.error("Accept request failed:", err);
      toast.error(err.message || "Failed to accept request.");
    } finally {
      setLoading(false);
    }
  };


  const rejectRequest = async () => {
  if (!selectedRequest) return;

  if (!rejectionReason.trim()) {
    toast.error("Please enter a rejection reason.");
    return;
  }

  setLoading(true);

  try {
    const user = localStorage.getItem("userData");
    const userData = user ? JSON.parse(user) : null;

    const { error } = await (supabase as any)
      .from("inv_transfer_requests")
      .update({
        status: "Rejected",
        rejection_reason: rejectionReason,
        rejected_by: userData?.id,
      })
      .eq("id", selectedRequest.id);

    if (error) throw error;

    toast.success("Request rejected successfully.");

    setRejectDialogOpen(false);
    setSelectedRequest(null);
    setRejectionReason("");

    await fetchTransferRequests();
  } catch (err: any) {
    console.error(err);
    toast.error(err.message || "Failed to reject request.");
  } finally {
    setLoading(false);
  }
};

const confirmAcceptRequest = async () => {
  if (!selectedAcceptRequest) return;

  await acceptRequest(selectedAcceptRequest.id);

  setAcceptDialogOpen(false);
  setSelectedAcceptRequest(null);
};


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[55vw] !max-w-none max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 font-semibold border-b">
          <DialogTitle>Transfer Requests</DialogTitle>
          <DialogDescription>
            View pending and accepted transfer requests for this item
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)] space-y-6">
          <div className="space-y-3 bg-orange-50 rounded-lg p-4 border">
            <h3 className="text-base font-semibold flex items-center gap-1">
              <span className="text-orange-500">Pending Requests</span>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </h3>
            {pendingRequests.length > 0 ? (
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <Card
                    key={request.id}
                    className="border border-gray-200 rounded-lg bg-white"
                  >

                    <CardHeader className="flex justify-between items-start">
                      <div>
                        <p className=" font-medium text-gray-900 flex items-center gap-1">
                          <span>{request.sourceStore}</span>
                          <ArrowRight className="mx-1 h-4 w-4 text-gray-500" />
                          <span>{request.destinationStore}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Req Id: {request.requestId ? request.requestId : "N/A"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-500 text-xs p-2 hover:bg-green-600"
                            onClick={()=>{
                              setSelectedAcceptRequest(request);
                              setAcceptDialogOpen(true);
                            }}
                            disabled={loading}
                          >
                            Accept
                          </Button>

                          <Button
                            size="sm"
                            className="bg-red-500 text-xs p-2 hover:bg-red-600"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRejectDialogOpen(true);
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="font-medium text-gray-900">{request.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Requested By</p>
                          <p className="font-medium text-gray-900">{request.requestedBy}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <Badge variant="warning" className="text-xs">
                            <AlertCircle />Pending
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 border-t pt-3 text-sm flex gap-1 items-center">
                        <p className=" text-gray-700 flex items-center gap-1"><Info className="h-3 w-3 text-gray-600" />
                          <span>Notes :</span></p>

                        {request.notes ? (
                          <p className=" text-gray-600">
                            {request.notes}
                          </p>
                        ) : (
                          <p className="flex items-center gap-2 italic text-gray-400">
                            No notes available
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No pending requests
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-3 bg-green-50 rounded-lg p-4 border">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <div className="flex justify-between items-center cursor-pointer">
                  <h3 className="text-base font-semibold flex items-center gap-1">
                    <span className="text-green-600">Accepted Requests</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </h3>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {acceptedRequests.length > 0 ? (
                  <div className="space-y-2">
                    {acceptedRequests.map((request) => (
                      <Card
                        key={request.id}
                        className="border border-gray-200 rounded-lg bg-white"
                      >

                        <CardHeader className="flex justify-between items-start">
                          <div>
                            <p className=" font-medium text-gray-900 flex items-center gap-1">
                              <span>{request.sourceStore}</span>
                              <ArrowRight className="mx-1 h-4 w-4 text-gray-500" />
                              <span>{request.destinationStore}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">ID: {request.requestId ?? request.id}</p>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">Quantity</p>
                              <p className="font-medium text-gray-900">{request.quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Requested By</p>
                              <p className="font-medium text-gray-900">{request.requestedBy}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Accepted By</p>
                              <p className="font-medium text-gray-900">{request.acceptedBy || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Status</p>
                              <Badge variant="success" className="text-xs">
                                <CheckCircle2 />Accepted
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 border-t pt-3 text-sm flex gap-1 items-center">
                        <p className=" text-gray-700 flex items-center gap-1"><Info className="h-3 w-3 text-gray-600" />
                          <span>Notes :</span></p>

                        {request.notes ? (
                          <p className=" text-gray-600">
                            {request.notes}
                          </p>
                        ) : (
                          <p className="flex items-center gap-2 italic text-gray-400">
                            No notes available
                          </p>
                        )}
                      </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No accepted requests
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

                    <div className="space-y-3 bg-red-50 rounded-lg p-4 border">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <div className="flex justify-between items-center cursor-pointer">
                  <h3 className="text-base font-semibold flex items-center gap-1">
                    <span className="text-red-600">Rejected Requests</span>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </h3>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {rejectedRequests.length > 0 ? (
                  <div className="space-y-2">
                    {rejectedRequests.map((request) => (
                      <Card
                        key={request.id}
                        className="border border-gray-200 rounded-lg bg-white"
                      >

                        <CardHeader className="flex justify-between items-start">
                          <div>
                            <p className=" font-medium text-gray-900 flex items-center gap-1">
                              <span>{request.sourceStore}</span>
                              <ArrowRight className="mx-1 h-4 w-4 text-gray-500" />
                              <span>{request.destinationStore}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">ID: {request.requestId ?? request.id}</p>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">Quantity</p>
                              <p className="font-medium text-gray-900">{request.quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Requested By</p>
                              <p className="font-medium text-gray-900">{request.requestedBy}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Rejected By</p>
                              <p className="font-medium text-gray-900">{request.rejectedBy}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Status</p>
                              <Badge variant="destructive" className="text-xs">
                                <XCircle />Rejected
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 text-sm flex gap-1 items-center">
                        <p className=" text-red-600 flex items-center gap-1"><MessageSquareWarning className="h-3 w-3 mt-1 text-red-600" />
                          <span>Rejection Reason :</span></p>
                          <p className="text-red-400">{request.rejectionReason}</p>
                          </div>
                          <div className="mt-3 border-t pt-3 text-sm flex gap-1 items-center">
                        <p className=" text-gray-700 flex items-center gap-1"><Info className="h-3 w-3 text-gray-600" />
                          <span>Notes :</span></p>

                        {request.notes ? (
                          <p className=" text-gray-600">
                            {request.notes}
                          </p>
                        ) : (
                          <p className="flex items-center gap-2 italic text-gray-400">
                            No notes available
                          </p>
                        )}
                      </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No rejected requests
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
  open={acceptDialogOpen}
  onOpenChange={(open) => {
    setAcceptDialogOpen(open);

    if (!open) {
      setSelectedAcceptRequest(null);
    }
  }}
>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Accept Transfer Request</DialogTitle>
      <DialogDescription>
        This will transfer stock from the source store to the
        destination store.
      </DialogDescription>
    </DialogHeader>

    {selectedAcceptRequest && (
      <div className="space-y-3 text-sm">
        <div className="rounded-md border p-3 bg-slate-50">
          <p className="font-medium flex items-center gap-1">
            <span>{selectedAcceptRequest.sourceStore}</span>
            <ArrowRight className="h-4 w-4" />
            <span>{selectedAcceptRequest.destinationStore}</span>
          </p>

          <p className="mt-2 text-muted-foreground">
            Quantity:{" "}
            <span className="font-medium text-foreground">
              {selectedAcceptRequest.quantity}
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAcceptDialogOpen(false);
              setSelectedAcceptRequest(null);
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={confirmAcceptRequest}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            Confirm Accept
          </Button>
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>

    <Dialog
  open={rejectDialogOpen}
  onOpenChange={(open) => {
    setRejectDialogOpen(open);

    if (!open) {
      setSelectedRequest(null);
      setRejectionReason("");
    }
  }}
>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Reject Request</DialogTitle>
      <DialogDescription>
        Enter a reason for rejecting this transfer request.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">
          Reason for rejection
        </label>

        <Textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Enter rejection reason..."
          className="w-full min-h-[100px] mt-2 rounded-md border p-3 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setRejectDialogOpen(false)
            setSelectedRequest(null);
            setRejectionReason("");
          }}
        >
          Cancel
        </Button>

        <Button
          variant="destructive"
          onClick={rejectRequest}
          disabled={loading}
        >
          Reject Request
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </>
  );
}

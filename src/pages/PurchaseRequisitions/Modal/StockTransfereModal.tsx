import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { useSelector } from "react-redux";
import { selectUser } from '@/redux/features/userSlice';
import { initiateApprovalRequest } from '@/Utils/commonFun';
interface StockTransferModalProps {
  open: boolean;
  onClose: () => void;
  items: any[];
  destinationStore: string;
  destinationStoreId: string;
}

export default function StockTransferModal({
  open,
  onClose,
  items,
  destinationStore, destinationStoreId
}: StockTransferModalProps) {


  const [selectedStores, setSelectedStores] = useState<
    Record<string, string>
  >({});

  const [transferQty, setTransferQty] = useState<
    Record<string, number>
  >({});

  const [notes, setNotes] = useState<
    Record<string, string>
  >({});

  const [requestIds, setRequestIds] = useState<
    Record<string, string>
  >({});

  const generateRequestId = () => {
    const today = new Date();

    const datePart =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, "0") +
      String(today.getDate()).padStart(2, "0");

    const randomPart = String(
      Math.floor(Math.random() * 9999) + 1
    ).padStart(4, "0");

    return `REQ-${datePart}-${randomPart}`;
  };

  useEffect(() => {
    if (!open || items.length === 0) return;

    const ids: Record<string, string> = {};

    items.forEach((item) => {
      ids[item.id] = generateRequestId();
    });

    setRequestIds(ids);
  }, [open, items]);


  useEffect(() => {
    if (open) {
      console.log("Stock Transfer Modal Items:", items);
    }
  }, [open, items]);
  const [availableStores, setAvailableStores] = useState<
    Record<string, any[]>
  >({});
  const userData = useSelector(selectUser);
  const companyId = userData?.company_id || null;

  const fetchAvailableStores = async (itemId: string) => {
    try {
      if (!companyId) {
        toast.error("Company ID not found");
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_item_stock_store_summary",
        {
          p_company_id: companyId,
          p_item_id: itemId,
          p_selected_store_id: destinationStoreId,
        }
      );
      console.log("RPC Response for Item:", itemId);
      console.log("Stores:", data);
      if (error) throw error;

      const stores =
        data?.filter(
          (row: any) =>
            !row.is_selected_store &&
            Number(row.total_stock) > 0
        ) || [];

      setAvailableStores((prev) => ({
        ...prev,
        [itemId]: stores,
      }));


    } catch (err) {
      console.error(err);
    }
  };
  useEffect(() => {
    if (!open || items.length === 0) return;

    items.forEach((item) => {
      fetchAvailableStores(item.id);
    });
  }, [open, items]);

  const handleRequestTransfer = async () => {
    try {
      if (!companyId) {
        toast.error("Company ID not found");
        return;
      }

      for (const item of items) {
        const sourceStore = selectedStores[item.id];

        const qty =
          transferQty[item.id] ??
          Math.max(
            item.quantity - item.selected_store_stock,
            0
          );

        if (!sourceStore) {
          toast.error(
            `Please select source store for ${item.item_name}`
          );
          return;
        }

        if (!qty || qty <= 0) {
          toast.error(
            `Please enter valid quantity for ${item.item_name}`
          );
          return;
        }

        // 🔹 Selected source store stock check
        const selectedStoreData =
          availableStores[item.id]?.find(
            (store: any) =>
              store.store_id === sourceStore
          );

        const availableStock =
          Number(selectedStoreData?.total_stock || 0);

        if (availableStock <= 0) {
          toast.error(
            `${item.item_name} has no stock in selected source store`
          );
          return;
        }

        if (qty > availableStock) {
          toast.error(
            `${item.item_name}: Transfer quantity (${qty}) exceeds available stock (${availableStock})`
          );
          return;
        }
      }

      const payload = items.map((item) => ({
        request_id: requestIds[item.id],
        company_id: companyId,
        origin_store_id: selectedStores[item.id],
        destination_store_id: destinationStoreId,
        item_id: item.id,
        transfer_qty:
          transferQty[item.id] ??
          Math.max(
            item.quantity - item.selected_store_stock,
            0
          ),
        notes: notes[item.id] || null,
        status: "Pending",
        requested_by: userData?.id ?? "",
        accepted_by: null,
      }));

      const operations = [{
        table: 'inv_transfer_requests',
        type: 'insert',
        data: payload
      }];

      const approvalResponse = await initiateApprovalRequest({
        module_name: 'Purchase Requisitions',
        action_name: 'Transfer Stock',
        company_id: companyId,
        requested_by: userData?.id ?? "",
        store_id: destinationStoreId,
        action_payload: { operations }
      });

      if (approvalResponse?.success && approvalResponse.requires_approval) {
          toast.success('Your transfer request has been submitted and is currently pending approval.');
          setSelectedStores({});
          setTransferQty({});
          setNotes({});
          onClose();
          return;
      } else if (approvalResponse && !approvalResponse.success) {
          toast.error(approvalResponse.message);
          return;
      }

      const { error } = await supabase
        .from("inv_transfer_requests" as any)
        .insert(payload)
        .select();

      if (error) throw error;

      toast.success("Transfer request created successfully");

      setSelectedStores({});
      setTransferQty({});
      setNotes({});


      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.message || "Failed to create transfer request"
      );
    }
  };
  const resetForm = () => {
    setSelectedStores({});
    setTransferQty({});
    setNotes({});

  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Stock Transfer</DialogTitle>
        </DialogHeader>


        {/* Source + Destination */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto">

          {items.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 space-y-4"
            >

              <h3 className="font-semibold text-blue-600">
                {item.item_name}
              </h3>

              <div className="space-y-4">

                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="text-sm font-medium mb-2">
                      Request ID
                    </label>

                    <Input
                      value={requestIds[item.id] || ""}
                      readOnly
                      className="bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2">
                      Source Store
                    </label>

                    <Select
                      value={selectedStores[item.id] || ""}
                      onValueChange={(value) =>
                        setSelectedStores((prev) => ({
                          ...prev,
                          [item.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <span>
                          {selectedStores[item.id]
                            ? availableStores[item.id]?.find(
                              (store: any) =>
                                store.store_id === selectedStores[item.id]
                            )?.store_name
                            : "Select Store"}
                        </span>
                      </SelectTrigger>

                      <SelectContent>
                        {availableStores[item.id]?.map(
                          (store: any) => (
                            <SelectItem
                              key={store.store_id}
                              value={store.store_id}
                            >
                              {store.store_name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>

                    {selectedStores[item.id] && (
                      <div className="mt-1 text-xs">
                        <span className="text-slate-500">
                          Available Stock:
                        </span>

                        <span
                          className={`ml-1 font-semibold ${(transferQty[item.id] ??
                              Math.max(
                                item.quantity -
                                item.selected_store_stock,
                                0
                              )) >
                              (availableStores[item.id]?.find(
                                (store: any) =>
                                  store.store_id ===
                                  selectedStores[item.id]
                              )?.total_stock || 0)
                              ? "text-red-600"
                              : "text-green-600"
                            }`}
                        >
                          {availableStores[item.id]?.find(
                            (store: any) =>
                              store.store_id ===
                              selectedStores[item.id]
                          )?.total_stock || 0}{" "}
                          Units
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="text-sm font-medium mb-2">
                      Destination Store
                    </label>

                    <Input
                      disabled
                      value={destinationStore}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2">
                      Transfer Quantity
                    </label>

                    <Input
                      type="number"
                      min={0}
                      value={
                        transferQty[item.id] ??
                        Math.max(
                          item.quantity -
                          item.selected_store_stock,
                          0
                        )
                      }
                      onChange={(e) =>
                        setTransferQty((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                </div>

                {/* Row 3 */}
                <div>
                  <label className="text-sm font-medium mb-2">
                    Notes
                  </label>

                  <Textarea
                    placeholder="Enter transfer reason..."
                    rows={2}
                    value={notes[item.id] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </div>

              </div>
            </div>
          ))}
          {/* Footer */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleRequestTransfer}
            >
              Request Transfer
            </Button>
          </div>
        </div>


      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface StockIssueItem {
  id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  remaining_qty: number;
  selected_store_stock: number;
}

interface StockIssueModalProps {
  open: boolean;
  onClose: () => void;
  items: StockIssueItem[];
  onIssue: (qtys: Record<string, number>) => void;
}

const StockIssueModal: React.FC<StockIssueModalProps> = ({
  open,
  onClose,
  items,
  onIssue,
}) => {
  const [issuingQtys, setIssuingQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      const initialQtys: Record<string, number> = {};
      items.forEach((item) => {
        initialQtys[item.id] = Math.min(item.remaining_qty, item.selected_store_stock);
      });
      setIssuingQtys(initialQtys);
    }
  }, [open, items]);

  const handleQtyChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setIssuingQtys((prev) => ({
      ...prev,
      [itemId]: numValue,
    }));
  };

  const handleIssue = () => {
    onIssue(issuingQtys);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          !max-w-[1200px]
          w-[95vw]
          p-0
          overflow-hidden
        "
      >
        {/* Header */}
        <DialogHeader className="px-8 py-6 border-b bg-slate-50">
          <DialogTitle className="text-2xl font-bold text-blue-700">
            Issue Selected Items
          </DialogTitle>

          <p className="text-sm text-slate-500">
            Review and confirm quantities before issuing the requested items
          </p>
        </DialogHeader>

        {/* Table */}
        <div className="p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-5 py-4 text-left text-sm font-semibold text-slate-700 w-[180px]">
                    Item ID
                  </th>

                  <th className="px-5 py-4 text-left text-sm font-semibold text-slate-700">
                    Item Name
                  </th>

                  <th className="px-5 py-4 text-center text-sm font-semibold text-slate-700 w-[150px]">
                    Requested Qty
                  </th>

                  <th className="px-5 py-4 text-center text-sm font-semibold text-slate-700 w-[160px]">
                    Available Stock
                  </th>

                  <th className="px-5 py-4 text-center text-sm font-semibold text-slate-700 w-[160px]">
                    Remaining Qty
                  </th>

                  <th className="px-5 py-4 text-center text-sm font-semibold text-slate-700 w-[180px]">
                    Issuing Qty
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const requestedQty = item.quantity;
                  const availableStock = item.selected_store_stock;
                  const remainingQty = item.remaining_qty;
                  const maxIssuable = Math.min(remainingQty, availableStock);
                  const currentQty = issuingQtys[item.id] ?? 0;

                  return (
                    <tr
                      key={item.id}
                      className={`
                        hover:bg-blue-50/40 transition-colors
                        ${index !== items.length - 1 ? "border-b" : ""}
                      `}
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold text-blue-600">
                          {item.item_code}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {item.item_name}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="font-semibold">
                          {requestedQty}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                          {availableStock}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`
                            inline-flex px-3 py-1 rounded-full text-sm font-medium
                            ${
                              remainingQty > 0
                                ? "bg-red-50 text-red-600"
                                : "bg-green-50 text-green-600"
                            }
                          `}
                        >
                          {remainingQty}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Input
                          type="number"
                          min={0}
                          max={maxIssuable}
                          value={currentQty}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          className="w-28 mx-auto text-center"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-5 border-t bg-slate-50">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button onClick={handleIssue} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
            Issue Stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockIssueModal;
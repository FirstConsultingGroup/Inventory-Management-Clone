import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CancelItemModalProps {
  open: boolean;
  onClose: () => void;
  partName?: string;
  maxQuantity?: number;
  onConfirm?: (quantity: number, reason: string) => void;
}

const CancelItemModal = ({
  open,
  onClose,
  partName = "Radiator",
  maxQuantity = 10,
  onConfirm,
}: CancelItemModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

  const MAX_QUANTITY = maxQuantity;

const increaseQty = () => {
  if (quantity < MAX_QUANTITY) {
    setQuantity((prev) => prev + 1);
  }
};

const decreaseQty = () => {
  if (quantity > 1) {
    setQuantity((prev) => prev - 1);
  }
};
  const handleClose = () => {
    setQuantity(1);
    setReason("");
    onClose();
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(quantity, reason);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent 
        className="sm:max-w-[600px] rounded-xl p-6"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-0">
  <DialogTitle className="text-2xl font-semibold">
    Cancel Item
  </DialogTitle>

  <p className="text-sm text-muted-foreground">
    Please provide a reason for cancelling this item
  </p>
</DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Confirmation Text */}
          <div>
            <p className="text-base font-medium">
              Are you sure you want to cancel{" "}
              <span className="font-semibold text-blue-600">
                {partName}
              </span>
              ?
            </p>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Quantity to Cancel
            </h3>

            <div className="flex items-center gap-5">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={decreaseQty}
          disabled={quantity <= 1}
          className={`transition-colors ${
            quantity <= 1
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-400 hover:text-black"
          }`}
        >
          <Minus size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {quantity <= 1
            ? "Minimum quantity is 1"
            : "Decrease quantity"}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  <span className="text-lg font-semibold min-w-[20px] text-center">
    {quantity}
  </span>

  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={increaseQty}
          disabled={quantity >= MAX_QUANTITY}
          className={`transition-colors ${
            quantity >= MAX_QUANTITY
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-400 hover:text-black"
          }`}
        >
          <Plus size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {quantity >= MAX_QUANTITY
            ? `Maximum quantity is ${MAX_QUANTITY}`
            : "Increase quantity"}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
          </div>

          {/* Reason */}
         <div className="flex flex-col gap-2">
  <label className="text-sm font-semibold">
    Cancellation Reason
  </label>

  <textarea
    value={reason}
    onChange={(e) => setReason(e.target.value)}
    placeholder="Enter reason"
    rows={4}
    className="w-full rounded-md border border-gray-300 p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-9 px-5 border-blue-600 text-blue-600 bg-white hover:bg-blue-50 text-sm"
            >
              Close
            </Button>

            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!reason.trim()}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              Confirm Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelItemModal;
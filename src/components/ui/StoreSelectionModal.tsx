import { useEffect, useState } from "react";
import { Check, Store as StoreIcon, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";


interface Store {
  id: string;
  name: string;
  location_data: {
    location_name: string | null;
  } | null;
}



interface StoreSelectionModalProps {
  open: boolean;
  stores: Store[];
  currentStoreId?: string | null;
  onConfirm: (storeId: string) => void;
  onClose:()=>void
}

export function StoreSelectionModal({
  open,
  stores,
  currentStoreId,
  onConfirm,
  onClose,
}: StoreSelectionModalProps)  {
  const [selectedStore, setSelectedStore] = useState<string | null>(currentStoreId || null);

  useEffect(() => { if (open) { setSelectedStore(currentStoreId || null); } }, [open, currentStoreId]);

  const handleConfirm = () => {
    if (!selectedStore) {
      return;
    }

    onConfirm(selectedStore);
  };
console.log("STORES",stores)
  return (
   <Dialog
  open={open}
  onOpenChange={(isOpen) => {
    if (!isOpen) {
      onClose();
    }
  }}
>
     <DialogContent
  className="!w-[90vw] !max-w-3xl [&>button]:hidden"
  onInteractOutside={(event) => event.preventDefault()}
  onEscapeKeyDown={(event) => event.preventDefault()}
>
        
       <DialogHeader className="relative">
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
      <StoreIcon className="h-5 w-5 text-blue-600" />
    </div>

    <div className="text-left">
      <DialogTitle className="text-lg font-semibold text-slate-800">
        Select Store
      </DialogTitle>

      <DialogDescription className="mt-1 text-sm text-slate-500">
        Choose the store you want to work with.
      </DialogDescription>
    </div>
  </div>

  
  <button
    type="button"
    onClick={onClose}
    className="absolute right-0 top-0 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
  >
    <X className="h-5 w-5" />
  </button>
</DialogHeader>

       
        <div className="max-h-[300px] overflow-y-auto py-4 pr-2">
          <div className="grid grid-cols-2 gap-3">
            {stores.map((store) => {
              const isSelected = selectedStore === store.id;

              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedStore(store.id)}
                  className={`relative flex min-h-[80px] w-full items-center justify-between rounded-xl border p-2 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                 
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-blue-100"
                          : "bg-slate-100"
                      }`}
                    >
                      <StoreIcon
                        className={`h-4 w-4 ${
                          isSelected
                            ? "text-blue-600"
                            : "text-slate-500"
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isSelected
                            ? "text-blue-700"
                            : "text-slate-800"
                        }`}
                      >
                        {store.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                    {store.location_data?.location_name}
                      </p>
                    </div>
                  </div>

                  
                  {isSelected && (
                    <div className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        
        <DialogFooter className="mt-2">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedStore}
            className="w-full sm:w-auto px-8"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
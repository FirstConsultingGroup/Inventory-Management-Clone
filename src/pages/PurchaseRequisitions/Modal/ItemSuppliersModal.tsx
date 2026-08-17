import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/Utils/types/supabaseClient";
import { Truck } from "lucide-react";
import React, { useEffect, useState } from "react";

interface ItemSuppliersModalProps {
    open: boolean;
    onClose: (open: boolean) => void;
    suppliersItemId: string | null;
}

interface Supplier {
    id: string;
    supplier_id: string;
    supplier_name: string | null;
}

export const ItemSuppliersModal = ({ open, onClose, suppliersItemId }: ItemSuppliersModalProps) => {

    const [suppliers, setSuppliers] = useState<(Supplier | null)[]>([]);

    useEffect(() => {
        console.log("itemid", suppliersItemId)
        if (!suppliersItemId) return;

        const fetchSuppliersWithItemId = async () => {
            try {
                const { data, error } = await supabase
                    .from('supplier_items')
                    .select(`supplier: supplier_id(id,supplier_id,supplier_name)`)
                    .eq('item_id', suppliersItemId);

                if (data) {
                    console.log("fetched suppliers linked with this item", data)
                    if (data?.length > 0) {
                        setSuppliers(data?.map(s => s.supplier))
                    }
                }
                if (error) throw error;

            } catch (error) {
                console.log("Error fetching suppliers for this item", error)
            }
        }

        fetchSuppliersWithItemId();

    }, [suppliersItemId])



    return (
        <Dialog open={open} onOpenChange={(open) => {
            if (!open) {
                setSuppliers([])
            }
            onClose(open);
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <div className="p-2 rounded-md bg-blue-100">
                            <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="pt-1">Linked Suppliers</span>
                    </DialogTitle>
                    <DialogDescription>View all suppliers currently associated with this item.</DialogDescription>
                </DialogHeader>
                <div>
                    <div className="mt-4">
                        {suppliers.length > 0 ? (
                            <div className="max-h-[270px] overflow-y-auto space-y-2 pr-2">
                                {suppliers.map((s) => (
                                    <div key={s?.id} className="flex items-center gap-3 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium shrink-0">
                                            {s?.supplier_name?.[0] || ''}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{s?.supplier_name}</p>
                                            <p className="text-xs text-gray-500">{s?.supplier_id}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-40 bg-gray-50 flex flex-col items-center justify-center">
                                <span className="font-semibold text-gray-600">No Suppliers Found</span>
                                <p className="text-sm text-gray-500">No suppliers are linked with this item</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
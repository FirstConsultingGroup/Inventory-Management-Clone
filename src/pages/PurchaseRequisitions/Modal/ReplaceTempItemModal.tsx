import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/Utils/types/supabaseClient";
import { useEffect, useState } from "react";
import { IUser } from "@/Utils/constants";
import toast from "react-hot-toast";
import { ArrowLeftRight } from "lucide-react";
import { useParams } from "react-router-dom";

interface ReplaceTempItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: string;
    selectedCategoryType: string;
}


type FormDataType = {
    item_id: string;
    item_name: string;
    category_type: string;
    category_name: string;
};

export default function ReplaceTempItemModal({
    open,
    onOpenChange,
    itemId,
    selectedCategoryType,
}: ReplaceTempItemModalProps) {
    const { id } = useParams<{ id: string }>();

    const user = localStorage.getItem("userData");
    const userData: IUser | null = user ? JSON.parse(user) : null;
    const companyId = userData?.company_id || null;
    const [searchValue, setSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);



    const [formData, setFormData] = useState<FormDataType>({
        item_id: "",
        item_name: "",
        category_type: "",
        category_name: "",
    });

    useEffect(() => {
        if (!itemId || !open) return;

        const fetchItem = async () => {

            try {
                const { data, error } = await supabase
                    .from("item_mgmt")
                    .select(`*,
        category_master(
        id,
        name
        )
        `)
                    .eq("id", itemId)
                    .single();

                if (!error) {

                    setFormData({
                        item_id: data?.item_id || "",
                        item_name: data?.item_name || "",
                        category_type: data?.category_type || "",
                        category_name: data?.category_master?.name || "",
                    });
                }

                console.log("Fetched Item Data:", data);

            } catch (error) {
                console.error("Error fetching item data:", error);
            }
        };

        fetchItem();
    }, [itemId, open]);

    useEffect(() => {
        if (!companyId || !searchValue.trim()) {
            setSearchResults([]);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from("item_mgmt")
                    .select(`
                    id,
                    item_id,
                    item_name,
                    category_type,
                    category_id,
                    category_master(
                        id,
                        name
                    )
                `)
                    .eq("company_id", companyId)
                    .eq("is_temporary", false)
                    .eq("category_type", selectedCategoryType)
                    .or(`item_id.ilike.%${searchValue}%,item_name.ilike.%${searchValue}%`)
                    .limit(10);

                if (error) throw error;

                setSearchResults(data || []);
                console.log("Search Results:", data);
            } catch (err) {
                console.error("Error searching items:", err);
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchValue, companyId]);


    const handleUpdate = async () => {
        if (!selectedItem) {
            toast.error("Please select an item");
            return;
        }

        if (!id) {
            toast.error("Purchase requisition id is missing");
            return;
        }

        try {
            const { error } = await supabase
                .from("purchase_req_details")
                .update({
                    item_id: selectedItem.id
                })
                .eq("purchase_req_id", id)
                .eq("item_id", itemId);

            if (error) throw error;

            toast.success("Item replaced successfully");

            onOpenChange(false);

        } catch (error: any) {
            console.error("Error updating item:", error);
            toast.error(error.message || "Failed to replace item");
        }
    };


    return (
        <Dialog open={open}
            onOpenChange={(open) => {
                if (!open) {
                    setSelectedItem(null);
                    setSearchValue("");
                    setSearchResults([]);
                }

                onOpenChange(open);
            }}
        >
            <DialogContent
                className="
                !max-w-lg
                h-[500px]
                flex flex-col
                overflow-hidden
                rounded-2xl
                border-0
                bg-slate-100
                p-0
                shadow-xl
            "
            >
                {/* Header */}
                <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 text-left">
                    <DialogTitle className="text-lg font-semibold tracking-tight text-blue-500">
                        <span className="flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5" />
                            Replace Temporary Item
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Body */}
                <ScrollArea className="flex-1 px-5 py-4">
                    <div className="space-y-5">

                        {!selectedItem && (
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    placeholder="Search new item..."
                                    className="h-10 rounded-lg border-slate-200 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                />
                            </div>
                        )}
                        {searchValue.trim() && (
                            searchResults.length > 0 ? (
                                <ScrollArea className="flex-1 overflow-hidden pr-2">
                                    <div className="space-y-3">
                                        {searchResults.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedItem(item)
                                                    setSearchResults([]);
                                                    setSearchValue("");
                                                    console.log("Selected Item:", item);
                                                }}
                                                className="
                                                    cursor-pointer
                                                    rounded-lg
                                                    border
                                                    border-slate-200
                                                    bg-white
                                                    p-3
                                                    shadow-sm
                                                    transition-all
                                                    hover:border-blue-300
                                                    hover:bg-blue-50
                                                "
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-md font-medium text-slate-900">
                                                        {item.item_id || "N/A"}
                                                    </span>

                                                    <span className="text-lg font-bold text-slate-500">
                                                        -
                                                    </span>

                                                    <span className="text-md text-slate-950">
                                                        {item.item_name || "N/A"}
                                                    </span>
                                                </div>

                                                <div className="text-sm capitalize text-slate-600">
                                                    {item.category_type || "N/A"}

                                                    <span className="mx-2">|</span>

                                                    {item.category_master?.name || "N/A"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="py-2 text-sm text-slate-500">
                                    No items found.
                                </div>
                            )
                        )}

                        {/* Current Item */}
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="mb-3">
                                <h3 className="text-md font-semibold text-slate-800">
                                    Current Item
                                </h3>
                            </div>

                            <div className="space-y-3">

                                {/* Item */}
                                <div className="rounded-md shadow-md border border-gray-200 bg-gray-100 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-md font-medium text-slate-900">
                                            {formData.item_id || "N/A"}
                                        </span>

                                        <span className="text-lg font-bold text-slate-500">-</span>

                                        <span className="text-md text-slate-950">
                                            {formData.item_name || "N/A"}
                                        </span>
                                    </div>

                                    <div className=" text-sm capitalize text-slate-600">
                                        {formData.category_type || "N/A"}
                                        <span className="mx-2">|</span>
                                        {formData.category_name || "N/A"}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {selectedItem && (
                            <div className="rounded-lg border border-green-300 bg-green-50 p-3 shadow-sm">
                                <div className="mb-3">
                                    <h3 className="text-md font-semibold text-green-700">
                                        Selected Item
                                    </h3>
                                </div>

                                <div className="rounded-md border border-green-200 bg-white px-3 py-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-md font-medium text-slate-900">
                                            {selectedItem.item_id || "N/A"}
                                        </span>

                                        <span className="text-lg font-bold text-slate-500">
                                            -
                                        </span>

                                        <span className="text-md text-slate-950">
                                            {selectedItem.item_name || "N/A"}
                                        </span>
                                    </div>

                                    <div className="text-sm capitalize text-slate-600">
                                        {selectedItem.category_type || "N/A"}

                                        <span className="mx-2">|</span>

                                        {selectedItem.category_master?.name || "N/A"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            onOpenChange(false)
                            setSelectedItem(null);
                            setSearchValue("");
                            setSearchResults([]);

                        }}
                    >
                        Cancel
                    </Button>

                    <Button
                        size="sm"
                        disabled={!selectedItem}
                        onClick={handleUpdate}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Confirm
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
}
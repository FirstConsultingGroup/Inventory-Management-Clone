import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/Utils/types/supabaseClient";
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Json } from "@/types/database.types";
import { ITaxMaster, IUser } from "@/Utils/constants";
import toast from "react-hot-toast";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Package, X } from "lucide-react";

interface InventoryTempItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: string;
}

type AdditionalAttributesType = {
    color: string;
    model_number: string;
    manufacturer: string;
    manufacturer_address: string;
    supplier: string[];
    location: string;
};

interface ImageMetadata {
    name: string;
    type: string;
    size: number;
    path: string;
}

interface VideoMetadata {
    name: string;
    type: string;
    size: number;
    path: string;
}

type FormDataType = {
    item_id: string;
    item_name: string;
    description: string;
    category_type: string;
    category_id: string;
    category_name: string;
    reorder_level: number | null;
    max_level: number | null;
    selling_price: number | null;
    tax_percentage: Json | null;
    image_1?: File | null;
    image_2?: File | null;
    video?: File | null;
    image?: { image_1?: ImageMetadata; image_2?: ImageMetadata } | null;
    youtube_link: string | null;
    additional_attributes: AdditionalAttributesType;
};

export default function InventoryTempItemModal({
    open,
    onOpenChange,
    itemId,
}: InventoryTempItemModalProps) {

    const user = localStorage.getItem("userData");
    const userData: IUser | null = user ? JSON.parse(user) : null;
    const companyId = userData?.company_id || null;
    const [allTaxes, setAllTaxes] = useState<ITaxMaster[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [alternativeSearch, setAlternativeSearch] = useState("");
    const [alternativeItems, setAlternativeItems] = useState<{ id: string; item_name: string; description?: string; selling_price?: number }[]>([]);
    const [showAlternativeDropdown, setShowAlternativeDropdown] = useState(false);
    const [selectedAlternativesWithNames, setSelectedAlternativesWithNames] = useState<{ id: string; item_name: string }[]>([]);
    const [tempSelectedAlternatives, setTempSelectedAlternatives] = useState<string[]>([]);
    const [isSelectedAlternativesExpanded, setIsSelectedAlternativesExpanded] = useState(true);
    const [colorSearch, setColorSearch] = useState("");
    const [colorOptions, setColorOptions] = useState<{ id: string; label: string }[]>([]);
    const [showColorDropdown, setShowColorDropdown] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [supplierOptions, setSupplierOptions] = useState<{ id: string; label: string }[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [locationSearch, setLocationSearch] = useState("");
    const [locationOptions, setLocationOptions] = useState<{ id: string; label: string }[]>([]);
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    const [videoType, setVideoType] = useState<"upload" | "youtube">("upload");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [image1Preview, setImage1Preview] = useState<string | null>(null);
    const [image2Preview, setImage2Preview] = useState<string | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [supplierSelected, setSupplierSelected] = useState(false);
    const [locationSelected, setLocationSelected] = useState(false);
    const [colorSelected, setColorSelected] = useState(false);

    const [formData, setFormData] = useState<FormDataType>({
        item_id: "",
        item_name: "",
        description: "",
        category_type: "",
        category_id: "",
        category_name: "",
        reorder_level: null,
        max_level: null,
        selling_price: null,
        tax_percentage: null,
        video: null,
        youtube_link: null,
        additional_attributes: {
            color: "",
            model_number: "",
            manufacturer: "",
            manufacturer_address: "",
            supplier: [],
            location: "",
        },
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
                    const additionalAttributes =
                        (data?.addtional_attributes && typeof data.addtional_attributes === "object"
                            ? data.addtional_attributes
                            : {}) as Partial<AdditionalAttributesType>;

                    const imageMetadata = (data?.image as { image_1?: ImageMetadata; image_2?: ImageMetadata } | null) ?? null;
                    const videoMetadata = (data?.video as VideoMetadata | null) ?? null;

                    setFormData({
                        item_id: "",
                        item_name: data?.item_name || "",
                        description: data?.description || "",
                        category_type: data?.category_type || "",
                        category_id: data?.category_id || "",
                        category_name: data?.category_master?.name || "",
                        reorder_level: data?.reorder_level,
                        max_level: data?.max_level,
                        selling_price: data?.selling_price,
                        tax_percentage:
                            data?.tax_percentage && typeof data.tax_percentage === "object"
                                ? (data.tax_percentage as Record<string, number | null>)
                                : null,
                        image_1: null,
                        image_2: null,
                        video: null,
                        image: imageMetadata,
                        youtube_link: data?.youtube_link,
                        additional_attributes: {
                            color: additionalAttributes.color || "",
                            model_number: additionalAttributes.model_number || "",
                            manufacturer: additionalAttributes.manufacturer || "",
                            manufacturer_address: additionalAttributes.manufacturer_address || "",
                            supplier: additionalAttributes.supplier || [],
                            location: additionalAttributes.location || "",
                        },
                    });
                    if (Array.isArray(data?.alternative_items_list) && data.alternative_items_list.length > 0) {
                        const altItemIds = data.alternative_items_list.map((alt: any) =>
                            typeof alt === "string" ? alt : alt?.item_id
                        ).filter(Boolean) as string[];

                        if (altItemIds.length > 0) {
                            const { data: altItems, error: altError } = await supabase
                                .from("item_mgmt")
                                .select("id, item_name")
                                .eq("company_id", companyId ?? "")
                                .in("id", altItemIds);

                            if (!altError) {
                                setSelectedAlternativesWithNames((altItems || []).map((item: any) => ({
                                    id: item.id,
                                    item_name: item.item_name || "Unnamed Item",
                                })));
                            }
                        }
                    }

                    setYoutubeUrl(data?.youtube_link || "");
                    setVideoType(data?.youtube_link ? "youtube" : "upload");

                    if (imageMetadata?.image_1?.path) {
                        const { data: image1Url } = supabase.storage.from("item-images").getPublicUrl(imageMetadata.image_1.path);
                        setImage1Preview(image1Url.publicUrl);
                    }
                    if (imageMetadata?.image_2?.path) {
                        const { data: image2Url } = supabase.storage.from("item-images").getPublicUrl(imageMetadata.image_2.path);
                        setImage2Preview(image2Url.publicUrl);
                    }
                    if (videoMetadata?.path) {
                        const { data: videoUrl } = supabase.storage.from("item_video").getPublicUrl(videoMetadata.path);
                        setVideoPreview(videoUrl.publicUrl);
                    }

                    setColorSearch(additionalAttributes.color || "");
                    setSupplierSearch((additionalAttributes.supplier || []).join(", "));
                    setLocationSearch(additionalAttributes.location || "");
                }

                console.log("Fetched Item Data:", data);

            } catch (error) {
                console.error("Error fetching item data:", error);
            }
        };

        fetchItem();
    }, [itemId, open]);

    useEffect(() => {
        if (!alternativeSearch.trim() || alternativeSearch.trim().length < 3) {
            setAlternativeItems([]);
            setShowAlternativeDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            const query = alternativeSearch.trim();
            const { data, error } = await supabase
                .from("item_mgmt")
                .select("id, item_name, description, selling_price")
                .eq("is_active", true)
                .eq("company_id", companyId ?? "")
                .or(`item_name.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(10);

            if (!error) {
                setAlternativeItems((data || []) as any[]);
                setShowAlternativeDropdown(true);
            } else {
                setAlternativeItems([]);
                setShowAlternativeDropdown(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [alternativeSearch, companyId]);

    useEffect(() => {
        if (!companyId) return;

        const fetchColorOptions = async () => {

            if (colorSelected) {
                setShowColorDropdown(false);
                return;
            }
            if (!colorSearch.trim() || colorSearch.trim().length < 2) {
                setColorOptions([]);
                setShowColorDropdown(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("item_lookup_master")
                    .select("id, value")
                    .eq("company_id", companyId)
                    .eq("key", "COLOR_FLAG")
                    .eq("type", "collection")
                    .ilike("value", `%${colorSearch.trim()}%`)
                    .limit(8);

                if (error) throw error;
                setColorOptions((data || []).map((item: any) => ({ id: item.id, label: item.value })));
                setShowColorDropdown(true);
            } catch (err) {
                console.error("Error fetching color options:", err);
                setColorOptions([]);
                setShowColorDropdown(false);
            }
        };

        const timer = setTimeout(fetchColorOptions, 250);
        return () => clearTimeout(timer);
    }, [colorSearch, companyId]);

    useEffect(() => {
        if (!companyId) return;

        const fetchSupplierOptions = async () => {

            if (supplierSelected) {
                setShowSupplierDropdown(false);
                return;
            }
            if (!supplierSearch.trim() || supplierSearch.trim().length < 2) {
                setSupplierOptions([]);
                setShowSupplierDropdown(false);
                return;
            }

            try {
                const query = supplierSearch.trim();
                const { data, error } = await supabase
                    .from("supplier_mgmt")
                    .select("id, supplier_name")
                    .eq("company_id", companyId)
                    .eq("is_active", true)
                    .or(`supplier_name.ilike.%${query}%,supplier_id.ilike.%${query}%`)
                    .limit(8);

                if (error) throw error;
                setSupplierOptions((data || []).map((item: any) => ({ id: item.id, label: `${item.supplier_name}` })));
                console.log("Fetched supplier options:", data);
                setShowSupplierDropdown(true);
            } catch (err) {
                console.error("Error fetching supplier options:", err);
                setSupplierOptions([]);
                setShowSupplierDropdown(false);
            }
        };

        const timer = setTimeout(fetchSupplierOptions, 250);
        return () => clearTimeout(timer);
    }, [supplierSearch, companyId]);

    useEffect(() => {
        if (!companyId) return;

        const fetchLocationOptions = async () => {
            if (locationSelected) {
                setShowLocationDropdown(false);
                return;
            }
            if (!locationSearch.trim() || locationSearch.trim().length < 2) {
                setLocationOptions([]);
                setShowLocationDropdown(false);
                return;
            }

            try {
                const query = locationSearch.trim();
                const { data, error } = await supabase
                    .from("location_master")
                    .select("id, location_name")
                    .eq("company_id", companyId)
                    .or(`location_name.ilike.%${query}%,location_id.ilike.%${query}%`)
                    .limit(8);

                if (error) throw error;
                setLocationOptions((data || []).map((item: any) => ({ id: item.id, label: item.location_name })));
                setShowLocationDropdown(true);
            } catch (err) {
                console.error("Error fetching location options:", err);
                setLocationOptions([]);
                setShowLocationDropdown(false);
            }
        };

        const timer = setTimeout(fetchLocationOptions, 250);
        return () => clearTimeout(timer);
    }, [locationSearch, companyId]);

    useEffect(() => {
        if (!companyId) return;

        const fetchAllTaxes = async () => {
            try {
                const { data, error } = await supabase
                    .from("tax_master")
                    .select("*")
                    .eq("company_id", companyId)
                    .eq("is_active", true);

                if (error) throw error;

                setAllTaxes(data);
                console.log('Fetched item data:', data);

            } catch (err) {
                console.error('Error fetching all taxes:', err)
                toast.error("Failed to load taxes");
            }
        };

        const fetchCategories = async () => {
            try {
                const { data, error } = await supabase
                    .from("category_master")
                    .select("id, name")
                    .eq("company_id", companyId)
                    .eq("is_active", true)
                    .order("name", { ascending: true });

                if (error) throw error;
                setCategories(
                    (data ?? []).map(({ id, name }) => ({
                        id,
                        name: name ?? '',
                    }))
                );
            } catch (err) {
                console.error("Error fetching categories:", err);
            }
        };

        fetchAllTaxes();
        fetchCategories();
    }, [companyId]);

    useEffect(() => {
        if (!allTaxes.length) return;

        const currentTaxValues =
            formData.tax_percentage && typeof formData.tax_percentage === "object"
                ? ({ ...(formData.tax_percentage as Record<string, number | null>) } as Record<string, number | null>)
                : {};

        const mergedTaxes = allTaxes.reduce((acc, tax) => {
            const label = String(tax.label ?? "");
            if (!label) return acc;
            acc[label] = label in currentTaxValues ? currentTaxValues[label] : tax.value ?? null;
            return acc;
        }, {} as Record<string, number | null>);

        if (Object.keys(mergedTaxes).length === 0) return;

        const currentTaxString = JSON.stringify(currentTaxValues);
        const mergedTaxString = JSON.stringify(mergedTaxes);
        if (currentTaxString !== mergedTaxString) {
            setFormData((prev) => ({
                ...prev,
                tax_percentage: mergedTaxes,
            }));
        }
    }, [allTaxes, formData.tax_percentage]);


    const handleFieldChange = (field: keyof FormDataType, value: string | number | null) => {
        setFormData((prev) => ({ ...prev, [field]: value } as FormDataType));
        setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const handleAdditionalAttributeChange = (field: keyof AdditionalAttributesType, value: string | string[]) => {
        setFormData((prev) => ({
            ...prev,
            additional_attributes: {
                ...prev.additional_attributes,
                [field]: value,
            },
        }));
        setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const validateForm = () => {
        const nextErrors: Record<string, string> = {};

        if (!formData.item_id.trim()) nextErrors.item_id = "Item ID is required";
        if (!formData.additional_attributes.manufacturer.trim()) nextErrors.manufacturer = "Manufacturer is required";
        if (!formData.additional_attributes.manufacturer_address.trim()) nextErrors.manufacturer_address = "Manufacturer address is required";
        if (!formData.additional_attributes.location.trim()) nextErrors.location = "Location is required";
        if (!formData.item_name.trim()) nextErrors.item_name = "Item Name is required";
        if (!formData.category_id) nextErrors.category_id = "Category is required";
        if (!formData.description.trim()) nextErrors.description = "Description is required";
        if ((formData.reorder_level ?? 0) < 0) nextErrors.reorder_level = "Reorder level cannot be negative";
        if ((formData.max_level ?? 0) < 0) nextErrors.max_level = "Maximum level cannot be negative";
        if ((formData.selling_price ?? 0) < 0) nextErrors.selling_price = "Selling price cannot be negative";

        const youtubeLink = formData.youtube_link?.trim() || "";
        if (youtubeLink) {
            try {
                const normalized = youtubeLink.startsWith("http") ? youtubeLink : `https://${youtubeLink}`;
                const url = new URL(normalized);
                const hostname = url.hostname.toLowerCase();
                const pathname = url.pathname;
                const isValidYouTube =
                    (hostname.endsWith("youtube.com") && (url.searchParams.has("v") || pathname.startsWith("/shorts/"))) ||
                    (hostname.endsWith("youtu.be") && pathname.length > 1);

                if (!isValidYouTube) nextErrors.youtube_link = "Must be a valid YouTube link";
            } catch {
                nextErrors.youtube_link = "Must be a valid YouTube link";
            }
        }

        setErrors(nextErrors);
        return nextErrors;
    };

    const handleUpdateItem = async () => {
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            toast.error("Please fill all required fields.");
            return;
        }

        setIsSaving(true);

        try {
            const { data: existingItemData, error: existingItemError } = await supabase
                .from("item_mgmt")
                .select("image, video, item_id")
                .eq("id", itemId)
                .single();

            if (existingItemError) throw existingItemError;

const oldItemId = existingItemData?.item_id?.trim() || "";
            const newItemId = formData.item_id.trim();
            const isIdChanged = oldItemId !== "" && oldItemId !== newItemId;

            const existingImageMetadata = (existingItemData?.image as { image_1?: ImageMetadata; image_2?: ImageMetadata } | null) ?? null;
            const existingVideoMetadata = (existingItemData?.video as VideoMetadata | null) ?? null;

            const imageMetadata: { image_1?: ImageMetadata; image_2?: ImageMetadata } = { ...(existingImageMetadata || {}) };
            let videoMetadata: VideoMetadata | null = existingVideoMetadata ? { ...existingVideoMetadata } : null;

            if (formData.image_1 instanceof File) {
                if (existingImageMetadata?.image_1?.path) {
                    await supabase.storage.from("item-images").remove([existingImageMetadata.image_1.path]);
                }

                const fileExt = formData.image_1.name.split(".").pop();
                const fileName = `${formData.item_id.trim()}_image1_${Date.now()}.${fileExt}`;
                const filePath = `${formData.item_id.trim()}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from("item-images").upload(filePath, formData.image_1);

                if (uploadError) throw new Error(uploadError.message);

                imageMetadata.image_1 = {
                    name: formData.image_1.name,
                    type: formData.image_1.type,
                    size: formData.image_1.size,
                    path: filePath,
                };
            } else if (imageMetadata.image_1?.path && isIdChanged) {
                const oldPath = imageMetadata.image_1.path;
                const oldFileName = oldPath.split("/").pop() || "";
        const newFileName = oldFileName.replace(oldItemId, newItemId);
    const newPath = `${newItemId}/${newFileName}`;

                const { error: moveError } = await supabase.storage.from("item-images").move(oldPath, newPath);
                if (!moveError) {
                    imageMetadata.image_1.path = newPath;
                } else {
                    console.error("Error migrating Image 1 storage path:", moveError);
                }
            }

            if (formData.image_2 instanceof File) {
                if (existingImageMetadata?.image_2?.path) {
                    await supabase.storage.from("item-images").remove([existingImageMetadata.image_2.path]);
                }

                const fileExt = formData.image_2.name.split(".").pop();
                const fileName = `${formData.item_id.trim()}_image2_${Date.now()}.${fileExt}`;
                const filePath = `${formData.item_id.trim()}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from("item-images").upload(filePath, formData.image_2);

                if (uploadError) throw new Error(uploadError.message);

                imageMetadata.image_2 = {
                    name: formData.image_2.name,
                    type: formData.image_2.type,
                    size: formData.image_2.size,
                    path: filePath,
                };
            } else if (imageMetadata.image_2?.path && isIdChanged) {
                const oldPath = imageMetadata.image_2.path;
                const oldFileName = oldPath.split("/").pop() || "";
        const newFileName = oldFileName.replace(oldItemId, newItemId);
    const newPath = `${newItemId}/${newFileName}`;

                const { error: moveError } = await supabase.storage.from("item-images").move(oldPath, newPath);
                if (!moveError) {
                    imageMetadata.image_2.path = newPath;
                } else {
                    console.error("Error migrating Image 2 storage path:", moveError);
                }
            }

            if (formData.video instanceof File) {
                if (existingVideoMetadata?.path) {
                    await supabase.storage.from("item_video").remove([existingVideoMetadata.path]);
                }

                const fileExt = formData.video.name.split(".").pop();
                const fileName = `${formData.item_id.trim()}_video_${Date.now()}.${fileExt}`;
                const filePath = `${formData.item_id.trim()}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from("item_video").upload(filePath, formData.video);

                if (uploadError) throw new Error(uploadError.message);

                videoMetadata = {
                    name: formData.video.name,
                    type: formData.video.type,
                    size: formData.video.size,
                    path: filePath,
                };
            }

            const payload: any = {
                item_id: formData.item_id.trim(),
                item_name: formData.item_name.trim(),
                description: formData.description.trim(),
                category_id: formData.category_id || null,
                reorder_level: formData.reorder_level ?? null,
                max_level: formData.max_level ?? null,
                selling_price: formData.selling_price ?? null,
                tax_percentage:
                    formData.tax_percentage && Object.keys(formData.tax_percentage).length > 0
                        ? Object.fromEntries(
                            Object.entries(formData.tax_percentage).filter(
                                ([, value]) => value !== null && value !== undefined
                            )
                        )
                        : null,
                image: Object.keys(imageMetadata).length > 0 ? imageMetadata : null,
                addtional_attributes: formData.additional_attributes,
                alternative_items_list: selectedAlternativesWithNames.map((alt) => ({ item_id: alt.id })),
                youtube_link: formData.youtube_link?.trim() || null,
                is_temporary: false,
            };

            if (videoType === "upload") {
                payload.video = videoMetadata;
                payload.youtube_link = null;
            } else if (videoType === "youtube") {
                payload.video = null;
                payload.youtube_link = (youtubeUrl || formData.youtube_link || "").trim() || null;

                if (videoMetadata?.path) {
                    await supabase.storage.from("item_video").remove([videoMetadata.path]);
                }
            }

            const { data, error } = await supabase
                .from("item_mgmt")
                .update(payload)
                .eq("id", itemId)
                .select()

            if (error) throw error;

            toast.success("Item updated successfully.");
            console.log("Updated item data:", data);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error updating item:", error);
            toast.error(error?.message || "Failed to update item.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAlternativeToggle = (itemId: string) => {
        setTempSelectedAlternatives((prev) =>
            prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
        );
    };

    const handleConfirmAlternatives = () => {
        const uniqueIds = [...new Set([...tempSelectedAlternatives, ...selectedAlternativesWithNames.map((item) => item.id)])];
        const uniqueItems = uniqueIds
            .map((id) => alternativeItems.find((item) => item.id === id) || selectedAlternativesWithNames.find((item) => item.id === id))
            .filter(Boolean) as { id: string; item_name: string }[];

        setSelectedAlternativesWithNames(uniqueItems);
        setAlternativeSearch("");
        setShowAlternativeDropdown(false);
        setTempSelectedAlternatives([]);
    };

    const handleAlternativeRemove = (alternativeId: string) => {
        setSelectedAlternativesWithNames((prev) => prev.filter((item) => item.id !== alternativeId));
    };

    // Handle media change
    const handleMediaChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        field: "image_1" | "image_2" | "video",
        setPreview: (value: string | null) => void
    ) => {
        const file = e.target.files?.[0];

        if (!file) {
            setPreview(null);

            setFormData((prev) => ({
                ...prev,
                [field]: null,
            }));

            return;
        }

        // Store file in formData
        setFormData((prev: any) => ({
            ...prev,
            [field]: file,
        }));

        // Preview
        const reader = new FileReader();

        reader.onloadend = () => {
            setPreview(reader.result as string);
        };

        reader.readAsDataURL(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="
    !max-w-4xl
    h-[92vh]
    flex flex-col
    overflow-hidden
    rounded-[28px]
    border-0
    bg-slate-100
    p-0
    shadow-2xl
  "
            >
                {/* Header */}
                <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 text-left">
                    <DialogTitle className="text-xl font-bold tracking-tight text-blue-600">
                        Make Item Permanent
                    </DialogTitle>

                    <DialogDescription className="text-sm text-blue-500">
                        Give more details about the item to make it permanent in the inventory.
                    </DialogDescription>
                </DialogHeader>

                {/* Scrollable Body */}
                <ScrollArea className="flex-1 px-6 py-4">
                    <div className="space-y-6 pb-8">
                        {/* Basic Information */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-slate-900">
                                    Basic Information
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Essential item details and identification
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Item ID <span className="text-red-500">*</span>
                                    </Label>

                                    <Input
                                        type="text"
                                        placeholder="Enter Item ID"
                                        value={formData?.item_id || ""}
                                        onChange={(e) => handleFieldChange("item_id", e.target.value)}
                                        className={`h-11 rounded-xl border-slate-300 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.item_id ? "border-red-500" : ""}`}
                                    />
                                    {errors.item_id && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.item_id}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Item Name
                                    </Label>

                                    <Input
                                        type="text"
                                        placeholder="Enter Item Name"
                                        value={formData?.item_name || ""}
                                        onChange={(e) => handleFieldChange("item_name", e.target.value)}
                                        className="h-11 rounded-xl border-slate-200 bg-white px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                    {errors.item_name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.item_name}</p>}
                                </div>

                                <div className="w-full space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700">
                                        Mark this item as
                                    </Label>

                                    <Input
                                        value={formData?.category_type || ""}
                                        disabled
                                        className="capitalize rounded-xl border-gray-300 bg-white cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Category
                                    </Label>

                                    <Select
                                        value={formData.category_id || ""}
                                        onValueChange={(value) => {
                                            const selectedCategory = categories.find((category) => category.id === value);
                                            handleFieldChange("category_id", value);
                                            handleFieldChange("category_name", selectedCategory?.name || "");
                                        }}
                                    >
                                        <SelectTrigger className="w-full bg-white h-11">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((category) => (
                                                <SelectItem key={category.id} value={category.id}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.category_id && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.category_id}</p>}
                                </div>

                            </div>

                            <div className="mt-5 space-y-2">
                                <Label className="text-sm font-medium text-slate-700">
                                    Description
                                </Label>

                                <Textarea
                                    rows={2}
                                    placeholder="Enter Description"
                                    value={formData?.description || ""}
                                    onChange={(e) => handleFieldChange("description", e.target.value)}
                                    className="min-h-[70px] rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                />
                                {errors.description && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.description}</p>}
                            </div>
                        </div>

                        {/* Stock, Pricing & Media */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-slate-900">
                                    Stock, Pricing & Media
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Inventory levels, pricing configuration, and media uploads
                                </p>
                            </div>

                            <div className="space-y-8">

                                {/* Inventory Levels */}
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Reorder Level
                                        </Label>

                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="10"
                                            value={formData.reorder_level ?? ""}
                                            onChange={(e) => handleFieldChange("reorder_level", e.target.value === "" ? null : Number(e.target.value))}
                                            className={`h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.reorder_level ? "border-red-500" : ""}`}
                                        />
                                        {errors.reorder_level && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.reorder_level}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Maximum Level
                                        </Label>

                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="100"
                                            value={formData.max_level ?? ""}
                                            onChange={(e) => handleFieldChange("max_level", e.target.value === "" ? null : Number(e.target.value))}
                                            className={`h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.max_level ? "border-red-500" : ""}`}
                                        />
                                        {errors.max_level && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.max_level}</p>}
                                    </div>
                                </div>

                                {/* Pricing */}
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Selling Price
                                        </Label>

                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="299.99"
                                            value={formData.selling_price ?? ""}
                                            onChange={(e) => handleFieldChange("selling_price", e.target.value === "" ? null : Number(e.target.value))}
                                            className={`h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.selling_price ? "border-red-500" : ""}`}
                                        />
                                        {errors.selling_price && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.selling_price}</p>}
                                    </div>

                                </div>

                                {/* Image Uploads */}
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Image 1 (JPG/PNG, max 5MB)
                                        </Label>

                                        <Input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={(e) =>
                                                handleMediaChange(e, "image_1", setImage1Preview)
                                            }
                                            className="
            rounded-xl
            border-slate-200
            bg-slate-50
            text-sm
            focus-visible:ring-1
            focus-visible:ring-blue-400
          "
                                        />
                                        {image1Preview && (
                                            <img
                                                src={image1Preview}
                                                alt="Preview"
                                                className="h-32 w-32 rounded-xl object-cover border border-slate-200"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            Image 2 (JPG/PNG, max 5MB)
                                        </Label>

                                        <Input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={(e) =>
                                                handleMediaChange(e, "image_2", setImage2Preview)
                                            }
                                            className="
            rounded-xl
            border-slate-200
            bg-slate-50
            text-sm
            focus-visible:ring-1
            focus-visible:ring-blue-400
          "
                                        />
                                        {image2Preview && (
                                            <img
                                                src={image2Preview}
                                                alt="Preview"
                                                className="h-32 w-32 rounded-xl object-cover border border-slate-200"
                                            />
                                        )}

                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                    {/* Video Section */}
                                    <div className="space-y-5">

                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium text-slate-700">
                                                Video Type
                                            </Label>

                                            <RadioGroup
                                                value={videoType}
                                                onValueChange={(value) => setVideoType(value as "upload" | "youtube")}
                                                className="flex flex-col gap-3 lg:flex-row lg:gap-8"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="upload" id="upload-video" />

                                                    <Label
                                                        htmlFor="upload-video"
                                                        className="text-sm text-slate-600"
                                                    >
                                                        Upload Video
                                                    </Label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="youtube" id="youtube-video" />

                                                    <Label
                                                        htmlFor="youtube-video"
                                                        className="text-sm text-slate-600"
                                                    >
                                                        YouTube Link
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {videoType === "upload" && (
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium text-slate-700">
                                                    Upload Video (MP4, max 50MB)
                                                </Label>

                                                <Input
                                                    type="file"
                                                    accept="video/mp4"
                                                    onChange={(e) => handleMediaChange(e, "video", setVideoPreview)}
                                                    className="rounded-xl border-slate-200 bg-slate-50 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                                />
                                                {videoPreview ? (
                                                    <video
                                                        src={videoPreview}
                                                        controls
                                                        className="h-32 w-full max-w-md rounded-xl border border-slate-200 object-contain bg-slate-50"
                                                    />
                                                ) : (
                                                    <div className="flex h-32 w-full max-w-md items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                                                        No video available
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {videoType === "youtube" && (
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium text-slate-700">
                                                    YouTube Video Link
                                                </Label>

                                                <Input
                                                    type="text"
                                                    placeholder="Enter YouTube Video Link"
                                                    value={youtubeUrl}
                                                    onChange={(e) => {
                                                        setYoutubeUrl(e.target.value);
                                                        handleFieldChange("youtube_link", e.target.value);
                                                    }}
                                                    className={`h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.youtube_link ? "border-red-500" : ""}`}
                                                />
                                                {errors.youtube_link && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.youtube_link}</p>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Alternative Items */}
                                    <div className="space-y-5">

                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-slate-700">
                                                Search Alternative Items
                                            </Label>

                                            <Input
                                                type="text"
                                                placeholder="Search for alternative items by name or description..."
                                                value={alternativeSearch}
                                                onFocus={() => alternativeSearch.trim().length >= 3 && setShowAlternativeDropdown(true)}
                                                onChange={(e) => setAlternativeSearch(e.target.value)}
                                                className="h-11 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                            />
                                            {showAlternativeDropdown && alternativeItems.length > 0 && (
                                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm max-h-56 overflow-y-auto">
                                                    {alternativeItems.map((item) => (
                                                        <label
                                                            key={item.id}
                                                            className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                                                        >
                                                            <Checkbox
                                                                checked={tempSelectedAlternatives.includes(item.id) || selectedAlternativesWithNames.some((selected) => selected.id === item.id)}
                                                                onCheckedChange={() => handleAlternativeToggle(item.id)}
                                                            />
                                                            <span className="flex-1">
                                                                <span className="block font-medium text-slate-900">{item.item_name}</span>
                                                                {item.description && <span className="block text-xs text-slate-500">{item.description}</span>}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            {alternativeSearch.trim().length >= 3 && showAlternativeDropdown && (
                                                <div className="mt-2 flex justify-end gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => { setTempSelectedAlternatives([]); setAlternativeSearch(""); setShowAlternativeDropdown(false); }}>
                                                        Cancel
                                                    </Button>
                                                    <Button type="button" size="sm" onClick={handleConfirmAlternatives} disabled={tempSelectedAlternatives.length === 0}>
                                                        Confirm
                                                    </Button>
                                                </div>
                                            )}
                                            {selectedAlternativesWithNames.length > 0 && (
                                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <Label className="flex items-center gap-1 text-sm font-medium text-slate-700">
                                                            <Package className="h-4 w-4" /> Selected Alternatives
                                                        </Label>
                                                        <Button variant="ghost" size="sm" onClick={() => setIsSelectedAlternativesExpanded((prev) => !prev)} className="h-8 px-2 text-slate-600">
                                                            {isSelectedAlternativesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                    {isSelectedAlternativesExpanded && (
                                                        <div className="space-y-2">
                                                            {selectedAlternativesWithNames.map((item) => (
                                                                <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                                                    <span>{item.item_name}</span>
                                                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleAlternativeRemove(item.id)} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700">
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>


                            </div>
                        </div>

                        {/* Dynamic Attributes */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold text-slate-900">
                                    Additional Attributes
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Configure additional product specifications
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                                {/* Model Number */}
                                <div className="space-y-2">
                                    <Label>Model Number</Label>

                                    <Input
                                        placeholder="Enter Model Number"
                                        value={formData.additional_attributes?.model_number}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                additional_attributes: {
                                                    ...prev.additional_attributes,
                                                    model_number: e.target.value,
                                                },
                                            }))
                                        }
                                        className="
                      rounded-lg
                      border-slate-200
                      bg-slate-50
                      px-4
                      text-sm
                      focus-visible:ring-1
                      focus-visible:ring-blue-400
                    "
                                    />
                                </div>

                                {/* Color */}
                                <div className="space-y-2 relative">
                                    <Label>Color</Label>

                                    <Input
                                        placeholder="Search color..."
                                        value={colorSearch}
                                        onChange={(e) => {
                                            setColorSelected(false);
                                            setColorSearch(e.target.value);
                                        }}
                                        onFocus={() => colorSearch.trim().length >= 2 && setShowColorDropdown(true)}
                                        className="rounded-lg border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                    {showColorDropdown && colorOptions.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                            {colorOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setColorSelected(true);
                                                        setColorSearch(option.label);
                                                        handleAdditionalAttributeChange("color", option.id);
                                                        setShowColorDropdown(false);
                                                    }}
                                                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Manufacturer */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Manufacturer <span className="text-red-500">*</span>
                                    </Label>

                                    <Input
                                        placeholder="Enter Manufacturer"
                                        value={formData.additional_attributes?.manufacturer}
                                        onChange={(e) => handleAdditionalAttributeChange("manufacturer", e.target.value)}
                                        className={`rounded-lg border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.manufacturer ? "border-red-500" : ""}`}
                                    />
                                    {errors.manufacturer && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.manufacturer}</p>}
                                </div>


                                {/* Manufacturer Address */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Manufacturer Address <span className="text-red-500">*</span>
                                    </Label>

                                    <Textarea
                                        placeholder="Enter Address"
                                        value={formData.additional_attributes?.manufacturer_address}
                                        onChange={(e) => handleAdditionalAttributeChange("manufacturer_address", e.target.value)}
                                        className={`min-h-[70px] rounded-lg border-slate-200 bg-slate-50 p-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.manufacturer_address ? "border-red-500" : ""}`}
                                    />
                                    {errors.manufacturer_address && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.manufacturer_address}</p>}
                                </div>

                                {/* Supplier */}
                                <div className="space-y-2 relative">
                                    <Label>Supplier</Label>

                                    <Input
                                        placeholder="Search supplier..."
                                        value={supplierSearch}
                                        onChange={(e) => {
                                            setSupplierSelected(false);
                                            setSupplierSearch(e.target.value);
                                        }}
                                        onFocus={() => supplierSearch.trim().length >= 2 && setShowSupplierDropdown(true)}
                                        className="rounded-lg border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                    {showSupplierDropdown && supplierOptions.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                            {supplierOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const nextSuppliers = Array.from(new Set([...(formData.additional_attributes.supplier || []), option.id]));
                                                        setSupplierSelected(true);
                                                        setSupplierSearch(option.label);
                                                        handleAdditionalAttributeChange("supplier", nextSuppliers);
                                                        setShowSupplierDropdown(false);
                                                    }}
                                                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Location */}
                                <div className="space-y-2 relative">
                                    <Label className="text-sm font-medium text-slate-700">
                                        Location <span className="text-red-500">*</span>
                                    </Label>

                                    <Input
                                        placeholder="Search location..."
                                        value={locationSearch}
                                        onChange={(e) => {
                                            setLocationSelected(false);
                                            setLocationSearch(e.target.value);
                                        }}
                                        onFocus={() => locationSearch.trim().length >= 2 && setShowLocationDropdown(true)}
                                        className={`rounded-lg border-slate-200 bg-slate-50 px-4 text-sm focus-visible:ring-1 focus-visible:ring-blue-400 ${errors.location ? "border-red-500" : ""}`}
                                    />
                                    {showLocationDropdown && locationOptions.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                            {locationOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setLocationSelected(true);
                                                        setLocationSearch(option.label);
                                                        handleAdditionalAttributeChange("location", option.id);
                                                        setShowLocationDropdown(false);
                                                    }}
                                                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {errors.location && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.location}</p>}
                                </div>

                            </div>
                        </div>

                    </div>

                    {/* Tax Configuration */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                        <div className="mb-6">
                            <h3 className="text-xl font-semibold text-slate-900">
                                Tax Configuration
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                                Manage the tax configuration for this item
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {allTaxes.map((tax) => {
                                const taxLabel = String(tax.label ?? "");
                                const taxValues = (formData.tax_percentage ?? {}) as Record<string, number | null>;

                                return (
                                    <div key={tax.id} className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">
                                            {taxLabel} (%)
                                        </Label>

                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder={`Enter ${taxLabel}`}
                                            value={taxValues[taxLabel] ?? ""}
                                            onChange={(e) => {
                                                const value = e.target.value === "" ? null : Number(e.target.value);
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    tax_percentage: {
                                                        ...((prev.tax_percentage as Record<string, number | null> | null) || {}),
                                                        [taxLabel]: Number.isNaN(value) ? null : value,
                                                    },
                                                }));
                                            }}
                                            className="
            h-11
            rounded-xl
            border-slate-200
            bg-slate-50
            px-4
            text-sm
            focus-visible:ring-1
            focus-visible:ring-blue-400
          "
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </ScrollArea>

                <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-8 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-11 rounded-xl border-slate-300 px-6 text-sm font-medium"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={handleUpdateItem}
                        disabled={isSaving}
                        className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Make Permanent"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
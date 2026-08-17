import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/Utils/types/supabaseClient";
import { formatCurrency } from "@/Utils/formatters";
import { ItemManagement } from "@/Utils/constants";
import { Loader2, Package, X } from "lucide-react";

interface ItemDetailsModalProps {
  open: boolean;
  itemId: string | null;
  onClose: () => void;
  currencySymbol?: string;
}

interface ItemDetailsState {
  item: ItemManagement & {
    category?: { name?: string | null };
  };
  totalStock: number;
  imageUrls: {
    image_1: string | null;
    image_2: string | null;
  };
  videoUrl: string | null;
  youtubeId: string | null;
  alternatives: Array<{ id: string; name: string }>;
}

const getPublicUrl = (bucket: string, path?: string | null) => {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

const extractYoutubeId = (link?: string | null) => {
  if (!link) return null;
  try {
    const normalized = link.startsWith("http") ? link : `https://${link}`;
    const url = new URL(normalized);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.get("v")) {
        return url.searchParams.get("v");
      }
      const match = url.pathname.match(/\/shorts\/([\w-]+)/);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
};

export const ItemDetailsModal = ({
  open,
  itemId,
  onClose,
}: ItemDetailsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ItemDetailsState | null>(null);

  useEffect(() => {
    if (!open) {
      setDetails(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !itemId) return;
    let isMounted = true;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: itemError } = await supabase
          .from("item_mgmt")
          .select(`*, category:category_master!item_mgmt_category_id_fkey(name)`)
          .eq("id", itemId)
          .single();

        if (itemError) throw itemError;
        if (!data) throw new Error("Item not found");

        const item = data as ItemManagement & {
          category?: { name?: string | null };
        };

        const { data: stockRows, error: stockError } = await supabase
          .from("inventory_mgmt")
          .select("item_qty")
          .eq("company_id", item.company_id!)
          .eq("item_id", item.id);

        if (stockError) throw stockError;

        const totalStock =
          stockRows?.reduce((sum, row) => sum + (row.item_qty || 0), 0) ?? 0;

        const alternativeList = Array.isArray(item.alternative_items_list)
          ? item.alternative_items_list
          : [];

        const alternativeIds = alternativeList
          .map((alt: any) => (typeof alt === "string" ? alt : alt?.item_id))
          .filter(Boolean);

        let alternatives: Array<{ id: string; name: string }> = [];
        if (alternativeIds.length > 0) {
          const { data: altItems, error: altError } = await supabase
            .from("item_mgmt")
            .select("id, item_name")
            .in("id", alternativeIds);

          if (altError) throw altError;

          alternatives = alternativeIds.map((id: string) => ({
            id,
            name:
              altItems?.find((alt) => alt.id === id)?.item_name ||
              "Unnamed Item"
          }));
        }

        const imageObj = item.image as
          | {
            image_1?: { path?: string };
            image_2?: { path?: string };
          }
          | undefined;

        const imageUrls = {
          image_1: getPublicUrl("item-images", imageObj?.image_1?.path),
          image_2: getPublicUrl("item-images", imageObj?.image_2?.path)
        };

        const videoObj = item.video as { path?: string } | undefined;
        const videoUrl = videoObj?.path
          ? getPublicUrl("item_video", videoObj.path)
          : null;
        const youtubeId = extractYoutubeId(item.youtube_link);

        if (!isMounted) return;
        setDetails({
          item,
          totalStock,
          imageUrls,
          videoUrl,
          youtubeId,
          alternatives
        });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message ?? "Failed to load item details");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [open, itemId]);

  const taxEntries = useMemo(() => {
    if (!details?.item?.tax_percentage) return [];
    return Object.entries(details.item.tax_percentage as Record<string, number>)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([label, value]) => ({ label, value }));
  }, [details]);

  const attributeEntries = useMemo(() => {
    const attrs = details?.item?.addtional_attributes as
      | Record<string, string | number>
      | undefined;
    if (!attrs) return [];
    return Object.entries(attrs).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    );
  }, [details]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[50vw] sm:max-w-[95vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Item Details
          </DialogTitle>
          <DialogDescription>
            Detailed information for the selected inventory item
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="px-6 pr-6 pb-6 max-h-[calc(90vh-90px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <p className="text-sm text-muted-foreground">
                Fetching item details...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center gap-3">
              <X className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <section className="grid gap-4 rounded-xl border p-4 md:grid-cols-[60%_40%]">
                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">
                    Item Identification
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {details.item.item_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    ID: {details.item.item_id}
                  </p>
                  <Badge variant="secondary" className="w-fit">
                    {details.item.category?.name || "No category"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Selling Price
                    </p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(details.item.selling_price ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Total Stock
                    </p>
                    <p className="text-lg font-semibold">{details.totalStock}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Reorder Level
                    </p>
                    <p className="text-base font-medium">
                      {details.item.reorder_level ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Max Level
                    </p>
                    <p className="text-base font-medium">
                      {details.item.max_level ?? "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Description */}
              <section className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wide">
                  Description
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {details.item.description || "No description provided."}
                </p>
              </section>

              {/* Attributes */}
              <section className="grid gap-4">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase text-muted-foreground mb-3 tracking-wide">
                    Additional Attributes
                  </p>
                  {attributeEntries.length > 0 ? (
                    <div className="space-y-2">
                      {attributeEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-lg bg-gray-50 px-3 py-2 space-y-1"
                        >
                          <p className="text-sm font-medium text-gray-900 break-words capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-gray-700 break-words">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No additional attributes saved.
                    </p>
                  )}
                </div>
              </section>

              {/* Media */}
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase text-muted-foreground mb-3 tracking-wide">
                    Images
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {["image_1", "image_2"].map((key) => {
                      const url = details.imageUrls[key as "image_1" | "image_2"];
                      return url ? (
                        <img
                          key={key}
                          src={url}
                          alt={key}
                          className="h-32 w-full rounded-lg object-cover border"
                        />
                      ) : (
                        <div
                          key={key}
                          className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
                        >
                          No {key.replace("_", " ")}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase text-muted-foreground mb-3 tracking-wide">
                    Media Preview
                  </p>
                  {details.youtubeId ? (
                    <div className="relative w-full overflow-hidden rounded-lg border pb-[56.25%]">
                      <iframe
                        src={`https://www.youtube.com/embed/${details.youtubeId}`}
                        title="YouTube video player"
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : details.videoUrl ? (
                    <video
                      controls
                      className="w-full rounded-lg border"
                      src={details.videoUrl}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No video or YouTube link provided.
                    </p>
                  )}
                </div>
              </section>

              {/* Alternatives */}
              <section className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">
                    Alternative Items
                  </p>
                  <Badge variant="outline">{details.alternatives.length}</Badge>
                </div>
                {details.alternatives.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {details.alternatives.map((alt) => (
                      <Badge key={alt.id} variant="secondary">
                        {alt.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No alternative items linked.
                  </p>
                )}
              </section>

              {/* Tax Configuration */}
              <section className="rounded-xl border p-4 mt-4">
                <p className="text-xs uppercase text-muted-foreground mb-3 tracking-wide">
                  Tax Configuration
                </p>

                {taxEntries.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {taxEntries.map((entry) => (
                      <div
                        key={entry.label}
                        className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-blue-900">
                          {entry.label}
                        </span>
                        <span className="text-sm text-blue-700">{entry.value}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tax configuration found.
                  </p>
                )}
              </section>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Select an item to view its details.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ItemDetailsModal;


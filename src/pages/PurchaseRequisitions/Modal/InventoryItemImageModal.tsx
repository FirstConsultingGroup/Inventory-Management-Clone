
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { supabase } from "@/Utils/types/supabaseClient";
import { useEffect, useState } from "react";


interface ImageMetadata {
  name: string;
  type: string;
  size: number;
  path: string;
}

interface InventoryItemImageModalProps {
  open: boolean;
  itemId: string;
  onOpenChange: (open: boolean) => void;
}

export default function InventoryItemImageModal({
  open,
  onOpenChange,
  itemId,
}: InventoryItemImageModalProps) {

  const [image1Url, setImage1Url] = useState("");
  const [image2Url, setImage2Url] = useState("");

  const images = [image1Url, image2Url].filter(Boolean);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (!itemId || !open) return;
     setLoading(true);
  setImage1Url("");
  setImage2Url("");

    const fetchItem = async () => {

      try {
        const { data, error } = await supabase
          .from("item_mgmt")
          .select("image")
          .eq("id", itemId)
          .single();

        if (error) {
          console.error("Error fetching item data:", error);
          return;
        }

        const imageMetadata = (data?.image as { image_1?: ImageMetadata; image_2?: ImageMetadata } | null) ?? null;
        console.log("Extracted Image Metadata:", imageMetadata);
        if (imageMetadata?.image_1?.path) {
          const { data: image1Url } = supabase.storage.from("item-images").getPublicUrl(imageMetadata.image_1.path);
          setImage1Url(image1Url.publicUrl);
        }
        if (imageMetadata?.image_2?.path) {
          const { data: image2Url } = supabase.storage.from("item-images").getPublicUrl(imageMetadata.image_2.path);
          setImage2Url(image2Url.publicUrl);
        }

      } catch (error) {
        console.error("Error fetching item data:", error);
      }finally {
      setLoading(false);
    }
    };

    fetchItem();
  }, [itemId, open]);



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
             max-w-2xl
             overflow-hidden
             rounded-2xl
             border-0
             p-0
             shadow-2xl
           "
      >
        <DialogHeader className="border-b bg-white px-6 py-4">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Inventory Item Images
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
           {loading ? (
    <div className="flex h-[320px] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Loading images...
      </p>
    </div>
  ) : (
          <Carousel
            opts={{
              align: "center",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {images.map((image, index) => (
                <CarouselItem key={index}>
                  <div
                    className="
                         flex
                         h-[320px]
                         items-center
                         justify-center
                         rounded-xl
                         border
                         px-2
                         border-slate-200
                         bg-slate-50
                       "
                  >
                    <img
                      src={image}
                      alt={`Item Image${index + 1}`}
                      className="
                           max-h-[340px]
                           w-full
                           object-contain
                           px-10
                         "
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="left-2 text-blue-500 hover:bg-blue-50 focus:ring-blue-500" />
            <CarouselNext className="right-2 text-blue-500 hover:bg-blue-50 focus:ring-blue-500" />
          </Carousel>
  )}
        </div>

        <div
          className="
               flex
               justify-end
               border-t
               bg-white
               px-6
               py-3
             "
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-sm text-blue-500 hover:bg-blue-50 focus:ring-blue-500 font-sans"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
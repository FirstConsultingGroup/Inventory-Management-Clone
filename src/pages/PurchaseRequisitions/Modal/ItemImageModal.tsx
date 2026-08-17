import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";


interface ItemImageModalProps {
  open: boolean;
  image: any;
  onClose: () => void;

  images: {
    image1: string | null;
    image2: string | null;
  };

  setImages: React.Dispatch<
    React.SetStateAction<{
      image1: string | null;
      image2: string | null;
    }>
  >;

  setImage1File: React.Dispatch<React.SetStateAction<File | null>>;
  setImage2File: React.Dispatch<React.SetStateAction<File | null>>;
}
const ItemImageModal = ({
  open,
  onClose,
  images,
  setImages,
  setImage1File,
  setImage2File,
}: ItemImageModalProps) => {
  const [selectedImageSlot, setSelectedImageSlot] = useState<
    "image1" | "image2" | null
  >(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSave = () => {
    if (!previewImage || !selectedImageSlot) return;

    setImages((prev) => ({
      ...prev,
      [selectedImageSlot]: previewImage,
    }));

    if(selectedFile){
    if (selectedImageSlot === "image1") {
      setImage1File(selectedFile);
    } else {
      setImage2File(selectedFile);
    }
  }

    setSelectedImageSlot(null);
    setPreviewImage(null);
    setSelectedFile(null);
  };

  const startCamera = async () => {
    try {
      setIsCameraStarting(true);
      setCameraError("");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      streamRef.current = stream;

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraStarting(false);
          };
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setCameraError(
        "Unable to access camera. Please allow camera permission."
      );
      setIsCameraStarting(false);
    }
  };
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [cameraOpen]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) {
            setSelectedImageSlot(null);
            setPreviewImage(null);
            onClose();
          }
        }}
      >
        <DialogContent className="w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="text-blue-700 text-xl">
              Images
            </DialogTitle>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setSelectedFile(file);
              setPreviewImage(URL.createObjectURL(file));
            }}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setPreviewImage(URL.createObjectURL(file));
            }}
          />

          {/* Image Selection */}
          {!selectedImageSlot ? (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => {
                  setSelectedImageSlot("image1");
                  setPreviewImage(images.image1);
                }}
              >
                Image 1 {images.image1 && "(Added)"}
              </Button>

              <Button
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => {
                  setSelectedImageSlot("image2");
                  setPreviewImage(images.image2);
                }}
              >
                Image 2 {images.image2 && "(Added)"}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h3 className="font-medium text-blue-700 mb-3">
                  Selected Action For{" "}
                  {selectedImageSlot === "image1"
                    ? "Image 1"
                    : "Image 2"}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Button
                    type="button"
                    className="bg-blue-600 text-white hover:bg-blue-700 w-full"
                    onClick={() => setCameraOpen(true)}
                  >
                    Capture Image
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Image
                  </Button>

                  <Button
                    type="button"
                    disabled={!previewImage}
                    onClick={handleSave}
                    className={
                      !previewImage
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed w-full"
                        : "bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 w-full"
                    }
                  >
                    Save
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 w-full"
                    onClick={() => {
                      setSelectedImageSlot(null);
                      setPreviewImage(null);
                    }}
                  >
                    Back
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 min-h-[300px] flex items-center justify-center bg-gray-50">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="max-h-[280px] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-gray-500 text-center">
                    No Image Selected
                  </div>
                )}
              </div>
            </>
          )}


        </DialogContent>


      </Dialog>
      <Dialog
        open={cameraOpen}
        onOpenChange={(open) => {
          if (!open) {
            stopCamera();
            setCameraOpen(false);
          }
        }}
      >
        <DialogContent className="w-[85vw] max-w-[1100px]">
          <DialogHeader>
            <DialogTitle>Capture Image</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-[350px] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {isCameraStarting && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">
                  Starting Camera...
                </div>
              )}
            </div>

            {cameraError && (
              <p className="text-red-500 text-sm">
                {cameraError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  stopCamera();
                  setCameraOpen(false);
                }}
              >
                Cancel
              </Button>

              <Button
                onClick={() => {
                  const video = videoRef.current;

                  if (!video) return;

                  const canvas = document.createElement("canvas");

                  canvas.width = video.videoWidth || 1280;
                  canvas.height = video.videoHeight || 720;

                  const ctx = canvas.getContext("2d");

                  if (!ctx) return;

                  ctx.drawImage(
                    video,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                  );

                  canvas.toBlob(
                    (blob) => {
                      if (!blob) return;

                      // Preview image
                      const imageUrl = URL.createObjectURL(blob);
                      setPreviewImage(imageUrl);

                      // File save cheyyunnu
                      const file = new File(
                        [blob],
                        `capture-${Date.now()}.jpg`,
                        {
                          type: "image/jpeg",
                        }
                      );

                      setSelectedFile(file);

                      stopCamera();
                      setCameraOpen(false);
                    },
                    "image/jpeg",
                    0.9
                  );
                }}
              >
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ItemImageModal;
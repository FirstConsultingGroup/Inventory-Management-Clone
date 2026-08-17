import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Scanner } from '@yudiel/react-qr-scanner';
// import toast from 'react-hot-toast';

interface ScanQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (scannedValue: string) => void;
}

const ScanQRModal: React.FC<ScanQRModalProps> = ({ isOpen, onClose, onSuccess }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
        </DialogHeader>
        <div className="w-full flex justify-center items-center overflow-hidden rounded-lg mt-4 bg-black">
          {isOpen && (
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) {
                  const scannedValue = result[0].rawValue;
                  // toast.success(`Scanned User ID: ${scannedValue}`);
                  if (onSuccess) {
                    onSuccess(scannedValue);
                  } else {
                    onClose();
                  }
                }
              }}
              onError={(error) => {
                console.error(error);
                // Don't toast error continuously to prevent spam if camera is adjusting
              }}
            />
          )}
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">
          Point your camera at the generated QR code.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ScanQRModal;

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, ScanLine } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import ScanQRModal from './ScanQRModal';

interface QRCodeSectionProps {
  userId: string;
}

const QRCodeSection: React.FC<QRCodeSectionProps> = ({ userId }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  const downloadQRCode = () => {
    const canvas = document.getElementById('qr-gen') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-code-${userId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const handleGenerate = () => {
    if (userId) {
      setIsGenerated(true);
    }
  };

  return (
    <>
      <Card className="w-full bg-white shadow-sm border border-gray-200">
        <CardContent className="p-4 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 text-center">
            QR Code Access
          </h3>

          <div className="w-32 h-32 mb-4 flex justify-center items-center bg-gray-50 border border-gray-100 rounded-lg overflow-hidden p-2">
            {isGenerated && userId ? (
              <QRCodeCanvas
                id="qr-gen"
                value={userId}
                size={120}
                level={"H"}
                includeMargin={true}
              />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <QrCode className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-400 text-center px-2">
                  No QR code generated
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2 w-full justify-center">
              <Button
                onClick={handleGenerate}
                disabled={isGenerated || !userId}
                size="sm"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1 px-2"
              >
                <QrCode className="h-3.5 w-3.5 mr-1" />
                Generate
              </Button>
              <Button
                variant="outline"
                onClick={downloadQRCode}
                disabled={!isGenerated}
                size="sm"
                className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50 flex-1 px-2"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => setIsScannerOpen(true)}
              size="sm"
              className="hidden text-xs w-full px-3"
            >
              <ScanLine className="h-3.5 w-3.5 mr-1" />
              Test Scanner
            </Button>
          </div>
        </CardContent>
      </Card>

      <ScanQRModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </>
  );
};

export default QRCodeSection;

import { Package } from 'lucide-react';
import type { JSX } from 'react';

interface PrintTemplateProps {
  reportData: any;
  selectedReportType: string;
  dateRange: [Date | null, Date | null];
  getStatusBadge: (status: string, type: string) => JSX.Element;
}

const PrintTemplate: React.FC<PrintTemplateProps> = ({
  reportData,
  selectedReportType,
  dateRange,
  getStatusBadge,
}) => {
  // Format date helper function
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get the data array based on report type
  const getData = () => {
    if (selectedReportType === 'purchase-order') {
      return reportData['purchase-order']?.data || [];
    }
    return [];
  };

  const data = getData();

  return (
    <div className="print-template min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-[210mm] mx-auto p-6 print:p-8">
        {/* Enhanced Header Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8 print:shadow-none print:border-gray-300 break-inside-avoid">
          <div className="border-b border-gray-200 px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">ABC Company Ltd.</h1>
                  <p className="text-gray-600 text-sm">Inventory Management System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {/* <p className="text-gray-700 text-sm font-medium">System ID</p>
                  <p className="text-gray-500 text-xs">IMS2025</p> */}
                </div>
              </div>
            </div>
          </div>
          <div className="px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Purchase Order Report
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Report Type: Purchase Orders
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Total Records: {data.length}
                  </span>
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Date Range
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {dateRange[0] && dateRange[1]
                      ? `${formatDate(dateRange[0])} – ${formatDate(dateRange[1])}`
                      : 'All Time'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Order Report Content */}
        {selectedReportType === 'purchase-order' && data.length > 0 && (
          <div className="space-y-8">
            {data.map((currentItem: any, index: number) => (
              <div
                key={currentItem.id || index}
                className="bg-white border border-gray-200 rounded-lg p-6 break-inside-avoid print:mb-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      Purchase Order: {currentItem.id}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Supplier:</span>{' '}
                        {currentItem.supplier}
                      </p>
                      <p>
                        <span className="font-medium">Purchase Date:</span>{' '}
                        {formatDate(currentItem.purchaseDate)}
                      </p>
                      <p>
                        <span className="font-medium">Delivery Date:</span>{' '}
                        {formatDate(currentItem.deliveryDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="mb-4">
                      {getStatusBadge(currentItem.status, 'purchase-order')}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Total Cost:</span>{' '}
                        {currentItem.totalCost}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">
                            Item Code
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">
                            Item Name
                          </th>
                          <th className="px-4 py-3 text-center font-medium text-gray-700">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">
                            Unit Price
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-700">
                            Line Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItem.itemBreakdown?.map(
                          (item: any, itemIndex: number) => (
                            <tr
                              key={itemIndex}
                              className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                              <td className="px-4 py-3 font-medium">{item.itemCode}</td>
                              <td className="px-4 py-3">{item.itemName}</td>
                              <td className="px-4 py-3 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-right">{item.unitPrice}</td>
                              <td className="px-4 py-3 text-right font-medium">
                                {item.lineTotal}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Data Message */}
        {data.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12 break-inside-avoid">
            <div className="text-gray-500">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Reports Found</h3>
              <p className="text-sm">No data available for the selected criteria.</p>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide non-printable elements */
          body > *:not(.print-template),
          .chatbot-icon,
          .scrollbar,
          [class*="chat"],
          [class*="sidebar"],
          [class*="nav"],
          [class*="footer"],
          [class*="header"]:not(.print-template *) {
            display: none !important;
          }

          /* Ensure print template is visible */
          .print-template {
            display: block !important;
            position: static !important;
            width: 100%;
            height: auto;
            overflow: visible !important;
          }

          body { 
            margin: 0;
            padding: 0;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }

          .break-inside-avoid { 
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 5mm;
          }

          .max-w-[210mm] {
            width: 210mm !important;
            min-height: 297mm;
            box-sizing: border-box;
          }

          /* Force page break before each card except the first */
          .space-y-8 > div:not(:first-child) {
            page-break-before: always;
            margin-top: 0 !important;
          }

          /* Ensure cards don't split and have proper spacing */
          .bg-white {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 32px !important;
            box-sizing: border-box;
          }

          /* Spacing for print */
          .space-y-8 > * + * {
            margin-top: 32px !important;
          }

          /* Table styles for print */
          table {
            border-collapse: collapse;
            width: 100%;
            table-layout: auto;
          }

          th, td {
            border: 1px solid #e5e7eb;
            padding: 3mm 2mm;
            box-sizing: border-box;
          }

          /* Ensure table content is visible */
          .overflow-x-auto, .print\\:overflow-visible {
            overflow: visible !important;
          }

          /* Status badge styles for print */
          .bg-green-100 { background-color: #dcfce7 !important; }
          .bg-yellow-100 { background-color: #fef3c7 !important; }
          .bg-red-100 { background-color: #fee2e2 !important; }
          .bg-blue-100 { background-color: #dbeafe !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-50 { background-color: #f9fafb !important; }

          .text-green-800 { color: #166534 !important; }
          .text-yellow-800 { color: #92400e !important; }
          .text-red-800 { color: #991b1b !important; }
          .text-blue-800 { color: #1e40af !important; }
          .text-gray-800 { color: #1f2937 !important; }
          .text-blue-600 { color: #2563eb !important; }

          .rounded-xl, .rounded-lg { border-radius: 8px !important; }
          .shadow-lg, .shadow-sm { box-shadow: none !important; }

          .bg-blue-500 { background-color: #3b82f6 !important; }
          .bg-green-500 { background-color: #10b981 !important; }
        }

        @media screen {
          .print-template {
            display: block;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintTemplate;
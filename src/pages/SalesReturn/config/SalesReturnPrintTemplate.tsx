import { format } from 'date-fns';

interface ReturnItem {
    id: string;
    itemNumber?: string;
    name: string;
    returnQuantity: number;
    reason: string;
    nextStore?: string;
    location_name?: string;
    unitPrice?: number;
    netAmount?: number;
}

interface SalesReturnData {
    companyInfo: any;
    id: string;
    returnNumber: string;
    returnDate: string;
    customer: {
        name: string;
        contact: string;
        address: string;
    };
    linkedInvoice?: {
        invoiceNumber: string;
        invoiceDate: string;
        storeName: string;
    };
    items: ReturnItem[];
    totals: {
        totalReturnedQuantity: number;
    };
}

const generateSalesReturnPDF = (data: SalesReturnData) => {
    console.log('Generate sales return PDF called with data:', data);

    const formattedDate = format(new Date(data.returnDate), 'dd-MM-yyyy');
    const items = Array.isArray(data.items) ? data.items : [];
    const totalItems = items.length;
    const totalReturnedQty = items.reduce((sum, item) => sum + (item.returnQuantity || 0), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemRows = items
        .map((item, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="item-name">${item.name || ''}</td>
        <td class="text-center">${item.returnQuantity || 0}</td>
        <td style="max-width: 220px;">${item.reason || '-'}</td>
        <td style="max-width: 140px;">${item.nextStore || '-'}</td>
        <td style="max-width: 180px; font-weight: 500;">${item.location_name || '-'}</td>
      </tr>
    `)
        .join("");

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sales Return #${data.returnNumber}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0; padding: 0; color: #1f2937; line-height: 1.5; font-size: 14px;
          }
          .invoice-container { max-width: 100%; margin: 0 auto; }
          .invoice-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;
          }
          .company-info h1 { font-size: 28px; font-weight: bold; color: #1e40af; margin: 0 0 8px 0; }
          .company-info p { margin: 4px 0; color: #6b7280; }
          .invoice-details { text-align: right; }
          .invoice-details h2 { font-size: 24px; font-weight: bold; color: #111827; margin: 0 0 12px 0; }
          .invoice-details p { margin: 4px 0; color: #6b7280; }
          .customer-section { margin-bottom: 20px; }
          .customer-info {
            border-left: 4px solid #2563eb; padding-left: 16px; background-color: #f8fafc; padding-top: 10px;
            padding-bottom: 10px; padding-left: 16px; padding-left: 16px; border-radius: 8px;
          }
          .customer-info h3 { font-size: 16px; font-weight: 600; color: #1e40af; margin: 0 0 12px 0; }
          .customer-info p { margin: 4px 0; color: #374151; }
          .customer-name { font-size: 16px; color: #111827; }
          .linked-invoice-info {
            border-right: 4px solid #2563eb; padding-left: 16px; background-color: #f8fafc; padding-top: 10px;
            padding-bottom: 10px; padding-left: 16px; padding-left: 16px; border-radius: 8px;
          }
          .linked-invoice-info h3 { font-size: 16px; font-weight: 600; color: #1e40af; margin: 0 0 12px 0; }
          .linked-invoice-info p { margin: 4px 0; color: #374151; }
          .items-table {
            width: 100%; border-collapse: collapse; margin: 20px 0;
            background-color: white; border-radius: 8px; overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); table-layout: auto;
          }
          .items-table th {
            background-color: #eff6ff; color: #1e40af; font-weight: 600;
            padding: 12px 8px; text-align: left; font-size: 13px; border-bottom: 2px solid #dbeafe;
          }
          .items-table td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; }
          .items-table tbody tr:hover { background-color: #f8fafc; }
          .items-table tbody tr:last-child td { border-bottom: none; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }
          .item-name { font-weight: 500; color: #111827; }
          .totals-section { margin-top: 40px; display: flex; justify-content: flex-end; }
          .totals-box {
            width: 350px; background-color: #f8fafc; padding: 20px;
            border-radius: 8px; border: 1px solid #e2e8f0;
          }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 4px 0; }
          .total-row.final {
            border-top: 2px solid #cbd5e1; padding-top: 12px; margin-top: 12px;
            font-weight: bold; font-size: 16px; color: #1e40af;
          }
          .total-label { color: #64748b; }
          .total-value { font-weight: 500; }
          .invoice-footer {
            margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb;
            text-align: center; color: #6b7280; font-size: 13px;
          }
          .item-cell {
            max-width: 260px;
            vertical-align: top;
          }
          .item-cell .item-number {
            font-size: 12px;
            color: #666;
            white-space: nowrap;
          }
          .item-cell .item-name {
            font-weight: 500;
            color: #111827;
            white-space: normal;
            word-break: break-word;
            line-height: 1.3;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="invoice-header">
            <div class="company-info">
              <h1>${data.companyInfo.name}</h1>
              <p>Phone: ${data.companyInfo.phone}</p>
              <p>${data.companyInfo.address}</p>
            </div>
            <div class="invoice-details">
              <h2>SALES RETURN</h2>
              <p><strong>Return #:</strong> ${data.returnNumber}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
            </div>
          </div>

          <!-- Customer & Linked Invoice -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
            <div class="customer-section">
              <div class="customer-info">
                <h3>Returned By</h3>
                <p class="customer-name"><strong>${data.customer.name}</strong></p>
                <p><strong>Contact:</strong> ${data.customer.contact}</p>
                ${data.customer.address ? `<p><strong>Address:</strong> ${data.customer.address}</p>` : ''}
              </div>
            </div>
            
            <div>
              <div class="linked-invoice-info">
                <h3>Reference Invoice</h3>
                ${data.linkedInvoice
            ? `
                      <p><strong>Invoice #:</strong> ${data.linkedInvoice.invoiceNumber}</p>
                      <p><strong>Date:</strong> ${data.linkedInvoice.invoiceDate ? format(new Date(data.linkedInvoice.invoiceDate), 'dd-MM-yyyy') : '-'}</p>
                      <p><strong>Sold From:</strong> ${data.linkedInvoice.storeName}</p>
                    `
            : '<p>No linked invoice</p>'
        }
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">#Sl No</th>
                <th>Item Name</th>
                <th style="width: 70px; text-align:center;">Return Qty</th>
                <th style="width: 220px;">Reason</th>
                <th style="width: 140px;">Next Store</th>
                <th style="width: 180px;">Storage Location</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row">
                <span class="total-label">Total Returned Items:</span>
                <span class="total-value">${totalItems}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total Returned Quantity:</span>
                <span class="total-value">${totalReturnedQty}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="invoice-footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>This is a computer generated sales return document</p>
          </div>
        </div>
      </body>
    </html>
  `);

    printWindow.document.close();

    const triggerPrint = () => {
        printWindow.focus();
        printWindow.print();
    };

    if ('onafterprint' in printWindow) {
        printWindow.addEventListener('afterprint', () => printWindow.close());
    }

    if (printWindow.document.readyState === 'complete') {
        triggerPrint();
    } else {
        printWindow.onload = triggerPrint;
    }
};

export default generateSalesReturnPDF;
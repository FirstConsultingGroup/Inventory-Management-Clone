import { format } from 'date-fns';

interface ItemProps {
  item_id: string | null;
  item_name: string;
  req_qty: number | null;
  cost_price: number | 0 | null;
  amount: number | 0 | null;
}

interface QuotationData {
    companyInfo: any;
    id: string;
    quotationNumber: string;
    quotationDate: string;
    supplier: string;
    status:string;
    items: ItemProps[];
    grandTotal:number;
}

const generateQuotationPDF = (data: QuotationData) => {
    console.log('Generate Quotation PDF called with data:', data);

    const formattedDate = format(new Date(data.quotationDate), 'dd-MM-yyyy');
    const items = Array.isArray(data.items) ? data.items : [];

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemRows = items
        .map((item, index) => `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="item-name">${item.item_id || ''}</td>
        <td class="item-name" style="text-transform: capitalize;">${item.item_name || ''}</td>
        <td class="text-center">${item.req_qty || 0}</td>
        <td class="text-right">${item.cost_price || 0}</td>
        <td class="text-right">${item.amount || 0}</td>
      </tr>
    `)
        .join("");

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Quotation - ${data.quotationNumber}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0; padding: 0; color: #1f2937; line-height: 1.5; font-size: 14px;
          }
          .quotation-container { max-width: 100%; margin: 0 auto; }
          .quotation-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 10px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;
          }
          .company-info h1 { font-size: 24px; font-weight: bold; color: #4267df; margin: 0 0 8px 0; }
          .company-info p { margin: 2px 0; font-size: 12px; }
          .quotation-details { text-align: left; }
          .quotation-details h2 { font-size: 18px; font-weight: bold; color: #2e51c5; margin: 0 0 12px 0; }
          .quotation-details p { margin: 4px 0; font-size: 12px; }
          .quotation-details span {display: inline-block; margin-top: 10px; font-size: 13px; padding: 3px 8px; font-weight: bold; color: #2e51c5; background-color: #dbe3ff; border-radius: 8px;}
          .items-table {
            width: 100%; margin: 20px 0; border-collapse: collapse;
            background-color: white; overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); table-layout: auto;
          }
          .items-table th {
            background-color: #eff6ff; color: #1e40af; font-weight: 600;
            padding: 6px; font-size: 13px; font-weight: bold; border: 1px solid #d7d7d7;
          }
          .items-table td {font-size: 13px; padding: 6px; border: 1px solid #d7d7d7; }
          .items-table tbody tr:hover { background-color: #f8fafc; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }
          .item-name { font-weight: 400; color: #111827; }
          .quotation-footer {
            margin-top: 30px;
            text-align: center; color: #6b7280; font-size: 12px;
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
            .quotation-container { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="quotation-container">
          <!-- Header -->
          <div class="quotation-header">
            <div class="company-info">
              <h1>${data.companyInfo.name}</h1>
              <p>${data.companyInfo.address}</p>
              <p>${data.companyInfo.info}</p>
              <p>${data.companyInfo.phone} | ${data.companyInfo.email}</p>
            </div>
            <div class="quotation-details">
              <h2>QUOTATION</h2>
              <p><strong>No:</strong> ${data.quotationNumber}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <span>${data.status}</span>
            </div>
          </div>

          <div>
          <span style="font-weight: 500; color: #111827; font-size: 12px;">Supplier:</span>
          <span style="font-size:12px;">${data.supplier}</span>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">#Sl No</th>
                <th style="text-align: center;">Item Code</th>
                <th style="text-align: center;">Item Name</th>
                <th style="width: 70px; text-align: center;">Qty</th>
                <th style="width: 100px; text-align: center;">Rate</th>
                <th style="width: 100px; text-align: center;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
              <tr style="background-color: #f5f2f2;">
        <td colspan="5" style="text-align: right; font-weight: 500; color: #111827;">Grand Total</td>
        <td style="text-align: right; font-weight: 500; color: #111827;">${data.grandTotal || 0}</td>
      </tr>
            </tbody>
          </table>

          <!-- Footer -->
          <div class="quotation-footer">
          <p><strong>This is a system generated quotation</strong></p>
          <p>No signature required</p>
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

export default generateQuotationPDF;
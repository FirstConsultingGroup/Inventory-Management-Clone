import { formatCurrency } from '@/Utils/formatters';
import { format } from 'date-fns';

export interface ItemMgmt {
  item_name: string;
  description: string | null;
}

export interface SupplierMgmt {
  supplier_name: string | null;
  email: string | null;
  address: string | null;
}

export interface ReturnItem {
  return_reason: any;
  returned_qty: number;
  order_price: number; 
  item_mgmt: ItemMgmt;
}

export interface PurchaseReturnViewData {
  purchase_retrun_number: string;
  return_date: string;
  supplier: SupplierMgmt | null;
  items: ReturnItem[];
  total_items: number;
  total_value: number;
  status: string;
  remarks: string | null;
}

const generatePurchaseReturnPDF = (
  data: PurchaseReturnViewData,
  userInfo: any
) => {
  const formattedDate = format(new Date(data.return_date), 'dd-MM-yyyy');

  // Extract company data safely
  const companyData = userInfo?.company_data || {};
  const companyName = companyData.name || 'Company Name';
  const companyDescription = companyData.description || '';
  const companyAddress = companyData.address || '';
  const companyCity = companyData.city || '';
  const companyState = companyData.state || '';
  const companyPostalCode = companyData.postal_code || '';
  const companyPhone = companyData.phone || '';
  const companyEmail = companyData.email || '';

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemRows = data.items.map((item, index) => {
    const unitPrice =
      item.returned_qty > 0 ? item.order_price / item.returned_qty : 0;
    return `
      <tr>
        <td style="width: 5%;">${index + 1}</td>
        <td style="width: 40%;" class="tdesc">
          <div>${item.item_mgmt.item_name}</div>
          <div class="text-xs text-gray-600">${item.item_mgmt.description || ''}</div>
        </td>
        <td style="width: 15%;">${item.return_reason}</td>
        <td style="width: 10%; text-align: right;">${item.returned_qty}</td>
        <td style="width: 15%; text-align: right;">${formatCurrency(unitPrice)}</td>
        <td style="width: 15%; text-align: right;">${formatCurrency(item.order_price)}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Purchase Return #${data.purchase_retrun_number || 'N/A'}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; font-size: 12px; line-height: 1.4; }
          .po-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px; }
          .company-info { max-width: 180px; }
          .company-info h1 { font-size: 20px; font-weight: bold; color: #2563eb; margin: 0 0 8px 0; }
          .company-info p { font-size: 11px; color: #666; margin: 4px 0; }
          .po-info { text-align: right; }
          .po-info h2 { font-size: 18px; font-weight: bold; color: #1e40af; margin: 0 0 8px 0; }
          .po-info p { font-size: 11px; color: #666; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
          th { background-color: #f8fafc; font-weight: bold; color: #333; text-align: left; }
          td { color: #555; }
          .tdesc div:first-child { font-weight: 600; color: #333; }
          .totals { width: 250px; margin-left: auto; margin-top: 15px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
          .totals-row.final { border-top: 1px solid #ddd; font-weight: bold; font-size: 12px; color: #2563eb; margin-top: 8px; padding-top: 8px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; line-height: 1.5; }
          .status-badge { display: inline-block; padding: 4px 8px; border-radius: 3px; font-weight: 600; font-size: 10px; }
          .status-returned { background-color: #dcfce7; color: #166534; }
          .additional-details { margin-top: 15px; }
          .additional-details h4 { font-size: 14px; font-weight: bold; color: #1e40af; margin: 0 0 6px 0; }
          .additional-details p { font-size: 11px; color: #666; margin: 4px 0; }
          .info-group p { margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="po-header">
          <div class="company-info">
            <h1>${companyName}</h1>
            <p>${companyDescription}</p>
            <p>${companyAddress}</p>
            <p>${companyCity}${companyCity && companyState ? ', ' : ''}${companyState}${companyPostalCode ? ', ' + companyPostalCode : ''}</p>
            ${companyPhone ? `<p>Phone: ${companyPhone}</p>` : ''}
            ${companyEmail ? `<p>Email: ${companyEmail}</p>` : ''}
          </div>
          <div class="po-info">
            <h2>PURCHASE RETURN</h2>
            <p>Return #: ${data.purchase_retrun_number || 'N/A'}</p>
            <p>Date: ${formattedDate}</p>
            <span class="status-badge status-${data.status?.toLowerCase().replace(/[ _]/g, '-') || 'unknown'}">${data.status?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-group">
            <h3>Supplier</h3>
            <span>${data.supplier?.supplier_name || 'N/A'}</span><br>
            <span>${data.supplier?.address || 'N/A'}</span><br>
            <span>${data.supplier?.email || 'N/A'}</span><br>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 40%;">Item Name & Description</th>
              <th style="width: 15%;">Return Reason</th>
              <th style="width: 10%; text-align: right;">Quantity</th>
              <th style="width: 15%; text-align: right;">Unit Price</th>
              <th style="width: 15%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="font-weight: bold;">Grand Total</td>
              <td style="text-align: right; font-weight: bold;">${data.total_items || 0}</td>
              <td></td>
              <td style="text-align: right; font-weight: bold;">${formatCurrency(Number(data.total_value))}</td>
            </tr>
          </tfoot>
        </table>

        <div class="additional-details">
          <h4>Remarks</h4>
          <p>${data.remarks || 'N/A'}</p>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          ${companyEmail ? `<p>Contact: ${companyEmail}</p>` : '<p>Contact: support@garageinventory.com</p>'}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

export default generatePurchaseReturnPDF;

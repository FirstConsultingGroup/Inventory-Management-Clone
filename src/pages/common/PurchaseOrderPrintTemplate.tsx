import { format } from 'date-fns';
import { IPurchaseOrder } from '@/Utils/constants';
import { formatCurrency } from '@/Utils/formatters';

// Custom interfaces to match Supabase query response
interface ItemMgmt {
  item_name: string;
  description: string | null;
  item_id: string | null;
  
}

interface SupplierMgmt {
  supplier_name: string | null;
  email: string | null;
  address: string | null;
}

interface StoreMgmt {
  name: string;
  address: string | null;
}

interface PurchaseOrderItem {
  created_at: string;
  id: string;
  is_active: boolean | null;
  item_id: string;
  modified_at: string | null;
  order_price: number | null;
  order_qty: number | null;
  purchase_order_id: string;
  received_qty: number | null;
  remarks: string | null;
  returned_qty: number | null;
  item_mgmt: ItemMgmt;
}

interface PurchaseOrderViewData extends IPurchaseOrder {
  items: PurchaseOrderItem[];
  supplier: SupplierMgmt | null;
  store: StoreMgmt | null;
  order_status: string;
  userInfo: any
}

const formatNumber = (value: number | null): string => {
  return value !== null ? value.toFixed(2) : "0.00";
};

const generatePurchaseOrderPDF = (data: PurchaseOrderViewData, userInfo: any) => {
  const formattedDate = format(new Date(data.order_date), 'dd-MM-yyyy');
  console.log(data, "Purchase Order Data");
  const calculateTotals = () => {
    const subtotal = data.items.reduce((total, item) => {
      const price = item.order_price || 0;
      return total + price;
    }, 0);
    return {
      subtotal: formatNumber(subtotal),
      total: formatNumber(subtotal), // No VAT for PO
    };
  };

  const totals = calculateTotals();

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

  const itemRows = data.items.map((item, index) => `
    <tr>
      <td style="width: 5%;">${index + 1}</td>
      <td style="width: 15%;">${item.item_mgmt.item_id || 'N/A'}</td>
      <td style="width: 40%;" class="tdesc">
        <div>${item.item_mgmt.item_name}</div>
        <div class="text-xs text-gray-600">${item.item_mgmt.description || ''}</div>
      </td>
      <td style="width: 15%; text-align: right;">${item.order_qty || 0}</td>
      <td style="width: 15%; text-align: right;">${formatCurrency(item.order_price && item.order_qty ? item.order_price / item.order_qty : 0)}</td>
      <td style="width: 15%; text-align: right;">${formatCurrency(item.order_price ?? 0)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Purchase Order #${data.po_number || 'N/A'}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #333;
            font-size: 12px;
            line-height: 1.4;
          }
          .po-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 15px;
          }
          .company-info {
            max-width: 180px;
          }
          .company-info h1 {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            margin: 0 0 8px 0;
          }
          .company-info p {
            font-size: 11px;
            color: #666;
            margin: 4px 0;
          }
          .po-info {
            text-align: right;
          }
          .po-info h2 {
            font-size: 18px;
            font-weight: bold;
            color: #1e40af;
            margin: 0 0 8px 0;
          }
          .po-info p {
            font-size: 11px;
            color: #666;
            margin: 4px 0;
          }
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-group {
            border-left: 3px solid #2563eb;
            padding-left: 8px;
          }
          .info-group h3 {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            margin: 0 0 6px 0;
          }
          .info-group p {
            font-size: 11px;
            color: #666;
            margin: 4px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            font-size: 11px;
          }
          th {
            background-color: #f8fafc;
            font-weight: bold;
            color: #333;
            text-align: left;
          }
          td {
            color: #555;
          }
          .tdesc div:first-child {
            font-weight: 600;
            color: #333;
          }
          .totals {
            width: 250px;
            margin-left: auto;
            margin-top: 15px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 11px;
          }
          .totals-row.final {
            border-top: 1px solid #ddd;
            font-weight: bold;
            font-size: 12px;
            color: #2563eb;
            margin-top: 8px;
            padding-top: 8px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 10px;
            line-height: 1.5;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
          }
          .status-created { background-color: #dbeafe; color: #1e40af; }
          .status-issued { background-color: #fef9c3; color: #854d0e; }
          .status-received { background-color: #dcfce7; color: #166534; }
          .status-partially-received { background-color: #ffedd5; color: #c2410c; }
          .status-cancelled { background-color: #fee2e2; color: #991b1b; }
          .additional-details {
            margin-top: 15px;
          }
          .additional-details h4 {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            margin: 0 0 6px 0;
          }
          .additional-details p {
            font-size: 11px;
            color: #666;
            margin: 4px 0;
          }
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
            <h2>PURCHASE ORDER</h2>
            <p>PO #: ${data.po_number || 'N/A'}</p>
            <p>Date: ${formattedDate}</p>
            <span class="status-badge status-${data.order_status?.toLowerCase().replace(/[ _]/g, '-') || 'unknown'}">${data.order_status?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-group">
            <h3>Supplier</h3>
            <p>${data.supplier?.supplier_name || 'N/A'}</p>
            <p>${data.supplier?.address || 'N/A'}</p>
            <p>${data.supplier?.email || 'N/A'}</p>
          </div>
          <div class="info-group">
            <h3>Delivery To</h3>
            <p>${data.store?.name || 'N/A'}</p>
            <p>${data.store?.address || 'N/A'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 15%;">Item ID</th>
              <th style="width: 40%;">Description</th>
              <th style="width: 15%; text-align: right;">Quantity</th>
              <th style="width: 15%; text-align: right;">Cost Price</th>
              <th style="width: 15%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4"></td>
              <td style="font-weight: bold;">Total Items:</td>
              <td style="text-align: right;">${data.total_items || 0}</td>
            </tr>
            <tr class="font-bold">
              <td colspan="4"></td>
              <td style="font-weight: bold;">Total:</td>
              <td style="text-align: right;">${formatCurrency(Number(totals.total))}</td>
            </tr>
          </tfoot>
        </table>

        <div class="additional-details">
          <h4>Additional Details</h4>
          <p><strong>Payment Details:</strong> ${data.payment_details || 'N/A'}</p>
          <p><strong>Remarks:</strong> ${data.remarks || 'N/A'}</p>
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

export default generatePurchaseOrderPDF;
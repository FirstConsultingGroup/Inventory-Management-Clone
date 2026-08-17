import { formatCurrency } from '@/Utils/formatters';
import { format } from 'date-fns';

export type BillingPrintItem = {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
};

export type BillingPrintData = {
  id: string;
  billing_number: string;
  customer_name: string;
  contact_number: string;
  billing_date: string;
  net_amount: number;
  status: 'paid' | 'pending' | 'overdue';
  items: BillingPrintItem[];
  company: {
    id: string;
    name: string;
    address: string;
    contact_number: string;
  };
};

const computeLineTotals = (item: BillingPrintItem) => {
  const gross = item.quantity * item.unit_price;
  const discount = (gross * (item.discount_percentage ?? 0)) / 100;
  const net = gross - discount;
  return { gross, discount, net };
};

const generateBillingPrint = (data: BillingPrintData) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const formattedDate = data.billing_date
    ? format(new Date(data.billing_date), 'dd-MM-yyyy')
    : '--';

  const totals = data.items.reduce(
    (acc, item) => {
      const { gross, discount, net } = computeLineTotals(item);
      acc.gross += gross;
      acc.discount += discount;
      acc.net += net;
      return acc;
    },
    { gross: 0, discount: 0, net: 0 }
  );

  const itemRows = data.items
    .map((item, index) => {
      const { gross, net } = computeLineTotals(item);
      return `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>
            <div class="item-name">${item.item_name}</div>
            <div class="item-meta">${item.item_id}</div>
          </td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unit_price)}</td>
          <td class="text-right">${formatCurrency(gross)}</td>
          <td class="text-center discount-cell">
            ${item.discount_percentage ? `${item.discount_percentage}%` : '-'}
          </td>
          <td class="text-right font-semibold">${formatCurrency(net)}</td>
        </tr>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Billing #${data.billing_number}</title>
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1f2937;
            line-height: 1.5;
            font-size: 13px;
            background: #f8fafc;
          }

          .print-container {
            max-width: 100%;
            margin: 0 auto;
            background: #fff;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
          }

          .company-info h1 {
            font-size: 26px;
            margin: 0 0 6px;
            color: #0f172a;
          }

          .company-info p {
            margin: 2px 0;
            color: #475569;
          }

          .document-meta {
            text-align: right;
          }

          .document-meta h2 {
            margin: 0;
            font-size: 24px;
            color: #1d4ed8;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .meta-row {
            margin-top: 12px;
            color: #475569;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
          }

          .status-paid { background: #dcfce7; color: #166534; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-overdue { background: #fee2e2; color: #dc2626; }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin: 28px 0 30px;
          }

          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 18px;
            background: #f8fafc;
          }

          .info-card h3 {
            margin: 0 0 10px;
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .info-card p {
            margin: 4px 0;
            color: #1e293b;
            font-weight: 500;
          }

          .info-card span {
            display: block;
            color: #475569;
            font-size: 12px;
          }

          .table-wrapper {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
          }

          thead {
            background: #eff6ff;
          }

          th {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #1d4ed8;
            padding: 12px 10px;
            text-align: left;
            border-bottom: 2px solid #dbeafe;
          }

          td {
            padding: 12px 10px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          tbody tr:hover {
            background: #f8fafc;
          }

          .item-name {
            font-weight: 600;
            color: #0f172a;
          }

          .item-meta {
            font-size: 11px;
            color: #94a3b8;
          }

          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }

          .discount-cell { color: #059669; }

          .totals-section {
            margin-top: 32px;
            display: flex;
            justify-content: flex-end;
          }

          .totals-card {
            width: 360px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            background: #fff;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            color: #475569;
          }

          .totals-row span:last-child {
            color: #0f172a;
            font-weight: 600;
          }

          .totals-row.final {
            border-top: 2px solid #e2e8f0;
            padding-top: 12px;
            margin-top: 12px;
            font-size: 16px;
            color: #1d4ed8;
          }

          .footer {
            margin-top: 40px;
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
          }

          .footer strong {
            color: #475569;
          }

          @media print {
            body {
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .print-container {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="header">
            <div class="company-info">
              <h1>${data.company.name}</h1>
              <p>${data.company.address || '—'}</p>
              <p>Contact: ${data.company.contact_number || '—'}</p>
            </div>
            <div class="document-meta">
              <h2>Billing</h2>
              <div class="meta-row"><strong>Billing #:</strong> ${data.billing_number}</div>
              <div class="meta-row"><strong>Date:</strong> ${formattedDate}</div>
              <span class="status-badge status-${data.status}">
                ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </span>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h3>Customer</h3>
              <p>${data.customer_name}</p>
              <span>Contact: ${data.contact_number}</span>
            </div>
            <div class="info-card">
              <h3>Items</h3>
              <p>${data.items.length}</p>
              <span>Total entries</span>
            </div>
            <div class="info-card">
              <h3>Net Amount</h3>
              <p>${formatCurrency(data.net_amount)}</p>
              <span>As per billing record</span>
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">#</th>
                  <th>Item Details</th>
                  <th style="width: 70px;">Qty</th>
                  <th style="width: 100px;">Unit Price</th>
                  <th style="width: 110px;">Gross</th>
                  <th style="width: 90px;">Discount</th>
                  <th style="width: 110px;">Net</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || `
                  <tr>
                    <td colspan="7" class="text-center" style="padding: 40px 0; color: #94a3b8;">
                      No line items available for this billing.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <div class="totals-section">
            <div class="totals-card">
              <div class="totals-row">
                <span>Gross Total</span>
                <span>${formatCurrency(totals.gross)}</span>
              </div>
              <div class="totals-row">
                <span>Total Discount</span>
                <span>-${formatCurrency(totals.discount)}</span>
              </div>
              <div class="totals-row final">
                <span>Net Payable</span>
                <span>${formatCurrency(totals.net || data.net_amount)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Thank you for choosing ${data.company.name}.</strong></p>
            <p>This document was generated from the Billing List.</p>
          </div>
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

export default generateBillingPrint;


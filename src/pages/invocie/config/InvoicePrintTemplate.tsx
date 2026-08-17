// src/config/InvoicePrintTemplate.ts
import { formatCurrency } from '@/Utils/formatters';
import { format } from 'date-fns';

interface InvoiceItem {
  discount_percentage: number;
  tax_percentage: any;
  id: string;
  itemNumber: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  grossAmount: number;
  netAmount: number;
  location_name?: string;
}

interface Totals {
  taxTotals: any;
  grossAmount: number;
  itemsItotalDiscount: number;
  totalTaxAmount: number;
  netAmount: number;
  totalDiscountAmount: number | null | undefined;
  totalDiscountPercentage: number | null | undefined;
  freightCharges: number | null | undefined;
}

interface InvoiceData {
  companyInfo: any;
  id: string;
  invoiceNumber: string;
  date: string;
  customer: {
    name: string;
    contact: string;
    address: string;
  };
  items: InvoiceItem[];
  taxLabels: any;
  totals: Totals;
}

interface PrintOptions {
  isBlank?: boolean;
  hideDiscountAndGross?: boolean;
  hideItemId?: boolean;
  hideLocation?: boolean;
}

const generateInvoicePDF = (data: InvoiceData, options: PrintOptions = {}) => {
  console.log('Generate invoice PDF called with data:', data);
  console.log('Generate invoice PDF called with options:', options);
  const { isBlank = false, hideDiscountAndGross = false, hideItemId = false, hideLocation = false } = options;
  const formattedDate = format(new Date(data.date), 'dd-MM-yyyy');
  const items = Array.isArray(data.items) ? data.items : [];
  console.log('Items array:', items);
  const taxLabels = Array.isArray(data.taxLabels) ? data.taxLabels : [];
  const totals = data.totals || {
    grossAmount: 0,
    itemsItotalDiscount: 0,
    totalTaxAmount: 0,
    netAmount: 0,
    totalDiscountAmount: 0,
    totalDiscountPercentage: 0,
    freightCharges: 0,
  };
  const totalItems = items.length;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemRows = items
    .map((item, index) => {
      console.log(`Item ${index}:`, item);
      const base = (item.quantity || 0) * (item.unitPrice || 0);
      const discountPct = item.discount_percentage || 0;
      const discountAmount = (base * discountPct) / 100;
      const baseAfterDiscount = base - discountAmount;

      const taxCells = taxLabels
        .map((label: string) => {
          const taxPercent = item.tax_percentage?.[label] || 0;
          const taxAmount = (baseAfterDiscount * taxPercent) / 100;

          return `
          <td class="text-right tax-cell">
            ${taxPercent > 0
              ? `
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                  <span style="color: #000000ff;">${taxPercent}%</span>
                  <span style="font-size:11px;">${formatCurrency(taxAmount)}</span>
                </div>
                `
              : `-`
            }
          </td>
        `;
        })
        .join("");

      return `
      <tr>
        <td class="text-center">${index + 1}</td>
        ${
          hideItemId
            ? `
              <td class="item-name">
                ${item.name || ''}
              </td>
            `
            : `
              <td class="item-cell">
                <div class="item-number">
                  ${item.itemNumber || ''}
                </div>
                <div class="item-name">
                  ${item.name || ''}
                </div>
              </td>
            `
        }
        <td class="text-center">${item.quantity || 0}</td>

        <!-- LOCATION COLUMN – only show when NOT blank and NOT hidden -->
        ${!isBlank && !hideLocation ? `<td class="" style="width: 200px; font-weight: 500;">${item.location_name || '-'}</td>` : ''}

        <td class="text-right">${formatCurrency(item.unitPrice || 0)}</td>
        ${!isBlank && !hideDiscountAndGross ? `<td class="text-right">${formatCurrency(item.grossAmount || 0)}</td>` : ''}

        ${taxCells}

        ${!isBlank && !hideDiscountAndGross ? `<td class="text-right discount-cell">
          ${discountPct > 0
          ? `
              <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span style="color: #000000ff;">${discountPct}%</span>
                <span style="font-size:11px; color:#16a34a;">-${formatCurrency(discountAmount || 0)}</span>
              </div>
              `
          : `-`
        }
        </td>` : ''}

        <td class="text-right font-semibold">${formatCurrency(item.netAmount || 0)}</td>
      </tr>
      `;
    })
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #${data.invoiceNumber}</title>
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
          .customer-section { margin-bottom: 40px; }
          .customer-info {
            border-left: 4px solid #2563eb; padding-left: 16px; background-color: #f8fafc;
            padding: 16px; border-radius: 8px;
          }
          .customer-info h3 { font-size: 16px; font-weight: 600; color: #1e40af; margin: 0 0 12px 0; }
          .customer-info p { margin: 4px 0; color: #374151; }
          .customer-name { font-size: 16px; font-weight: 600; color: #111827; }
          .invoice-summary {
            background-color: #f1f5f9; padding: 20px; border-radius: 8px;
            margin-bottom: 30px; border: 1px solid #e2e8f0;
          }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .summary-row:last-child {
            margin-bottom: 0; padding-top: 8px; border-top: 1px solid #cbd5e1;
            font-weight: 600; color: #1e40af;
          }
          .summary-label { color: #64748b; }
          .summary-value { font-weight: 500; }
          .discount-value { color: #059669; }
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
          .discount-cell { color: #059669; }
          .tax-cell { color: #0026ffff; }
          .totals-section { margin-top: 40px; display: flex; justify-content: flex-end; }
          .totals-box {
            width: 350px; background-color: #f8fafc; padding: 20px;
            border-radius: 8px; border: 1px solid #e2e8f0;
          }
          .tax-totals { display: flex; justify-content: space-between; margin-bottom: 3px; padding: 4px 0; font-size: 12px; }
          .all-tax-totals { border-top: 1px solid #cbd5e1; padding-top: 8px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 4px 0; }
          .total-row.final {
            border-top: 2px solid #cbd5e1; padding-top: 12px; margin-top: 12px;
            font-weight: bold; font-size: 16px; color: #1e40af;
          }
          .total-label { color: #64748b; }
          .total-value { font-weight: 500; }
          .discount-total { color: #059669; }
          .invoice-footer {
            margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb;
            text-align: center; color: #6b7280; font-size: 13px;
          }
            /* ITEM COLUMN CONTROL */
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
            white-space: normal;   /* allow wrapping */
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
            </div>
            <div class="invoice-details">
              <h2>INVOICE</h2>
              <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
            </div>
          </div>

          <!-- Customer Info & Summary -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
            <div class="customer-section">
              <div class="customer-info">
                <h3>Bill To</h3>
                <p class="customer-name">${data.customer.name}</p>
                <p>Contact: ${data.customer.contact}</p>
                ${data.customer.address ? `<p>${data.customer.address}</p>` : ''}
              </div>
            </div>
            
            <div class="invoice-summary">
              <div class="summary-row">
                <span class="summary-label">Total Items:</span>
                <span class="summary-value">${totalItems}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Gross Amount:</span>
                <span class="summary-value">${formatCurrency(totals.grossAmount)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Total Items Discount:</span>
                <span class="summary-value discount-value">-${formatCurrency(totals.itemsItotalDiscount ?? 0)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Total Discount Amount (${totals.totalDiscountPercentage ?? 0}%):</span>
                <span class="summary-value discount-value">-${formatCurrency(totals.totalDiscountAmount ?? 0)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Total Tax Amount:</span>
                <span class="summary-value tax-cell">+${formatCurrency(totals.totalTaxAmount ?? 0)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Freight Charges:</span>
                <span class="summary-value tax-cell">+${formatCurrency(totals.freightCharges ?? 0)}</span>
              </div>
              <div class="summary-row">
                <span>Net Amount:</span>
                <span>${formatCurrency(totals.netAmount)}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 60px;">#Sl No</th>
                ${
                  hideItemId
                    ? '<th>Item Name</th>'
                    : '<th>Item</th>'
                }
                <th style="width: 50px; text-align:center;">Qty</th>
                ${!isBlank && !hideLocation ? '<th style="width: 200px;">Location</th>' : ''}
                <th style="width: 80px; text-align:center;">Unit Price</th>
                ${!isBlank && !hideDiscountAndGross ? '<th style="width: 80px;">Gross Amount</th>' : ''}
                ${taxLabels
      .map((label: string) => `<th style="width: 50px; text-align:right;">${label}</th>`)
      .join('')}
                ${!isBlank && !hideDiscountAndGross ? '<th style="width: 80px; text-align:right;">Discount</th>' : ''}
                <th style="width: 90px; text-align:right;">Net Amount</th>
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
                <span class="total-label">Gross Total:</span>
                <span class="total-value">${formatCurrency(totals.grossAmount)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total Items Discount:</span>
                <span class="total-value discount-total">-${formatCurrency(totals.itemsItotalDiscount ?? 0)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Total Discount Amount (${totals.totalDiscountPercentage}%):</span>
                <span class="total-value discount-total">-${formatCurrency(totals.totalDiscountAmount ?? 0)}</span>
              </div>
              <div class="all-tax-totals">
                ${data.taxLabels
      .map((label: string) => `
                    <div class="tax-totals">
                      <span>${label}:</span>
                      <span>${formatCurrency(data.totals.taxTotals?.[label] ?? 0)}</span>
                    </div>`)
      .join('')}
              </div>
              <div class="total-row">
                <span class="total-label">Total Tax Amount:</span>
                <span class="total-value tax-cell">+${formatCurrency(totals.totalTaxAmount ?? 0)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">Freight Charges:</span>
                <span class="total-value tax-cell">+${formatCurrency(totals.freightCharges ?? 0)}</span>
              </div>
              <div class="total-row final">
                <span>Total Amount:</span>
                <span>${formatCurrency(totals.netAmount)}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="invoice-footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>This is a computer generated invoice</p>
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

export default generateInvoicePDF;
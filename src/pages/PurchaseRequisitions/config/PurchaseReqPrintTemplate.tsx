import { format } from "date-fns";

interface PurchaseReqItem {
    itemCode: string;
    itemName: string;
    quantity: number;
}

interface PurchaseRequisitionData {
    prNumber: string;
    prDate: string;
    status: string;
    requestedBy: string;
    company: {
        name: string;
        address: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
        phone: string;
        email: string;
    };
    items: PurchaseReqItem[];
}

const statusStyles: Record<
    string,
    { bg: string; text: string }
> = {
    New: {
        bg: "#FEF3C7",
        text: "#92400E",
    },
    Approved: {
        bg: "#DCFCE7",
        text: "#166534",
    },
    CLOSED: {
        bg: "#DBEAFE",
        text: "#1E40AF",
    },
};

const generatePurchaseRequisitionPDF = (
    data: PurchaseRequisitionData
) => {
    const formattedDate = format(new Date(data.prDate), "dd-MM-yyyy");
    const items = data.items || [];

    const statusStyle =
        statusStyles[data.status] || {
            bg: "#E5E7EB",
            text: "#374151",
        };

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemRows = items
        .map(
            (item, index) => `
      <tr>
        <td style="width:5%;">${index + 1}</td>
        <td style="width:25%;">${item.itemCode}</td>
        <td style="width:50%;">${item.itemName}</td>
        <td style="width:20%; text-align:center;">${item.quantity}</td>
      </tr>
    `
        )
        .join("");

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Purchase Requisition - ${data.prNumber}</title>

  <style>
    @page {
      size: A4;
      margin: 15mm;
    }

    body {
      font-family: "Helvetica", "Arial", sans-serif;
      font-size: 12px;
      color: #333;
      margin: 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }

    .company-info h1 {
      font-size: 22px;
      color: #2563eb;
      margin: 0 0 6px;
    }

    .company-info p {
      margin: 3px 0;
      color: #555;
      font-size: 11px;
    }

    .doc-info {
      text-align: right;
    }

    .doc-info h2 {
      margin: 0;
      font-size: 16px;
      color: #1e40af;
    }

    .doc-info p {
      margin: 4px 0;
      font-size: 11px;
      color: #555;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 6px;
    }

    .info-box {
      margin: 20px 0;
      padding: 12px;
      background: #f8fafc;
      border-left: 4px solid #2563eb;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    th {
      background: #eff6ff;
      color: #1e40af;
      font-weight: 600;
      padding: 8px;
      border: 1px solid #ddd;
      text-align: left;
      font-size: 12px;
    }

    td {
      padding: 8px;
      font-size: 12px;
      border: 1px solid #ddd;
      color: #444;
    }

    .footer {
      margin-top: 35px;
      text-align: center;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>

<body>
  <div class="header">
    <div class="company-info">
      <h1>${data.company.name}</h1>
      <p>${data.company.address}</p>
      <p>${data.company.city}, ${data.company.state}, ${data.company.country}, ${data.company.postalCode}</p>
      <p>Phone: ${data.company.phone}</p>
      <p>Email: ${data.company.email}</p>
    </div>

    <div class="doc-info">
      <h2>PURCHASE REQUISITION</h2>
      <p><strong>PR No:</strong> ${data.prNumber}</p>
      <p><strong>Date:</strong> ${formattedDate}</p>

      <div class="status-badge"
        style="background:${statusStyle.bg}; color:${statusStyle.text};">
        ${data.status.replace(/_/g, " ")}
      </div>
    </div>
  </div>

  <div class="info-box">
    <p><strong>Requested By:</strong> ${data.requestedBy}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:25%;">Item Code</th>
        <th style="width:50%;">Item Name</th>
        <th style="width:20%; text-align:center;">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="footer">
    <p><strong>This is a system-generated Purchase Requisition</strong></p>
    <p>No signature required</p>
  </div>
</body>
</html>
`);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 300);
};

export default generatePurchaseRequisitionPDF;
